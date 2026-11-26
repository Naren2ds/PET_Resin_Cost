"""Refresh monthly Supplier and Market resin indexes and TLC values.

The normal command needs only the latest TLC Actual month::

    python testing_scripts/refresh_monthly_resin_tlc.py --month October --year 2026

By default, inputs are discovered in ``PET_Files_DB/<Month>``. The folder may
contain the direct ICIS history, Asia SE Low history, China forecast, and a
market freight workbook with a ``Consolidated Values`` sheet. Supplier freight
and other non-resin inputs are carried forward from the latest Actual month.
Market freight is refreshed only when a compatible freight workbook is found;
otherwise the existing market freight is retained.

The script creates backups, updates temporary copies, writes an audit workbook,
and replaces the live models only after both model refreshes succeed.
"""
from __future__ import annotations

import argparse
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from openpyxl import load_workbook

import refresh_september_october_2026 as engine


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
DEFAULT_INPUT_ROOT = WORKSPACE_ROOT / "PET_Files_DB"


def parse_month(value: str) -> int:
    text = value.strip()
    if text.isdigit() and 1 <= int(text) <= 12:
        return int(text)
    names = {name.casefold(): number for number, name in enumerate(engine.MONTHS) if name}
    short_names = {name[:3].casefold(): number for name, number in names.items()}
    month = names.get(text.casefold()) or short_names.get(text[:3].casefold())
    if month is None:
        raise argparse.ArgumentTypeError("month must be 1-12 or a month name")
    return month


def resolve_input_folder(root: Path, month: int, year: int, override: Path | None) -> Path:
    if override is not None:
        folder = override.resolve()
        if not folder.is_dir():
            raise FileNotFoundError(f"Input folder does not exist: {folder}")
        return folder

    month_name = engine.MONTHS[month]
    expected = root / month_name
    if expected.is_dir():
        return expected.resolve()

    accepted = {
        month_name.casefold(),
        f"{month_name} {year}".casefold(),
        f"{year}-{month:02d}".casefold(),
    }
    matches = [path for path in root.iterdir() if path.is_dir() and path.name.casefold() in accepted]
    if len(matches) == 1:
        return matches[0].resolve()
    if len(matches) > 1:
        raise ValueError(f"Multiple month folders match {month_name} {year}: {matches}")
    raise FileNotFoundError(
        f"Expected the refresh inputs in {expected}. Create that folder or pass --input-folder."
    )


def workbook_signature(path: Path) -> tuple[set[str], tuple[int, int] | None]:
    frame = pd.read_excel(path, header=None)
    labels: set[str] = set()
    periods: set[tuple[int, int]] = set()
    for value in frame.to_numpy().ravel():
        text = engine.clean(value)
        if "FOB China" in text:
            labels.add("China")
        elif "FOB India" in text:
            labels.add("India")
        elif "FOB Mexico" in text:
            labels.add("Mexico")
        elif "FOB South Korea" in text:
            labels.add("South Korea")
        elif "FOB Taiwan" in text:
            labels.add("Taiwan")
        if "Asia SE" in text and "(Low)" in text:
            labels.add("Asia SE Low")
        period = engine.parse_period(value)
        if period:
            periods.add(period)
    return labels, max(periods) if periods else None


def choose_history_files(
    folder: Path,
    history_override: Path | None,
    asia_override: Path | None,
) -> tuple[Path, Path]:
    candidates = sorted(
        path
        for path in folder.iterdir()
        if path.is_file()
        and path.suffix.casefold() in {".xls", ".xlsx"}
        and "history" in path.name.casefold()
    )
    signatures: dict[Path, tuple[set[str], tuple[int, int] | None]] = {}
    for path in candidates:
        try:
            signatures[path] = workbook_signature(path)
        except Exception:
            continue

    direct_required = {"China", "India", "Mexico", "South Korea", "Taiwan"}

    def best(options: list[Path], label: str) -> Path:
        if not options:
            raise FileNotFoundError(f"No {label} workbook found in {folder}")
        return max(
            options,
            key=lambda path: (
                signatures[path][1] or (0, 0),
                path.stat().st_mtime_ns,
                path.name,
            ),
        )

    history = history_override.resolve() if history_override else best(
        [path for path, (labels, _) in signatures.items() if direct_required <= labels],
        "direct ICIS history",
    )
    asia = asia_override.resolve() if asia_override else best(
        [path for path, (labels, _) in signatures.items() if "Asia SE Low" in labels],
        "Asia SE Low history",
    )
    for path in (history, asia):
        if not path.is_file():
            raise FileNotFoundError(path)
    return history, asia


