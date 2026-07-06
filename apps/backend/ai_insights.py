"""
AI-powered business insights for PET Resin Cost Platform.

Computes variances, trends, anomalies from the data payload, then asks the LLM
(via Asimov / OpenAI-compatible API) to translate the numbers into actionable
business language.  The analysis is intentionally stateless – it consumes the
same /countries payload already produced by the existing data layer so there is
zero extra data loading.
"""

from __future__ import annotations

import os
import statistics
import hashlib
import json
import math
import re
from threading import Lock
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


def _env_value(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return None


# ---------------------------------------------------------------------------
# LLM client (lazy-initialised so import doesn't fail if env vars are missing)
# ---------------------------------------------------------------------------

_client: OpenAI | None = None
_insight_cache: dict[str, str] = {}
_insight_cache_lock = Lock()
_INSIGHT_CACHE_MAX = 200


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = _env_value("OPENAI_API_KEY", "ASIMOV_API_KEY")
        if not api_key:
            raise ValueError(
                "Missing API key. Set OPENAI_API_KEY or ASIMOV_API_KEY in apps/backend/.env"
            )
        base_url = _env_value("BASE_URL", "ASIMOV_BASE_URL")
        _client = OpenAI(api_key=api_key, base_url=base_url)
    return _client


MODEL = "openai/gpt-4o"

# ---------------------------------------------------------------------------
# Analytics helpers
# ---------------------------------------------------------------------------

LABEL_TLC = "total landed cost"
LABEL_RESIN = "resin index vpet"
LABEL_FREIGHT = "freight"
LABEL_TAX = "tax"
LABEL_SUPPLIER_TLC = "total resin price abi virgin formula"

# ---------------------------------------------------------------------------
# Guardrail: only these component keywords are eligible for AI insights.
# Sub Total (CIF) and any other derived subtotals are explicitly excluded.
# ---------------------------------------------------------------------------
ALLOWED_COMPONENT_KEYWORDS: list[str] = [
    "resin",       # Resin Index / Resin Index VPET
    "freight",     # Freight
    "insurance",   # Insurance
    "duty",        # Duty and Import Taxes
    "import tax",  # Import Taxes
    "local tax",   # Local Taxes and Fees
    "local fee",   # Local Fees
]

EXCLUDED_COMPONENT_KEYWORDS: list[str] = [
    "sub total",   # Sub Total (CIF) and similar subtotals
    "subtotal",
    "cif",         # Cost-Insurance-Freight rolled-up values
]


def _is_allowed_component(label: str) -> bool:
    """Return True only if the label matches an allowed component keyword
    and does not match any excluded subtotal keyword."""
    lower = label.strip().lower()
    if any(kw in lower for kw in EXCLUDED_COMPONENT_KEYWORDS):
        return False
    return any(kw in lower for kw in ALLOWED_COMPONENT_KEYWORDS)
MONTH_ORDER = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]
MONTH_INDEX = {name.lower(): i for i, name in enumerate(MONTH_ORDER)}


def _label_matches(label: str, keyword: str) -> bool:
    return keyword in label.strip().lower()


def _breakdown_value(breakdown: list[dict], keyword: str) -> float | None:
    for row in breakdown:
        if _label_matches(str(row.get("label", "")), keyword):
            v = row.get("amount")
            try:
                return float(v)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                pass
    return None


def _supplier_tlc(entry: dict) -> float | None:
    for row in entry.get("rows", []):
        if _label_matches(str(row.get("label", "")), LABEL_SUPPLIER_TLC):
            try:
                return float(row["amount"])  # type: ignore[arg-type]
            except (TypeError, ValueError):
                pass
    return None


