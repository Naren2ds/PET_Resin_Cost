# PET Data Model Pipeline Development History

Last updated: 2026-05-15

This file is a compact handoff for continuing the PET data model work. It summarizes the extraction, mapping, standardization, and calculation pipeline built so far.

## Workspace

Root:

`c:\Users\40100123\OneDrive - Anheuser-Busch InBev\GAC\PET\Data Model\PET_Data_Model`

Main folders:

- `data/`: source Excel files
- `output/`: extracted and mapped final supplier files
- `mapping files/`: mapping workbooks
- `standardization/`: standardization template
- `data standardization/`: standardized data scripts and outputs
- `data calculation/`: supplier-specific calculation and forecast tooling
- `scripts/`: extraction and mapping scripts

## Mapping Workbooks

Primary mapping files:

- `mapping files/Mapping_Columns.xlsx`
- `mapping files/Formula overview by countries.xlsx`
- `standardization/Data_Standardization.xlsx`

`Formula overview by countries.xlsx` is used to map pricing sheet to supplier and destination country.

`Mapping_Columns.xlsx` is used to add `Mapping Columns` and `Column Required for Calculation` to extracted supplier outputs.

## Extracted Outputs

Current output workbooks include:

- `output/1 Bavaria - Precio Marzo_formula_final_with_mapping_columns.xlsx`
- `output/3 Precios AB Inbev_Abril 26 ECUADOR_formula_virgen_final.xlsx`
- `output/04. Amcor_resina_final.xlsx`
- `output/04. Cristalpet_indices_with_tlc_final.xlsx`
- `output/04. Engepack_indices_final.xlsx`
- `output/04. Valgroup_months_final.xlsx`
- `output/Sell_Side_2026-ABI Mar 2026_icis_price_history_final.xlsx`
- `output/Pricing_Pref-Bot_ABI_PER_Men_4_26_Cliente_inputs_final.xlsx`
- `output/Pricing_Pref_ABI_PAN_Men_04_26_Cliente_inputs_final.xlsx`
- `output/Pricing_Pref_ABI_RD_Men_4_26_Cliente_inputs_final.xlsx`
- `output/ABI 120326 -Pricing Marzo 2026_csd_resina_ush_final.xlsx`

## Extraction Scripts

Supplier extraction scripts:

- `scripts/extract_bavaria_formula.py`
- `scripts/extract_ecuador_formula_virgen.py`
- `scripts/extract_amcor_resina.py`
- `scripts/extract_cristalpet_indices.py`
- `scripts/extract_engepack_indices.py`
- `scripts/extract_valgroup_months.py`
- `scripts/extract_sell_side_icis_price_history.py`
- `scripts/extract_pricing_pref_inputs.py`
- `scripts/extract_pricing_pref_pan_inputs.py`
- `scripts/extract_pricing_pref_rd_inputs.py`
- `scripts/extract_abi_120326_pricing_marzo.py`

Recent important extraction changes:

- Cristalpet freight corrected to use `E21:O22`, with row 21 as period header and row 22 as values.
- Cristalpet now calculates `Total Landing Cost $ = Total Landing Cost / Fx (M-1)`.
- Engepack now calculates `Total Landing Cost $ = Total Landing Cost / Fx (M-1)`.
- ABI 120326 Pricing Marzo extracts sheet `CSD Resina Ush`, requested header range `B8:U8`, data range `B56:U61`, and preserves row 2 semantic labels as `metric_label_original`.

## Mapping Scripts

Supplier mapping scripts:

- `scripts/add_bavaria_mapping_columns.py`
- `scripts/data_mapping_column_ecuador.py`
- `scripts/data_mapping_column_pan.py`
- `scripts/data_mapping_column_rd.py`
- `scripts/data_mapping_column_per.py`
- `scripts/data_mapping_column_amcor.py`
- `scripts/data_mapping_column_cristalpet.py`
- `scripts/data_mapping_column_engepack.py`
- `scripts/data_mapping_column_valgroup.py`
- `scripts/data_mapping_column_abi_120326_pricing_marzo.py`

Mapping rules used:

