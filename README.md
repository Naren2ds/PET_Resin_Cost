# PET Resin Cost Platform

## 1. Purpose

The PET Resin Cost Platform compares the Total Landed Cost (TLC) charged by PET resin/preform suppliers with independently calculated market-research TLC benchmarks.

The application helps procurement users:

- view supplier TLC and market-research TLC by destination, month and source country;
- compare common cost components such as resin, freight, taxes and other costs;
- inspect actual and forecast trends;
- simulate TLC changes;
- identify sourcing and negotiation opportunities; and
- review generated procurement insights.

The application does not calculate TLC in the browser. The standardized Supplier and Market Research models are the source of truth. The backend reads those models and exposes them through the API.

## 2. Application Architecture

```text
ICIS resin-index files + freight/tax assumptions + supplier inputs
                              |
                              v
                 Refresh and calculation scripts
                              |
                              v
       Supplier and Market Research standardized data models
                              |
                              v
                    FastAPI backend API
                              |
                              v
                  React/TypeScript frontend
```

Important folders:

| Path | Purpose |
| --- | --- |
| `apps/backend/` | FastAPI API, data loaders and insight generation |
| `apps/frontend/` | React, TypeScript and Vite user interface |
| `data/processed/current/supplier/` | Current Supplier frontend data model |
| `data/processed/current/market_research/` | Current Market Research frontend data model |
| `data/processed/current/opportunity/` | Opportunity calculation workbook used by the Opportunity page |
| `data/reference/mappings/` | Common-component mapping workbooks |
| `pipelines/` | Extraction, standardization and TLC calculation pipelines |
| `testing_scripts/` | Refresh validation and UI/data consistency tests |

## 3. Runtime Source-of-Truth Files

The backend requires these tracked files:

```text
data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.xlsx
data/processed/current/market_research/Data_Standardized_MR_Front_End_Data_Model.xlsx
data/processed/current/opportunity/PET_Quantification_Breakdown_By_Destination.xlsx
```

The refresh process also creates CSV mirrors beside the Supplier and Market workbooks. CSV files are intentionally ignored by Git because they are generated. At runtime, the backend uses the CSV when it is at least as recent as the workbook; otherwise, it reads the workbook.

Both standardized workbooks use the `front_end_data_model` sheet and the following canonical fields:

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

## 4. Local Setup

Prerequisites:

- Python 3.11 or later;
- Node.js 20 or later;
- npm; and
- access to the approved ICIS history/forecast input workbooks.

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r apps\backend\requirements.txt
cd apps\frontend
npm ci
cd ..\..
```

Do not commit `apps/backend/.env`, source ICIS workbooks, generated backups, validation reports or CSV mirrors.

## 5. Run the Application

### Development mode

Terminal 1, from the repository root:

```powershell
python -m uvicorn app.main:app --app-dir apps\backend --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd apps\frontend
npm run dev
```

The Vite frontend normally runs at `http://localhost:5173` and calls the backend at `http://localhost:8000`.

### Production-style local run

```powershell
cd apps\frontend
npm ci
npm run build
cd ..\..
python -m uvicorn app.main:app --app-dir apps\backend --host 0.0.0.0 --port 8000
```

The backend serves the built frontend from `apps/frontend/dist`.

### Main API endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Backend health check |
| `GET /countries` | Supplier and Market TLC payload for destination/month/year |
| `GET /market-research-trends` | Market trend data |
| `GET /opportunities` | Opportunity summary and component breakdown |
| `GET /opportunities/download` | Download the opportunity workbook |
| `POST /insights` | Generate a live insight response |
| `GET /insights-cache.json` | Serve the generated static insight cache |

Example check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## 6. Resin-Index Refresh Business Rules

The primary refresh utility is:

```text
testing_scripts/refresh_monthly_resin_tlc.py
```

It performs the following actions together:

1. reads approved ICIS actual history and China forecast workbooks;
2. creates timestamped backups of both Supplier and Market XLSX/CSV models;
3. applies destination-specific resin-index lags;
4. replaces refreshed forecast rows with actual rows for the configured actual months;
5. carries supplier non-resin components from the latest previous actual month;
6. reads the approved Market freight database when it is present in the month folder, otherwise keeps existing Market freight unchanged;
7. recalculates all affected Supplier and Market TLC values;
8. updates XLSX and CSV together; and
9. creates an audit workbook with old/new resin and TLC values.

