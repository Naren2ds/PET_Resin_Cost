from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[3]
SUPPLIER_XLSX = (
    BASE
    / "data"
    / "processed"
    / "current"
    / "supplier"
    / "Data_Standardized_Front_End_Data_Model.xlsx"
)
SUPPLIER_CSV = (
    BASE
    / "data"
    / "processed"
    / "current"
    / "supplier"
    / "Data_Standardized_Front_End_Data_Model.csv"
)
ASIASE_FORECAST_XLSX = (
    BASE
    / "data"
    / "processed"
    / "current"
    / "indexes"
    / "suppliers"
    / "AsiaSE_final_forecast.xlsx"
)

START_YEAR = 2026
START_MONTH = 7
END_YEAR = 2027
END_MONTH = 5

# Countries currently using ICIS Asia SE in standardized supplier model
ASIA_SE_DESTINATIONS = {
    "Argentina",
    "Brazil",
    "Dominican Republic",
    "Panama",
    "Peru",
    "Uruguay",
}

# Country configs aligned with existing forecast logic
COUNTRY_CONFIGS = {
    "Panama": {
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "lag": 2,
    },
    "Peru": {
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "lag": 2,
    },
    "Argentina": {
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "lag": 2,
    },
    "Dominican Republic": {
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "lag": 2,
    },
    "Uruguay": {
        "resin_label": "Resina FOB Asia",
        "total_label": "Precio final en planta v PET",
        "lag": 1,
    },
    "Brazil": {
        "resin_label": "Resin with assumptions",
        "total_label": "Total V-PET USD/ton",
        "lag": 1,
    },
}


def month_sequence() -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    y, m = START_YEAR, START_MONTH
    while (y < END_YEAR) or (y == END_YEAR and m <= END_MONTH):
        out.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def parse_month_name(value: str) -> int:
    months = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }
    return months[str(value).strip().lower()]


def load_asia_se_forecast() -> dict[tuple[int, int], float]:
    xls = pd.ExcelFile(ASIASE_FORECAST_XLSX)
    # Find sheet with forecast rows (fallback to first sheet)
    sheet = xls.sheet_names[0]
    for name in xls.sheet_names:
        if "forecast" in name.lower() or "asia" in name.lower():
            sheet = name
            break

    df = pd.read_excel(ASIASE_FORECAST_XLSX, sheet_name=sheet)
    cols_lower = {str(c).lower().strip(): c for c in df.columns}

    # Preferred explicit schema from AsiaSE_final_forecast.xlsx
    if "forecast_month" in cols_lower and "point_forecast" in cols_lower:
        month_col = cols_lower["forecast_month"]
        value_col = cols_lower["point_forecast"]
        curve: dict[tuple[int, int], float] = {}
        for _, row in df.iterrows():
            try:
                dt = pd.to_datetime(row[month_col])
                y = int(dt.year)
                m = int(dt.month)
                v = float(row[value_col])
            except Exception:
                continue
            curve[(y, m)] = v
        if curve:
            return curve

    month_col = None
    year_col = None
    value_col = None
    for key, col in cols_lower.items():
        if month_col is None and "month" in key:
            month_col = col
        if year_col is None and "year" in key:
            year_col = col
        if value_col is None and ("value" in key or "forecast" in key or "index" in key):
            value_col = col

    if month_col is None or year_col is None or value_col is None:
        # Try by position fallback: year, month, value-like
        if len(df.columns) < 3:
            raise ValueError("AsiaSE_final_forecast.xlsx does not have enough columns.")
        year_col = df.columns[0]
        month_col = df.columns[1]
        value_col = df.columns[2]

    curve: dict[tuple[int, int], float] = {}
    for _, row in df.iterrows():
        try:
            y = int(row[year_col])
            m_raw = row[month_col]
            m = int(m_raw) if isinstance(m_raw, (int, float)) else parse_month_name(str(m_raw))
            v = float(row[value_col])
        except Exception:
            continue
        curve[(y, m)] = v

    if not curve:
        raise ValueError("No usable forecast rows found in AsiaSE_final_forecast.xlsx")
    return curve


def safe_first_value(df_subset: pd.DataFrame, default: float = 0.0) -> float:
    if df_subset is None or df_subset.empty:
        return default
    try:
        return float(df_subset["Value "].iloc[0])
    except Exception:
        return default


def get_forward_value(curve: dict[tuple[int, int], float], year: int, month: int, lag: int) -> float:
    sm = month - lag
    sy = year
    while sm < 1:
        sm += 12
        sy -= 1
    if (sy, sm) in curve:
        return curve[(sy, sm)]

    # nearest fallback by chronological sort
    keys = sorted(curve.keys())
    if not keys:
        raise ValueError("Empty Asia SE forecast curve")
    target = (sy, sm)
    candidates = sorted(keys, key=lambda k: abs((k[0] - target[0]) * 12 + (k[1] - target[1])))
    return curve[candidates[0]]


