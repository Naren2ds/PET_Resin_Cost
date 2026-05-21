# Supplier Sourcing Front-End Data Model Pipeline

## Objective

Create the consolidated supplier sourcing front-end file:

- `front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.xlsx`
- `front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.csv`
- `front_end_data_model/outputs/consolidation_run_summary.json`

This is the supplier-side data model used by the front end. It is separate from the Market Research model under `market_research`.

The final file is built by preparing each supplier output first, then appending those prepared supplier outputs into one canonical front-end table.

## Final Consolidation Command

Run this after supplier-level files are prepared:

```powershell
python "front_end_data_model\scripts\consolidate_front_end_data_model.py"
```

Optional, if Bavaria should be excluded:

```powershell
python "front_end_data_model\scripts\consolidate_front_end_data_model.py" --exclude-bavaria
```

## Final Consolidation Inputs

The consolidation script automatically reads:

```text
supplier_pipelines/*/artifacts/front_end/*actual_forecast_front_end_standardized.xlsx
data standardization/Bavaria_actual_forecast_final_standardized.xlsx
```

If a supplier Excel file is open or locked, the script tries to read the same-name CSV beside it and records that in `source_file_audit`.

## Final Output Shape

All supplier files are standardized to these columns:

```text
Data Type
Source File 
Supplier Name
Destination Country
Time_Period 
Time Period Year
Time Period Month
Location
Raw Cost Breakdown
Resin Index Type
Forecast Resin Index Type
Mapping Columns
Column Required for Calculation
Value 
TLC Formula
```

## Folder Roles

| Folder | Purpose |
| --- | --- |
| `data/` | Original supplier Excel workbooks |
| `scripts/` | Legacy extraction and mapping scripts reused by supplier pipelines |
| `output/` | Legacy extracted or mapped supplier outputs |
| `mapping files/` | Column mapping and formula overview workbooks |
| `standardization/` | Standardization template |
| `data calculation/` | Bavaria-specific calculation and forecast tooling |
| `data standardization/` | Bavaria actual/forecast standardized outputs |
| `supplier_pipelines/` | Supplier-local end-to-end pipelines and artifacts |
| `front_end_data_model/` | Final supplier model consolidation |
| `Index Fprecast/Suppliers Index/` | Supplier ICIS index reference files |

## End-to-End Flow

### 1. Extract Source Data

Each supplier pipeline starts from the source Excel workbook in `data/`.

Extraction converts workbook-specific layouts into long rows with:

- Period
- Metric or raw cost component
- Value
- Formula where available
- Source cell or source reference where available

Legacy extraction scripts live in `scripts/`, for example:

```text
scripts/extract_amcor_resina.py
scripts/extract_engepack_indices.py
scripts/extract_valgroup_months.py
scripts/extract_ecuador_formula_virgen.py
scripts/extract_pricing_pref_inputs.py
scripts/extract_pricing_pref_pan_inputs.py
scripts/extract_pricing_pref_rd_inputs.py
scripts/extract_bavaria_formula.py
```

Supplier-local runners call these scripts where needed.

### 2. Map Cost Components

The extracted rows are mapped to common front-end cost categories using:

- `mapping files/Mapping_Columns.xlsx`

The mapping step adds or standardizes:

- `Mapping Columns`
- `Column Required for Calculation`
- `Resin Index Type` where needed

This makes different supplier workbook labels comparable in the final data model.

### 3. Validate TLC Calculation

Each supplier pipeline calculates or validates the supplier-specific TLC formula.

Validation artifacts are written under:

```text
supplier_pipelines/<supplier>/artifacts/calculation/
```

Typical validation checks:

- Resin index value matches the expected reference
- Freight or adjustment logic matches the source workbook
- Subtotals match workbook formulas
- Total landed cost matches source workbook or known calculation logic

### 4. Build Forecast Inputs

Each supplier pipeline creates a forecast template under:

```text
supplier_pipelines/<supplier>/artifacts/forecast/
```

These files show:

- Future month inputs
- Fixed assumptions
- Formula catalog or calculation notes
- Resin index forecast source

For most supplier pipelines, forward resin values come from supplier ICIS index/reference files. Freight, taxes, import clearance, and fixed assumptions are kept from the latest actual month unless the pipeline has a more specific rule.

### 5. Estimate Forecast Rows

Each supplier pipeline creates a forward estimation workbook under:

```text
supplier_pipelines/<supplier>/artifacts/forecast/
```

This calculates forecast component rows and forecast TLC rows.

The forecast rows are then transformed into the same front-end schema as actual rows.

### 6. Create Supplier Front-End Output

Each supplier pipeline writes:

