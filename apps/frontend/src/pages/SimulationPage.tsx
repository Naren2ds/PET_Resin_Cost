// import React, { useEffect, useMemo, useState } from "react";
// import { useSearchParams } from "react-router-dom";
// import {
//   CartesianGrid,
//   Legend,
//   Line,
//   LineChart,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";
// import type {
//   ApiResponse,
//   MarketResearchTrendEntry,
//   VendorBreakdownEntry,
// } from "../types";
// import { formatAmount } from "../types";
// import RevealOnScroll from "../components/RevealOnScroll";
// import AIInsightPanel from "../components/AIInsightPanel";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { createApiUrl } from "../lib/api";
// import {
//   supplierDisplayNameForEntry,
//   supplierNameMatchesEntry,
// } from "../lib/supplierDisplay";

// type SimulationPageProps = {
//   data: ApiResponse;
// };

// const MONTHS = [
//   "January",
//   "February",
//   "March",
//   "April",
//   "May",
//   "June",
//   "July",
//   "August",
//   "September",
//   "October",
//   "November",
//   "December",
// ];

// const SUPPLIER_ACTUAL_COLOR = "#E6A817";
// const SUPPLIER_FORECAST_COLOR = "#E6A817";
// const SIMULATED_SUPPLIER_COLOR = "#00A3E0";
// const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
// const DESTINATION_DISPLAY_ALIASES: Record<string, string> = {
//   "El Salvador": "El Salvador and Honduras",
// };

// const MARKET_SHORT_NAMES: Record<string, string> = {
//   Argentina: "ARG",
//   Brazil: "BRA",
//   China: "CHN",
//   India: "IND",
//   Indonesia: "IDN",
//   Mexico: "MEX",
//   "South Korea": "KOR",
//   Taiwan: "TWN",
//   Thailand: "THA",
//   USA: "USA",
//   Vietnam: "VNM",
// };

// const MARKET_COUNTRY_COLORS: Record<string, string> = {
//   Argentina: "#22C55E",
//   Brazil: "#A855F7",
//   China: "#14B8A6",
//   India: "#F97316",
//   Indonesia: "#06B6D4",
//   Mexico: "#3B82F6",
//   "South Korea": "#EC4899",
//   Taiwan: "#8B5CF6",
//   Thailand: "#84CC16",
//   USA: "#F43F5E",
//   Vietnam: "#10B981",
// };

// const MARKET_FALLBACK_COLORS = [
//   "#14B8A6",
//   "#3B82F6",
//   "#EC4899",
//   "#A855F7",
//   "#F97316",
//   "#22C55E",
//   "#06B6D4",
//   "#84CC16",
//   "#F43F5E",
//   "#10B981",
// ];

// const normalize = (value: string | undefined) => (value ?? "").trim().toLowerCase();

// const destinationDisplayName = (value: string | undefined) => {
//   const trimmed = (value ?? "").trim();
//   return DESTINATION_DISPLAY_ALIASES[trimmed] ?? trimmed;
// };

// const shortMarketName = (country: string) => MARKET_SHORT_NAMES[country] ?? country;

// const marketSeriesColor = (country: string, index: number) =>
//   MARKET_COUNTRY_COLORS[country] ?? MARKET_FALLBACK_COLORS[index % MARKET_FALLBACK_COLORS.length];

// const parseNumber = (value: number | string | null | undefined) => {
//   if (typeof value === "number" && Number.isFinite(value)) return value;
//   if (typeof value !== "string") return null;
//   const cleaned = value.trim().replace(/,/g, "");
//   if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "n/a") return null;
//   const parsed = Number(cleaned);
//   return Number.isFinite(parsed) ? parsed : null;
// };

// const monthIndex = (month: string) => MONTHS.findIndex((item) => normalize(item) === normalize(month));

// const shortMonthTick = (value: string) => {
//   const [month, year] = value.split(" ");
//   if (!month || !year) return value;
//   return `${month}-${year.slice(-2)}`;
// };

// const getSupplierTlc = (entry: VendorBreakdownEntry) => {
//   const row = getSupplierTlcRow(entry);
//   return parseNumber(row?.amount);
// };

// const getSupplierTlcRow = (entry: VendorBreakdownEntry) =>
//   entry.rows.find((item) => normalize(item.label) === SUPPLIER_TLC_LABEL);

// const dataTypeIsForecast = (entry: { dataType?: string } | undefined) =>
//   normalize(entry?.dataType).includes("forecast");

// const dataTypeIsActual = (entry: { dataType?: string } | undefined) =>
//   normalize(entry?.dataType).includes("actual");

// type TlcPoint = {
//   value: number;
//   isForecast: boolean;
//   formulaReference: string;
//   indexType: string;
//   estimationNote: string;
// };

// const supplierTlcPoint = (entry: VendorBreakdownEntry): TlcPoint | null => {
//   const row = getSupplierTlcRow(entry);
//   const value = parseNumber(row?.amount);
//   if (!row || value === null) return null;
//   const isForecast = dataTypeIsForecast(entry);
//   return {
//     value,
//     isForecast,
//     formulaReference: row.formulaReference || "",
//     indexType:
//       row.forecastResinIndexType ||
//       row.resinIndexType ||
//       "Supplier resin index",
//     estimationNote: isForecast
//       ? "Supplier TLC forecast is calculated from the forecast resin index plus the supplier pipeline assumptions."
//       : "Supplier TLC actual comes from the standardized supplier row selected for the current supplier, destination, and month.",
//   };
// };