def choose_forecast_file(folder: Path, override: Path | None) -> Path | None:
    if override:
        path = override.resolve()
        if not path.is_file():
            raise FileNotFoundError(path)
        return path
    candidates = [
        path
        for path in folder.iterdir()
        if path.is_file()
        and path.suffix.casefold() in {".xls", ".xlsx"}
        and "price forecast" in path.name.casefold()
    ]
    parsed: list[tuple[tuple[int, int], int, Path]] = []
    for path in candidates:
        try:
            curve = engine.parse_china_forecast(path, required_periods=set())
        except Exception:
            continue
        if curve:
            parsed.append((max(curve), path.stat().st_mtime_ns, path))
    return max(parsed)[2] if parsed else None


def is_freight_workbook(path: Path) -> bool:
    try:
        workbook = load_workbook(path, read_only=True, data_only=True)
        try:
            if "Consolidated Values" not in workbook.sheetnames:
                return False
            headers = {engine.clean(cell.value) for cell in workbook["Consolidated Values"][1]}
            return {"Source Country", "Destination Country", "Freight Value"} <= headers
        finally:
            workbook.close()
    except Exception:
        return False


def choose_freight_file(folder: Path, override: Path | None) -> Path | None:
    if override:
        path = override.resolve()
        if not path.is_file() or not is_freight_workbook(path):
            raise ValueError(f"Not a compatible market freight workbook: {path}")
        return path
    candidates = [
        path
        for path in folder.glob("*.xlsx")
        if "freight" in path.name.casefold() and is_freight_workbook(path)
    ]
    if len(candidates) > 1:
        raise ValueError(
            "Multiple compatible freight workbooks found. Keep one in the month folder "
            "or pass --freight."
        )
    return candidates[0] if candidates else None


