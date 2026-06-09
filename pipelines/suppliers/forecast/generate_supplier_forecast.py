# """
# Generate supplier forecast rows for countries missing future months.
# Uses ICIS forward curve with appropriate lag per country.
# Merges forecast into existing Data_Standardized_Front_End_Data_Model.xlsx.
# """

# import pandas as pd
# import numpy as np
# from pathlib import Path
# from datetime import datetime

# # Paths
# BASE = Path(__file__).resolve().parents[3]
# XLSX_PATH = BASE / "data" / "processed" / "current" / "supplier" / "Data_Standardized_Front_End_Data_Model.xlsx"
# ICIS_REF = BASE / "data" / "processed" / "current" / "indexes" / "suppliers" / "icis_resin_index_reference_table.csv"

# # ---------- Load ICIS forward curve ----------
# icis = pd.read_csv(ICIS_REF)

# # Build lookup: (year, month, index_type) -> value
# icis_2026 = icis[icis["time_period_year"] == 2026]

# # Asia SE Low forward curve for 2026
# asia_se_low = icis_2026[icis_2026["resin_index_type"] == "ICIS Asia SE Low"].set_index("time_period_month")["value"].to_dict()
# # China Mid forward curve for 2026
# china_mid = icis_2026[icis_2026["resin_index_type"] == "ICIS China Mid"].set_index("time_period_month")["value"].to_dict()

# print("ICIS Asia SE Low 2026:", {k: round(v, 1) for k, v in sorted(asia_se_low.items())})
# print("ICIS China Mid 2026:", {k: round(v, 1) for k, v in sorted(china_mid.items())})

# # For months where China Mid isn't available (May-Dec 2026),
# # extrapolate using Asia SE Low growth rate from last known China Mid
# # Last known China Mid: April 2026 = 1191.9
# # We'll scale using the ratio of Asia SE Low growth
# if 5 not in china_mid:
#     last_china_mid_month = max(china_mid.keys())
#     last_china_mid_val = china_mid[last_china_mid_month]
#     last_asia_se_val = asia_se_low[last_china_mid_month]
#     for m in range(last_china_mid_month + 1, 13):
#         if m in asia_se_low:
#             ratio = asia_se_low[m] / last_asia_se_val
#             china_mid[m] = round(last_china_mid_val * ratio, 2)

# print("China Mid (extrapolated):", {k: round(v, 1) for k, v in sorted(china_mid.items())})

# # ---------- Load existing supplier data ----------
# df = pd.read_excel(XLSX_PATH, sheet_name="front_end_data_model")
# print(f"\nExisting data: {len(df)} rows")

# # ---------- Country configurations ----------
# # Each config: (resin_lag, resin_index_source, resin_component_label, total_label, formula_type)
# # formula_type: 'sum' = total is sum of components; 'custom' = need special calc