// const marketTlcPoint = (entry: MarketResearchTrendEntry): TlcPoint | null => {
//   const value = parseNumber(entry.amount);
//   if (value === null) return null;
//   const isForecast = dataTypeIsForecast(entry);
//   return {
//     value,
//     isForecast,
//     formulaReference: entry.formulaReference || "",
//     indexType:
//       (isForecast ? entry.forecastResinIndexType : entry.resinIndexType) ||
//       entry.resinIndexType ||
//       entry.forecastResinIndexType ||
//       "Market Research resin index",
//     estimationNote: isForecast
//       ? "Market Research TLC forecast is calculated from the forecast resin index and the required freight, insurance, duty/import tax, and fee components in the MR TLC formula."
//       : "Market Research TLC actual comes from the standardized MR total landed cost row for the selected country and month.",
//   };
// };

// const simulatedPoint = (point: TlcPoint | null, simulationPercent: number): TlcPoint | null => {
//   if (!point) return null;
//   const multiplier = 1 + simulationPercent / 100;
//   return {
//     ...point,
//     value: Number((point.value * multiplier).toFixed(1)),
//     estimationNote: `${point.estimationNote} Simulation applies a ${simulationPercent > 0 ? "+" : ""}${simulationPercent}% adjustment to Supplier TLC.`,
//   };
// };

// const entrySupplierName = (entry: VendorBreakdownEntry | undefined) =>
//   supplierDisplayNameForEntry(entry);

// const supplierEntryScore = (entry: VendorBreakdownEntry, requestedSupplier: string) => {
//   const supplierMatch = requestedSupplier
//     ? supplierNameMatchesEntry(entry, requestedSupplier)
//       ? 2
//       : 0
//     : 1;
//   const actualScore = dataTypeIsActual(entry) ? 1 : 0;
//   const tlc = getSupplierTlc(entry) ?? 0;
//   return supplierMatch * 10000 + actualScore * 1000 + tlc;
// };

// const TrendTooltip = ({ active, payload, label }: any) => {
//   if (!active || !payload?.length) return null;
//   const rows = payload.filter((item: any) => item.value !== null && item.value !== undefined);
//   if (!rows.length) return null;

//   return (
//     <div className="pet-tooltip px-4 py-3">
//       <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
//       <div className="space-y-3">
//         {rows.map((item: any) => {
//           const meta = item.payload?.[`${item.dataKey}Meta`] as TlcPoint | undefined;
//           return (
//             <div key={item.dataKey} className="space-y-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
//               <div className="flex items-center justify-between gap-5 text-sm">
//                 <span className="font-semibold" style={{ color: item.color }}>
//                   {item.name}
//                 </span>
//                 <span className="font-bold text-foreground">${formatAmount(item.value)}/MT</span>
//               </div>
//               {meta ? (
//                 <div className="rounded-md bg-secondary px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
//                   <p>
//                     <span className="font-semibold text-foreground">Index used:</span>{" "}
//                     {meta.indexType || "Not specified"}
//                   </p>
//                   <p>
//                     <span className="font-semibold text-foreground">Estimation:</span>{" "}
//                     {meta.estimationNote}
//                   </p>
//                   {meta.formulaReference ? (
//                     <p>
//                       <span className="font-semibold text-foreground">TLC formula:</span>{" "}
//                       {meta.formulaReference}
//                     </p>
//                   ) : null}
//                 </div>
//               ) : null}
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// };

// const SimulationPage: React.FC<SimulationPageProps> = ({ data }) => {
//   const [searchParams, setSearchParams] = useSearchParams();
//   const selectedDestination = destinationDisplayName(
//     searchParams.get("destination") || data.destination || ""
//   );
//   const selectedSourceCountry =
//     searchParams.get("source") || data.countries[0]?.country || "";
//   const requestedSupplier = searchParams.get("supplier") ?? "";
//   const isBrazilDestination = normalize(selectedDestination) === "brazil";
//   const [simulationPercent, setSimulationPercent] = useState<number>(0);
//   const [selectedMarketCountries, setSelectedMarketCountries] = useState<string[]>([]);
//   const [marketResearchTrendRows, setMarketResearchTrendRows] = useState<
//     MarketResearchTrendEntry[]
//   >(data.marketResearchTrends ?? []);

//   const destinationOptions = useMemo(() => {
//     const options = new Set<string>();
//     if (data.destination) options.add(destinationDisplayName(data.destination));
//     data.vendorBreakdowns.forEach((entry) => {
//       if (entry.destination) options.add(destinationDisplayName(entry.destination));
//     });
//     return Array.from(options).sort((a, b) => a.localeCompare(b));
//   }, [data.destination, data.vendorBreakdowns]);

//   useEffect(() => {
//     const url = createApiUrl("/market-research-trends");
//     url.searchParams.set("destination", selectedDestination);
//     url.searchParams.set("year", "2026");

