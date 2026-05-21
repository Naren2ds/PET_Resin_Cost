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


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = REPO_ROOT / "apps" / "frontend" / "dist"

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
