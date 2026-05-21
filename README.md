# PET Resin Cost Platform

This is the clean architecture workspace created from the working PET_Data_Model folder.

The original working folder remains unchanged:

```text
C:\Users\40100123\OneDrive - Anheuser-Busch InBev\GAC\PET\Data Model\PET_Data_Model
```

This folder is the reorganized platform root:

```text
C:\Users\40100123\OneDrive - Anheuser-Busch InBev\GAC\PET\Data Model\PET_Resin_Cost_Platform
```

## Main Folders

```text
data/raw/                         source Excel inputs
data/reference/mappings/          mapping workbooks
data/processed/current/           backend-ready final outputs
pipelines/                         data extraction, standardization, forecast, and consolidation scripts
apps/backend/                      FastAPI backend
apps/frontend/                     React frontend
docs/                              architecture notes and runbooks
artifacts/                         audit, validation, and run logs
```

## Verified Outputs

Supplier final model:

```text
data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.xlsx
data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.csv
```

Market Research final model:

```text
data/processed/current/market_research/Data_Standardized_MR_Front_End_Data_Model.xlsx
data/processed/current/market_research/Data_Standardized_MR_Front_End_Data_Model.csv
```

## Refresh Commands

From this folder:

```powershell
python pipelines\orchestration\run_suppliers.py --consolidate-only
python pipelines\orchestration\run_market_research.py --skip-index
```

Full refresh wrappers are also available:

```powershell
python pipelines\orchestration\run_indexes.py
python pipelines\orchestration\run_suppliers.py
python pipelines\orchestration\run_market_research.py
python pipelines\orchestration\run_all.py --supplier-consolidate-only
```

## Run Backend

```powershell
cd apps\backend
python -m uvicorn main:app --reload --port 8000
```

## Run Frontend

```powershell
cd apps\frontend
npm install
npm run dev
```