# COUNTRY_CONFIGS = {
#     "Panama": {
#         "supplier": "Pastiglas S.A",
#         "location": "Peru",
#         "lag": 2,  # M-2
#         "index_source": "asia_se_low",
#         "resin_label": "FOB Price",
#         "total_label": "DDP Price",
#         "resin_index_type": "ICIS Asia SE Low index (M-2)",
#         "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
#     },
#     "Peru": {
#         "supplier": "San Miguel Industrias (SMI)",
#         "location": "Peru",
#         "lag": 2,
#         "index_source": "asia_se_low",
#         "resin_label": "FOB Price",
#         "total_label": "DDP Price",
#         "resin_index_type": "ICIS Asia SE Low index (M-2)",
#         "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
#     },
#     "Argentina": {
#         "supplier": "DAK Americas",
#         "location": "China",
#         "lag": 2,
#         "index_source": "asia_se_low",
#         "resin_label": "FOB Price",
#         "total_label": "DDP Price",
#         "resin_index_type": "ICIS Asia SE Low index (M-2)",
#         "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
#     },
#     "Dominican Republic": {
#         "supplier": "SMI PET",
#         "location": None,  # multiple locations
#         "lag": 2,
#         "index_source": "asia_se_low",
#         "resin_label": "FOB Price",
#         "total_label": "DDP Price",
#         "resin_index_type": "ICIS Asia SE Low index (M-2)",
#         "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
#     },
#     "Uruguay": {
#         "supplier": "FNC",
#         "location": "Asia",
#         "lag": 1,  # M-1
#         "index_source": "asia_se_low",
#         "resin_label": "Resina FOB Asia",
#         "total_label": "Precio final en planta v PET",
#         "resin_index_type": "ICIS Asia SE Low index (M-1)",
#         "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
#     },
#     "El Salvador and Honduras": {
#         "supplier": "Amcor",
#         "location": "China",
#         "lag": 1,  # N-4 ≈ 1 month
#         "index_source": "china_mid",
#         "resin_label": "PET Bottle Grade FOB China Mid (N-4)",
#         "total_label": "Total precio ABI",
#         "resin_index_type": "PET Bottle Grade FOB China Mid (N-4) USD/ton",
#         "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
#     },
#     "Colombia": {
#         "skip_if_has_forecast": True,
#     },
#     "Bolivia": {
#         "supplier": "San Miguel Industrias (SMI)",
#         "location": "Peru",
#         "lag": 2,
#         "index_source": "asia_se_low",
#         "resin_label": "FOB Price",
#         "total_label": "DDP Price",
#         "resin_index_type": "ICIS Asia SE Low index (M-2)",
#         "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
#         "create_from_scratch": True,
#         "base_template": {
#             "FOB Price": None,  # will be set from forward curve
#             "Ocean Freight": 175.0,
#             "Import Clearance (%)": 40.0,
#             "DDP Price": None,  # calculated
#         },
#     },
# }


# def get_forward_value(index_source, forecast_month, lag):
#     """Get ICIS forward curve value for a given month with lag."""
#     source_month = forecast_month - lag
#     if source_month < 1:
#         source_month += 12  # wrap to previous year (use January as fallback)
    
#     curve = asia_se_low if index_source == "asia_se_low" else china_mid
#     if source_month in curve:
#         return curve[source_month]
#     # Fallback: use closest available month
#     available = sorted(curve.keys())
#     if source_month <= available[0]:
#         return curve[available[0]]
#     return curve[available[-1]]


# def generate_forecast_rows(dest, config, existing_df):
#     """Generate forecast rows for a single destination."""
#     if config.get("skip_if_has_forecast"):
#         sub = existing_df[existing_df["Destination Country"] == dest]
#         if "Forecast" in sub["Data Type"].values:
#             print(f"  {dest}: Already has forecast, skipping")
#             return pd.DataFrame()
    
#     # Get existing actual data for this destination
#     sub = existing_df[existing_df["Destination Country"] == dest]
    
#     if config.get("create_from_scratch") and len(sub) == 0:
#         # Bolivia: create from scratch
#         return generate_from_scratch(dest, config)
    
#     if len(sub) == 0:
#         print(f"  {dest}: No existing data, skipping")
#         return pd.DataFrame()
    
#     # Find last actual month
#     actual_months = sorted(sub[sub["Data Type"] == "Actual"]["Time Period Month"].unique())
#     last_actual_month = int(max(actual_months))
    
#     # Determine which months need forecast
#     forecast_months = list(range(last_actual_month + 1, 13))
#     if not forecast_months:
#         print(f"  {dest}: Already has data through December, skipping")
#         return pd.DataFrame()
    
#     # Get template from last actual month
#     template = sub[(sub["Data Type"] == "Actual") & (sub["Time Period Month"] == last_actual_month)].copy()
    
#     if len(template) == 0:
#         print(f"  {dest}: No template found for month {last_actual_month}")
#         return pd.DataFrame()
    
#     # Get the resin value from template to calculate ratio
#     resin_rows = template[template["Raw Cost Breakdown"] == config["resin_label"]]
#     if len(resin_rows) == 0:
#         print(f"  {dest}: No resin row '{config['resin_label']}' found in template")
#         return pd.DataFrame()
    
#     all_forecast_rows = []
    
#     for fm in forecast_months:
#         # Get new resin value from forward curve
#         new_resin_value = get_forward_value(config["index_source"], fm, config["lag"])
        
