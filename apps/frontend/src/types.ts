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

export type InsightsResult = {
  page: string;
  insights: string;        // markdown bullet list from LLM
  analytics: Record<string, unknown>;
};