//     fetch(url.toString())
//       .then((response) => response.json())
//       .then((payload: { rows?: MarketResearchTrendEntry[] }) => {
//         setMarketResearchTrendRows(payload.rows ?? []);
//       })
//       .catch(() => {
//         setMarketResearchTrendRows(data.marketResearchTrends ?? []);
//       });
//   }, [data.marketResearchTrends, selectedDestination]);

//   const marketTrendRowsForDestination = useMemo(
//     () =>
//       marketResearchTrendRows.filter(
//         (entry) =>
//           destinationDisplayName(entry.destination) === selectedDestination &&
//           Number(entry.year) === 2026 &&
//           parseNumber(entry.amount) !== null
//       ),
//     [marketResearchTrendRows, selectedDestination]
//   );

//   const marketCountryOptions = useMemo(
//     () =>
//       Array.from(
//         new Set(
//           marketTrendRowsForDestination
//             .map((entry) => entry.sourceCountry)
//             .filter(Boolean)
//         )
//       ).sort((a, b) => a.localeCompare(b)),
//     [marketTrendRowsForDestination]
//   );

//   const marketCountryOptionsKey = marketCountryOptions.join("|");

//   useEffect(() => {
//     setSelectedMarketCountries((current) => {
//       const validCurrent = current.filter((country) => marketCountryOptions.includes(country));
//       if (validCurrent.length) return validCurrent;
//       if (selectedSourceCountry && marketCountryOptions.includes(selectedSourceCountry)) {
//         return [selectedSourceCountry];
//       }
//       return marketCountryOptions.slice(0, 1);
//     });
//   }, [marketCountryOptions, marketCountryOptionsKey, selectedSourceCountry]);

//   const supplierEntriesForSource = useMemo(
//     () =>
//       data.vendorBreakdowns.filter(
//         (entry) =>
//           destinationDisplayName(entry.destination) === selectedDestination &&
//           entry.sourceCountry === selectedSourceCountry &&
//           Number(entry.year) === 2026
//       ),
//     [data.vendorBreakdowns, selectedDestination, selectedSourceCountry]
//   );

//   const supplierOptions = useMemo(() => {
//     const options = new Map<string, string>();
//     supplierEntriesForSource.forEach((entry) => {
//       const name = entrySupplierName(entry);
//       if (!name) return;
//       options.set(normalize(name), name);
//     });

//     return Array.from(options.values()).sort((a, b) => {
//       const aAmcor = normalize(a).startsWith("amcor") ? 0 : 1;
//       const bAmcor = normalize(b).startsWith("amcor") ? 0 : 1;
//       if (aAmcor !== bAmcor) return aAmcor - bAmcor;
//       return a.localeCompare(b);
//     });
//   }, [supplierEntriesForSource]);

//   const supplierOptionsKey = supplierOptions.join("|");

//   const supplierName = useMemo(() => {
//     if (requestedSupplier) {
//       const requestedEntry = supplierEntriesForSource.find((entry) =>
//         supplierNameMatchesEntry(entry, requestedSupplier)
//       );
//       if (requestedEntry) return entrySupplierName(requestedEntry);
//     }
//     return entrySupplierName(
//       [...supplierEntriesForSource].sort((a, b) =>
//         entrySupplierName(a).localeCompare(entrySupplierName(b))
//       )[0]
//     );
//   }, [requestedSupplier, supplierEntriesForSource]);

//   useEffect(() => {
//     if (!isBrazilDestination || !supplierOptions.length) return;

//     const requestedIsValid =
//       requestedSupplier &&
//       supplierEntriesForSource.some((entry) =>
//         supplierNameMatchesEntry(entry, requestedSupplier)
//       );
//     const nextSupplier = requestedIsValid ? supplierName : supplierOptions[0];
//     if (!nextSupplier || requestedSupplier === nextSupplier) return;

//     const next = new URLSearchParams(searchParams);
//     next.set("supplier", nextSupplier);
//     setSearchParams(next, { replace: true });
//   }, [
//     isBrazilDestination,
//     requestedSupplier,
//     searchParams,
//     setSearchParams,
//     supplierEntriesForSource,
//     supplierName,
//     supplierOptions,
//     supplierOptionsKey,
//   ]);

//   const supplierEntriesByMonth = useMemo(() => {
//     const monthMap = new Map<number, VendorBreakdownEntry>();
//     MONTHS.forEach((_, index) => {
//       const candidates = supplierEntriesForSource.filter((entry) => monthIndex(entry.month) === index);
//       if (!candidates.length) return;
//       const selected = [...candidates].sort(
//         (a, b) => supplierEntryScore(b, supplierName) - supplierEntryScore(a, supplierName)
//       )[0];
//       monthMap.set(index, selected);
//     });
//     return monthMap;
//   }, [supplierEntriesForSource, supplierName]);

//   const marketValuesByCountryAndMonth = useMemo(() => {
//     const map = new Map<string, Map<number, TlcPoint>>();
//     marketTrendRowsForDestination.forEach((entry) => {
//       const point = marketTlcPoint(entry);
//       const monthIdx = monthIndex(entry.month);
//       if (!point || monthIdx < 0) return;
//       const sourceMap = map.get(entry.sourceCountry) ?? new Map<number, TlcPoint>();
//       sourceMap.set(monthIdx, point);
//       map.set(entry.sourceCountry, sourceMap);
//     });
//     return map;
//   }, [marketTrendRowsForDestination]);