#         # Create forecast rows from template
#         month_rows = template.copy()
#         month_rows["Data Type"] = "Forecast"
#         month_rows["Time Period Month"] = fm
#         month_rows["Time_Period "] = f"2026-{fm:02d}-01"
#         month_rows["Forecast Resin Index Type"] = config["forecast_resin_index_type"]
        
#         # Update resin component
#         for loc in month_rows["Location"].unique():
#             loc_mask = month_rows["Location"] == loc
#             resin_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == config["resin_label"])
            
#             if resin_mask.any():
#                 old_resin = month_rows.loc[resin_mask, "Value "].values[0]
#                 month_rows.loc[resin_mask, "Value "] = new_resin_value
                
#                 # Calculate the delta
#                 resin_delta = new_resin_value - old_resin
                
#                 # Update total
#                 total_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == config["total_label"])
#                 if total_mask.any():
#                     old_total = month_rows.loc[total_mask, "Value "].values[0]
#                     # For most countries: total = FOB + Freight + Tax
#                     # The delta in total equals delta in resin for simple additive formulas
#                     # For Uruguay with multiplicative factor, handle differently
#                     if dest == "Uruguay":
#                         # Uruguay: Precio final = Precio Base * (1 + Gasto internacion)
#                         # Precio Base = Resina + Flete + Otros
#                         base_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Precio Base de Materia Prima")
#                         gasto_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Gasto de internacion y puesta en Silos")
#                         flete_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Flete internacional")
#                         otros_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Otros gastos")
                        
#                         flete = month_rows.loc[flete_mask, "Value "].values[0] if flete_mask.any() else 0
#                         otros = month_rows.loc[otros_mask, "Value "].values[0] if otros_mask.any() else 0
#                         gasto = month_rows.loc[gasto_mask, "Value "].values[0] if gasto_mask.any() else 0
                        
#                         new_base = new_resin_value + flete + otros
#                         new_total = new_base * (1 + gasto)
                        
#                         if base_mask.any():
#                             month_rows.loc[base_mask, "Value "] = round(new_base, 2)
#                         month_rows.loc[total_mask, "Value "] = round(new_total, 5)
#                     elif dest == "El Salvador and Honduras":
#                         # ESH: Total = FOB + Adder + Logistics + LANDED + Finance
#                         # Finance is proportional to FOB (SOFR based)
#                         adder_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Adder")
#                         logistics_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Logistics")
#                         landed_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "LANDED")
#                         finance_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Finance fee V (SOFR +3,8%@185)")
                        
#                         adder = month_rows.loc[adder_mask, "Value "].values[0] if adder_mask.any() else 0
#                         logistics = month_rows.loc[logistics_mask, "Value "].values[0] if logistics_mask.any() else 0
#                         landed = month_rows.loc[landed_mask, "Value "].values[0] if landed_mask.any() else 0
                        
#                         # Finance fee scales with resin value (approximately)
#                         old_finance = month_rows.loc[finance_mask, "Value "].values[0] if finance_mask.any() else 0
#                         if old_resin > 0:
#                             finance_ratio = old_finance / old_resin
#                             new_finance = new_resin_value * finance_ratio
#                         else:
#                             new_finance = old_finance
                        
#                         if finance_mask.any():
#                             month_rows.loc[finance_mask, "Value "] = round(new_finance, 6)
                        
#                         new_total = new_resin_value + adder + logistics + landed + new_finance
#                         month_rows.loc[total_mask, "Value "] = round(new_total, 1)
#                     else:
#                         # Simple additive: DDP = FOB + Freight + Clearance
#                         # Total changes by same delta as resin
#                         month_rows.loc[total_mask, "Value "] = round(old_total + resin_delta, 1)
        
#         all_forecast_rows.append(month_rows)
    
#     if all_forecast_rows:
#         result = pd.concat(all_forecast_rows, ignore_index=True)
#         print(f"  {dest}: Generated {len(result)} forecast rows for months {forecast_months}")
#         return result
#     return pd.DataFrame()


# def generate_from_scratch(dest, config):
#     """Generate forecast data for Bolivia (no existing data)."""
#     template_data = config["base_template"]
#     forecast_months = list(range(2, 13))  # February through December
    
