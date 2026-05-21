import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CountryCost, VendorBreakdownEntry } from "../types";
import { formatAmount } from "../types";
import { pickEffectiveVendorSourceCountry } from "../lib/vendorSourcePicker";
import {
  buildDestinationSourceMonthly,
  marketResearchTlcForCountry,
  supplierTlcFromVendorEntry,
} from "../lib/vendorTrendsData";

type VendorBreakdownDashboardProps = {
  vendorBreakdowns?: VendorBreakdownEntry[];
  countries?: CountryCost[];
  selectedDestination?: string;
  selectedSourceCountry?: string;
  selectedMonth?: string;
  selectedYear?: string;
  onBack?: () => void;
};

const LABEL_MAPPING: Record<string, string> = {
  "Resin Index": "Resin Index",
  Finance: "Resin Financing cost",
  "Freight China-Buenaventura (Regular)": "Resin Freight cost (Reg)",
  "Freight China-Buenaventura (Incremental)": "Resin Freight cost (Inc)",
  "ICIS China MID (n-1)": "Month",
  "Sub Total (with Incremental Freight)": "CIF(Incremental)",
  "Sub Total (with Regular Freight)": "CIF(Regular)",
  "Duty 5% (Change According to Regulation)": "Others",
  "Landed Factor 8%": "Others",
  "ZF Legislation Change": "Others",
  "Sur Charge Alpek Br": "Others",
  "Total Resin Price ABI VIRGIN Formula": "Total Resing Price ABI Formulae",
  "Final Price with Resin Freight Adjustment": "Final Price with Resin Freight Adjustment",
  "Final Price FIFO": "Final Price",
};

const MONTH_ORDER = [
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

const RANGE_START_YEAR = 2026;
const RANGE_START_MONTH_INDEX = 0; // January
const RANGE_END_YEAR = 2026;
const RANGE_END_MONTH_INDEX = 2; // March
const ABI_PRIMARY_BLUE = "#003A70";
const ABI_LIGHT_BLUE = "#00A3E0";
const ABI_GOLD = "#FFB81C";
const ABI_DARK_NAVY = "#001F3F";
const ABI_NEUTRAL = "#94A3B8";

const TREND_COMPONENT_SERIES = [
  { key: "Resin Index", color: ABI_PRIMARY_BLUE },
  { key: "Resin Financing cost", color: ABI_LIGHT_BLUE },
  { key: "Resin Freight cost (Reg)", color: ABI_GOLD },
  { key: "Resin Freight cost (Inc)", color: ABI_DARK_NAVY },
  { key: "Others", color: ABI_NEUTRAL },
] as const;

const NUMERIC_SERIES = [
  "Resin Index",
  "Resin Financing cost",
  "Resin Freight cost (Reg)",
  "Resin Freight cost (Inc)",
  "CIF(Incremental)",
  "CIF(Regular)",
  "Others",
  "Total Resing Price ABI Formulae",
  "Final Price with Resin Freight Adjustment",
  "Final Price",
] as const;

const parseNumericAmount = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "#REF!" || trimmed.toLowerCase() === "n/a") {
    return 0;
  }
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const buildMonthlyPeriods = () => {
  const periods: { year: number; monthIndex: number; month: string; period: string }[] = [];
  for (let year = RANGE_START_YEAR; year <= RANGE_END_YEAR; year += 1) {
    const start = year === RANGE_START_YEAR ? RANGE_START_MONTH_INDEX : 0;
    const end = year === RANGE_END_YEAR ? RANGE_END_MONTH_INDEX : 11;
    for (let m = start; m <= end; m += 1) {
      periods.push({
        year,
        monthIndex: m,
        month: MONTH_ORDER[m],
        period: `${MONTH_ORDER[m].slice(0, 3)} ${year}`,
      });
    }
  }
  return periods;
};

const shortMonthTick = (value: string) => {
  const [month, year] = value.split(" ");
  if (!month || !year) return value;
  return `${month}-${year.slice(-2)}`;
};

const AverageTlcBarLabel = (field: "averageMarketResearchTlcRaw" | "averageSupplierTlcRaw") => (props: any) => {
  const display = formatAmount(props?.payload?.[field] ?? null);
  const x = Number(props?.x);
  const y = Number(props?.y);
  const w = Number(props?.width ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    <text x={x + w / 2} y={y} dy={-4} fill="#cbd5e1" fontSize={11} textAnchor="middle">
      {display}
    </text>
  );
};

