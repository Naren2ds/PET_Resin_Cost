"""
Pipeline: Bolivia / Preforsa 2026 actuals.

Reads monthly workbooks from data/raw/suppliers/Bolivia/2026 and extracts
the shared Costeo-sheet component values used for the Bolivia VPET/TLC model:
  - ICIS N-1 from B5
  - FLETE MARITIMO, INTERNALIZATION COST, OTHER COST (CDP), OTHER COST
    (BANK FEE) from K11:N11
  - VPET from O11

The mapping is sourced from data/reference/mappings/Mapping_Columns.xlsx,
sheet "04.2026 - Preforsa". Existing Bolivia rows are replaced in the current
supplier front-end data model.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from openpyxl import load_workbook


REPO_ROOT = Path(__file__).resolve().parents[4]
SOURCE_DIR = REPO_ROOT / "data" / "raw" / "suppliers" / "Bolivia" / "2026"
MAPPING_FILE = REPO_ROOT / "data" / "reference" / "mappings" / "Mapping_Columns.xlsx"
MAPPING_SHEET = "04.2026 - Preforsa"
OUTPUT_DIR = REPO_ROOT / "data" / "processed" / "current" / "supplier"
OUTPUT_XLSX = OUTPUT_DIR / "Data_Standardized_Front_End_Data_Model.xlsx"
OUTPUT_CSV = OUTPUT_DIR / "Data_Standardized_Front_End_Data_Model.csv"

SUPPLIER_NAME = "Preforsa"
DESTINATION_COUNTRY = "Bolivia"
LOCATION = "Bolivia"
RESIN_INDEX_TYPE = "ICIS China MID (N-1)"
TLC_FORMULA = (
    "VPET = ((ICIS N-1 + FLETE MARITIMO) * "
    "(1 + OTHER COST ( CDP) + OTHER COST (BANK FEE))) + INTERNALIZATION COST"
)

MONTH_LABELS = {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
}

FRONT_END_HEADERS = [
    "Data Type",
    "Source File ",
    "Supplier Name",
    "Destination Country",
    "Time_Period ",
    "Time Period Year",
    "Time Period Month",
    "Location",
    "Raw Cost Breakdown",
    "Resin Index Type",
    "Forecast Resin Index Type",
    "Mapping Columns",
    "Column Required for Calculation",
    "Value ",
    "TLC Formula",
]

COMPONENT_CELLS = [
    ("ICIS N-1", "B5"),
    ("FLETE MARITIMO", "K11"),
    ("INTERNALIZATION COST", "L11"),
    ("OTHER COST ( CDP)", "M11"),
    ("OTHER COST (BANK FEE)", "N11"),
    ("VPET", "O11"),
]


def normalize_colname(col: Any) -> str:
    if col is None:
        return ""
    return re.sub(r"\s+", " ", str(col).strip()).lower()

def load_mapping() -> dict[str, dict[str, str]]:
    mapping_df = pd.read_excel(MAPPING_FILE, sheet_name=MAPPING_SHEET)

    # Normalize all column names
    normalized_columns = {normalize_colname(c): c for c in mapping_df.columns}

    required = {
        "metric_label_original",
        "mapping columns",
        "column required for calculation",
    }

    missing = required.difference(normalized_columns.keys())
    if missing:
        raise ValueError(
            f"Mapping sheet {MAPPING_SHEET!r} missing columns: {sorted(missing)}\n"
            f"Available columns: {list(mapping_df.columns)}"
        )

    # Resolve actual Excel column names
    metric_col = normalized_columns["metric_label_original"]
    mapping_col = normalized_columns["mapping columns"]
    required_col = normalized_columns["column required for calculation"]

    result: dict[str, dict[str, str]] = {}
    for _, row in mapping_df.iterrows():
        label = clean_text(row.get(metric_col))
        if not label:
            continue
        result[label] = {
            "mapping": clean_text(row.get(mapping_col)),
            "required": clean_text(row.get(required_col)) or "Yes",
        }

    return result



def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    return str(value).strip()


def parse_month_from_filename(path: Path) -> int:
    match = re.match(r"(\d{2})\.2026\s+-\s+Preforsa", path.name, flags=re.IGNORECASE)
    if not match:
        raise ValueError(f"Unable to parse 2026 month from file name: {path.name}")
    month = int(match.group(1))
    if month not in MONTH_LABELS:
        raise ValueError(f"Invalid month {month} in file name: {path.name}")
    return month


def numeric_value(value: Any, label: str, path: Path) -> float:
    if isinstance(value, (int, float)) and not pd.isna(value):
        return float(value)
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{path.name}: {label} has non-numeric value {value!r}") from exc


def extract_month(path: Path, mapping: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    month = parse_month_from_filename(path)
    period_label = f"{MONTH_LABELS[month]} 2026"

    workbook = load_workbook(path, data_only=True, read_only=True)
    try:
        worksheet = workbook["Costeo"]
        rows: list[dict[str, Any]] = []

        for label, cell in COMPONENT_CELLS:
            if label not in mapping:
                raise ValueError(f"Mapping for {label!r} not found in {MAPPING_SHEET!r}")

            rows.append(
                {
                    "Data Type": "Actual",
                    "Source File ": str(path.relative_to(REPO_ROOT)),
                    "Supplier Name": SUPPLIER_NAME,
                    "Destination Country": DESTINATION_COUNTRY,
                    "Time_Period ": period_label,
                    "Time Period Year": 2026,
                    "Time Period Month": month,
                    "Location": LOCATION,
                    "Raw Cost Breakdown": label,
                    "Resin Index Type": RESIN_INDEX_TYPE if label == "ICIS N-1" else "",
                    "Forecast Resin Index Type": "",
                    "Mapping Columns": mapping[label]["mapping"],
                    "Column Required for Calculation": mapping[label]["required"],
                    "Value ": numeric_value(worksheet[cell].value, label, path),
                    "TLC Formula": TLC_FORMULA,
                }
            )
    finally:
        workbook.close()

    return rows


def merge_rows(new_rows: list[dict[str, Any]]) -> pd.DataFrame:
    if not OUTPUT_XLSX.exists():
        raise FileNotFoundError(f"Current front-end model not found: {OUTPUT_XLSX}")

    existing = pd.read_excel(OUTPUT_XLSX, sheet_name="front_end_data_model")
    missing_headers = [column for column in FRONT_END_HEADERS if column not in existing.columns]
    if missing_headers:
        raise ValueError(f"Current front-end model missing columns: {missing_headers}")

    existing = existing[FRONT_END_HEADERS]
    old_count = len(existing[existing["Destination Country"].astype(str).str.strip() == DESTINATION_COUNTRY])
    kept = existing[existing["Destination Country"].astype(str).str.strip() != DESTINATION_COUNTRY].copy()
    new_df = pd.DataFrame(new_rows, columns=FRONT_END_HEADERS)
    merged = pd.concat([kept, new_df], ignore_index=True)

    print(f"  Existing rows: {len(existing)}")
    print(f"  Removed old Bolivia rows: {old_count}")
    print(f"  New Bolivia rows: {len(new_df)}")
    print(f"  Merged total rows: {len(merged)}")
    return merged


def write_outputs(merged: pd.DataFrame) -> None:
    with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as writer:
        merged.to_excel(writer, sheet_name="front_end_data_model", index=False)
        metadata = pd.DataFrame(
            [
                {"key": "pipeline", "value": "Bolivia_2026/run_bolivia_2026_pipeline.py"},
                {"key": "rows", "value": len(merged)},
                {"key": "bolivia_rows", "value": int((merged["Destination Country"] == DESTINATION_COUNTRY).sum())},
            ]
        )
        metadata.to_excel(writer, sheet_name="run_metadata", index=False)

    merged.to_csv(OUTPUT_CSV, index=False)


def main() -> None:
    if not SOURCE_DIR.exists():
        print(f"ERROR: Source directory not found: {SOURCE_DIR}")
        sys.exit(1)

    files = sorted(SOURCE_DIR.glob("*.xlsx"))
    if not files:
        print(f"ERROR: No 2026 Bolivia xlsx files found in {SOURCE_DIR}")
        sys.exit(1)

    mapping = load_mapping()
    all_rows: list[dict[str, Any]] = []

    print(f"Found {len(files)} Bolivia monthly files")
    for path in files:
        rows = extract_month(path, mapping)
        all_rows.extend(rows)
        month = rows[0]["Time Period Month"]
        print(f"  {path.name}: {MONTH_LABELS[month]} 2026 -> {len(rows)} rows")

    merged = merge_rows(all_rows)
    write_outputs(merged)
    print(f"Written: {OUTPUT_XLSX}")
    print(f"Written: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
