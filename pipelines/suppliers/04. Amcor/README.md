# 04. Amcor Pipeline

Supplier-local pipeline for `data/04. Amcor.xlsx`.

## Source

- Source workbook: `data/04. Amcor.xlsx`
- Source sheet: `Resina`
- Source ranges reused from existing extraction: `B2:O12` and `B29:N36`
- Existing extraction script reused: `scripts/extract_amcor_resina.py`
- Existing mapping script reused: `scripts/data_mapping_column_amcor.py`

## Metadata

- Supplier: `Amcor`
- Destination country: `Brazil`
- Resin index type: `ICIS PET China MID (M-1) USD/ton`
- Locations: `SUAPE`, `MANAUS`

## TLC Logic

For Alpek sell-side resin:

`Sell Side Resina USD = Resin Index + International Freight + Duties + Others/Seguro`

Where:

- `International Freight = Drewry / 22.5 + location freight add-on`
- `Location freight add-on = 0` for `SUAPE`
- `Location freight add-on = 20` for `MANAUS`
- `Duties = (Resin Index + International Freight) * 20.8%`
- `Others/Seguro = 167 USD/ton`

## Run

```powershell
python "supplier_pipelines\04. Amcor\scripts\run_amcor_pipeline.py"
```

## Artifacts

- Extraction workbook: `artifacts/extraction/04. Amcor_resina_final.xlsx`
- Actual standardized workbook: `artifacts/standardized/04. Amcor_actual_standardized.xlsx`
- TLC validation workbook: `artifacts/calculation/amcor_tlc_calculation_validation.xlsx`
- Forecast input template: `artifacts/forecast/amcor_forecast_inputs_template.xlsx`
- Forward estimation preview: `artifacts/forecast/amcor_2026_forward_estimation.xlsx`
- Actual front-end CSV: `artifacts/front_end/04. Amcor_front_end_standardized.csv`
- Actual + forecast front-end CSV: `artifacts/front_end/04. Amcor_actual_forecast_front_end_standardized.csv`
- Validation summary: `artifacts/validation/validation_summary.json`

## Forecast Intermediate File

`artifacts/forecast/amcor_forecast_inputs_template.xlsx` is the review file for forecast setup.

It contains:

- `changeable_inputs`: future month inputs for resin index and Drewry/freight assumptions.
- `fixed_assumptions`: constants such as duty rate, tons/container, location freight add-on, and fixed cost.
- `formula_catalog`: component classification as fixed, changeable, calculated, or output.

## Current Run Summary

- Extracted rows: `137`
- Mapping matched rows: `137`
- TLC validation rows: `21`
- TLC validation status: `match` except `SUAPE / May 2026`, where source external-linked inputs are zero and marked `formula_match_input_check`
- Forecast input rows: `16` (`8` months x `2` locations)
- Actual front-end rows: `137`
- Forecast front-end rows: `96`
- Actual + forecast front-end rows: `233`
- Actual period range: July 2025 through May 2026
- Forecast period range: May 2026 through December 2026
