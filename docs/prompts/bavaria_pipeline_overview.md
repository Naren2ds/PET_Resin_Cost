# Bavaria Pipeline Overview

Last updated: 2026-05-15

This document describes the Bavaria data pipeline from source Excel through extraction, mapping, calculation, forecasting, standardization, and web-app display.

## 1. Source Excel

Source file:

`data/1 Bavaria - Precio Marzo.xlsx`

Source sheet:

`Fórmula Marzo 26`

Source range:

`B13:CV26`

Important extracted source fields:

- `metric_en`
- `metric_local`
- `price_period`
- `index_period`
- `value`
- `formula`
- `source_cell`

## 2. Extraction

Script:

`scripts/extract_bavaria_formula.py`

Base extracted output:

`output/1 Bavaria - Precio Marzo_formula_final.xlsx`

Purpose:

- Converts the Bavaria formula grid into long-format component rows.
- Preserves Excel formulas and source cell references.
- Keeps both English and local metric labels.

## 3. Mapping Columns

Script:

`scripts/add_bavaria_mapping_columns.py`

Mapping workbook:

`mapping files/Mapping_Columns.xlsx`

Mapping sheet:

`1 Bavaria - Precio Marzo_formul`

Lookup:

`final_data.metric_local` to mapping sheet `metric_local`

Mapped output:

`output/1 Bavaria - Precio Marzo_formula_final_with_mapping_columns.xlsx`

Adds:

- `resin_index_type`
- `Mapping Columns`

Bavaria resin index type:

`ICIS China MID (n-1)`

This is extracted from the `metric_local` value for the `Resin Price Index` row:

`ICIS China MID (n-1).`

The trailing period/space is cleaned during mapping.

## 4. Historical TLC Validation

Script:

`data calculation/calculate_bavaria_tlc.py`

Validation output:

`data calculation/Bavaria_tlc_calculation_validation.xlsx`

Formula:

`Total Landing Cost = Sub Total (with Incremental Freight) + Duty + Landed Factor + ZF Legislation Change + Sur Charge Alpek Br`

Subtotal logic:

`Sub Total (with Incremental Freight) = Resin Price Index + Finance + Freight Regular + Freight Incremental`

Important nuance:

- Duty uses `Sub Total (with Incremental Freight)`.
- Landed Factor uses `Sub Total (with Regular Freight)`.
- The extracted subtotal row is used when present, because some historical cells are hardcoded or rounded.

Validation result:

- 96 periods calculated.
- 95 matched source TLC.
- 1 source override found: March 2022, source cell `AZ26`.

## 5. Resin Index Forecast Extraction

Forecast source folder:

`Forecast/`

Forecast source file currently used:

`Forecast/ICIS Dashboard Price Forecast 2026-04-17 221720.xls`

Script:

`scripts/extract_resin_index_forecast.py`

Source sheet:

`ICIS Price Forecast`

Source range:

`B13:D82`

Outputs:

- `Estimation/resin_index_forecast_table.xlsx`
- `Estimation/resin_index_forecast_table.csv`

Purpose:

- Flattens the two source value columns into one `value` column.
- Preserves the original forecast series in `forecast_series`.
- Adds `resin_index_type`.

Forecast resin index type currently inferred:

`PET Bottle Grade FOB China Spot`

This is the forecast series used to estimate Bavaria’s `ICIS China MID (n-1)` input.

## 6. Forecast Template and Formula Catalog

Generator script:

`data calculation/build_bavaria_forecast_inputs.py`

Generated files:

- `data calculation/Bavaria_formula_catalog.xlsx`
- `data calculation/Bavaria_future_inputs_template.xlsx`

Purpose:

- Documents which components are variable inputs, constants, assumptions, formulas, or outputs.
- Creates an editable monthly forecast input template.
- Carries `resin_index_type` into the catalog and future template.

Main editable inputs:

- `resin_price_index`
- `freight_regular`
- `drewry_freight`
- `freight_incremental_override`
- `finance_factor`
- `finance_value_override`
- `duty_rate`
- `landed_factor_rate`
- `zf_legislation_change`
- `surcharge_alpek_br`

Current key assumptions:

- `freight_regular`: `97.286177169`
- `freight_incremental_override`: latest March 2026 value when forecasting
- `finance_factor`: `0.03496712876712329`
- `duty_rate`: `0.05`
- `landed_factor_rate`: `0.08`
- `zf_legislation_change`: `18.95837133417279`
- `surcharge_alpek_br`: `0`