`refresh_september_october_2026.py` is retained as the historical September/October 2026 implementation and calculation engine. New refreshes should use the monthly entry point above.

### Approved destination lags

| Destination | Lag |
| --- | --- |
| Argentina | M-2 |
| Bolivia | M-1 |
| Brazil | M-1 |
| Colombia | M-2 |
| Dominican Republic | M-2 |
| Ecuador | M-2 |
| El Salvador | M-3 |
| El Salvador and Honduras | M-3 |
| Honduras | M-3 |
| Panama | M-2 |
| Peru | M-2 |
| Uruguay | M-1 |

Example: an October TLC with an M-2 lag uses the August resin index.

### Supplier resin-index mapping

| Destination / supplier | Resin series |
| --- | --- |
| Argentina / Amcor | ICIS China |
| Bolivia / Gestora | ICIS China |
| Brazil / Amcor | ICIS China |
| Brazil / Cristalpet | ICIS China |
| Brazil / Engepack | ICIS China |
| Brazil / Valgroup | ICIS Asia SE Low |
| Colombia / Amcor | ICIS China |
| Dominican Republic / SMI PET | ICIS Asia SE Low |
| Ecuador / Amcor | ICIS China |
| El Salvador and Honduras / Amcor | ICIS China |
| Panama / Pastiglas | ICIS Asia SE Low |
| Peru / Pastiglas | ICIS Asia SE Low |
| Uruguay / Cristalpet | IHS, M-1; handled separately when approved IHS values change |

### Market source-country resin-index mapping

| Market source country | Resin series |
| --- | --- |
| China | ICIS China |
| India | ICIS India |
| Mexico | ICIS Mexico |
| South Korea | ICIS South Korea |
| Taiwan | ICIS Taiwan |
| Indonesia | ICIS Asia SE Low |
| Thailand | ICIS Asia SE Low |
| Vietnam | ICIS Asia SE Low |
| Argentina | Global ICIS average |
| Brazil | Global ICIS average |
| USA | Global ICIS average |

Global ICIS is the arithmetic average of Asia SE Low, China, India, Mexico, South Korea and Taiwan. The same destination lag is applied to every direct resin series and to every input in the Global ICIS average.

## 7. Refresh Inputs and Command

For a resin-based monthly refresh, create `PET_Files_DB/<Month>` and place the approved inputs in that folder:

- ICIS actual history for China, India, Mexico, South Korea and Taiwan;
- ICIS Asia SE Low actual history;
- approved China forecast values for future periods;
- the approved Market freight workbook with a `Consolidated Values` sheet when the quarterly freight basis changes;
- approved IHS values for Uruguay when they change;
- the current Supplier standardized workbook;
- the current Market Research standardized workbook; and
- the raw Market Research TLC calculator used for tax/reference rates.

Run the refresh by passing the latest TLC month that should be marked Actual:

```powershell
python testing_scripts\refresh_monthly_resin_tlc.py --month November --year 2026
```

The script automatically discovers the newest compatible direct ICIS history, Asia SE Low history, China forecast and Market freight workbook in the month folder. It refreshes the selected Actual month and all later months available in both frontend models. Future months remain Forecast. Supplier freight and other non-resin inputs are copied from the latest Actual month.

If the input folder has a different name or a file cannot be discovered automatically, pass an override such as `--input-folder`, `--history`, `--asia-se-history`, `--china-forecast` or `--freight`. Run `python testing_scripts\refresh_monthly_resin_tlc.py --help` for the complete syntax.

The script creates backups by default. Do not use `--no-backup` for a production refresh.

Uruguay is deliberately retained by the primary refresh script. If new approved Uruguay IHS values are supplied, update the values and period mapping in the companion utility, review them, and run:

```powershell
python testing_scripts\update_uruguay_ihs_sep_dec.py
```

This companion utility also creates a Supplier model backup before writing.

## 8. Supplier TLC Components, Variables and Constants

