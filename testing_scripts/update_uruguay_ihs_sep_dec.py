"""Update Uruguay Supplier forecasts using approved IHS values with an M-1 lag."""
from __future__ import annotations

import csv
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL = PROJECT_ROOT / "data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.xlsx"
SHEET_NAME = "front_end_data_model"
SOURCE = "User-provided Uruguay IHS forecast; M-1 lag applied"

# Index-period values. August is the approved actual already stored in the model;
# September-December are the user-provided forecasts.
IHS_INDEX_VALUES = {
    (2026, 8): 1051.00,
    (2026, 9): 1060.00,
    (2026, 10): 1015.00,
    (2026, 11): 992.00,
    (2026, 12): 973.00,
}

# Uruguay is M-1: each index period feeds the following TLC month.
TLC_TO_INDEX_PERIOD = {
    (2026, 9): (2026, 8),
    (2026, 10): (2026, 9),
    (2026, 11): (2026, 10),
    (2026, 12): (2026, 11),
    (2027, 1): (2026, 12),
}


def clean(value: Any) -> str:
    return "" if value is None else str(value).replace("\xa0", " ").strip()


def number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return float(clean(value).replace(",", ""))


def main() -> int:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = MODEL.with_name(f"{MODEL.stem}.backup_before_uruguay_ihs_{timestamp}{MODEL.suffix}")
    shutil.copy2(MODEL, backup)
    csv_path = MODEL.with_suffix(".csv")
    if csv_path.exists():
        shutil.copy2(
            csv_path,
            csv_path.with_name(f"{csv_path.stem}.backup_before_uruguay_ihs_{timestamp}{csv_path.suffix}"),
        )

    workbook = load_workbook(MODEL)
    sheet = workbook[SHEET_NAME]
    headers = {clean(cell.value): index for index, cell in enumerate(sheet[1], 1)}
    groups: dict[tuple[int, int], list[int]] = {
        period: [] for period in TLC_TO_INDEX_PERIOD
    }
    for row in range(2, sheet.max_row + 1):
        if clean(sheet.cell(row, headers["Destination Country"]).value) != "Uruguay":
            continue
        if clean(sheet.cell(row, headers["Supplier Name"]).value) != "Cristalpet":
            continue
        year = int(number(sheet.cell(row, headers["Time Period Year"]).value or 0))
        month = int(number(sheet.cell(row, headers["Time Period Month"]).value or 0))
        period = (year, month)
        if period in groups:
            groups[period].append(row)

    results: list[tuple[int, int, int, int, float, float, float, float]] = []
    for (year, month), rows in groups.items():
        labels = {
            clean(sheet.cell(row, headers["Raw Cost Breakdown"]).value).casefold(): row
            for row in rows
        }
        required = {
            "resina fob asia",
            "flete internacional",
            "otros gastos",
            "gasto de internacion y puesta en silos",
            "precio base de materia prima",
            "precio final en planta v pet",
        }
        missing = required - set(labels)
        if missing:
            raise ValueError(f"Uruguay {month}/{year} is missing rows: {sorted(missing)}")
        index_year, index_month = TLC_TO_INDEX_PERIOD[(year, month)]
        resin = IHS_INDEX_VALUES[(index_year, index_month)]
        freight = number(sheet.cell(labels["flete internacional"], headers["Value"]).value)
        others = number(sheet.cell(labels["otros gastos"], headers["Value"]).value)
        rate = number(
            sheet.cell(labels["gasto de internacion y puesta en silos"], headers["Value"]).value
        )
        base = resin + freight + others
        tlc = base * (1 + rate)
        sheet.cell(labels["resina fob asia"], headers["Value"], resin)
        sheet.cell(labels["precio base de materia prima"], headers["Value"], base)
        sheet.cell(labels["precio final en planta v pet"], headers["Value"], tlc)
        for row in rows:
            sheet.cell(row, headers["Source File"], SOURCE)
        results.append((year, month, index_year, index_month, resin, freight, base, tlc))

    workbook.save(MODEL)
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        csv.writer(handle).writerows(sheet.iter_rows(values_only=True))
    workbook.close()
    print(f"Backup: {backup}")
    for year, month, index_year, index_month, resin, freight, base, tlc in results:
        print(
            f"{month:02d}/{year} | IHS {index_month:02d}/{index_year} (M-1)={resin:.2f} | "
            f"Freight={freight:.2f} | "
            f"Base={base:.2f} | TLC={tlc:.6f}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
