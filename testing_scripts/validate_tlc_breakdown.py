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
from functools import lru_cache
from itertools import product
from pathlib import Path
from typing import Any

# Make the reorganized backend package importable whether this script is run
# from the repository root or directly from testing_scripts.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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
MONTH_NAMES = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)
TLC_COMPONENT = "Total Landed Cost (PET Resin)"

# Supplier row label → common component  (SUPPLIER_MAPPING in BreakdownTable.tsx)
SUPPLIER_MAPPING: dict[str, str] = {
    "icis china mid (n-1)": "Resin Index",
    "resin price index": "Resin Index",
    "resin with assumptions": "Resin Index",
    "icis asia se low (n-1)": "Resin Index",
    "icis asia se low (m-2)": "Resin Index",
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
    "total resin price abi virgin formula": TLC_COMPONENT,
}

# Supplier fallback (DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING)
SUPPLIER_FALLBACK_MAPPING: dict[str, str] = {
    "resin index vpet": "Resin Index",
    "freight": "Freight",
    "tax": "Local Taxes & Fees",
    "insurance": "Insurance",
    "others": "Logistics & Other Costs",
    "discount": "Logistics & Other Costs",
    "fx": "Logistics & Other Costs",
    "index": "Resin Index",
    "total landing cost": TLC_COMPONENT,
    "total landing cost (lc)": TLC_COMPONENT,
}

