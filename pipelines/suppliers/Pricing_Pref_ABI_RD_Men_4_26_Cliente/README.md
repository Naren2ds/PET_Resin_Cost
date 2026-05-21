# Pricing Pref RD Supplier Pipeline

## Scope

Source workbook: `data/Pricing_Pref_ABI_RD_Men_4_26_Cliente.xlsx`

Pipeline script: `supplier_pipelines/Pricing_Pref_ABI_RD_Men_4_26_Cliente/scripts/run_rd_pipeline.py`

The pipeline runs the existing RD extraction and mapping scripts, then creates supplier-local validation, forecast, standardized, and front-end artifacts.

## Extraction

- Sheet: `Inputs`
- Range: `G8:I12`
- Actual period: April 2026
- Countries from source columns: `El Salvador`, `Peru`
- Supplier: `SMI PET`

## Calculation Logic

The source workbook calculates DDP as:

```text
DDP Price = FOB Price + Ocean Freight + Import Clearance
```

The supplier formula shown in the front-end output is:

```text
PET Resin USD/Ton = (ICIS+OF)*(1+IT)+CC
```

For the current source workbook, Import Tax is `0%`, so the supplier formula matches the workbook calculation.

## Validation

The validation workbook checks three things for each country:

- Resin index value against `ICIS Asia SE Low`
- Ocean freight rule against the source workbook driver
- DDP price against the source workbook formula

April 2026 source values use February 2026, so the pipeline follows:

- `ICIS Asia SE Low (M-2)`

Reference table:

- `Index Fprecast/icis_resin_index_reference_table.csv`

## Forecast

Forecast rows are generated for May 2026 through December 2026.

The resin index is dynamic from the ICIS reference table. Ocean freight, import tax, and import-clearance values are carried from the latest actual month because no forward Drewry freight table is available in the workspace.

## Outputs

Extraction:

- `artifacts/extraction/Pricing_Pref_ABI_RD_Men_4_26_Cliente_inputs_final.xlsx`

Calculation validation:

- `artifacts/calculation/rd_tlc_calculation_validation.xlsx`

Forecast inputs:

- `artifacts/forecast/rd_forecast_inputs_template.xlsx`

Forecast estimate:

- `artifacts/forecast/rd_2026_forward_estimation.xlsx`

Front-end ready actual plus forecast:

- `artifacts/front_end/Pricing_Pref_ABI_RD_Men_4_26_Cliente_actual_forecast_front_end_standardized.xlsx`
- `artifacts/front_end/Pricing_Pref_ABI_RD_Men_4_26_Cliente_actual_forecast_front_end_standardized.csv`

Validation summary:

- `artifacts/validation/validation_summary.json`

## Rerun

```powershell
python "supplier_pipelines\Pricing_Pref_ABI_RD_Men_4_26_Cliente\scripts\run_rd_pipeline.py"
```
