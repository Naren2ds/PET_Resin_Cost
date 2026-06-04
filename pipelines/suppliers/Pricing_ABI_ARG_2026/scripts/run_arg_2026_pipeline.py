"""
Pipeline: Argentina 2026 (Jan-Feb)
Reads from: data/raw/suppliers/ABI 120326 -Pricing Marzo 2026.xlsx
Sheet: CSD Resina Ush
Extracts rows 60-61 (Jan 2026, Feb 2026) with columns:
  - C = FOB Price
  - D = Ocean Freight
  - Clearance = DDP - FOB - Freight (sum of Inland Cost + Handling + BigBag + Other)
  - U = DDP Price (Final)
Outputs standardized rows with Destination Country = "Argentina".
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parents[4]
SOURCE_FILE = REPO_ROOT / "data" / "raw" / "suppliers" / "ABI 120326 -Pricing Marzo 2026.xlsx"
OUTPUT_XLSX = (
    REPO_ROOT / "data" / "processed" / "current" / "supplier"
    / "Data_Standardized_Front_End_Data_Model.xlsx"
)

SUPPLIER_NAME = "DAK Americas"
DESTINATION_COUNTRY = "Argentina"
LOCATION = "China"
RESIN_INDEX_TYPE = "ICIS Asia SE Low index (M-2)"
TLC_FORMULA = "PET Resin USD/Ton = FOB + Freight + Inland + Handling + BigBag + Other"

MONTH_LABELS = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}

# Rows to extract: row 60 = Jan 2026, row 61 = Feb 2026
DATA_ROWS = [60, 61]

COMPONENT_SPEC = [
    ("fob", "FOB Price", "Resin Index vPET", "Yes"),
    ("freight", "Ocean Freight", "Freight ", "Yes"),
    ("clearance", "Import Clearance (%)", "Tax", "Yes"),
    ("ddp", "DDP Price", "Total Landing Cost ", "Yes"),
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


def extract_rows(ws) -> list[dict[str, Any]]:
    """Extract standardized rows from the CSD Resina Ush sheet."""
    rows: list[dict[str, Any]] = []

    for data_row in DATA_ROWS:
        date_val = ws.cell(data_row, 2).value  # B column - date
        fob = ws.cell(data_row, 3).value       # C - FOB
        freight = ws.cell(data_row, 4).value   # D - Freight
        ddp = ws.cell(data_row, 21).value      # U - Final

        if date_val is None or ddp is None:
            print(f"  WARNING: Row {data_row} has no date or DDP value, skipping")
            continue

        # Parse year/month from date
        if hasattr(date_val, 'year'):
            year = date_val.year
            month = date_val.month
        else:
            # Try parsing string date
            import datetime
            date_val = str(date_val)
            dt = datetime.datetime.fromisoformat(date_val.replace(" 00:00:00", ""))
            year = dt.year
            month = dt.month

        period_label = f"{MONTH_LABELS[month]} {year}"

        # Clearance = DDP - FOB - Freight (all local costs combined)
        fob_val = float(fob) if fob else 0
        freight_val = float(freight) if freight else 0
        ddp_val = float(ddp)
        clearance = round(ddp_val - fob_val - freight_val, 2)

        values = {
            "fob": fob_val,
            "freight": freight_val,
            "clearance": clearance,
            "ddp": ddp_val,
        }

        print(f"  Row {data_row}: {period_label} -> FOB={fob_val}, Freight={freight_val:.2f}, Clearance={clearance:.2f}, DDP={ddp_val:.2f}")

        for key, raw_label, mapping_col, required in COMPONENT_SPEC:
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
                "Value ": values[key],
                "TLC Formula": TLC_FORMULA,
            })

    return rows


def main() -> None:
    if not SOURCE_FILE.exists():
        print(f"ERROR: Source file not found: {SOURCE_FILE}")
        sys.exit(1)

    print(f"Reading: {SOURCE_FILE.name}")
    print(f"Sheet: CSD Resina Ush, Rows: {DATA_ROWS}")

    wb = load_workbook(SOURCE_FILE, read_only=True, data_only=True)
    ws = wb["CSD Resina Ush"]

    all_rows = extract_rows(ws)
    wb.close()

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

    # Remove old Argentina rows
    old_count = len(existing_df[existing_df["Destination Country"] == DESTINATION_COUNTRY])
    if old_count > 0:
        existing_df = existing_df[existing_df["Destination Country"] != DESTINATION_COUNTRY]
        print(f"  Removed {old_count} old Argentina rows")

    new_df = pd.DataFrame(all_rows, columns=FRONT_END_HEADERS)
    print(f"  New Argentina rows: {len(new_df)}")

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
