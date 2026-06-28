# AI Insights / Narration Flow

This note summarizes how the AI Insights feature works in the PET Resin Cost repo and where to enhance it.

## Branch

The feature is not currently in `main`.

It exists on:

```powershell
origin/feature/latest-ytd-updates
```

The main feature files are:

```text
apps/backend/ai_insights.py
apps/backend/main.py
apps/frontend/src/components/AIInsightPanel.tsx
apps/frontend/src/lib/useInsights.ts
apps/frontend/src/types.ts
```

## Overall Flow

```text
User opens dashboard page
        ↓
Frontend collects current page data and filters
        ↓
AIInsightPanel sends request to backend /insights
        ↓
Backend builds structured analytics
        ↓
Backend sends analytics to LLM
        ↓
LLM returns business narration / bullet insights
        ↓
Frontend displays the insights panel
```

## Frontend Flow

Each dashboard page adds an `AIInsightPanel`.

Used in:

```text
HomePage.tsx
TrendsPage.tsx
CostComponentsPage.tsx
SimulationPage.tsx
```

Example request shape:

```ts
{
  page: "home",
  destination: selectedDestination,
  month: selectedMonth,
  year: selectedYear,
  countries: data.countries,
  vendorBreakdowns: filteredVendorBreakdowns
}
```

The frontend does not call the LLM directly. It only calls the backend endpoint:

```text
POST /insights
```

That call happens in:

```text
apps/frontend/src/lib/useInsights.ts
```

## Backend Flow

The backend endpoint is in:

```text
apps/backend/main.py
```

Endpoint:

```python
@app.post("/insights")
def insights(req: InsightsRequest):
```

It receives the current page context and routes it to the correct analytics builder:

```text
home             -> analytics_home()
trends           -> analytics_trends()
cost_components  -> analytics_cost_components()
simulation       -> analytics_simulation()
```

## Analytics Layer

The analytics logic is in:

```text
apps/backend/ai_insights.py
```

This layer converts raw dashboard data into clean business metrics before sending anything to the LLM.

For `home`, it calculates:

```text
Market Research TLC by source country
Highest / lowest cost source country
Spread between source countries
Supplier vs Market gap for the same source country
Supplier contracted TLC at destination
```

For `trends`, it calculates:

```text
Month-on-month TLC changes
Percentage changes
Anomalies above 10% movement
Latest actual vs next forecast gap
```

For `cost_components`, it calculates:

```text
Resin share of TLC
Freight share of TLC
Tax share of TLC
Highest resin-driven supplier
Highest freight-driven supplier
```

For `simulation`, it calculates:

```text
Base TLC
Simulated TLC
Dollar impact
Percentage impact
```

## LLM Layer

The actual LLM call happens in:

```text
apps/backend/ai_insights.py
```

Function:

```python
generate_insights(page, analytics)
```

It uses:

```python
from openai import OpenAI
```

Model configured as:

```python
MODEL = "openai/gpt-4o"
```

The call is:

```python
client.chat.completions.create(...)
```

It uses environment variables:

```text
OPENAI_API_KEY or ASIMOV_API_KEY
BASE_URL or ASIMOV_BASE_URL
```

So it is designed to work with OpenAI or an OpenAI-compatible Asimov endpoint.

## Prompt Behavior

The system prompt asks the LLM to act as:

```text
A senior procurement strategist at AB InBev specializing in PET resin sourcing for Latin America.
```

It tells the model to produce:

```text
3-5 bullet-point insights
Business-friendly wording
Cost-saving opportunities
Risk flags
No extra headers
```

It also includes an important guardrail:

```text
Do not compare supplier contracted TLC directly against a different source-country market benchmark.
```

That means the LLM should avoid false savings claims from bad comparisons.

## Caching

Before calling the LLM, the backend creates a hash of:

```text
page + analytics
```

If the same request was already processed, it returns the cached result instead of calling the LLM again.

This is handled inside:

```python
generate_insights()
```

## Frontend Display

The response looks like:

```json
{
  "page": "home",
  "insights": "...bullet text from LLM...",
  "analytics": {}
}
```

The frontend displays `insights` in:

```text
AIInsightPanel.tsx
```

It renders the LLM output as bullet points, with basic bold formatting.

## Key Takeaway

The feature is designed as:

```text
Data first -> analytics second -> LLM narration third
```

The LLM is not calculating from raw Excel. It narrates structured analytics prepared by the backend.

The best places to enhance the feature are:

```text
1. Improve the analytics layer in apps/backend/ai_insights.py
2. Improve the prompt and schema guardrails in apps/backend/ai_insights.py
3. Improve the UI display in apps/frontend/src/components/AIInsightPanel.tsx
4. Add stronger dependency/config handling for openai, python-dotenv, API keys, and base URL
```