HIDDEN_SUPPLIER_LABELS = {
    "sub total (with incremental freight)",
    "sub total (with regular freight)",
    "sub total (cif)",
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
    raw_key = normalize(row.get("rawLabel", ""))
    mapping_key = normalize(row.get("mappingColumn", ""))
    common_key = normalize(row.get("commonComponent", ""))

    if (
        "total landing cost" in mapping_key
        or "total resin price abi virgin formula" in key
        or "total landing cost" in key
        or "total resin price abi virgin formula" in raw_key
        or "total landing cost" in raw_key
    ):
        return TLC_COMPONENT

    mapped = (
        SUPPLIER_MAPPING.get(raw_key)
        or SUPPLIER_MAPPING.get(key)
        or SUPPLIER_FALLBACK_MAPPING.get(mapping_key)
        or SUPPLIER_FALLBACK_MAPPING.get(key)
        or SUPPLIER_FALLBACK_MAPPING.get(common_key)
    )
    if mapped:
        return mapped
    if mapping_key == "freight" or common_key == "freight":
        return "Freight"
    if mapping_key == "insurance" or common_key == "insurance":
        return "Insurance"
    if mapping_key in {"resin index vpet", "index"} or common_key == "resin index":
        return "Resin Index"
    if mapping_key == "tax" or common_key == "tax":
        return "Local Taxes & Fees"
    if mapping_key in {"others", "discount", "fx"} or common_key == "others":
        return "Logistics & Other Costs"
    return row.get("commonComponent") or row.get("mappingColumn") or row.get("label") or None


def is_supplier_comparison_row(row: dict) -> bool:
    label_key = normalize(row.get("label", ""))
    mapping_key = normalize(row.get("mappingColumn", ""))
    return label_key not in HIDDEN_SUPPLIER_LABELS and mapping_key != "sub total (cif)"


@lru_cache(maxsize=1)
def _complete_supplier_rows_by_key() -> dict[tuple[str, ...], list[dict[str, Any]]]:
    """Load supplier rows without splitting one scenario by Source File.

    The production loader deliberately includes Source File in its grouping key.
    A corrected row can therefore become separated from the rest of its formula
    inputs when only that row has a new provenance value.  Validation needs the
    complete destination/supplier/location/period scenario, so it groups the
    standardized rows independently of Source File.
    """
    from app.data.supplier import (
        clean_text,
        is_total_landing_cost,
        model_destinations_for_response,
        month_year_from_row,
        read_data_model_rows,
        row_is_required,
        supplier_common_cost_mapping,
        to_api_row,
    )

    common_mapping = supplier_common_cost_mapping()
    grouped: dict[tuple[str, ...], list[dict[str, Any]]] = {}
    for raw_row in read_data_model_rows():
        destination = clean_text(raw_row.get("Destination Country"))
        supplier = clean_text(raw_row.get("Supplier Name"))
        period = month_year_from_row(raw_row)
        if not destination or not supplier or not period or not row_is_required(raw_row):
            continue
        month, year = period
        location = clean_text(raw_row.get("Location")) or destination
        data_type = clean_text(raw_row.get("Data Type"))
        for response_destination in model_destinations_for_response(destination):
            key = tuple(
                normalize(value)
                for value in (
                    response_destination,
                    supplier,
                    location,
                    month,
                    year,
                    data_type,
                )
            )
            grouped.setdefault(key, []).append(
                {
                    "api": to_api_row(raw_row, common_mapping),
                    "is_total": is_total_landing_cost(raw_row),
                }
            )
    return grouped


def complete_supplier_entry_rows(entry: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the complete formula rows for the supplier scenario in *entry*.

    When a period contains two scenarios with repeated component labels, choose
    the component combination whose additive total is closest to the TLC already
    selected by the backend.  This resolves the Dominican Republic/Panama-style
    interleaved blocks while retaining all unique inputs for formula suppliers.
    """
    destination = str(entry.get("destination", ""))
    supplier = str(entry.get("supplier") or entry.get("supplierName") or "")
    location = str(entry.get("location") or destination)
    key = tuple(
        normalize(value)
        for value in (
            destination,
            supplier,
            location,
            str(entry.get("month", "")),
            str(entry.get("year", "")),
            str(entry.get("dataType", "")),
        )
    )
    source_items = _complete_supplier_rows_by_key().get(key)
    if not source_items:
        return list(entry.get("rows", []))

    target_tlc = next(
        (
            to_number(row.get("amount"))
            for row in entry.get("rows", [])
            if map_supplier_row(row) == TLC_COMPONENT
        ),
        None,
    )
    total_rows = [item["api"] for item in source_items if item["is_total"]]
    if not total_rows:
        return list(entry.get("rows", []))
    total_row = min(
        total_rows,
        key=lambda row: (
            abs((to_number(row.get("amount")) or 0.0) - target_tlc)
            if target_tlc is not None
            else 0.0
        ),
    )
    target_tlc = to_number(total_row.get("amount"))

    # Drop exact duplicates, then group repeated raw labels. Repeated labels with
    # different values represent alternative scenarios rather than components
    # that should all be added together.
    component_rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for item in source_items:
        if item["is_total"]:
            continue
        row = item["api"]
        dedupe_key = (
            normalize(row.get("rawLabel") or row.get("label")),
            normalize(row.get("mappingColumn")),
            str(row.get("amount")),
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        component_rows.append(row)

    alternatives: dict[str, list[dict[str, Any]]] = {}
    for row in component_rows:
        label_key = normalize(row.get("rawLabel") or row.get("label"))
        alternatives.setdefault(label_key, []).append(row)

    choices = list(alternatives.values())
    combination_count = 1
    for choice in choices:
        combination_count *= len(choice)
    if target_tlc is not None and 1 < combination_count <= 4096:
        selected = min(
            product(*choices),
            key=lambda rows: abs(
                sum(to_number(row.get("amount")) or 0.0 for row in rows)
                - target_tlc
            ),
        )
        component_rows = list(selected)

    return component_rows + [total_row]


def previous_supplier_component_amount(
    entry: dict[str, Any], raw_labels: set[str]
) -> float | None:
    """Return a required component from the preceding supplier period."""
    month = str(entry.get("month", ""))
    try:
        month_index = [name.casefold() for name in MONTH_NAMES].index(month.casefold())
        year = int(entry.get("year"))
    except (ValueError, TypeError):
        return None
    if month_index == 0:
        previous_month, previous_year = MONTH_NAMES[-1], year - 1
    else:
        previous_month, previous_year = MONTH_NAMES[month_index - 1], year

    destination = str(entry.get("destination", ""))
    supplier = str(entry.get("supplier") or entry.get("supplierName") or "")
    location = str(entry.get("location") or destination)
    key = tuple(
        normalize(value)
        for value in (
            destination,
            supplier,
            location,
            previous_month,
            str(previous_year),
            str(entry.get("dataType", "")),
        )
    )
    for item in _complete_supplier_rows_by_key().get(key, []):
        if item["is_total"]:
            continue
        row = item["api"]
        if normalize(row.get("rawLabel") or row.get("label")) in raw_labels:
            value = to_number(row.get("amount"))
            if value is not None:
                return value
    return None


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
    supplier_key = normalize(supplier)

    component_totals: dict[str, float] = {c: 0.0 for c in COMMON_COMPONENTS}
    tlc: float | None = None
    unmapped: list[str] = []
    rows = complete_supplier_entry_rows(entry)
    is_valgroup = supplier_key == "valgroup"
    is_cristalpet = supplier_key == "cristalpet"
    is_brazil_engepack = supplier_key == "engepack" and normalize(destination) == "brazil"
    is_uruguay_cristalpet = is_cristalpet and any(
        normalize(row.get("rawLabel") or row.get("label"))
        == "gasto de internacion y puesta en silos"
        for row in rows
    )
    is_bolivia_gestora = (
        supplier_key
        == "gestora, administradora e industrializadora preformas s.a."
    )
    valgroup_rates = {"discount": 0.0, "importation": 0.0, "import tax": 0.0}
    cristalpet_tax_rate = 0.0
    uruguay_cristalpet_base = 0.0
    bolivia_other_cost_rate = 0.0

    # BreakdownTable deduplicates identical rows before calculating the common
    # component table. Apply the same rule here.
    compact_rows: list[dict] = []
    seen_rows: set[tuple[str, str, str, str, str]] = set()
    for row in rows:
        dedupe_key = (
            normalize(row.get("label", "")),
            normalize(row.get("commonComponent", "")),
            normalize(row.get("mappingColumn", "")),
            normalize(row.get("formulaReference", "")),
            str(row.get("amount", "")),
        )
        if dedupe_key in seen_rows:
            continue
        seen_rows.add(dedupe_key)
        compact_rows.append(row)

    for row in compact_rows:
        if not is_supplier_comparison_row(row):
            continue
        raw_key = normalize(row.get("rawLabel") or row.get("label"))
        if (
            supplier_key == "engepack"
            and normalize(row.get("location", "")) == "brazil"
            and raw_key == "maxiquim mme (m-1)"
        ):
            continue
        value = to_number(row.get("amount"))
        if value is None:
            continue
        component = map_supplier_row(row)
        if component == TLC_COMPONENT:
            tlc = value
            continue

        if is_uruguay_cristalpet and raw_key == "precio base de materia prima":
            uruguay_cristalpet_base = value
            continue

        is_percentage = normalize(row.get("valueFormat", "")) == "percentage"
        if is_valgroup and is_percentage and raw_key in valgroup_rates:
            valgroup_rates[raw_key] = value
        if (
            is_cristalpet
            and is_percentage
            and raw_key in {"tax", "gasto de internacion y puesta en silos"}
        ):
            cristalpet_tax_rate = value
        if is_bolivia_gestora and is_percentage:
            bolivia_other_cost_rate += value
        if is_percentage:
            continue

        if component in component_totals:
            component_totals[component] += value
        else:
            unmapped.append(f"{row.get('label', '?')} (${value:.1f})")

    if is_valgroup:
        resin = component_totals["Resin Index"]
        freight = component_totals["Freight"]
        discount_impact = -(resin * valgroup_rates["discount"])
        tax_base = resin + discount_impact + freight
        tax_impact = tax_base * (
            valgroup_rates["importation"] + valgroup_rates["import tax"]
        )
        component_totals["Local Taxes & Fees"] = tax_impact
        component_totals["Logistics & Other Costs"] += discount_impact

    if is_cristalpet:
        resin = component_totals["Resin Index"]
        freight = component_totals["Freight"]
        tax_base = uruguay_cristalpet_base if is_uruguay_cristalpet else resin + freight
        component_totals["Local Taxes & Fees"] = tax_base * cristalpet_tax_rate

    if is_bolivia_gestora:
        resin = component_totals["Resin Index"]
        freight = component_totals["Freight"]
        component_totals["Duty & Import Taxes"] = (
            resin + freight
        ) * bolivia_other_cost_rate

    if is_brazil_engepack:
        # Engepack's Maxiquim MME is a visible reference only. Its USD TLC uses
        # the explicit formula shown by the UI:
        # ((resin + 100 + freight) * 1.20) + 125 + (8% * freight).
        resin = component_totals["Resin Index"]
        current_freight = component_totals["Freight"]
        previous_freight = previous_supplier_component_amount(entry, {"freight"})
        freight_candidates = [current_freight]
        if previous_freight is not None:
            freight_candidates.append(previous_freight)

        def engepack_total(freight_value: float) -> float:
            return (
                ((resin + 100.0 + freight_value) * 1.20)
                + 125.0
                + (freight_value * 0.08)
            )

        freight = min(
            freight_candidates,
            key=lambda value: abs(engepack_total(value) - tlc)
            if tlc is not None
            else 0.0,
        )
        component_totals["Freight"] = freight
        component_totals["Duty & Import Taxes"] = (resin + 100.0 + freight) * 0.20
        component_totals["Logistics & Other Costs"] += 100.0 + 125.0 + (freight * 0.08)

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
    from app.data.market_research import (
        add_supplier_delta_rows,
        available_destinations,
        available_periods_for_destination,
        build_market_research_countries,
    )
    from app.data.supplier import build_vendor_breakdowns

    def get_countries(
        *,
        destination: str,
        month: str,
        year: str,
        includeVendorBreakdowns: bool = True,
    ) -> dict[str, Any]:
        """Build the validation payload without importing optional API services."""
        market_countries = build_market_research_countries(destination, month, year)
        source_countries = tuple(
            str(country.get("country", ""))
            for country in market_countries
            if country.get("country")
        )
        vendor_breakdowns = (
            build_vendor_breakdowns(source_countries, destination)
            if includeVendorBreakdowns
            else []
        )
        if includeVendorBreakdowns:
            market_countries = add_supplier_delta_rows(
                market_countries,
                vendor_breakdowns,
                destination,
                month,
                year,
            )
        return {
            "countries": market_countries,
            "vendorBreakdowns": vendor_breakdowns,
        }

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

def export_to_excel(
    all_rows: list[ValidationRow], output_path: Path, tolerance: float
) -> None:
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
    meta[3] = ("Tolerance (+/-$)", tolerance)
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
        export_to_excel(all_rows, out_path, args.tolerance)

    sys.exit(1 if mismatch_count > 0 else 0)


if __name__ == "__main__":
    main()