#     all_rows = []
#     for fm in forecast_months:
#         resin_value = get_forward_value(config["index_source"], fm, config["lag"])
#         freight = template_data["Ocean Freight"]
#         clearance = template_data["Import Clearance (%)"]
#         ddp = resin_value + freight + clearance
        
#         components = [
#             ("FOB Price", resin_value),
#             ("Ocean Freight", freight),
#             ("Import Clearance (%)", clearance),
#             ("DDP Price", round(ddp, 1)),
#         ]
        
#         for label, value in components:
#             row = {
#                 "Data Type": "Forecast",
#                 "Source File ": "Generated Forecast",
#                 "Supplier Name": config["supplier"],
#                 "Destination Country": dest,
#                 "Time_Period ": f"2026-{fm:02d}-01",
#                 "Time Period Year": 2026,
#                 "Time Period Month": fm,
#                 "Location": config["location"],
#                 "Raw Cost Breakdown": label,
#                 "Resin Index Type": config["resin_index_type"],
#                 "Forecast Resin Index Type": config["forecast_resin_index_type"],
#                 "Mapping Columns": None,
#                 "Column Required for Calculation": "Yes" if label != "DDP Price" else "Derived",
#                 "Value ": value,
#                 "TLC Formula": "DDP Price = FOB Price + Ocean Freight + Import Clearance",
#             }
#             all_rows.append(row)
    
#     result = pd.DataFrame(all_rows)
#     print(f"  {dest}: Generated {len(result)} forecast rows from scratch (months {forecast_months})")
#     return result


# # ---------- Main execution ----------
# print("\n=== Generating Supplier Forecasts ===")
# all_new_rows = []

# for dest, config in COUNTRY_CONFIGS.items():
#     forecast_df = generate_forecast_rows(dest, config, df)
#     if len(forecast_df) > 0:
#         all_new_rows.append(forecast_df)

# if not all_new_rows:
#     print("\nNo new forecast rows generated.")
# else:
#     new_rows_df = pd.concat(all_new_rows, ignore_index=True)
#     print(f"\nTotal new forecast rows: {len(new_rows_df)}")
    
#     # Merge with existing data
#     merged = pd.concat([df, new_rows_df], ignore_index=True)
#     print(f"Merged total: {len(merged)} rows")
    
#     # Write back
#     with pd.ExcelWriter(XLSX_PATH, engine="openpyxl") as writer:
#         merged.to_excel(writer, sheet_name="front_end_data_model", index=False)
#         # Write metadata
#         meta = pd.DataFrame({
#             "key": ["last_updated", "script", "description"],
#             "value": [
#                 datetime.now().isoformat(),
#                 "pipelines/suppliers/forecast/generate_supplier_forecast.py",
#                 f"Added {len(new_rows_df)} forecast rows for {len(all_new_rows)} countries",
#             ],
#         })
#         meta.to_excel(writer, sheet_name="run_metadata", index=False)
    
#     print(f"\nWritten to: {XLSX_PATH}")
    
#     # Summary
#     print("\n=== Final Summary ===")
#     for dest in COUNTRY_CONFIGS.keys():
#         sub = merged[merged["Destination Country"] == dest]
#         if len(sub) > 0:
#             months = sorted(sub["Time Period Month"].unique())
#             types = sub["Data Type"].unique().tolist()
#             print(f"  {dest}: {len(sub)} rows, months={months}, types={types}")

"""
Generate supplier forecast rows for countries missing future months.
Uses ICIS forward curve with appropriate lag per country.
Merges forecast into existing Data_Standardized_Front_End_Data_Model.xlsx.
"""

import pandas as pd
from pathlib import Path
from datetime import datetime

# Paths
BASE = Path(__file__).resolve().parents[3]
XLSX_PATH = BASE / "data" / "processed" / "current" / "supplier" / "Data_Standardized_Front_End_Data_Model.xlsx"
ICIS_REF = BASE / "data" / "processed" / "current" / "indexes" / "suppliers" / "icis_resin_index_reference_table.csv"

# ---------- Load ICIS forward curve ----------
icis = pd.read_csv(ICIS_REF)

# Build lookup: (year, month, index_type) -> value
icis_2026 = icis[icis["time_period_year"] == 2026]