General rule:

- variable each refresh: lagged resin index;
- carried from the previous actual: supplier freight and other non-resin inputs unless a new approved actual is supplied;
- recalculated: percentage-derived amounts, subtotals and TLC; and
- constants: supplier-specific fixed adders/rates until procurement approves a change.

| Destination / supplier | Required inputs | TLC calculation | Refresh treatment |
| --- | --- | --- | --- |
| Argentina / Amcor | Resin, ocean freight, import-clearance amount | `Resin + Freight + Import clearance` | Resin varies; non-resin values carried from latest actual |
| Bolivia / Gestora | Resin, maritime freight, internalization cost, CDP %, bank-fee % | `(Resin + Freight) × (1 + CDP% + Bank fee%) + Internalization` | Resin varies; percentages and fixed internalization remain constant until approved |
| Brazil / Amcor | Resin, international freight, duties rate, other costs | `Resin + Freight + 20.8% × (Resin + Freight) + Others` | Resin varies; duties are recalculated; freight/others use latest actual |
| Brazil / Cristalpet | Resin, freight, Tax %, other costs, additional China-index cost, FX | `(Resin + Freight) × (1 + Tax%) + Other costs + Additional cost` | USD TLC is the comparison value; FX is retained for local-currency reference |
| Brazil / Engepack | Resin, freight, fixed 100, tax 20%, fixed 125, freight adder 8% | `((Resin + 100 + Freight) × 1.20) + 125 + 8% × Freight` | Maxiquim MME is reference-only and excluded from USD TLC |
| Brazil / Valgroup | Asia SE Low/resin assumption, Discount %, freight, Importation %, Import Tax %, surcharge, Indorama discount | `((Resin × (1 − Discount) + Freight) × (1 + Importation + Import Tax)) + Surcharge + Indorama discount` | Percentage impacts are converted to USD/MT; discounts may be negative |
| Colombia / Amcor | Resin, regular freight, incremental freight, finance rate, duty 5%, landed factor 8%, ZF change, surcharge | Incremental subtotal plus duty, landed factor, ZF change and surcharge | Resin varies; finance, duty and landed values are recalculated from retained rates |
| Dominican Republic / SMI PET | Resin, ocean freight, import-clearance amount | `Resin + Freight + Import clearance` | Resin varies; non-resin values carried from latest actual |
| Ecuador / Amcor | Resin, freight, finance, 0.10% CIF, 4% currency-exit tax, 0.5% CIF, fixed customs/local costs | `CIF + percentage costs + fixed customs/local costs` | CIF and percentage amounts recalculate; fixed items remain from latest actual |
| El Salvador and Honduras / Amcor | Resin, SC, adder, logistics, landed, finance rate, surcharge | Sum of resin and listed components | Finance amount recalculates using the retained finance rate; other non-resin inputs carry forward |
| Panama / Pastiglas | Resin, ocean freight, import-clearance amount | `Resin + Freight + Import clearance` | Resin varies; non-resin values carried from latest actual |
| Peru / Pastiglas | Resin, ocean freight, import-clearance amount | `Resin + Freight + Import clearance` | Resin varies; non-resin values carried from latest actual |
| Uruguay / Cristalpet | IHS resin, international freight, other costs, internalization/silo % | `(Resin + Freight + Other costs) × (1 + Internalization%)` | IHS uses M-1; refresh separately when approved values change |

Always use the exact `Raw Cost Breakdown` labels already present in the model. The calculation utilities match these labels; silently renaming a component can prevent it from being updated.

## 9. Market Research TLC Components, Variables and Constants

Market TLC is calculated for each source-country/destination route.

Variable or periodically refreshed inputs:

- lagged resin index by market source country;
- ocean freight by source/destination route; and
- destination-port local transportation when a new approved value is provided.

Freight policy:

- use the approved short-term ocean-freight value;
- if short-term is unavailable, use the approved long-term value;
- market freight is normally refreshed quarterly, not every resin-index refresh; and
- Honduras may use the approved El Salvador freight value when a Honduras lane is unavailable.

Destination tax and clearance inputs are taken from the raw Market Research TLC calculator and remain constant until the approved calculator changes.

