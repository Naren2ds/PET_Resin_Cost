export type BreakdownItem = {
  label: string;
  amount: number | string | null;
  formulaReference: string;
  commonComponent?: string;
  mappingColumn?: string;
  rawLabel?: string;
  dataType?: string;
  sourceFile?: string;
  resinIndexType?: string;
  forecastResinIndexType?: string;
  columnRequiredForCalculation?: string;
};

export type CountryCost = {
  country: string;
  amount: number | string | null;
  rank: number | string | null;
  breakdown: BreakdownItem[];
  dataType?: string;
  sourceFile?: string;
};

export type VendorBreakdownRow = {
  label: string;
  amount: string | number | null;
  valueFormat?: "currency" | "percentage";
  formulaReference?: string;
  commonComponent?: string;
  mappingColumn?: string;
  rawLabel?: string;
  dataType?: string;
  sourceFile?: string;
  location?: string;
  resinIndexType?: string;
  forecastResinIndexType?: string;
  columnRequiredForCalculation?: string;
};

export type VendorBreakdownEntry = {
  destination: string;
  sourceCountry: string;
  month: string;
  year: string | number;
  rows: VendorBreakdownRow[];
  supplierName?: string;
  supplier?: string;
  vendor?: string;
  location?: string;
  dataType?: string;
  sourceFile?: string;
};

export type VendorBreakdown = VendorBreakdownEntry;

export type MarketResearchTrendEntry = {
  destination: string;
  sourceCountry: string;
  month: string;
  year: string | number;
  dataType?: string;
  amount: number | string | null;
  resinIndexAmount?: number | string | null;
  resinIndexType?: string;
  forecastResinIndexType?: string;
  indexRawLabel?: string;
  formulaReference?: string;
  sourceFile?: string;
};

export type ApiResponse = {
  destination: string;
  supplierPrice: number;
  month: string;
  year?: string;
  countries: CountryCost[];
  vendorBreakdowns: VendorBreakdownEntry[];
  marketResearchTrends?: MarketResearchTrendEntry[];
  availableDestinations?: string[];
};

export const formatAmount = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 1,
    }).format(value);
  }
  return String(value);
};

/** Delta = supplier TLC - market research TLC. */
export const formatDeltaVersusMarketForCompany = (supplierMinusMarket: number): string =>
  `${supplierMinusMarket > 0 ? "+" : ""}$${formatAmount(supplierMinusMarket)}/MT`;

// ---------------------------------------------------------------------------
// AI Insights
// ---------------------------------------------------------------------------
export type InsightsRequest = {
  page: string;
  destination?: string;
  month?: string;
  year?: string;
  countries?: CountryCost[];
  vendorBreakdowns?: VendorBreakdownEntry[];
  marketResearchTrends?: MarketResearchTrendEntry[];
  baseTlc?: number | null;
  simulatedTlc?: number | null;
};

export type ProcurementSummaryItem = {
  supplier: string;
  source_country: string;
  destination: string;
  gap_abs: number | null;
  gap_pct: number | null;
  negotiation_priority: string;
  recommended_action: string;
};

export type ProcurementIntelligenceRecord = {
  supplier: string;
  destination: string;
  source_country: string;
  location: string;
  supplier_tlc: number | null;
  best_market_tlc: number | null;
  same_source_market_tlc: number | null;
  gap_abs: number | null;
  gap_pct: number | null;
  supplier_rank: number | null;
  largest_cost_driver: string;
  second_largest_cost_driver: string;
  cost_driver_breakdown: Array<{ label: string; amount: number }>;
  forecast_trend: string;
  forecast_gap_trend: string;
  volatility_risk: string;
  negotiation_priority: string;
  recommended_action: string;
  benchmark_scope: string;
  comparison_guardrail: string;
};

export type ProcurementIntelligence = {
  page: string;
  destination: string;
  month: string;
  year: string;
  records: ProcurementIntelligenceRecord[];
  summary: {
    top_risks: ProcurementSummaryItem[];
    top_opportunities: ProcurementSummaryItem[];
    best_suppliers: ProcurementSummaryItem[];
    worst_suppliers: ProcurementSummaryItem[];
  };
  simulation_context?: {
    base_tlc: number;
    simulated_tlc: number;
    impact_delta_usd: number;
    impact_pct: number;
  } | null;
};

export type InsightsResult = {
  page: string;
  insights: string;        // markdown bullet list from LLM
  analytics: Record<string, unknown> & {
    procurement_intelligence?: ProcurementIntelligence;
  };
};

