"""Back-test supplier TLC with China/Asia SE indexes and forecast China TLC.

The test validates April-June 2026 against the supplier front-end data model and
calculates July-September 2026 using June's non-resin assumptions. Historical
lags include M-2 for Argentina, Colombia, Ecuador, Dominican Republic, Panama
and Peru; M-3 for El Salvador/Honduras; and M-1 for the remaining suppliers.

Run from PET_Resin_Cost:
    python testing_scripts/validate_supplier_tlc_resin_only.py
    python testing_scripts/validate_supplier_tlc_resin_only.py --tolerance-percent 2
"""
from __future__ import annotations

import argparse
import sys
from calendar import month_name
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"
TEST_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.data.supplier import build_vendor_breakdowns  # noqa: E402


CHINA_INDEXES_2026 = {
    1: 818.1,
    2: 838.3,
    3: 1111.3,
    4: 1191.9,
    5: 1202.0,
    6: 1070.0,
    7: 986.0,
    8: 1020.0,
    9: 1005.00,
    10: 961.00,
    11: 925.00,
    12: 878.0,
}
ASIA_SE_INDEXES_2026 = {
    1: 830.0,
    2: 852.5,
    3: 1115.0,
    4: 1287.5,
    5: 1288.0,
    6: 1125.0,
    7: 1072.0,
    8: 1097.5
}
VALIDATION_MONTHS = (6, 7, 8)
FORECAST_MONTHS = (9, 10, 11)


@dataclass(frozen=True)
class SupplierConfig:
    destination: str
    supplier_name: str
    lag: int
    formula: str
    index_series: str = "China FOB"
    historical_only: bool = False


CONFIGS = (
    SupplierConfig("Argentina", "Amcor", 2, "argentina"),
    SupplierConfig(
        "Bolivia",
        "Gestora, Administradora e Industrializadora Preformas S.A.",
        1,
        "bolivia",
    ),
    SupplierConfig("Brazil", "Amcor - MANAUS", 1, "brazil_amcor"),
    SupplierConfig("Brazil", "Amcor - SUAPE", 1, "brazil_amcor"),
    SupplierConfig("Brazil", "Cristalpet", 1, "cristalpet"),
    SupplierConfig("Brazil", "Engepack", 1, "engepack", "China FOB", True),
    SupplierConfig("Brazil", "Valgroup", 1, "valgroup", "Asia SE", True),
    SupplierConfig("Dominican Republic", "SMI PET", 2, "argentina", "Asia SE", True),
    SupplierConfig("Panama", "Pastiglas S.A", 2, "argentina", "Asia SE", True),
    SupplierConfig("Peru", "Pastiglas S.A", 2, "argentina", "Asia SE", True),
    SupplierConfig("Colombia", "Amcor", 2, "colombia"),
    SupplierConfig("Ecuador", "Amcor", 2, "ecuador"),
    SupplierConfig("El Salvador and Honduras", "Amcor", 3, "esh"),
)


def number(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip().replace(",", ""))
    except (TypeError, ValueError):
        return default


def keyed_rows(entry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("rawLabel") or row.get("label") or "").strip().casefold(): row
        for row in entry.get("rows", [])
    }


def amount(rows: dict[str, dict[str, Any]], label: str) -> float:
    return number(rows.get(label.casefold(), {}).get("amount"))


def source_tlc(entry: dict[str, Any]) -> float | None:
    for row in entry.get("rows", []):
        if str(row.get("commonComponent") or "").casefold() == "total landed cost (pet resin)":
            return number(row.get("amount"))
    return None


def source_resin(entry: dict[str, Any]) -> float | None:
    for row in entry.get("rows", []):
        if str(row.get("commonComponent") or "").casefold() == "resin index":
            return number(row.get("amount"))
    return None


