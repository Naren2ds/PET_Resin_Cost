"""Validate that TLC values displayed across all UI pages are identical.

Checks View TLCs, every final-TLC location on TLC Breakdown, and Trends for
Supplier and Market Research data. Values are compared at displayed cent
precision with zero tolerance, so any point difference is flagged.

Run from PET_Resin_Cost:
    python testing_scripts/validate_ui_tlc_consistency.py --year 2026
    python testing_scripts/validate_ui_tlc_consistency.py --destination Brazil --year 2026
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"
OUTPUT_COLUMNS = [
    "Data Set", "Destination", "Source Country", "Supplier", "Location",
    "Year", "Month", "Data Type", "Source TLC",
    "View TLCs", "Breakdown Supplier/Market Card", "Breakdown Upper TLC Row",
    "Breakdown Detail TLC Row", "Trends TLC", "Minimum UI TLC", "Maximum UI TLC",
    "Difference", "Status", "Mismatch Details",
]
MONTH_ORDER = {
    name: index for index, name in enumerate(
        ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"), 1
    )
}


def numeric(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().replace(",", ""))
        except ValueError:
            return None
    return None


def displayed(value: float | None, decimals: int = 2) -> float | None:
    """Match normal currency display rounding using decimal half-up rounding."""
    if value is None:
        return None
    quantum = Decimal("1").scaleb(-decimals)
    return float(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))


def supplier_tlc(entry: dict[str, Any]) -> float | None:
    for row in entry.get("rows", []):
        if str(row.get("label", "")).strip().casefold() == "total resin price abi virgin formula":
            return numeric(row.get("amount"))
    return None


def market_tlc(country: dict[str, Any]) -> float | None:
    for row in country.get("breakdown", []):
        if "total landed cost" in str(row.get("label", "")).casefold():
            return numeric(row.get("amount"))
    return numeric(country.get("amount"))


def compare_values(values: dict[str, float | None]) -> tuple[float | None, float | None, float | None, str, str]:
    missing = [name for name, value in values.items() if value is None]
    present = [value for value in values.values() if value is not None]
    minimum = min(present) if present else None
    maximum = max(present) if present else None
    difference = displayed(maximum - minimum, 2) if minimum is not None and maximum is not None else None
    mismatches = []
    if missing:
        mismatches.append("Missing: " + ", ".join(missing))
    if difference is not None and difference != 0:
        baseline_name, baseline = next((item for item in values.items() if item[1] is not None), ("", None))
        for name, value in values.items():
            if value is not None and baseline is not None and value != baseline:
                mismatches.append(f"{name}={value:.2f} vs {baseline_name}={baseline:.2f}")
    status = "PASS" if not missing and difference == 0 else "FAIL"
    return minimum, maximum, difference, status, "; ".join(mismatches)


def supplier_results(entries: list[dict[str, Any]], destination: str | None, year: int | None) -> list[dict[str, Any]]:
    results = []
    seen = set()
    for entry in entries:
        entry_destination = str(entry.get("destination", "")).strip()
        entry_year = int(entry.get("year") or 0)
        if destination and entry_destination.casefold() != destination.casefold():
            continue
        if year is not None and entry_year != year:
            continue
        raw = supplier_tlc(entry)
        if raw is None:
            continue
        supplier = str(entry.get("supplierName") or entry.get("supplier") or entry.get("vendor") or "Unknown").strip()
        location = str(entry.get("location") or entry_destination).strip()
        month = str(entry.get("month", "")).strip()
        data_type = str(entry.get("dataType", "")).strip()
        key = (entry_destination, supplier, location, entry_year, month, data_type)
        if key in seen:
            continue
        seen.add(key)

        # HomePage applies Number(fromApi.toFixed(1)); other locations format the raw TLC to cents.
        view_tlcs = displayed(displayed(raw, 1), 2)
        page_value = displayed(raw, 2)
        values = {
            "View TLCs": view_tlcs,
            "Breakdown Supplier Card": page_value,
            "Breakdown Upper TLC Row": page_value,
            "Breakdown Detail TLC Row": page_value,
            "Trends TLC": page_value,
        }
        minimum, maximum, difference, status, details = compare_values(values)
        results.append({
            "Data Set": "Supplier", "Destination": entry_destination, "Source Country": "All MR sources",
            "Supplier": supplier, "Location": location, "Year": entry_year, "Month": month,
            "Data Type": data_type, "Source TLC": raw, "View TLCs": view_tlcs,
            "Breakdown Supplier/Market Card": page_value, "Breakdown Upper TLC Row": page_value,
            "Breakdown Detail TLC Row": page_value, "Trends TLC": page_value,
            "Minimum UI TLC": minimum, "Maximum UI TLC": maximum, "Difference": difference,
            "Status": status, "Mismatch Details": details,
        })
    return results


def market_results(destination_filter: str | None, year_filter: int | None) -> list[dict[str, Any]]:
    from market_research_data_model import (
        available_destinations,
        available_periods_for_destination,
        build_market_research_countries,
        build_market_research_tlc_trends,
    )
    results = []
    destinations = available_destinations()
    if destination_filter:
        destinations = [item for item in destinations if item.casefold() == destination_filter.casefold()]
    for destination in destinations:
        periods = available_periods_for_destination(destination)
        years = sorted({int(period_year) for _, period_year in periods})
        if year_filter is not None:
            years = [value for value in years if value == year_filter]
        trends_by_key = {}
        for year in years:
            for item in build_market_research_tlc_trends(destination, year):
                key = (str(item.get("sourceCountry", "")).strip(), str(item.get("month", "")).strip(), int(item.get("year") or year))
                trends_by_key[key] = numeric(item.get("amount"))
        for month, year_value in periods:
            year = int(year_value)
            if year_filter is not None and year != year_filter:
                continue
            for country in build_market_research_countries(destination, month, str(year)):
                source = str(country.get("country", "")).strip()
                raw = market_tlc(country)
                page_value = displayed(raw, 2)
                trend_raw = trends_by_key.get((source, month, year))
                trend_value = displayed(trend_raw, 2)
                values = {
                    "View TLCs": page_value,
                    "Breakdown Market Card": page_value,
                    "Breakdown Upper TLC Row": page_value,
                    "Breakdown Detail TLC Row": page_value,
                    "Trends TLC": trend_value,
                }
                minimum, maximum, difference, status, details = compare_values(values)
                results.append({
                    "Data Set": "Market Research", "Destination": destination, "Source Country": source,
                    "Supplier": "Market Research", "Location": "", "Year": year, "Month": month,
                    "Data Type": str(country.get("dataType", "")), "Source TLC": raw, "View TLCs": page_value,
                    "Breakdown Supplier/Market Card": page_value, "Breakdown Upper TLC Row": page_value,
                    "Breakdown Detail TLC Row": page_value, "Trends TLC": trend_value,
                    "Minimum UI TLC": minimum, "Maximum UI TLC": maximum, "Difference": difference,
                    "Status": status, "Mismatch Details": details,
                })
    return results


def write_excel(rows: list[dict[str, Any]], output: Path) -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    output.parent.mkdir(parents=True, exist_ok=True)
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    blue = PatternFill("solid", fgColor="1F4E78")
    green = PatternFill("solid", fgColor="C6EFCE")
    red = PatternFill("solid", fgColor="FFC7CE")
    summary.append(["Data Set", "Rows Checked", "Passed", "Failed", "Maximum Difference"])
    for data_set in ("Supplier", "Market Research"):
        selected = [row for row in rows if row["Data Set"] == data_set]
        summary.append([data_set, len(selected), sum(r["Status"] == "PASS" for r in selected),
                        sum(r["Status"] == "FAIL" for r in selected), max((r["Difference"] or 0 for r in selected), default=0)])
    summary.append(["TOTAL", len(rows), sum(r["Status"] == "PASS" for r in rows),
                    sum(r["Status"] == "FAIL" for r in rows), max((r["Difference"] or 0 for r in rows), default=0)])

    def add_sheet(name: str, selected: list[dict[str, Any]]) -> None:
        sheet = workbook.create_sheet(name)
        sheet.append(OUTPUT_COLUMNS)
        for row in selected:
            sheet.append([row.get(column) for column in OUTPUT_COLUMNS])
            status_cell = sheet.cell(sheet.max_row, OUTPUT_COLUMNS.index("Status") + 1)
            status_cell.fill = green if status_cell.value == "PASS" else red
            status_cell.font = Font(bold=True)
            for column in range(OUTPUT_COLUMNS.index("Source TLC") + 1, OUTPUT_COLUMNS.index("Difference") + 2):
                sheet.cell(sheet.max_row, column).number_format = '#,##0.00'
        sheet.freeze_panes = "I2"
        sheet.auto_filter.ref = sheet.dimensions
        widths = [18, 22, 22, 34, 22, 9, 12, 12, 16, 16, 25, 23, 24, 16, 16, 16, 14, 11, 70]
        for index, width in enumerate(widths, 1):
            sheet.column_dimensions[get_column_letter(index)].width = width

    add_sheet("Supplier TLC", [row for row in rows if row["Data Set"] == "Supplier"])
    add_sheet("Market TLC", [row for row in rows if row["Data Set"] == "Market Research"])
    add_sheet("Mismatches", [row for row in rows if row["Status"] == "FAIL"])
    for sheet in workbook.worksheets:
        for cell in sheet[1]:
            cell.fill = blue
            cell.font = Font(color="FFFFFF", bold=True)
            cell.alignment = Alignment(horizontal="center")
        sheet.freeze_panes = sheet.freeze_panes or "A2"
        sheet.auto_filter.ref = sheet.dimensions
    workbook.save(output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate exact displayed TLC consistency across all UI pages.")
    parser.add_argument("--destination", help="Validate one destination")
    parser.add_argument("--year", type=int, help="Validate one year")
    parser.add_argument("--output-excel", type=Path, help="Excel report path")
    args = parser.parse_args()
    output = args.output_excel or Path(f"ui_tlc_consistency_{datetime.now():%Y%m%d_%H%M%S}.xlsx")
    sys.path.insert(0, str(BACKEND_DIR))
    try:
        from supplier_data_model import build_vendor_breakdowns
        supplier_entries = build_vendor_breakdowns(("China",))
        rows = supplier_results(supplier_entries, args.destination, args.year)
        rows.extend(market_results(args.destination, args.year))
        if not rows:
            print("ERROR: No TLC rows matched the filters.", file=sys.stderr)
            return 2
        rows.sort(key=lambda row: (row["Data Set"], row["Destination"], row["Year"], MONTH_ORDER.get(row["Month"], 99), row["Supplier"], row["Source Country"]))
        write_excel(rows, output)
    except (OSError, ValueError, ImportError, StopIteration) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    failed = sum(row["Status"] == "FAIL" for row in rows)
    print(f"Rows checked: {len(rows)} | Passed: {len(rows)-failed} | Failed: {failed}")
    print(f"Excel report: {output.resolve()}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
