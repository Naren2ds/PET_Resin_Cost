# Pricing Pref PAN Supplier Pipeline

## Scope

Source workbook: `data/Pricing_Pref_ABI_PAN_Men_04_26_Cliente.xlsx`

Pipeline script: `supplier_pipelines/Pricing_Pref_ABI_PAN_Men_04_26_Cliente/scripts/run_pan_pipeline.py`

The pipeline runs the existing PAN extraction and mapping scripts, then creates the supplier-local validation, forecast, standardized, and front-end artifacts.

## Extraction

- Sheet: `Inputs`
- Range: `G7:H11`
- Actual period: April 2026
- Supplier: `Pastiglas S.A`
- Destination country: `Panama`

## Calculation Logic

The source workbook calculates DDP as:

```text
DDP Price = Average FOB + Ocean Freight + Import Clearance
```

The reusable forecast form is:

```text
DDP Price = (Average FOB + Ocean Freight) * (1 + Import Tax) + Import Clearance
```

For the current source workbook, Import Tax is `0%`, so this matches the workbook calculation.

## Index Usage

The formula overview says the index is the previous month, but the April 2026 source workbook uses `2026-2`, which is February 2026. The pipeline therefore follows the workbook behavior and uses:

- `ICIS Asia SE Low (M-2)`

Reference table:

- `Index Fprecast/icis_resin_index_reference_table.csv`

Historical validation confirms the workbook value `852.5` matches the February 2026 `ICIS Asia SE Low` reference value.

## Outputs

Extraction:

- `artifacts/extraction/Pricing_Pref_ABI_PAN_Men_04_26_Cliente_inputs_final.xlsx`

Calculation validation:

- `artifacts/calculation/pan_tlc_calculation_validation.xlsx`

Forecast inputs:

- `artifacts/forecast/pan_forecast_inputs_template.xlsx`

Forecast estimate:

- `artifacts/forecast/pan_2026_forward_estimation.xlsx`

Front-end ready actual plus forecast:

- `artifacts/front_end/Pricing_Pref_ABI_PAN_Men_04_26_Cliente_actual_forecast_front_end_standardized.xlsx`
- `artifacts/front_end/Pricing_Pref_ABI_PAN_Men_04_26_Cliente_actual_forecast_front_end_standardized.csv`

Validation summary:

- `artifacts/validation/validation_summary.json`

## Rerun

```powershell
python "supplier_pipelines\Pricing_Pref_ABI_PAN_Men_04_26_Cliente\scripts\run_pan_pipeline.py"
```