//   const chartData = useMemo(
//     () =>
//       MONTHS.map((month, index) => {
//         const entry = supplierEntriesByMonth.get(index);
//         const nextEntry = supplierEntriesByMonth.get(index + 1);
//         const supplierPoint = entry ? supplierTlcPoint(entry) : null;
//         const simulatedSupplierPoint = simulatedPoint(supplierPoint, simulationPercent);
//         const isForecast = dataTypeIsForecast(entry);
//         const nextIsForecast = dataTypeIsForecast(nextEntry);
//         const row: Record<string, string | number | null | TlcPoint> = {
//           period: `${month.slice(0, 3)} 2026`,
//           supplierActual: supplierPoint && !isForecast ? supplierPoint.value : null,
//           supplierForecast:
//             supplierPoint && (isForecast || nextIsForecast) ? supplierPoint.value : null,
//           simulatedSupplierActual:
//             simulationPercent !== 0 && simulatedSupplierPoint && !isForecast
//               ? simulatedSupplierPoint.value
//               : null,
//           simulatedSupplierForecast:
//             simulationPercent !== 0 && simulatedSupplierPoint && (isForecast || nextIsForecast)
//               ? simulatedSupplierPoint.value
//               : null,
//         };

//         if (supplierPoint && !isForecast) row.supplierActualMeta = supplierPoint;
//         if (supplierPoint && (isForecast || nextIsForecast)) {
//           row.supplierForecastMeta = supplierPoint;
//         }
//         if (simulationPercent !== 0 && simulatedSupplierPoint && !isForecast) {
//           row.simulatedSupplierActualMeta = simulatedSupplierPoint;
//         }
//         if (simulationPercent !== 0 && simulatedSupplierPoint && (isForecast || nextIsForecast)) {
//           row.simulatedSupplierForecastMeta = simulatedSupplierPoint;
//         }

//         selectedMarketCountries.forEach((country, countryIndex) => {
//           const point = marketValuesByCountryAndMonth.get(country)?.get(index);
//           const nextPoint = marketValuesByCountryAndMonth.get(country)?.get(index + 1);
//           const actualKey = `market_${countryIndex}_actual`;
//           const forecastKey = `market_${countryIndex}_forecast`;
//           row[actualKey] = point && !point.isForecast ? point.value : null;
//           row[forecastKey] = point && (point.isForecast || nextPoint?.isForecast) ? point.value : null;
//           if (point && !point.isForecast) row[`${actualKey}Meta`] = point;
//           if (point && (point.isForecast || nextPoint?.isForecast)) {
//             row[`${forecastKey}Meta`] = point;
//           }
//         });

//         return row;
//       }),
//     [
//       marketValuesByCountryAndMonth,
//       selectedMarketCountries,
//       simulationPercent,
//       supplierEntriesByMonth,
//     ]
//   );

//   const latestActual = useMemo(() => {
//     const actualRows = MONTHS.map((_, index) => supplierEntriesByMonth.get(index))
//       .filter((entry): entry is VendorBreakdownEntry => Boolean(entry) && !dataTypeIsForecast(entry));
//     const latest = actualRows[actualRows.length - 1];
//     return latest ? { entry: latest, value: getSupplierTlc(latest) } : null;
//   }, [supplierEntriesByMonth]);

//   const selectedYear = searchParams.get("year") || "2026";
//   const selectedMonth = searchParams.get("month") || latestActual?.entry.month || "";

//   const forecastRowsCount = useMemo(
//     () =>
//       MONTHS.map((_, index) => supplierEntriesByMonth.get(index)).filter((entry) =>
//         dataTypeIsForecast(entry)
//       ).length,
//     [supplierEntriesByMonth]
//   );

//   const toggleMarketCountry = (country: string) => {
//     setSelectedMarketCountries((current) =>
//       current.includes(country)
//         ? current.filter((item) => item !== country)
//         : [...current, country]
//     );
//   };

//   const allMarketsSelected =
//     marketCountryOptions.length > 0 &&
//     marketCountryOptions.every((country) => selectedMarketCountries.includes(country));
//   const supplierLegendName = supplierName || "Supplier";

//   return (
//     <div className="pet-page-bg min-h-screen px-6 py-6 max-sm:px-4">
//       <section className="mx-auto w-full max-w-[1400px] space-y-4">
//         <RevealOnScroll>
//           <Card className="border-primary/10 bg-card/80 shadow-lg backdrop-blur">
//             <CardContent className="p-6 max-sm:p-4">
//               <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
//                 Scenario Planning
//               </p>
//               <h1 className="mt-2 text-xl font-extrabold text-foreground">
//                 Simulation Workspace
//               </h1>
//               <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
//                 Experiment with percentage-based adjustments on Supplier TLC and compare the result against
//                 the same Supplier Actual and Forecast vs Market Research TLC view used in Trends.
//               </p>
//             </CardContent>
//           </Card>
//         </RevealOnScroll>

