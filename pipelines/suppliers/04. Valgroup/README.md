# Valgroup Supplier Pipeline

## Scope

Source workbook: `data/04. Valgroup.xlsx`

Pipeline script: `supplier_pipelines/04. Valgroup/scripts/run_valgroup_pipeline.py`

This pipeline keeps the legacy Valgroup extraction for traceability and adds the full supplier model used for forecasting:

- Historical sheets: `JAN.26`, `FEV.26`, `MAR.26`, `ABR.26`
- Product used for PET TLC: `VRJ1`
- Actual months: January 2026 through April 2026
- Forecast months: generated only where the `ICIS Asia SE Low` reference is available for the prior month

## Calculation Logic

Resin with assumptions:

```text
ICIS Asia SE Low (n-1)
```

Total landing cost in USD:

```text
(((Resin with assumptions * (1 - Discount)) + Freight) * (1 + Importation + Import Tax)) + Surcharge + Indorama Discount
```

Total landing cost in BRL:

```text
Total V-PET USD/ton * PTAX
```

## Index Usage

Selected resin index:

- `ICIS Asia SE Low`

Reference table:

- `Index Fprecast/icis_resin_index_reference_table.csv`

Validation note: Valgroup now uses only the workbook's `ICIS Asia SE Low (n-1)` row for resin assumptions and does not use `ICIS Asia 5R MID (n-1)`. Forecast rows are emitted only for months where the `ICIS Asia SE Low` reference is available.

## Outputs

Extraction:

- `artifacts/extraction/04. Valgroup_months_full_final.xlsx`

Calculation validation:

- `artifacts/calculation/valgroup_tlc_calculation_validation.xlsx`

Forecast inputs:

- `artifacts/forecast/valgroup_forecast_inputs_template.xlsx`

Forecast estimate:

- `artifacts/forecast/valgroup_2026_forward_estimation.xlsx`

Front-end ready actual plus forecast:

- `artifacts/front_end/04. Valgroup_actual_forecast_front_end_standardized.xlsx`
- `artifacts/front_end/04. Valgroup_actual_forecast_front_end_standardized.csv`

Validation summary:

- `artifacts/validation/validation_summary.json`

## Rerun

```powershell
python "supplier_pipelines\04. Valgroup\scripts\run_valgroup_pipeline.py"
```
