from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pandas as pd
from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parents[4]
SOURCE_FILE = REPO_ROOT / "data" / "raw" / "suppliers" / "2 - Precios preformas 2026.xlsx"
OUTPUT_XLSX = (
    REPO_ROOT / "data" / "processed" / "current" / "supplier"
    / "Data_Standardized_Front_End_Data_Model.xlsx"
)

SUPPLIER_NAME = "FNC"
DESTINATION_COUNTRY = "Uruguay"
LOCATION = "Asia"
RESIN_INDEX_TYPE = "ICIS Asia SE Low index (M-1)"
TLC_FORMULA = "PET Resin USD/Ton = (FOB + Freight + Others) * (1 + Internacion%)"

MONTH_LABELS = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}

# -------------------------------------------------------------------
# CONFIGURE THE SHEETS HERE
# -------------------------------------------------------------------
# Add as many sheets as needed.
# Each entry tells the script:
#   - which worksheet to read
#   - which month/year it represents
#   - which sheet name to use in the mapping file (optional, if you want later)
SHEET_SPECS = [
    {"sheet_name":"Enero" , "month": 1, "year": 2026},
    {"sheet_name":"Febrero" , "month": 2, "year": 2026},
    {"sheet_name":"Marzo" , "month": 3, "year": 2026},
    {"sheet_name": "Abril", "month": 4, "year": 2026},
    {"sheet_name": "Mayo", "month": 5, "year": 2026},
    {"sheet_name": "Junio", "month": 6, "year": 2026},
    {"sheet_name": "Junio 2026", "month": 6, "year": 2026},
    {"sheet_name": "Jun 2026", "month": 6, "year": 2026},
]

# Components to extract from each sheet
# (raw_label, excel_row, excel_col, mapping_col, required)
COMPONENT_SPEC = [
    ("Resina FOB Asia", 5, 6, "Resin Index vPET", "Yes"),      # F5
    ("Flete internacional", 6, 6, "Freight", "Yes"),           # F6
    ("Otros gastos", 7, 6, "Others", "Yes"),                   # F7
    ("Precio Base de Materia Prima", 9, 6, "Others", "Yes"),   # F9
    ("Gasto de internacion y puesta en Silos", 11, 6, "Tax", "Yes"),  # F11
    ("Precio final en planta v PET", 13, 6, "Total Landing Cost ", "Yes"),  # F13
]

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


def extract_rows_from_sheet(
    ws,
    sheet_name: str,
    year: int,
    month: int,
) -> list[dict[str, Any]]:
    """Extract standardized rows from a single worksheet."""
    period_label = f"{MONTH_LABELS[month]} {year}"
    rows: list[dict[str, Any]] = []

    for raw_label, excel_row, excel_col, mapping_col, required in COMPONENT_SPEC:
        value = ws.cell(excel_row, excel_col).value
        print(f"  [{sheet_name}] {raw_label} (F{excel_row}): {value}")

        rows.append({
            "Data Type": "Actual",
            "Source File ": SOURCE_FILE.name,
            "Supplier Name": SUPPLIER_NAME,
            "Destination Country": DESTINATION_COUNTRY,
            "Time_Period ": period_label,
            "Time Period Year": year,
            "Time Period Month": month,
            "Location": LOCATION,
            "Raw Cost Breakdown": raw_label,
            "Resin Index Type": RESIN_INDEX_TYPE,
            "Forecast Resin Index Type": "",
            "Mapping Columns": mapping_col,
            "Column Required for Calculation": required,
            "Value ": value,
            "TLC Formula": TLC_FORMULA,
        })

    return rows


def extract_all_rows() -> list[dict[str, Any]]:
    """Extract rows from all configured sheets."""
    wb = load_workbook(SOURCE_FILE, read_only=True, data_only=True)

    all_rows: list[dict[str, Any]] = []
    month_seen: set[tuple[int, int]] = set()

    try:
        for spec in SHEET_SPECS:
            sheet_name = spec["sheet_name"]
            month = spec["month"]
            year = spec["year"]

            if (year, month) in month_seen:
                continue

            if sheet_name not in wb.sheetnames:
                continue

            print(f"\nReading sheet: {sheet_name}")
            ws = wb[sheet_name]
            rows = extract_rows_from_sheet(ws, sheet_name=sheet_name, year=year, month=month)
            all_rows.extend(rows)
            month_seen.add((year, month))
    finally:
        wb.close()

    return all_rows


def main() -> None:
    if not SOURCE_FILE.exists():
        print(f"ERROR: Source file not found: {SOURCE_FILE}")
        sys.exit(1)

    print(f"Reading workbook: {SOURCE_FILE.name}")
    print(f"Configured sheets: {[s['sheet_name'] for s in SHEET_SPECS]}")

    all_rows = extract_all_rows()
    print(f"\nTotal extracted rows: {len(all_rows)}")

    if not all_rows:
        print("ERROR: No rows extracted")
        sys.exit(1)

    print(f"\nMerging into: {OUTPUT_XLSX}")
    existing_df = pd.read_excel(OUTPUT_XLSX, sheet_name="front_end_data_model")
    print(f"  Existing rows: {len(existing_df)}")

    # Remove old Uruguay rows
    old_count = len(existing_df[existing_df["Destination Country"] == DESTINATION_COUNTRY])
    if old_count > 0:
        existing_df = existing_df[existing_df["Destination Country"] != DESTINATION_COUNTRY]
        print(f"  Removed {old_count} old Uruguay rows")

    new_df = pd.DataFrame(all_rows, columns=FRONT_END_HEADERS)
    print(f"  New Uruguay rows: {len(new_df)}")

    merged_df = pd.concat([existing_df, new_df], ignore_index=True)
    print(f"  Merged total: {len(merged_df)} rows")

    with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as writer:
        merged_df.to_excel(writer, sheet_name="front_end_data_model", index=False)

    print(f"  Written to: {OUTPUT_XLSX}")

    from collections import Counter
    dests = Counter(merged_df["Destination Country"].values)
    print(f"\nFinal destinations: {dict(dests)}")


if __name__ == "__main__":
    main()