//         <RevealOnScroll delay={0.03}>
//           <Card className="shadow-lg">
//             <CardHeader>
//               <CardTitle className="text-xl">Simulation</CardTitle>
//               <CardDescription>Adjust Supplier TLC and view the impact on the Trends-style graph.</CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-5">
//               <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_160px] xl:items-end">
//                 <div className="space-y-2">
//                   <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Simulation target</label>
//                   <div className="flex h-11 w-full items-center rounded-xl border border-border bg-secondary px-3 text-sm text-foreground">
//                     Supplier TLC
//                   </div>
//                 </div>
//                 <div className="rounded-xl border border-border bg-card/40 p-4">
//                   <div className="flex items-center justify-between gap-4">
//                     <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Percentage change</label>
//                     <Badge variant="secondary">{simulationPercent > 0 ? "+" : ""}{simulationPercent}%</Badge>
//                   </div>
//                   <input
//                     type="range"
//                     min={-30}
//                     max={30}
//                     step={1}
//                     value={simulationPercent}
//                     onChange={(event) => setSimulationPercent(Number(event.target.value))}
//                     className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
//                   />
//                 </div>
//                 <button
//                   type="button"
//                   onClick={() => setSimulationPercent(0)}
//                   className="h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
//                 >
//                   Reset
//                 </button>
//               </div>
//             </CardContent>
//           </Card>
//         </RevealOnScroll>

//         <RevealOnScroll delay={0.05}>
//           <Card className="border-primary/10 bg-card/80 shadow-lg">
//             <CardHeader className="space-y-4">
//               <div className="flex flex-wrap items-start justify-between gap-4">
//                 <div>
//                   <CardTitle className="text-xl">Supplier Actual and Forecast vs Market Research TLC</CardTitle>
//                   <CardDescription className="mt-1">
//                     {selectedDestination || "Destination"} {supplierName || "supplier"} TLC for {selectedSourceCountry || "selected source"} across 2026.
//                   </CardDescription>
//                 </div>
//                 <div className="flex flex-wrap gap-3">
//                   <div className="min-w-[220px]">
//                     <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
//                       Destination
//                     </label>
//                     <select
//                       value={selectedDestination}
//                       onChange={(event) => {
//                         const next = new URLSearchParams(searchParams);
//                         next.set("destination", event.target.value);
//                         if (normalize(event.target.value) !== "brazil") {
//                           next.delete("supplier");
//                         }
//                         setSearchParams(next);
//                       }}
//                       className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
//                     >
//                       {destinationOptions.map((destination) => (
//                         <option key={destination} value={destination}>
//                           {destination}
//                         </option>
//                       ))}
//                     </select>
//                   </div>
//                   {isBrazilDestination && supplierOptions.length > 1 ? (
//                     <div className="min-w-[220px]">
//                       <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
//                         Supplier / Location
//                       </label>
//                       <select
//                         value={supplierName}
//                         onChange={(event) => {
//                           const next = new URLSearchParams(searchParams);
//                           next.set("supplier", event.target.value);
//                           setSearchParams(next);
//                         }}
//                         className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
//                       >
//                         {supplierOptions.map((supplier) => (
//                           <option key={supplier} value={supplier}>
//                             {supplier}
//                           </option>
//                         ))}
//                       </select>
//                     </div>
//                   ) : null}
//                 </div>
//               </div>

//               <div className="grid gap-3 md:grid-cols-3">
//                 <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
//                   <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
//                     Supplier Source
//                   </p>
//                   <p className="mt-1 text-base font-extrabold text-primary">
//                     {selectedSourceCountry || "No source selected"}
//                   </p>
//                 </div>
//                 <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
//                   <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
//                     Supplier
//                   </p>
//                   <p className="mt-1 truncate text-base font-extrabold text-foreground">
//                     {supplierName || "No supplier"}
//                   </p>
//                 </div>
//                 <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
//                   <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
//                     2026 Actual / Forecast
//                   </p>
//                   <p className="mt-1 text-base font-extrabold text-foreground">
//                     {latestActual?.value !== null && latestActual?.value !== undefined
//                       ? `$${formatAmount(latestActual.value)}/MT`
//                       : "$0/MT"}
//                     <span className="ml-2 text-xs font-semibold text-muted-foreground">
//                       {forecastRowsCount} forecast months
//                     </span>
//                   </p>
//                 </div>
//               </div>

