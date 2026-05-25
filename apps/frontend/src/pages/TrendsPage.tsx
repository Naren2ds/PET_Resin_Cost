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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createApiUrl } from "../lib/api";

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
const DESTINATION_DISPLAY_ALIASES: Record<string, string> = {
  "El Salvador": "El Salvador and Honduras",
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

const normalize = (value: string | undefined) => (value ?? "").trim().toLowerCase();

const destinationDisplayName = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return DESTINATION_DISPLAY_ALIASES[trimmed] ?? trimmed;
};

const shortMarketName = (country: string) => MARKET_SHORT_NAMES[country] ?? country;

const marketSeriesColor = (country: string, index: number) =>
  MARKET_COUNTRY_COLORS[country] ?? MARKET_FALLBACK_COLORS[index % MARKET_FALLBACK_COLORS.length];

const shortSupplierName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "Supplier";
  const bracket = trimmed.match(/\(([^)]+)\)/);
  if (bracket?.[1]) return bracket[1].trim();
  const withoutLocation = trimmed.split(" - ")[0]?.trim() || trimmed;
  if (withoutLocation.length <= 14) return withoutLocation;
  return withoutLocation
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
};

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

const getSupplierTlc = (entry: VendorBreakdownEntry) => {
  const row = entry.rows.find((item) => normalize(item.label) === SUPPLIER_TLC_LABEL);
  return parseNumber(row?.amount);
};

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
    confidenceScore: isForecast ? 72 : 96,
    confidenceLabel: isForecast ? "Forecast confidence" : "Actual source confidence",
    estimationNote: isForecast
      ? "Supplier forecast uses the stated forecast index series from the supplier pipeline; non-index TLC assumptions are carried from the latest actual unless the pipeline provides updated assumptions."
      : "Supplier actual comes from the standardized supplier workbook row used in the TLC calculation.",
  };
};

const entrySupplierName = (entry: VendorBreakdownEntry | undefined) =>
  (entry?.supplierName ?? entry?.supplier ?? entry?.vendor ?? "").trim();

const namesMatch = (entryName: string, requestedName: string) => {
  const entry = normalize(entryName);
  const requested = normalize(requestedName);
  if (!entry || !requested) return false;
  return entry === requested || entry.includes(requested) || requested.includes(entry);
};

const dataTypeIsForecast = (entry: { dataType?: string } | undefined) =>
  normalize(entry?.dataType).includes("forecast");

const dataTypeIsActual = (entry: { dataType?: string } | undefined) =>
  normalize(entry?.dataType).includes("actual");

const supplierEntryScore = (entry: VendorBreakdownEntry, requestedSupplier: string) => {
  const supplierMatch = requestedSupplier
    ? namesMatch(entrySupplierName(entry), requestedSupplier)
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
};

type IndexPoint = {
  value: number;
  isForecast: boolean;
  indexType: string;
  rawLabel: string;
  formulaReference: string;
  confidenceScore: number;
  confidenceLabel: string;
  estimationNote: string;
};