# Asia SE Low forward curve for 2026
asia_se_low = (
    icis_2026[icis_2026["resin_index_type"] == "ICIS Asia SE Low"]
    .set_index("time_period_month")["value"]
    .to_dict()
)

# China Mid forward curve for 2026
china_mid = (
    icis_2026[icis_2026["resin_index_type"] == "ICIS China Mid"]
    .set_index("time_period_month")["value"]
    .to_dict()
)

print("ICIS Asia SE Low 2026:", {k: round(v, 1) for k, v in sorted(asia_se_low.items())})
print("ICIS China Mid 2026:", {k: round(v, 1) for k, v in sorted(china_mid.items())})

# For months where China Mid isn't available (May-Dec 2026),
# extrapolate using Asia SE Low growth rate from last known China Mid
if 5 not in china_mid and len(china_mid) > 0:
    last_china_mid_month = max(china_mid.keys())
    last_china_mid_val = china_mid[last_china_mid_month]
    last_asia_se_val = asia_se_low.get(last_china_mid_month)

    if last_asia_se_val is not None and last_asia_se_val != 0:
        for m in range(last_china_mid_month + 1, 13):
            if m in asia_se_low:
                ratio = asia_se_low[m] / last_asia_se_val
                china_mid[m] = round(last_china_mid_val * ratio, 2)

print("China Mid (extrapolated):", {k: round(v, 1) for k, v in sorted(china_mid.items())})

# ---------- Load existing supplier data ----------
df = pd.read_excel(XLSX_PATH, sheet_name="front_end_data_model")
print(f"\nExisting data: {len(df)} rows")

# ---------- Country configurations ----------
# Each config: lag, index source, labels, and forecast behavior

COUNTRY_CONFIGS = {
    "Panama": {
        "supplier": "Pastiglas S.A",
        "location": "Peru",
        "lag": 2,  # M-2
        "index_source": "asia_se_low",
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "resin_index_type": "ICIS Asia SE Low index (M-2)",
        "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
    },
    "Peru": {
        "supplier": "San Miguel Industrias (SMI)",
        "location": "Peru",
        "lag": 2,
        "index_source": "asia_se_low",
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "resin_index_type": "ICIS Asia SE Low index (M-2)",
        "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
    },
    "Argentina": {
        "supplier": "DAK Americas",
        "location": "China",
        "lag": 2,
        "index_source": "asia_se_low",
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "resin_index_type": "ICIS Asia SE Low index (M-2)",
        "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
    },
    "Dominican Republic": {
        "supplier": "SMI PET",
        "location": None,  # multiple locations
        "lag": 2,
        "index_source": "asia_se_low",
        "resin_label": "FOB Price",
        "total_label": "DDP Price",
        "resin_index_type": "ICIS Asia SE Low index (M-2)",
        "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
    },
    "Uruguay": {
        "supplier": "FNC",
        "location": "Asia",
        "lag": 1,  # M-1
        "index_source": "asia_se_low",
        "resin_label": "Resina FOB Asia",
        "total_label": "Precio final en planta v PET",
        "resin_index_type": "ICIS Asia SE Low index (M-1)",
        "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
    },
    "El Salvador and Honduras": {
        "supplier": "Amcor",
        "location": "China",
        "lag": 1,  # N-4 ≈ 1 month
        "index_source": "china_mid",
        "resin_label": "PET Bottle Grade FOB China Mid (N-4)",
        "total_label": "Total precio ABI",
        "resin_index_type": "PET Bottle Grade FOB China Mid (N-4) USD/ton",
        "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
    },
    "Colombia": {
        "skip_if_has_forecast": True,
    },
    "Bolivia": {
        "supplier": "Preforsa",
        "location": "Bolivia",
        "lag": 1,
        "index_source": "china_mid",
        "resin_label": "ICIS N-1",
        "total_label": "VPET",
        "resin_index_type": "ICIS China Mid index (N-1)",
        "forecast_resin_index_type": "PET Bottle Grade FOB China Spot",
    },
}


def get_forward_value(index_source, forecast_month, lag):
    """Get ICIS forward curve value for a given month with lag."""
    source_month = forecast_month - lag
    if source_month < 1:
        source_month += 12  # wrap to previous year (use January as fallback)

    curve = asia_se_low if index_source == "asia_se_low" else china_mid

    if source_month in curve:
        return curve[source_month]

    # Fallback: use closest available month
    available = sorted(curve.keys())
    if not available:
        return None

    if source_month <= available[0]:
        return curve[available[0]]

    return curve[available[-1]]