//               <div>
//                 <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
//                   Market Research Countries
//                 </p>
//                 <div className="flex flex-wrap gap-2">
//                   <button
//                     type="button"
//                     onClick={() => setSelectedMarketCountries(marketCountryOptions)}
//                     className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
//                       allMarketsSelected
//                         ? "border-primary/40 bg-primary/15 text-primary"
//                         : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
//                     }`}
//                   >
//                     Select All
//                   </button>
//                   <button
//                     type="button"
//                     onClick={() => setSelectedMarketCountries([])}
//                     className="rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
//                   >
//                     Clear
//                   </button>
//                   {marketCountryOptions.map((country, index) => {
//                     const color = marketSeriesColor(country, index);
//                     const selected = selectedMarketCountries.includes(country);
//                     return (
//                       <button
//                         key={country}
//                         type="button"
//                         onClick={() => toggleMarketCountry(country)}
//                         className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
//                           selected
//                             ? "border-primary/40 bg-primary/15 text-primary"
//                             : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
//                         }`}
//                       >
//                         <span
//                           className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
//                           style={{ backgroundColor: color }}
//                           aria-hidden
//                         />
//                         {country}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>
//             </CardHeader>
//             <CardContent>
//               <div className="rounded-xl border border-border bg-card/40 p-3">
//                 <div className="h-[460px] w-full">
//                   <ResponsiveContainer width="100%" height="100%">
//                     <LineChart data={chartData} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
//                       <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
//                       <XAxis
//                         dataKey="period"
//                         tick={{ fontSize: 11, fill: "#5a5a5a" }}
//                         tickFormatter={shortMonthTick}
//                         interval={0}
//                         minTickGap={8}
//                         tickMargin={8}
//                         padding={{ left: 8, right: 24 }}
//                         tickLine={false}
//                         axisLine={false}
//                       />
//                       <YAxis
//                         tick={{ fontSize: 12, fill: "#5a5a5a" }}
//                         tickLine={false}
//                         axisLine={false}
//                         width={54}
//                       />
//                       <Tooltip content={<TrendTooltip />} />
//                       <Legend
//                         layout="vertical"
//                         align="right"
//                         verticalAlign="middle"
//                         width={190}
//                         wrapperStyle={{
//                           color: "#1a1a1a",
//                           fontSize: "12px",
//                           lineHeight: "20px",
//                           paddingLeft: "12px",
//                         }}
//                       />
//                       <Line
//                         type="monotone"
//                         dataKey="supplierActual"
//                         name={supplierLegendName}
//                         stroke={SUPPLIER_ACTUAL_COLOR}
//                         strokeWidth={3}
//                         dot={{ r: 3, fill: SUPPLIER_ACTUAL_COLOR }}
//                         connectNulls
//                       />
//                       <Line
//                         type="monotone"
//                         dataKey="supplierForecast"
//                         name={`Fcst - ${supplierLegendName}`}
//                         stroke={SUPPLIER_FORECAST_COLOR}
//                         strokeWidth={3}
//                         strokeDasharray="7 5"
//                         dot={{ r: 3, fill: SUPPLIER_FORECAST_COLOR }}
//                         connectNulls
//                         legendType="none"
//                       />
//                       {simulationPercent !== 0 ? (
//                         <>
//                           <Line
//                             type="monotone"
//                             dataKey="simulatedSupplierActual"
//                             name={`Simulated - ${supplierLegendName}`}
//                             stroke={SIMULATED_SUPPLIER_COLOR}
//                             strokeWidth={3}
//                             dot={{ r: 3, fill: SIMULATED_SUPPLIER_COLOR }}
//                             connectNulls
//                           />
//                           <Line
//                             type="monotone"
//                             dataKey="simulatedSupplierForecast"
//                             name={`Sim Fcst - ${supplierLegendName}`}
//                             stroke={SIMULATED_SUPPLIER_COLOR}
//                             strokeWidth={3}
//                             strokeDasharray="7 5"
//                             dot={{ r: 3, fill: SIMULATED_SUPPLIER_COLOR }}
//                             connectNulls
//                             legendType="none"
//                           />
//                         </>
//                       ) : null}
//                       {selectedMarketCountries.map((country, index) => (
//                         <React.Fragment key={country}>
//                           <Line
//                             type="monotone"
//                             dataKey={`market_${index}_actual`}
//                             name={shortMarketName(country)}
//                             stroke={marketSeriesColor(country, index)}
//                             strokeWidth={2.6}
//                             dot={{ r: 2.8, fill: marketSeriesColor(country, index) }}
//                             connectNulls
//                           />
//                           <Line
//                             type="monotone"
//                             dataKey={`market_${index}_forecast`}
//                             name={`MR Fcst - ${shortMarketName(country)}`}
//                             stroke={marketSeriesColor(country, index)}
//                             strokeWidth={2.6}
//                             strokeDasharray="5 5"
//                             dot={{ r: 2.8, fill: marketSeriesColor(country, index) }}
//                             connectNulls
//                             legendType="none"
//                           />
//                         </React.Fragment>
//                       ))}
//                     </LineChart>
//                   </ResponsiveContainer>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//           <RevealOnScroll>
//           <div className="mx-auto w-full max-w-[1480px] mb-4 mt-4">
//           <AIInsightPanel
//             request={{
//               page: "simulation",
//               destination: selectedDestination,
//               month: selectedMonth,
//               year: selectedYear,
//               marketResearchTrends: data.marketResearchTrends ?? [],
//               vendorBreakdowns: data.vendorBreakdowns.filter(
//                 (e) =>
//                   destinationDisplayName(e.destination) === selectedDestination &&
//                   Number(e.year) === Number(selectedYear)
//               ),
//               baseTlc: latestActual?.value ?? null,
//               simulatedTlc:
//                 latestActual?.value != null && simulationPercent !== 0
//                   ? latestActual.value * (1 + simulationPercent / 100)
//                   : latestActual?.value ?? null,
//             }}
//               />
//             </div>
//           </RevealOnScroll>
          
//         </RevealOnScroll>
//       </section>
//     </div>
//   );
// };

// export default SimulationPage;


// New 


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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createApiUrl } from "../lib/api";
import {
  supplierDisplayNameForEntry,
  supplierNameMatchesEntry,
} from "../lib/supplierDisplay";

