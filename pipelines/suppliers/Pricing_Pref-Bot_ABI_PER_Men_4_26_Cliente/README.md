# Pricing Pref PER Supplier Pipeline

## Scope

Source workbook: `data/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente.xlsx`

Pipeline script: `supplier_pipelines/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente/scripts/run_per_pipeline.py`

The pipeline runs the existing Peru extraction and mapping scripts, then creates supplier-local validation, forecast, standardized, and front-end artifacts.

## Extraction

- Sheet: `Inputs`
- Range: `G9:H13`
- Actual period: April 2026
- Destination country: `Peru`
- Supplier: `San Miguel Industrias (SMI)`

## Calculation Logic

The source workbook calculates:

```text
CIF Price = FOB Price + Ocean Freight
vPET Value = CIF Price + Import Clearance
```

The supplier formula shown in the front-end output is:

```text
PET Resin USD/Ton = (ICIS+OF)*(1+IT)+CC
```

For the current source workbook, Import Tax is `0%`, so the supplier formula matches the workbook calculation.

## Validation

The validation workbook checks:

- Resin index value against `ICIS Asia SE Low`
- Ocean freight rule against the source workbook driver
- CIF subtotal against the workbook formula
- Final vPET/TLC against the workbook formula

April 2026 source values use February 2026, so the pipeline follows:

- `ICIS Asia SE Low (M-2)`

Reference table:

- `Index Fprecast/icis_resin_index_reference_table.csv`

## Forecast

Forecast rows are generated for May 2026 through December 2026.

The resin index is dynamic from the ICIS reference table. Ocean freight, import tax, and import-clearance values are carried from the latest actual month because no forward Drewry freight table is available in the workspace.

## Outputs

Extraction:

- `artifacts/extraction/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente_inputs_final.xlsx`

Calculation validation:

- `artifacts/calculation/per_tlc_calculation_validation.xlsx`

Forecast inputs:

- `artifacts/forecast/per_forecast_inputs_template.xlsx`

Forecast estimate:

- `artifacts/forecast/per_2026_forward_estimation.xlsx`

Front-end ready actual plus forecast:

- `artifacts/front_end/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente_actual_forecast_front_end_standardized.xlsx`
- `artifacts/front_end/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente_actual_forecast_front_end_standardized.csv`

Validation summary:

- `artifacts/validation/validation_summary.json`

## Rerun

```powershell
python "supplier_pipelines\Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente\scripts\run_per_pipeline.py"
```
