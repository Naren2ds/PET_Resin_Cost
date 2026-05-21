# 04. Engepack Pipeline

This supplier folder keeps the Engepack extraction, mapping, TLC validation, forecast input template, forward estimate, and front-end standardized artifacts together.

## Source

- Source workbook: `data/04. Engepack.xlsx`
- Existing extraction script: `scripts/extract_engepack_indices.py`
- Existing mapping script: `scripts/data_mapping_column_engepack.py`
- Supplier-local runner: `supplier_pipelines/04. Engepack/scripts/run_engepack_pipeline.py`

## Extraction And Mapping

The runner reuses the existing extraction and mapping scripts, writing a supplier-local extracted workbook here:

`supplier_pipelines/04. Engepack/artifacts/extraction/04. Engepack_indices_final.xlsx`

The extracted metrics are:

- `IHS (M-1)`
- `Maxiquim MME (M-1)`
- `Fx (M-1)`
- `Freight`
- `Total Landing Cost`
- `Total Landing Cost $`

`Total Landing Cost $` is calculated as:

`Total Landing Cost / Fx (M-1)`

## TLC Validation

Validation output:

`supplier_pipelines/04. Engepack/artifacts/calculation/engepack_tlc_calculation_validation.xlsx`

Important Engepack nuance:

- The extracted `Freight` metric is the workbook's `AVG Q-1` row.
- The TLC formula uses adjusted freight from the source workbook row below it.
- The validation and forecast use that adjusted freight.

Latest contract formula used for forecast:

`Total Landing Cost $ = ((IHS (M-1) + 100 + Adjusted Freight) * (1 + 20%)) + 125 + 8% * Adjusted Freight`

Adjusted freight formula:

`IF(AVG Q-1 > 108, MAX(108, (AVG Q-1 - 108) * 0.85 + 90), IF(AVG Q-1 < 60, 60, AVG Q-1))`

## Forecast

Forecast input template:

`supplier_pipelines/04. Engepack/artifacts/forecast/engepack_forecast_inputs_template.xlsx`

Forward estimate:

`supplier_pipelines/04. Engepack/artifacts/forecast/engepack_2026_forward_estimation.xlsx`

Forecast logic:

- Source resin index type: `IHS (M-1)`
- Forecast resin index type: `PET Bottle Grade FOB China Spot`
- Forecast target month uses resin forecast source period `target month - 1`.
- Freight defaults to the latest validated adjusted freight unless updated.
- The final forecast output is `Total Landing Cost $`.

## Front-End Output

Actual-only output:

`supplier_pipelines/04. Engepack/artifacts/front_end/04. Engepack_front_end_standardized.csv`

Actual plus forecast output:

`supplier_pipelines/04. Engepack/artifacts/front_end/04. Engepack_actual_forecast_front_end_standardized.csv`

## Command

```powershell
python "supplier_pipelines\04. Engepack\scripts\run_engepack_pipeline.py"
```

Reuse existing extraction and mapping:

```powershell
python "supplier_pipelines\04. Engepack\scripts\run_engepack_pipeline.py" --skip-extraction --skip-mapping
```
