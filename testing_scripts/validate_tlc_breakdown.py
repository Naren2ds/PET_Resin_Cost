"""
validate_tlc_breakdown.py
=========================
Validates that the sum of individual cost components in the deep-dive breakdown
table equals the Total Landed Cost (PET Resin) row, for BOTH the Market Research
and Supplier columns — for every destination / month / year / source-country
combination present in the data.

Mirrors the exact component-mapping logic from BreakdownTable.tsx so the
validation is end-to-end consistent with what the UI displays.

Usage
-----
    python validate_tlc_breakdown.py
    python validate_tlc_breakdown.py --destination Colombia --month March --year 2026
    python validate_tlc_breakdown.py --tolerance 0.5   # allow up to $0.5 rounding
    python validate_tlc_breakdown.py --excel           # export results to Excel
    python validate_tlc_breakdown.py --excel --output-excel report.xlsx
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Component mappings — mirrors BreakdownTable.tsx exactly
# ---------------------------------------------------------------------------

COMMON_COMPONENTS = [
    "Resin Index",
    "Freight",
    "Insurance",
    "Duty & Import Taxes",
    "Local Taxes & Fees",
    "Logistics & Other Costs",
]
TLC_COMPONENT = "Total Landed Cost (PET Resin)"

# Supplier row label → common component  (SUPPLIER_MAPPING in BreakdownTable.tsx)
SUPPLIER_MAPPING: dict[str, str] = {
    "icis china mid (n-1)": "Resin Index",
    "finance": "Insurance",
    "freight china-buenaventura (regular)": "Freight",
    "freight china-buenaventura (incremental)": "Freight",
    "duty 5% (change according to regulation)": "Duty & Import Taxes",
    "landed factor 8%": "Local Taxes & Fees",
    "zf legislation change": "Local Taxes & Fees",
    "sur charge alpek br": "Logistics & Other Costs",
    "total resin price abi virgin formula": TLC_COMPONENT,
}

# Supplier fallback (DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING)
SUPPLIER_FALLBACK_MAPPING: dict[str, str] = {
    "resin index vpet": "Resin Index",
    "freight": "Freight",
    "tax": "Duty & Import Taxes",
    "insurance": "Insurance",
}

# Market Research: mappingColumn → common component (MARKET_COLUMN_MAPPING)
MARKET_COLUMN_MAPPING: dict[str, str] = {
    "resin index vpet": "Resin Index",
    "freight": "Freight",
    "insurance": "Insurance",
    "tax": "Duty & Import Taxes",
    "customs clearance": "Local Taxes & Fees",
    "others": "Logistics & Other Costs",
    "total landing cost": TLC_COMPONENT,
}

# Market Research: raw label → common component (MARKET_MAPPING)
MARKET_MAPPING: dict[str, str] = {
    "pet resin cost (fob)": "Resin Index",
    "pet resin cost (fob):": "Resin Index",
    "freight cost": "Freight",
    "freight cost:": "Freight",
    "insurance": "Insurance",
    "import duty": "Duty & Import Taxes",
    "import duty:": "Duty & Import Taxes",
    "anti-dumping duty": "Duty & Import Taxes",
    "anti-dumping duty:": "Duty & Import Taxes",
    "ipi": "Duty & Import Taxes",
    "pis": "Duty & Import Taxes",
    "confins": "Duty & Import Taxes",
    "statistical fee": "Duty & Import Taxes",
    "additional vat": "Duty & Import Taxes",
    "income tax perception": "Duty & Import Taxes",
    "ibb": "Duty & Import Taxes",
    "tasa consular": "Duty & Import Taxes",
    "customs service fee": "Local Taxes & Fees",
    "irae": "Local Taxes & Fees",
    "customs insurance": "Insurance",
    "impuesto general a las ventas (igv & ipm)": "Duty & Import Taxes",
    "percepcion igv": "Duty & Import Taxes",
    "fodinfa": "Duty & Import Taxes",
    "taxes (vat/import)": "Duty & Import Taxes",
    "taxes (vat/import):": "Duty & Import Taxes",
    "destination port to supplier location transportation": "Freight",
    "total landed cost (pet resin)": TLC_COMPONENT,
}

HIDDEN_MARKET_LABELS = {
    "difference with current vpet resin price charged by preform supplier"
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize(label: str | None) -> str:
    """Lower-case, strip, remove accents — matches TS normalize()."""
    import unicodedata
    s = (label or "").strip().lower()
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def to_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value) if isinstance(value, float) and value == value else float(value)
    if not isinstance(value, str):
        return None
    cleaned = value.strip().replace(",", "")
    if not cleaned or cleaned.lower() in ("n/a", "-", ""):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def map_supplier_row(row: dict) -> str | None:
    """Return common component name for a supplier breakdown row, or None to skip."""
    key = normalize(row.get("label", ""))
    common = row.get("commonComponent", "")
    if common:
        return common
    return (
        SUPPLIER_MAPPING.get(key)
        or SUPPLIER_FALLBACK_MAPPING.get(key)
        or row.get("mappingColumn")
        or None
    )


def map_market_row(row: dict) -> str | None:
    """Return common component name for a market research breakdown row, or None to skip."""
    label_key = normalize(row.get("label", ""))
    raw_label_key = normalize(row.get("rawLabel", ""))
    mapping_col_key = normalize(row.get("mappingColumn", ""))

    if label_key in HIDDEN_MARKET_LABELS:
        return None
    if row.get("columnRequiredForCalculation", "").strip().lower() == "no":
        return None

    common = row.get("commonComponent", "")
    if common:
        return common
    return (
        MARKET_COLUMN_MAPPING.get(mapping_col_key)
        or MARKET_MAPPING.get(raw_label_key)
        or MARKET_MAPPING.get(label_key)
        or None
    )


# ---------------------------------------------------------------------------
# Core validation
# ---------------------------------------------------------------------------

class ValidationRow:
    """Single validated entry (both matches and mismatches)."""
    def __init__(
        self,
        kind: str,
        destination: str,
        month: str,
        year: str,
        source_country: str,
        supplier: str,
        component_totals: dict[str, float],
        component_sum: float,
        tlc: float,
        diff: float,
        unmapped_rows: list[str],
        status: str,  # "OK" or "MISMATCH"
    ):
        self.kind = kind
        self.destination = destination
        self.month = month
        self.year = year
        self.source_country = source_country
        self.supplier = supplier
        self.component_totals = component_totals
        self.component_sum = component_sum
        self.tlc = tlc
        self.diff = diff
        self.unmapped_rows = unmapped_rows
        self.status = status

    def __str__(self) -> str:
        tag = f"[{self.kind}] {self.destination} / {self.source_country} / {self.month} {self.year} / {self.supplier}"
        detail = (
            f"  Component sum = ${self.component_sum:.1f}  |  TLC = ${self.tlc:.1f}"
            f"  |  diff = ${self.diff:+.1f}"
        )
        unmapped = (
            f"  Unmapped rows (excluded from sum): {self.unmapped_rows}"
            if self.unmapped_rows
            else ""
        )
        return "\n".join(filter(None, [tag, detail, unmapped]))

# Keep Mismatch as an alias for backwards compatibility
Mismatch = ValidationRow


def validate_supplier_entry(
    entry: dict,
    destination: str,
    month: str,
    year: str,
    tolerance: float,
) -> ValidationRow | None:
    """Validate one vendor breakdown entry. Returns a row for every entry (OK or MISMATCH)."""
    source_country = str(entry.get("sourceCountry", "")).strip()
    supplier = str(
        entry.get("supplierName") or entry.get("supplier") or entry.get("vendor") or "Unknown"
    ).strip()

    component_totals: dict[str, float] = {c: 0.0 for c in COMMON_COMPONENTS}
    tlc: float | None = None
    unmapped: list[str] = []

    for row in entry.get("rows", []):
        value = to_number(row.get("amount"))
        if value is None:
            continue
        component = map_supplier_row(row)
        if component == TLC_COMPONENT:
            tlc = value
        elif component in component_totals:
            component_totals[component] += value
        else:
            unmapped.append(f"{row.get('label', '?')} (${value:.1f})")

    if tlc is None:
        return None  # No TLC row found — skip silently

    component_sum = sum(component_totals.values())
    diff = component_sum - tlc
    status = "MISMATCH" if abs(diff) > tolerance else "OK"

    return ValidationRow(
        kind="SUPPLIER",
        destination=destination,
        month=month,
        year=year,
        source_country=source_country,
        supplier=supplier,
        component_totals={k: round(v, 1) for k, v in component_totals.items()},
        component_sum=round(component_sum, 1),
        tlc=round(tlc, 1),
        diff=round(diff, 1),
        unmapped_rows=unmapped,
        status=status,
    )


def validate_market_entry(
    country: dict,
    destination: str,
    month: str,
    year: str,
    tolerance: float,
) -> ValidationRow | None:
    """Validate one market research country entry. Returns a row for every entry."""
    source_country = str(country.get("country", "")).strip()

    component_totals: dict[str, float] = {c: 0.0 for c in COMMON_COMPONENTS}
    tlc: float | None = None
    unmapped: list[str] = []

    for row in country.get("breakdown", []):
        value = to_number(row.get("amount"))
        if value is None:
            continue
        component = map_market_row(row)
        if component == TLC_COMPONENT:
            tlc = value
        elif component in component_totals:
            component_totals[component] += value
        else:
            unmapped.append(f"{row.get('label', '?')} (${value:.1f})")

    if tlc is None:
        tlc = to_number(country.get("amount"))

    if tlc is None:
        return None

    component_sum = sum(component_totals.values())
    diff = component_sum - tlc
    status = "MISMATCH" if abs(diff) > tolerance else "OK"

    return ValidationRow(
        kind="MARKET",
        destination=destination,
        month=month,
        year=year,
        source_country=source_country,
        supplier="Market Research",
        component_totals={k: round(v, 1) for k, v in component_totals.items()},
        component_sum=round(component_sum, 1),
        tlc=round(tlc, 1),
        diff=round(diff, 1),
        unmapped_rows=unmapped,
        status=status,
    )


def run_validation(
    destination_filter: str | None = None,
    month_filter: str | None = None,
    year_filter: str | None = None,
    tolerance: float = 0.15,
) -> tuple[int, int, list[ValidationRow]]:
    """
    Run full validation across all available destinations/periods.

    Returns (total_checked, total_mismatches, all_rows).
    """
    from main import countries as get_countries
    from market_research_data_model import (
        available_destinations,
        available_periods_for_destination,
    )

    destinations = available_destinations()
    if destination_filter:
        destinations = [d for d in destinations if d.lower() == destination_filter.lower()]

    all_rows: list[ValidationRow] = []

    for destination in destinations:
        periods = available_periods_for_destination(destination)

        for month, year in periods:
            year_str = str(year)

            if month_filter and month.lower() != month_filter.lower():
                continue
            if year_filter and year_str != year_filter:
                continue

            payload = get_countries(
                destination=destination,
                month=month,
                year=year_str,
                includeVendorBreakdowns=True,
            )

            # --- Market Research validation (one row per source country for this period) ---
            for country in payload.get("countries", []):
                row = validate_market_entry(country, destination, month, year_str, tolerance)
                if row:
                    all_rows.append(row)

            # --- Supplier validation ---
            # Filter to ONLY entries matching the current period to avoid counting
            # the same supplier/source across every historical month.
            period_entries: dict[tuple[str, str], dict] = {}
            for entry in payload.get("vendorBreakdowns", []):
                if entry.get("destination") != destination:
                    continue
                entry_month = str(entry.get("month", "")).strip().lower()
                entry_year = str(entry.get("year", "")).strip()
                if entry_month != month.lower() or entry_year != year_str:
                    continue
                # De-duplicate: prefer Actual over Forecast; keep last seen if tie
                source = str(entry.get("sourceCountry", "")).strip()
                supplier = str(
                    entry.get("supplierName") or entry.get("supplier") or entry.get("vendor") or "Unknown"
                ).strip()
                key = (supplier, source)
                existing = period_entries.get(key)
                if existing is None:
                    period_entries[key] = entry
                else:
                    # Prefer Actual over Forecast
                    existing_is_forecast = str(existing.get("dataType", "")).strip().lower() == "forecast"
                    entry_is_forecast = str(entry.get("dataType", "")).strip().lower() == "forecast"
                    if existing_is_forecast and not entry_is_forecast:
                        period_entries[key] = entry

            for entry in period_entries.values():
                row = validate_supplier_entry(entry, destination, month, year_str, tolerance)
                if row:
                    all_rows.append(row)

    total_checked = len(all_rows)
    mismatches = [r for r in all_rows if r.status == "MISMATCH"]

    # --- Console report ---
    print(f"\n{'='*70}")
    print(f"TLC Breakdown Validation Report")
    print(f"{'='*70}")
    print(f"Tolerance : +/-${tolerance}")
    print(f"Filter    : destination={destination_filter or 'ALL'}  month={month_filter or 'ALL'}  year={year_filter or 'ALL'}")
    print(f"Checked   : {total_checked} entries")
    print(f"Mismatches: {len(mismatches)}")
    print(f"{'='*70}\n")

    if not mismatches:
        print("All component sums match their Total Landed Cost rows.\n")
    else:
        for m in mismatches:
            print(m)
            print()

    return total_checked, len(mismatches), all_rows


# ---------------------------------------------------------------------------
# Excel export
# ---------------------------------------------------------------------------

def export_to_excel(all_rows: list[ValidationRow], output_path: Path) -> None:
    """Write validation results to a styled Excel workbook."""
    try:
        import openpyxl
        from openpyxl.styles import (
            Alignment, Border, Font, PatternFill, Side,
        )
        from openpyxl.utils import get_column_letter
    except ImportError:
        print("openpyxl not installed. Run: pip install openpyxl")
        return

    wb = openpyxl.Workbook()

    # -----------------------------------------------------------------------
    # Styles
    # -----------------------------------------------------------------------
    HEADER_FILL   = PatternFill("solid", fgColor="003A70")   # ABI dark blue
    MISMATCH_FILL = PatternFill("solid", fgColor="FFDCE0")   # light red
    OK_FILL       = PatternFill("solid", fgColor="D6F0D6")   # light green
    ALT_FILL      = PatternFill("solid", fgColor="F5F5F5")   # zebra stripe

    header_font  = Font(bold=True, color="FFFFFF", name="Calibri", size=10)
    normal_font  = Font(name="Calibri", size=10)
    bold_font    = Font(bold=True, name="Calibri", size=10)
    red_font     = Font(bold=True, color="C00000", name="Calibri", size=10)
    green_font   = Font(color="375623", name="Calibri", size=10)

    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    center = Alignment(horizontal="center", vertical="center")
    right  = Alignment(horizontal="right",  vertical="center")
    left_wrap = Alignment(horizontal="left", vertical="top", wrap_text=True)

    # -----------------------------------------------------------------------
    # Sheet 1 — Full Results (all rows)
    # -----------------------------------------------------------------------
    ws = wb.active
    ws.title = "All Results"

    columns = [
        ("Type",                   10),
        ("Destination",            14),
        ("Month",                  10),
        ("Year",                    8),
        ("Source Country",         16),
        ("Supplier / MR",          22),
        ("Resin Index ($)",        14),
        ("Freight ($)",            12),
        ("Insurance ($)",          12),
        ("Duty & Import Taxes ($)",18),
        ("Local Taxes & Fees ($)", 18),
        ("Logistics & Other ($)",  18),
        ("Component Sum ($)",      16),
        ("TLC ($)",                12),
        ("Difference ($)",         14),
        ("Status",                 10),
        ("Unmapped Rows",          40),
    ]

    # Header row
    for col_idx, (col_name, col_width) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = HEADER_FILL
        cell.alignment = center
        cell.border = border
        ws.column_dimensions[get_column_letter(col_idx)].width = col_width

    ws.row_dimensions[1].height = 22
    ws.freeze_panes = "A2"

    # Data rows
    for row_idx, r in enumerate(all_rows, start=2):
        is_mismatch = r.status == "MISMATCH"
        row_fill = MISMATCH_FILL if is_mismatch else (ALT_FILL if row_idx % 2 == 0 else None)

        values = [
            r.kind,
            r.destination,
            r.month,
            r.year,
            r.source_country,
            r.supplier,
            r.component_totals.get("Resin Index", 0.0),
            r.component_totals.get("Freight", 0.0),
            r.component_totals.get("Insurance", 0.0),
            r.component_totals.get("Duty & Import Taxes", 0.0),
            r.component_totals.get("Local Taxes & Fees", 0.0),
            r.component_totals.get("Logistics & Other Costs", 0.0),
            r.component_sum,
            r.tlc,
            r.diff,
            r.status,
            "; ".join(r.unmapped_rows) if r.unmapped_rows else "",
        ]

        for col_idx, value in enumerate(values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = normal_font
            cell.border = border
            if row_fill:
                cell.fill = row_fill

            # Numeric columns — right align
            if col_idx in range(7, 16):
                cell.alignment = right
                if isinstance(value, float):
                    cell.number_format = '#,##0.0'
            elif col_idx == 16:  # Status
                cell.alignment = center
                cell.font = red_font if is_mismatch else green_font
            elif col_idx == 17:  # Unmapped
                cell.alignment = left_wrap
            else:
                cell.alignment = left_wrap

    ws.auto_filter.ref = f"A1:{get_column_letter(len(columns))}1"

    # -----------------------------------------------------------------------
    # Sheet 2 — Mismatches only
    # -----------------------------------------------------------------------
    ws2 = wb.create_sheet("Mismatches Only")
    mismatches_only = [r for r in all_rows if r.status == "MISMATCH"]

    for col_idx, (col_name, col_width) in enumerate(columns, start=1):
        cell = ws2.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = HEADER_FILL
        cell.alignment = center
        cell.border = border
        ws2.column_dimensions[get_column_letter(col_idx)].width = col_width

    ws2.row_dimensions[1].height = 22
    ws2.freeze_panes = "A2"

    for row_idx, r in enumerate(mismatches_only, start=2):
        values = [
            r.kind, r.destination, r.month, r.year, r.source_country, r.supplier,
            r.component_totals.get("Resin Index", 0.0),
            r.component_totals.get("Freight", 0.0),
            r.component_totals.get("Insurance", 0.0),
            r.component_totals.get("Duty & Import Taxes", 0.0),
            r.component_totals.get("Local Taxes & Fees", 0.0),
            r.component_totals.get("Logistics & Other Costs", 0.0),
            r.component_sum, r.tlc, r.diff, r.status,
            "; ".join(r.unmapped_rows) if r.unmapped_rows else "",
        ]
        for col_idx, value in enumerate(values, start=1):
            cell = ws2.cell(row=row_idx, column=col_idx, value=value)
            cell.font = normal_font
            cell.border = border
            cell.fill = MISMATCH_FILL if row_idx % 2 == 0 else PatternFill("solid", fgColor="FFE8EA")
            cell.alignment = right if col_idx in range(7, 16) else (
                center if col_idx == 16 else left_wrap
            )
            if col_idx in range(7, 16) and isinstance(value, float):
                cell.number_format = '#,##0.0'
            if col_idx == 16:
                cell.font = red_font

    ws2.auto_filter.ref = f"A1:{get_column_letter(len(columns))}1"

    # -----------------------------------------------------------------------
    # Sheet 3 — Summary by Destination
    # -----------------------------------------------------------------------
    ws3 = wb.create_sheet("Summary by Destination")
    summary_headers = ["Destination", "Type", "Total Entries", "OK", "Mismatches", "Mismatch %", "Avg Diff ($)", "Max Diff ($)"]
    summary_widths  = [16, 10, 14, 8, 12, 12, 14, 14]

    for col_idx, (h, w) in enumerate(zip(summary_headers, summary_widths), start=1):
        cell = ws3.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = HEADER_FILL
        cell.alignment = center
        cell.border = border
        ws3.column_dimensions[get_column_letter(col_idx)].width = w

    ws3.row_dimensions[1].height = 22
    ws3.freeze_panes = "A2"

    from collections import defaultdict
    summary: dict[tuple[str, str], list[ValidationRow]] = defaultdict(list)
    for r in all_rows:
        summary[(r.destination, r.kind)].append(r)

    for s_row_idx, ((dest, kind), rows) in enumerate(sorted(summary.items()), start=2):
        total = len(rows)
        ok_count = sum(1 for r in rows if r.status == "OK")
        mm_count = total - ok_count
        mm_pct = round(mm_count / total * 100, 1) if total else 0.0
        diffs = [abs(r.diff) for r in rows if r.status == "MISMATCH"]
        avg_diff = round(sum(diffs) / len(diffs), 1) if diffs else 0.0
        max_diff = round(max(diffs), 1) if diffs else 0.0

        row_fill = MISMATCH_FILL if mm_count > 0 else OK_FILL
        s_values = [dest, kind, total, ok_count, mm_count, mm_pct, avg_diff, max_diff]
        for col_idx, val in enumerate(s_values, start=1):
            cell = ws3.cell(row=s_row_idx, column=col_idx, value=val)
            cell.font = bold_font if col_idx <= 2 else normal_font
            cell.fill = row_fill
            cell.border = border
            cell.alignment = center if col_idx > 2 else left_wrap
            if col_idx in (6, 7, 8) and isinstance(val, float):
                cell.number_format = '#,##0.0'

    # -----------------------------------------------------------------------
    # Metadata tab
    # -----------------------------------------------------------------------
    ws4 = wb.create_sheet("Info")
    meta = [
        ("Generated at", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ("Total entries checked", len(all_rows)),
        ("Total mismatches", len([r for r in all_rows if r.status == "MISMATCH"])),
        ("Tolerance (±$)", ""),  # filled below
        ("", ""),
        ("What is a MISMATCH?",
         "Component Sum != TLC by more than the tolerance. "
         "The Landed Factor (% multiplier on Sub Total CIF) is the typical cause - "
         "it is applied inside the Excel TLC formula but has no separate exported row."),
        ("Unmapped Rows",
         "Row labels in the source data that do not match any common component mapping. "
         "These are excluded from the component sum. 'Sub Total (CIF)' is intentionally "
         "excluded as it is a derived subtotal, not a cost component."),
    ]
    for i, (k, v) in enumerate(meta, start=1):
        ws4.cell(row=i, column=1, value=k).font = bold_font
        ws4.cell(row=i, column=2, value=v).font = normal_font
    ws4.column_dimensions["A"].width = 28
    ws4.column_dimensions["B"].width = 80

    wb.save(output_path)
    print(f"\nExcel report written -> {output_path}")
    print(f"  Sheets: 'All Results', 'Mismatches Only', 'Summary by Destination', 'Info'")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate that component sums equal TLC in the breakdown table."
    )
    parser.add_argument("--destination", default=None, help="Filter to one destination")
    parser.add_argument("--month", default=None, help="Filter to one month (e.g. March)")
    parser.add_argument("--year", default=None, help="Filter to one year (e.g. 2026)")
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.15,
        help="Max allowed absolute difference before flagging a mismatch (default: 0.15)",
    )
    parser.add_argument(
        "--excel",
        action="store_true",
        help="Export results to Excel",
    )
    parser.add_argument(
        "--output-excel",
        default=None,
        help="Path for the Excel output file (default: tlc_validation_<timestamp>.xlsx)",
    )
    args = parser.parse_args()

    _, mismatch_count, all_rows = run_validation(
        destination_filter=args.destination,
        month_filter=args.month,
        year_filter=args.year,
        tolerance=args.tolerance,
    )

    if args.excel or args.output_excel:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest_tag = f"_{args.destination}" if args.destination else ""
        default_name = f"tlc_validation{dest_tag}_{timestamp}.xlsx"
        out_path = Path(args.output_excel) if args.output_excel else Path(default_name)
        export_to_excel(all_rows, out_path)

    sys.exit(1 if mismatch_count > 0 else 0)


if __name__ == "__main__":
    main()
