from __future__ import annotations

import argparse
import shutil
import sys
from collections import defaultdict
from copy import copy
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.data.market_research import build_market_research_countries
from app.data.supplier import build_vendor_breakdowns, entry_tlc_amount


DEFAULT_OUTPUT = (
    REPO_ROOT
    / "data"
    / "processed"
    / "current"
    / "opportunity"
    / "PET_Quantification_Breakdown_By_Destination.xlsx"
)

COMPONENTS = (
    "Resin Index",
    "Freight",
    "Insurance",
    "Duty & Import Taxes",
    "Local Taxes & Fees",
    "Logistics & Other Costs",
)
TOTAL_COMPONENT = "Total Landed Cost (PET Resin)"


@dataclass(frozen=True)
class Scenario:
    destination: str
    supplier: str
    location: str
    display_name: str
    volume: float | None


SCENARIOS = (
    Scenario("Colombia", "Amcor", "Colombia", "Amcor", 7_748),
    Scenario("Dominican Republic", "SMI PET", "Dominican Republic", "SMI PET", 3_331),
    Scenario("Ecuador", "Amcor", "Ecuador", "Amcor", 1_287),
    Scenario("El Salvador", "Amcor", "El Salvador and Honduras", "Amcor", 8_360),
    Scenario("Honduras", "Amcor", "El Salvador and Honduras", "Amcor", 16_710),
    Scenario("Panama", "Pastiglas S.A", "Panama", "Pastiglas", 1_357),
    Scenario("Peru", "Pastiglas S.A", "Peru", "Pastiglas", 5_084),
    Scenario("Argentina", "Amcor", "Argentina", "Amcor", 18_925),
    Scenario(
        "Bolivia",
        "Gestora, Administradora e Industrializadora Preformas S.A.",
        "Bolivia",
        "Gestora",
        2_500,
    ),
    Scenario("Uruguay", "Cristalpet", "Uruguay", "Cristalpet", 1_281),
    Scenario("Brazil", "Amcor", "MANAUS", "Amcor – Manaus", 16_912),
    Scenario("Brazil", "Amcor", "SUAPE", "Amcor – Suape", 16_912),
    Scenario("Brazil", "Engepack", "Brazil", "Engepack", 9_641),
    Scenario("Brazil", "Valgroup", "Brazil", "Valgroup", 27_922),
    # Cristalpet is retained in the reference sheet, but no approved volume was
    # supplied for it, so it is intentionally excluded from opportunity totals.
    Scenario("Brazil", "Cristalpet", "Brazil", "Cristalpet", None),
)