- Bavaria: final `metric_local` maps to mapping sheet `1 Bavaria - Precio Marzo_formul`, column `metric_local`.
- Ecuador: final `metric_en` maps to mapping sheet `3 Precios AB Inbev_Abril 26 ECU`, column `metric_en`.
- PAN/RD/PER: final `metric_label_original` with fallback to translated label where needed.
- Amcor/Cristalpet/Engepack: mostly final `metric_name`.
- Valgroup: final `metric_label_english` maps to mapping sheet `04. Valgroup`, column `metric_label_english`.
- ABI 120326 Pricing Marzo: final `metric_label_original` maps to mapping sheet `ABI 120326 -Pricing Marzo 2026`, column `metric_label_original`.

## Data Standardization

Template:

`standardization/Data_Standardization.xlsx`

Template columns:

- `Source File `
- `Supplier Name`
- `Destination Country`
- `Time_Period `
- `Raw Cost Breakdown`
- `Mapping Columns`
- `Value `

Bavaria standardization completed:

- Script: `data standardization/standardize_bavaria.py`
- Output: `data standardization/Amcor_Bavaria_final_standardized.xlsx`
- Rows: 822
- Supplier: Amcor
- Destination Country: Colombia
- Time period converted from Spanish/abbrev month labels to English month-year.

## Bavaria TLC Calculation Layer

Calculation folder:

`data calculation/`

Validation script:

`data calculation/calculate_bavaria_tlc.py`

Validation output:

`data calculation/Bavaria_tlc_calculation_validation.xlsx`

Bavaria TLC formula:

`Total Landing Cost = Sub Total (with Incremental Freight) + Duty + Landed Factor + ZF Legislation Change + Sur Charge Alpek Br`

Subtotal logic:

`Sub Total (with Incremental Freight) = Resin Price Index + Finance + Freight Regular + Freight Incremental`

Important nuance:

- Duty uses `Sub Total (with Incremental Freight)`.
- Landed Factor uses `Sub Total (with Regular Freight)`.
- Extracted subtotal row is used when present because some historical workbook cells are hardcoded or rounded.

Validation result:

- 96 Bavaria periods calculated.
- 95 matched source TLC.
- 1 source override: March 2022, source cell `AZ26`, where Excel source TLC is hardcoded and differs by about `0.3381773941`.

## Bavaria Forecast Tooling

Generator script:

`data calculation/build_bavaria_forecast_inputs.py`

Generated files:

- `data calculation/Bavaria_formula_catalog.xlsx`
- `data calculation/Bavaria_future_inputs_template.xlsx`

Formula catalog purpose:

- Defines each component as variable input, assumption, formula, override, or output.
- Explains mapping column, source metric, default value, and formula logic.

Future input template purpose:

- User-editable forecast workbook for future months.
- Generated with 12 future months from April 2026 through March 2027.
- Yellow columns are user inputs or editable assumptions.
- Green columns are Excel formula outputs.

Key defaults currently used:

- `finance_factor`: `0.03496712876712329`
- `duty_rate`: `0.05`
- `landed_factor_rate`: `0.08`
- `freight_regular`: `97.286177169`
- `zf_legislation_change`: `18.95837133417279`
- `surcharge_alpek_br`: `0`

Main future values for the user to update:

- `resin_price_index`
- `drewry_freight` or `freight_incremental_override`
- `freight_regular`, if freight changes
- `finance_factor` or `finance_value_override`, if finance assumption changes
- `zf_legislation_change`, if regulation input changes
- `surcharge_alpek_br`, if applicable

## Suggested Next Steps

1. Add a common `component_key` to both:
   - `Bavaria_formula_catalog.xlsx`
   - `Bavaria_future_inputs_template.xlsx`

   This will make the catalog and template easier to connect.

2. Build a forecast calculation script that reads `Bavaria_future_inputs_template.xlsx` and outputs forecasted standardized rows.

3. Extend standardization beyond Bavaria:
   - Ecuador
   - Amcor
   - Cristalpet
   - Engepack
   - Valgroup
   - ABI 120326 Pricing Marzo
   - Sell Side
   - Pricing Pref files

4. Eventually create one consolidated standardized data model for the web app.

## Useful Commands

Run Bavaria TLC validation:

```powershell
python "data calculation\calculate_bavaria_tlc.py"
```

Regenerate Bavaria forecast catalog/template:

```powershell
python "data calculation\build_bavaria_forecast_inputs.py"
```

Regenerate Bavaria standardized output:

```powershell
python "data standardization\standardize_bavaria.py"
```

Run ABI 120326 extraction:

```powershell
python scripts\extract_abi_120326_pricing_marzo.py
```

Run ABI 120326 mapping:

```powershell
python scripts\data_mapping_column_abi_120326_pricing_marzo.py
```