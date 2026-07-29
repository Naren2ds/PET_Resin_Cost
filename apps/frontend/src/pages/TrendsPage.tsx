import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ApiResponse,
  MarketResearchTrendEntry,
  VendorBreakdownEntry,
} from "../types";
import { formatAmount } from "../types";
import RevealOnScroll from "../components/RevealOnScroll";
import AIInsightPanel from "../components/AIInsightPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createApiUrl } from "../lib/api";
import {
  fallbackSupplierNameForDestination,
  supplierDisplayNameForEntry,
  supplierNameMatchesEntry,
} from "../lib/supplierDisplay";

type TrendsPageProps = {
  data: ApiResponse;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SUPPLIER_ACTUAL_COLOR = "#E6A817";
const SUPPLIER_FORECAST_COLOR = "#E6A817";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
const SUPPLIER_INDEX_COLOR = "#38BDF8";
const SUPPLIER_INDEX_FORECAST_COLOR = "#38BDF8";
const RESIN_INDEX_COMPONENT = "resin index";
const RESIN_INDEX_MAPPING = "resin index vpet";
const INDEX_MAPPING = "index";
const COMBINED_EL_SALVADOR_HONDURAS = "El Salvador and Honduras";
const PRIMARY_EL_SALVADOR_HONDURAS_OPTION = "El Salvador";
const MR_INDEX_TRAINING_WINDOW = "Jan 2020-May 2026";
const MR_INDEX_PREDICTED_WINDOW = "Jun 2026-Dec 2026";

const normalizeDestinationForUi = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed === COMBINED_EL_SALVADOR_HONDURAS
    ? PRIMARY_EL_SALVADOR_HONDURAS_OPTION
    : trimmed;
};

const destinationMatchKey = (value: string | undefined) => {
  const key = normalize(value);
  if (
    key === "el salvador and honduras" ||
    key === "el salvador" ||
    key === "honduras"
  ) {
    return "el-salvador-honduras";
  }
  return key;
};

const MARKET_SHORT_NAMES: Record<string, string> = {
  Argentina: "ARG",
  Brazil: "BRA",
  China: "CHN",
  India: "IND",
  Indonesia: "IDN",
  Mexico: "MEX",
  "South Korea": "KOR",
  Taiwan: "TWN",
  Thailand: "THA",
  USA: "USA",
  Vietnam: "VNM",
};

const MARKET_COUNTRY_COLORS: Record<string, string> = {
  Argentina: "#22C55E",
  Brazil: "#A855F7",
  China: "#14B8A6",
  India: "#F97316",
  Indonesia: "#06B6D4",
  Mexico: "#3B82F6",
  "South Korea": "#EC4899",
  Taiwan: "#8B5CF6",
  Thailand: "#84CC16",
  USA: "#F43F5E",
  Vietnam: "#10B981",
};

const MARKET_FALLBACK_COLORS = [
  "#14B8A6",
  "#3B82F6",
  "#EC4899",
  "#A855F7",
  "#F97316",
  "#22C55E",
  "#06B6D4",
  "#84CC16",
  "#F43F5E",
  "#10B981",
];

const RESIN_INDEX_MAPE_SCORES: Array<{ market: string; value: string }> = [
  { market: "Asia SE", value: "7.31%" },
  { market: "Mexico", value: "13%" },
  { market: "India", value: "5.99%" },
  { market: "South Korea", value: "6.14%" },
  { market: "Taiwan", value: "6.6%" },
];

const MAPE_SELECTION_ALIASES: Record<string, string> = {
  vietnam: "asia se",
  indonesia: "asia se",
  thailand: "asia se",
};

const normalize = (value: string | undefined) => (value ?? "").trim().toLowerCase();

const mapeKeyForSelection = (country: string) => {
  const key = normalize(country);
  return MAPE_SELECTION_ALIASES[key] ?? key;
};

const mapeScoreByKey = new Map(
  RESIN_INDEX_MAPE_SCORES.map((item) => [normalize(item.market), item.value])
);

const supplierMapeForIndex = (indexName: string) => {
  const key = normalize(indexName);
  if (key.includes("asia se")) {
    return mapeScoreByKey.get("asia se") ?? null;
  }
  return null;
};

const destinationDisplayName = (value: string | undefined) => {
  return normalizeDestinationForUi(value);
};

const normalizeIndexDisplayLabel = (value: string | undefined) => {
  const raw = (value ?? "").trim();
  const key = normalize(raw);
  if (!raw) return "";
  if (
    key.includes("icis fob china") ||
    key.includes("icis china") ||
    key.includes("china fob mid")
  ) {
    return "ICIS FOB China";
  }
  return raw;
};

const shortMarketName = (country: string) => MARKET_SHORT_NAMES[country] ?? country;

const marketSeriesColor = (country: string, index: number) =>
  MARKET_COUNTRY_COLORS[country] ?? MARKET_FALLBACK_COLORS[index % MARKET_FALLBACK_COLORS.length];

const parseNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "n/a") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const monthIndex = (month: string) => MONTHS.findIndex((item) => normalize(item) === normalize(month));

const shortMonthTick = (value: string) => {
  const [month, year] = value.split(" ");
  if (!month || !year) return value;
  return `${month}-${year.slice(-2)}`;
};

const monthWindowLabel = (indexes: number[]) => {
  const sorted = Array.from(new Set(indexes)).sort((a, b) => a - b);
  if (!sorted.length) return "Not available";

  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
      continue;
    }

    ranges.push(
      start === end
        ? `${MONTHS[start].slice(0, 3)} 2026`
        : `${MONTHS[start].slice(0, 3)}-${MONTHS[end].slice(0, 3)} 2026`
    );
    start = sorted[i];
    end = sorted[i];
  }

  ranges.push(
    start === end
      ? `${MONTHS[start].slice(0, 3)} 2026`
      : `${MONTHS[start].slice(0, 3)}-${MONTHS[end].slice(0, 3)} 2026`
  );

  return ranges.join(", ");
};