```text
supplier_pipelines/<supplier>/artifacts/front_end/*_actual_forecast_front_end_standardized.xlsx
supplier_pipelines/<supplier>/artifacts/front_end/*_actual_forecast_front_end_standardized.csv
```

These are the files the final consolidation script reads.

### 7. Consolidate Final Supplier Model

The final script:

```powershell
python "front_end_data_model\scripts\consolidate_front_end_data_model.py"
```

does the following:

1. Discovers all supplier actual plus forecast front-end workbooks.
2. Adds the legacy Bavaria actual plus forecast file.
3. Reads each file.
4. Applies the common canonical column order.
5. Adds missing canonical columns where needed.
6. Ignores extra columns not used by the front-end model.
7. Applies the `Location` policy.
8. Appends all rows.
9. Writes the final Excel, CSV, and run summary.

## Location Policy

The consolidation script always outputs `Location`.

Rule:

```text
If Supplier Name = Amcor and source Location exists:
  keep the source Location
Else:
  Location = Destination Country
```

This preserves Amcor location-level Brazil rows while keeping other suppliers consistent.

## Supplier Pipelines Currently Included

| Pipeline | Source Workbook | Runner | Final Supplier Output |
| --- | --- | --- | --- |
| Amcor Brazil | `data/04. Amcor.xlsx` | `supplier_pipelines/04. Amcor/scripts/run_amcor_pipeline.py` | `supplier_pipelines/04. Amcor/artifacts/front_end/04. Amcor_actual_forecast_front_end_standardized.xlsx` |
| Engepack | `data/04. Engepack.xlsx` | `supplier_pipelines/04. Engepack/scripts/run_engepack_pipeline.py` | `supplier_pipelines/04. Engepack/artifacts/front_end/04. Engepack_actual_forecast_front_end_standardized.xlsx` |
| Valgroup | `data/04. Valgroup.xlsx` | `supplier_pipelines/04. Valgroup/scripts/run_valgroup_pipeline.py` | `supplier_pipelines/04. Valgroup/artifacts/front_end/04. Valgroup_actual_forecast_front_end_standardized.xlsx` |
| Ecuador | `data/3 Precios AB Inbev_Abril 26 ECUADOR.xlsx` | `supplier_pipelines/3 Precios AB Inbev_Abril 26 ECUADOR/scripts/run_ecuador_pipeline.py` | `supplier_pipelines/3 Precios AB Inbev_Abril 26 ECUADOR/artifacts/front_end/3 Precios AB Inbev_Abril 26 ECUADOR_actual_forecast_front_end_standardized.xlsx` |
| Peru | `data/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente.xlsx` | `supplier_pipelines/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente/scripts/run_per_pipeline.py` | `supplier_pipelines/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente/artifacts/front_end/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente_actual_forecast_front_end_standardized.xlsx` |
| Panama | `data/Pricing_Pref_ABI_PAN_Men_04_26_Cliente.xlsx` | `supplier_pipelines/Pricing_Pref_ABI_PAN_Men_04_26_Cliente/scripts/run_pan_pipeline.py` | `supplier_pipelines/Pricing_Pref_ABI_PAN_Men_04_26_Cliente/artifacts/front_end/Pricing_Pref_ABI_PAN_Men_04_26_Cliente_actual_forecast_front_end_standardized.xlsx` |
| Dominican Republic / regional SMI PET file | `data/Pricing_Pref_ABI_RD_Men_4_26_Cliente.xlsx` | `supplier_pipelines/Pricing_Pref_ABI_RD_Men_4_26_Cliente/scripts/run_rd_pipeline.py` | `supplier_pipelines/Pricing_Pref_ABI_RD_Men_4_26_Cliente/artifacts/front_end/Pricing_Pref_ABI_RD_Men_4_26_Cliente_actual_forecast_front_end_standardized.xlsx` |
| Bavaria legacy | `data/1 Bavaria - Precio Marzo.xlsx` | legacy scripts listed below | `data standardization/Bavaria_actual_forecast_final_standardized.xlsx` |

## Supplier Pipeline Commands

Run the supplier-local pipelines when source files or assumptions change:

```powershell
python "supplier_pipelines\04. Amcor\scripts\run_amcor_pipeline.py"
python "supplier_pipelines\04. Engepack\scripts\run_engepack_pipeline.py"
python "supplier_pipelines\04. Valgroup\scripts\run_valgroup_pipeline.py"
python "supplier_pipelines\3 Precios AB Inbev_Abril 26 ECUADOR\scripts\run_ecuador_pipeline.py"
python "supplier_pipelines\Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente\scripts\run_per_pipeline.py"
python "supplier_pipelines\Pricing_Pref_ABI_PAN_Men_04_26_Cliente\scripts\run_pan_pipeline.py"
python "supplier_pipelines\Pricing_Pref_ABI_RD_Men_4_26_Cliente\scripts\run_rd_pipeline.py"
```