Standard Market TLC includes:

```text
PET resin cost (FOB)
+ Freight cost
+ Insurance
+ Import duty
+ Anti-dumping duty
+ IPI
+ PIS
+ COFINS
+ Statistical fee
+ Tasa consular
+ Customs service fee
+ Customs insurance
+ IGV/IPM
+ Percepcion IGV
+ FODINFA
+ Destination-port transportation
```

Reference-only rows shown in the UI but normally excluded from TLC are:

```text
Additional VAT
Income tax perception
IBB
IRAE
Taxes (VAT/Import)
```

Destination-specific exclusions:

- Brazil: IPI, PIS and COFINS are shown for visibility but excluded from TLC.
- Peru: IGV/IPM and Percepcion IGV are shown for visibility but excluded from TLC.

The `Column Required for Calculation` field is the authoritative inclusion flag for normal rows. The backend and validation scripts also enforce the Brazil and Peru reference-tax exclusions.

## 10. Post-Refresh Validation

Run commands from the repository root. Validation reports are written locally and ignored by Git.

### A. Validate resin-index values and destination lags

```powershell
python testing_scripts\validate_resin_index_lags.py `
  --year 2026 `
  --tolerance 0.50 `
  --reference-workbook "C:\path\Resin_Index_Custom_Forecast.xlsx" `
  --history "C:\path\ICIS_History.xls" `
  --asia-se-history "C:\path\ICIS_Asia_SE_Low.xls" `
  --china-forecast "C:\path\ICIS_China_Forecast.xls" `
  --output-excel testing_scripts\resin_index_lag_validation.xlsx