def normalized(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return 0.0


def is_no(value: Any) -> bool:
    return normalized(value) == "no"


def dedupe_rows(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, ...]] = set()
    for row in rows:
        key = (
            normalized(row.get("label")),
            normalized(row.get("rawLabel")),
            normalized(row.get("mappingColumn")),
            normalized(row.get("commonComponent")),
            str(row.get("amount")),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
    return result


def market_components(country: dict[str, Any]) -> tuple[float, dict[str, float]]:
    sums = defaultdict(float)
    total = None
    for row in dedupe_rows(country.get("breakdown", [])):
        component = str(row.get("commonComponent") or "").strip()
        amount = number(row.get("amount"))
        if component == TOTAL_COMPONENT:
            total = amount
            continue
        if component in COMPONENTS and not is_no(row.get("columnRequiredForCalculation")):
            sums[component] += amount
    if total is None:
        raise ValueError(f"Market TLC missing for {country.get('country')}")
    return total, {component: sums[component] for component in COMPONENTS}


SUPPLIER_RAW_MAPPING = {
    "finance": "Insurance",
    "freight china-buenaventura (regular)": "Freight",
    "freight china-buenaventura (incremental)": "Freight",
    "duty 5% (change according to regulation)": "Duty & Import Taxes",
    "landed factor 8%": "Local Taxes & Fees",
    "zf legislation change": "Local Taxes & Fees",
    "sur charge alpek br": "Logistics & Other Costs",
    "additional cost index china": "Duty & Import Taxes",
    "internalization cost": "Logistics & Other Costs",
    "taxes (vat/import)": "Duty & Import Taxes",
    "duties": "Duty & Import Taxes",
    "total resin price abi virgin formula": TOTAL_COMPONENT,
}

SUPPLIER_COLUMN_MAPPING = {
    "resin index vpet": "Resin Index",
    "resin index": "Resin Index",
    "index": "Resin Index",
    "freight": "Freight",
    "tax": "Local Taxes & Fees",
    "insurance": "Insurance",
    "others": "Logistics & Other Costs",
    "discount": "Logistics & Other Costs",
    "fx": "Logistics & Other Costs",
    "total landing cost": TOTAL_COMPONENT,
    "total landed cost (pet resin)": TOTAL_COMPONENT,
}

HIDDEN_SUPPLIER_ROWS = {
    "sub total (with incremental freight)",
    "sub total (with regular freight)",
    "sub total (cif)",
}


def mapped_supplier_component(row: dict[str, Any]) -> str:
    raw = normalized(row.get("rawLabel") or row.get("label"))
    label = normalized(row.get("label"))
    mapping = normalized(row.get("mappingColumn"))
    common = normalized(row.get("commonComponent"))
    if "total landing cost" in mapping or "total resin price abi virgin formula" in raw:
        return TOTAL_COMPONENT
    return (
        SUPPLIER_RAW_MAPPING.get(raw)
        or SUPPLIER_RAW_MAPPING.get(label)
        or SUPPLIER_COLUMN_MAPPING.get(mapping)
        or SUPPLIER_COLUMN_MAPPING.get(label)
        or SUPPLIER_COLUMN_MAPPING.get(common)
        or str(row.get("commonComponent") or row.get("mappingColumn") or row.get("label") or "")
    )


def supplier_components(entry: dict[str, Any]) -> tuple[float, dict[str, float], float]:
    rows = dedupe_rows(entry.get("rows", []))
    supplier_key = normalized(entry.get("supplier"))
    location_key = normalized(entry.get("location"))
    sums = defaultdict(float)
    rates: dict[str, float] = {}
    uruguay_base = 0.0

    for row in rows:
        raw = normalized(row.get("rawLabel") or row.get("label"))
        if raw in HIDDEN_SUPPLIER_ROWS:
            continue
        if supplier_key == "engepack" and raw == "maxiquim mme (m-1)":
            continue

        component = mapped_supplier_component(row)
        amount = number(row.get("amount"))
        if supplier_key == "cristalpet" and raw == "precio base de materia prima":
            uruguay_base = amount
            continue
        if normalized(row.get("valueFormat")) == "percentage":
            rates[raw] = amount
            continue
        if component in COMPONENTS or component == TOTAL_COMPONENT:
            sums[component] += amount

    total = entry_tlc_amount(entry)
    if total is None:
        raise ValueError(
            f"Supplier TLC missing for {entry.get('supplierName')} / {entry.get('location')}"
        )

    if supplier_key == "valgroup":
        resin = sums["Resin Index"]
        freight = sums["Freight"]
        discount_impact = -(resin * rates.get("discount", 0.0))
        tax_base = resin + discount_impact + freight
        tax_impact = tax_base * (
            rates.get("importation", 0.0) + rates.get("import tax", 0.0)
        )
        sums["Local Taxes & Fees"] = tax_impact
        sums["Logistics & Other Costs"] += discount_impact

    if supplier_key == "cristalpet":
        resin = sums["Resin Index"]
        freight = sums["Freight"]
        tax_rate = rates.get("tax", rates.get("gasto de internacion y puesta en silos", 0.0))
        tax_base = uruguay_base if uruguay_base else resin + freight
        sums["Local Taxes & Fees"] = tax_base * tax_rate

    if supplier_key == "gestora, administradora e industrializadora preformas s.a.":
        rate = rates.get("other cost ( cdp)", 0.0) + rates.get("other cost (bank fee)", 0.0)
        sums["Duty & Import Taxes"] = (sums["Resin Index"] + sums["Freight"]) * rate

    if supplier_key == "engepack" and location_key == "brazil":
        resin = sums["Resin Index"]
        freight = sums["Freight"]
        # Formula used by the supplier model:
        # ((resin + 100 + freight) * 1.20) + 125 + (freight * 0.08)
        sums["Duty & Import Taxes"] = (resin + 100.0 + freight) * 0.20
        sums["Logistics & Other Costs"] = 100.0 + 125.0 + (freight * 0.08)

    component_sum = sum(sums[component] for component in COMPONENTS)
    adjustment = float(total) - component_sum
    return (
        float(total),
        {component: sums[component] for component in COMPONENTS},
        adjustment,
    )


def find_supplier_entry(
    scenario: Scenario,
    entries: Iterable[dict[str, Any]],
    month: str,
    year: int,
) -> dict[str, Any]:
    candidates = [
        entry
        for entry in entries
        if normalized(entry.get("supplier")) == normalized(scenario.supplier)
        and normalized(entry.get("location")) == normalized(scenario.location)
        and str(entry.get("month")) == month
        and str(entry.get("year")) == str(year)
        and normalized(entry.get("dataType")) == "actual"
    ]
    if not candidates:
        raise ValueError(
            f"September Actual supplier row missing: {scenario.destination} / "
            f"{scenario.supplier} / {scenario.location}"
        )
    return max(candidates, key=lambda entry: entry_tlc_amount(entry) or 0.0)


def period_label(month: str, year: int) -> str:
    return f"{month} {year}"


def calculate_records(
    month: str,
    year: int,
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    summaries: list[dict[str, Any]] = []
    breakdowns: dict[str, list[dict[str, Any]]] = defaultdict(list)

    scenarios_by_destination: dict[str, list[Scenario]] = defaultdict(list)
    for scenario in SCENARIOS:
        scenarios_by_destination[scenario.destination].append(scenario)

    for destination, scenarios in scenarios_by_destination.items():
        market_options = build_market_research_countries(destination, month, str(year))
        actual_market_options = [
            option
            for option in market_options
            if normalized(option.get("dataType")) == "actual"
        ]
        if not actual_market_options:
            raise ValueError(f"No Actual market routes found for {destination} / {month} {year}")

        exact_options: list[tuple[float, dict[str, float], dict[str, Any]]] = []
        for option in actual_market_options:
            market_tlc, market_costs = market_components(option)
            exact_options.append((market_tlc, market_costs, option))
        market_tlc, market_costs, selected_market = min(exact_options, key=lambda item: item[0])

        source_countries = tuple(str(option.get("country")) for option in actual_market_options)
        vendor_entries = build_vendor_breakdowns(source_countries, destination)

        for scenario in scenarios:
            supplier_entry = find_supplier_entry(scenario, vendor_entries, month, year)
            supplier_tlc, supplier_costs, adjustment = supplier_components(supplier_entry)
            delta = market_tlc - supplier_tlc
            volume = scenario.volume
            current_spend = supplier_tlc * volume if volume is not None else None
            alternative_spend = market_tlc * volume if volume is not None else None
            opportunity = (supplier_tlc - market_tlc) * volume if volume is not None else None

            component_rows: list[dict[str, Any]] = []
            for component in COMPONENTS:
                market_cost = market_costs[component]
                supplier_cost = supplier_costs[component]
                difference = market_cost - supplier_cost
                impact = difference * volume if volume is not None else None
                savings = -impact if impact is not None else None
                if difference < -1e-9:
                    interpretation = "Savings contribution"
                elif difference > 1e-9:
                    interpretation = "Offsets savings / increases cost"
                else:
                    interpretation = "No impact"
                component_rows.append(
                    {
                        "destination": destination,
                        "supplier": scenario.display_name,
                        "volume": volume,
                        "source": selected_market.get("country"),
                        "component": component,
                        "market": market_cost,
                        "supplier_cost": supplier_cost,
                        "difference": difference,
                        "impact": impact,
                        "savings": savings,
                        "interpretation": interpretation,
                    }
                )

            if abs(adjustment) > 0.005:
                impact = -adjustment * volume if volume is not None else None
                component_rows.append(
                    {
                        "destination": destination,
                        "supplier": scenario.display_name,
                        "volume": volume,
                        "source": selected_market.get("country"),
                        "component": "Stored TLC / rounding adjustment",
                        "market": None,
                        "supplier_cost": None,
                        "difference": -adjustment,
                        "impact": impact,
                        "savings": -impact if impact is not None else None,
                        "interpretation": "Reconciles calculated components to the stored TLC",
                    }
                )

            total_impact = delta * volume if volume is not None else None
            component_rows.append(
                {
                    "destination": destination,
                    "supplier": scenario.display_name,
                    "volume": volume,
                    "source": selected_market.get("country"),
                    "component": TOTAL_COMPONENT,
                    "market": market_tlc,
                    "supplier_cost": supplier_tlc,
                    "difference": delta,
                    "impact": total_impact,
                    "savings": -total_impact if total_impact is not None else None,
                    "interpretation": (
                        "Total savings opportunity" if opportunity is not None and opportunity > 0
                        else "Total cost increase" if opportunity is not None and opportunity < 0
                        else "No volume supplied"
                    ),
                }
            )
            breakdowns[destination].extend(component_rows)

            if volume is None:
                continue
            driver_row = max(
                (row for row in component_rows if row["component"] in COMPONENTS),
                key=lambda row: abs(float(row["supplier_cost"]) - float(row["market"])),
            )
            driver_gap = float(driver_row["supplier_cost"]) - float(driver_row["market"])
            if driver_gap > 0:
                driver_interpretation = f"Supplier higher by ${driver_gap:,.2f}/MT"
            elif driver_gap < 0:
                driver_interpretation = f"Market higher by ${abs(driver_gap):,.2f}/MT"
            else:
                driver_interpretation = "No component gap"

            summaries.append(
                {
                    "destination": destination,
                    "supplier": scenario.display_name,
                    "volume": volume,
                    "supplier_period": period_label(month, year),
                    "supplier_type": supplier_entry.get("dataType"),
                    "supplier_tlc": supplier_tlc,
                    "source": selected_market.get("country"),
                    "market_period": period_label(month, year),
                    "market_type": selected_market.get("dataType"),
                    "market_tlc": market_tlc,
                    "delta": delta,
                    "current_spend": current_spend,
                    "alternative_spend": alternative_spend,
                    "opportunity": opportunity,
                    "status": "SAVINGS OPPORTUNITY" if opportunity > 0 else "COST INCREASE",
                    "selection_rule": (
                        "Most negative Market - Supplier delta"
                        if delta < 0
                        else "Lowest positive Market - Supplier delta"
                    ),
                    "driver": driver_row["component"],
                    "supplier_driver": driver_row["supplier_cost"],
                    "market_driver": driver_row["market"],
                    "driver_gap": driver_gap,
                    "driver_interpretation": driver_interpretation,
                }
            )

    return summaries, breakdowns


HEADER_FILL = PatternFill("solid", fgColor="EAF0F3")
TITLE_FILL = PatternFill("solid", fgColor="1F2937")
TITLE_FONT = Font(color="FFFFFF", bold=True, size=14)
HEADER_FONT = Font(bold=True, color="111827")
SUCCESS_FILL = PatternFill("solid", fgColor="DCFCE7")
WARNING_FILL = PatternFill("solid", fgColor="FEE2E2")
YELLOW_FILL = PatternFill("solid", fgColor="FFF8CC")
THIN_BORDER = Border(
    left=Side(style="thin", color="D1D5DB"),
    right=Side(style="thin", color="D1D5DB"),
    top=Side(style="thin", color="D1D5DB"),
    bottom=Side(style="thin", color="D1D5DB"),
)


def style_header(ws: Any, row: int, columns: int) -> None:
    for cell in ws[row][:columns]:
        cell.fill = copy(HEADER_FILL)
        cell.font = copy(HEADER_FONT)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = copy(THIN_BORDER)
    ws.row_dimensions[row].height = 36


def style_data_range(ws: Any, start_row: int, end_row: int, columns: int) -> None:
    for row in ws.iter_rows(min_row=start_row, max_row=end_row, min_col=1, max_col=columns):
        for cell in row:
            cell.border = copy(THIN_BORDER)
            cell.alignment = Alignment(vertical="top", wrap_text=True)


def set_widths(ws: Any, widths: list[float]) -> None:
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width


def write_summary_sheet(wb: Workbook, summaries: list[dict[str, Any]]) -> None:
    ws = wb.create_sheet("Summary_Opportunity")
    headers = (
        "Destination Country",
        "Current Supplier / Location",
        "Volume",
        "Supplier Period",
        "Supplier Data Type",
        "Current Supplier TLC ($/MT)",
        "Selected Alternative Source Country",
        "Market Period",
        "Market Data Type",
        "Lowest Alternative Market TLC ($/MT)",
        "Market - Supplier TLC Delta ($/MT)",
        "Current Supplier Spend ($)",
        "Alternative Market Spend ($)",
        "Estimated Opportunity / (Cost Increase) ($)",
        "Status",
        "Route Selection Rule",
        "Primary Cost Driver",
        "Supplier Driver Cost ($/MT)",
        "Market Driver Cost ($/MT)",
        "Driver Gap: Supplier - Market ($/MT)",
        "Driver Interpretation",
    )
    ws.append(headers)
    for item in summaries:
        ws.append(
            (
                item["destination"], item["supplier"], item["volume"],
                item["supplier_period"], item["supplier_type"], item["supplier_tlc"],
                item["source"], item["market_period"], item["market_type"], item["market_tlc"],
                item["delta"], item["current_spend"], item["alternative_spend"],
                item["opportunity"], item["status"], item["selection_rule"], item["driver"],
                item["supplier_driver"], item["market_driver"], item["driver_gap"],
                item["driver_interpretation"],
            )
        )
    style_header(ws, 1, len(headers))
    style_data_range(ws, 2, ws.max_row, len(headers))
    for row in range(2, ws.max_row + 1):
        ws.cell(row, 3).number_format = "#,##0"
        for col in (6, 10, 11, 17, 18, 19, 20):
            ws.cell(row, col).number_format = '$#,##0.00;[Red]-$#,##0.00'
        for col in (12, 13, 14):
            ws.cell(row, col).number_format = '$#,##0;[Red]-$#,##0'
        ws.cell(row, 15).fill = copy(
            SUCCESS_FILL if ws.cell(row, 14).value and ws.cell(row, 14).value > 0 else WARNING_FILL
        )
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    set_widths(ws, [18, 24, 12, 18, 16, 19, 23, 18, 16, 22, 20, 20, 20, 24, 21, 28, 24, 21, 21, 23, 31])


def write_actuals_reference(
    wb: Workbook,
    summaries: list[dict[str, Any]],
    breakdowns: dict[str, list[dict[str, Any]]],
    month: str,
    year: int,
) -> None:
    ws = wb.create_sheet("Actuals_Reference", 0)
    headers = (
        "Destination", "Supplier/location", "Volume", "Actual TLC ($/MT)",
        "Volume × TLC", "Spend ($M)", "PET Preforms 25 Spend", "Spend / Reference",
        "Period", "Opportunity ($M)", "% of Current Spend",
    )
    ws.append(headers)
    non_brazil = [item for item in summaries if item["destination"] != "Brazil"]
    for item in non_brazil:
        spend = item["current_spend"]
        opportunity = item["opportunity"]
        ws.append(
            (
                item["destination"], item["supplier"], item["volume"], item["supplier_tlc"],
                spend, spend / 1_000_000, None, None, period_label(month, year),
                opportunity / 1_000_000, opportunity / spend if spend else None,
            )
        )

    ws.append(())
    ws.append(("Brazil Supplier Scenarios",))
    ws.append(("Supplier/location", "Volume", "Actual TLC ($/MT)", "Volume × TLC", "Spend ($M)"))
    brazil = [item for item in summaries if item["destination"] == "Brazil"]
    for item in brazil:
        ws.append(
            (
                item["supplier"], item["volume"], item["supplier_tlc"],
                item["current_spend"], item["current_spend"] / 1_000_000,
            )
        )

    cristalpet_rows = [
        row for row in breakdowns["Brazil"]
        if row["supplier"] == "Cristalpet" and row["component"] == TOTAL_COMPONENT
    ]
    if cristalpet_rows:
        ws.append(("Cristalpet", "N/A", cristalpet_rows[0]["supplier_cost"], "N/A"))

    style_header(ws, 1, len(headers))
    brazil_header_row = 2 + len(non_brazil) + 2
    ws.cell(brazil_header_row - 1, 1).font = Font(bold=True, size=12)
    style_header(ws, brazil_header_row, 5)
    style_data_range(ws, 2, 1 + len(non_brazil), len(headers))
    style_data_range(ws, brazil_header_row + 1, ws.max_row, 5)
    for row in range(2, ws.max_row + 1):
        ws.cell(row, 3).number_format = "#,##0"
        ws.cell(row, 4).number_format = '$#,##0.00;[Red]-$#,##0.00'
        ws.cell(row, 5).number_format = '$#,##0;[Red]-$#,##0'
        ws.cell(row, 6).number_format = '$0.00'
        ws.cell(row, 10).number_format = '$0.00'
        ws.cell(row, 11).number_format = "0.0%"
    ws.freeze_panes = "A2"
    set_widths(ws, [23, 25, 13, 19, 20, 14, 20, 17, 18, 18, 20])


BREAKDOWN_HEADERS = (
    "Destination Country",
    "Current Supplier / Location",
    "Volume",
    "Selected Alternative Source Country",
    "Common Component",
    "Market Research ($/MT)",
    "Supplier ($/MT)",
    "Difference: Market - Supplier ($/MT)",
    "Calculation",
    "Impact: (Market - Supplier) × Volume ($)",
    "Savings Contribution: (Supplier - Market) × Volume ($)",
    "Interpretation",
)


def calculation_text(difference: float, volume: float | None) -> str:
    if volume is None:
        return "No approved volume supplied"
    return f"{difference:+,.2f} × {volume:,.0f} = {difference * volume:+,.2f}"


def write_breakdown_sheets(
    wb: Workbook,
    summaries: list[dict[str, Any]],
    breakdowns: dict[str, list[dict[str, Any]]],
    month: str,
    year: int,
) -> None:
    summary_by_key = {
        (item["destination"], item["supplier"]): item for item in summaries
    }
    destination_order = list(dict.fromkeys(scenario.destination for scenario in SCENARIOS))
    for destination in destination_order:
        ws = wb.create_sheet(destination)
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(BREAKDOWN_HEADERS))
        title = ws.cell(1, 1)
        title.value = f"{destination} – Sourcing Opportunity Component Breakdown – {month} {year}"
        title.fill = copy(TITLE_FILL)
        title.font = copy(TITLE_FONT)
        title.alignment = Alignment(vertical="center")
        ws.row_dimensions[1].height = 26
        ws.append(BREAKDOWN_HEADERS)
        style_header(ws, 2, len(BREAKDOWN_HEADERS))

        for item in breakdowns[destination]:
            difference = float(item["difference"])
            ws.append(
                (
                    item["destination"], item["supplier"], item["volume"], item["source"],
                    item["component"], item["market"], item["supplier_cost"], difference,
                    calculation_text(difference, item["volume"]), item["impact"], item["savings"],
                    item["interpretation"],
                )
            )

        data_end = ws.max_row
        style_data_range(ws, 3, data_end, len(BREAKDOWN_HEADERS))
        for row in range(3, data_end + 1):
            ws.cell(row, 3).number_format = "#,##0"
            for col in (6, 7, 8, 10, 11):
                ws.cell(row, col).number_format = '$#,##0.00;[Red]-$#,##0.00'
            if ws.cell(row, 5).value == TOTAL_COMPONENT:
                for cell in ws[row][: len(BREAKDOWN_HEADERS)]:
                    cell.font = Font(bold=True)
                    cell.fill = copy(HEADER_FILL)

        if destination == "Brazil":
            ws.append(())
            heading_row = ws.max_row + 1
            ws.cell(heading_row, 1, "Brazil Spend Validation – Amcor Location Scenarios")
            ws.cell(heading_row, 1).font = Font(bold=True, size=12)
            ws.append((
                "Amcor Manaus and Suape use the same 16,912 MT volume and are alternative scenarios; "
                "they must not be added together.",
            ))
            ws.append(("Metric", "Manaus Scenario", "Suape Scenario"))
            style_header(ws, ws.max_row, 3)
            manaus = summary_by_key[("Brazil", "Amcor – Manaus")]
            suape = summary_by_key[("Brazil", "Amcor – Suape")]
            other = [
                item for item in summaries
                if item["destination"] == "Brazil" and not item["supplier"].startswith("Amcor")
            ]
            for metric, m_value, s_value in (
                ("Unique Brazil supplier volume (MT)", manaus["volume"] + sum(x["volume"] for x in other), suape["volume"] + sum(x["volume"] for x in other)),
                ("Current supplier spend ($)", manaus["current_spend"] + sum(x["current_spend"] for x in other), suape["current_spend"] + sum(x["current_spend"] for x in other)),
                ("Alternative market spend ($)", manaus["alternative_spend"] + sum(x["alternative_spend"] for x in other), suape["alternative_spend"] + sum(x["alternative_spend"] for x in other)),
                ("Estimated sourcing opportunity ($)", manaus["opportunity"] + sum(x["opportunity"] for x in other), suape["opportunity"] + sum(x["opportunity"] for x in other)),
            ):
                ws.append((metric, m_value, s_value))
            for row in range(ws.max_row - 3, ws.max_row + 1):
                ws.cell(row, 2).number_format = '$#,##0.00;[Red]-$#,##0.00'
                ws.cell(row, 3).number_format = '$#,##0.00;[Red]-$#,##0.00'

        ws.freeze_panes = "A3"
        ws.auto_filter.ref = f"A2:L{data_end}"
        set_widths(ws, [18, 24, 13, 23, 28, 19, 19, 23, 34, 25, 27, 34])


def validate_output(
    summaries: list[dict[str, Any]],
    breakdowns: dict[str, list[dict[str, Any]]],
) -> None:
    if len(summaries) != 14:
        raise ValueError(f"Expected 14 opportunity scenarios, found {len(summaries)}")
    if len({item["destination"] for item in summaries}) != 11:
        raise ValueError("Expected all 11 destination countries")
    for item in summaries:
        expected = (item["supplier_tlc"] - item["market_tlc"]) * item["volume"]
        if abs(expected - item["opportunity"]) > 0.01:
            raise ValueError(f"Opportunity does not reconcile: {item}")
        total_rows = [
            row for row in breakdowns[item["destination"]]
            if row["supplier"] == item["supplier"] and row["component"] == TOTAL_COMPONENT
        ]
        if len(total_rows) != 1:
            raise ValueError(f"Missing unique breakdown total for {item['supplier']}")
        if abs(float(total_rows[0]["savings"]) - item["opportunity"]) > 0.01:
            raise ValueError(f"Breakdown does not reconcile: {item['supplier']}")


def write_workbook(
    output: Path,
    summaries: list[dict[str, Any]],
    breakdowns: dict[str, list[dict[str, Any]]],
    month: str,
    year: int,
) -> None:
    workbook = Workbook()
    workbook.remove(workbook.active)
    write_summary_sheet(workbook, summaries)
    write_actuals_reference(workbook, summaries, breakdowns, month, year)
    # Restore the sheet order expected by the backend reader and users.
    summary_sheet = workbook["Summary_Opportunity"]
    workbook._sheets.remove(summary_sheet)
    workbook._sheets.insert(1, summary_sheet)
    write_breakdown_sheets(workbook, summaries, breakdowns, month, year)
    output.parent.mkdir(parents=True, exist_ok=True)
    workbook.calculation.fullCalcOnLoad = True
    workbook.calculation.forceFullCalc = True
    workbook.calculation.calcMode = "auto"
    workbook.save(output)
    workbook.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Refresh the stakeholder Opportunity workbook from frontend data models."
    )
    parser.add_argument("--month", default="September")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not back up an existing output workbook before replacement.",
    )
    args = parser.parse_args()
    output = args.output.resolve()

    summaries, breakdowns = calculate_records(args.month, args.year)
    validate_output(summaries, breakdowns)

    backup = None
    if output.exists() and not args.no_backup:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = output.with_name(f"{output.stem}.backup_before_{args.month.lower()}_{args.year}_{stamp}.xlsx")
        shutil.copy2(output, backup)

    write_workbook(output, summaries, breakdowns, args.month, args.year)
    total_opportunity = sum(item["opportunity"] for item in summaries if item["destination"] != "Brazil")
    brazil_other = [
        item for item in summaries
        if item["destination"] == "Brazil" and not item["supplier"].startswith("Amcor")
    ]
    amcor = [item for item in summaries if item["destination"] == "Brazil" and item["supplier"].startswith("Amcor")]
    brazil_base = sum(item["opportunity"] for item in brazil_other)
    low = total_opportunity + brazil_base + min(item["opportunity"] for item in amcor)
    high = total_opportunity + brazil_base + max(item["opportunity"] for item in amcor)

    print(f"Wrote: {output}")
    if backup:
        print(f"Backup: {backup}")
    print(f"Period: {args.month} {args.year} Actual")
    print(f"Scenarios: {len(summaries)} across {len(set(x['destination'] for x in summaries))} destinations")
    print(f"Directional opportunity range: ${low:,.2f} to ${high:,.2f}")


if __name__ == "__main__":
    main()
