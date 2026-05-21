# 3 Precios AB Inbev_Abril 26 ECUADOR Pipeline

This folder stores the supplier-local pipeline and artifacts for the Ecuador `Formula Virgen` file.

## Source

- Source workbook: `data/3 Precios AB Inbev_Abril 26 ECUADOR.xlsx`
- Source sheet: `Formula Virgen`
- Source range: `A2:AT18`
- Existing extraction script reused: `scripts/extract_ecuador_formula_virgen.py`
- Existing mapping script reused: `scripts/data_mapping_column_ecuador.py`

## Metadata

- Supplier: `Amcor`
- Destination country: `Ecuador`
- Sourcing country: `China`
- Resin index type from formula overview: `ICIS PET China MID (N-2) USD/ton`
- Source resin index label from extracted rows: `ICIS China Mid (n-2)`

## TLC Formula

`PET Resin: {[(Index + Int. Freight) x (1 + % Customs Clearance Cost)] + Customs Clearance Fixed + Local Freight + Scrap}`

## Run

```powershell
python "supplier_pipelines\3 Precios AB Inbev_Abril 26 ECUADOR\scripts\run_ecuador_pipeline.py"
```

## Artifacts

- Extraction workbook: `artifacts/extraction/3 Precios AB Inbev_Abril 26 ECUADOR_formula_virgen_final.xlsx`
- Actual standardized workbook: `artifacts/standardized/3 Precios AB Inbev_Abril 26 ECUADOR_actual_standardized.xlsx`
- Front-end standardized workbook: `artifacts/front_end/3 Precios AB Inbev_Abril 26 ECUADOR_front_end_standardized.xlsx`
- Front-end standardized CSV: `artifacts/front_end/3 Precios AB Inbev_Abril 26 ECUADOR_front_end_standardized.csv`
- TLC validation workbook: `artifacts/calculation/ecuador_tlc_calculation_validation.xlsx`
- Forecast input template: `artifacts/forecast/ecuador_forecast_inputs_template.xlsx`
- Forward estimation workbook: `artifacts/forecast/ecuador_2026_forward_estimation.xlsx`
- Actual + forecast front-end workbook: `artifacts/front_end/3 Precios AB Inbev_Abril 26 ECUADOR_actual_forecast_front_end_standardized.xlsx`
- Actual + forecast front-end CSV: `artifacts/front_end/3 Precios AB Inbev_Abril 26 ECUADOR_actual_forecast_front_end_standardized.csv`
- Validation summary: `artifacts/validation/validation_summary.json`
  and `artifacts/validation/forecast_validation_summary.json`

The front-end standardized output uses the same shared schema as the Bavaria final table:

- `Data Type`
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

## Current Run Summary

- Extracted rows: `405`
- Historical TLC validation periods: `32`
- TLC validation status: all `match`
- Forecast months: `9`, April 2026 through December 2026
- Forecast component rows: `135`
- Actual + forecast front-end rows: `540`
- Actual + forecast period range: July 2023 through December 2026