const monthIndex = (month: string) => MONTH_ORDER.indexOf(month);
const is2026Only = (year: number) => year === 2026;

const sortBreakdowns = (rows: VendorBreakdownEntry[]) =>
  [...rows].sort((a, b) => {
    const yearDiff = Number(a.year) - Number(b.year);
    if (yearDiff !== 0) return yearDiff;
    return monthIndex(a.month) - monthIndex(b.month);
  });

const buildTrendData = (entries: VendorBreakdownEntry[]) => {
  return sortBreakdowns(entries).map((entry) => {
    const base = {
      period: `${entry.month.slice(0, 3)} ${entry.year}`,
      month: entry.month,
      year: entry.year,
      sourceCountry: entry.sourceCountry,
      destination: entry.destination,
    } as Record<string, string | number>;

    let others = 0;

    entry.rows.forEach((row) => {
      const mapped = LABEL_MAPPING[row.label];
      if (!mapped) return;
      if (mapped === "Month") {
        base[mapped] = typeof row.amount === "string" ? row.amount : String(row.amount ?? "");
        return;
      }
      const numericValue = parseNumericAmount(row.amount);
      if (mapped === "Others") {
        others += numericValue;
        return;
      }
      base[mapped] = numericValue;
    });

    base["Others"] = others;

    NUMERIC_SERIES.forEach((key) => {
      if (typeof base[key] !== "number") {
        base[key] = 0;
      }
    });

    return base;
  });
};

