from __future__ import annotations

from pathlib import Path
import re

import openpyxl
import pandas as pd
from openpyxl.worksheet.formula import ArrayFormula

BASE = Path(__file__).resolve().parents[2]
SRC_CSV = (
    BASE
    / "data"
    / "processed"
    / "current"
    / "market_research"
    / "Data_Standardized_MR_Front_End_Data_Model.csv"
)
OUT_XLSX = (
    BASE
    / "data"
    / "processed"
    / "current"
    / "market_research"
    / "MR_Taxes_Duties_Derivation.xlsx"
)

TAX_DUTY_KEYWORDS = re.compile(r"tax|duty|import|aduana|arancel|impuesto", re.IGNORECASE)
MAPPED_TAX_COLUMNS = {
    "tax",
    "customs clearance",
}
CELL_REF_RE = re.compile(r"\$?([A-Z]{1,3})\$?(\d+)")
SUM_RANGE_RE = re.compile(
    r"SUM\((\$?[A-Z]{1,3}\$?\d+):(\$?[A-Z]{1,3}\$?\d+)\)",
    re.IGNORECASE,
)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def clean_label(label: str) -> str:
    return re.sub(r"\s+", " ", str(label or "").replace(":", "").strip())


def is_tax_duty_row(raw_label: str, mapped_label: str) -> bool:
    raw = (raw_label or "").strip()
    mapped = (mapped_label or "").strip().lower()
    if mapped in MAPPED_TAX_COLUMNS:
        return True
    return bool(TAX_DUTY_KEYWORDS.search(raw))


def classify_constant_or_variable(df: pd.DataFrame) -> str:
    values = (
        pd.to_numeric(df["Value "], errors="coerce")
        .dropna()
        .astype(float)
        .round(8)
        .unique()
        .tolist()
    )
    return "Constant" if len(values) <= 1 else "Variable"


def first_non_empty(series: pd.Series) -> str:
    for value in series.fillna("").astype(str):
        trimmed = value.strip()
        if trimmed:
            return trimmed
    return ""


def build_file_index(source_files: pd.Series) -> dict[str, Path]:
    names = {
        Path(value).name.lower()
        for value in source_files.dropna().astype(str)
        if str(value).strip()
    }

    index: dict[str, Path] = {}
    roots = [BASE / "data" / "raw" / "market_research", BASE / "data" / "raw"]

    for name in names:
        found = None
        for root in roots:
            matches = list(root.rglob(name))
            if matches:
                found = matches[0]
                break
        if not found:
            matches = list(BASE.rglob(name))
            if matches:
                found = matches[0]
        if found:
            index[name] = found

    return index


def resolve_source_file(source_file: str, file_index: dict[str, Path]) -> Path | None:
    source = (source_file or "").strip()
    if not source:
        return None

    source_path = Path(source)
    if source_path.is_absolute() and source_path.exists():
        return source_path

    direct = BASE / source_path
    if direct.exists():
        return direct

    return file_index.get(source_path.name.lower())


def sheet_row_label(ws: openpyxl.worksheet.worksheet.Worksheet, row_number: int) -> str:
    label = ws[f"A{row_number}"].value
    if label is None:
        return ""
    return clean_label(str(label))


def extract_formula_text(cell_value: object) -> str:
    if isinstance(cell_value, ArrayFormula):
        # Keep the array-formula expression itself.
        return str(cell_value.text or "").strip()
    if isinstance(cell_value, str) and cell_value.strip().startswith("="):
        return cell_value.strip()
    return ""


def replace_sum_ranges_with_labels(formula: str, ws: openpyxl.worksheet.worksheet.Worksheet) -> str:
    def repl(match: re.Match[str]) -> str:
        left_ref = match.group(1)
        right_ref = match.group(2)
        left = CELL_REF_RE.fullmatch(left_ref.replace("$", ""))
        right = CELL_REF_RE.fullmatch(right_ref.replace("$", ""))
        if not left or not right:
            return match.group(0)

        left_col, left_row = left.group(1), int(left.group(2))
        right_col, right_row = right.group(1), int(right.group(2))
        if left_col != right_col or right_row < left_row:
            return match.group(0)

        labels: list[str] = []
        for row_num in range(left_row, right_row + 1):
            lbl = sheet_row_label(ws, row_num)
            labels.append(lbl if lbl else f"{left_col}{row_num}")

        return "(" + " + ".join(labels) + ")"

    return SUM_RANGE_RE.sub(repl, formula)


def replace_cell_refs_with_labels(formula: str, ws: openpyxl.worksheet.worksheet.Worksheet) -> str:
    def repl(match: re.Match[str]) -> str:
        row_num = int(match.group(2))
        label = sheet_row_label(ws, row_num)
        return label if label else match.group(0)

    return CELL_REF_RE.sub(repl, formula)


def prettify_formula(formula: str, ws: openpyxl.worksheet.worksheet.Worksheet) -> str:
    clean = (formula or "").strip()
    if not clean:
        return ""
    if clean.startswith("="):
        clean = clean[1:]
    clean = clean.replace("$", "")
    clean = replace_sum_ranges_with_labels(clean, ws)
    clean = replace_cell_refs_with_labels(clean, ws)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def formula_preference_key(formula: str) -> tuple[int, int, int]:
    text = (formula or "").strip().lower()
    is_url = int("http://" in text or "https://" in text or "www." in text)
    has_equals = int("=" in text)
    has_business_terms = int(
        any(token in text for token in ["resin", "freight", "insurance", "duty", "tax", "import"])
    )
    has_cell_refs = int(bool(CELL_REF_RE.search(formula or "")))
    # Prefer: not URL, equation-style business terms, no cell refs, concise text.
    return (1 - is_url, has_equals, has_business_terms, 1 - has_cell_refs, -len(text))