type SimulationPageProps = {
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
const SIMULATED_SUPPLIER_COLOR = "#00A3E0";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
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
  const row = getSupplierTlcRow(entry);
  return parseNumber(row?.amount);
};

const getSupplierTlcRow = (entry: VendorBreakdownEntry) =>
  entry.rows.find((item) => normalize(item.label) === SUPPLIER_TLC_LABEL);

const dataTypeIsForecast = (entry: { dataType?: string } | undefined) =>
  normalize(entry?.dataType).includes("forecast");

const dataTypeIsActual = (entry: { dataType?: string } | undefined) =>
  normalize(entry?.dataType).includes("actual");

type TlcPoint = {
  value: number;
  isForecast: boolean;
  formulaReference: string;
  indexType: string;
  estimationNote: string;
};

const supplierTlcPoint = (entry: VendorBreakdownEntry): TlcPoint | null => {
  const row = getSupplierTlcRow(entry);
  const value = parseNumber(row?.amount);
  if (!row || value === null) return null;
  const isForecast = dataTypeIsForecast(entry);
  return {
    value,
    isForecast,
    formulaReference: row.formulaReference || "",
    indexType:
      row.forecastResinIndexType ||
      row.resinIndexType ||
      "Supplier resin index",
    estimationNote: isForecast
      ? "Supplier TLC forecast is calculated from the forecast resin index plus the supplier pipeline assumptions."
      : "Supplier TLC actual comes from the standardized supplier row selected for the current supplier, destination, and month.",
  };
};

const marketTlcPoint = (entry: MarketResearchTrendEntry): TlcPoint | null => {
  const value = parseNumber(entry.amount);
  if (value === null) return null;
  const isForecast = dataTypeIsForecast(entry);
  return {
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
  };
};

const simulatedPoint = (point: TlcPoint | null, simulationPercent: number): TlcPoint | null => {
  if (!point) return null;
  const multiplier = 1 + simulationPercent / 100;
  return {
    ...point,
    value: Number((point.value * multiplier).toFixed(1)),
    estimationNote: `${point.estimationNote} Simulation applies a ${simulationPercent > 0 ? "+" : ""}${simulationPercent}% adjustment to Supplier TLC.`,
  };
};

