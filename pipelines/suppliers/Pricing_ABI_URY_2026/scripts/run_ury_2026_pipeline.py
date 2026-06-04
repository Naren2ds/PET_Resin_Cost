"""
Pipeline: Uruguay 2026 (April only)
Reads from: data/raw/suppliers/Precios preformas FNC abril 2026.xlsx
Sheet: Abril 2026
Extracts values from E5:F15:
  - F5  = Resina FOB Asia (FOB Price)
  - F6  = Flete internacional (Ocean Freight)
  - F7  = Otros gastos (Others)
  - F9  = Precio Base de Materia Prima (CIF subtotal)
  - F11 = Gasto de internación y puesta en Silos (Tax %)
  - F13 = Precio final en planta v PET (Total Landing Cost / DDP)
Mapping from: data/reference/mappings/Mapping_Columns.xlsx, sheet "Precios preformas FNC abril 202"
Outputs standardized rows with Destination Country = "Uruguay".
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parents[4]
SOURCE_FILE = REPO_ROOT / "data" / "raw" / "suppliers" / "Precios preformas FNC abril 2026.xlsx"
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

# Components to extract based on mapping file
# (key, raw_label, cell_row, mapping_col, required)
COMPONENT_SPEC = [
    ("fob", "Resina FOB Asia", 5, "Resin Index vPET", "Yes"),
    ("freight", "Flete internacional", 6, "Freight", "Yes"),
    ("others", "Otros gastos", 7, "Others", "Yes"),
    ("cif", "Precio Base de Materia Prima", 9, "Others", "Yes"),
    ("tax", "Gasto de internacion y puesta en Silos", 11, "Tax", "Yes"),
    ("ddp", "Precio final en planta v PET", 13, "Total Landing Cost ", "Yes"),
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


def extract_rows() -> list[dict[str, Any]]:
    """Extract standardized rows from the Abril 2026 sheet."""
    wb = load_workbook(SOURCE_FILE, read_only=True, data_only=True)
    ws = wb["Abril 2026"]

    year = 2026
    month = 4  # April
    period_label = f"{MONTH_LABELS[month]} {year}"

    rows: list[dict[str, Any]] = []
    for key, raw_label, cell_row, mapping_col, required in COMPONENT_SPEC:
        value = ws.cell(cell_row, 6).value  # Column F
        print(f"  {raw_label} (F{cell_row}): {value}")

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

    wb.close()
    return rows


def main() -> None:
    if not SOURCE_FILE.exists():
        print(f"ERROR: Source file not found: {SOURCE_FILE}")
        sys.exit(1)

    print(f"Reading: {SOURCE_FILE.name}")
    print(f"Sheet: Abril 2026, April 2026 only")

    all_rows = extract_rows()
    print(f"\nTotal extracted rows: {len(all_rows)}")

    if not all_rows:
        print("ERROR: No rows extracted")
        sys.exit(1)

    try:
        import pandas as pd
    except ImportError:
        print("ERROR: pandas required. Run: pip install pandas openpyxl")
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