After all needed supplier outputs are refreshed:

```powershell
python "front_end_data_model\scripts\consolidate_front_end_data_model.py"
```

## Bavaria Legacy Flow

Bavaria currently enters final consolidation from:

```text
data standardization/Bavaria_actual_forecast_final_standardized.xlsx
```

Useful Bavaria documentation:

- `prompts/bavaria_pipeline_overview.md`

Main Bavaria steps:

1. Extract source formula grid.

```powershell
python "scripts\extract_bavaria_formula.py"
```

2. Add mapping columns.

```powershell
python "scripts\add_bavaria_mapping_columns.py"
```

3. Validate historical TLC calculation.

```powershell
python "data calculation\calculate_bavaria_tlc.py"
```

4. Build forecast input template and formula catalog.

```powershell
python "data calculation\build_bavaria_forecast_inputs.py"
```

5. Estimate forward 2026 Bavaria rows.

```powershell
python "scripts\estimate_bavaria_2026_forward.py"
```

6. Standardize Bavaria actuals.

```powershell
python "data standardization\standardize_bavaria.py"
```

7. Merge Bavaria actual plus forecast.

```powershell
python "data standardization\merge_bavaria_actual_forecast.py"
```

Then rerun the final front-end consolidation.

## Supplier Formula Summary

| Supplier Pipeline | Main TLC Logic |
| --- | --- |
| Amcor Brazil | `Sell Side Resina USD = Resin Index + International Freight + Duties + Others/Seguro` |
| Engepack | `Total Landing Cost $ = ((IHS (M-1) + 100 + Adjusted Freight) * (1 + 20%)) + 125 + 8% * Adjusted Freight` |
| Valgroup | `Total V-PET USD/ton = (((Resin with assumptions * (1 - Discount)) + Freight) * (1 + Importation + Import Tax)) + Surcharge + Indorama Discount` |
| Ecuador | `PET Resin = [(Index + Int. Freight) * (1 + % Customs Clearance Cost)] + Customs Clearance Fixed + Local Freight + Scrap` |
| Peru | `PET Resin USD/Ton = (ICIS + Ocean Freight) * (1 + Import Tax) + Import Clearance` |
| Panama | `DDP Price = (Average FOB + Ocean Freight) * (1 + Import Tax) + Import Clearance` |
| RD / SMI PET | `PET Resin USD/Ton = (ICIS + Ocean Freight) * (1 + Import Tax) + Import Clearance` |
| Bavaria | `Total Landing Cost = Sub Total (with Incremental Freight) + Duty + Landed Factor + ZF Legislation Change + Sur Charge Alpek Br` |

## Current Final Model Summary

Current final supplier output:

```text
front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.xlsx
```

Current workbook sheets:

```text
front_end_data_model
source_file_audit
run_metadata
```

Current row counts:

```text
Data rows: 2,547
Actual rows: 1,745
Forecast rows: 802
Input source files: 8
Loaded source files: 8
```

Supplier row counts in the current CSV:

```text
Amcor: 1,694
Engepack: 307
Pastiglas S.A: 45
San Miguel Industrias (SMI): 45
SMI PET: 72
Valgroup: 384
```

## How To Use The Final File

Use:

```text
front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.xlsx
```

Primary sheet:

```text
front_end_data_model
```

For the front end, filter by:

```text
Supplier Name
Destination Country
Location
Time_Period
Data Type
Raw Cost Breakdown
Mapping Columns
```

For final landed cost rows, filter where:

```text
Mapping Columns = Total Landing Cost
```

or, depending on supplier label consistency:

```text
Raw Cost Breakdown contains Total Landing Cost
```

The final model already includes supplier-specific formulas in `TLC Formula`. The front end should display or filter these calculated rows, not recalculate supplier formulas live.

## When To Rerun What

If a source supplier workbook changes:

1. Run that supplier's pipeline.
2. Check the supplier validation summary.
3. Run final consolidation.

If only a forecast/index assumption changes:

1. Refresh the related forecast/index file or template.
2. Run the affected supplier pipeline.
3. Run final consolidation.

If only the final appended output is needed:

1. Run only:

```powershell
python "front_end_data_model\scripts\consolidate_front_end_data_model.py"
```

If an Excel input is open:

1. Close the workbook if you want the script to read Excel directly.
2. Or keep the matching CSV beside it; the consolidation script can fall back to CSV and record this in `source_file_audit`.

## Important Separation

Supplier sourcing model:

```text
front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.xlsx
```

Market Research model:

```text
market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.xlsx
```

These are separate data models. Do not combine Market Research rows into the supplier consolidation unless a future design explicitly requires it.