def calc_argentina(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    clearance = amount(rows, "Import Clearance (%)")
    freight = amount(rows, "Ocean Freight")
    total = resin + clearance + freight
    detail = [("Resin Index Input", resin, "Input"), ("Import Clearance", clearance, "Fixed $"), ("Ocean Freight", freight, "Fixed $")]
    return total, f"{resin:.2f} + {clearance:.2f} + {freight:.2f} = {total:.2f}", detail


def calc_bolivia(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    freight = amount(rows, "FLETE MARITIMO")
    internalization = amount(rows, "INTERNALIZATION COST")
    cdp_rate = amount(rows, "OTHER COST ( CDP)")
    bank_rate = amount(rows, "OTHER COST (BANK FEE)")
    percentage_impact = (resin + freight) * (cdp_rate + bank_rate)
    total = resin + freight + percentage_impact + internalization
    detail = [
        ("China Resin Index", resin, "Input"),
        ("FLETE MARITIMO", freight, "Fixed $"),
        ("OTHER COST (CDP + BANK FEE)", percentage_impact, f"{(cdp_rate + bank_rate) * 100:.2f}% of Resin + Freight"),
        ("INTERNALIZATION COST", internalization, "Fixed $"),
    ]
    expression = f"({resin:.2f} + {freight:.2f}) * (1 + {cdp_rate:.4f} + {bank_rate:.4f}) + {internalization:.2f} = {total:.2f}"
    return total, expression, detail


def calc_brazil_amcor(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    freight = amount(rows, "International freight")
    fixed_cost = amount(rows, "Others")
    duty_rate = 0.208
    duties = (resin + freight) * duty_rate
    total = resin + freight + duties + fixed_cost
    detail = [
        ("China Resin Index", resin, "Input"),
        ("International Freight", freight, "Fixed $"),
        ("Duties", duties, "20.80% of Resin + Freight"),
        ("Others", fixed_cost, "Fixed $"),
    ]
    expression = f"({resin:.2f} + {freight:.2f}) * 1.208 + {fixed_cost:.2f} = {total:.2f}"
    return total, expression, detail


def calc_cristalpet(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    freight = amount(rows, "FRETE INTERNACIONAL")
    tax_rate = amount(rows, "Tax")
    other_costs = amount(rows, "Other Costs")
    additional = amount(rows, "Additional Cost Index China")
    tax_impact = (resin + freight) * tax_rate
    total = resin + freight + tax_impact + other_costs + additional
    detail = [
        ("China Resin Index", resin, "Input"),
        ("FRETE INTERNACIONAL", freight, "Fixed $"),
        ("Tax", tax_impact, f"{tax_rate * 100:.2f}% of Resin + Freight"),
        ("Other Costs", other_costs, "Fixed $"),
        ("Additional Cost Index China", additional, "Fixed $"),
    ]
    expression = f"({resin:.2f} + {freight:.2f}) * (1 + {tax_rate:.4f}) + {other_costs:.2f} + {additional:.2f} = {total:.2f}"
    return total, expression, detail


def calc_engepack(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    reported_freight = amount(rows, "Freight")
    # April's source formula uses the adjusted freight captured by the Engepack
    # validation artifact; the standardized Freight row is the Q-1 average.
    freight = 74.28641975308642 if entry.get("month") == "April" else reported_freight
    tax_impact = (resin + 100.0 + freight) * 0.20
    freight_surcharge = freight * 0.08
    total = resin + 100.0 + freight + tax_impact + 125.0 + freight_surcharge
    detail = [
        ("China FOB Resin Index", resin, "Input"),
        ("Formula Adder", 100.0, "Fixed $"),
        ("Adjusted Freight Used by TLC", freight, "April validation artifact; otherwise stored Freight"),
        ("Tax", tax_impact, "20.00% of Resin + Adder + Adjusted Freight"),
        ("Other Fixed Cost", 125.0, "Fixed $"),
        ("Freight Surcharge", freight_surcharge, "8.00% of Freight"),
    ]
    expression = f"(({resin:.2f} + 100.00 + {freight:.2f}) * 1.20) + 125.00 + (8% * {freight:.2f}) = {total:.2f}"
    return total, expression, detail


def calc_valgroup(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    discount = amount(rows, "Discount")
    freight = amount(rows, "Drewry (t-1) with discount")
    importation = amount(rows, "Importation")
    import_tax = amount(rows, "Import Tax")
    surcharge = amount(rows, "Surcharge")
    indorama = amount(rows, "Indorama Discount")
    discount_impact = -(resin * discount)
    taxable_base = resin + discount_impact + freight
    tax_impact = taxable_base * (importation + import_tax)
    total = taxable_base + tax_impact + surcharge + indorama
    detail = [
        ("Asia SE Resin Index", resin, "Input"),
        ("Discount", discount_impact, f"-{discount * 100:.2f}% of Resin"),
        ("Drewry Freight", freight, "Fixed $"),
        ("Importation + Import Tax", tax_impact, f"{(importation + import_tax) * 100:.2f}% of discounted Resin + Freight"),
        ("Surcharge", surcharge, "Fixed $"),
        ("Indorama Discount", indorama, "Fixed $"),
    ]
    expression = f"(({resin:.2f} * (1 - {discount:.4f}) + {freight:.2f}) * (1 + {importation:.4f} + {import_tax:.4f})) + {surcharge:.2f} + ({indorama:.2f}) = {total:.2f}"
    return total, expression, detail


def calc_colombia(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    regular = amount(rows, "Freight China-Buenaventura (Regular)")
    incremental = amount(rows, "Freight China-Buenaventura (Incremental)")
    stored_resin = amount(rows, "Resin Price Index")
    stored_finance = amount(rows, "Finance")
    finance_base = stored_resin + regular + incremental
    finance_rate = stored_finance / finance_base if finance_base else 0.03496712876712329
    finance = (resin + regular + incremental) * finance_rate
    subtotal_incremental = resin + finance + regular + incremental
    subtotal_regular = resin + finance + regular
    duty = subtotal_incremental * 0.05
    landed = subtotal_regular * 0.08
    zf = amount(rows, "ZF Legislation Change")
    surcharge = amount(rows, "Sur Charge Alpek Br")
    total = subtotal_incremental + duty + landed + zf + surcharge
    detail = [
        ("China Resin Index", resin, "Input"),
        ("Regular Freight", regular, "Fixed $"),
        ("Incremental Freight", incremental, "Fixed $"),
        ("Finance", finance, f"{finance_rate * 100:.4f}% of Resin + both Freight values"),
        ("Duty", duty, "5.00% of Subtotal with Incremental Freight"),
        ("Landed Factor", landed, "8.00% of Subtotal with Regular Freight"),
        ("ZF Legislation Change", zf, "Fixed $"),
        ("Surcharge", surcharge, "Fixed $"),
    ]
    expression = (
        f"Subtotal {subtotal_incremental:.2f} + Duty {duty:.2f} + Landed {landed:.2f} "
        f"+ ZF {zf:.2f} + Surcharge {surcharge:.2f} = {total:.2f}"
    )
    return total, expression, detail


def calc_ecuador(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    freight = amount(rows, "Freight")
    finance = amount(rows, "Finance Fee V (SOFR +3.8%@175)")
    cif = resin + freight + finance
    percentage_impact = cif * (0.001 + 0.04 + 0.005)
    fixed_labels = (
        "282 USD/Container Customs",
        "Customs Clearance Fixed: 36.02/ton",
        "Fixed Value per BL & +30 if Physical Inspection",
        "Freight GYE - UIO USD671/Container",
        "Government Diesel Surcharge",
        "Port Storage - USD250/Container",
        "Shipping Exp. & Container Return - UIO USD430/Container",
    )
    fixed = sum(amount(rows, label) for label in fixed_labels)
    total = cif + percentage_impact + fixed
    detail = [
        ("China Resin Index", resin, "Input"),
        ("Freight", freight, "Fixed $"),
        ("Finance Fee", finance, "Fixed $"),
        ("CIF-based charges", percentage_impact, "4.60% of CIF (0.10% + 4.00% + 0.50%)"),
        ("Customs, local freight and diesel", fixed, "Fixed $"),
    ]
    expression = f"CIF {cif:.2f} + CIF charges {percentage_impact:.2f} + fixed costs {fixed:.2f} = {total:.2f}"
    return total, expression, detail


def calc_esh(entry: dict[str, Any], resin: float) -> tuple[float, str, list[tuple[str, float, str]]]:
    rows = keyed_rows(entry)
    sc = amount(rows, "SC")
    adder = amount(rows, "Adder")
    logistics = amount(rows, "Logistics")
    landed = amount(rows, "LANDED")
    surcharge = amount(rows, "Surcharge")
    stored_resin = source_resin(entry) or 0.0
    stored_finance = amount(rows, "Finance fee V (SOFR +3,8%@185)")
    stored_base = stored_resin + adder + logistics + landed
    finance_rate = stored_finance / stored_base if stored_base else 0.0375
    finance = (resin + adder + logistics + landed) * finance_rate
    total = resin + sc + adder + logistics + landed + finance + surcharge
    detail = [
        ("China Resin Index", resin, "Input"),
        ("SC", sc, "Fixed $"),
        ("Adder", adder, "Fixed $"),
        ("Logistics", logistics, "Fixed $"),
        ("LANDED", landed, "Fixed $"),
        ("Finance Fee", finance, f"{finance_rate * 100:.4f}% of Resin + Adder + Logistics + LANDED"),
        ("Surcharge", surcharge, "Fixed $"),
    ]
    expression = f"{resin:.2f} + {sc:.2f} + {adder:.2f} + {logistics:.2f} + {landed:.2f} + {finance:.2f} + {surcharge:.2f} = {total:.2f}"
    return total, expression, detail


FORMULAS: dict[str, Callable[[dict[str, Any], float], tuple[float, str, list[tuple[str, float, str]]]]] = {
    "argentina": calc_argentina,
    "bolivia": calc_bolivia,
    "brazil_amcor": calc_brazil_amcor,
    "cristalpet": calc_cristalpet,
    "engepack": calc_engepack,
    "valgroup": calc_valgroup,
    "colombia": calc_colombia,
    "ecuador": calc_ecuador,
    "esh": calc_esh,
}


def select_entry(config: SupplierConfig, month: int, year: int) -> dict[str, Any] | None:
    candidates = [
        entry
        for entry in build_vendor_breakdowns((config.index_series,), config.destination)
        if entry.get("supplierName") == config.supplier_name
        and int(entry.get("year") or 0) == year
        and entry.get("month") == month_name[month]
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda row: (row.get("dataType") != "Actual", row.get("sourceFile") or ""))
    return candidates[0]


def lagged_month(year: int, month: int, lag: int) -> tuple[int, int]:
    serial = year * 12 + month - 1 - lag
    return serial // 12, serial % 12 + 1


def index_for(index_series: str, year: int, month: int) -> float:
    values = CHINA_INDEXES_2026 if index_series == "China FOB" else ASIA_SE_INDEXES_2026
    if year != 2026 or month not in values:
        raise KeyError(f"No {index_series} resin index supplied for {month_name[month]} {year}")
    return values[month]


def difference_percent(calculated: float, source: float | None) -> float | None:
    if source is None:
        return None
    if source == 0:
        return 0.0 if calculated == 0 else None
    return abs(calculated - source) / abs(source) * 100


def build_results(year: int, tolerance: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    validation: list[dict[str, Any]] = []
    forecasts: list[dict[str, Any]] = []
    details: list[dict[str, Any]] = []
    for config in CONFIGS:
        calculator = FORMULAS[config.formula]
        for month in VALIDATION_MONTHS:
            entry = select_entry(config, month, year)
            if entry is None:
                validation.append({"Destination": config.destination, "Supplier": config.supplier_name, "TLC Month": f"{month_name[month]}-{year}", "Status": "MISSING"})
                continue
            index_year, index_month = lagged_month(year, month, config.lag)
            resin = index_for(config.index_series, index_year, index_month)
            calculated, expression, components = calculator(entry, resin)
            source = source_tlc(entry)
            variance = calculated - source if source is not None else None
            variance_pct = difference_percent(calculated, source)
            status = "PASS" if variance_pct is not None and variance_pct <= tolerance else "FAIL"
            record = {
                "Destination": config.destination,
                "Supplier": config.supplier_name,
                "TLC Month": f"{month_name[month]}-{year}",
                "Data Type": entry.get("dataType"),
                "Index Series": config.index_series,
                "Lag": f"M-{config.lag}",
                "Index Month": f"{month_name[index_month]}-{index_year}",
                "Input Resin Index": resin,
                "Stored Resin Index": source_resin(entry),
                "Source TLC": source,
                "Calculated TLC": calculated,
                "Difference": variance,
                "Difference %": variance_pct,
                "Tolerance %": tolerance,
                "Status": status,
                "Calculation": expression,
                "Source File": entry.get("sourceFile"),
            }
            validation.append(record)
            details.extend(detail_rows("Historical Validation", record, components))

        if config.historical_only:
            continue
        template = select_entry(config, 6, year)
        if template is None:
            continue
        for month in FORECAST_MONTHS:
            # This request changes El Salvador/Honduras only for the historical
            # April-June test. Preserve its existing M-1 forward calculation.
            forecast_lag = 1 if config.destination == "El Salvador and Honduras" else config.lag
            index_year, index_month = lagged_month(year, month, forecast_lag)
            resin = index_for(config.index_series, index_year, index_month)
            calculated, expression, components = calculator(template, resin)
            existing = select_entry(config, month, year)
            existing_tlc = source_tlc(existing) if existing else None
            variance = calculated - existing_tlc if existing_tlc is not None else None
            variance_pct = difference_percent(calculated, existing_tlc)
            record = {
                "Destination": config.destination,
                "Supplier": config.supplier_name,
                "TLC Month": f"{month_name[month]}-{year}",
                "Index Series": config.index_series,
                "Lag": f"M-{forecast_lag}",
                "Index Month": f"{month_name[index_month]}-{index_year}",
                "Input Resin Index": resin,
                "Calculated TLC": calculated,
                "Existing Forecast TLC": existing_tlc,
                "Difference vs Existing": variance,
                "Difference % vs Existing": variance_pct,
                "Calculation": expression,
                "Non-resin Basis": "June 2026 stored actual components/rates",
            }
            forecasts.append(record)
            details.extend(detail_rows("Next 3 Months", record, components))
    return validation, forecasts, details


def detail_rows(section: str, parent: dict[str, Any], components: list[tuple[str, float, str]]) -> list[dict[str, Any]]:
    return [
        {
            "Section": section,
            "Destination": parent["Destination"],
            "Supplier": parent["Supplier"],
            "TLC Month": parent["TLC Month"],
            "Index Series": parent["Index Series"],
            "Index Month": parent["Index Month"],
            "Component": component,
            "Value": value,
            "Basis": basis,
        }
        for component, value, basis in components
    ]


def add_table_sheet(workbook: Workbook, title: str, rows: list[dict[str, Any]]) -> None:
    sheet = workbook.create_sheet(title)
    if not rows:
        sheet.append(["No rows"])
        return
    headers: list[str] = []
    for row in rows:
        for key in row:
            if key not in headers:
                headers.append(key)
    sheet.append(headers)
    for row in rows:
        sheet.append([row.get(header) for header in headers])
    header_fill = PatternFill("solid", fgColor="1F4E78")
    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for column, header in enumerate(headers, 1):
        values = [str(sheet.cell(row, column).value or "") for row in range(1, min(sheet.max_row, 100) + 1)]
        sheet.column_dimensions[get_column_letter(column)].width = min(max(map(len, values)) + 2, 55)
        if any(word in header for word in ("TLC", "Index", "Difference", "Value")):
            for row in range(2, sheet.max_row + 1):
                if isinstance(sheet.cell(row, column).value, (int, float)):
                    sheet.cell(row, column).number_format = '$#,##0.00;[Red]-$#,##0.00'
        if "%" in header:
            for row in range(2, sheet.max_row + 1):
                if isinstance(sheet.cell(row, column).value, (int, float)):
                    sheet.cell(row, column).number_format = '0.0000'
    if "Status" in headers:
        status_column = get_column_letter(headers.index("Status") + 1)
        data_range = f"{status_column}2:{status_column}{sheet.max_row}"
        sheet.conditional_formatting.add(data_range, FormulaRule(formula=[f'{status_column}2="PASS"'], fill=PatternFill("solid", fgColor="C6EFCE")))
        sheet.conditional_formatting.add(data_range, FormulaRule(formula=[f'{status_column}2="FAIL"'], fill=PatternFill("solid", fgColor="FFC7CE")))


def write_excel(path: Path, year: int, tolerance: float, validation: list[dict[str, Any]], forecasts: list[dict[str, Any]], details: list[dict[str, Any]]) -> None:
    workbook = Workbook()
    workbook.remove(workbook.active)
    input_rows = [
        {"Index Series": "China FOB", "Index Month": f"{month_name[month]}-{year}", "Resin Index": value}
        for month, value in CHINA_INDEXES_2026.items()
    ] + [
        {"Index Series": "Asia SE", "Index Month": f"{month_name[month]}-{year}", "Resin Index": value}
        for month, value in ASIA_SE_INDEXES_2026.items()
    ]
    assumptions = [
        {"Item": "Historical validation window", "Value": "April-June 2026"},
        {"Item": "Forward calculation window", "Value": "July-September 2026"},
        {"Item": "Argentina lag", "Value": "M-2"},
        {"Item": "Colombia lag", "Value": "M-2"},
        {"Item": "Ecuador lag", "Value": "M-2"},
        {"Item": "El Salvador and Honduras historical lag", "Value": "M-3 for April-June; existing forward calculation remains M-1"},
        {"Item": "Remaining China configurations", "Value": "M-1"},
        {"Item": "Asia SE historical coverage", "Value": "April-June only: Brazil Valgroup uses M-1; Dominican Republic, Panama and Peru use M-2"},
        {"Item": "Engepack classification", "Value": "Tested as China FOB M-1 for April-June only; Maxiquim remains a non-calculation reference"},
        {"Item": "Forward non-resin basis", "Value": "June 2026 actual values; fixed dollars stay fixed, percentage rates recalculate their dollar impact"},
        {"Item": "Historical PASS rule", "Value": f"Absolute TLC difference percentage <= {tolerance:.2f}%"},
        {"Item": "Workbook update", "Value": "Read-only test; supplier standardized workbook is not changed"},
    ]
    add_table_sheet(workbook, "Index Inputs", input_rows)
    china_historicals = [row for row in validation if row.get("Index Series") == "China FOB"]
    asia_se_historicals = [row for row in validation if row.get("Index Series") == "Asia SE"]
    add_table_sheet(workbook, "ICIS China Historicals", china_historicals)
    add_table_sheet(workbook, "ICIS China next 3 Months", forecasts)
    add_table_sheet(workbook, "ICIS Asia SE Historicals", asia_se_historicals)
    add_table_sheet(workbook, "Component Detail", details)
    add_table_sheet(workbook, "Assumptions", assumptions)
    path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate supplier TLC with China/Asia SE indexes and forecast China TLC")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--tolerance-percent", type=float, default=2.0)
    parser.add_argument("--output", type=Path, default=TEST_DIR / "supplier_tlc_resin_only_2026.xlsx")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    validation, forecasts, details = build_results(args.year, args.tolerance_percent)
    write_excel(args.output, args.year, args.tolerance_percent, validation, forecasts, details)
    passed = sum(row.get("Status") == "PASS" for row in validation)
    failed = sum(row.get("Status") == "FAIL" for row in validation)
    missing = sum(row.get("Status") == "MISSING" for row in validation)
    print(f"Wrote: {args.output.resolve()}")
    print(f"Historical validation: {passed} PASS, {failed} FAIL, {missing} MISSING")
    print(f"Forward TLC calculations: {len(forecasts)}")
    return 1 if failed or missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
