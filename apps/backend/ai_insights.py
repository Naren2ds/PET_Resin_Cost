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
from threading import Lock
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent.parent
WORKSPACE_ROOT = REPO_ROOT.parent

for env_path in (
    WORKSPACE_ROOT / ".env",
    REPO_ROOT / ".env",
    BACKEND_DIR / ".env",
):
    load_dotenv(dotenv_path=env_path, override=False)


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
    for vb in vendor_breakdowns:
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

_SYSTEM_PROMPT = """You are a senior procurement strategist at AB InBev specializing in PET resin 
sourcing for Latin America. You interpret Total Landing Cost (TLC) data and give sharp, 
actionable insights in 3-5 bullet points. Be direct. Use $ and % numbers from the data. 
Prioritize cost-saving opportunities and risk flags. Output only the bullet list, no headers.

DATA SCHEMA RULES — read carefully before generating insights:
- "market_research_benchmark_by_source_country": benchmark TLC indexed by RAW MATERIAL SOURCE country 
    (e.g. China, India). Do NOT compare these directly to supplier contracted prices.
- "supplier_contracted_tlc_at_destination": what AB InBev actually pays a named supplier, 
    delivered to the DESTINATION country. Not comparable to source-country benchmarks.
- "supplier_vs_market_gaps_same_source_country": each entry shows supplier delivered price vs 
    market benchmark FOR THE SAME source country. "premium_over_benchmark_usd" is the premium 
    above the raw index — this INCLUDES legitimate costs (freight, duties, supplier margin, FX).
    A premium is NOT automatically overpayment; only flag it as a risk when it is unusually large
    compared to other suppliers sourcing from that same country.
- "spread_across_source_countries_usd": price range between cheapest and most expensive 
    source country benchmarks. Not a supplier saving.
- Never claim a saving or overpayment by comparing supplier TLC to a different source-country benchmark.
"""


def _build_user_prompt(page: str, analytics: dict) -> str:
    payload = json.dumps(analytics, indent=2)
    # Hard cap at ~6000 chars (~1500 tokens) to stay well under model limits
    if len(payload) > 6000:
        payload = payload[:6000] + "\n... [truncated]"
    return (
        f"Page context: {page.upper()} dashboard\n\n"
        f"Analytics data:\n{payload}\n\n"
        "Give 3–5 bullet-point business insights. Start each bullet with a bold keyword like "
        "**Cost Alert**, **Opportunity**, **Trend**, **Risk**, or **Recommendation**."
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

    try:
        client = _get_client()
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