const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item: any) => item.value !== null && item.value !== undefined);
  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-[#020817]/95 px-4 py-3 shadow-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <div className="space-y-1.5">
        {rows.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6 text-sm">
            <span className="font-medium" style={{ color: item.color }}>
              {item.name}
            </span>
            <span className="font-semibold text-slate-100">{formatAmount(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const confidenceColor = (score: number) => {
  if (score >= 90) return "#22C55E";
  if (score >= 70) return "#E6A817";
  return "#F97316";
};

const IndexForecastTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item: any) => item.value !== null && item.value !== undefined);
  if (!rows.length) return null;

  return (
    <div className="max-w-[360px] rounded-xl border border-primary/20 bg-[#020817]/95 px-4 py-3 shadow-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <div className="space-y-3">
        {rows.map((item: any) => {
          const meta = item.payload?.[`${item.dataKey}Meta`] as IndexPoint | undefined;
          const score = meta?.confidenceScore ?? 0;
          return (
            <div key={item.dataKey} className="space-y-1.5 border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-5 text-sm">
                <span className="font-semibold" style={{ color: item.color }}>
                  {item.name}
                </span>
                <span className="font-bold text-slate-100">${formatAmount(item.value)}/MT</span>
              </div>
              <div className="rounded-md bg-white/5 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300">
                <p>
                  <span className="font-semibold text-slate-100">Index used:</span>{" "}
                  {meta?.indexType || "Not specified"}
                </p>
                <p>
                  <span className="font-semibold text-slate-100">Source row:</span>{" "}
                  {meta?.rawLabel || "Resin Index"}
                </p>
                <p>
                  <span className="font-semibold text-slate-100">Estimation:</span>{" "}
                  {meta?.estimationNote || "Source value from standardized model."}
                </p>
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider">
                    <span>{meta?.confidenceLabel || "Confidence"}</span>
                    <span>{score}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${score}%`, backgroundColor: confidenceColor(score) }}
                    />
                  </div>
                </div>
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
  const [selectedMarketCountries, setSelectedMarketCountries] = useState<string[]>([]);
  const [marketResearchTrendRows, setMarketResearchTrendRows] = useState<
    MarketResearchTrendEntry[]
  >(data.marketResearchTrends ?? []);

  const destinationOptions = useMemo(() => {
    const options = new Set<string>();
    if (data.destination) options.add(destinationDisplayName(data.destination));
    data.vendorBreakdowns.forEach((entry) => {
      if (entry.destination) options.add(destinationDisplayName(entry.destination));
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [data.destination, data.vendorBreakdowns]);

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
          destinationDisplayName(entry.destination) === selectedDestination &&
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
          entry.destination === selectedDestination &&
          entry.sourceCountry === selectedSourceCountry &&
          Number(entry.year) === 2026
      ),
    [data.vendorBreakdowns, selectedDestination, selectedSourceCountry]
  );

  const supplierName = useMemo(() => {
    if (requestedSupplier) {
      const requestedEntry = supplierEntriesForSource.find((entry) =>
        namesMatch(entrySupplierName(entry), requestedSupplier)
      );
      if (requestedEntry) return entrySupplierName(requestedEntry);
    }
    return entrySupplierName(
      [...supplierEntriesForSource].sort((a, b) =>
        entrySupplierName(a).localeCompare(entrySupplierName(b))
      )[0]
    );
  }, [requestedSupplier, supplierEntriesForSource]);

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
      sourceMap.set(monthIdx, {
        value,
        isForecast: dataTypeIsForecast(entry),
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
      sourceMap.set(monthIdx, {
        value,
        isForecast,
        indexType:
          (isForecast ? entry.forecastResinIndexType : entry.resinIndexType) ||
          entry.resinIndexType ||
          entry.forecastResinIndexType ||
          "Market Research resin index",
        rawLabel: entry.indexRawLabel || "PET resin cost (FOB)",
        formulaReference: entry.formulaReference || "",
        confidenceScore: isForecast ? 74 : 96,
        confidenceLabel: isForecast ? "Forecast confidence" : "Actual source confidence",
        estimationNote: isForecast
          ? "Market Research forecast uses the stated forecast index series from the MR data model and applies the TLC formula components for the selected country."
          : "Market Research actual comes from the standardized MR resin index row used in the TLC calculation.",
      });
      map.set(entry.sourceCountry, sourceMap);
    });

    return map;
  }, [marketTrendRowsForDestination]);

  const chartData = useMemo(
    () =>
      MONTHS.map((month, index) => {
        const entry = supplierEntriesByMonth.get(index);
        const nextEntry = supplierEntriesByMonth.get(index + 1);
        const supplierValue = entry ? getSupplierTlc(entry) : null;
        const isForecast = dataTypeIsForecast(entry);
        const nextIsForecast = dataTypeIsForecast(nextEntry);
        const row: Record<string, string | number | null> = {
          period: `${month.slice(0, 3)} 2026`,
          supplierActual: !isForecast ? supplierValue : null,
          supplierForecast: isForecast || nextIsForecast ? supplierValue : null,
        };

        selectedMarketCountries.forEach((country, countryIndex) => {
          const point = marketValuesByCountryAndMonth.get(country)?.get(index);
          const nextPoint = marketValuesByCountryAndMonth.get(country)?.get(index + 1);
          row[`market_${countryIndex}_actual`] =
            point && !point.isForecast ? point.value : null;
          row[`market_${countryIndex}_forecast`] =
            point && (point.isForecast || nextPoint?.isForecast) ? point.value : null;
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

        if (supplierPoint && !isForecast) row.supplierIndexActualMeta = supplierPoint;
        if (supplierPoint && (isForecast || nextIsForecast)) {
          row.supplierIndexForecastMeta = supplierPoint;
        }

        selectedMarketCountries.forEach((country, countryIndex) => {
          const point = marketIndexValuesByCountryAndMonth.get(country)?.get(index);
          const nextPoint = marketIndexValuesByCountryAndMonth.get(country)?.get(index + 1);
          const actualKey = `marketIndex_${countryIndex}_actual`;
          const forecastKey = `marketIndex_${countryIndex}_forecast`;
          row[actualKey] = point && !point.isForecast ? point.value : null;
          row[forecastKey] = point && (point.isForecast || nextPoint?.isForecast) ? point.value : null;
          if (point && !point.isForecast) row[`${actualKey}Meta`] = point;
          if (point && (point.isForecast || nextPoint?.isForecast)) {
            row[`${forecastKey}Meta`] = point;
          }
        });

        return row;
      }),
    [marketIndexValuesByCountryAndMonth, selectedMarketCountries, supplierEntriesByMonth]
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

  const latestActual = useMemo(() => {
    const actualRows = MONTHS.map((_, index) => supplierEntriesByMonth.get(index))
      .filter((entry): entry is VendorBreakdownEntry => Boolean(entry) && !dataTypeIsForecast(entry));
    const latest = actualRows[actualRows.length - 1];
    return latest ? { entry: latest, value: getSupplierTlc(latest) } : null;
  }, [supplierEntriesByMonth]);

  const forecastRowsCount = useMemo(
    () =>
      MONTHS.map((_, index) => supplierEntriesByMonth.get(index)).filter((entry) =>
        dataTypeIsForecast(entry)
      ).length,
    [supplierEntriesByMonth]
  );

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
  const supplierLegendName = shortSupplierName(supplierName);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card px-6 py-6 max-sm:px-4">
      <RevealOnScroll>
        <section className="mx-auto w-full max-w-[1400px] space-y-4">
          <Card className="border-primary/10 bg-card/80 shadow-lg">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Supplier Actual and Forecast vs Market Research TLC</CardTitle>
                  <CardDescription className="mt-1">
                    {selectedDestination || "Destination"} supplier TLC for {selectedSourceCountry || "selected source"} across 2026.
                  </CardDescription>
                </div>
                <div className="min-w-[220px]">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Destination
                  </label>
                  <select
                    value={selectedDestination}
                    onChange={(event) => {
                      const next = new URLSearchParams(searchParams);
                      next.set("destination", event.target.value);
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
              </div>

              <div className="grid gap-3 md:grid-cols-3">
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
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Market Research Countries
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMarketCountries(marketCountryOptions)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      allMarketsSelected
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMarketCountries([])}
                    className="rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
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
                          : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
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
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: "#a1a1aa" }}
                        tickFormatter={shortMonthTick}
                        interval={0}
                        minTickGap={8}
                        tickMargin={8}
                        padding={{ left: 8, right: 24 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#a1a1aa" }}
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
                          color: "#cbd5e1",
                          fontSize: "12px",
                          lineHeight: "20px",
                          paddingLeft: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="supplierActual"
                        name={supplierLegendName}
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
                            name={shortMarketName(country)}
                            stroke={marketSeriesColor(country, index)}
                            strokeWidth={2.6}
                            dot={{ r: 2.8, fill: marketSeriesColor(country, index) }}
                            connectNulls
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
                    <p className="text-sm font-bold text-foreground">Index Actual and Forecast used for TLC</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Supplier and Market Research resin index values aligned to the TLC chart above.
                    </p>
                  </div>
                  <div className="grid min-w-[280px] gap-2 text-xs md:min-w-[520px] md:grid-cols-2">
                    <div className="rounded-md border border-border/70 bg-background/35 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Supplier index used
                      </p>
                      <p className="mt-1 line-clamp-2 font-semibold text-foreground">
                        {supplierIndexNames.join(", ") || "No supplier index available"}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/35 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        MR index used
                      </p>
                      <p className="mt-1 line-clamp-2 font-semibold text-foreground">
                        {marketIndexNames.join(", ") || "No MR index available"}
                      </p>
                    </div>
                  </div>
                </div>
                {hasIndexChartData ? (
                  <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={indexChartData} margin={{ top: 10, right: 18, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 11, fill: "#a1a1aa" }}
                          tickFormatter={shortMonthTick}
                          interval={0}
                          minTickGap={8}
                          tickMargin={8}
                          padding={{ left: 8, right: 24 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#a1a1aa" }}
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
                            color: "#cbd5e1",
                            fontSize: "12px",
                            lineHeight: "20px",
                            paddingLeft: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="supplierIndexActual"
                          name={`${supplierLegendName} Index`}
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
                              name={`${shortMarketName(country)} Index`}
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
                  <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                    No resin index trend rows available for the current selection.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </RevealOnScroll>
    </div>
  );
};

export default TrendsPage;