## 7. 2026 Forward Estimation

Script:

`scripts/estimate_bavaria_2026_forward.py`

Input:

`Estimation/resin_index_forecast_table.csv`

Output:

`Estimation/bavaria_2026_forward_estimation.xlsx`

Current forecast period:

April 2026 through December 2026

Logic:

- Uses `resin_index_type = PET Bottle Grade FOB China Spot` from the forecast table.
- Maps that forecast to Bavaria source resin index type `ICIS China MID (n-1)`.
- Uses monthly forecast rows when available.
- Keeps `freight_incremental_override` equal to the latest historical March 2026 value.
- Keeps all other Bavaria assumptions unchanged unless updated.

Output sheets:

- `bavaria_2026_estimate`
- `standardized_rows`
- `assumptions`
- `run_metadata`

## 8. Standardization

Script:

`data standardization/standardize_bavaria.py`

Template:

`standardization/Data_Standardization.xlsx`

Output:

`data standardization/Amcor_Bavaria_final_standardized.xlsx`

Supplier/country lookup:

`mapping files/Formula overview by countries.xlsx`

If the formula overview workbook is locked, the script falls back to the existing Bavaria standardized output and keeps the known Bavaria supplier/country values.

Bavaria supplier and country:

- Supplier: `Amcor`
- Destination Country: `Colombia`

Standardized fields include:

- `Source File `
- `Supplier Name`
- `Destination Country`
- `Time_Period `
- `Raw Cost Breakdown`
- `Resin Index Type`
- `Mapping Columns`
- `Value `

## 9. Actual + Forecast Merge

Script:

`data standardization/merge_bavaria_actual_forecast.py`

Inputs:

- Actual standardized rows: `data standardization/Amcor_Bavaria_final_standardized.xlsx`, sheet `final_standardized`
- Forecast standardized rows: `Estimation/bavaria_2026_forward_estimation.xlsx`, sheet `standardized_rows`

Outputs:

- Master Excel table: `data standardization/Bavaria_actual_forecast_final_standardized.xlsx`
- Front-end/backend CSV copy: `Front End/PET-Backend/PET-Backend/standardized_data/bavaria_actual_forecast_final_standardized.csv`

Current merged result:

- Actual rows: `822`
- Forecast rows: `99`
- Total rows: `921`

Merged fields:

- `Data Type`: `Actual` or `Forecast`
- `Source File `
- `Supplier Name`
- `Destination Country`
- `Time_Period `
- `Time Period Year`
- `Time Period Month`
- `Raw Cost Breakdown`
- `Resin Index Type`
- `Forecast Resin Index Type`
- `Mapping Columns`
- `Value `
- `TLC Formula`

## 10. Web App Display

The web app should consume the merged standardized CSV:

`Front End/PET-Backend/PET-Backend/standardized_data/bavaria_actual_forecast_final_standardized.csv`

Recommended web-app fields:

- Supplier Name
- Destination Country
- Time Period
- Raw Cost Breakdown
- Resin Index Type
- Forecast Resin Index Type
- Mapping Columns
- Value
- Data Type: Historical or Forecast
- TLC Formula
- Assumption Version

Recommended visuals:

- Bavaria TLC trend
- Historical vs forecast split
- Component breakdown by month
- Resin index vs TLC comparison
- Filters by supplier, country, period, component, and resin index type

## 11. End-to-End Bavaria Flow

`Source Excel -> Extraction -> Mapping + Resin Index Type -> TLC Validation -> Resin Forecast Extraction -> Forecast Template -> Forward Estimation -> Standardization -> Combined Web-App Dataset -> Web App`

## Useful Commands

Run Bavaria mapping:

```powershell
python scripts\add_bavaria_mapping_columns.py
```

Run Bavaria TLC validation:

```powershell
python "data calculation\calculate_bavaria_tlc.py"
```

Regenerate forecast catalog/template:

```powershell
python "data calculation\build_bavaria_forecast_inputs.py"
```

Extract resin forecast table:

```powershell
python scripts\extract_resin_index_forecast.py
```

Run Bavaria 2026 forecast estimation:

```powershell
python scripts\estimate_bavaria_2026_forward.py
```

Regenerate Bavaria standardized output:

```powershell
python "data standardization\standardize_bavaria.py"
```

Merge actual and forecast standardized rows for the web app:

```powershell
python "data standardization\merge_bavaria_actual_forecast.py"
```