const entrySupplierName = (entry: VendorBreakdownEntry | undefined) =>
  supplierDisplayNameForEntry(entry);

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
    else if (key === "simulatedSupplierForecast") actualKey = "simulatedSupplierActual";
    else if (key.endsWith("_forecast")) actualKey = key.replace(/_forecast$/, "_actual");

    if (!actualKey) return true;

    const actualItem = rowByKey.get(actualKey);
    if (!actualItem) return true;

    const forecastValue = Number(item.value);
    const actualValue = Number(actualItem.value);

    // At forecast transition months (e.g., June), keep only actual in tooltip.
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
                  <p>
                    <span className="font-semibold text-foreground">Estimation:</span>{" "}
                    {meta.estimationNote}
                  </p>
                  {meta.formulaReference ? (
                    <p>
                      <span className="font-semibold text-foreground">TLC formula:</span>{" "}
                      {meta.formulaReference}
                    </p>
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

const SimulationPage: React.FC<SimulationPageProps> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDestination = destinationDisplayName(
    searchParams.get("destination") || data.destination || ""
  );
  const selectedSourceCountry =
    searchParams.get("source") || data.countries[0]?.country || "";
  const requestedSupplier = searchParams.get("supplier") ?? "";
  const isBrazilDestination = normalize(selectedDestination) === "brazil";
  const [simulationPercent, setSimulationPercent] = useState<number>(0);
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
    () =>
      Array.from(
        new Set(
          marketTrendRowsForDestination
            .map((entry) => entry.sourceCountry)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
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
          destinationDisplayName(entry.destination) === selectedDestination &&
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
    const map = new Map<string, Map<number, TlcPoint>>();
    marketTrendRowsForDestination.forEach((entry) => {
      const point = marketTlcPoint(entry);
      const monthIdx = monthIndex(entry.month);
      if (!point || monthIdx < 0) return;
      const sourceMap = map.get(entry.sourceCountry) ?? new Map<number, TlcPoint>();
      sourceMap.set(monthIdx, point);
      map.set(entry.sourceCountry, sourceMap);
    });
    return map;
  }, [marketTrendRowsForDestination]);

  const chartData = useMemo(
    () =>
      MONTHS.map((month, index) => {
        const entry = supplierEntriesByMonth.get(index);
        const nextEntry = supplierEntriesByMonth.get(index + 1);
        const supplierPoint = entry ? supplierTlcPoint(entry) : null;
        const simulatedSupplierPoint = simulatedPoint(supplierPoint, simulationPercent);
        const isForecast = dataTypeIsForecast(entry);
        const nextIsForecast = dataTypeIsForecast(nextEntry);
        const row: Record<string, string | number | null | TlcPoint> = {
          period: `${month.slice(0, 3)} 2026`,
          supplierActual: supplierPoint && !isForecast ? supplierPoint.value : null,
          supplierForecast:
            supplierPoint && (isForecast || nextIsForecast) ? supplierPoint.value : null,
          simulatedSupplierActual:
            simulationPercent !== 0 && simulatedSupplierPoint && !isForecast
              ? simulatedSupplierPoint.value
              : null,
          simulatedSupplierForecast:
            simulationPercent !== 0 && simulatedSupplierPoint && (isForecast || nextIsForecast)
              ? simulatedSupplierPoint.value
              : null,
        };

        if (supplierPoint && !isForecast) row.supplierActualMeta = supplierPoint;
        if (supplierPoint && (isForecast || nextIsForecast)) {
          row.supplierForecastMeta = supplierPoint;
        }
        if (simulationPercent !== 0 && simulatedSupplierPoint && !isForecast) {
          row.simulatedSupplierActualMeta = simulatedSupplierPoint;
        }
        if (simulationPercent !== 0 && simulatedSupplierPoint && (isForecast || nextIsForecast)) {
          row.simulatedSupplierForecastMeta = simulatedSupplierPoint;
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
    [
      marketValuesByCountryAndMonth,
      selectedMarketCountries,
      simulationPercent,
      supplierEntriesByMonth,
    ]
  );

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
  const supplierLegendName = supplierName || "Supplier";
  const supplierLegendNameWithCountry = selectedDestination
    ? `${supplierLegendName} - ${selectedDestination}`
    : supplierLegendName;

  return (
    <div className="pet-page-bg min-h-screen px-6 py-6 max-sm:px-4">
      <section className="mx-auto w-full max-w-[1400px] space-y-4">
        <RevealOnScroll>
          <Card className="border-primary/10 bg-white shadow-lg">
            <CardContent className="p-6 max-sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                Scenario Planning
              </p>
              <h1 className="mt-2 text-xl font-extrabold text-foreground">
                Simulation Workspace
              </h1>
              <p className="mt-2 max-w-6xl text-sm text-foreground">
                Experiment with percentage-based adjustments on Supplier TLC and compare the result against
                the same Supplier Actual and Forecast vs Market Research TLC view used in Trends.
              </p>
            </CardContent>
          </Card>
        </RevealOnScroll>

        <RevealOnScroll delay={0.03}>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Simulation</CardTitle>
              <CardDescription>Adjust Supplier TLC and view the impact on the Trends-style graph.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_160px] xl:items-stretch">
                <div className="h-full rounded-xl border border-border bg-white p-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Simulation target</label>
                  <div className="mt-2 flex h-11 w-full items-center rounded-xl border border-border bg-secondary px-3 text-sm text-foreground">
                    Supplier TLC
                  </div>
                </div>
                <div className="h-full rounded-xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Percentage change</label>
                    <Badge variant="secondary">{simulationPercent > 0 ? "+" : ""}{simulationPercent}%</Badge>
                  </div>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={simulationPercent}
                    onChange={(event) => setSimulationPercent(Number(event.target.value))}
                    className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSimulationPercent(0)}
                  className="h-full min-h-[92px] rounded-xl border border-[#D4C100] bg-[#F2DC00] px-4 text-md font-semibold text-black transition hover:bg-[#E3CF00]"
                >
                  Reset
                </button>
              </div>
            </CardContent>
          </Card>
        </RevealOnScroll>

        <RevealOnScroll delay={0.05}>
          <Card className="border-primary/10 bg-white shadow-lg">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Supplier TLC Benchmark and Market Scenario Outlook</CardTitle>
                  <CardDescription className="mt-1">
                    {selectedDestination || "Destination"} {supplierName || "supplier"} TLC for {selectedSourceCountry || "selected source"} across 2026.
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

              <div className="grid gap-3 md:grid-cols-3">
                {/* <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
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
                </div> */}
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
                  {marketCountryOptions.map((country, index) => {
                    const color = marketSeriesColor(country, index);
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
                  })}
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
                        name={supplierLegendNameWithCountry}
                        stroke={SUPPLIER_ACTUAL_COLOR}
                        strokeWidth={3}
                        dot={{ r: 3, fill: SUPPLIER_ACTUAL_COLOR }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="supplierForecast"
                        name={`Fcst - ${supplierLegendNameWithCountry}`}
                        stroke={SUPPLIER_FORECAST_COLOR}
                        strokeWidth={3}
                        strokeDasharray="7 5"
                        dot={{ r: 3, fill: SUPPLIER_FORECAST_COLOR }}
                        connectNulls
                        legendType="none"
                      />
                      {simulationPercent !== 0 ? (
                        <>
                          <Line
                            type="monotone"
                            dataKey="simulatedSupplierActual"
                            name={`Simulated - ${supplierLegendNameWithCountry}`}
                            stroke={SIMULATED_SUPPLIER_COLOR}
                            strokeWidth={3}
                            dot={{ r: 3, fill: SIMULATED_SUPPLIER_COLOR }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="simulatedSupplierForecast"
                            name={`Sim Fcst - ${supplierLegendNameWithCountry}`}
                            stroke={SIMULATED_SUPPLIER_COLOR}
                            strokeWidth={3}
                            strokeDasharray="7 5"
                            dot={{ r: 3, fill: SIMULATED_SUPPLIER_COLOR }}
                            connectNulls
                            legendType="none"
                          />
                        </>
                      ) : null}
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
            </CardContent>
          </Card>
        </RevealOnScroll>
      </section>
    </div>
  );
};

export default SimulationPage;