const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const uniqueRows = payload.reduce((acc: any[], item: any) => {
    const existing = acc.find((row) => row.name === item.name);
    if (!existing) {
      acc.push(item);
      return acc;
    }
    if ((existing.value === null || existing.value === undefined) && item.value !== null && item.value !== undefined) {
      const idx = acc.indexOf(existing);
      acc[idx] = item;
    }
    return acc;
  }, []);

  const displayValue = (item: any) => {
    const rawKey = `${item.dataKey}Raw`;
    const fromRaw = item.payload?.[rawKey];
    if (fromRaw !== undefined) return formatAmount(fromRaw);
    return formatAmount(item.value);
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-[#020817]/95 px-4 py-3 shadow-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <div className="space-y-1.5">
        {uniqueRows.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6 text-sm">
            <span className="font-medium" style={{ color: item.color }}>
              {item.name}
            </span>
            <span className="font-semibold text-slate-100">{displayValue(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const VendorBreakdownDashboard: React.FC<VendorBreakdownDashboardProps> = ({
  vendorBreakdowns = [],
  countries,
  selectedDestination,
  selectedSourceCountry,
//   selectedMonth,
//   selectedYear,
  onBack,
}) => {
  const [selectedTrendSeries, setSelectedTrendSeries] = useState<string>("all");

  const effectiveSourceCountry = useMemo(
    () =>
      pickEffectiveVendorSourceCountry(
        vendorBreakdowns,
        selectedDestination ?? "",
        selectedSourceCountry ?? ""
      ),
    [vendorBreakdowns, selectedDestination, selectedSourceCountry]
  );

  const filteredEntries = useMemo(() => {
    return vendorBreakdowns.filter((entry) => {
      const destinationMatch = selectedDestination ? entry.destination === selectedDestination : true;
      return destinationMatch && entry.sourceCountry === effectiveSourceCountry;
    });
  }, [vendorBreakdowns, selectedDestination, effectiveSourceCountry]);

  const baseTrendData = useMemo(() => buildTrendData(filteredEntries), [filteredEntries]);

  const trendData = useMemo(
    () => baseTrendData.filter((row) => is2026Only(Number(row.year))),
    [baseTrendData]
  );

  const sortedVendorTimeline = useMemo(() => sortBreakdowns(filteredEntries), [filteredEntries]);
  const latestVendorEntry = sortedVendorTimeline[sortedVendorTimeline.length - 1];
  const previousVendorEntry = sortedVendorTimeline[sortedVendorTimeline.length - 2];
  const latestSupplierTlc = latestVendorEntry ? supplierTlcFromVendorEntry(latestVendorEntry) : null;
  const previousSupplierTlc = previousVendorEntry ? supplierTlcFromVendorEntry(previousVendorEntry) : null;
  const supplierTlcDelta =
    latestSupplierTlc !== null && previousSupplierTlc !== null
      ? latestSupplierTlc - previousSupplierTlc
      : null;
  const marketResearchSnapshot = useMemo(
    () => marketResearchTlcForCountry(countries, effectiveSourceCountry),
    [countries, effectiveSourceCountry]
  );
  const latestPeriodLabel = latestVendorEntry
    ? `${latestVendorEntry.month.slice(0, 3)} ${latestVendorEntry.year}`
    : null;
  const destinationSourceMonthly = useMemo(
    () =>
      buildDestinationSourceMonthly({
        periods: buildMonthlyPeriods(),
        vendorBreakdowns,
        destination: selectedDestination || "Colombia",
        sourceCountry: effectiveSourceCountry,
        countries,
      }),
    [vendorBreakdowns, selectedDestination, effectiveSourceCountry, countries]
  );

  const trendDataStyled = useMemo(
    () =>
      trendData.map((row) => {
        const styledRow: Record<string, string | number | null> = { ...row };
        TREND_COMPONENT_SERIES.forEach((series) => {
          const value = row[series.key] as number;
          styledRow[`${series.key}Solid`] = value;
          styledRow[`${series.key}Dotted`] = null;
        });
        return styledRow;
      }),
    [trendData]
  );

  const averageMonthlyTlcData = useMemo(() => {
    if (!destinationSourceMonthly.length) return [];
    const mrVals = destinationSourceMonthly
      .map((row) => row.marketResearchValue)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const supVals = destinationSourceMonthly
      .map((row) => row.supplierTlcValue)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const avg = (vals: number[]) =>
      vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
    const averageMarketResearchTlcRaw = avg(mrVals);
    const averageSupplierTlcRaw = avg(supVals);
    return [
      {
        label: "Average",
        averageMarketResearchTlc: averageMarketResearchTlcRaw ?? 0,
        averageSupplierTlc: averageSupplierTlcRaw ?? 0,
        averageMarketResearchTlcRaw,
        averageSupplierTlcRaw,
      },
    ];
  }, [destinationSourceMonthly]);

  if (!trendData.length) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-card px-6 py-8 max-sm:px-4">
        <Card className="mx-auto w-full max-w-[1400px] animate-fade-in-up shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Historical view of supplier quote vs market research</CardTitle>
            <CardDescription>No vendor breakdown data available for the current filters.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card px-6 py-8 max-sm:px-4 max-sm:py-5">
      <section className="mx-auto w-full max-w-[1400px] space-y-6 animate-fade-in-up">
        <Card className="border-primary/10 bg-card/80 shadow-lg backdrop-blur">
          <CardContent className="flex flex-wrap items-end justify-between gap-5 p-6 max-sm:p-4">
            <div className="space-y-4">
              <div>
                <h1 className="mt-2 text-xl font-extrabold text-foreground">
                  Historical view of supplier quote vs market research
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Explore monthly supplier cost components and run quick simulations without leaving the current analysis flow.
                </p>
                {selectedSourceCountry &&
                selectedSourceCountry.trim() !== effectiveSourceCountry ? (
                  <p className="text-xs text-muted-foreground">
                    No vendor rows for <span className="font-semibold text-foreground">{selectedSourceCountry}</span>{" "}
                    with this destination; showing <span className="font-semibold text-foreground">{effectiveSourceCountry}</span>.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    Selected Source
                  </p>
                  <h2 className="text-xl font-extrabold pet-gradient-heading bg-clip-text text-transparent">
                    {effectiveSourceCountry}
                  </h2>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    Selected Destination
                  </p>
                  <h2 className="text-xl font-extrabold pet-gradient-heading bg-clip-text text-transparent">
                    {selectedDestination || "All Destinations"}
                  </h2>
                </div>
                {/* {(selectedMonth || selectedYear) && (
                  <div className="rounded-xl border border-border bg-background/40 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                      Active Period
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {[selectedMonth, selectedYear].filter(Boolean).join(" ")}
                    </p>
                  </div>
                )} */}
              </div>
            </div>

            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                Back to overview
              </button>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/20 py-2 px-2 shadow-lg">
            <CardHeader className="pb-2 space-y-1">
              <CardDescription>
                Supplier TLC{latestPeriodLabel ? ` (${latestPeriodLabel})` : ""}
              </CardDescription>
              <CardTitle className="text-3xl font-extrabold text-foreground">
                {formatAmount(latestSupplierTlc)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {supplierTlcDelta !== null ? (
                <Badge
                  variant="secondary"
                  className={
                    supplierTlcDelta <= 0
                      ? "bg-success/15 text-success border border-success/25"
                      : "bg-primary/10 text-primary border border-primary/25"
                  }
                >
                  {supplierTlcDelta >= 0 ? "+" : ""}
                  {formatAmount(supplierTlcDelta)} vs previous month
                </Badge>
              ) : (
                <Badge variant="secondary" className="border border-border bg-muted/30 text-muted-foreground">
                  {previousVendorEntry ? "No prior supplier TLC row" : "Single month in range"}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">
                Latest <span className="font-medium text-foreground">Total Resin Price ABI VIRGIN Formula</span> from
                vendor data.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/25 py-2 px-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <CardHeader className="pb-2 space-y-1">
              <CardDescription>Market Research TLC (benchmark)</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-primary">
                {formatAmount(marketResearchSnapshot)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge variant="secondary" className="border border-border bg-muted/30 text-muted-foreground">
                Country snapshot (not monthly)
              </Badge>
              <p className="text-xs text-muted-foreground">
                Total landed cost from the market research country breakdown for{" "}
                <span className="font-medium text-foreground">{effectiveSourceCountry}</span>.
              </p>
            </CardContent>
          </Card>

        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Monthly Market Research TLC vs Supplier TLC</CardTitle>
            <CardDescription>
              {(selectedDestination || "Colombia")} vs {effectiveSourceCountry} from Jan 2026 to Mar 2026.
            </CardDescription>
            <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-md border border-primary/35 bg-[rgba(230,168,23,0.1)] px-2.5 py-1 text-[11px] font-semibold text-primary">
              <span aria-hidden>⚠</span>
              <span>
                Market Research TLC is a single benchmark from country breakdown (flat line). Supplier TLC uses
                vendor rows only—missing months show as gaps.
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={destinationSourceMonthly} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={shortMonthTick}
                      interval={0}
                      minTickGap={10}
                      tickMargin={8}
                      padding={{ left: 8, right: 24 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }} />
                    <Line
                      type="monotone"
                      dataKey="marketResearchValue"
                      name="Market Research TLC"
                      stroke={ABI_GOLD}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="supplierTlcValue"
                      name="Supplier TLC"
                      stroke={ABI_PRIMARY_BLUE}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: ABI_PRIMARY_BLUE }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Average TLC Comparison</CardTitle>
            <CardDescription>
              Average values from Jan 2026 to Mar 2026 for {(selectedDestination || "Colombia")} vs{" "}
              {effectiveSourceCountry}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={averageMonthlyTlcData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }} />
                    <Bar
                      dataKey="averageMarketResearchTlc"
                      name="Average Market Research TLC"
                      fill={ABI_GOLD}
                      radius={[6, 6, 0, 0]}
                    >
                      <LabelList dataKey="averageMarketResearchTlc" position="top" content={AverageTlcBarLabel("averageMarketResearchTlcRaw")} />
                    </Bar>
                    <Bar
                      dataKey="averageSupplierTlc"
                      name="Average Supplier TLC"
                      fill={ABI_PRIMARY_BLUE}
                      radius={[6, 6, 0, 0]}
                    >
                      <LabelList dataKey="averageSupplierTlc" position="top" content={AverageTlcBarLabel("averageSupplierTlcRaw")} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Supplier cost components breakdown</CardTitle>
            <CardDescription>
              Resin index, financing, freight (regular/incremental), and others across months from backend supplier rows.
              Missing values remain zero.
            </CardDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTrendSeries("all")}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  selectedTrendSeries === "all"
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {TREND_COMPONENT_SERIES.map((series) => (
                <button
                  key={series.key}
                  type="button"
                  onClick={() => setSelectedTrendSeries(series.key)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    selectedTrendSeries === series.key
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {series.key}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendDataStyled} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={shortMonthTick}
                      interval={0}
                      minTickGap={10}
                      tickMargin={8}
                      padding={{ left: 8, right: 24 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }} />
                    {TREND_COMPONENT_SERIES
                      .filter(
                        (series) =>
                          selectedTrendSeries === "all" || selectedTrendSeries === series.key
                      )
                      .map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={`${series.key}Solid`}
                          name={series.key}
                          stroke={series.color}
                          strokeWidth={2.2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default VendorBreakdownDashboard;