```

The report contains separate `Suppliers` and `Market` sheets. Any `FAIL` or `NO REFERENCE` must be investigated.

### B. Validate component sums against TLC

```powershell
python testing_scripts\validate_tlc_breakdown.py --year 2026 --tolerance 0.15 --excel --output-excel testing_scripts\tlc_breakdown_latest.xlsx
```

### C. Validate Source, View TLC, common components and formula TLC

```powershell
python testing_scripts\validate_tlc_source_view_formula.py --year 2026 --tolerance-percent 5 --output-excel testing_scripts\tlc_source_view_formula_latest.xlsx
```

The current rule passes differences up to 5% and fails differences above 5%.

### D. Validate 12-month coverage

```powershell
python testing_scripts\validate_supplier_market_months.py --year 2026 --output-excel testing_scripts\supplier_market_months.xlsx
```

### E. Validate monthly freight coverage and values

```powershell
python testing_scripts\validate_monthly_freight_values.py --year 2026 --output-excel testing_scripts\monthly_freight_validation.xlsx
```

### F. Validate TLC consistency across UI views

```powershell
python testing_scripts\validate_ui_tlc_consistency.py --year 2026 --output-excel testing_scripts\ui_tlc_consistency.xlsx
```

### G. Validate Trends actual/forecast line styles

```powershell
python testing_scripts\test_trends_page_line_styles.py --year 2026 --output-excel testing_scripts\trends_line_styles.xlsx
```

Actual series must be solid and forecast series must be dotted.

### H. Frontend validation

```powershell
cd apps\frontend
npm run build
npm run lint
cd ..\..
```

`npm run build` is the required compilation check. At handover, the production build passes. The repository still has a pre-existing ESLint backlog in legacy chart, simulation, trends and insight components, so `npm run lint` is currently diagnostic and does not have a clean baseline. New changes should not add lint errors, and the existing backlog should be resolved separately before making lint a blocking release gate.

### I. Backend health validation

```powershell
python -c "import sys; sys.path.insert(0, 'apps/backend'); from app.main import health; print(health())"
```

Do not release a refresh when a required validation reports failures without documenting and approving the exception.

## 11. Generate AI Insights

The frontend reads static insights from:

```text
apps/frontend/public/insights-cache.json
```

Create `apps/backend/.env` locally:

```dotenv
OPENAI_API_KEY=your_key
# Optional when using an OpenAI-compatible internal gateway:
BASE_URL=https://your-approved-endpoint.example/v1
```

Alternative supported names are `ASIMOV_API_KEY` and `ASIMOV_BASE_URL`.

Check the connection:

```powershell
python apps\backend\scripts\check_llm_connection.py
```

Generate a small sample first:

```powershell
python apps\backend\scripts\generate_insights_cache.py --max-entries 5 --overwrite
```

Generate the complete cache from fresh data:

```powershell
python apps\backend\scripts\generate_insights_cache.py --overwrite
```

Useful filters:

```powershell
python apps\backend\scripts\generate_insights_cache.py --destinations "Brazil,Argentina" --pages "home,cost_components,trends" --overwrite
```

Use `--overwrite` after a data refresh. Without it, existing cache keys are skipped and can retain insights generated from older TLC values.

Never commit `.env` or API keys. Review the generated cache for completeness before committing it.

## 12. Opportunity Refresh

The Opportunity page reads:

```text
data/processed/current/opportunity/PET_Quantification_Breakdown_By_Destination.xlsx
```

After Supplier and Market models are validated, refresh the opportunity workbook with:

```powershell
python apps\backend\scripts\refresh_opportunity_workbook.py --month September --year 2026
```

Review the summary, destination sheets, selected market source, supplier TLC, market TLC, volume, component drivers and estimated opportunity before publishing.

## 13. Monthly Refresh Checklist

1. Confirm the approved actual and forecast resin-index files.
2. Confirm the latest actual month and the months that must remain Forecast.
3. Confirm destination lags have not changed.
4. Confirm Supplier freight basis: previous-month actual unless a newly approved supplier actual is available.
5. Confirm whether the quarterly Market freight database changed.
6. Confirm tax, percentage and fixed-component assumptions with procurement.
7. Close all output workbooks before running the refresh.
8. Run the refresh with backups enabled.
9. Review the generated audit workbook.
10. Run all required validation scripts.
11. Refresh the Opportunity workbook.
12. Regenerate the insights cache with `--overwrite`.
13. Build the frontend and run the backend health check.
14. Commit only source code, required standardized XLSX models, the approved Opportunity workbook and the reviewed insight cache.
15. Do not commit backups, raw source files, generated test reports, `.env`, `node_modules` or local presentation files.

## 14. Important Files for Maintenance

| File | Responsibility |
| --- | --- |
| `apps/backend/app/main.py` | FastAPI routes and frontend serving |
| `apps/backend/app/data/supplier.py` | Supplier model loading, normalization and API shaping |
| `apps/backend/app/data/market_research.py` | Market model loading, exclusions and API shaping |
| `apps/backend/app/data/opportunity.py` | Opportunity workbook loading |
| `apps/backend/app/services/insights.py` | Analytics and LLM insight generation |
| `apps/backend/scripts/generate_insights_cache.py` | Static insight-cache generation |
| `apps/backend/scripts/refresh_opportunity_workbook.py` | Opportunity recalculation |
| `apps/frontend/src/App.tsx` | Frontend routes |
| `apps/frontend/src/lib/api.ts` | Backend API client |
| `apps/frontend/src/pages/` | Application pages |
| `testing_scripts/refresh_monthly_resin_tlc.py` | Primary monthly resin-index, freight and TLC refresh entry point |
| `testing_scripts/refresh_september_october_2026.py` | Historical refresh and shared calculation engine |
| `testing_scripts/update_uruguay_ihs_sep_dec.py` | Approved Uruguay IHS companion refresh |
| `testing_scripts/validate_resin_index_lags.py` | Supplier/Market resin-index and lag validation |
| `testing_scripts/validate_tlc_breakdown.py` | Component sum versus TLC validation |
| `testing_scripts/validate_tlc_source_view_formula.py` | Source/View/formula reconciliation |

## 15. Git Handover Rules

Before committing:

```powershell
git status --short
git diff --cached --name-only
```

The final branch should contain application source, required refresh/validation utilities, current standardized XLSX models, the approved Opportunity workbook and this README. It should not contain:

- `apps/frontend/dist` build output;
- `node_modules`;
- `.env`;
- `*.backup_*.xlsx` or backup CSV files;
- raw ICIS downloads;
- generated testing reports;
- deprecated/one-off correction scripts;
- local PowerPoint files; or
- unused font variants.
