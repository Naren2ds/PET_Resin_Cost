# PET Resin Cost Backend

## Structure

```text
apps/backend/
|-- app/
|   |-- main.py                 # FastAPI application and routes
|   |-- data/
|   |   |-- supplier.py         # Supplier workbook access and transformations
|   |   `-- market_research.py  # Market Research workbook access and transformations
|   `-- services/
|       `-- insights.py         # Analytics and AI insight generation
|-- scripts/
|   |-- generate_insights_cache.py
|   `-- check_llm_connection.py
|-- docs/
|   `-- market_research_flow.md
|-- legacy/
|   `-- sample_vendor_breakdowns.py
|-- main.py                     # Compatibility entry point
|-- requirements.txt
`-- .env                        # Local secrets; ignored by Git
```

## Run the API

From the repository root:

```powershell
uvicorn main:app --app-dir apps/backend --host 0.0.0.0 --port 8000
```

The compatibility entry point keeps the existing deployment command working. New Python code should import from `app`, for example:

```python
from app.main import app
from app.data.market_research import build_market_research_countries
```

## Generate the insights cache

The existing command remains supported:

```powershell
python apps/backend/generate_insights_cache.py
```

The canonical script location is:

```powershell
python apps/backend/scripts/generate_insights_cache.py
```

## Environment

Keep API keys only in `apps/backend/.env`. The file is ignored by Git. Do not place secrets in application modules or scripts.