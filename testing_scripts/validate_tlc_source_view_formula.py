"""Validate Source, View TLC, common-component and detail-formula TLC values.

Checks Supplier and Market Research rows. Any difference at displayed cent
precision is a failure. Valgroup and Cristalpet use their explicit multiplier
formulae; other rows use the required additive cost-component mapping.

Run from PET_Resin_Cost:
    python testing_scripts/validate_tlc_source_view_formula.py --year 2026
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"
TEST_DIR = Path(__file__).resolve().parent
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
COLUMNS = [
    "Data Set", "Destination", "Supplier / MR Source", "Location", "Year", "Month", "Data Type",
    "Source TLC", "View TLC", "Common Component TLC", "Detail Formula TLC",
    "View - Source", "Common - Source", "Formula - Source", "Maximum Difference",
    "View Difference %", "Common Difference %", "Formula Difference %",
    "Maximum Difference %", "Tolerance % Rule",
    "Status", "Calculation", "Formula Reference",
]


def number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().replace(",", ""))
        except ValueError:
            return None
    return None


def rounded(value: float | None, decimals: int = 2) -> float | None:
    if value is None:
        return None
    quantum = Decimal("1").scaleb(-decimals)
    return float(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))


def raw_key(row: dict[str, Any]) -> str:
    return str(row.get("rawLabel") or row.get("label") or "").strip().casefold()


def source_tlc(rows: list[dict[str, Any]]) -> tuple[float | None, str]:
    for row in rows:
        if str(row.get("label", "")).strip().casefold() == "total resin price abi virgin formula":
            return number(row.get("amount")), str(row.get("formulaReference") or "")
    return None, ""


def component_values(rows: list[dict[str, Any]], mapper) -> tuple[dict[str, float], list[str]]:
    values: dict[str, float] = defaultdict(float)
    terms = []
    for row in rows:
        value = number(row.get("amount"))
        component = mapper(row)
        if value is None or not component or component == "Total Landed Cost (PET Resin)":
            continue
        if str(row.get("columnRequiredForCalculation", "")).strip().casefold() == "no":
            continue
        if component not in {
            "Resin Index", "Freight", "Insurance", "Duty & Import Taxes",
            "Local Taxes & Fees", "Logistics & Other Costs",
        }:
            continue
        if row.get("valueFormat") == "percentage":
            continue
        values[component] += value
        terms.append(f"{row.get('rawLabel') or row.get('label')}={value:.6f}")
    return values, terms


def valgroup_formula(rows: list[dict[str, Any]]) -> tuple[float | None, str, dict[str, float]]:
    by_label = {raw_key(row): number(row.get("amount")) for row in rows}
    resin = by_label.get("resin with assumptions")
    discount = by_label.get("discount")
    freight = by_label.get("drewry (t-1) with discount")
    importation = by_label.get("importation")
    import_tax = by_label.get("import tax")
    surcharge = by_label.get("surcharge")
    indorama = by_label.get("indorama discount")
    inputs = [resin, discount, freight, importation, import_tax, surcharge, indorama]
    if any(value is None for value in inputs):
        return None, "Missing Valgroup formula input", {}
    assert all(value is not None for value in inputs)
    discount_impact = -(resin * discount)
    tax_base = resin + discount_impact + freight
    tax_impact = tax_base * (importation + import_tax)
    logistics = discount_impact + surcharge + indorama
    result = resin + freight + tax_impact + logistics
    expression = (
        f"(({resin:.6f} * (1 - {discount:.6f}) + {freight:.6f}) * "
        f"(1 + {importation:.6f} + {import_tax:.6f})) + {surcharge:.6f} + ({indorama:.6f}) = {result:.6f}"
    )
    components = {
        "Resin Index": resin, "Freight": freight,
        "Local Taxes & Fees": tax_impact, "Logistics & Other Costs": logistics,
    }
    return result, expression, components


def cristalpet_formula(rows: list[dict[str, Any]]) -> tuple[float | None, str, dict[str, float]]:
    by_label = {raw_key(row): number(row.get("amount")) for row in rows}
    resin_row = next((row for row in rows if str(row.get("commonComponent", "")).casefold() == "resin index"), None)
    freight_row = next((row for row in rows if str(row.get("commonComponent", "")).casefold() == "freight"), None)
    resin = number(resin_row.get("amount")) if resin_row else None
    freight = number(freight_row.get("amount")) if freight_row else None
    tax = by_label.get("tax")
    other_costs = by_label.get("other costs")
    additional = by_label.get("additional cost index china")
    inputs = [resin, freight, tax, other_costs, additional]
    if any(value is None for value in inputs):
        return None, "Missing Cristalpet formula input", {}
    assert all(value is not None for value in inputs)
    tax_impact = (resin + freight) * tax
    result = resin + freight + tax_impact + other_costs + additional
    expression = (
        f"(({resin:.6f} + {freight:.6f}) * (1 + {tax:.6f})) + "
        f"{other_costs:.6f} + {additional:.6f} = {result:.6f}"
    )
    components = {
        "Resin Index": resin, "Freight": freight, "Local Taxes & Fees": tax_impact,
        "Logistics & Other Costs": other_costs, "Duty & Import Taxes": additional,
    }
    return result, expression, components


def bolivia_formula(rows: list[dict[str, Any]]) -> tuple[float | None, str, dict[str, float]]:
    by_label = {raw_key(row): number(row.get("amount")) for row in rows}
    resin = by_label.get("icis n-1")
    freight = by_label.get("flete maritimo")
    internalization = by_label.get("internalization cost")
    cdp_rate = by_label.get("other cost ( cdp)")
    bank_fee_rate = by_label.get("other cost (bank fee)")
    inputs = [resin, freight, internalization, cdp_rate, bank_fee_rate]
    if any(value is None for value in inputs):
        return None, "Missing Bolivia formula input", {}
    assert all(value is not None for value in inputs)
    rate_impact = (resin + freight) * (cdp_rate + bank_fee_rate)
    result = resin + freight + rate_impact + internalization
    expression = (
        f"(({resin:.6f} + {freight:.6f}) * "
        f"(1 + {cdp_rate:.6f} + {bank_fee_rate:.6f})) + "
        f"{internalization:.6f} = {result:.6f}"
    )
    components = {
        "Resin Index": resin,
        "Freight": freight,
        "Duty & Import Taxes": rate_impact,
        "Logistics & Other Costs": internalization,
    }
    return result, expression, components


def uruguay_cristalpet_formula(rows: list[dict[str, Any]]) -> tuple[float | None, str, dict[str, float]]:
    by_label = {raw_key(row): number(row.get("amount")) for row in rows}
    resin = by_label.get("resina fob asia")
    freight = by_label.get("flete internacional")
    other_costs = by_label.get("otros gastos")
    base_subtotal = by_label.get("precio base de materia prima")
    internalization_rate = by_label.get("gasto de internacion y puesta en silos")
    inputs = [resin, freight, other_costs, base_subtotal, internalization_rate]
    if any(value is None for value in inputs):
        return None, "Missing Uruguay Cristalpet formula input", {}
    assert all(value is not None for value in inputs)
    calculated_base = resin + freight + other_costs
    internalization_impact = base_subtotal * internalization_rate
    result = calculated_base + internalization_impact
    expression = (
        f"({resin:.6f} + {freight:.6f} + {other_costs:.6f}) + "
        f"({base_subtotal:.6f} * {internalization_rate:.6f}) = {result:.6f}"
    )
    components = {
        "Resin Index": resin,
        "Freight": freight,
        "Local Taxes & Fees": internalization_impact,
        "Logistics & Other Costs": other_costs,
    }
    return result, expression, components

def result_row(metadata: dict[str, Any], source: float | None, view: float | None,
               common: float | None, formula: float | None, calculation: str,
               formula_reference: str, tolerance_percent: float = 5.0) -> dict[str, Any]:
    displayed_values = [rounded(value, 2) for value in (source, view, common, formula)]
    present = [value for value in displayed_values if value is not None]
    maximum_difference = rounded(max(present) - min(present), 2) if present else None
    source_value = displayed_values[0]
    absolute_differences = [
        abs(value - source_value)
        if source_value is not None and value is not None else None
        for value in displayed_values[1:]
    ]
    if source_value == 0:
        percentage_differences = [
            0.0 if difference == 0 else None for difference in absolute_differences
        ]
        within_tolerance = all(difference == 0 for difference in absolute_differences)
    elif source_value is not None:
        percentage_differences = [
            rounded((difference / abs(source_value)) * 100, 4)
            if difference is not None else None
            for difference in absolute_differences
        ]
        within_tolerance = all(
            difference is not None and difference <= tolerance_percent
            for difference in percentage_differences
        )
    else:
        percentage_differences = [None, None, None]
        within_tolerance = False
    valid_percentages = [value for value in percentage_differences if value is not None]
    maximum_difference_percent = max(valid_percentages) if valid_percentages else None
    status = "PASS" if len(present) == 4 and within_tolerance else "FAIL"
    return {
        **metadata, "Source TLC": displayed_values[0], "View TLC": displayed_values[1],
        "Common Component TLC": displayed_values[2], "Detail Formula TLC": displayed_values[3],
        "View - Source": rounded((displayed_values[1] - displayed_values[0]), 2) if displayed_values[0] is not None and displayed_values[1] is not None else None,
        "Common - Source": rounded((displayed_values[2] - displayed_values[0]), 2) if displayed_values[0] is not None and displayed_values[2] is not None else None,
        "Formula - Source": rounded((displayed_values[3] - displayed_values[0]), 2) if displayed_values[0] is not None and displayed_values[3] is not None else None,
        "Maximum Difference": maximum_difference,
        "View Difference %": percentage_differences[0],
        "Common Difference %": percentage_differences[1],
        "Formula Difference %": percentage_differences[2],
        "Maximum Difference %": maximum_difference_percent,
        "Tolerance % Rule": tolerance_percent, "Status": status,
        "Calculation": calculation, "Formula Reference": formula_reference,
    }


def supplier_rows(entries: list[dict[str, Any]], destination_filter: str | None, year_filter: int | None, mapper, tolerance_percent: float = 5.0) -> list[dict[str, Any]]:
    output = []
    seen = set()
    for entry in entries:
        destination = str(entry.get("destination", ""))
        year = int(entry.get("year") or 0)
        if destination_filter and destination.casefold() != destination_filter.casefold():
            continue
        if year_filter is not None and year != year_filter:
            continue
        supplier = str(entry.get("supplier") or entry.get("supplierName") or "Unknown")
        display_supplier = str(entry.get("supplierName") or supplier)
        location = str(entry.get("location") or destination)
        month = str(entry.get("month", ""))
        data_type = str(entry.get("dataType", ""))
        key = (destination, display_supplier, location, year, month, data_type)
        if key in seen:
            continue
        seen.add(key)
        rows = entry.get("rows", [])
        source, formula_reference = source_tlc(rows)
        if source is None:
            continue
        normalized_supplier = supplier.strip().casefold()
        if normalized_supplier == "valgroup":
            formula, calculation, components = valgroup_formula(rows)
        elif normalized_supplier == "cristalpet" and destination.casefold() == "brazil":
            formula, calculation, components = cristalpet_formula(rows)
        elif destination.casefold() == "bolivia":
            formula, calculation, components = bolivia_formula(rows)
        elif normalized_supplier == "cristalpet" and destination.casefold() == "uruguay":
            formula, calculation, components = uruguay_cristalpet_formula(rows)
        else:
            components, terms = component_values(rows, mapper)
            formula = sum(components.values())
            calculation = " + ".join(terms) + f" = {formula:.6f}"
        common = sum(components.values()) if components else None
        # HomePage converts Supplier TLC using Number(fromApi.toFixed(1)).
        view = rounded(source, 1)
        output.append(result_row({
            "Data Set": "Supplier", "Destination": destination,
            "Supplier / MR Source": display_supplier, "Location": location,
            "Year": year, "Month": month, "Data Type": data_type,
        }, source, view, common, formula, calculation, formula_reference, tolerance_percent))
    return output


def market_rows(destination_filter: str | None, year_filter: int | None, mapper, tolerance_percent: float = 5.0) -> list[dict[str, Any]]:
    from market_research_data_model import available_destinations, available_periods_for_destination, build_market_research_countries
    output = []
    destinations = available_destinations()
    if destination_filter:
        destinations = [item for item in destinations if item.casefold() == destination_filter.casefold()]
    for destination in destinations:
        for month, year_value in available_periods_for_destination(destination):
            year = int(year_value)
            if year_filter is not None and year != year_filter:
                continue
            for country in build_market_research_countries(destination, month, str(year)):
                rows = country.get("breakdown", [])
                source = next((number(row.get("amount")) for row in rows if "total landed cost" in str(row.get("label", "")).casefold()), None)
                if source is None:
                    source = number(country.get("amount"))
                if source is None:
                    continue
                components, terms = component_values(rows, mapper)
                common = sum(components.values()) if components else None
                formula = common
                calculation = " + ".join(terms) + (f" = {formula:.6f}" if formula is not None else "")
                formula_reference = next((str(row.get("formulaReference") or "") for row in rows if "total landed cost" in str(row.get("label", "")).casefold()), "")
                output.append(result_row({
                    "Data Set": "Market Research", "Destination": destination,
                    "Supplier / MR Source": str(country.get("country", "")), "Location": "",
                    "Year": year, "Month": month, "Data Type": str(country.get("dataType", "")),
                }, source, source, common, formula, calculation, formula_reference, tolerance_percent))
    return output


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
    summary.append(["Data Set", "Rows Checked", "Passed", "Failed", "Maximum Difference", "Maximum Difference %", "Tolerance % Rule"])
    for data_set in ("Supplier", "Market Research"):
        selected = [row for row in rows if row["Data Set"] == data_set]
        summary.append([data_set, len(selected), sum(row["Status"] == "PASS" for row in selected),
                        sum(row["Status"] == "FAIL" for row in selected),
                        max((row["Maximum Difference"] or 0 for row in selected), default=0),
                        max((row["Maximum Difference %"] or 0 for row in selected), default=0),
                        selected[0]["Tolerance % Rule"] if selected else None])
    summary.append(["TOTAL", len(rows), sum(row["Status"] == "PASS" for row in rows),
                    sum(row["Status"] == "FAIL" for row in rows),
                    max((row["Maximum Difference"] or 0 for row in rows), default=0),
                    max((row["Maximum Difference %"] or 0 for row in rows), default=0),
                    rows[0]["Tolerance % Rule"] if rows else None])

    def add_sheet(name: str, selected: list[dict[str, Any]]) -> None:
        sheet = workbook.create_sheet(name)
        sheet.append(COLUMNS)
        for row in selected:
            sheet.append([row.get(column) for column in COLUMNS])
            status_cell = sheet.cell(sheet.max_row, COLUMNS.index("Status") + 1)
            status_cell.fill = green if status_cell.value == "PASS" else red
            status_cell.font = Font(bold=True)
            for column in range(COLUMNS.index("Source TLC") + 1, COLUMNS.index("Maximum Difference") + 2):
                sheet.cell(sheet.max_row, column).number_format = '#,##0.00'
        sheet.freeze_panes = "H2"
        sheet.auto_filter.ref = sheet.dimensions
        widths = [18, 22, 34, 22, 9, 12, 12, 16, 16, 23, 22, 16, 17, 17, 19, 11, 95, 95]
        for index, width in enumerate(widths, 1):
            sheet.column_dimensions[get_column_letter(index)].width = width
    add_sheet("Supplier Validation", [row for row in rows if row["Data Set"] == "Supplier"])
    add_sheet("Market Validation", [row for row in rows if row["Data Set"] == "Market Research"])
    add_sheet("Mismatches", [row for row in rows if row["Status"] == "FAIL"])
    for sheet in workbook.worksheets:
        for cell in sheet[1]:
            cell.fill = blue; cell.font = Font(color="FFFFFF", bold=True); cell.alignment = Alignment(horizontal="center")
        sheet.freeze_panes = sheet.freeze_panes or "A2"; sheet.auto_filter.ref = sheet.dimensions
    workbook.save(output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Source/View/Common/Detail-formula TLC consistency.")
    parser.add_argument("--destination", help="Validate one destination")
    parser.add_argument("--year", type=int, help="Validate one year")
    parser.add_argument("--output-excel", type=Path)
    parser.add_argument("--tolerance-percent", type=float, default=5.0,
                        help="Maximum allowed difference from Source TLC (default: 5%%)")
    args = parser.parse_args()
    output = args.output_excel or Path(f"tlc_source_view_formula_{datetime.now():%Y%m%d_%H%M%S}.xlsx")
    sys.path.insert(0, str(BACKEND_DIR)); sys.path.insert(0, str(TEST_DIR))
    try:
        from supplier_data_model import build_vendor_breakdowns
        from validate_tlc_breakdown import map_market_row, map_supplier_row
        rows = supplier_rows(build_vendor_breakdowns(("China",)), args.destination, args.year, map_supplier_row, args.tolerance_percent)
        rows.extend(market_rows(args.destination, args.year, map_market_row, args.tolerance_percent))
        if not rows:
            print("ERROR: No TLC rows matched the filters.", file=sys.stderr); return 2
        rows.sort(key=lambda row: (row["Data Set"], row["Destination"], row["Year"], MONTHS.index(row["Month"]) if row["Month"] in MONTHS else 99, row["Supplier / MR Source"]))
        write_excel(rows, output)
    except (OSError, ValueError, ImportError, StopIteration) as exc:
        print(f"ERROR: {exc}", file=sys.stderr); return 2
    failures = sum(row["Status"] == "FAIL" for row in rows)
    print(f"Rows checked: {len(rows)} | Passed: {len(rows)-failures} | Failed: {failures}")
    print(f"Excel report: {output.resolve()}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