def load_freight_rates(path: Path) -> tuple[dict[tuple[str, str], float], list[str]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook["Consolidated Values"]
        headers = {engine.clean(cell.value): index for index, cell in enumerate(sheet[1])}
        rates: dict[tuple[str, str], float] = {}
        skipped: list[str] = []
        for row in sheet.iter_rows(min_row=2, values_only=True):
            source = engine.clean(row[headers["Source Country"]])
            destination = engine.clean(row[headers["Destination Country"]])
            amount = engine.number(row[headers["Freight Value"]])
            if not source or not destination or amount is None:
                skipped.append(f"{source or '<blank>'} -> {destination or '<blank>'}")
                continue
            route = (engine.normalized(source), engine.normalized(destination))
            if route in rates and abs(rates[route] - amount) > 1e-9:
                raise ValueError(f"Conflicting freight values for {source} -> {destination}")
            rates[route] = amount
        return rates, skipped
    finally:
        workbook.close()


def available_model_months(path: Path, year: int) -> set[int]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook[engine.SHEET_NAME]
        headers = {engine.clean(cell.value): index for index, cell in enumerate(sheet[1])}
        months: set[int] = set()
        for row in sheet.iter_rows(min_row=2, values_only=True):
            row_year = int(engine.number(row[headers["Time Period Year"]], 0) or 0)
            row_month = int(engine.number(row[headers["Time Period Month"]], 0) or 0)
            if row_year == year and 1 <= row_month <= 12:
                months.add(row_month)
        return months
    finally:
        workbook.close()


def validate_actual_coverage(
    curves: dict[str, dict[tuple[int, int], float]], target_period: tuple[int, int]
) -> None:
    required_series = {"China", "India", "Mexico", "South Korea", "Taiwan", "Asia SE Low"}
    missing: list[str] = []
    for lag in sorted(set(engine.DESTINATION_LAGS.values())):
        index_period = engine.lagged_period(*target_period, lag)
        for series in sorted(required_series):
            if index_period not in curves.get(series, {}):
                missing.append(f"{series}: {engine.period_text(index_period)} (M-{lag})")
    if missing:
        raise ValueError(
            "The input history cannot support the requested Actual month. Missing: "
            + "; ".join(missing)
        )


def working_copy(path: Path, timestamp: str) -> Path:
    output = path.with_name(f".{path.stem}.refresh_working_{timestamp}{path.suffix}")
    shutil.copy2(path, output)
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--month", required=True, type=parse_month, help="Latest TLC Actual month")
    parser.add_argument("--year", type=int, default=datetime.now().year)
    parser.add_argument("--input-root", type=Path, default=DEFAULT_INPUT_ROOT)
    parser.add_argument("--input-folder", type=Path)
    parser.add_argument("--history", type=Path)
    parser.add_argument("--asia-se-history", type=Path)
    parser.add_argument("--china-forecast", type=Path)
    parser.add_argument("--freight", type=Path)
    parser.add_argument("--supplier-model", type=Path, default=engine.SUPPLIER_MODEL)
    parser.add_argument("--market-model", type=Path, default=engine.MARKET_MODEL)
    parser.add_argument("--raw-market-model", type=Path, default=engine.RAW_MARKET_MODEL)
    parser.add_argument("--audit", type=Path)
    parser.add_argument("--no-backup", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    target_period = (args.year, args.month)
    folder = resolve_input_folder(args.input_root.resolve(), args.month, args.year, args.input_folder)
    history, asia_history = choose_history_files(folder, args.history, args.asia_se_history)
    forecast = choose_forecast_file(folder, args.china_forecast)
    freight = choose_freight_file(folder, args.freight)

    required_models = (args.supplier_model, args.market_model, args.raw_market_model)
    if missing := [path for path in required_models if not path.is_file()]:
        raise FileNotFoundError(f"Missing model inputs: {missing}")

    actual_curves = engine.parse_actual_curves(history, asia_history, required_period=None)
    validate_actual_coverage(actual_curves, target_period)
    china_forecast = (
        engine.parse_china_forecast(forecast, required_periods=set()) if forecast else {}
    )
    freight_rates: dict[tuple[str, str], float] | None = None
    skipped_freight: list[str] = []
    if freight:
        freight_rates, skipped_freight = load_freight_rates(freight)

    supplier_months = available_model_months(args.supplier_model, args.year)
    market_months = available_model_months(args.market_model, args.year)
    common_months = supplier_months & market_months
    if args.month not in common_months:
        raise ValueError(
            f"{engine.period_text(target_period)} is not present in both frontend models"
        )
    refresh_months = tuple(month for month in sorted(common_months) if month >= args.month)
    output_periods = tuple((args.year, month) for month in refresh_months)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    label = f"{engine.MONTHS[args.month].casefold()}_{args.year}_refresh"
    backups: list[Path] = []
    if not args.no_backup:
        for model in (args.supplier_model, args.market_model):
            xlsx_backup, csv_backup = engine.backup_model(model, timestamp, label=label)
            backups.append(xlsx_backup)
            if csv_backup:
                backups.append(csv_backup)

    supplier_work = working_copy(args.supplier_model, timestamp)
    market_work = working_copy(args.market_model, timestamp)
    forecast_provenance = forecast or folder / "No China forecast workbook supplied"
    audit_path = args.audit or folder / (
        f"Resin_TLC_Refresh_{engine.MONTHS[args.month]}_{args.year}_Audit.xlsx"
    )
    work_paths = (
        supplier_work,
        supplier_work.with_suffix(".csv"),
        market_work,
        market_work.with_suffix(".csv"),
    )
    try:
        supplier_audit = engine.refresh_supplier(
            supplier_work,
            actual_curves,
            china_forecast,
            history,
            asia_history,
            forecast_provenance,
            output_periods=output_periods,
            latest_actual_period=target_period,
        )
        market_audit, global_audit = engine.refresh_market(
            market_work,
            args.raw_market_model,
            actual_curves,
            china_forecast,
            history,
            asia_history,
            forecast_provenance,
            output_periods=output_periods,
            latest_actual_period=target_period,
            freight_rates=freight_rates,
            freight_source=str(freight) if freight else None,
        )
        freight_basis = str(freight) if freight else "No monthly freight file; existing values retained"
        engine.write_audit(
            audit_path,
            actual_curves,
            china_forecast,
            supplier_audit,
            market_audit,
            global_audit,
            backups,
            output_periods=output_periods,
            latest_actual_period=target_period,
            market_freight_basis=freight_basis,
        )

        os.replace(supplier_work, args.supplier_model)
        os.replace(supplier_work.with_suffix(".csv"), args.supplier_model.with_suffix(".csv"))
        os.replace(market_work, args.market_model)
        os.replace(market_work.with_suffix(".csv"), args.market_model.with_suffix(".csv"))
    finally:
        for path in work_paths:
            if path.exists():
                path.unlink()

    print(f"Input folder: {folder}")
    print(f"Latest Actual TLC month: {engine.period_text(target_period)}")
    print("Output periods: " + ", ".join(engine.period_text(period) for period in output_periods))
    print(f"Direct ICIS history: {history}")
    print(f"Asia SE Low history: {asia_history}")
    print(f"China forecast: {forecast or 'not supplied; existing future values retained where needed'}")
    print(f"Market freight: {freight or 'not supplied; existing values retained'}")
    if skipped_freight:
        print(f"Freight rows skipped because no numeric value was available: {len(skipped_freight)}")
    print(f"Supplier scenarios refreshed: {len(supplier_audit)}")
    print(f"Market direct scenarios refreshed: {len(market_audit)}")
    print(f"Global ICIS scenarios refreshed: {len(global_audit)}")
    for backup in backups:
        print(f"Backup: {backup}")
    print(f"Audit: {audit_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