def generate_country_rows(existing_df: pd.DataFrame, curve: dict[tuple[int, int], float], dest: str) -> pd.DataFrame:
    if dest not in COUNTRY_CONFIGS:
        return pd.DataFrame()

    cfg = COUNTRY_CONFIGS[dest]
    sub = existing_df[(existing_df["Destination Country"] == dest) & (existing_df["Data Type"] == "Actual")]
    if sub.empty:
        print(f"  {dest}: no actual rows found, skipping")
        return pd.DataFrame()

    # Use latest actual month as template
    sub = sub.copy()
    sub["_sort"] = sub["Time Period Year"].astype(int) * 100 + sub["Time Period Month"].astype(int)
    last_key = int(sub["_sort"].max())
    template = sub[sub["_sort"] == last_key].drop(columns=["_sort"])
    if template.empty:
        print(f"  {dest}: no template rows found, skipping")
        return pd.DataFrame()

    out_rows: list[pd.DataFrame] = []
    for year, month in month_sequence():
        month_rows = template.copy()
        month_rows["Data Type"] = "Forecast"
        month_rows["Time Period Year"] = year
        month_rows["Time Period Month"] = month
        month_rows["Time_Period "] = f"{year}-{month:02d}-01"

        new_resin = get_forward_value(curve, year, month, cfg["lag"])

        for loc in month_rows["Location"].dropna().unique():
            loc_mask = month_rows["Location"] == loc
            resin_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == cfg["resin_label"])
            total_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == cfg["total_label"])
            if not resin_mask.any():
                continue

            old_resin = float(month_rows.loc[resin_mask, "Value "].iloc[0])
            month_rows.loc[resin_mask, "Value "] = round(new_resin, 6)

            if dest == "Uruguay":
                base_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Precio Base de Materia Prima")
                gasto_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Gasto de internacion y puesta en Silos")
                flete_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Flete internacional")
                otros_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Otros gastos")

                flete = safe_first_value(month_rows.loc[flete_mask])
                otros = safe_first_value(month_rows.loc[otros_mask])
                gasto = safe_first_value(month_rows.loc[gasto_mask])

                new_base = new_resin + flete + otros
                new_total = new_base * (1 + gasto)

                if base_mask.any():
                    month_rows.loc[base_mask, "Value "] = round(new_base, 2)
                if total_mask.any():
                    month_rows.loc[total_mask, "Value "] = round(new_total, 5)
            else:
                if total_mask.any():
                    old_total = float(month_rows.loc[total_mask, "Value "].iloc[0])
                    month_rows.loc[total_mask, "Value "] = round(old_total + (new_resin - old_resin), 6)

        out_rows.append(month_rows)

    return pd.concat(out_rows, ignore_index=True) if out_rows else pd.DataFrame()


def main() -> None:
    print("Loading standardized supplier model...")
    xls = pd.ExcelFile(SUPPLIER_XLSX)
    target_sheet = "front_end_data_model" if "front_end_data_model" in xls.sheet_names else xls.sheet_names[0]
    df = pd.read_excel(SUPPLIER_XLSX, sheet_name=target_sheet)

    print("Loading Asia SE forecast curve...")
    curve = load_asia_se_forecast()
    print(f"Curve points loaded: {len(curve)}")

    # Remove all existing forecast rows for ICIS Asia SE destinations,
    # then append only the refreshed Jul-2026..May-2027 forecast set.
    drop_mask = (
        (df["Data Type"].astype(str).str.lower() == "forecast")
        & (df["Destination Country"].isin(ASIA_SE_DESTINATIONS))
    )

    removed = int(drop_mask.sum())
    base_df = df.loc[~drop_mask].copy()
    print(f"Removed old forecast rows: {removed}")

    new_rows_all: list[pd.DataFrame] = []
    for dest in sorted(ASIA_SE_DESTINATIONS):
        rows = generate_country_rows(df, curve, dest)
        if not rows.empty:
            new_rows_all.append(rows)
            print(f"  {dest}: appended {len(rows)} forecast rows")
        else:
            print(f"  {dest}: no rows generated")

    if not new_rows_all:
        print("No new rows generated. Aborting write.")
        return

    new_rows = pd.concat(new_rows_all, ignore_index=True)
    merged = pd.concat([base_df, new_rows], ignore_index=True)

    # Write Excel and CSV
    with pd.ExcelWriter(SUPPLIER_XLSX, engine="openpyxl") as writer:
        merged.to_excel(writer, sheet_name=target_sheet, index=False)
        meta = pd.DataFrame(
            {
                "key": ["last_updated", "script", "description"],
                "value": [
                    datetime.now().isoformat(),
                    "pipelines/suppliers/forecast/refresh_icis_asia_se_forecast.py",
                    f"Replaced {removed} old forecast rows; added {len(new_rows)} rows for ICIS Asia SE destinations ({START_YEAR}-{START_MONTH:02d} to {END_YEAR}-{END_MONTH:02d}).",
                ],
            }
        )
        meta.to_excel(writer, sheet_name="run_metadata", index=False)

    merged.to_csv(SUPPLIER_CSV, index=False)

    print("Done.")
    print(f"Final rows: {len(merged)}")


if __name__ == "__main__":
    main()