def _to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _month_idx(value: Any) -> int:
    if value is None:
        return -1

    text = str(value).strip()
    key = text.lower()
    if key in MONTH_INDEX:
        return MONTH_INDEX[key]

    # Support formats like 2026-07-01, 2026/07/01, 2026-07
    ymd_match = re.search(r"\b(20\d{2})[-/](\d{1,2})(?:[-/](\d{1,2}))?\b", text)
    if ymd_match:
        month_number = int(ymd_match.group(2))
        if 1 <= month_number <= 12:
            return month_number - 1

    return -1


def _extract_year(value: Any) -> int:
    if value is None:
        return 0
    year = int(_to_float(value) or 0)
    if year > 0:
        return year
    text = str(value).strip()
    match = re.search(r"\b(20\d{2})\b", text)
    if match:
        return int(match.group(1))
    return 0


def _is_forecast_row(entry: dict) -> bool:
    # Accept both API-style and standardized-sheet style keys.
    raw = (
        entry.get("dataType")
        or entry.get("Data Type")
        or entry.get("datatype")
        or ""
    )
    return str(raw).strip().lower() == "forecast"


def _entry_period_key(entry: dict) -> tuple[int, int]:
    month_value = (
        entry.get("month")
        or entry.get("Time Period Month")
        or entry.get("Time_Period")
        or entry.get("Time_Period ")
        or entry.get("Time Period")
        or entry.get("period")
    )
    year_value = entry.get("year") or entry.get("Time Period Year")

    year = _extract_year(year_value)
    month = _month_idx(month_value)

    # Fallback for compact date values kept in period fields (e.g. 2026-07-01).
    if year <= 0:
        year = _extract_year(month_value)

    return year, month


def _supplier_name(entry: dict) -> str:
    return str(
        entry.get("supplierName")
        or entry.get("supplier")
        or entry.get("vendor")
        or "Unknown Supplier"
    )


def _same_destination(entry: dict, destination: str) -> bool:
    return str(entry.get("destination", "")).strip().lower() == destination.strip().lower()


def _component_amounts(entry: dict) -> list[tuple[str, float]]:
    """Return cost component (label, amount) pairs for AI insights.

    Guardrail: only components matching ALLOWED_COMPONENT_KEYWORDS are
    included. TLC totals, Sub Total (CIF), and any other derived subtotals
    are excluded to prevent double-counting in gap/driver analysis.
    """
    amounts: list[tuple[str, float]] = []
    for row in entry.get("rows", []):
        label = str(row.get("label", "")).strip()
        if not label:
            continue
        # Exclude TLC totals (supplier and market)
        if _label_matches(label, LABEL_SUPPLIER_TLC) or _label_matches(label, LABEL_TLC):
            continue
        # Guardrail: only permitted components pass through
        if not _is_allowed_component(label):
            continue
        value = _to_float(row.get("amount"))
        if value is None:
            continue
        amounts.append((label, value))
    return sorted(amounts, key=lambda item: abs(item[1]), reverse=True)


def _trend_label_from_series(series: list[float], pct_threshold: float = 2.0) -> str:
    if len(series) < 2:
        return "insufficient data"
    start = series[0]
    end = series[-1]
    if start == 0:
        return "insufficient data"
    pct = ((end - start) / abs(start)) * 100
    if pct > pct_threshold:
        return f"increasing ({pct:.1f}%)"
    if pct < -pct_threshold:
        return f"decreasing ({pct:.1f}%)"
    return f"stable ({pct:.1f}%)"


def _volatility_risk(values: list[float]) -> str:
    if len(values) < 3:
        return "Low"
    mean = statistics.fmean(values)
    if math.isclose(mean, 0.0, abs_tol=1e-9):
        return "Low"
    std = statistics.pstdev(values)
    cv = abs(std / mean)
    if cv >= 0.12:
        return "High"
    if cv >= 0.06:
        return "Medium"
    return "Low"


