from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def log(msg: str) -> None:
    print(msg, flush=True)
    sys.stdout.flush()

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import InsightsRequest, countries, insights, market_research_trends
from app.data.market_research import (
    DEFAULT_MONTH,
    DEFAULT_YEAR,
    available_destinations,
    available_periods_for_destination,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT = REPO_ROOT / "apps" / "frontend" / "public" / "insights-cache.json"


def normalise_token(value: Any, fallback: str = "all") -> str:
    if value is None:
        return fallback
    token = str(value).strip().lower()
    if not token:
        return fallback
    return "_".join(token.split())


def format_numeric_token(value: Any) -> str:
    if value in (None, ""):
        return "na"
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return "na"
    return f"{parsed:.2f}"


def build_cache_key(request: dict[str, Any]) -> str:
    page = normalise_token(request.get("page"), "unknown")
    destination = normalise_token(request.get("destination"))
    month = normalise_token(request.get("month"))
    year = normalise_token(request.get("year"))

    parts = [
        f"page={page}",
        f"destination={destination}",
        f"month={month}",
        f"year={year}",
    ]

    if page == "simulation":
        parts.append(f"base_tlc={format_numeric_token(request.get('baseTlc'))}")
        parts.append(
            f"simulated_tlc={format_numeric_token(request.get('simulatedTlc'))}"
        )

    return "|".join(parts)


def parse_csv_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def choose_seed_period(destination: str, periods: list[tuple[str, str]]) -> tuple[str, str]:
    if not periods:
        return DEFAULT_MONTH, str(DEFAULT_YEAR)

    wanted_year = str(DEFAULT_YEAR)
    for month, year in periods:
        if month == DEFAULT_MONTH and str(year) == wanted_year:
            return month, str(year)

    by_default_year = [period for period in periods if str(period[1]) == wanted_year]
    if by_default_year:
        return by_default_year[-1][0], str(by_default_year[-1][1])

    month, year = periods[-1]
    return month, str(year)


def load_existing_entries(output_path: Path) -> dict[str, Any]:
    if not output_path.exists():
        return {}
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    entries = payload.get("entries", {})
    if not isinstance(entries, dict):
        return {}
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate static frontend insights cache by calling backend LLM insights flow."
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Path to insights-cache.json output",
    )
    parser.add_argument(
        "--pages",
        default="home,cost_components,trends,simulation",
        help="Comma-separated pages to generate: home,cost_components,trends,simulation",
    )
    parser.add_argument(
        "--destinations",
        default="",
        help="Optional comma-separated destination allowlist",
    )
    parser.add_argument(
        "--years",
        default="",
        help="Optional comma-separated year allowlist for trends generation",
    )
    parser.add_argument(
        "--simulation-percents",
        default="0",
        help="Comma-separated simulation percentages, e.g. -10,-5,0,5,10",
    )
    parser.add_argument(
        "--max-entries",
        type=int,
        default=0,
        help="Optional hard cap for generated entries (0 means unlimited)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing cache file entries instead of merging",
    )

    args = parser.parse_args()

    selected_pages = set(parse_csv_list(args.pages))
    destination_filter = set(parse_csv_list(args.destinations))
    year_filter = set(parse_csv_list(args.years))
    simulation_percents = [float(x) for x in parse_csv_list(args.simulation_percents)]
    if not simulation_percents:
        simulation_percents = [0.0]

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    entries: dict[str, Any] = {} if args.overwrite else load_existing_entries(output_path)

    destinations = available_destinations()
    if destination_filter:
        destinations = [d for d in destinations if d in destination_filter]

    generated = 0
    skipped_existing = 0

    def should_stop() -> bool:
        return args.max_entries > 0 and generated >= args.max_entries

    for destination in destinations:
        periods = available_periods_for_destination(destination)
        seed_month, seed_year = choose_seed_period(destination, periods)

        # Payload used by Trends page for vendor breakdown filtering in the UI.
        seed_payload = countries(
            destination=destination,
            month=seed_month,
            year=seed_year,
            includeVendorBreakdowns=True,
        )

        if "home" in selected_pages or "cost_components" in selected_pages or "simulation" in selected_pages:
            for month, year in periods:
                year_str = str(year)
                base_payload = countries(
                    destination=destination,
                    month=month,
                    year=year_str,
                    includeVendorBreakdowns=True,
                )

                if "home" in selected_pages:
                    req_home = {
                        "page": "home",
                        "destination": destination,
                        "month": month,
                        "year": year_str,
                        "countries": base_payload.get("countries", []),
                        "marketResearchTrends": base_payload.get("marketResearchTrends", []),
                        "vendorBreakdowns": [
                            row
                            for row in base_payload.get("vendorBreakdowns", [])
                            if row.get("destination") == destination
                        ],
                    }
                    key = build_cache_key(req_home)
                    if key in entries and not args.overwrite:
                        skipped_existing += 1
                    else:
                        entries[key] = insights(InsightsRequest(**req_home))
                        generated += 1
                        log(f"[home] {key}")
                        if should_stop():
                            break

                if should_stop():
                    break

                if "cost_components" in selected_pages:
                    req_components = {
                        "page": "cost_components",
                        "destination": destination,
                        "month": month,
                        "year": year_str,
                        "marketResearchTrends": base_payload.get("marketResearchTrends", []),
                        "vendorBreakdowns": [
                            row
                            for row in base_payload.get("vendorBreakdowns", [])
                            if row.get("destination") == destination
                        ],
                    }
                    key = build_cache_key(req_components)
                    if key in entries and not args.overwrite:
                        skipped_existing += 1
                    else:
                        entries[key] = insights(InsightsRequest(**req_components))
                        generated += 1
                        log(f"[cost_components] {key}")
                        if should_stop():
                            break

                if should_stop():
                    break

                if "simulation" in selected_pages:
                    base_tlc = base_payload.get("supplierPrice")
                    for percent in simulation_percents:
                        simulated_tlc = None
                        if base_tlc is not None:
                            simulated_tlc = float(base_tlc) * (1 + percent / 100)
                        req_simulation = {
                            "page": "simulation",
                            "destination": destination,
                            "month": month,
                            "year": year_str,
                            "marketResearchTrends": base_payload.get("marketResearchTrends", []),
                            "vendorBreakdowns": [
                                row
                                for row in base_payload.get("vendorBreakdowns", [])
                                if row.get("destination") == destination
                                and str(row.get("year")) == year_str
                            ],
                            "baseTlc": base_tlc,
                            "simulatedTlc": simulated_tlc,
                        }
                        key = build_cache_key(req_simulation)
                        if key in entries and not args.overwrite:
                            skipped_existing += 1
                        else:
                            entries[key] = insights(InsightsRequest(**req_simulation))
                            generated += 1
                            log(f"[simulation {percent:+.1f}%] {key}")
                            if should_stop():
                                break

                    if should_stop():
                        break

                if should_stop():
                    break

        if should_stop():
            break

        if "trends" in selected_pages:
            destination_years = sorted({str(y) for _, y in periods})
            if not destination_years:
                destination_years = [str(DEFAULT_YEAR)]

            if year_filter:
                destination_years = [y for y in destination_years if y in year_filter]

            for year_str in destination_years:
                trends_payload = market_research_trends(destination=destination, year=year_str)
                req_trends = {
                    "page": "trends",
                    "destination": destination,
                    "year": year_str,
                    "marketResearchTrends": trends_payload.get("rows", []),
                    "vendorBreakdowns": [
                        row
                        for row in seed_payload.get("vendorBreakdowns", [])
                        if row.get("destination") == destination
                        and str(row.get("year")) == year_str
                    ],
                }
                key = build_cache_key(req_trends)
                if key in entries and not args.overwrite:
                    skipped_existing += 1
                else:
                    entries[key] = insights(InsightsRequest(**req_trends))
                    generated += 1
                    log(f"[trends] {key}")
                    if should_stop():
                        break

            if should_stop():
                break

    final_payload = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "entries": entries,
    }
    # Keep output minified to stay below deployment source file-size limits.
    output_path.write_text(
        json.dumps(final_payload, ensure_ascii=True, separators=(",", ":")),
        encoding="utf-8",
    )

    log(f"\nWrote cache file: {output_path}")
    log(f"Total entries: {len(entries)}")
    log(f"Newly generated: {generated}")
    if skipped_existing:
        log(f"Skipped existing: {skipped_existing}")


if __name__ == "__main__":
    main()
