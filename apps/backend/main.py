from pathlib import Path
from typing import List, Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from market_research_data_model import (
    DEFAULT_DESTINATION,
    DEFAULT_MONTH,
    DEFAULT_YEAR,
    add_supplier_delta_rows,
    build_market_research_countries,
    build_market_research_tlc_trends,
)
from supplier_data_model import build_vendor_breakdowns, supplier_price_for
from ai_insights import (
    analytics_home,
    analytics_trends,
    analytics_cost_components,
    analytics_simulation,
    build_procurement_intelligence,
    generate_insights,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = REPO_ROOT / "apps" / "frontend" / "dist"
FRONTEND_PUBLIC = REPO_ROOT / "apps" / "frontend" / "public"

app = FastAPI(title="PET Resin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BreakdownRow(BaseModel):
    label: str
    amount: Union[float, int, str, None]
    formulaReference: str = ""
    commonComponent: str = ""
    dataType: str = ""
    sourceFile: str = ""
    mappingColumn: str = ""
    rawLabel: str = ""
    resinIndexType: str = ""
    forecastResinIndexType: str = ""
    columnRequiredForCalculation: str = ""


class CountryCost(BaseModel):
    country: str
    amount: Union[float, int, str, None]
    rank: Union[int, str]
    breakdown: List[BreakdownRow]
    dataType: str = ""
    sourceFile: str = ""


class VendorBreakdownRow(BaseModel):
    label: str
    amount: Union[float, int, str, None]
    formulaReference: str = ""
    commonComponent: str = ""
    mappingColumn: str = ""
    rawLabel: str = ""
    dataType: str = ""
    sourceFile: str = ""
    location: str = ""
    resinIndexType: str = ""
    forecastResinIndexType: str = ""
    columnRequiredForCalculation: str = ""


class VendorBreakdown(BaseModel):
    destination: str
    sourceCountry: str
    month: str
    year: str
    rows: List[VendorBreakdownRow]
    supplierName: Optional[str] = None
    supplier: Optional[str] = None
    vendor: Optional[str] = None
    location: Optional[str] = None
    dataType: Optional[str] = None
    sourceFile: Optional[str] = None


class MarketResearchTrendRow(BaseModel):
    destination: str
    sourceCountry: str
    month: str
    year: str
    dataType: str = ""
    amount: Union[float, int, str, None]
    resinIndexAmount: Union[float, int, str, None] = None
    resinIndexType: str = ""
    forecastResinIndexType: str = ""
    indexRawLabel: str = ""
    formulaReference: str = ""
    sourceFile: str = ""


class CountriesResponse(BaseModel):
    destination: str
    supplierPrice: Union[float, int]
    month: str
    year: str
    countries: List[CountryCost]
    vendorBreakdowns: List[VendorBreakdown] = []
    marketResearchTrends: List[MarketResearchTrendRow] = []


class MarketResearchTrendsResponse(BaseModel):
    destination: str
    year: str
    rows: List[MarketResearchTrendRow]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/countries", response_model=CountriesResponse)
def countries(
    destination: Optional[str] = None,
    month: Optional[str] = None,
    year: Optional[str] = None,
    includeVendorBreakdowns: bool = True,
):
    """
    Build the front-end payload from the standardized data models.

    Market Research source-country cards come from
    Data_Standardized_MR_Front_End_Data_Model. Supplier breakdowns come from
    Data_Standardized_Front_End_Data_Model.
    """

    selected_destination = destination or DEFAULT_DESTINATION
    selected_month = month or DEFAULT_MONTH
    selected_year = str(year or DEFAULT_YEAR)

    market_countries = build_market_research_countries(
        selected_destination,
        selected_month,
        selected_year,
    )
    source_countries = tuple(
        str(country.get("country", ""))
        for country in market_countries
        if country.get("country")
    )

    vendor_breakdowns = (
        build_vendor_breakdowns(source_countries) if includeVendorBreakdowns else []
    )

    # When no market research data exists for the selected period, create
    # stub country entries from vendor breakdown source countries so the
    # frontend table still renders supplier TLC values.
    if not market_countries and vendor_breakdowns:
        seen_sources = sorted(
            {str(vb.get("sourceCountry", "")) for vb in vendor_breakdowns if vb.get("sourceCountry")}
        )
        market_countries = [
            {"country": src, "amount": None, "rank": "#N/A", "dataType": "", "sourceFile": "", "breakdown": []}
            for src in seen_sources
        ]

    if includeVendorBreakdowns:
        market_countries = add_supplier_delta_rows(
            market_countries,
            vendor_breakdowns,
            selected_destination,
            selected_month,
            selected_year,
        )

    supplier_price = supplier_price_for(
        vendor_breakdowns,
        selected_destination,
        selected_month,
        selected_year,
    )
    market_research_trends = build_market_research_tlc_trends(
        selected_destination,
        selected_year,
    )

    return {
        "destination": selected_destination,
        "supplierPrice": supplier_price or 0,
        "month": selected_month,
        "year": selected_year,
        "countries": market_countries,
        "vendorBreakdowns": vendor_breakdowns,
        "marketResearchTrends": market_research_trends,
    }


@app.get("/market-research-trends", response_model=MarketResearchTrendsResponse)
def market_research_trends(
    destination: Optional[str] = None,
    year: Optional[str] = None,
):
    selected_destination = destination or DEFAULT_DESTINATION
    selected_year = str(year or DEFAULT_YEAR)
    return {
        "destination": selected_destination,
        "year": selected_year,
        "rows": build_market_research_tlc_trends(
            selected_destination,
            selected_year,
        ),
    }


class InsightsRequest(BaseModel):
    page: str  # "home" | "trends" | "cost_components" | "simulation"
    destination: Optional[str] = None
    month: Optional[str] = None
    year: Optional[str] = None
    # home / cost_components
    countries: Optional[List[dict]] = None
    vendorBreakdowns: Optional[List[dict]] = None
    # trends
    marketResearchTrends: Optional[List[dict]] = None
    # simulation
    baseTlc: Optional[float] = None
    simulatedTlc: Optional[float] = None


class InsightsResponse(BaseModel):
    page: str
    insights: str
    analytics: dict


@app.post("/insights", response_model=InsightsResponse)
def insights(req: InsightsRequest):
    """
    Accepts the current page's data payload, runs analytics, calls the LLM,
    and returns business-friendly insights as markdown bullet points.
    """
    destination = req.destination or DEFAULT_DESTINATION
    month = req.month or DEFAULT_MONTH
    year = str(req.year or DEFAULT_YEAR)
    page = req.page.lower()

    if page == "home":
        analytics = analytics_home(
            destination, month, year,
            req.countries or [],
            req.vendorBreakdowns or [],
        )
    elif page == "trends":
        analytics = analytics_trends(
            destination, year,
            req.marketResearchTrends or [],
            req.vendorBreakdowns or [],
        )
    elif page == "cost_components":
        analytics = analytics_cost_components(
            destination, month, year,
            req.vendorBreakdowns or [],
        )
    elif page == "simulation":
        analytics = analytics_simulation(
            req.baseTlc, req.simulatedTlc,
            destination, month, year,
        )
    else:
        analytics = {"page": page, "note": "unknown page"}

    analytics["procurement_intelligence"] = build_procurement_intelligence(
        page=page,
        destination=destination,
        month=month,
        year=year,
        countries=req.countries or [],
        vendor_breakdowns=req.vendorBreakdowns or [],
        market_research_trends=req.marketResearchTrends or [],
        base_tlc=req.baseTlc,
        simulated_tlc=req.simulatedTlc,
    )

    insight_text = generate_insights(page, analytics)
    return {"page": page, "insights": insight_text, "analytics": analytics}


@app.get("/insights-cache.json", include_in_schema=False)
def insights_cache_file():
    """Serve insights cache from frontend public assets (with dist fallback)."""
    public_cache = (FRONTEND_PUBLIC / "insights-cache.json").resolve()
    dist_cache = (FRONTEND_DIST / "insights-cache.json").resolve()

    try:
        public_cache.relative_to(FRONTEND_PUBLIC.resolve())
        dist_cache.relative_to(FRONTEND_DIST.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Insights cache not found") from exc

    if public_cache.is_file():
        return FileResponse(public_cache)
    if dist_cache.is_file():
        return FileResponse(dist_cache)

    raise HTTPException(status_code=404, detail="Insights cache not found")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    dist_root = FRONTEND_DIST.resolve()
    requested_path = (dist_root / full_path).resolve()

    try:
        requested_path.relative_to(dist_root)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Static file not found") from exc

    if full_path and requested_path.is_file():
        return FileResponse(requested_path)

    index_path = dist_root / "index.html"
    if index_path.is_file():
        return FileResponse(index_path)

    raise HTTPException(
        status_code=404,
        detail="Frontend build not found. Run `npm run build` before starting the app.",
    )
