"""Refresh September/October 2026 resin-driven TLCs in both frontend models.

Business rules implemented here:

* September and October 2026 output rows replace Forecast with Actual.
* Supplier non-resin components use the latest previous Actual values.
* Market freight/local-transport inputs remain unchanged.
* Destination-specific M-1/M-2/M-3 lags are applied to every resin series.
* November/December remain Forecast; the new China forecast is applied with lag.
* Global ICIS is the average of Asia SE Low, China, India, Mexico,
  South Korea and Taiwan.
* Uruguay supplier resin/TLC values remain unchanged.

Both XLSX models and their CSV mirrors are backed up and refreshed together.
An audit workbook records every affected supplier and market scenario.
"""
from __future__ import annotations

import argparse
import csv
import re
import shutil
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import pandas as pd
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipelines.market_research.tlc_model.build_market_research_front_end_data_model import (  # noqa: E402
    DEFAULT_COMPONENTS,
    calculate_components,
    extract_tax_references,
)


SUPPLIER_MODEL = (
    PROJECT_ROOT / "data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.xlsx"
)
MARKET_MODEL = (
    PROJECT_ROOT
    / "data/processed/current/market_research/Data_Standardized_MR_Front_End_Data_Model.xlsx"
)
RAW_MARKET_MODEL = (
    PROJECT_ROOT / "data/raw/market_research/PET Resin Total landed cost calculator.xlsx"
)
DEFAULT_HISTORY = (
    WORKSPACE_ROOT
    / "PET_Files_DB/September/ICIS Dashboard Price History 2026-10-14 212143.xls"
)
DEFAULT_ASIA_SE_HISTORY = (
    WORKSPACE_ROOT
    / "PET_Files_DB/September/ICIS Dashboard Price History 2026-10-19 161036.xls"
)
DEFAULT_CHINA_FORECAST = (
    WORKSPACE_ROOT
    / "PET_Files_DB/September/ICIS Dashboard Price Forecast 2026-10-14 212157.xls"
)
DEFAULT_AUDIT = (
    WORKSPACE_ROOT / "PET_Files_DB/September/Resin_Index_Refresh_Sep_Oct_2026_Audit.xlsx"
)
SHEET_NAME = "front_end_data_model"
MONTHS = (
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

SUPPLIER_RULES = {
    ("Argentina", "Amcor"): ("China", "simple"),
    (
        "Bolivia",
        "Gestora, Administradora e Industrializadora Preformas S.A.",
    ): ("China", "bolivia"),
    ("Brazil", "Amcor"): ("China", "brazil_amcor"),
    ("Brazil", "Cristalpet"): ("China", "cristalpet"),
    ("Brazil", "Engepack"): ("China", "engepack"),
    ("Brazil", "Valgroup"): ("Asia SE Low", "valgroup"),
    ("Colombia", "Amcor"): ("China", "colombia"),
    ("Dominican Republic", "SMI PET"): ("Asia SE Low", "simple"),
    ("Ecuador", "Amcor"): ("China", "ecuador"),
    ("El Salvador and Honduras", "Amcor"): ("China", "esh"),
    ("Panama", "Pastiglas S.A"): ("Asia SE Low", "simple"),
    ("Peru", "Pastiglas S.A"): ("Asia SE Low", "simple"),
    ("Uruguay", "Cristalpet"): ("IHS", "uruguay_unchanged"),
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
GLOBAL_SOURCES = {"Argentina", "Brazil", "USA"}
GLOBAL_INPUT_SOURCES = (
    ("Asia SE Low", "Indonesia"),
    ("China", "China"),
    ("India", "India"),
    ("Mexico", "Mexico"),
    ("South Korea", "South Korea"),
    ("Taiwan", "Taiwan"),
)


def clean(value: Any) -> str:
    return "" if value is None else str(value).replace("\xa0", " ").strip()


def normalized(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", clean(value).casefold()).strip()


def label_key(value: Any) -> str:
    """Case-insensitive raw-label key that preserves meaningful symbols such as $."""
    return clean(value).casefold()


def number(value: Any, default: float | None = None) -> float | None:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(clean(value).replace(",", ""))
    except ValueError:
        return default


def lagged_period(year: int, month: int, lag: int) -> tuple[int, int]:
    serial = year * 12 + month - 1 - lag
    return serial // 12, serial % 12 + 1


def period_text(period: tuple[int, int]) -> str:
    year, month = period
    return f"{MONTHS[month]} {year}"


def parse_period(value: Any) -> tuple[int, int] | None:
    text = clean(value)
    match = re.fullmatch(r"([A-Za-z]{3})-(\d{4})", text)
    if not match:
        return None
    try:
        parsed = datetime.strptime(text, "%b-%Y")
    except ValueError:
        return None
    return parsed.year, parsed.month


def parse_actual_curves(history: Path, asia_se_history: Path) -> dict[str, dict[tuple[int, int], float]]:
    frame = pd.read_excel(history, header=None)
    header_row = next(
        row
        for row in range(len(frame))
        if "FOB China" in clean(frame.iloc[row, 3] if frame.shape[1] > 3 else "")
    )
    series_by_column: dict[int, str] = {}
    for column in range(frame.shape[1]):
        label = clean(frame.iloc[header_row, column])
        if "FOB China" in label:
            series_by_column[column] = "China"
        elif "FOB India" in label:
            series_by_column[column] = "India"
        elif "FOB Mexico" in label:
            series_by_column[column] = "Mexico"
        elif "FOB South Korea" in label:
            series_by_column[column] = "South Korea"
        elif "FOB Taiwan" in label:
            series_by_column[column] = "Taiwan"

    curves: dict[str, dict[tuple[int, int], float]] = defaultdict(dict)
    for row in range(header_row + 1, len(frame)):
        period = parse_period(frame.iloc[row, 1] if frame.shape[1] > 1 else None)
        if period is None:
            continue
        for column, series in series_by_column.items():
            parsed = number(frame.iloc[row, column])
            if parsed is not None:
                curves[series][period] = parsed

    asia_frame = pd.read_excel(asia_se_history, header=None)
    asia_header = next(
        row
        for row in range(len(asia_frame))
        if "Asia SE" in clean(asia_frame.iloc[row, 2] if asia_frame.shape[1] > 2 else "")
        and "(Low)" in clean(asia_frame.iloc[row, 2])
    )
    for row in range(asia_header + 1, len(asia_frame)):
        period = parse_period(asia_frame.iloc[row, 1])
        parsed = number(asia_frame.iloc[row, 2])
        if period is not None and parsed is not None:
            curves["Asia SE Low"][period] = parsed

    required = {"China", "India", "Mexico", "South Korea", "Taiwan", "Asia SE Low"}
    missing = required - set(curves)
    if missing:
        raise ValueError(f"Missing actual series in ICIS files: {sorted(missing)}")
    for series in required:
        if (2026, 9) not in curves[series]:
            raise ValueError(f"{series} does not contain September 2026 actual")
    return dict(curves)


def parse_china_forecast(path: Path) -> dict[tuple[int, int], float]:
    frame = pd.read_excel(path, header=None)
    curve: dict[tuple[int, int], float] = {}
    for row in range(len(frame)):
        date_value = frame.iloc[row, 1] if frame.shape[1] > 1 else None
        parsed_date = pd.to_datetime(date_value, errors="coerce")
        amount = number(frame.iloc[row, 2] if frame.shape[1] > 2 else None)
        if pd.isna(parsed_date) or amount is None:
            continue
        timestamp = parsed_date.to_pydatetime()
        if timestamp.day == 1:
            curve[(timestamp.year, timestamp.month)] = amount
    required = {(2026, 10), (2026, 11), (2026, 12)}
    if missing := required - set(curve):
        raise ValueError(f"China forecast is missing periods: {sorted(missing)}")
    return curve


def export_csv(sheet: Any, output: Path) -> None:
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        csv.writer(handle).writerows(sheet.iter_rows(values_only=True))


def backup_model(path: Path, timestamp: str) -> tuple[Path, Path | None]:
    backup = path.with_name(
        f"{path.stem}.backup_before_sep_oct_actual_{timestamp}{path.suffix}"
    )
    shutil.copy2(path, backup)
    csv_path = path.with_suffix(".csv")
    csv_backup: Path | None = None
    if csv_path.exists():
        csv_backup = csv_path.with_name(
            f"{csv_path.stem}.backup_before_sep_oct_actual_{timestamp}{csv_path.suffix}"
        )
        shutil.copy2(csv_path, csv_backup)
    return backup, csv_backup


def worksheet_access(sheet: Any) -> tuple[dict[str, int], Callable[[int, str], Any]]:
    headers = {clean(cell.value): index for index, cell in enumerate(sheet[1], 1)}
    required = {
        "Data Type",
        "Source File",
        "Supplier Name",
        "Destination Country",
        "Time_Period",
        "Time Period Year",
        "Time Period Month",
        "Location",
        "Raw Cost Breakdown",
        "Mapping Columns",
        "Column Required for Calculation",
        "Value",
    }
    if missing := required - set(headers):
        raise ValueError(f"Missing model columns: {sorted(missing)}")
    return headers, lambda row, column: sheet.cell(row, headers[column]).value


def rows_by_label(sheet: Any, headers: dict[str, int], rows: list[int]) -> dict[str, list[int]]:
    labels: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        label = label_key(sheet.cell(row, headers["Raw Cost Breakdown"]).value)
        if label:
            labels[label].append(row)
    return dict(labels)


def get_amount(
    sheet: Any,
    headers: dict[str, int],
    labels: dict[str, list[int]],
    label: str,
    default: float = 0.0,
) -> float:
    matches = labels.get(label_key(label), [])
    if not matches:
        return default
    return number(sheet.cell(matches[0], headers["Value"]).value, default) or 0.0


def set_amount(
    sheet: Any,
    headers: dict[str, int],
    labels: dict[str, list[int]],
    label: str,
    amount: float,
) -> None:
    matches = labels.get(label_key(label), [])
    if not matches:
        raise ValueError(f"Missing supplier component {label!r}")
    for row in matches:
        sheet.cell(row, headers["Value"], amount)


def copy_non_resin_values(
    sheet: Any,
    headers: dict[str, int],
    value: Callable[[int, str], Any],
    source_rows: list[int],
    target_rows: list[int],
) -> None:
    source_values: dict[str, list[Any]] = defaultdict(list)
    for row in source_rows:
        mapping = normalized(value(row, "Mapping Columns"))
        if mapping in {"resin index vpet", "index", "seguro", "total landing cost"}:
            continue
        label = label_key(value(row, "Raw Cost Breakdown"))
        if label:
            source_values[label].append(value(row, "Value"))

    target_occurrence: dict[str, int] = defaultdict(int)
    for row in target_rows:
        mapping = normalized(value(row, "Mapping Columns"))
        if mapping in {"resin index vpet", "index", "seguro", "total landing cost"}:
            continue
        label = label_key(value(row, "Raw Cost Breakdown"))
        choices = source_values.get(label)
        if not label or not choices:
            continue
        occurrence = target_occurrence[label]
        selected = choices[min(occurrence, len(choices) - 1)]
        sheet.cell(row, headers["Value"], selected)
        target_occurrence[label] += 1


def calc_simple(sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float) -> float:
    total = (
        resin
        + get_amount(sheet, headers, labels, "Import Clearance (%)")
        + get_amount(sheet, headers, labels, "Ocean Freight")
    )
    set_amount(sheet, headers, labels, "FOB Price", resin)
    set_amount(sheet, headers, labels, "DDP Price", total)
    return total


def calc_bolivia(sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float) -> float:
    freight = get_amount(sheet, headers, labels, "FLETE MARITIMO")
    internalization = get_amount(sheet, headers, labels, "INTERNALIZATION COST")
    rate = get_amount(sheet, headers, labels, "OTHER COST ( CDP)") + get_amount(
        sheet, headers, labels, "OTHER COST (BANK FEE)"
    )
    total = (resin + freight) * (1 + rate) + internalization
    set_amount(sheet, headers, labels, "ICIS N-1", resin)
    set_amount(sheet, headers, labels, "VPET", total)
    return total


def calc_brazil_amcor(
    sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float
) -> float:
    freight = get_amount(sheet, headers, labels, "International freight")
    others = get_amount(sheet, headers, labels, "Others")
    duties = (resin + freight) * 0.208
    total = resin + freight + duties + others
    set_amount(sheet, headers, labels, "ICIS China mid (M-1)", resin)
    set_amount(sheet, headers, labels, "Duties", duties)
    set_amount(sheet, headers, labels, "Sell Side Resina USD", total)
    return total


def calc_cristalpet(
    sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float
) -> float:
    freight = get_amount(sheet, headers, labels, "FRETE INTERNACIONAL")
    tax_rate = get_amount(sheet, headers, labels, "Tax")
    others = get_amount(sheet, headers, labels, "Other Costs")
    additional = get_amount(sheet, headers, labels, "Additional Cost Index China")
    fx = get_amount(sheet, headers, labels, "Fx (M-1)")
    total = (resin + freight) * (1 + tax_rate) + others + additional
    set_amount(sheet, headers, labels, "ICIS PET China MID (M-1)", resin)
    set_amount(sheet, headers, labels, "Total Landing Cost $", total)
    if label_key("Total Landing Cost") in labels:
        set_amount(sheet, headers, labels, "Total Landing Cost", total * fx)
    return total


def calc_engepack(
    sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float
) -> float:
    freight = get_amount(sheet, headers, labels, "Freight")
    fx = get_amount(sheet, headers, labels, "Fx (M-1)")
    total = ((resin + 100.0 + freight) * 1.20) + 125.0 + (freight * 0.08)
    set_amount(sheet, headers, labels, "ICIS China (M-1)", resin)
    set_amount(sheet, headers, labels, "Total Landing Cost $", total)
    if label_key("Total Landing Cost") in labels:
        set_amount(sheet, headers, labels, "Total Landing Cost", total * fx)
    return total


def calc_valgroup(
    sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float
) -> float:
    discount = get_amount(sheet, headers, labels, "Discount")
    freight = get_amount(sheet, headers, labels, "Drewry (t-1) with discount")
    importation = get_amount(sheet, headers, labels, "Importation")
    import_tax = get_amount(sheet, headers, labels, "Import Tax")
    surcharge = get_amount(sheet, headers, labels, "Surcharge")
    indorama = get_amount(sheet, headers, labels, "Indorama Discount")
    total = ((resin * (1 - discount) + freight) * (1 + importation + import_tax)) + surcharge + indorama
    set_amount(sheet, headers, labels, "ICIS Asia SE Low (n-1)", resin)
    set_amount(sheet, headers, labels, "Resin with assumptions", resin)
    set_amount(sheet, headers, labels, "Total V-PET USD/ton", total)
    return total


def calc_colombia(
    sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float
) -> float:
    regular = get_amount(sheet, headers, labels, "Freight China-Buenaventura (Regular)")
    incremental = get_amount(sheet, headers, labels, "Freight China-Buenaventura (Incremental)")
    old_resin = get_amount(sheet, headers, labels, "Resin Price Index")
    old_finance = get_amount(sheet, headers, labels, "Finance")
    old_base = old_resin + regular + incremental
    finance_rate = old_finance / old_base if old_base else 0.0
    finance = (resin + regular + incremental) * finance_rate
    subtotal_incremental = resin + finance + regular + incremental
    subtotal_regular = resin + finance + regular
    duty = subtotal_incremental * 0.05
    landed = subtotal_regular * 0.08
    zf = get_amount(sheet, headers, labels, "ZF Legislation Change")
    surcharge = get_amount(sheet, headers, labels, "Sur Charge Alpek Br")
    total = subtotal_incremental + duty + landed + zf + surcharge
    updates = {
        "Resin Price Index": resin,
        "Finance": finance,
        "Sub Total (with Incremental Freight)": subtotal_incremental,
        "Sub Total (with Regular Freight)": subtotal_regular,
        "Duty 5% (Change According to Regulation)": duty,
        "Landed Factor 8%": landed,
        "Total Resin Price ABI VIRGIN Formula": total,
    }
    for label, amount in updates.items():
        set_amount(sheet, headers, labels, label, amount)
    return total


def calc_ecuador(
    sheet: Any,
    headers: dict[str, int],
    labels: dict[str, list[int]],
    resin: float,
    rows: list[int],
) -> float:
    freight = get_amount(sheet, headers, labels, "Freight")
    finance = get_amount(sheet, headers, labels, "Finance Fee V (SOFR +3.8%@175)")
    cif = resin + freight + finance
    fixed_labels = (
        "282 USD/Container Customs",
        "Customs Clearance Fixed: 36.02/ton",
        "Fixed Value per BL & +30 if Physical Inspection",
        "Freight GYE - UIO USD671/Container",
        "Government Diesel Surcharge",
        "Port Storage - USD250/Container",
        "Shipping Exp. & Container Return - UIO USD430/Container",
    )
    fixed = sum(get_amount(sheet, headers, labels, label) for label in fixed_labels)
    updates = {
        "ICIS China Mid (n-2)": resin,
        "0.10% of CIF Value": cif * 0.001,
        "Foreign Currency Exit Tax 4% of CIF Value": cif * 0.04,
        "0.5% of CIF Value": cif * 0.005,
    }
    total = cif + sum(updates[label] for label in list(updates)[1:]) + fixed
    updates["Landed Price"] = total
    for label, amount in updates.items():
        set_amount(sheet, headers, labels, label, amount)
    blank_rows = [row for row in rows if not clean(sheet.cell(row, headers["Raw Cost Breakdown"]).value)]
    if len(blank_rows) == 1:
        sheet.cell(blank_rows[0], headers["Value"], cif)
    return total


def calc_esh(sheet: Any, headers: dict[str, int], labels: dict[str, list[int]], resin: float) -> float:
    sc = get_amount(sheet, headers, labels, "SC")
    adder = get_amount(sheet, headers, labels, "Adder")
    logistics = get_amount(sheet, headers, labels, "Logistics")
    landed = get_amount(sheet, headers, labels, "LANDED")
    surcharge = get_amount(sheet, headers, labels, "Surcharge")
    resin_label = "PET Bottle Grade FOB China Mid (N-4)"
    old_resin = get_amount(sheet, headers, labels, resin_label)
    old_finance = get_amount(sheet, headers, labels, "Finance fee V (SOFR +3,8%@185)")
    old_base = old_resin + adder + logistics + landed
    finance_rate = old_finance / old_base if old_base else 0.0
    finance = (resin + adder + logistics + landed) * finance_rate
    total = resin + sc + adder + logistics + landed + finance + surcharge
    set_amount(sheet, headers, labels, resin_label, resin)
    set_amount(sheet, headers, labels, "Finance fee V (SOFR +3,8%@185)", finance)
    set_amount(sheet, headers, labels, "Total precio ABI", total)
    return total


SUPPLIER_CALCULATORS = {
    "simple": calc_simple,
    "bolivia": calc_bolivia,
    "brazil_amcor": calc_brazil_amcor,
    "cristalpet": calc_cristalpet,
    "engepack": calc_engepack,
    "valgroup": calc_valgroup,
    "colombia": calc_colombia,
    "esh": calc_esh,
}


def direct_index_value(
    series: str,
    index_period: tuple[int, int],
    actual_curves: dict[str, dict[tuple[int, int], float]],
    china_forecast: dict[tuple[int, int], float],
    current_value: float,
) -> tuple[float, str]:
    if index_period in actual_curves.get(series, {}):
        return actual_curves[series][index_period], "Actual ICIS history"
    if series == "China" and index_period in china_forecast:
        return china_forecast[index_period], "China ICIS forecast"
    return current_value, "Existing forecast retained"


def refresh_supplier(
    model_path: Path,
    actual_curves: dict[str, dict[tuple[int, int], float]],
    china_forecast: dict[tuple[int, int], float],
    history_path: Path,
    asia_path: Path,
    forecast_path: Path,
) -> list[dict[str, Any]]:
    workbook = load_workbook(model_path)
    sheet = workbook[SHEET_NAME]
    headers, value = worksheet_access(sheet)
    groups: dict[tuple[str, str, str, int, int], list[int]] = defaultdict(list)
    for row in range(2, sheet.max_row + 1):
        destination = clean(value(row, "Destination Country"))
        supplier = clean(value(row, "Supplier Name"))
        if (destination, supplier) not in SUPPLIER_RULES:
            continue
        year = int(number(value(row, "Time Period Year"), 0) or 0)
        month = int(number(value(row, "Time Period Month"), 0) or 0)
        location = clean(value(row, "Location"))
        groups[(destination, supplier, location, year, month)].append(row)

    audit: list[dict[str, Any]] = []
    for month in (9, 10, 11, 12):
        for (destination, supplier, location, year, group_month), rows in sorted(groups.items()):
            if year != 2026 or group_month != month:
                continue
            series, formula = SUPPLIER_RULES[(destination, supplier)]
            old_type = clean(value(rows[0], "Data Type"))
            old_resin_rows = [
                row
                for row in rows
                if normalized(value(row, "Mapping Columns"))
                in {"resin index vpet", "index", "seguro"}
            ]
            total_rows = [
                row
                for row in rows
                if normalized(value(row, "Mapping Columns")) == "total landing cost"
            ]
            if not old_resin_rows or not total_rows:
                raise ValueError(f"Missing resin/TLC rows for {destination} / {supplier} / {month}")
            old_resin = number(value(old_resin_rows[0], "Value"), 0.0) or 0.0
            old_tlc = number(value(total_rows[-1], "Value"), 0.0) or 0.0

            new_type = "Actual" if month in {9, 10} else "Forecast"
            for row in rows:
                sheet.cell(row, headers["Data Type"], new_type)

            if formula == "uruguay_unchanged":
                audit.append(
                    {
                        "Model": "Supplier",
                        "Destination": destination,
                        "Supplier / Source": supplier,
                        "Location": location,
                        "Output Period": f"{MONTHS[month]} 2026",
                        "Old Data Type": old_type,
                        "New Data Type": new_type,
                        "Lag": "M-1",
                        "Index Period": period_text(lagged_period(2026, month, 1)),
                        "Index Series": "IHS",
                        "Index Basis": "Existing Uruguay values retained",
                        "Old Resin Index": old_resin,
                        "New Resin Index": old_resin,
                        "Old TLC": old_tlc,
                        "New TLC": old_tlc,
                        "Status": "TYPE UPDATED" if old_type != new_type else "UNCHANGED",
                    }
                )
                continue

            template_month = month - 1 if month in {9, 10} else 10
            template_rows = groups.get((destination, supplier, location, 2026, template_month))
            if not template_rows:
                raise ValueError(
                    f"Missing supplier template for {destination} / {supplier} / {template_month}"
                )
            copy_non_resin_values(sheet, headers, value, template_rows, rows)
            labels = rows_by_label(sheet, headers, rows)
            lag = DESTINATION_LAGS[destination]
            index_period = lagged_period(2026, month, lag)
            new_resin, basis = direct_index_value(
                series, index_period, actual_curves, china_forecast, old_resin
            )
            if formula == "ecuador":
                new_tlc = calc_ecuador(sheet, headers, labels, new_resin, rows)
            else:
                new_tlc = SUPPLIER_CALCULATORS[formula](sheet, headers, labels, new_resin)

            provenance_files = history_path if series == "China" else asia_path
            if basis == "China ICIS forecast":
                provenance_files = forecast_path
            provenance = (
                f"{provenance_files}; {MONTHS[template_month]} 2026 latest Actual "
                f"non-resin components carried forward; {lag}-month lag applied"
            )
            for row in rows:
                sheet.cell(row, headers["Source File"], str(provenance_files))

            audit.append(
                {
                    "Model": "Supplier",
                    "Destination": destination,
                    "Supplier / Source": supplier,
                    "Location": location,
                    "Output Period": f"{MONTHS[month]} 2026",
                    "Old Data Type": old_type,
                    "New Data Type": new_type,
                    "Lag": f"M-{lag}",
                    "Index Period": period_text(index_period),
                    "Index Series": series,
                    "Index Basis": basis,
                    "Old Resin Index": old_resin,
                    "New Resin Index": new_resin,
                    "Old TLC": old_tlc,
                    "New TLC": new_tlc,
                    "Status": "UPDATED" if abs(new_tlc - old_tlc) > 1e-9 or old_type != new_type else "UNCHANGED",
                    "Non-resin Basis": f"{MONTHS[template_month]} 2026 latest Actual",
                    "Provenance": provenance,
                }
            )

    workbook.save(model_path)
    export_csv(sheet, model_path.with_suffix(".csv"))
    workbook.close()
    return audit


def market_group_resin(
    sheet: Any, headers: dict[str, int], value: Callable[[int, str], Any], rows: list[int]
) -> tuple[list[int], float]:
    resin_rows = [
        row for row in rows if normalized(value(row, "Mapping Columns")) == "resin index vpet"
    ]
    if not resin_rows:
        raise ValueError("Market group is missing resin row")
    return resin_rows, number(value(resin_rows[0], "Value"), 0.0) or 0.0


def recalculate_market_group(
    sheet: Any,
    headers: dict[str, int],
    value: Callable[[int, str], Any],
    rows: list[int],
    destination: str,
    source: str,
    resin: float,
    tax_sheet: Any,
    source_columns: dict[str, int],
    destination_start_rows: dict[str, int],
    component_key_by_label: dict[str, str],
) -> float:
    resin_rows, _ = market_group_resin(sheet, headers, value, rows)
    for row in resin_rows:
        sheet.cell(row, headers["Value"], resin)
    freight_row = next(
        row for row in rows if normalized(value(row, "Raw Cost Breakdown")) == "freight cost"
    )
    freight = number(value(freight_row, "Value"), 0.0) or 0.0
    local_row = next(
        (
            row
            for row in rows
            if normalized(value(row, "Raw Cost Breakdown"))
            == "destination port to supplier location transportation"
        ),
        None,
    )
    local_transport = number(value(local_row, "Value"), 0.0) if local_row else 0.0
    components = calculate_components(
        tax_sheet,
        destination_start_rows,
        source_columns,
        {source: resin},
        {(source, destination): {"freight_rate": freight}},
        {destination: local_transport or 0.0},
        destination,
        source,
        resin_fob_override=resin,
    )
    for row in rows:
        component_key = component_key_by_label.get(normalized(value(row, "Raw Cost Breakdown")))
        if component_key and component_key != "tlc" and components.get(component_key) is not None:
            sheet.cell(row, headers["Value"], components[component_key])

    total_rows = [
        row for row in rows if normalized(value(row, "Mapping Columns")) == "total landing cost"
    ]
    if not total_rows:
        raise ValueError(f"Missing Market TLC for {source} -> {destination}")
    total = sum(
        number(value(row, "Value"), 0.0) or 0.0
        for row in rows
        if normalized(value(row, "Column Required for Calculation")) == "yes"
        and normalized(value(row, "Mapping Columns")) != "total landing cost"
    )
    for row in total_rows:
        sheet.cell(row, headers["Value"], total)
    return total


def refresh_market(
    model_path: Path,
    raw_market_path: Path,
    actual_curves: dict[str, dict[tuple[int, int], float]],
    china_forecast: dict[tuple[int, int], float],
    history_path: Path,
    asia_path: Path,
    forecast_path: Path,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    workbook = load_workbook(model_path)
    sheet = workbook[SHEET_NAME]
    headers, value = worksheet_access(sheet)
    groups: dict[tuple[str, str, int, int], list[int]] = defaultdict(list)
    for row in range(2, sheet.max_row + 1):
        destination = clean(value(row, "Destination Country"))
        source = clean(value(row, "Supplier Name"))
        if destination not in DESTINATION_LAGS or source not in MARKET_SOURCE_SERIES:
            continue
        year = int(number(value(row, "Time Period Year"), 0) or 0)
        month = int(number(value(row, "Time Period Month"), 0) or 0)
        groups[(destination, source, year, month)].append(row)

    raw_workbook = load_workbook(raw_market_path, read_only=True, data_only=True)
    tax_sheet = raw_workbook["Tax references"]
    source_columns, destination_start_rows = extract_tax_references(tax_sheet)
    component_key_by_label = {
        normalized(component.raw_label): component.key for component in DEFAULT_COMPONENTS
    }
    audit: list[dict[str, Any]] = []
    global_audit: list[dict[str, Any]] = []
    try:
        for month in (9, 10, 11, 12):
            for (destination, source, year, group_month), rows in sorted(groups.items()):
                if year != 2026 or group_month != month or source in GLOBAL_SOURCES:
                    continue
                series = MARKET_SOURCE_SERIES[source]
                lag = DESTINATION_LAGS[destination]
                index_period = lagged_period(year, month, lag)
                resin_rows, old_resin = market_group_resin(sheet, headers, value, rows)
                total_rows = [
                    row
                    for row in rows
                    if normalized(value(row, "Mapping Columns")) == "total landing cost"
                ]
                old_tlc = number(value(total_rows[0], "Value"), 0.0) if total_rows else 0.0
                old_type = clean(value(rows[0], "Data Type"))
                new_type = "Actual" if month in {9, 10} else "Forecast"
                new_resin, basis = direct_index_value(
                    series, index_period, actual_curves, china_forecast, old_resin
                )
                for row in rows:
                    sheet.cell(row, headers["Data Type"], new_type)
                new_tlc = recalculate_market_group(
                    sheet,
                    headers,
                    value,
                    rows,
                    destination,
                    source,
                    new_resin,
                    tax_sheet,
                    source_columns,
                    destination_start_rows,
                    component_key_by_label,
                )
                provenance_source = (
                    forecast_path
                    if basis == "China ICIS forecast"
                    else asia_path
                    if series == "Asia SE Low" and basis == "Actual ICIS history"
                    else history_path
                    if basis == "Actual ICIS history"
                    else clean(value(rows[0], "Source File"))
                )
                if basis != "Existing forecast retained":
                    for row in rows:
                        sheet.cell(row, headers["Source File"], str(provenance_source))
                audit.append(
                    {
                        "Model": "Market",
                        "Destination": destination,
                        "Supplier / Source": source,
                        "Location": source,
                        "Output Period": f"{MONTHS[month]} 2026",
                        "Old Data Type": old_type,
                        "New Data Type": new_type,
                        "Lag": f"M-{lag}",
                        "Index Period": period_text(index_period),
                        "Index Series": series,
                        "Index Basis": basis,
                        "Old Resin Index": old_resin,
                        "New Resin Index": new_resin,
                        "Old TLC": old_tlc,
                        "New TLC": new_tlc,
                        "Freight Rule": "Existing Market freight retained",
                        "Status": "UPDATED" if abs(new_tlc - old_tlc) > 1e-9 or old_type != new_type else "UNCHANGED",
                    }
                )

        stored_curve_candidates: dict[tuple[str, tuple[int, int]], list[float]] = defaultdict(list)
        for (destination, source, year, month), input_rows in groups.items():
            series = MARKET_SOURCE_SERIES[source]
            if year != 2026 or series == "Global ICIS":
                continue
            _, stored_value = market_group_resin(sheet, headers, value, input_rows)
            index_period = lagged_period(year, month, DESTINATION_LAGS[destination])
            stored_curve_candidates[(series, index_period)].append(stored_value)

        def global_input_value(series: str, index_period: tuple[int, int]) -> float:
            if index_period in actual_curves.get(series, {}):
                return actual_curves[series][index_period]
            if series == "China" and index_period in china_forecast:
                return china_forecast[index_period]
            candidates = stored_curve_candidates.get((series, index_period), [])
            if not candidates:
                raise ValueError(
                    f"Missing {series} reference for Global ICIS, {period_text(index_period)}"
                )
            # Multiple destination routes should carry the same lagged index.
            # Select the most frequently stored value to avoid route duplication
            # influencing the central reference curve.
            counts: dict[float, int] = defaultdict(int)
            originals: dict[float, float] = {}
            for candidate in candidates:
                rounded = round(candidate, 8)
                counts[rounded] += 1
                originals[rounded] = candidate
            selected = max(counts, key=lambda item: (counts[item], -abs(item)))
            return originals[selected]

        for (destination, source, year, month), rows in sorted(groups.items()):
            if year != 2026 or source not in GLOBAL_SOURCES:
                continue
            resin_rows, old_global = market_group_resin(sheet, headers, value, rows)
            inputs: dict[str, float] = {}
            index_period = lagged_period(year, month, DESTINATION_LAGS[destination])
            for series_name, input_source in GLOBAL_INPUT_SOURCES:
                inputs[series_name] = global_input_value(series_name, index_period)
            new_global = sum(inputs.values()) / len(inputs)
            total_rows = [
                row
                for row in rows
                if normalized(value(row, "Mapping Columns")) == "total landing cost"
            ]
            old_tlc = number(value(total_rows[0], "Value"), 0.0) if total_rows else 0.0
            old_type = clean(value(rows[0], "Data Type"))
            new_type = "Actual" if month in {9, 10} else old_type
            for row in rows:
                sheet.cell(row, headers["Data Type"], new_type)
                sheet.cell(
                    row,
                    headers["Source File"],
                    "Global ICIS average of Asia SE Low, China, India, Mexico, South Korea and Taiwan",
                )
            new_tlc = recalculate_market_group(
                sheet,
                headers,
                value,
                rows,
                destination,
                source,
                new_global,
                tax_sheet,
                source_columns,
                destination_start_rows,
                component_key_by_label,
            )
            global_audit.append(
                {
                    "Destination": destination,
                    "Global Source": source,
                    "Output Period": f"{MONTHS[month]} 2026",
                    "Data Type": new_type,
                    **inputs,
                    "Old Global ICIS": old_global,
                    "New Global ICIS": new_global,
                    "Global Delta": new_global - old_global,
                    "Old TLC": old_tlc,
                    "New TLC": new_tlc,
                    "TLC Delta": new_tlc - old_tlc,
                    "Status": "UPDATED" if abs(new_global - old_global) > 1e-9 or old_type != new_type else "UNCHANGED",
                }
            )
    finally:
        raw_workbook.close()

    workbook.save(model_path)
    export_csv(sheet, model_path.with_suffix(".csv"))
    workbook.close()
    return audit, global_audit


def add_sheet(workbook: Workbook, title: str, rows: list[dict[str, Any]]) -> None:
    sheet = workbook.create_sheet(title[:31])
    if not rows:
        sheet.append(["No rows"])
        return
    headers: list[str] = []
    for row in rows:
        for column in row:
            if column not in headers:
                headers.append(column)
    sheet.append(headers)
    for row in rows:
        sheet.append([row.get(header) for header in headers])
    blue = PatternFill("solid", fgColor="1F4E78")
    green = PatternFill("solid", fgColor="C6EFCE")
    yellow = PatternFill("solid", fgColor="FFF2CC")
    for cell in sheet[1]:
        cell.fill = blue
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for row_index in range(2, sheet.max_row + 1):
        if "Status" in headers:
            status_cell = sheet.cell(row_index, headers.index("Status") + 1)
            status_cell.fill = green if status_cell.value in {"UPDATED", "UNCHANGED"} else yellow
        for column_index, header in enumerate(headers, 1):
            if any(token in header for token in ("Index", "TLC", "Delta")):
                if isinstance(sheet.cell(row_index, column_index).value, (int, float)):
                    sheet.cell(row_index, column_index).number_format = "#,##0.00"
    for index, header in enumerate(headers, 1):
        values = [clean(sheet.cell(row, index).value) for row in range(1, min(sheet.max_row, 200) + 1)]
        sheet.column_dimensions[get_column_letter(index)].width = min(max(map(len, values)) + 2, 65)
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions


def write_audit(
    output: Path,
    actual_curves: dict[str, dict[tuple[int, int], float]],
    china_forecast: dict[tuple[int, int], float],
    supplier_rows: list[dict[str, Any]],
    market_rows: list[dict[str, Any]],
    global_rows: list[dict[str, Any]],
    backups: list[Path],
) -> None:
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    summary_rows = [
        {"Metric": "Supplier scenarios refreshed", "Value": len(supplier_rows)},
        {"Metric": "Market direct scenarios refreshed", "Value": len(market_rows)},
        {"Metric": "Global ICIS scenarios recalculated", "Value": len(global_rows)},
        {"Metric": "September/October rows", "Value": "Actual"},
        {"Metric": "November/December rows", "Value": "Forecast"},
        {"Metric": "Supplier non-resin basis", "Value": "Latest previous Actual"},
        {"Metric": "Market freight basis", "Value": "Existing Market value retained"},
        {
            "Metric": "Global ICIS formula",
            "Value": "Average of Asia SE Low, China, India, Mexico, South Korea and Taiwan",
        },
        {"Metric": "Uruguay Supplier", "Value": "Existing resin and TLC values retained"},
    ] + [{"Metric": f"Backup {index}", "Value": str(path)} for index, path in enumerate(backups, 1)]
    for row in summary_rows:
        summary.append([row["Metric"], row["Value"]])
    summary.insert_rows(1)
    summary.cell(1, 1, "Metric")
    summary.cell(1, 2, "Value")
    for cell in summary[1]:
        cell.fill = PatternFill("solid", fgColor="1F4E78")
        cell.font = Font(color="FFFFFF", bold=True)
    summary.column_dimensions["A"].width = 38
    summary.column_dimensions["B"].width = 110
    summary.freeze_panes = "A2"

    input_rows = []
    for series, values in sorted(actual_curves.items()):
        for (year, month), amount in sorted(values.items()):
            if year == 2026:
                input_rows.append(
                    {
                        "Series": series,
                        "Period": f"{MONTHS[month]} {year}",
                        "Data Type": "Actual",
                        "Value": amount,
                    }
                )
    for (year, month), amount in sorted(china_forecast.items()):
        if year == 2026:
            input_rows.append(
                {
                    "Series": "China",
                    "Period": f"{MONTHS[month]} {year}",
                    "Data Type": "Forecast",
                    "Value": amount,
                }
            )
    add_sheet(workbook, "Index Inputs", input_rows)
    add_sheet(workbook, "Supplier Changes", supplier_rows)
    add_sheet(workbook, "Market Changes", market_rows)
    add_sheet(workbook, "Global ICIS", global_rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--supplier-model", type=Path, default=SUPPLIER_MODEL)
    parser.add_argument("--market-model", type=Path, default=MARKET_MODEL)
    parser.add_argument("--raw-market-model", type=Path, default=RAW_MARKET_MODEL)
    parser.add_argument("--history", type=Path, default=DEFAULT_HISTORY)
    parser.add_argument("--asia-se-history", type=Path, default=DEFAULT_ASIA_SE_HISTORY)
    parser.add_argument("--china-forecast", type=Path, default=DEFAULT_CHINA_FORECAST)
    parser.add_argument("--audit", type=Path, default=DEFAULT_AUDIT)
    parser.add_argument("--no-backup", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    required = (
        args.supplier_model,
        args.market_model,
        args.raw_market_model,
        args.history,
        args.asia_se_history,
        args.china_forecast,
    )
    if missing := [path for path in required if not path.is_file()]:
        raise FileNotFoundError(f"Missing inputs: {missing}")

    actual_curves = parse_actual_curves(args.history, args.asia_se_history)
    china_forecast = parse_china_forecast(args.china_forecast)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backups: list[Path] = []
    if not args.no_backup:
        for model in (args.supplier_model, args.market_model):
            xlsx_backup, csv_backup = backup_model(model, timestamp)
            backups.append(xlsx_backup)
            if csv_backup:
                backups.append(csv_backup)

    supplier_audit = refresh_supplier(
        args.supplier_model,
        actual_curves,
        china_forecast,
        args.history,
        args.asia_se_history,
        args.china_forecast,
    )
    market_audit, global_audit = refresh_market(
        args.market_model,
        args.raw_market_model,
        actual_curves,
        china_forecast,
        args.history,
        args.asia_se_history,
        args.china_forecast,
    )
    write_audit(
        args.audit,
        actual_curves,
        china_forecast,
        supplier_audit,
        market_audit,
        global_audit,
        backups,
    )
    print(f"Supplier scenarios refreshed: {len(supplier_audit)}")
    print(f"Market direct scenarios refreshed: {len(market_audit)}")
    print(f"Global ICIS scenarios recalculated: {len(global_audit)}")
    for backup in backups:
        print(f"Backup: {backup}")
    print(f"Audit: {args.audit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
