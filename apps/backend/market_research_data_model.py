from __future__ import annotations

from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable
import unicodedata

from supplier_data_model import (
    MONTHS,
    as_float,
    clean_text,
    month_year_from_row,
    normalized_key,
    parse_number,
    read_csv_rows,
    read_xlsx_rows,
    relative_path,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_MODEL_XLSX = (
    REPO_ROOT
    / "data"
    / "processed"
    / "current"
    / "market_research"
    / "Data_Standardized_MR_Front_End_Data_Model.xlsx"
)
DATA_MODEL_CSV = (
    REPO_ROOT
    / "data"
    / "processed"
    / "current"
    / "market_research"
    / "Data_Standardized_MR_Front_End_Data_Model.csv"
)
DATA_MODEL_SHEET = "front_end_data_model"

DEFAULT_DESTINATION = "Colombia"
DEFAULT_MONTH = "March"
DEFAULT_YEAR = "2026"

TOTAL_LANDING_COST = "Total Landing Cost"
TOTAL_LANDING_COST_LABEL = "Total landed cost (PET resin)"
DIFFERENCE_LABEL = "Difference with current vPET resin price charged by preform supplier"
SUPPLIER_TLC_FRONTEND_LABEL = "Total Resin Price ABI VIRGIN Formula"

MARKET_RESEARCH_COMMON_COST_MAPPING = {
    "Resin Index vPET": "Resin Index",
    "Freight": "Freight",
    "Insurance": "Insurance",
    "Tax": "Duty & Import Taxes",
    "Customs clearance": "Local Taxes & Fees",
    "Others": "Logistics & Other Costs",
    "Total Landing Cost": "Total Landed Cost (PET Resin)",
}


@lru_cache(maxsize=1)
def read_market_research_rows() -> list[dict[str, Any]]:
    rows = read_xlsx_rows(DATA_MODEL_XLSX, DATA_MODEL_SHEET)
    if rows:
        return rows
    return read_csv_rows(DATA_MODEL_CSV)


def is_total_landing_cost(row: dict[str, Any]) -> bool:
    return normalized_key(row.get("Mapping Columns")) == normalized_key(
        TOTAL_LANDING_COST
    ) or normalized_key(row.get("Raw Cost Breakdown")) == normalized_key(
        TOTAL_LANDING_COST_LABEL
    )


def row_sort_key(row: dict[str, Any]) -> int:
    raw_label = clean_text(row.get("Raw Cost Breakdown"))
    preferred_order = [
        "PET resin cost (FOB)",
        "Freight cost",
        "Insurance",
        "Import duty",
        "Anti-dumping duty",
        "IPI",
        "PIS",
        "Confins",
        "Statistical fee",
        "Additional VAT",
        "Income tax perception",
        "IBB",
        "Tasa consular",
        "Customs service fee",
        "IRAE",
        "Customs insurance",
        "Impuesto General a las Ventas (IGV & IPM)",
        "Percepcion IGV",
        "FODINFA",
        "Taxes (VAT/Import)",
        "Destination port to supplier location transportation",
        TOTAL_LANDING_COST_LABEL,
    ]

    def ascii_key(value: Any) -> str:
        return normalized_key(
            unicodedata.normalize("NFKD", clean_text(value))
            .encode("ascii", "ignore")
            .decode("ascii")
        )

    normalized_order = [ascii_key(item) for item in preferred_order]
    try:
        return normalized_order.index(ascii_key(raw_label))
    except ValueError:
        return len(preferred_order)


def market_research_api_row(row: dict[str, Any]) -> dict[str, Any]:
    raw_label = clean_text(row.get("Raw Cost Breakdown"))
    mapping_column = clean_text(row.get("Mapping Columns"))
    common_component = MARKET_RESEARCH_COMMON_COST_MAPPING.get(
        mapping_column,
        mapping_column,
    )
    return {
        "label": raw_label or mapping_column or "Unknown Cost",
        "amount": parse_number(row.get("Value")),
        "formulaReference": clean_text(row.get("TLC Formula")),
        "commonComponent": common_component,
        "dataType": clean_text(row.get("Data Type")),
        "sourceFile": relative_path(clean_text(row.get("Source File"))),
        "mappingColumn": mapping_column,
        "rawLabel": raw_label,
        "resinIndexType": clean_text(row.get("Resin Index Type")),
        "forecastResinIndexType": clean_text(row.get("Forecast Resin Index Type")),
        "columnRequiredForCalculation": clean_text(
            row.get("Column Required for Calculation")
        ),
    }


def group_tlc_amount(rows: list[dict[str, Any]]) -> float | None:
    for row in rows:
        if is_total_landing_cost(row):
            return as_float(row.get("Value"))
    return None


def choose_best_group(groups: Iterable[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    def score(rows: list[dict[str, Any]]) -> tuple[int, int, float]:
        data_type = clean_text(rows[0].get("Data Type")) if rows else ""
        tlc = group_tlc_amount(rows)
        plausible = 1 if tlc is not None and 300 <= tlc <= 3000 else 0
        actual = 1 if normalized_key(data_type) == "actual" else 0
        return plausible, actual, tlc or 0

    return max(groups, key=score)


@lru_cache(maxsize=64)
def build_market_research_countries(
    destination: str,
    month: str,
    year: str | int,
) -> list[dict[str, Any]]:
    selected_destination = destination
    selected_year = clean_text(year)

    grouped: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in read_market_research_rows():
        model_destination = clean_text(row.get("Destination Country"))
        if normalized_key(model_destination) != normalized_key(selected_destination):
            continue

        period = month_year_from_row(row)
        if period != (month, selected_year):
            continue

        source_country = clean_text(row.get("Supplier Name")) or clean_text(
            row.get("Location")
        )
        if not source_country:
            continue

        key = (
            source_country,
            clean_text(row.get("Location")),
            clean_text(row.get("Data Type")),
            clean_text(row.get("Source File")),
        )
        grouped[key].append(row)

    groups_by_source: dict[str, list[list[dict[str, Any]]]] = defaultdict(list)
    for (source_country, _location, _data_type, _source_file), rows in grouped.items():
        groups_by_source[source_country].append(rows)

    countries: list[dict[str, Any]] = []
    for source_country, groups in groups_by_source.items():
        rows = sorted(choose_best_group(groups), key=row_sort_key)
        tlc = group_tlc_amount(rows)
        first_row = rows[0] if rows else {}
        countries.append(
            {
                "country": source_country,
                "amount": round(tlc, 1) if tlc is not None else None,
                "rank": "#N/A",
                "dataType": clean_text(first_row.get("Data Type")),
                "sourceFile": relative_path(clean_text(first_row.get("Source File"))),
                "breakdown": [market_research_api_row(row) for row in rows],
            }
        )

    ranked = sorted(
        [country for country in countries if isinstance(country.get("amount"), (int, float))],
        key=lambda country: float(country["amount"]),
    )
    rank_by_country = {
        clean_text(country.get("country")): index + 1
        for index, country in enumerate(ranked)
    }
    for country in countries:
        country["rank"] = rank_by_country.get(clean_text(country.get("country")), "#N/A")

    return sorted(
        countries,
        key=lambda country: (
            999
            if not isinstance(country.get("rank"), int)
            else int(country.get("rank")),
            clean_text(country.get("country")),
        ),
    )


def market_tlc_for_country(country: dict[str, Any]) -> float | None:
    for row in country.get("breakdown", []):
        if "total landed cost" in normalized_key(row.get("label")):
            return as_float(row.get("amount"))
    return None


def supplier_tlc_for_source(
    vendor_breakdowns: Iterable[dict[str, Any]],
    destination: str,
    source_country: str,
    month: str,
    year: str | int,
) -> float | None:
    for entry in vendor_breakdowns:
        if normalized_key(entry.get("destination")) != normalized_key(destination):
            continue
        if normalized_key(entry.get("sourceCountry")) != normalized_key(source_country):
            continue
        if clean_text(entry.get("month")) != month:
            continue
        if clean_text(entry.get("year")) != clean_text(year):
            continue

        for row in entry.get("rows", []):
            if normalized_key(row.get("label")) == normalized_key(
                SUPPLIER_TLC_FRONTEND_LABEL
            ):
                return as_float(row.get("amount"))
    return None


def add_supplier_delta_rows(
    countries: list[dict[str, Any]],
    vendor_breakdowns: Iterable[dict[str, Any]],
    destination: str,
    month: str,
    year: str | int,
) -> list[dict[str, Any]]:
    updated: list[dict[str, Any]] = []
    for country in countries:
        market_tlc = market_tlc_for_country(country)
        supplier_tlc = supplier_tlc_for_source(
            vendor_breakdowns,
            destination,
            clean_text(country.get("country")),
            month,
            year,
        )
        delta = (
            round(supplier_tlc - market_tlc, 1)
            if supplier_tlc is not None and market_tlc is not None
            else None
        )
        breakdown = [
            row
            for row in country.get("breakdown", [])
            if "difference" not in normalized_key(row.get("label"))
        ]
        breakdown.append(
            {
                "label": DIFFERENCE_LABEL,
                "amount": delta,
                "formulaReference": "Supplier TLC - Market Research TLC",
                "commonComponent": "",
                "dataType": clean_text(country.get("dataType")),
                "sourceFile": clean_text(country.get("sourceFile")),
                "mappingColumn": "",
                "rawLabel": DIFFERENCE_LABEL,
                "resinIndexType": "",
                "forecastResinIndexType": "",
                "columnRequiredForCalculation": "Derived",
            }
        )
        updated.append({**country, "breakdown": breakdown})
    return updated


@lru_cache(maxsize=32)
def build_market_research_tlc_trends(
    destination: str,
    year: str | int = DEFAULT_YEAR,
) -> list[dict[str, Any]]:
    selected_destination = destination
    selected_year = clean_text(year)
    grouped: dict[tuple[str, str, str, str, str, str], list[dict[str, Any]]] = defaultdict(list)

    for row in read_market_research_rows():
        model_destination = clean_text(row.get("Destination Country"))
        if normalized_key(model_destination) != normalized_key(selected_destination):
            continue

        period = month_year_from_row(row)
        if not period:
            continue
        month, period_year = period
        if period_year != selected_year:
            continue

        source_country = clean_text(row.get("Supplier Name")) or clean_text(
            row.get("Location")
        )
        if not source_country:
            continue

        key = (
            source_country,
            month,
            period_year,
            clean_text(row.get("Location")),
            clean_text(row.get("Data Type")),
            clean_text(row.get("Source File")),
        )
        grouped[key].append(row)

    groups_by_period_source: dict[tuple[str, str, str], list[list[dict[str, Any]]]] = defaultdict(list)
    for (source_country, month, period_year, _location, _data_type, _source_file), rows in grouped.items():
        groups_by_period_source[(source_country, month, period_year)].append(rows)

    trend_rows: list[dict[str, Any]] = []
    for (source_country, month, period_year), groups in groups_by_period_source.items():
        rows = choose_best_group(groups)
        tlc = group_tlc_amount(rows)
        if tlc is None:
            continue

        first_row = rows[0] if rows else {}
        trend_rows.append(
            {
                "destination": destination,
                "sourceCountry": source_country,
                "month": month,
                "year": period_year,
                "dataType": clean_text(first_row.get("Data Type")),
                "amount": round(tlc, 1),
                "sourceFile": relative_path(clean_text(first_row.get("Source File"))),
            }
        )

    return sorted(
        trend_rows,
        key=lambda row: (
            clean_text(row.get("sourceCountry")),
            int(clean_text(row.get("year")) or 0),
            MONTHS.index(row.get("month")) if row.get("month") in MONTHS else 99,
        ),
    )


def available_destinations() -> list[str]:
    destinations = {
        clean_text(row.get("Destination Country"))
        for row in read_market_research_rows()
        if clean_text(row.get("Destination Country"))
    }
    return sorted(destinations)


def available_periods_for_destination(destination: str) -> list[tuple[str, str]]:
    selected_destination = destination
    periods = {
        period
        for row in read_market_research_rows()
        if normalized_key(row.get("Destination Country"))
        == normalized_key(selected_destination)
        for period in [month_year_from_row(row)]
        if period
    }
    return sorted(
        periods,
        key=lambda period: (
            int(period[1]),
            MONTHS.index(period[0]) if period[0] in MONTHS else 99,
        ),
    )
