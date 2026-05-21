# Architecture Flow

This migration keeps the existing business logic unchanged and only reorganizes files and paths.

## Data Flow

```text
Raw Excel inputs
-> extraction scripts
-> standardization scripts
-> mapping files
-> TLC calculation
-> forecast calculation
-> validation/audit outputs
-> final front-end data models
-> backend APIs
-> frontend views
```

## Runtime Boundary

The backend reads only final processed outputs from:

```text
data/processed/current/supplier/
data/processed/current/market_research/
data/processed/current/indexes/
data/reference/mappings/
```

The backend does not read raw Excel source files during normal UI usage.

## Supplier Flow

```text
data/raw/suppliers/
-> pipelines/suppliers/<supplier>/scripts/
-> pipelines/suppliers/<supplier>/artifacts/
-> pipelines/suppliers/consolidation/consolidate_front_end_data_model.py
-> data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.xlsx
```

## Market Research Flow

```text
data/raw/market_research/PET Resin Total landed cost calculator.xlsx
data/processed/current/indexes/market_research/market_research_icis_resin_index_reference_table.csv
data/reference/mappings/Mapping_Columns.xlsx
-> pipelines/market_research/tlc_model/build_market_research_front_end_data_model.py
-> data/processed/current/market_research/Data_Standardized_MR_Front_End_Data_Model.xlsx
```

## Backend Flow

```text
apps/backend/main.py
-> supplier_data_model.py
-> market_research_data_model.py
-> /countries
-> /market-research-trends
```

## Frontend Flow

```text
apps/frontend/src/
-> backend APIs
-> cards, deep dive, and trends views
```