"""Validate stored Supplier and Market resin-index values after applying lags.

The Excel output contains separate ``Suppliers`` and ``Market`` result sheets.
Expected values come from the forecast model's ``Historical Data Used`` and
``All Markets Forecast`` sheets, with the approved ICIS China and Uruguay IHS
Sep-Dec 2026 forecast overrides applied.

Run from PET_Resin_Cost:
    python testing_scripts/validate_resin_index_lags.py --year 2026
    python testing_scripts/validate_resin_index_lags.py --year 2026 --tolerance 0.01
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from refresh_september_october_2026 import (
    DEFAULT_ASIA_SE_HISTORY,
    DEFAULT_CHINA_FORECAST,
    DEFAULT_HISTORY,
    parse_actual_curves,
    parse_china_forecast,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
SUPPLIER_MODEL = (
    PROJECT_ROOT / "data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.xlsx"
)
MARKET_MODEL = (
    PROJECT_ROOT
    / "data/processed/current/market_research/Data_Standardized_MR_Front_End_Data_Model.xlsx"
)
DEFAULT_REFERENCE = (
    WORKSPACE_ROOT
    / "PET_Files_DB/September/Resin_Index_Custom_Forecast_Sep_Dec_2026.xlsx"
)
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "resin_index_lag_validation.xlsx"
MONTH_NAMES = (
    "",
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
)

APPROVED_IHS_FORECAST = {
    (2026, 8): 1051.00,
    (2026, 9): 1060.00,
    (2026, 10): 1015.00,
    (2026, 11): 992.00,
    (2026, 12): 973.00,
}

DESTINATION_LAGS = {
    "Argentina": 2,
    "Bolivia": 1,
    "Brazil": 1,
    "Colombia": 2,
    "Dominican Republic": 2,
    "Ecuador": 2,
    "El Salvador": 3,
    "El Salvador and Honduras": 3,
    "Honduras": 3,
    "Panama": 2,
    "Peru": 2,
    "Uruguay": 1,
}


@dataclass(frozen=True)
class SupplierRule:
    destination: str
    supplier: str
    reference_series: str
    raw_label: str


SUPPLIER_RULES = (
    SupplierRule("Argentina", "Amcor", "China", "FOB Price"),
    SupplierRule(
        "Bolivia",
        "Gestora, Administradora e Industrializadora Preformas S.A.",
        "China",
        "ICIS N-1",
    ),
    SupplierRule("Brazil", "Amcor", "China", "ICIS China mid (M-1)"),
    SupplierRule("Brazil", "Cristalpet", "China", "ICIS PET China MID (M-1)"),
    SupplierRule("Brazil", "Engepack", "China", "ICIS China (M-1)"),
    SupplierRule("Brazil", "Valgroup", "Asia SE Low", "ICIS Asia SE Low (n-1)"),
    SupplierRule("Colombia", "Amcor", "China", "Resin Price Index"),
    SupplierRule("Dominican Republic", "SMI PET", "Asia SE Low", "FOB Price"),
    SupplierRule("Ecuador", "Amcor", "China", "ICIS China Mid (n-2)"),
    SupplierRule(
        "El Salvador and Honduras",
        "Amcor",
        "China",
        "PET Bottle Grade FOB China Mid (N-4)",
    ),
    SupplierRule("Panama", "Pastiglas S.A", "Asia SE Low", "FOB Price"),
    SupplierRule("Peru", "Pastiglas S.A", "Asia SE Low", "FOB Price"),
    SupplierRule("Uruguay", "Cristalpet", "IHS", "Resina FOB Asia"),
)
SUPPLIER_RULE_BY_KEY = {
    (rule.destination.casefold(), rule.supplier.casefold()): rule for rule in SUPPLIER_RULES
}

MARKET_SOURCE_SERIES = {
    "China": "China",
    "India": "India",
    "Indonesia": "Asia SE Low",
    "Mexico": "Mexico",
    "South Korea": "South Korea",
    "Taiwan": "Taiwan",
    "Thailand": "Asia SE Low",
    "Vietnam": "Asia SE Low",
    "Argentina": "Global ICIS",
    "Brazil": "Global ICIS",
    "USA": "Global ICIS",
}
GLOBAL_SERIES = (
    "Asia SE Low",
    "China",
    "India",
    "Mexico",
    "South Korea",
    "Taiwan",
)

RESULT_COLUMNS = [
    "Destination Country",
    "Supplier / Source Country",
    "Location",
    "TLC Year",
    "TLC Month",
    "Data Type",
    "Configured Lag",
    "Expected Index Period",
    "Reference Series",
    "Stored Resin Index",
    "Expected Resin Index",
    "Difference",
    "Absolute Difference",
    "Tolerance",
    "Status",
    "Resin Index Type",
    "Forecast Resin Index Type",
    "Raw Cost Breakdown",
    "Reference Basis",
]


def clean(value: Any) -> str:
    return "" if value is None else str(value).replace("\xa0", " ").strip()


def number(value: Any) -> float | None:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(clean(value).replace(",", ""))
    except ValueError:
        return None


def lagged_period(year: int, month: int, lag: int) -> tuple[int, int]:
    serial = year * 12 + month - 1 - lag
    return serial // 12, serial % 12 + 1


def period_text(period: tuple[int, int]) -> str:
    year, month = period
    return f"{MONTH_NAMES[month]} {year}"


def load_reference_curves(
    path: Path,
    history_path: Path,
    asia_se_history_path: Path,
    china_forecast_path: Path,
) -> dict[str, dict[tuple[int, int], float]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    required_sheets = {"Historical Data Used", "All Markets Forecast"}
    missing = required_sheets - set(workbook.sheetnames)
    if missing:
        workbook.close()
        raise ValueError(f"Reference workbook is missing sheets: {sorted(missing)}")

    curves: dict[str, dict[tuple[int, int], float]] = defaultdict(dict)
    for market, period, value, *_ in workbook["Historical Data Used"].iter_rows(
        min_row=2, values_only=True
    ):
        parsed = number(value)
        if market and isinstance(period, datetime) and parsed is not None:
            curves[clean(market)][(period.year, period.month)] = parsed
    for market, period, value, *_ in workbook["All Markets Forecast"].iter_rows(
        min_row=2, values_only=True
    ):
        parsed = number(value)
        if market and isinstance(period, datetime) and parsed is not None:
            curves[clean(market)][(period.year, period.month)] = parsed
    workbook.close()

    curves["China"].update(parse_china_forecast(china_forecast_path))
    # Actual history takes precedence where the forecast export also contains
    # an overlapping in-month estimate (for example September 2026).
    for series, values in parse_actual_curves(history_path, asia_se_history_path).items():
        curves[series].update(values)
    curves["IHS"].update(APPROVED_IHS_FORECAST)
    return dict(curves)


def expected_value(
    curves: dict[str, dict[tuple[int, int], float]],
    series: str,
    period: tuple[int, int],
) -> tuple[float | None, str]:
    if series != "Global ICIS":
        return curves.get(series, {}).get(period), "Historical Data Used / All Markets Forecast"
    inputs = [curves.get(input_series, {}).get(period) for input_series in GLOBAL_SERIES]
    if any(value is None for value in inputs):
        return None, "Global ICIS input missing"
    return sum(value for value in inputs if value is not None) / len(inputs), (
        "Average of Asia SE Low, China, India, Mexico, South Korea and Taiwan"
    )


def result_row(
    *,
    row: dict[str, Any],
    destination: str,
    entity: str,
    location: str,
    year: int,
    month: int,
    lag: int,
    series: str,
    expected: float | None,
    basis: str,
    tolerance: float,
) -> dict[str, Any]:
    stored = number(row.get("Value"))
    difference = stored - expected if stored is not None and expected is not None else None
    absolute = abs(difference) if difference is not None else None
    if stored is None:
        status = "MISSING STORED VALUE"
    elif expected is None:
        status = "NO REFERENCE"
    else:
        status = "PASS" if absolute is not None and absolute <= tolerance else "FAIL"
    return {
        "Destination Country": destination,
        "Supplier / Source Country": entity,
        "Location": location,
        "TLC Year": year,
        "TLC Month": MONTH_NAMES[month],
        "Data Type": clean(row.get("Data Type")),
        "Configured Lag": f"M-{lag}",
        "Expected Index Period": period_text(lagged_period(year, month, lag)),
        "Reference Series": series,
        "Stored Resin Index": stored,
        "Expected Resin Index": expected,
        "Difference": difference,
        "Absolute Difference": absolute,
        "Tolerance": tolerance,
        "Status": status,
        "Resin Index Type": clean(row.get("Resin Index Type")),
        "Forecast Resin Index Type": clean(row.get("Forecast Resin Index Type")),
        "Raw Cost Breakdown": clean(row.get("Raw Cost Breakdown")),
        "Reference Basis": basis,
    }


def read_rows(path: Path) -> list[dict[str, Any]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook["front_end_data_model"]
    values = sheet.iter_rows(values_only=True)
    headers = [clean(value) for value in next(values)]
    rows = [dict(zip(headers, row)) for row in values if any(value is not None for value in row)]
    workbook.close()
    return rows


def validate_suppliers(
    rows: list[dict[str, Any]],
    curves: dict[str, dict[tuple[int, int], float]],
    year_filter: int | None,
    tolerance: float,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for row in rows:
        destination = clean(row.get("Destination Country"))
        supplier = clean(row.get("Supplier Name"))
        rule = SUPPLIER_RULE_BY_KEY.get((destination.casefold(), supplier.casefold()))
        if rule is None:
            continue
        raw_label = clean(row.get("Raw Cost Breakdown"))
        if raw_label.casefold() != rule.raw_label.casefold():
            continue
        year_value = number(row.get("Time Period Year"))
        month_value = number(row.get("Time Period Month"))
        if year_value is None or month_value is None:
            continue
        year, month = int(year_value), int(month_value)
        if year_filter is not None and year != year_filter:
            continue
        lag = DESTINATION_LAGS[destination]
        index_period = lagged_period(year, month, lag)
        expected, basis = expected_value(curves, rule.reference_series, index_period)
        results.append(
            result_row(
                row=row,
                destination=destination,
                entity=supplier,
                location=clean(row.get("Location")),
                year=year,
                month=month,
                lag=lag,
                series=rule.reference_series,
                expected=expected,
                basis=basis,
                tolerance=tolerance,
            )
        )
    return sorted(
        results,
        key=lambda item: (
            item["Destination Country"],
            item["Supplier / Source Country"],
            item["Location"],
            item["TLC Year"],
            MONTH_NAMES.index(item["TLC Month"]),
        ),
    )


def validate_market(
    rows: list[dict[str, Any]],
    curves: dict[str, dict[tuple[int, int], float]],
    year_filter: int | None,
    tolerance: float,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for row in rows:
        if clean(row.get("Mapping Columns")).casefold() != "resin index vpet":
            continue
        destination = clean(row.get("Destination Country"))
        source = clean(row.get("Supplier Name"))
        series = MARKET_SOURCE_SERIES.get(source)
        if destination not in DESTINATION_LAGS or series is None:
            continue
        year_value = number(row.get("Time Period Year"))
        month_value = number(row.get("Time Period Month"))
        if year_value is None or month_value is None:
            continue
        year, month = int(year_value), int(month_value)
        if year_filter is not None and year != year_filter:
            continue
        lag = DESTINATION_LAGS[destination]
        index_period = lagged_period(year, month, lag)
        expected, basis = expected_value(curves, series, index_period)
        results.append(
            result_row(
                row=row,
                destination=destination,
                entity=source,
                location=clean(row.get("Location")),
                year=year,
                month=month,
                lag=lag,
                series=series,
                expected=expected,
                basis=basis,
                tolerance=tolerance,
            )
        )
    return sorted(
        results,
        key=lambda item: (
            item["Destination Country"],
            item["Supplier / Source Country"],
            item["TLC Year"],
            MONTH_NAMES.index(item["TLC Month"]),
        ),
    )


def add_results_sheet(workbook: Workbook, title: str, rows: list[dict[str, Any]]) -> None:
    sheet = workbook.create_sheet(title)
    sheet.append(RESULT_COLUMNS)
    for result in rows:
        sheet.append([result.get(column) for column in RESULT_COLUMNS])
    blue = PatternFill("solid", fgColor="1F4E78")
    green = PatternFill("solid", fgColor="C6EFCE")
    red = PatternFill("solid", fgColor="FFC7CE")
    yellow = PatternFill("solid", fgColor="FFF2CC")
    for cell in sheet[1]:
        cell.fill = blue
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    status_column = RESULT_COLUMNS.index("Status") + 1
    for row in range(2, sheet.max_row + 1):
        status = sheet.cell(row, status_column).value
        fill = green if status == "PASS" else red if status == "FAIL" else yellow
        sheet.cell(row, status_column).fill = fill
        sheet.cell(row, status_column).font = Font(bold=True)
        for column in range(10, 15):
            sheet.cell(row, column).number_format = '#,##0.00'
    widths = [24, 42, 20, 10, 14, 12, 16, 22, 20, 19, 20, 16, 20, 14, 22, 38, 42, 40, 68]
    for index, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions


def write_report(
    output: Path,
    supplier_results: list[dict[str, Any]],
    market_results: list[dict[str, Any]],
    curves: dict[str, dict[tuple[int, int], float]],
    reference_path: Path,
    year_filter: int | None,
    tolerance: float,
) -> None:
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    summary.append(["Data Set", "Checked", "Passed", "Failed", "No Reference", "Other", "Overall"])
    for title, rows in (("Suppliers", supplier_results), ("Market", market_results)):
        counts = Counter(row["Status"] for row in rows)
        failures = counts["FAIL"] + counts["MISSING STORED VALUE"]
        overall = "PASS" if rows and failures == 0 and counts["NO REFERENCE"] == 0 else "FAIL"
        summary.append(
            [
                title,
                len(rows),
                counts["PASS"],
                counts["FAIL"],
                counts["NO REFERENCE"],
                counts["MISSING STORED VALUE"],
                overall,
            ]
        )
    summary.append([])
    summary.append(["Setting", "Value"])
    summary.append(["Year filter", year_filter if year_filter is not None else "All years"])
    summary.append(["Absolute tolerance", tolerance])
    summary.append(["Reference workbook", str(reference_path)])
    summary.append(["China forecast source", str(DEFAULT_CHINA_FORECAST)])
    summary.append(["Uruguay IHS rule", "M-1; Aug 1051; Sep 1060; Oct 1015; Nov 992; Dec 973"])
    summary.append(["Global ICIS formula", "Average of Asia SE Low, China, India, Mexico, South Korea and Taiwan"])
    summary.append(["PASS rule", "Absolute difference <= tolerance"])

    add_results_sheet(workbook, "Suppliers", supplier_results)
    add_results_sheet(workbook, "Market", market_results)

    references = workbook.create_sheet("Reference Inputs")
    references.append(["Reference Series", "Index Year", "Index Month", "Index Period", "Value"])
    relevant_years = None if year_filter is None else {year_filter - 1, year_filter}
    for series in sorted(curves):
        for (year, month), value in sorted(curves[series].items()):
            if relevant_years is not None and year not in relevant_years:
                continue
            references.append([series, year, month, period_text((year, month)), value])

    blue = PatternFill("solid", fgColor="1F4E78")
    for sheet in (summary, references):
        for cell in sheet[1]:
            cell.fill = blue
            cell.font = Font(color="FFFFFF", bold=True)
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
    summary.column_dimensions["A"].width = 30
    summary.column_dimensions["B"].width = 105
    for column in range(3, 8):
        summary.column_dimensions[get_column_letter(column)].width = 16
    for index, width in enumerate([22, 12, 12, 20, 18], 1):
        references.column_dimensions[get_column_letter(index)].width = width
    for row in range(2, references.max_row + 1):
        references.cell(row, 5).number_format = '#,##0.00'
    output.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate resin-index values against configured lags")
    parser.add_argument("--year", type=int, default=2026, help="TLC year to validate; default: 2026")
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.50,
        help="Allowed absolute index difference; default: 0.50",
    )
    parser.add_argument("--supplier-model", type=Path, default=SUPPLIER_MODEL)
    parser.add_argument("--market-model", type=Path, default=MARKET_MODEL)
    parser.add_argument("--reference-workbook", type=Path, default=DEFAULT_REFERENCE)
    parser.add_argument("--history", type=Path, default=DEFAULT_HISTORY)
    parser.add_argument("--asia-se-history", type=Path, default=DEFAULT_ASIA_SE_HISTORY)
    parser.add_argument("--china-forecast", type=Path, default=DEFAULT_CHINA_FORECAST)
    parser.add_argument("--start-month", type=int, default=1, choices=range(1, 13))
    parser.add_argument("--end-month", type=int, default=12, choices=range(1, 13))
    parser.add_argument("--output-excel", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if args.start_month > args.end_month:
        print("ERROR: --start-month cannot be greater than --end-month", file=sys.stderr)
        return 2
    for path in (
        args.supplier_model,
        args.market_model,
        args.reference_workbook,
        args.history,
        args.asia_se_history,
        args.china_forecast,
    ):
        if not path.is_file():
            print(f"ERROR: Input not found: {path}", file=sys.stderr)
            return 2
    if args.tolerance < 0:
        print("ERROR: tolerance must be non-negative", file=sys.stderr)
        return 2
    try:
        curves = load_reference_curves(
            args.reference_workbook,
            args.history,
            args.asia_se_history,
            args.china_forecast,
        )
        supplier_results = validate_suppliers(
            read_rows(args.supplier_model), curves, args.year, args.tolerance
        )
        market_results = validate_market(
            read_rows(args.market_model), curves, args.year, args.tolerance
        )
        selected_months = set(MONTH_NAMES[args.start_month : args.end_month + 1])
        supplier_results = [
            row for row in supplier_results if row["TLC Month"] in selected_months
        ]
        market_results = [
            row for row in market_results if row["TLC Month"] in selected_months
        ]
        write_report(
            args.output_excel,
            supplier_results,
            market_results,
            curves,
            args.reference_workbook,
            args.year,
            args.tolerance,
        )
    except (OSError, ValueError, KeyError, StopIteration) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    supplier_counts = Counter(row["Status"] for row in supplier_results)
    market_counts = Counter(row["Status"] for row in market_results)
    print(
        f"Suppliers: {len(supplier_results)} checked | "
        f"PASS {supplier_counts['PASS']} | FAIL {supplier_counts['FAIL']} | "
        f"NO REFERENCE {supplier_counts['NO REFERENCE']}"
    )
    print(
        f"Market: {len(market_results)} checked | "
        f"PASS {market_counts['PASS']} | FAIL {market_counts['FAIL']} | "
        f"NO REFERENCE {market_counts['NO REFERENCE']}"
    )
    print(f"Excel report: {args.output_excel.resolve()}")
    failures = supplier_counts["FAIL"] + market_counts["FAIL"]
    missing = supplier_counts["NO REFERENCE"] + market_counts["NO REFERENCE"]
    return 1 if failures or missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
