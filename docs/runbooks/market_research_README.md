# Market Research PET Resin TLC Data Model

## Purpose

This folder owns the Market Research workflow for the `PET Resin Total landed cost calculator` workbook. It is separate from `supplier_pipelines` and the supplier front-end consolidation flow.

The workflow creates a Market Research front-end data model with the same canonical columns as the supplier model, but the output is kept under `market_research/standardization/outputs`. It now includes actual TLC rows from the calculator for February 2026 and forecast TLC rows for March 2026 through December 2026.

## Folder Structure

- `scripts/`: production builder for the Market Research standardized data model.
- `data_exploration/`: workbook inspection utilities and exploration outputs.
- `standardization/outputs/`: generated Market Research standardized Excel, CSV, and run summary files.

## Source Files

- Source workbook: `MR Data/PET Resin Total landed cost calculator.xlsx`
- Mapping workbook: `mapping files/Mapping_Columns.xlsx`
- Mapping sheet: `MR PET Resin TLC`

## Data Exploration

Run this to profile workbook sheets, formula counts, selected destination, and selected month:

```powershell
python "market_research\data_exploration\explore_market_research_workbook.py"
```

Output:

- `market_research/data_exploration/outputs/market_research_workbook_profile.json`

## Standardization

Run this to build the Market Research front-end data model:

```powershell
python "market_research\scripts\build_market_research_front_end_data_model.py"
```

Outputs:

- `market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.xlsx`
- `market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.csv`
- `market_research/standardization/outputs/market_research_data_model_run_summary.json`

Detailed pipeline and calculation documentation:

- `market_research/MR_TLC_FRONT_END_PIPELINE.md`

The Excel output includes:

- `front_end_data_model`: Actual and Forecast rows in the front-end canonical shape.
- `calculation_audit`: Actual source/destination calculation status.
- `forecast_calculation_audit`: Forecast source/destination/month calculation status.
- `forecast_index_mapping`: Source-country to ICIS forecast index mapping.
- `tlc_validation`: Actual and Forecast TLC back-calculation validation.
- `formula_notes`: TLC formula and forecast assumptions.

Run this to transform the Market Research ICIS index history workbook:

```powershell
python "market_research\scripts\extract_market_research_icis_index_reference.py"
```

ICIS index source:

- `Index Fprecast/Market Research Index/ICIS Dashboard Price History 2026-05-13 202724.xls`
- Sheet `ICIS Price History`
- Range `B18:L34`, with `B18:L18` used as the header row

ICIS index outputs:

- `Index Fprecast/Market Research Index/market_research_icis_resin_index_reference_table.xlsx`
- `Index Fprecast/Market Research Index/market_research_icis_resin_index_reference_table.csv`
- `Index Fprecast/Market Research Index/market_research_icis_resin_index_reference_wide.csv`

The long ICIS output follows the supplier `icis_resin_reference` shape and adds `sourcing_country`, parsed from each source column header. Regional headers are retained as regional sourcing values, such as `Asia SE` and `Asia NE`.

The ICIS extractor also appends a simple standardized forecast through December 2026 for every resin index/source series.

Forecast formula:

```text
Growth Factor = AVERAGE(Actual Jan-Apr 2026 / Actual Jan-Apr 2025)
Uncapped Forecast = Actual same month 2025 * Growth Factor
Final Forecast = MIN(MAX(Uncapped Forecast, Prior Value * (1 - 8%)), Prior Value * (1 + 8%))
```

The same method and 8% monthly guardrail are used for all sourcing countries. The Excel output includes `forecast_backtest`, `forecast_accuracy`, `forecast_formulae`, and `guardrail_backtest` sheets for visibility.

## Model Notes

- `Supplier Name` stores the resin source country from the calculator.
- `Location` also stores the resin source country for compatibility with the current front-end schema.
- `Destination Country` stores the selected landed-cost destination.
- Forecast rows use the MR ICIS monthly index values from `Index Fprecast/Market Research Index/market_research_icis_resin_index_reference_table.csv`. March-April use rows marked `Actual` in the MR ICIS file, and May-December use rows marked `Forecast`.
- Forecast TLC keeps freight, tax rates, local transport, and other country inputs from the calculator unchanged, replaces only `PET resin cost (FOB)` with the mapped forecast index value, and recalculates all dependent components plus TLC using the same TLC formula.
- Direct source-country ICIS mappings are used where available. Southeast Asia source countries use `ICIS Asia SE FOB Mid`; USA uses the closest available North America proxy in the MR ICIS file, `ICIS Mexico DEL Domestic Mid`. The mapping is visible in the `forecast_index_mapping` sheet.
- TLC rows are pre-calculated in the model; the front end should filter the model rather than recalculate formulas live.
