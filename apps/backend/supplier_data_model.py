from __future__ import annotations

import csv
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_MODEL_XLSX = (
    REPO_ROOT
    / "data"
    / "processed"
    / "current"
    / "supplier"
    / "Data_Standardized_Front_End_Data_Model.xlsx"
)
DATA_MODEL_CSV = (
    REPO_ROOT
    / "data"
    / "processed"
    / "current"
    / "supplier"
    / "Data_Standardized_Front_End_Data_Model.csv"
)
MAPPING_XLSX = REPO_ROOT / "data" / "reference" / "mappings" / "Supplier_Delloite_Common_Cost_Mapping.xlsx"
DATA_MODEL_SHEET = "front_end_data_model"

MONTHS = [
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

DEFAULT_SUPPLIER_COMMON_COST_MAPPING = {
    "Resin Index vPET": "Resin Index",
    "Freight": "Freight",
    "Insurance": "Insurance",
    "Tax": "Duty & Import Taxes",
    "Seguro": "Resin Index",
    "Others": "Duty & Import Taxes",
    "Discount": "Logistics & Other Costs",
    "Index": "Resin Index",
    "Customs clearance": "Local Taxes & Fees",
    "Total Landing Cost": "Total Landed Cost (PET Resin)",
}

TOTAL_LANDING_COST = "Total Landing Cost"
SUPPLIER_TLC_FRONTEND_LABEL = "Total Resin Price ABI VIRGIN Formula"

DESTINATION_ALIASES = {
    "El Salvador": ["El Salvador and Honduras"],
}

REQUESTED_DESTINATION_TO_MODEL_DESTINATION = {
    alias: destination
    for destination, aliases in DESTINATION_ALIASES.items()
    for alias in aliases
}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\xa0", " ").strip()


def clean_header(value: Any) -> str:
    return clean_text(value).strip()


def normalized_key(value: Any) -> str:
    return clean_text(value).casefold()


def parse_number(value: Any) -> float | int | str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    text = clean_text(value)
    if not text:
        return None
    if text.casefold() in {"n/a", "na", "none", "nan"}:
        return None

    number_text = text.replace(",", "")
    try:
        number = float(number_text)
    except ValueError:
        return text
    if number.is_integer():
        return int(number)
    return number


def as_float(value: Any) -> float | None:
    parsed = parse_number(value)
    if isinstance(parsed, (int, float)):
        return float(parsed)
    return None


def relative_path(path_text: str) -> str:
    path = Path(path_text)
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def read_xlsx_rows(path: Path, sheet_name: str | None = None) -> list[dict[str, Any]]:
    try:
        from openpyxl import load_workbook
    except ImportError:
        return []

    try:
        workbook = load_workbook(path, read_only=True, data_only=True)
    except (FileNotFoundError, PermissionError, OSError):
        return []

    try:
        worksheet = workbook[sheet_name] if sheet_name in workbook.sheetnames else workbook.active
        rows = list(worksheet.iter_rows(values_only=True))
    finally:
        workbook.close()

    if not rows:
        return []

    headers = [clean_header(value) for value in rows[0]]
    records: list[dict[str, Any]] = []
    for row in rows[1:]:
        if not any(value is not None and clean_text(value) for value in row):
            continue
        records.append({headers[index]: value for index, value in enumerate(row) if index < len(headers)})
    return records


def read_csv_rows(path: Path) -> list[dict[str, Any]]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            return [
                {clean_header(key): value for key, value in row.items() if key is not None}
                for row in reader
            ]
    except FileNotFoundError:
        return []


def read_data_model_rows() -> list[dict[str, Any]]:
    rows = read_xlsx_rows(DATA_MODEL_XLSX, DATA_MODEL_SHEET)
    if rows:
        return rows
    return read_csv_rows(DATA_MODEL_CSV)


@lru_cache(maxsize=1)
def supplier_common_cost_mapping() -> dict[str, str]:
    mapping = dict(DEFAULT_SUPPLIER_COMMON_COST_MAPPING)
    for row in read_xlsx_rows(MAPPING_XLSX):
        supplier_column = clean_text(row.get("Supplier Mapping Columns"))
        common_column = clean_text(row.get("Common Mapping Columns"))
        if supplier_column and common_column:
            mapping[supplier_column] = common_column
    return mapping


def month_year_from_row(row: dict[str, Any]) -> tuple[str, str] | None:
    raw_year = parse_number(row.get("Time Period Year"))
    raw_month = parse_number(row.get("Time Period Month"))

    year = int(raw_year) if isinstance(raw_year, (int, float)) else None
    month_number = int(raw_month) if isinstance(raw_month, (int, float)) else None

    if not year or not month_number:
        period = clean_text(row.get("Time_Period"))
        parts = period.split()
        if len(parts) >= 2:
            month_name = parts[0]
            try:
                month_number = MONTHS.index(month_name) + 1
                year = int(parts[-1])
            except (ValueError, TypeError):
                pass

    if not year or not month_number or month_number < 1 or month_number > 12:
        return None
    return MONTHS[month_number - 1], str(year)


def model_destinations_for_response(destination: str) -> list[str]:
    return [destination, *DESTINATION_ALIASES.get(destination, [])]


def normalize_requested_destination(destination: str | None) -> str | None:
    if not destination:
        return None
    return REQUESTED_DESTINATION_TO_MODEL_DESTINATION.get(destination, destination)


def supplier_display_name(supplier: str, location: str, destination: str) -> str:
    if not location or normalized_key(location) == normalized_key(destination):
        return supplier
    return f"{supplier} - {location}"


def row_is_required(row: dict[str, Any]) -> bool:
    required = normalized_key(row.get("Column Required for Calculation"))
    return required != "no"


def is_total_landing_cost(row: dict[str, Any]) -> bool:
    return normalized_key(row.get("Mapping Columns")) == normalized_key(TOTAL_LANDING_COST)


def choose_total_landing_cost_row(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [row for row in rows if is_total_landing_cost(row)]
    if not candidates:
        return None

    preferred = [
        row
        for row in candidates
        if "$" in clean_text(row.get("Raw Cost Breakdown"))
        or "usd" in normalized_key(row.get("Raw Cost Breakdown"))
    ]
    if preferred:
        return preferred[0]

    plausible = [
        row
        for row in candidates
        if (value := as_float(row.get("Value"))) is not None and 300 <= value <= 3000
    ]
    if plausible:
        return plausible[0]

    return candidates[0]


def rows_for_selected_scenario(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    required_rows = [row for row in rows if row_is_required(row)]
    total_row = choose_total_landing_cost_row(required_rows)
    if not total_row:
        return []

    total_index = required_rows.index(total_row)
    previous_total_indexes = [
        index
        for index, row in enumerate(required_rows[:total_index])
        if is_total_landing_cost(row)
    ]
    start_index = previous_total_indexes[-1] + 1 if previous_total_indexes else 0

    selected = [
        row
        for row in required_rows[start_index:total_index]
        if not is_total_landing_cost(row)
    ]
    selected.append(total_row)
    return selected


def api_label_for_row(row: dict[str, Any]) -> str:
    mapping_column = clean_text(row.get("Mapping Columns"))
    if normalized_key(mapping_column) == normalized_key(TOTAL_LANDING_COST):
        return SUPPLIER_TLC_FRONTEND_LABEL
    return mapping_column or clean_text(row.get("Raw Cost Breakdown")) or "Unknown Cost"


def to_api_row(row: dict[str, Any], common_mapping: dict[str, str]) -> dict[str, Any]:
    mapping_column = clean_text(row.get("Mapping Columns"))
    raw_label = clean_text(row.get("Raw Cost Breakdown"))
    common_component = common_mapping.get(mapping_column, mapping_column)
    return {
        "label": api_label_for_row(row),
        "amount": parse_number(row.get("Value")),
        "formulaReference": clean_text(row.get("TLC Formula")),
        "commonComponent": common_component,
        "mappingColumn": mapping_column,
        "rawLabel": raw_label,
        "dataType": clean_text(row.get("Data Type")),
        "sourceFile": clean_text(row.get("Source File")),
        "location": clean_text(row.get("Location")),
        "resinIndexType": clean_text(row.get("Resin Index Type")),
        "forecastResinIndexType": clean_text(row.get("Forecast Resin Index Type")),
        "columnRequiredForCalculation": clean_text(row.get("Column Required for Calculation")),
    }


def entry_tlc_amount(entry: dict[str, Any]) -> float | None:
    for row in entry.get("rows", []):
        if normalized_key(row.get("label")) == normalized_key(SUPPLIER_TLC_FRONTEND_LABEL):
            return as_float(row.get("amount"))
    return None


def choose_best_entry(entries: Iterable[dict[str, Any]]) -> dict[str, Any]:
    def score(entry: dict[str, Any]) -> tuple[int, int, float]:
        tlc = entry_tlc_amount(entry)
        plausible = 1 if tlc is not None and 300 <= tlc <= 3000 else 0
        actual = 1 if normalized_key(entry.get("dataType")) == "actual" else 0
        return plausible, actual, tlc or 0

    return max(entries, key=score)


@lru_cache(maxsize=8)
def build_vendor_breakdowns(source_countries: tuple[str, ...]) -> list[dict[str, Any]]:
    common_mapping = supplier_common_cost_mapping()
    raw_groups: dict[tuple[str, str, str, str, str, str, str], list[dict[str, Any]]] = defaultdict(list)

    for row in read_data_model_rows():
        destination = clean_text(row.get("Destination Country"))
        supplier = clean_text(row.get("Supplier Name"))
        period = month_year_from_row(row)
        if not destination or not supplier or not period:
            continue

        month, year = period
        location = clean_text(row.get("Location")) or destination
        supplier_name = supplier_display_name(supplier, location, destination)
        data_type = clean_text(row.get("Data Type"))
        source_file = clean_text(row.get("Source File"))

        for response_destination in model_destinations_for_response(destination):
            key = (
                response_destination,
                supplier_name,
                supplier,
                location,
                month,
                year,
                data_type,
                source_file,
            )
            raw_groups[key].append(row)

    collapsed: dict[tuple[str, str, str, str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for (
        destination,
        supplier_name,
        supplier,
        location,
        month,
        year,
        data_type,
        source_file,
    ), rows in raw_groups.items():
        selected_rows = rows_for_selected_scenario(rows)
        if not selected_rows:
            continue

        entry = {
            "destination": destination,
            "sourceCountry": "",
            "month": month,
            "year": year,
            "supplierName": supplier_name,
            "supplier": supplier,
            "vendor": supplier_name,
            "location": location,
            "dataType": data_type,
            "sourceFile": relative_path(source_file),
            "rows": [to_api_row(row, common_mapping) for row in selected_rows],
        }

        collapsed_key = (destination, supplier_name, supplier, location, month, year, source_file)
        collapsed[collapsed_key].append(entry)

    deduped_entries = [choose_best_entry(entries) for entries in collapsed.values()]
    deduped_entries.sort(
        key=lambda entry: (
            clean_text(entry.get("destination")),
            clean_text(entry.get("supplierName")),
            int(entry.get("year") or 0),
            MONTHS.index(entry.get("month")) if entry.get("month") in MONTHS else 99,
        )
    )

    expanded: list[dict[str, Any]] = []
    sources = tuple(source_countries) or ("China",)
    for entry in deduped_entries:
        for source_country in sources:
            expanded.append({**entry, "sourceCountry": source_country})
    return expanded


def available_destinations() -> list[str]:
    destinations = {
        response_destination
        for row in read_data_model_rows()
        for destination in [clean_text(row.get("Destination Country"))]
        if destination
        for response_destination in model_destinations_for_response(destination)
    }
    return sorted(destinations)


def supplier_price_for(
    vendor_breakdowns: Iterable[dict[str, Any]],
    destination: str,
    month: str,
    year: str | int,
) -> float | int:
    selected_destination = destination or ""
    for entry in vendor_breakdowns:
        if clean_text(entry.get("destination")) != selected_destination:
            continue
        if clean_text(entry.get("month")) != month:
            continue
        if clean_text(entry.get("year")) != clean_text(year):
            continue
        value = entry_tlc_amount(entry)
        if value is None:
            continue
        return int(value) if value.is_integer() else round(value, 1)
    return 0
