# Refresh Runbook

Run commands from the platform root:

```text
C:\Users\40100123\OneDrive - Anheuser-Busch InBev\GAC\PET\Data Model\PET_Resin_Cost_Platform
```

## Quick Refresh Using Existing Supplier Artifacts

```powershell
python pipelines\orchestration\run_suppliers.py --consolidate-only
python pipelines\orchestration\run_market_research.py --skip-index
```

This rebuilds the final backend-ready Supplier and Market Research models without re-running every supplier extraction script.

## Full Index Refresh

```powershell
python pipelines\orchestration\run_indexes.py
```

This refreshes:

```text
data/processed/current/indexes/suppliers/icis_resin_index_reference_table.csv
data/processed/current/indexes/market_research/market_research_icis_resin_index_reference_table.csv
```

## Full Supplier Refresh

```powershell
python pipelines\orchestration\run_suppliers.py
```

This runs supplier-specific scripts and then rebuilds the consolidated Supplier model.

## Market Research Refresh

```powershell
python pipelines\orchestration\run_market_research.py
```

Use this when the MR ICIS source index file has changed.

Use this when only the final MR TLC model needs to be rebuilt from the existing index table:

```powershell
python pipelines\orchestration\run_market_research.py --skip-index
```

## Backend Check

```powershell
cd apps\backend
python -c "from main import countries, market_research_trends; c=countries(destination='Colombia', month='March', year='2026'); t=market_research_trends(destination='Colombia', year='2026'); print(len(c['countries']), len(c['vendorBreakdowns']), len(t['rows']))"
```

Expected current check:

```text
8 market research countries
2264 supplier breakdown rows
88 market research trend rows
```