def safe_first_value(df_subset, default=0):
    """Safely return first value from a DataFrame subset, otherwise default."""
    if df_subset is None or len(df_subset) == 0:
        return default
    return df_subset["Value "].values[0]


def generate_forecast_rows(dest, config, existing_df):
    """Generate forecast rows for a single destination."""
    if config.get("skip_if_has_forecast"):
        sub = existing_df[existing_df["Destination Country"] == dest]
        if "Forecast" in sub["Data Type"].values:
            print(f"  {dest}: Already has forecast, skipping")
            return pd.DataFrame()

    # Get existing actual data for this destination
    sub = existing_df[existing_df["Destination Country"] == dest]

    if len(sub) == 0:
        print(f"  {dest}: No existing data, skipping")
        return pd.DataFrame()

    # Find last actual month
    actual_months = sorted(sub[sub["Data Type"] == "Actual"]["Time Period Month"].unique())
    if len(actual_months) == 0:
        print(f"  {dest}: No actual months found, skipping")
        return pd.DataFrame()

    last_actual_month = int(max(actual_months))

    # Determine which months need forecast
    forecast_months = list(range(last_actual_month + 1, 13))
    if not forecast_months:
        print(f"  {dest}: Already has data through December, skipping")
        return pd.DataFrame()

    # Get template from last actual month
    template = sub[
        (sub["Data Type"] == "Actual") &
        (sub["Time Period Month"] == last_actual_month)
    ].copy()

    if len(template) == 0:
        print(f"  {dest}: No template found for month {last_actual_month}")
        return pd.DataFrame()

    # Get the resin value from template to calculate ratio
    resin_rows = template[template["Raw Cost Breakdown"] == config["resin_label"]]
    if len(resin_rows) == 0:
        print(f"  {dest}: No resin row '{config['resin_label']}' found in template")
        return pd.DataFrame()

    all_forecast_rows = []

    for fm in forecast_months:
        # Get new resin value from forward curve
        new_resin_value = get_forward_value(config["index_source"], fm, config["lag"])
        if new_resin_value is None:
            print(f"  {dest}: No forward value found for month {fm}, skipping")
            continue

        # Create forecast rows from template
        month_rows = template.copy()
        month_rows["Data Type"] = "Forecast"
        month_rows["Time Period Month"] = fm
        month_rows["Time_Period "] = f"2026-{fm:02d}-01"
        month_rows["Forecast Resin Index Type"] = config["forecast_resin_index_type"]

        # Update resin component and total
        for loc in month_rows["Location"].dropna().unique():
            loc_mask = month_rows["Location"] == loc
            resin_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == config["resin_label"])
            total_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == config["total_label"])

            if resin_mask.any():
                old_resin = month_rows.loc[resin_mask, "Value "].values[0]
                month_rows.loc[resin_mask, "Value "] = new_resin_value
                resin_delta = new_resin_value - old_resin

                # Update total based on country logic
                if dest == "Uruguay":
                    # Uruguay: Precio final = Precio Base * (1 + Gasto internacion)
                    base_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Precio Base de Materia Prima")
                    gasto_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Gasto de internacion y puesta en Silos")
                    flete_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Flete internacional")
                    otros_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Otros gastos")

                    flete = safe_first_value(month_rows.loc[flete_mask])
                    otros = safe_first_value(month_rows.loc[otros_mask])
                    gasto = safe_first_value(month_rows.loc[gasto_mask])

                    new_base = new_resin_value + flete + otros
                    new_total = new_base * (1 + gasto)

                    if base_mask.any():
                        month_rows.loc[base_mask, "Value "] = round(new_base, 2)
                    if total_mask.any():
                        month_rows.loc[total_mask, "Value "] = round(new_total, 5)

                elif dest == "El Salvador and Honduras":
                    # ESH: Total = FOB + Adder + Logistics + LANDED + Finance
                    adder_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Adder")
                    logistics_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Logistics")
                    landed_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "LANDED")
                    finance_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "Finance fee V (SOFR +3,8%@185)")

                    adder = safe_first_value(month_rows.loc[adder_mask])
                    logistics = safe_first_value(month_rows.loc[logistics_mask])
                    landed = safe_first_value(month_rows.loc[landed_mask])

                    old_finance = safe_first_value(month_rows.loc[finance_mask])
                    if old_resin > 0:
                        finance_ratio = old_finance / old_resin
                        new_finance = new_resin_value * finance_ratio
                    else:
                        new_finance = old_finance

                    if finance_mask.any():
                        month_rows.loc[finance_mask, "Value "] = round(new_finance, 6)

                    new_total = new_resin_value + adder + logistics + landed + new_finance
                    if total_mask.any():
                        month_rows.loc[total_mask, "Value "] = round(new_total, 1)

                elif dest == "Bolivia":
                    # Bolivia:
                    # VPET = ((ICIS N-1 + FLETE MARITIMO) * (1 + OTHER COST ( CDP) + OTHER COST (BANK FEE))) + INTERNALIZATION COST
                    flete_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "FLETE MARITIMO")
                    internal_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "INTERNALIZATION COST")
                    cdp_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "OTHER COST ( CDP)")
                    bank_mask = loc_mask & (month_rows["Raw Cost Breakdown"] == "OTHER COST (BANK FEE)")

                    flete = safe_first_value(month_rows.loc[flete_mask])
                    internal = safe_first_value(month_rows.loc[internal_mask])
                    cdp = safe_first_value(month_rows.loc[cdp_mask])
                    bank = safe_first_value(month_rows.loc[bank_mask])

                    # Since CDP and BANK FEE are stored as decimal fractions,
                    # use them directly in the multiplier.
                    new_total = ((new_resin_value + flete) * (1 + cdp + bank)) + internal

                    if total_mask.any():
                        month_rows.loc[total_mask, "Value "] = round(new_total, 6)

                else:
                    # Simple additive: total changes by same delta as resin
                    if total_mask.any():
                        old_total = month_rows.loc[total_mask, "Value "].values[0]
                        month_rows.loc[total_mask, "Value "] = round(old_total + resin_delta, 1)

        all_forecast_rows.append(month_rows)

    if all_forecast_rows:
        result = pd.concat(all_forecast_rows, ignore_index=True)
        print(f"  {dest}: Generated {len(result)} forecast rows for months {forecast_months}")
        return result

    return pd.DataFrame()