def _priority_and_action(
    gap_pct: float | None,
    volatility_risk: str,
    forecast_gap_trend: str,
    supplier_rank: int | None,
    market_count: int,
) -> tuple[str, str]:
    if gap_pct is not None:
        if gap_pct < 0:
            return (
                "High",
                "Prioritize pricing correction now; challenge the supplier premium versus same-source market TLC and run a competitive rebid.",
            )
        return (
            "Low",
            "Maintain current sourcing position; the supplier is at or below market, but continue monitoring gap movement.",
        )

    score = 0
    if volatility_risk == "High":
        score += 1
    elif volatility_risk == "Medium":
        score += 0.5
    if "decreasing" in forecast_gap_trend:
        score += 1
    elif "increasing" in forecast_gap_trend:
        # A larger Market - Supplier gap is favourable; reduce score by 1.
        score = max(0, score - 1)
    if supplier_rank is not None and market_count > 0 and supplier_rank > max(1, market_count // 2):
        score += 1

    if score >= 4:
        return (
            "High",
            "Prioritize pricing correction now; challenge the supplier premium versus same-source market TLC and run a competitive rebid.",
        )
    if score >= 2:
        return (
            "Medium",
            "Open negotiation on the largest gap drivers and monitor whether the Market - Supplier gap improves before renewal.",
        )
    return (
        "Low",
        "Maintain current sourcing position; the supplier is at or below market, but continue monitoring gap movement.",
    )


def build_procurement_intelligence(
    page: str,
    destination: str,
    month: str,
    year: str,
    countries: list[dict],
    vendor_breakdowns: list[dict],
    market_research_trends: list[dict],
    base_tlc: float | None,
    simulated_tlc: float | None,
) -> dict[str, Any]:
    year_int = int(_to_float(year) or 0)
    month_idx = _month_idx(month)

    market_tlc_by_source: dict[str, float] = {}
    for c in countries:
        source = str(c.get("country", "")).strip()
        if not source:
            continue
        value = _to_float(c.get("amount"))
        if value is None:
            value = _breakdown_value(c.get("breakdown", []), LABEL_TLC)
        if value is not None:
            market_tlc_by_source[source] = value

    mr_trend_lookup: dict[str, dict[tuple[int, int], float]] = {}
    for row in market_research_trends:
        if destination and not _same_destination(row, destination):
            continue
        src = str(row.get("sourceCountry", "")).strip()
        if not src:
            continue
        value = _to_float(row.get("amount"))
        key = _entry_period_key(row)
        if value is None or key[0] <= 0 or key[1] < 0:
            continue
        mr_trend_lookup.setdefault(src, {})[key] = value

    if not market_tlc_by_source:
        for src, points in mr_trend_lookup.items():
            candidate = points.get((year_int, month_idx)) if month_idx >= 0 else None
            if candidate is None and points:
                candidate = points[sorted(points.keys())[-1]]
            if candidate is not None:
                market_tlc_by_source[src] = candidate

    vendor_rows = [
        v for v in vendor_breakdowns if not destination or _same_destination(v, destination)
    ]

    # Use the raw supplier field (base name) for grouping so that actual and forecast
    # entries from different location variants (e.g. "Amcor" vs "Amcor - China") are
    # merged into a single timeline per (base_supplier, source_country).
    def _base_supplier(entry: dict) -> str:
        return str(
            entry.get("supplier")
            or entry.get("supplierName")
            or entry.get("vendor")
            or "Unknown Supplier"
        )

    grouped: dict[tuple[str, str], list[dict]] = {}
    for entry in vendor_rows:
        key = (
            _base_supplier(entry),
            str(entry.get("sourceCountry", "")).strip(),
        )
        grouped.setdefault(key, []).append(entry)

    snapshot_entries: list[dict] = []
    for entries in grouped.values():
        # Prefer the actual row for the selected month/year as the display snapshot.
        selected = None
        if year_int > 0 and month_idx >= 0:
            actuals_matching = [
                e for e in entries
                if int(_to_float(e.get("year")) or 0) == year_int
                and _month_idx(e.get("month")) == month_idx
                and not _is_forecast_row(e)
            ]
            if actuals_matching:
                selected = sorted(actuals_matching, key=_entry_period_key)[-1]
            if selected is None:
                matching = [
                    e for e in entries
                    if int(_to_float(e.get("year")) or 0) == year_int
                    and _month_idx(e.get("month")) == month_idx
                ]
                if matching:
                    selected = sorted(matching, key=_entry_period_key)[-1]
        if selected is None:
            # Fall back to latest actual, then latest forecast
            actuals = [e for e in entries if not _is_forecast_row(e)]
            selected = sorted(actuals, key=_entry_period_key)[-1] if actuals else sorted(entries, key=_entry_period_key)[-1]
        snapshot_entries.append((entries, selected))

    best_market_tlc = min(market_tlc_by_source.values()) if market_tlc_by_source else None
    market_values_sorted = sorted(market_tlc_by_source.values())
    market_count = len(market_values_sorted)

    records: list[dict[str, Any]] = []
    for all_entries, entry in snapshot_entries:
        supplier = _supplier_name(entry)
        source_country = str(entry.get("sourceCountry", "")).strip()
        location = str(entry.get("location") or entry.get("destination") or "").strip()
        supplier_tlc = _supplier_tlc(entry)

        same_source_market_tlc = market_tlc_by_source.get(source_country)
        gap_abs = None
        gap_pct = None
        if supplier_tlc not in (None, 0) and same_source_market_tlc is not None:
            gap_abs = round(float(same_source_market_tlc) - supplier_tlc, 1)
            gap_pct = round((gap_abs / supplier_tlc) * 100, 2)

        supplier_rank = None
        if supplier_tlc is not None and market_values_sorted:
            supplier_rank = 1 + sum(1 for value in market_values_sorted if value < supplier_tlc)

        components = _component_amounts(entry)
        largest = components[0][0] if len(components) >= 1 else "Unknown"
        second = components[1][0] if len(components) >= 2 else "Unknown"

        # Use the full merged timeline (all location variants) for trend computation.
        supplier_series_entries = sorted(
            [e for e in all_entries if _supplier_tlc(e) is not None],
            key=_entry_period_key,
        )
        forecast_series = [_supplier_tlc(e) for e in supplier_series_entries if _is_forecast_row(e)]
        forecast_series_clean = [float(v) for v in forecast_series if v is not None]
        forecast_trend = _trend_label_from_series(forecast_series_clean)

        forecast_gap_series: list[float] = []
        for e in supplier_series_entries:
            if not _is_forecast_row(e):
                continue
            tlc_value = _supplier_tlc(e)
            if tlc_value is None:
                continue
            period_key = _entry_period_key(e)
            mr_value = mr_trend_lookup.get(source_country, {}).get(period_key)
            if mr_value in (None, 0):
                continue
            forecast_gap_series.append(mr_value - tlc_value)
        forecast_gap_trend = _trend_label_from_series(forecast_gap_series)

        history_series = [
            float(value)
            for value in [_supplier_tlc(e) for e in supplier_series_entries]
            if value is not None
        ]
        volatility_risk = _volatility_risk(history_series)

        negotiation_priority, recommended_action = _priority_and_action(
            gap_pct=gap_pct,
            volatility_risk=volatility_risk,
            forecast_gap_trend=forecast_gap_trend,
            supplier_rank=supplier_rank,
            market_count=market_count,
        )

        records.append(
            {
                "supplier": supplier,
                "destination": destination,
                "source_country": source_country,
                "location": location,
                "supplier_tlc": round(supplier_tlc, 1) if supplier_tlc is not None else None,
                "best_market_tlc": round(best_market_tlc, 1) if best_market_tlc is not None else None,
                "same_source_market_tlc": round(same_source_market_tlc, 1)
                if same_source_market_tlc is not None
                else None,
                "gap_abs": gap_abs,
                "gap_pct": gap_pct,
                "supplier_rank": supplier_rank,
                "largest_cost_driver": largest,
                "second_largest_cost_driver": second,
                "cost_driver_breakdown": [
                    {"label": label, "amount": round(amount, 1)} for label, amount in components[:5]
                ],
                "forecast_trend": forecast_trend,
                "forecast_gap_trend": forecast_gap_trend,
                "volatility_risk": volatility_risk,
                "negotiation_priority": negotiation_priority,
                "recommended_action": recommended_action,
                "benchmark_scope": "same_source_country",
                "comparison_guardrail": "gap_abs = same_source_market_tlc - supplier_tlc; gap_pct = gap_abs / supplier_tlc. Negative gaps mean Supplier TLC is above Market TLC.",
            }
        )

    risk_sorted = sorted(
        records,
        key=lambda r: (
            {"High": 3, "Medium": 2, "Low": 1}.get(str(r.get("negotiation_priority")), 0),
            abs(min(_to_float(r.get("gap_abs")) or 0, 0)),
        ),
        reverse=True,
    )
    opportunities = sorted(
        [r for r in records if (_to_float(r.get("gap_abs")) or 0) < 0],
        key=lambda r: _to_float(r.get("gap_abs")) or 0,
    )
    best_suppliers = sorted(
        records,
        key=lambda r: (_to_float(r.get("gap_abs")) if r.get("gap_abs") is not None else -999999),
        reverse=True,
    )
    worst_suppliers = sorted(
        records,
        key=lambda r: (_to_float(r.get("gap_abs")) if r.get("gap_abs") is not None else 999999),
    )

    def _summary_item(r: dict[str, Any]) -> dict[str, Any]:
        return {
            "supplier": r.get("supplier"),
            "source_country": r.get("source_country"),
            "destination": r.get("destination"),
            "gap_abs": r.get("gap_abs"),
            "gap_pct": r.get("gap_pct"),
            "negotiation_priority": r.get("negotiation_priority"),
            "recommended_action": r.get("recommended_action"),
        }

    simulation_context = None
    if base_tlc is not None and simulated_tlc is not None and base_tlc != 0:
        delta = simulated_tlc - base_tlc
        simulation_context = {
            "base_tlc": round(base_tlc, 1),
            "simulated_tlc": round(simulated_tlc, 1),
            "impact_delta_usd": round(delta, 1),
            "impact_pct": round((delta / base_tlc) * 100, 2),
        }

    return {
        "page": page,
        "destination": destination,
        "month": month,
        "year": year,
        "records": records,
        "summary": {
            "top_risks": [_summary_item(r) for r in risk_sorted[:5]],
            "top_opportunities": [_summary_item(r) for r in opportunities[:5]],
            "best_suppliers": [_summary_item(r) for r in best_suppliers[:5]],
            "worst_suppliers": [_summary_item(r) for r in worst_suppliers[:5]],
        },
        "simulation_context": simulation_context,
    }


# ---------------------------------------------------------------------------
# Page-specific analytics builders
# ---------------------------------------------------------------------------


def analytics_home(
    destination: str,
    month: str,
    year: str,
    countries: list[dict],
    vendor_breakdowns: list[dict],
) -> dict[str, Any]:
    """
    Overview page: TLC distribution across source countries, supplier vs MR gap.
    """
    tlc_map: dict[str, float] = {}
    for c in countries:
        v = _breakdown_value(c.get("breakdown", []), LABEL_TLC)
        if v is not None:
            tlc_map[c["country"]] = v

    year_int: int | None = None
    try:
        year_int = int(str(year))
    except (TypeError, ValueError):
        year_int = None

    relevant_vendor_breakdowns = [
        vb
        for vb in vendor_breakdowns
        if str(vb.get("month", "")).strip().lower() == str(month).strip().lower()
        and (year_int is None or int(vb.get("year", 0)) == year_int)
    ]

    supplier_tlc_map: dict[str, float] = {}
    for vb in relevant_vendor_breakdowns:
        tlc = _supplier_tlc(vb)
        if tlc is not None:
            key = (
                f"{vb.get('supplierName','?')}"
                f" | src:{vb.get('sourceCountry', '?')}"
                f" | {vb.get('month', '?')}-{vb.get('year', '?')}"
                f" | {vb.get('location', vb.get('destination', '?'))}"
            )
            supplier_tlc_map[key] = tlc

    highest = (
        max(tlc_map.items(), key=lambda kv: (kv[1], kv[0]))[0] if tlc_map else None
    )
    lowest = (
        min(tlc_map.items(), key=lambda kv: (kv[1], kv[0]))[0] if tlc_map else None
    )
    spread = (max(tlc_map.values()) - min(tlc_map.values())) if len(tlc_map) > 1 else 0

    gaps: list[dict] = []
    for vb in relevant_vendor_breakdowns:
        stlc = _supplier_tlc(vb)
        if stlc is None:
            continue
        src = vb.get("sourceCountry", "")
        mr_tlc = tlc_map.get(src)
        if mr_tlc is not None:
            gaps.append({
                "supplier": vb.get("supplierName", "?"),
                "location": vb.get("location", ""),
                "source_country": src,
                "month": vb.get("month", ""),
                "year": vb.get("year", ""),
                "supplier_tlc_delivered_usd": round(stlc, 1),
                "market_benchmark_same_source_usd": round(mr_tlc, 1),
                "premium_over_benchmark_usd": round(stlc - mr_tlc, 1),
            })

    # Sort gaps by absolute gap size, keep top 10
    gaps_sorted = sorted(
        gaps,
        key=lambda x: (
            -abs(x["premium_over_benchmark_usd"]),
            str(x.get("supplier", "")),
            str(x.get("source_country", "")),
            str(x.get("month", "")),
            str(x.get("year", "")),
            str(x.get("location", "")),
        ),
    )[:10]
    # Keep top 10 supplier TLC entries in deterministic order
    supplier_tlc_top_items = sorted(
        supplier_tlc_map.items(), key=lambda kv: (-kv[1], kv[0])
    )[:10]
    supplier_tlc_top = dict(supplier_tlc_top_items)

    return {
        "page": "home",
        "destination": destination,
        "month": month,
        "year": year,
        # Benchmark TLC per RAW MATERIAL SOURCE country (market research index, NOT supplier price)
        "market_research_benchmark_by_source_country": {
            k: round(v, 1)
            for k, v in sorted(tlc_map.items(), key=lambda kv: kv[0])[:15]
        },
        "highest_cost_source_country": highest,
        "lowest_cost_source_country": lowest,
        "spread_across_source_countries_usd": round(spread, 1),
        # Valid apples-to-apples: supplier price vs market benchmark FOR THE SAME source country
        "supplier_vs_market_gaps_same_source_country": gaps_sorted,
        # Supplier contracted TLC (destination-level, not comparable to source-country benchmarks above)
        "supplier_contracted_tlc_at_destination": {k: round(v, 1) for k, v in supplier_tlc_top.items()},
    }


def analytics_trends(
    destination: str,
    year: str,
    market_research_trends: list[dict],
    vendor_breakdowns: list[dict],
) -> dict[str, Any]:
    """
    Trends page: MoM delta, forecast vs actual, trajectory.
    """
    MONTH_ORDER = ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"]

    actuals: list[dict] = sorted(
        [r for r in market_research_trends if str(r.get("dataType","")).lower() == "actual"],
        key=lambda r: MONTH_ORDER.index(r["month"]) if r["month"] in MONTH_ORDER else 99,
    )

    mom_deltas: list[dict] = []
    for i in range(1, len(actuals)):
        prev_amt = actuals[i-1].get("amount")
        curr_amt = actuals[i].get("amount")
        try:
            delta = round(float(curr_amt) - float(prev_amt), 1)  # type: ignore[arg-type]
            mom_deltas.append({
                "from": actuals[i-1]["month"],
                "to": actuals[i]["month"],
                "delta_usd": delta,
                "pct_change": round(delta / float(prev_amt) * 100, 1) if float(prev_amt) != 0 else None,  # type: ignore[arg-type]
            })
        except (TypeError, ValueError):
            pass

    forecasts: list[dict] = sorted(
        [r for r in market_research_trends if str(r.get("dataType","")).lower() == "forecast"],
        key=lambda r: MONTH_ORDER.index(r["month"]) if r["month"] in MONTH_ORDER else 99,
    )

    latest_actual = actuals[-1] if actuals else None
    latest_forecast = forecasts[0] if forecasts else None
    forecast_gap = None
    if latest_actual and latest_forecast:
        try:
            forecast_gap = round(float(latest_forecast["amount"]) - float(latest_actual["amount"]), 1)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            pass

    # Anomaly: any month with >10 % swing
    anomalies = [d for d in mom_deltas if abs(d.get("pct_change") or 0) > 10]

    return {
        "page": "trends",
        "destination": destination,
        "year": year,
        "month_on_month_deltas": mom_deltas,
        "anomalies": anomalies,
        "forecast_vs_latest_actual_gap": forecast_gap,
        "latest_actual_month": latest_actual["month"] if latest_actual else None,
        "latest_actual_tlc": round(float(latest_actual["amount"]), 1) if latest_actual and latest_actual.get("amount") is not None else None,  # type: ignore[arg-type]
        "next_forecast_month": latest_forecast["month"] if latest_forecast else None,
        "next_forecast_tlc": round(float(latest_forecast["amount"]), 1) if latest_forecast and latest_forecast.get("amount") is not None else None,  # type: ignore[arg-type]
    }


def analytics_cost_components(
    destination: str,
    month: str,
    year: str,
    vendor_breakdowns: list[dict],
) -> dict[str, Any]:
    """
    Cost Components page: breakdown of what drives TLC per supplier.
    """
    summaries: list[dict] = []
    year_int: int | None = None
    try:
        year_int = int(str(year))
    except (TypeError, ValueError):
        year_int = None

    for vb in vendor_breakdowns:
        if str(vb.get("month", "")).strip().lower() != str(month).strip().lower():
            continue
        if year_int is not None and int(vb.get("year", 0)) != year_int:
            continue

        rows = vb.get("rows", [])
        resin = _breakdown_value(rows, LABEL_RESIN)
        freight = _breakdown_value(rows, LABEL_FREIGHT)
        tax = _breakdown_value(rows, LABEL_TAX)
        tlc = _supplier_tlc(vb)
        if tlc and tlc > 0 and resin is not None:
            summaries.append({
                "supplier": vb.get("supplierName"),
                "location": vb.get("location"),
                "month": vb.get("month"),
                "resin_pct": round(resin / tlc * 100, 1),
                "freight_pct": round((freight or 0) / tlc * 100, 1),
                "tax_pct": round((tax or 0) / tlc * 100, 1),
                "tlc_usd": round(tlc, 1),
            })

    highest_resin_share = max(summaries, key=lambda x: x["resin_pct"]) if summaries else None
    highest_freight_share = max(summaries, key=lambda x: x["freight_pct"]) if summaries else None

    # Keep at most 15 entries sorted by TLC descending
    summaries_top = sorted(
        summaries,
        key=lambda x: (
            -x["tlc_usd"],
            str(x.get("supplier", "")),
            str(x.get("location", "")),
            str(x.get("month", "")),
        ),
    )[:15]

    return {
        "page": "cost_components",
        "destination": destination,
        "month": month,
        "year": year,
        "component_breakdown": summaries_top,
        "highest_resin_share": highest_resin_share,
        "highest_freight_share": highest_freight_share,
    }


def analytics_simulation(
    base_tlc: float | None,
    simulated_tlc: float | None,
    destination: str,
    month: str,
    year: str,
) -> dict[str, Any]:
    """
    Simulation page: what-if scenario impact.
    """
    delta = None
    pct = None
    if base_tlc and simulated_tlc:
        delta = round(simulated_tlc - base_tlc, 1)
        pct = round(delta / base_tlc * 100, 2) if base_tlc else None

    return {
        "page": "simulation",
        "destination": destination,
        "month": month,
        "year": year,
        "base_tlc_usd": base_tlc,
        "simulated_tlc_usd": simulated_tlc,
        "impact_delta_usd": delta,
        "impact_pct": pct,
    }


# ---------------------------------------------------------------------------
# LLM prompt + call
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a senior procurement strategist for PET resin sourcing.

You will receive structured procurement intelligence metrics that are already computed.
Generate procurement decision insights, not generic chart summaries.

Critical pricing gap definition:
- Pricing Gap = Market TLC - Supplier TLC.
- Gap % = (Market TLC - Supplier TLC) / Supplier TLC * 100.
- Positive gap means Supplier TLC is below Market TLC and ABI is in a better position.
- Negative gap means Supplier TLC is above Market TLC and this is a high-priority pricing opportunity.
- Prioritize use cases where Supplier TLC is greater than Market TLC.
- If no Supplier TLC is greater than Market TLC, highlight the two closest absolute gaps between Market TLC and Supplier TLC.
- For forecast_gap_trend, increasing means the Market - Supplier gap is improving; decreasing means the gap is worsening.

Output format:
- Return exactly 3 to 5 concise bullet insights.
- Focus on: pricing opportunity, main gap driver, competitiveness, forecast risk, and recommended action.
- Always include the gap amount and gap % when describing a pricing gap.
- For gap drivers, call out the highest component drivers and whether Supplier TLC is above or below Market TLC.
- Use business-friendly wording and quantify important statements with $ and %.

Hard rules:
- Do not invent savings.
- Do not compare supplier TLC against the wrong market benchmark.
- Respect that gap_abs and gap_pct are valid only when benchmark_scope is same_source_country.
- Do not describe a positive gap as a pricing opportunity; positive means the supplier is already below market.
- Do not describe a negative gap as favourable; negative means the supplier is above market.
- Do not repeat raw metrics verbatim unless needed for context.
- Keep output concise and action-oriented.
"""


def _build_user_prompt(page: str, analytics: dict) -> str:
    payload = json.dumps(analytics, indent=2)
    # Hard cap at ~6000 chars (~1500 tokens) to stay well under model limits
    if len(payload) > 6000:
        payload = payload[:6000] + "\n... [truncated]"
    return (
        f"Page context: {page.upper()} dashboard\n\n"
        f"Analytics data:\n{payload}\n\n"
        "Generate 3-5 procurement decision bullets. Each bullet should clearly support one of: "
        "Pricing Opportunity, Gap Driver, Competitiveness, Forecast Risk, or Recommended Action. "
        "Use Pricing Gap = Market TLC - Supplier TLC and Gap % = Pricing Gap / Supplier TLC."
    )


def generate_insights(page: str, analytics: dict) -> str:
    """Call LLM and return raw markdown insight text."""
    canonical_payload = json.dumps(
        {"page": page, "analytics": analytics},
        sort_keys=True,
        separators=(",", ":"),
    )
    cache_key = hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()

    with _insight_cache_lock:
        cached = _insight_cache.get(cache_key)
    if cached is not None:
        return cached

    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(page, analytics)},
            ],
            temperature=0,
            max_tokens=400,
        )
        text = response.choices[0].message.content or ""
        with _insight_cache_lock:
            if len(_insight_cache) >= _INSIGHT_CACHE_MAX:
                # Drop the oldest inserted item to keep memory bounded.
                oldest_key = next(iter(_insight_cache))
                del _insight_cache[oldest_key]
            _insight_cache[cache_key] = text
        return text
    except Exception as exc:
        return f"Insights temporarily unavailable: {exc}"
