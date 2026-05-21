# Front-End Data Model Consolidation

## Purpose

This folder contains the monthly consolidation step that appends all supplier front-end actual+forecast outputs into one standardized front-end data model.

## Script

```powershell
python "front_end_data_model\scripts\consolidate_front_end_data_model.py"
```

Detailed supplier sourcing pipeline documentation:

- `front_end_data_model/SUPPLIER_SOURCING_FRONT_END_PIPELINE.md`

## Inputs

The script automatically loads:

- `supplier_pipelines/*/artifacts/front_end/*actual_forecast_front_end_standardized.xlsx`
- `data standardization/Bavaria_actual_forecast_final_standardized.xlsx`

If a front-end Excel file is locked, the script tries to read the same-name `.csv` file instead and records that in the audit sheet.

## Location Rule

The final model always includes `Location`.

- For rows where `Supplier Name = Amcor` and a source `Location` exists, the source `Location` is preserved.
- For all other rows, `Location = Destination Country`.

## Outputs

- `outputs/Data_Standardized_Front_End_Data_Model.xlsx`
- `outputs/Data_Standardized_Front_End_Data_Model.csv`
- `outputs/consolidation_run_summary.json`

The Excel output contains:

- `front_end_data_model`
- `source_file_audit`
- `run_metadata`

## Optional Bavaria Exclusion

```powershell
python "front_end_data_model\scripts\consolidate_front_end_data_model.py" --exclude-bavaria
```

## Market Research Data Model

Market Research has been separated from the supplier/front-end consolidation workflow. See `market_research/README.md`.