const getSupplierTlc = (entry: VendorBreakdownEntry) => {
  const row = entry.rows.find((item) => normalize(item.label) === SUPPLIER_TLC_LABEL);
  return parseNumber(row?.amount);
};

const getSupplierTlcRow = (entry: VendorBreakdownEntry) =>
  entry.rows.find((item) => normalize(item.label) === SUPPLIER_TLC_LABEL);

const isSupplierIndexRow = (row: VendorBreakdownEntry["rows"][number]) => {
  const common = normalize(row.commonComponent);
  const mapping = normalize(row.mappingColumn);
  const label = normalize(row.label);
  return (
    common === RESIN_INDEX_COMPONENT ||
    mapping === RESIN_INDEX_MAPPING ||
    mapping === INDEX_MAPPING ||
    label === RESIN_INDEX_MAPPING ||
    label === INDEX_MAPPING
  );
};

const supplierTlcPoint = (entry: VendorBreakdownEntry): TlcPoint | null => {
  const row = getSupplierTlcRow(entry);
  const value = parseNumber(row?.amount);
  if (!row || value === null) return null;
  const indexPoint = supplierIndexPoint(entry);
  const isForecast = dataTypeIsForecast(entry);
  return {
    value,
    isForecast,
    formulaReference: row.formulaReference || "",
    indexType:
      indexPoint?.indexType ||
      row.forecastResinIndexType ||
      row.resinIndexType ||
      "Supplier resin index",
    estimationNote: isForecast
      ? "Supplier TLC forecast is calculated from the forecast resin index plus the supplier pipeline assumptions. Non-index components are carried from the latest actual unless a pipeline-specific forecast input is available."
      : "Supplier TLC actual comes from the standardized supplier row selected for the current supplier, destination, and month.",
  };
};

const supplierIndexPoint = (entry: VendorBreakdownEntry): IndexPoint | null => {
  const row = entry.rows.find(isSupplierIndexRow);
  const value = parseNumber(row?.amount);
  if (!row || value === null) return null;
  const isForecast = dataTypeIsForecast(entry);
  const indexType = isForecast
    ? row.forecastResinIndexType || row.resinIndexType || row.rawLabel || row.label
    : row.resinIndexType || row.forecastResinIndexType || row.rawLabel || row.label;
  return {
    value,
    isForecast,
    indexType,
    rawLabel: row.rawLabel || row.label,
    formulaReference: row.formulaReference || "",
    formulaText: isForecast
      ? `Forecast Index_m = mapped supplier forecast index value_m for ${indexType}. The forecast series is read from the supplier index reference for each future month.`
      : `Actual index = ${row.rawLabel || row.label} value from the standardized supplier workbook row used by the TLC model.`,
    forecastTrainingMonths: "Not available",
    backTestedMonths: "Not available",
    predictedMonths: "Not available",
    confidenceScore: isForecast ? 72 : 96,
    confidenceLabel: isForecast ? "Forecast accuracy" : "Actual source confidence",
    estimationNote: isForecast
      ? "Index-only estimate sourced from the supplier forecast index series."
      : "Direct source index row from the standardized supplier data model.",
  };
};

const entrySupplierName = (entry: VendorBreakdownEntry | undefined) =>
  supplierDisplayNameForEntry(entry);

const dataTypeIsForecast = (entry: { dataType?: string } | undefined) =>
  normalize(entry?.dataType).includes("forecast");

const dataTypeIsActual = (entry: { dataType?: string } | undefined) =>
  normalize(entry?.dataType).includes("actual");

const forecastWindowFromEntries = (entriesByMonth: Map<number, VendorBreakdownEntry>): ForecastWindow => {
  const actualMonths: number[] = [];
  const forecastMonths: number[] = [];

  entriesByMonth.forEach((entry, index) => {
    if (dataTypeIsForecast(entry)) {
      forecastMonths.push(index);
    } else if (dataTypeIsActual(entry)) {
      actualMonths.push(index);
    }
  });

  return {
    forecastTrainingMonths: monthWindowLabel(actualMonths),
    backTestedMonths: monthWindowLabel(actualMonths),
    predictedMonths: monthWindowLabel(forecastMonths),
  };
};

const forecastWindowFromPoints = (pointsByMonth: Map<number, IndexPoint>): ForecastWindow => {
  const actualMonths: number[] = [];
  const forecastMonths: number[] = [];

  pointsByMonth.forEach((point, index) => {
    if (point.isForecast) {
      forecastMonths.push(index);
    } else {
      actualMonths.push(index);
    }
  });

  return {
    forecastTrainingMonths: monthWindowLabel(actualMonths),
    backTestedMonths: monthWindowLabel(actualMonths),
    predictedMonths: monthWindowLabel(forecastMonths),
  };
};

const withForecastWindow = (point: IndexPoint, window: ForecastWindow): IndexPoint => ({
  ...point,
  forecastTrainingMonths: window.forecastTrainingMonths,
  backTestedMonths: window.backTestedMonths,
  predictedMonths: window.predictedMonths,
});

const supplierEntryScore = (entry: VendorBreakdownEntry, requestedSupplier: string) => {
  const supplierMatch = requestedSupplier
    ? supplierNameMatchesEntry(entry, requestedSupplier)
      ? 2
      : 0
    : 1;
  const actualScore = dataTypeIsActual(entry) ? 1 : 0;
  const tlc = getSupplierTlc(entry) ?? 0;
  return supplierMatch * 10000 + actualScore * 1000 + tlc;
};

