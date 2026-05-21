# PET Data Model Conversation Checkpoint - 2026-05-20

This file captures the current working state so the next conversation can resume quickly.

## Current Status

The Supplier and Market Research PET Resin data model flow is working end to end.

The latest working version has been committed to Git.

Remote repository:

```text
https://github.com/Naren2ds/PET_Data_Model.git
```

## Main Working Areas

### Supplier Data Model

Important folders:

```text
supplier_pipelines/
front_end_data_model/
mapping files/
Index Fprecast/Suppliers Index/
```

Final Supplier front-end model:

```text
front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.xlsx
front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.csv
```

Supplier pipeline flow:

```text
Raw supplier Excel files
-> supplier-specific extraction
-> standardization
-> mapping
-> TLC calculation
-> validation
-> consolidated Supplier front-end model
-> backend
-> frontend
```

### Market Research Data Model

Important folders:

```text
MR Data/
market_research/
Index Fprecast/Market Research Index/
mapping files/
```

Final Market Research front-end model:

```text
market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.xlsx
market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.csv
```

Market Research pipeline flow:

```text
PET Resin Total landed cost calculator
MR ICIS Index file
Mapping_Columns.xlsx
-> extract TLC formula and source country details
-> calculate Actual TLC
-> forecast 2026 index values
-> calculate Forecast TLC through Dec 2026
-> validate calculations
-> final MR front-end model
-> backend
-> frontend
```

### Index Forecast

Supplier index output:

```text
Index Fprecast/Suppliers Index/icis_resin_index_reference_table.csv
Index Fprecast/Suppliers Index/icis_resin_index_reference_table.xlsx
```

Market Research index output:

```text
Index Fprecast/Market Research Index/market_research_icis_resin_index_reference_table.csv
Index Fprecast/Market Research Index/market_research_icis_resin_index_reference_table.xlsx
```

The Market Research forecast uses the available 2025 and 2026 data trend/seasonality and extends values through Dec 2026.

## Backend

Active backend:

```text
PET_UI/PET-Backend/
```

Important backend files:

```text
PET_UI/PET-Backend/main.py
PET_UI/PET-Backend/supplier_data_model.py
PET_UI/PET-Backend/market_research_data_model.py
PET_UI/PET-Backend/BACKEND_MARKET_RESEARCH_FLOW.md
```

Backend behavior:

```text
Reads Supplier final model
Reads Market Research final model
Filters by destination, month, and year for cards
Builds Supplier and Market Research TLC dynamically
Uses Actual/Forecast flag from standardized models
Returns full 2026 trend data for Market Research without applying the selected month filter
```

Important endpoint added/used:

```text
/market-research-trends?destination=<destination>&year=2026
```

## Frontend

Active frontend:

```text
PET_UI/PET-Frontend/
```

Important frontend file recently fixed:

```text
PET_UI/PET-Frontend/src/pages/TrendsPage.tsx
```

Current working behavior:

```text
Supplier cards work
Market Research cards work
Deep Dive comparison works
Market Research cost breakdown works
Supplier component mapping table was removed
Merged visual comparison table was added for MR and Supplier details
Trends view shows full 2026 Market Research actual and forecast values
```

## Key Decisions Already Made

1. Market Research model now uses Source Country instead of Supplier Name.
2. Market Research forecast values are included in the same final front-end model.
3. Market Research TLC forecast is calculated using:
   - TLC formula from the MR front-end model
   - future resin index values from the MR index reference table
   - same freight, tax, insurance, and other country parameters from the actual model
4. Backend now reads final standardized models instead of trying to calculate directly from raw files.
5. Trend view should not apply the selected month filter to Market Research trend data.
6. Supplier and Market Research should eventually be organized into one refreshable architecture.

## Proposed Architecture To Work On Next

Recommended future structure:

```text
data/
  raw/
  reference/
  processed/

pipelines/
  suppliers/
  market_research/
  indexes/
  common/
  orchestration/

apps/
  backend/
  frontend/

docs/
  architecture.md
  refresh_runbook.md
  mapping_rules.md
  data_dictionary.md

artifacts/
  validation/
  run_logs/
  audit/
```

Recommended refresh flow:

```text
Raw Excel Inputs
-> Extraction
-> Standardization
-> Mapping
-> TLC Calculation
-> Forecast Calculation
-> Validation
-> Final Front End Models
-> Backend
-> Frontend
```

Recommended final backend inputs:

```text
Data_Standardized_Front_End_Data_Model.csv
Data_Standardized_MR_Front_End_Data_Model.csv
supplier_icis_resin_index_reference_table.csv
market_research_icis_resin_index_reference_table.csv
Mapping_Columns.xlsx
```

## Tomorrow's Starting Point

Start by designing the final architecture flow. Do not move files immediately.

Suggested first step:

```text
1. Map current folders to future folders.
2. Decide which files are source, generated, runtime, or archive.
3. Create the final refresh flow.
4. Define what should be committed to Git and what should stay out.
5. Only then start reorganizing files.
```

