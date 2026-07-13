from __future__ import annotations

import csv
import re
from collections import defaultdict
from datetime import date, datetime
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


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\xa0", " ").strip()


def clean_header(value: Any) -> str:
    return clean_text(value).strip()


def _normalized_text_for_match(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _extract_month_lag(value: str) -> tuple[str, int] | None:
    match = re.search(r"\b([MN])\s*-\s*(\d+)\b", value, flags=re.IGNORECASE)
    if match:
        return match.group(1).upper(), int(match.group(2))

    # Handles shorthand values such as "ICIS N-1".
    match = re.search(r"\bN\s*-\s*(\d+)\b", value, flags=re.IGNORECASE)
    if match:
        return "N", int(match.group(1))
    return None


def normalize_resin_index_type(
    value: Any,
    *,
    source_country: str = "",
    market_context: bool = False,
    destination: str = "",
) -> str:
    text = clean_text(value)
    if market_context:
        market_index_by_source = {
            "china": "ICIS FOB China",
            "mexico": "ICIS FOB Mexico",
            "vietnam": "ICIS Asia SE Low (M-1)",
            "indonesia": "ICIS Asia SE Low (M-1)",
            "thailand": "ICIS Asia SE Low (M-1)",
            "india": "ICIS FOB India",
            "south korea": "ICIS FOB South Korea",
            "taiwan": "ICIS FOB Taiwan",
        }
        mapped = market_index_by_source.get(_normalized_text_for_match(source_country))
        if mapped:
            return mapped

    destination_key = _normalized_text_for_match(destination)
    if destination_key in {"el salvador", "honduras", "el salvador and honduras"}:
        return "ICIS FOB China"

    # Uruguay supplier index must consistently use IHS PET China Mid (M-1).
    if destination_key == "uruguay":
        return "IHS PET China Mid (M-1)"

    if not text:
        return ""

    normalized = _normalized_text_for_match(text)

    lag = _extract_month_lag(text)
    lag_prefix = lag[0] if lag else "N"
    lag_value = lag[1] if lag else 1

    if "asia se" in normalized and "low" in normalized:
        # Display the agreed supplier index label for these destinations.
        # This changes presentation only; the underlying workbook value is untouched.
        if destination_key in {"peru", "dominican republic", "panama"}:
            return "ICIS Asia SE Low (M-1)"
        return f"ICIS Asia SE Low ({lag_prefix}-{lag_value})"

    if "ihs" in normalized:
        return f"IHS PET China Mid ({lag_prefix}-{lag_value})"

    if (
        "fob china" in normalized
        or "icis china" in normalized
        or "pet china" in normalized
        or normalized.startswith("icis n ")
    ):
        return "ICIS FOB China"

    return text


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
    if DATA_MODEL_CSV.exists() and (
        not DATA_MODEL_XLSX.exists()
        or DATA_MODEL_CSV.stat().st_mtime > DATA_MODEL_XLSX.stat().st_mtime
    ):
        rows = read_csv_rows(DATA_MODEL_CSV)
        if rows:
            return rows

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
        period_value = row.get("Time_Period")
        if isinstance(period_value, (date, datetime)):
            year = period_value.year
            month_number = period_value.month
        else:
            period = clean_text(period_value)
            iso_period = re.match(r"^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:[ T].*)?$", period)
            if iso_period:
                year = int(iso_period.group(1))
                month_number = int(iso_period.group(2))
            else:
                parts = period.split()
                if len(parts) >= 2:
                    month_name = parts[0].casefold()
                    try:
                        month_number = [month.casefold() for month in MONTHS].index(month_name) + 1
                        year = int(parts[-1])
                    except (ValueError, TypeError):
                        pass

    if not year or not month_number or month_number < 1 or month_number > 12:
        return None
    return MONTHS[month_number - 1], str(year)


def model_destinations_for_response(destination: str) -> list[str]:
    if normalized_key(destination) == normalized_key("El Salvador and Honduras"):
        return ["El Salvador and Honduras", "El Salvador", "Honduras"]
    return [destination]


def supplier_display_name(supplier: str, location: str, destination: str) -> str:
    if not location or normalized_key(location) == normalized_key(destination):
        return supplier
    return f"{supplier} - {location}"


def row_is_required(row: dict[str, Any]) -> bool:
    required = normalized_key(row.get("Column Required for Calculation"))
    return required != "no"


def is_total_landing_cost(row: dict[str, Any]) -> bool:
    return normalized_key(row.get("Mapping Columns")) == normalized_key(TOTAL_LANDING_COST)


def is_preferred_total_landing_cost(row: dict[str, Any]) -> bool:
    raw_label = clean_text(row.get("Raw Cost Breakdown"))
    return "$" in raw_label or "usd" in normalized_key(raw_label)


def choose_total_landing_cost_row(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [row for row in rows if is_total_landing_cost(row)]
    if not candidates:
        return None

    preferred = [
        row
        for row in candidates
        if is_preferred_total_landing_cost(row)
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

    # Some destination-month sheets contain multiple complete scenarios in a
    # single block (e.g., repeated FOB/Freight/Tax/DDP sets). Pick the
    # component block immediately preceding the chosen TLC row so components
    # reconcile to that TLC while still preserving multi-line detail rows
    # within the selected scenario (e.g., Colombia incremental/regular freight).
    total_indices = [
        index for index, row in enumerate(required_rows) if is_total_landing_cost(row)
    ]
    chosen_total_index = next(
        (index for index, row in enumerate(required_rows) if row is total_row),
        -1,
    )
    if chosen_total_index < 0:
        return []

    previous_total_index = -1
    for index in total_indices:
        if index < chosen_total_index:
            previous_total_index = index
        else:
            break

    def total_signature(row: dict[str, Any]) -> tuple[str, str, str]:
        return (
            normalized_key(row.get("Raw Cost Breakdown")),
            clean_text(row.get("Value")),
            clean_text(row.get("TLC Formula")),
        )

    next_total_index = len(required_rows)
    previous_duplicate_index = chosen_total_index
    chosen_total_signature = total_signature(total_row)
    for index in total_indices:
        if index <= chosen_total_index:
            continue
        if (
            index == previous_duplicate_index + 1
            and total_signature(required_rows[index]) == chosen_total_signature
        ):
            previous_duplicate_index = index
            continue
        next_total_index = index
        break

    scenario_rows = required_rows[previous_total_index + 1 : chosen_total_index]

    # Handle sheets where two TLC rows are adjacent (for example local-currency TLC
    # followed by USD TLC). In that case, the selected TLC block can be empty;
    # fallback to the nearest previous non-empty component block.
    if not scenario_rows and previous_total_index >= 0:
        earlier_total_index = -1
        for index in total_indices:
            if index < previous_total_index:
                earlier_total_index = index
            else:
                break
        scenario_rows = required_rows[earlier_total_index + 1 : previous_total_index]

    # Some files place a component row after TLC. Include only post-TLC rows
    # that add a missing component mapping to avoid pulling in another scenario.
    # Use Raw Cost Breakdown as the primary dedup key (more specific than Mapping
    # Columns) so that distinct items like "ZF Legislation Change" are not
    # incorrectly skipped just because they share a category (e.g. "Tax") with
    # another already-seen row.
    seen_mapping_keys = {
        normalized_key(row.get("Raw Cost Breakdown")) or normalized_key(row.get("Mapping Columns"))
        for row in scenario_rows
    }
    for row in required_rows[chosen_total_index + 1 : next_total_index]:
        if is_total_landing_cost(row):
            continue
        key = normalized_key(row.get("Raw Cost Breakdown")) or normalized_key(row.get("Mapping Columns"))
        if key in seen_mapping_keys:
            continue
        seen_mapping_keys.add(key)
        scenario_rows.append(row)

    # Keep rows in workbook order and drop only exact duplicates.
    def dedupe_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
        return (
            normalized_key(row.get("Raw Cost Breakdown")),
            normalized_key(row.get("Mapping Columns")),
            clean_text(row.get("Value")),
            clean_text(row.get("TLC Formula")),
        )

    selected: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for row in scenario_rows:
        key = dedupe_key(row)
        if key in seen:
            continue
        seen.add(key)
        selected.append(row)

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
    destination = clean_text(row.get("Destination Country"))
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
        "resinIndexType": normalize_resin_index_type(
            row.get("Resin Index Type"),
            destination=destination,
        ),
        "forecastResinIndexType": normalize_resin_index_type(
            row.get("Forecast Resin Index Type"),
            destination=destination,
        ),
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

        # Keep actual and forecast as distinct timeline entries for downstream trend analytics.
        collapsed_key = (
            destination,
            supplier_name,
            supplier,
            location,
            month,
            year,
            data_type,
            source_file,
        )
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