def extract_label_derived_formula(
    workbook_path: Path,
    raw_label: str,
    cache: dict[tuple[str, str], str],
) -> str:
    key = (str(workbook_path), normalize_text(raw_label))
    if key in cache:
        return cache[key]

    target = normalize_text(raw_label)
    if not target:
        cache[key] = ""
        return ""

    try:
        wb = openpyxl.load_workbook(workbook_path, data_only=False)
    except Exception:
        cache[key] = ""
        return ""

    candidates: list[str] = []

    for ws in wb.worksheets:
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=1, max_col=ws.max_column):
            label_cell = None
            for cell in row:
                if isinstance(cell.value, str):
                    if normalize_text(clean_label(cell.value)) == target:
                        label_cell = cell
                        break

            if label_cell is None:
                continue

            # Prefer human-readable derivation text in the same row if present.
            for cell in row:
                if cell.column == label_cell.column:
                    continue
                if isinstance(cell.value, str):
                    text = cell.value.strip()
                    # This usually contains business-friendly derivation wording.
                    if "=" in text and any(tok in text.lower() for tok in ["resin", "freight", "insurance", "duty", "tax", "import"]):
                        candidates.append(re.sub(r"\s+", " ", text))

            # Fallback to workbook formula translated to row labels.
            for cell in row:
                formula = extract_formula_text(cell.value)
                if formula:
                    pretty = prettify_formula(formula, ws)
                    if pretty:
                        candidates.append(pretty)

    unique: list[str] = []
    seen: set[str] = set()
    for c in candidates:
        k = c.lower()
        if k in seen:
            continue
        seen.add(k)
        unique.append(c)

    if unique:
        unique.sort(key=formula_preference_key, reverse=True)
    result = unique[0] if unique else ""
    cache[key] = result
    return result


def normalize_business_formula(raw_label: str, formula: str) -> str:
    text = (formula or "").strip()
    label = normalize_text(raw_label)
    lower = text.lower()

    if "anti-dumping duty" in label and "index('tax references'" in lower:
        return "Anti-dumping duty = anti-dumping duty rate from Tax references table"

    if "import duty" in label and "index('tax references'" in lower:
        return "Import duty = import duty rate from Tax references table * (PET resin cost (FOB) + Freight cost + Insurance)"

    return text


def main() -> None:
    df = pd.read_csv(SRC_CSV)

    actual_df = df[df["Data Type"].astype(str).str.lower() == "actual"].copy()
    actual_df = actual_df[
        actual_df.apply(
            lambda row: is_tax_duty_row(
                str(row.get("Raw Cost Breakdown", "")),
                str(row.get("Mapping Columns", "")),
            ),
            axis=1,
        )
    ]

    if actual_df.empty:
        raise ValueError("No tax/duty/import rows found in Market Research actual data")

    file_index = build_file_index(df.get("Source File ", pd.Series(dtype=str)))
    formula_cache: dict[tuple[str, str], str] = {}

    rows: list[dict[str, str]] = []
    grouped = actual_df.groupby(
        ["Supplier Name", "Destination Country", "Raw Cost Breakdown", "Mapping Columns"],
        dropna=False,
    )

    for (supplier, destination, raw_label, mapped_label), group in grouped:
        classification = classify_constant_or_variable(group)
        source_file = first_non_empty(group.get("Source File ", pd.Series(dtype=str)))

        derived_formula = ""
        resolved = resolve_source_file(source_file, file_index)
        if resolved is not None:
            derived_formula = extract_label_derived_formula(
                resolved,
                str(raw_label),
                formula_cache,
            )

        if not derived_formula:
            derived_formula = (
                f"Refer Market Research sheet: {source_file}"
                if source_file
                else "Refer Market Research sheet"
            )

        derived_formula = normalize_business_formula(str(raw_label), derived_formula)

        rows.append(
            {
                "SupplierName": str(supplier),
                "Destination COuntry": str(destination),
                "Raw Taxes & Duties(from MR sheet)": str(raw_label),
                "Mapped Taxes & Duties (what we have mapped )": str(mapped_label),
                "Constant or Variable": classification,
                "Derived Formula": derived_formula,
            }
        )

    out_df = pd.DataFrame(rows).sort_values(
        by=[
            "SupplierName",
            "Destination COuntry",
            "Mapped Taxes & Duties (what we have mapped )",
            "Raw Taxes & Duties(from MR sheet)",
        ]
    )

    with pd.ExcelWriter(OUT_XLSX, engine="openpyxl") as writer:
        out_df.to_excel(writer, sheet_name="tax_duty_mapping", index=False)

    print(f"Created: {OUT_XLSX}")
    print(f"Rows exported: {len(out_df)}")
    print(
        out_df[
            [
                "SupplierName",
                "Destination COuntry",
                "Raw Taxes & Duties(from MR sheet)",
                "Mapped Taxes & Duties (what we have mapped )",
                "Constant or Variable",
                "Derived Formula",
            ]
        ]
        .head(20)
        .to_string(index=False)
    )


if __name__ == "__main__":
    main()