# ---------- Main execution ----------
print("\n=== Generating Supplier Forecasts ===")
all_new_rows = []

for dest, config in COUNTRY_CONFIGS.items():
    forecast_df = generate_forecast_rows(dest, config, df)
    if len(forecast_df) > 0:
        all_new_rows.append(forecast_df)

if not all_new_rows:
    print("\nNo new forecast rows generated.")
else:
    new_rows_df = pd.concat(all_new_rows, ignore_index=True)
    print(f"\nTotal new forecast rows: {len(new_rows_df)}")

    # Merge with existing data
    merged = pd.concat([df, new_rows_df], ignore_index=True)
    print(f"Merged total: {len(merged)} rows")

    # Write back
    with pd.ExcelWriter(XLSX_PATH, engine="openpyxl") as writer:
        merged.to_excel(writer, sheet_name="front_end_data_model", index=False)

        # Write metadata
        meta = pd.DataFrame({
            "key": ["last_updated", "script", "description"],
            "value": [
                datetime.now().isoformat(),
                "pipelines/suppliers/forecast/generate_supplier_forecast.py",
                f"Added {len(new_rows_df)} forecast rows for {len(all_new_rows)} countries",
            ],
        })
        meta.to_excel(writer, sheet_name="run_metadata", index=False)

    print(f"\nWritten to: {XLSX_PATH}")

    # Summary
    print("\n=== Final Summary ===")
    for dest in COUNTRY_CONFIGS.keys():
        sub = merged[merged["Destination Country"] == dest]
        if len(sub) > 0:
            months = sorted(sub["Time Period Month"].unique())
            types = sub["Data Type"].unique().tolist()
            print(f"  {dest}: {len(sub)} rows, months={months}, types={types}")