type MarketTrendPoint = {
  value: number;
  isForecast: boolean;
  formulaReference: string;
  indexType: string;
  estimationNote: string;
};

type TlcPoint = {
  value: number;
  isForecast: boolean;
  formulaReference: string;
  indexType: string;
  estimationNote: string;
};

type IndexPoint = {
  value: number;
  isForecast: boolean;
  indexType: string;
  rawLabel: string;
  formulaReference: string;
  formulaText: string;
  forecastTrainingMonths: string;
  backTestedMonths: string;
  predictedMonths: string;
  confidenceScore: number;
  confidenceLabel: string;
  estimationNote: string;
};

type ForecastWindow = {
  forecastTrainingMonths: string;
  backTestedMonths: string;
  predictedMonths: string;
};

const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rawRows = payload.filter((item: any) => item.value !== null && item.value !== undefined);
  const rowByKey = new Map<string, any>(
    rawRows.map((item: any) => [String(item.dataKey), item])
  );

  const rows = rawRows.filter((item: any) => {
    const key = String(item.dataKey);
    let actualKey: string | null = null;

    if (key === "supplierForecast") actualKey = "supplierActual";
    else if (key.endsWith("_forecast")) actualKey = key.replace(/_forecast$/, "_actual");

    if (!actualKey) return true;

    const actualItem = rowByKey.get(actualKey);
    if (!actualItem) return true;

    const forecastValue = Number(item.value);
    const actualValue = Number(actualItem.value);

    return !Number.isFinite(forecastValue) ||
      !Number.isFinite(actualValue) ||
      Math.abs(forecastValue - actualValue) > 0.0001;
  });

  if (!rows.length) return null;

  return (
    <div className="pet-tooltip px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">{label}</p>
      <div className="space-y-3">
        {rows.map((item: any) => {
          const meta = item.payload?.[`${item.dataKey}Meta`] as TlcPoint | undefined;
          return (
            <div key={item.dataKey} className="space-y-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-5 text-sm">
                <span className="font-semibold" style={{ color: item.color }}>
                  {item.name}
                </span>
                <span className="font-bold text-foreground">${formatAmount(item.value)}/MT</span>
              </div>
              {meta ? (
                <div className="rounded-md bg-secondary px-2.5 py-2 text-[11px] leading-relaxed text-foreground">
                  <p>
                    <span className="font-semibold text-foreground">Index used:</span>{" "}
                    {meta.indexType || "Not specified"}
                  </p>
                  {meta.formulaReference ? (
                    <>
                      <p>
                        <span className="font-semibold text-foreground">TLC formula:</span>{" "}
                        {meta.formulaReference}
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">Value:</span>{" "}
                        ${formatAmount(item.value)}/MT
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
          </div>
    </div>
  );
};

const IndexForecastTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rawRows = payload.filter((item: any) => item.value !== null && item.value !== undefined);
  const rowByKey = new Map<string, any>(
    rawRows.map((item: any) => [String(item.dataKey), item])
  );

  const rows = rawRows.filter((item: any) => {
    const key = String(item.dataKey);
    let actualKey: string | null = null;

    if (key === "supplierIndexForecast") actualKey = "supplierIndexActual";
    else if (key.endsWith("_forecast")) actualKey = key.replace(/_forecast$/, "_actual");

    if (!actualKey) return true;

    const actualItem = rowByKey.get(actualKey);
    if (!actualItem) return true;

    const forecastValue = Number(item.value);
    const actualValue = Number(actualItem.value);

    return !Number.isFinite(forecastValue) ||
      !Number.isFinite(actualValue) ||
      Math.abs(forecastValue - actualValue) > 0.0001;
  });

  if (!rows.length) return null;

  return (
    <div className="pet-tooltip px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">{label}</p>
      <div className="space-y-3">
        {rows.map((item: any) => {
          const meta = item.payload?.[`${item.dataKey}Meta`] as IndexPoint | undefined;
          return (
            <div key={item.dataKey} className="space-y-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-5 text-sm">
                <span className="font-semibold" style={{ color: item.color }}>
                  {item.name}
                </span>
                <span className="font-bold text-foreground">${formatAmount(item.value)}/MT</span>
              </div>
              <div className="rounded-md bg-secondary px-2.5 py-2 text-[11px] leading-relaxed text-foreground">
                <p>
                  <span className="font-semibold text-foreground">Index used:</span>{" "}
                  {meta?.indexType || "Not specified"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TrendsPage: React.FC<TrendsPageProps> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDestination = destinationDisplayName(
    searchParams.get("destination") || data.destination || ""
  );
  const selectedSourceCountry =
    searchParams.get("source") || data.countries[0]?.country || "";
  const requestedSupplier = searchParams.get("supplier") ?? "";
  const isBrazilDestination = normalize(selectedDestination) === "brazil";
  const [selectedMarketCountries, setSelectedMarketCountries] = useState<string[]>([]);
  const [marketResearchTrendRows, setMarketResearchTrendRows] = useState<
    MarketResearchTrendEntry[]
  >(data.marketResearchTrends ?? []);

  const destinationOptions = useMemo(() => {
    const options = new Set<string>(
      (data.availableDestinations ?? []).map(destinationDisplayName)
    );
    if (data.destination) options.add(destinationDisplayName(data.destination));
    data.vendorBreakdowns.forEach((entry) => {
      if (entry.destination) options.add(destinationDisplayName(entry.destination));
    });
    return Array.from(options)
      .filter((destination) => destination !== COMBINED_EL_SALVADOR_HONDURAS)
      .sort((a, b) => a.localeCompare(b));
  }, [data.availableDestinations, data.destination, data.vendorBreakdowns]);

  useEffect(() => {
    const url = createApiUrl("/market-research-trends");
    url.searchParams.set("destination", selectedDestination);
    url.searchParams.set("year", "2026");

    fetch(url.toString())
      .then((response) => response.json())
      .then((payload: { rows?: MarketResearchTrendEntry[] }) => {
        setMarketResearchTrendRows(payload.rows ?? []);
      })
      .catch(() => {
        setMarketResearchTrendRows(data.marketResearchTrends ?? []);
      });
  }, [data.marketResearchTrends, selectedDestination]);

  const marketTrendRowsForDestination = useMemo(
    () =>
      marketResearchTrendRows.filter(
        (entry) =>
            destinationMatchKey(entry.destination) === destinationMatchKey(selectedDestination) &&
          Number(entry.year) === 2026 &&
          parseNumber(entry.amount) !== null
      ),
    [marketResearchTrendRows, selectedDestination]
  );

  const marketCountryOptions = useMemo(
    () => {
      return Array.from(
        new Set(
          marketTrendRowsForDestination
            .map((entry) => entry.sourceCountry)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
    },
    [marketTrendRowsForDestination]
  );

  const marketCountryOptionsKey = marketCountryOptions.join("|");

  useEffect(() => {
    setSelectedMarketCountries((current) => {
      const validCurrent = current.filter((country) => marketCountryOptions.includes(country));
      if (validCurrent.length) return validCurrent;
      if (selectedSourceCountry && marketCountryOptions.includes(selectedSourceCountry)) {
        return [selectedSourceCountry];
      }
      return marketCountryOptions.slice(0, 1);
    });
  }, [marketCountryOptions, marketCountryOptionsKey, selectedSourceCountry]);

  const supplierEntriesForSource = useMemo(
    () =>
      data.vendorBreakdowns.filter(
        (entry) =>
          destinationMatchKey(entry.destination) === destinationMatchKey(selectedDestination) &&
          entry.sourceCountry === selectedSourceCountry &&
          Number(entry.year) === 2026
      ),
    [data.vendorBreakdowns, selectedDestination, selectedSourceCountry]
  );

  const supplierOptions = useMemo(() => {
    const options = new Map<string, string>();
    supplierEntriesForSource.forEach((entry) => {
      const name = entrySupplierName(entry);
      if (!name) return;
      options.set(normalize(name), name);
    });

    return Array.from(options.values()).sort((a, b) => {
      const aAmcor = normalize(a).startsWith("amcor") ? 0 : 1;
      const bAmcor = normalize(b).startsWith("amcor") ? 0 : 1;
      if (aAmcor !== bAmcor) return aAmcor - bAmcor;
      return a.localeCompare(b);
    });
  }, [supplierEntriesForSource]);

  const supplierOptionsKey = supplierOptions.join("|");

  const supplierName = useMemo(() => {
    const destinationFallback = fallbackSupplierNameForDestination(selectedDestination);
    if (normalize(selectedDestination) === "argentina" && destinationFallback) {
      return destinationFallback;
    }

    if (requestedSupplier) {
      const requestedEntry = supplierEntriesForSource.find((entry) =>
        supplierNameMatchesEntry(entry, requestedSupplier)
      );
      if (requestedEntry) return entrySupplierName(requestedEntry);
    }
    return entrySupplierName(
      [...supplierEntriesForSource].sort((a, b) =>
        entrySupplierName(a).localeCompare(entrySupplierName(b))
      )[0]
    );
  }, [requestedSupplier, supplierEntriesForSource]);

  useEffect(() => {
    if (!isBrazilDestination || !supplierOptions.length) return;

    const requestedIsValid =
      requestedSupplier &&
      supplierEntriesForSource.some((entry) =>
        supplierNameMatchesEntry(entry, requestedSupplier)
      );
    const nextSupplier = requestedIsValid ? supplierName : supplierOptions[0];
    if (!nextSupplier || requestedSupplier === nextSupplier) return;

    const next = new URLSearchParams(searchParams);
    next.set("supplier", nextSupplier);
    setSearchParams(next, { replace: true });
  }, [
    isBrazilDestination,
    requestedSupplier,
    searchParams,
    setSearchParams,
    supplierEntriesForSource,
    supplierName,
    supplierOptions,
    supplierOptionsKey,
  ]);

  const supplierEntriesByMonth = useMemo(() => {
    const monthMap = new Map<number, VendorBreakdownEntry>();
    MONTHS.forEach((_, index) => {
      const candidates = supplierEntriesForSource.filter((entry) => monthIndex(entry.month) === index);
      if (!candidates.length) return;
      const selected = [...candidates].sort(
        (a, b) => supplierEntryScore(b, supplierName) - supplierEntryScore(a, supplierName)
      )[0];
      monthMap.set(index, selected);
    });
    return monthMap;
  }, [supplierEntriesForSource, supplierName]);

  const marketValuesByCountryAndMonth = useMemo(() => {
    const map = new Map<string, Map<number, MarketTrendPoint>>();

    const setPoint = (entry: MarketResearchTrendEntry) => {
      const monthIdx = monthIndex(entry.month);
      const value = parseNumber(entry.amount);
      if (monthIdx < 0 || value === null) return;
      const sourceMap = map.get(entry.sourceCountry) ?? new Map<number, MarketTrendPoint>();
      const isForecast = dataTypeIsForecast(entry);
      sourceMap.set(monthIdx, {
        value,
        isForecast,
        formulaReference: entry.formulaReference || "",
        indexType:
          (isForecast ? entry.forecastResinIndexType : entry.resinIndexType) ||
          entry.resinIndexType ||
          entry.forecastResinIndexType ||
          "Market Research resin index",
        estimationNote: isForecast
          ? "Market Research TLC forecast is calculated from the forecast resin index and the required freight, insurance, duty/import tax, and fee components in the MR TLC formula."
          : "Market Research TLC actual comes from the standardized MR total landed cost row for the selected country and month.",
      });
      map.set(entry.sourceCountry, sourceMap);
    };

    marketTrendRowsForDestination.forEach(setPoint);

    return map;
  }, [marketTrendRowsForDestination]);

  const marketIndexValuesByCountryAndMonth = useMemo(() => {
    const map = new Map<string, Map<number, IndexPoint>>();

    marketTrendRowsForDestination.forEach((entry) => {
      const monthIdx = monthIndex(entry.month);
      const value = parseNumber(entry.resinIndexAmount);
      if (monthIdx < 0 || value === null) return;
      const isForecast = dataTypeIsForecast(entry);
      const sourceMap = map.get(entry.sourceCountry) ?? new Map<number, IndexPoint>();
      const indexType =
        (isForecast ? entry.forecastResinIndexType : entry.resinIndexType) ||
        entry.resinIndexType ||
        entry.forecastResinIndexType ||
        "Market Research resin index";
      sourceMap.set(monthIdx, {
        value,
        isForecast,
        indexType,
        rawLabel: entry.indexRawLabel || "PET resin cost (FOB)",
        formulaReference: entry.formulaReference || "",
        formulaText: isForecast
          ? "Growth Factor = AVERAGE(actual current-year index / actual prior-year same-month index) over the forecast training months. Forecast Index_m = MIN(MAX(prior-year same-month index_m * Growth Factor, Prior Month * 0.92), Prior Month * 1.08)."
          : `Actual index = ${entry.indexRawLabel || "PET resin cost (FOB)"} value from the standardized MR row for the selected market country and month.`,
        forecastTrainingMonths: "Not available",
        backTestedMonths: "Not available",
        predictedMonths: "Not available",
        confidenceScore: isForecast ? 74 : 96,
        confidenceLabel: isForecast ? "Forecast accuracy" : "Actual source confidence",
        estimationNote: isForecast
          ? "Index-only estimate sourced from the MR forecast index series."
          : "Direct source index row from the standardized MR data model.",
      });
      map.set(entry.sourceCountry, sourceMap);
    });

    return map;
  }, [marketTrendRowsForDestination]);

  const supplierIndexForecastWindow = useMemo(
    () => forecastWindowFromEntries(supplierEntriesByMonth),
    [supplierEntriesByMonth]
  );

  const marketIndexForecastWindows = useMemo(() => {
    const map = new Map<string, ForecastWindow>();
    marketIndexValuesByCountryAndMonth.forEach((pointsByMonth, country) => {
      map.set(country, forecastWindowFromPoints(pointsByMonth));
    });
    return map;
  }, [marketIndexValuesByCountryAndMonth]);

  const chartData = useMemo(
    () =>
      MONTHS.map((month, index) => {
        const entry = supplierEntriesByMonth.get(index);
        const nextEntry = supplierEntriesByMonth.get(index + 1);
        const supplierPoint = entry ? supplierTlcPoint(entry) : null;
        const isForecast = dataTypeIsForecast(entry);
        const nextIsForecast = dataTypeIsForecast(nextEntry);
        const row: Record<string, string | number | null | TlcPoint> = {
          period: `${month.slice(0, 3)} 2026`,
          supplierActual: supplierPoint && !isForecast ? supplierPoint.value : null,
          supplierForecast:
            supplierPoint && (isForecast || nextIsForecast) ? supplierPoint.value : null,
        };

        if (supplierPoint && !isForecast) row.supplierActualMeta = supplierPoint;
        if (supplierPoint && (isForecast || nextIsForecast)) {
          row.supplierForecastMeta = supplierPoint;
        }

        selectedMarketCountries.forEach((country, countryIndex) => {
          const point = marketValuesByCountryAndMonth.get(country)?.get(index);
          const nextPoint = marketValuesByCountryAndMonth.get(country)?.get(index + 1);
          const actualKey = `market_${countryIndex}_actual`;
          const forecastKey = `market_${countryIndex}_forecast`;
          row[actualKey] = point && !point.isForecast ? point.value : null;
          row[forecastKey] = point && (point.isForecast || nextPoint?.isForecast) ? point.value : null;
          if (point && !point.isForecast) row[`${actualKey}Meta`] = point;
          if (point && (point.isForecast || nextPoint?.isForecast)) {
            row[`${forecastKey}Meta`] = point;
          }
        });

        return row;
      }),
    [marketValuesByCountryAndMonth, selectedMarketCountries, supplierEntriesByMonth]
  );

  const indexChartData = useMemo(
    () =>
      MONTHS.map((month, index) => {
        const entry = supplierEntriesByMonth.get(index);
        const nextEntry = supplierEntriesByMonth.get(index + 1);
        const supplierPoint = entry ? supplierIndexPoint(entry) : null;
        const isForecast = dataTypeIsForecast(entry);
        const nextIsForecast = dataTypeIsForecast(nextEntry);
        const row: Record<string, string | number | null | IndexPoint> = {
          period: `${month.slice(0, 3)} 2026`,
          supplierIndexActual: supplierPoint && !isForecast ? supplierPoint.value : null,
          supplierIndexForecast:
            supplierPoint && (isForecast || nextIsForecast) ? supplierPoint.value : null,
        };

        if (supplierPoint && !isForecast) {
          row.supplierIndexActualMeta = withForecastWindow(
            supplierPoint,
            supplierIndexForecastWindow
          );
        }
        if (supplierPoint && (isForecast || nextIsForecast)) {
          row.supplierIndexForecastMeta = withForecastWindow(
            supplierPoint,
            supplierIndexForecastWindow
          );
        }

        selectedMarketCountries.forEach((country, countryIndex) => {
          const point = marketIndexValuesByCountryAndMonth.get(country)?.get(index);
          const nextPoint = marketIndexValuesByCountryAndMonth.get(country)?.get(index + 1);
          const actualKey = `marketIndex_${countryIndex}_actual`;
          const forecastKey = `marketIndex_${countryIndex}_forecast`;
          row[actualKey] = point && !point.isForecast ? point.value : null;
          row[forecastKey] = point && (point.isForecast || nextPoint?.isForecast) ? point.value : null;
          const marketWindow = marketIndexForecastWindows.get(country) ?? {
            forecastTrainingMonths: "Not available",
            backTestedMonths: "Not available",
            predictedMonths: "Not available",
          };
          if (point && !point.isForecast) {
            row[`${actualKey}Meta`] = withForecastWindow(point, marketWindow);
          }
          if (point && (point.isForecast || nextPoint?.isForecast)) {
            row[`${forecastKey}Meta`] = withForecastWindow(point, marketWindow);
          }
        });

        return row;
      }),
    [
      marketIndexForecastWindows,
      marketIndexValuesByCountryAndMonth,
      selectedMarketCountries,
      supplierEntriesByMonth,
      supplierIndexForecastWindow,
    ]
  );

  const hasIndexChartData = useMemo(
    () =>
      indexChartData.some((row) =>
        Object.entries(row).some(
          ([key, value]) => key !== "period" && !key.endsWith("Meta") && value !== null
        )
      ),
    [indexChartData]
  );

  const supplierIndexNames = useMemo(() => {
    const names = new Set<string>();
    supplierEntriesByMonth.forEach((entry) => {
      const point = supplierIndexPoint(entry);
      if (point?.indexType) names.add(point.indexType);
    });
    return Array.from(names);
  }, [supplierEntriesByMonth]);

  const marketIndexNames = useMemo(() => {
    const names = new Set<string>();
    selectedMarketCountries.forEach((country) => {
      marketIndexValuesByCountryAndMonth.get(country)?.forEach((point) => {
        if (point.indexType) names.add(point.indexType);
      });
    });
    return Array.from(names);
  }, [marketIndexValuesByCountryAndMonth, selectedMarketCountries]);

  const marketIndexDisplayName = useMemo(() => {
    if (!marketIndexNames.length) return "No MR index available";
    return marketIndexNames.join(" | ");
  }, [marketIndexNames]);

  const supplierIndexDisplayName = useMemo(() => {
    const fallback = "No supplier index available";
    const points = MONTHS.map((_, index) => supplierEntriesByMonth.get(index))
      .filter((entry): entry is VendorBreakdownEntry => Boolean(entry))
      .map((entry) => supplierIndexPoint(entry))
      .filter((point): point is IndexPoint => Boolean(point?.indexType));

    if (!points.length) {
      return fallback;
    }

    const latestForecastPoint = [...points].reverse().find((point) => point.isForecast);
    const latestActualPoint = [...points].reverse().find((point) => !point.isForecast);
    const chosen =
      latestForecastPoint?.indexType ||
      latestActualPoint?.indexType ||
      points[0]?.indexType ||
      "";

    const normalized = normalizeIndexDisplayLabel(chosen);
    return normalized || fallback;
  }, [supplierEntriesByMonth]);

  const marketIndexDisplayNameByCountry = useMemo(() => {
    const labels = new Map<string, string>();
    selectedMarketCountries.forEach((country) => {
      const points = Array.from(
        marketIndexValuesByCountryAndMonth.get(country)?.values() ?? []
      );
      if (!points.length) {
        labels.set(country, marketIndexDisplayName);
        return;
      }

      const latestForecastPoint = [...points].reverse().find((point) => point.isForecast);
      const latestActualPoint = [...points].reverse().find((point) => !point.isForecast);
      const chosen =
        latestForecastPoint?.indexType ||
        latestActualPoint?.indexType ||
        points[0]?.indexType ||
        "";

      const normalized = normalizeIndexDisplayLabel(chosen);
      labels.set(country, normalized || marketIndexDisplayName);
    });
    return labels;
  }, [
    marketIndexDisplayName,
    marketIndexValuesByCountryAndMonth,
    selectedMarketCountries,
  ]);

  const supplierMapeScore = useMemo(() => {
    for (const indexName of supplierIndexNames) {
      const value = supplierMapeForIndex(indexName);
      if (value) return value;
    }
    return null;
  }, [supplierIndexNames]);

  const marketMapeEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: Array<{ market: string; value: string }> = [];
    selectedMarketCountries.forEach((country) => {
      const key = mapeKeyForSelection(country);
      if (seen.has(key)) return;
      seen.add(key);
      const value = mapeScoreByKey.get(key);
      if (!value) return;
      const marketLabel =
        RESIN_INDEX_MAPE_SCORES.find((item) => normalize(item.market) === key)?.market ?? country;
      entries.push({ market: marketLabel, value });
    });
    return entries;
  }, [selectedMarketCountries]);

  const isIcisOrIhsIndexContext = useMemo(() => {
    const supplierKeys = supplierIndexNames.map((name) => normalize(name));
    return supplierKeys.some(
      (name) => name.includes("icis fob china") || name.includes("ihs")
    );
  }, [supplierIndexNames]);

  const isMrIcisFobChinaContext = useMemo(() => {
    const mrKeys = marketIndexNames.map((name) => normalize(name));
    return mrKeys.some((name) => name.includes("icis fob china"));
  }, [marketIndexNames]);

  const isSupplierIcisFobChinaContext = useMemo(() => {
    const supplierKeys = supplierIndexNames.map((name) => normalize(name));
    return supplierKeys.some((name) => name.includes("icis fob china"));
  }, [supplierIndexNames]);

  const showIcisOnlyCallout =
    isSupplierIcisFobChinaContext && isMrIcisFobChinaContext;

  const showSupplierMape = !isIcisOrIhsIndexContext;
  const showMrMape = !isMrIcisFobChinaContext;

  const toggleMarketCountry = (country: string) => {
    setSelectedMarketCountries((current) =>
      current.includes(country)
        ? current.filter((item) => item !== country)
        : [...current, country]
    );
  };

  const allMarketsSelected =
    marketCountryOptions.length > 0 &&
    marketCountryOptions.every((country) => selectedMarketCountries.includes(country));
  const supplierLegendName = supplierName || "Supplier";
  const supplierLegendNameWithDestination = `Supplier - ${supplierLegendName}${
    selectedDestination ? ` ${selectedDestination}` : ""
  }`;
  const marketLegendNameForTlc = (country: string) => `MR-${country.toUpperCase()}`;

  return (
    <div className="pet-page-bg min-h-screen px-6 py-6 max-sm:px-4">
      <RevealOnScroll>
        <section className="mx-auto w-full max-w-[1400px] space-y-4">
          <Card className="border-primary/10 bg-white shadow-lg">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Supplier vPET Benchmark and Market Scenario Outlook</CardTitle>
                  <CardDescription className="mt-1">
                    {selectedDestination || "Destination"} {supplierName || "supplier"} vPET for {selectedSourceCountry || "selected source"} across 2026.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[220px]">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      Destination
                    </label>
                    <select
                      value={selectedDestination}
                      onChange={(event) => {
                        const next = new URLSearchParams(searchParams);
                        next.set("destination", event.target.value);
                        if (normalize(event.target.value) !== "brazil") {
                          next.delete("supplier");
                        }
                        setSearchParams(next);
                      }}
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      {destinationOptions.map((destination) => (
                        <option key={destination} value={destination}>
                          {destination}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isBrazilDestination && supplierOptions.length > 1 ? (
                    <div className="min-w-[220px]">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground">
                        Supplier / Location
                      </label>
                      <select
                        value={supplierName}
                        onChange={(event) => {
                          const next = new URLSearchParams(searchParams);
                          next.set("supplier", event.target.value);
                          setSearchParams(next);
                        }}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                      >
                        {supplierOptions.map((supplier) => (
                          <option key={supplier} value={supplier}>
                            {supplier}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Supplier Source
                  </p>
                  <p className="mt-1 text-base font-extrabold text-primary">
                    {selectedSourceCountry || "No source selected"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Supplier
                  </p>
                  <p className="mt-1 truncate text-base font-extrabold text-foreground">
                    {supplierName || "No supplier"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    2026 Actual / Forecast
                  </p>
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {latestActual?.value !== null && latestActual?.value !== undefined
                      ? `$${formatAmount(latestActual.value)}/MT`
                      : "$0/MT"}
                    <span className="ml-2 text-xs font-semibold text-muted-foreground">
                      {forecastRowsCount} forecast months
                    </span>
                  </p>
                </div>
              </div> */}

              <div className="-mt-1 rounded-md border border-border/50 bg-background/20 px-2.5 py-1.5">
                <p className="text-[11px] font-medium text-foreground">
                  Estimation are based on Resin Indexes and freight all other constants remains the same
                </p>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  Market Research Countries
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMarketCountries(marketCountryOptions)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      allMarketsSelected
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card/40 text-foreground hover:text-foreground"
                    }`}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMarketCountries([])}
                    className="rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs font-medium text-foreground transition hover:text-foreground"
                  >
                    Clear
                  </button>
                  {marketCountryOptions.map((country) => (
                    (() => {
                      const countryIndex = marketCountryOptions.indexOf(country);
                      const color = marketSeriesColor(country, countryIndex);
                      const selected = selectedMarketCountries.includes(country);
                      return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => toggleMarketCountry(country)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                        selected
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border bg-card/40 text-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      {country}
                    </button>
                      );
                    })()
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <div className="h-[460px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: "#5a5a5a" }}
                        tickFormatter={shortMonthTick}
                        interval={0}
                        minTickGap={8}
                        tickMargin={8}
                        padding={{ left: 8, right: 24 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#5a5a5a" }}
                        tickLine={false}
                        axisLine={false}
                        width={54}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        width={190}
                        wrapperStyle={{
                          color: "#1a1a1a",
                          fontSize: "12px",
                          lineHeight: "20px",
                          paddingLeft: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="supplierActual"
                        name={supplierLegendNameWithDestination}
                        stroke={SUPPLIER_ACTUAL_COLOR}
                        strokeWidth={3}
                        dot={{ r: 3, fill: SUPPLIER_ACTUAL_COLOR }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="supplierForecast"
                        name={`Fcst - ${supplierLegendName}`}
                        stroke={SUPPLIER_FORECAST_COLOR}
                        strokeWidth={3}
                        strokeDasharray="7 5"
                        dot={{ r: 3, fill: SUPPLIER_FORECAST_COLOR }}
                        connectNulls
                        legendType="none"
                      />
                      {selectedMarketCountries.map((country, index) => (
                        <React.Fragment key={country}>
                          <Line
                            type="monotone"
                            dataKey={`market_${index}_actual`}
                            name={marketLegendNameForTlc(country)}
                            stroke={marketSeriesColor(country, index)}
                            strokeWidth={2.6}
                            dot={{ r: 2.8, fill: marketSeriesColor(country, index) }}
                            connectNulls
                            legendType="none"
                          />
                          <Line
                            type="monotone"
                            dataKey={`market_${index}_forecast`}
                            name={`MR Fcst - ${shortMarketName(country)}`}
                            stroke={marketSeriesColor(country, index)}
                            strokeWidth={2.6}
                            strokeDasharray="5 5"
                            dot={{ r: 2.8, fill: marketSeriesColor(country, index) }}
                            connectNulls
                            legendType="none"
                          />
                        </React.Fragment>
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-card/40 p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-foreground">Index Actual and Forecast used for TLC</p>
                    <p className="mt-1 text-xs text-foreground">
                      Supplier and Market Research resin index values aligned to the TLC chart above.
                    </p>
                  </div>
                  <div className="grid min-w-[280px] gap-2 text-xs md:min-w-[520px] md:grid-cols-2">
                    <div className="rounded-md border border-border/70 bg-background/35 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                        Supplier index used
                      </p>
                      <p className="mt-1 line-clamp-2 font-semibold text-foreground">
                        {supplierIndexDisplayName}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/35 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                        MR index used
                      </p>
                      <p className="mt-1 line-clamp-2 font-semibold text-foreground">
                        {marketIndexDisplayName}
                      </p>
                    </div>
                    {!showIcisOnlyCallout ? (
                      <>
                        <div className="rounded-md border border-border/50 bg-background/20 px-2.5 py-1.5 md:col-span-1">
                          <p className="text-[9px] font-medium uppercase tracking-wide text-foreground/80">
                            Training data
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-foreground">
                            {MR_INDEX_TRAINING_WINDOW}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/50 bg-background/20 px-2.5 py-1.5 md:col-span-1">
                          <p className="text-[9px] font-medium uppercase tracking-wide text-foreground/80">
                            Predicted data
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-foreground">
                            {MR_INDEX_PREDICTED_WINDOW}
                          </p>
                        </div>
                      </>
                    ) : null}
                    {showIcisOnlyCallout ? (
                      <div className="rounded-md border border-border/50 bg-background/20 px-2.5 py-1.5 md:col-span-2">
                        <p className="text-[11px] font-medium text-foreground">
                          ICIS estimates
                        </p>
                      </div>
                    ) : null}
                    {showSupplierMape || showMrMape ? (
                      <div className="rounded-md border border-border/60 bg-card/40 px-2.5 py-2 md:col-span-2">
                        <div className="grid gap-2 md:grid-cols-2">
                          {showSupplierMape ? (
                            <div>
                              <p className="text-[9px] font-medium uppercase tracking-wide text-foreground/80">
                                Supplier MAPE score
                              </p>
                              <p className="mt-0.5 text-[11px] font-semibold text-foreground">
                                {supplierMapeScore ?? "Not available"}
                              </p>
                            </div>
                          ) : null}
                          {showMrMape ? (
                            <div>
                              <p className="text-[9px] font-medium uppercase tracking-wide text-foreground/80">
                                MR MAPE score
                              </p>
                              {marketMapeEntries.length ? (
                                <div className="mt-0.5 space-y-0.5 text-[11px] font-semibold text-foreground">
                                  {marketMapeEntries.map((entry) => (
                                    <p key={entry.market}>{entry.market}: {entry.value}</p>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-0.5 text-[11px] font-semibold text-foreground">Not available</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                {hasIndexChartData ? (
                  <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={indexChartData} margin={{ top: 10, right: 18, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 11, fill: "#5a5a5a" }}
                          tickFormatter={shortMonthTick}
                          interval={0}
                          minTickGap={8}
                          tickMargin={8}
                          padding={{ left: 8, right: 24 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#5a5a5a" }}
                          tickLine={false}
                          axisLine={false}
                          width={54}
                        />
                        <Tooltip content={<IndexForecastTooltip />} />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          width={190}
                          wrapperStyle={{
                            color: "#1a1a1a",
                            fontSize: "12px",
                            lineHeight: "20px",
                            paddingLeft: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="supplierIndexActual"
                          name={`Supplier Index - ${supplierIndexDisplayName}`}
                          stroke={SUPPLIER_INDEX_COLOR}
                          strokeWidth={3}
                          dot={{ r: 3, fill: SUPPLIER_INDEX_COLOR }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="supplierIndexForecast"
                          name={`Fcst - ${supplierLegendName} Index`}
                          stroke={SUPPLIER_INDEX_FORECAST_COLOR}
                          strokeWidth={3}
                          strokeDasharray="7 5"
                          dot={{ r: 3, fill: SUPPLIER_INDEX_FORECAST_COLOR }}
                          connectNulls
                          legendType="none"
                        />
                        {selectedMarketCountries.map((country, index) => (
                          <React.Fragment key={`${country}-index`}>
                            <Line
                              type="monotone"
                              dataKey={`marketIndex_${index}_actual`}
                              name={`${marketIndexDisplayNameByCountry.get(country) ?? marketIndexDisplayName}`}
                              stroke={marketSeriesColor(country, index)}
                              strokeWidth={2.6}
                              dot={{ r: 2.8, fill: marketSeriesColor(country, index) }}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey={`marketIndex_${index}_forecast`}
                              name={`MR Fcst - ${shortMarketName(country)} Index`}
                              stroke={marketSeriesColor(country, index)}
                              strokeWidth={2.6}
                              strokeDasharray="5 5"
                              dot={{ r: 2.8, fill: marketSeriesColor(country, index) }}
                              connectNulls
                              legendType="none"
                            />
                          </React.Fragment>
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-foreground">
                    No resin index trend rows available for the current selection.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
        <div className="mx-auto w-full max-w-[1400px] mb-4 mt-4">
        <AIInsightPanel
          request={{
            page: "trends",
            destination: selectedDestination,
            year: "2026",
            marketResearchTrends: marketResearchTrendRows,
            vendorBreakdowns: data.vendorBreakdowns.filter(
              (e) =>
                destinationDisplayName(e.destination) === selectedDestination &&
                Number(e.year) === 2026
            ),
          }}
        />
      </div>
      </RevealOnScroll>
      
    </div>
  );
};

export default TrendsPage;
