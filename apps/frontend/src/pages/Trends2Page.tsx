import React, { useMemo, useState } from "react";
import type { ApiResponse, VendorBreakdownEntry } from "../types";
import RevealOnScroll from "../components/RevealOnScroll";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "../types";
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

type Trends2PageProps = {
  data: ApiResponse;
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
const DOTTED_START_YEAR = 2026;
const DOTTED_START_MONTH_INDEX = 2; // March

const ABI_CHART_COLORS = [
  "#003A70", // AB InBev Primary Blue
  "#00A3E0", // AB InBev Light Blue
  "#FFB81C", // AB InBev Gold
  "#2E5EAA",
  "#4F86C6",
  "#6FA8DC",
  "#94A3B8",
  "#001F3F",
  "#5B88C3",
  "#89B6E3",
];

const LINE_COLORS = [
  ...ABI_CHART_COLORS,
];

const parseNumericAmount = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "n/a") return null;
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const getSupplierTlc = (entry: VendorBreakdownEntry) => {
  const row = entry.rows.find(
    (item) =>
      item.label.trim().toLowerCase() ===
      "total resin price abi virgin formula".toLowerCase()
  );
  return parseNumericAmount(row?.amount);
};

const shortMonthTick = (value: string) => {
  const [month, year] = value.split(" ");
  if (!month || !year) return value;
  return `${month}-${year.slice(-2)}`;
};

const buildMonthlyPeriods = () => {
  const periods: { year: number; monthIndex: number; period: string }[] = [];
  for (let year = RANGE_START_YEAR; year <= RANGE_END_YEAR; year += 1) {
    const start = year === RANGE_START_YEAR ? RANGE_START_MONTH_INDEX : 0;
    const end = year === RANGE_END_YEAR ? RANGE_END_MONTH_INDEX : 11;
    for (let monthIndex = start; monthIndex <= end; monthIndex += 1) {
      periods.push({
        year,
        monthIndex,
        period: `${MONTH_ORDER[monthIndex].slice(0, 3)} ${year}`,
      });
    }
  }
  return periods;
};

const isDottedPeriod = (year: number, monthIndex: number) =>
  year > DOTTED_START_YEAR ||
  (year === DOTTED_START_YEAR && monthIndex >= DOTTED_START_MONTH_INDEX);

const Trends2Tooltip = ({ active, payload, label }: any) => {
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
  return (
    <div className="rounded-xl border border-primary/20 bg-[#020817]/95 px-4 py-3 shadow-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{label}</p>
      <div className="space-y-1.5">
        {uniqueRows.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6 text-sm">
            <span className="font-medium" style={{ color: item.color }}>
              {item.name}
            </span>
            <span className="font-semibold text-slate-100">
              {formatAmount(item.value as number | string | null | undefined)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Trends2Page: React.FC<Trends2PageProps> = ({ data }) => {
  const fixedDestination = "Colombia";
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(["China"]);

  const destinationEntries = useMemo(
    () =>
      data.vendorBreakdowns.filter((entry) => entry.destination === fixedDestination),
    [data.vendorBreakdowns]
  );

  const allSources = useMemo(
    () =>
      Array.from(
        new Set(data.countries.map((country) => country.country).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [data.countries]
  );

  const chartData = useMemo(() => {
    const periods = buildMonthlyPeriods();
    const actualBySourceAndPeriod = new Map<string, number>();
    destinationEntries.forEach((entry) => {
      const monthIndex = MONTH_ORDER.indexOf(entry.month);
      if (monthIndex < 0) return;
      const period = `${entry.month.slice(0, 3)} ${entry.year}`;
      const value = getSupplierTlc(entry);
      if (value === null) return;
      actualBySourceAndPeriod.set(`${entry.sourceCountry}|${period}`, value);
    });

    return periods.map((periodItem) => {
      const row: Record<string, string | number | null> = {
        period: periodItem.period,
        year: periodItem.year,
        monthIndex: periodItem.monthIndex,
      };

      allSources.forEach((source) => {
        const actual = actualBySourceAndPeriod.get(`${source}|${periodItem.period}`);
        if (actual !== undefined) {
          row[source] = actual;
          return;
        }
        row[source] = 0;
      });

      return row;
    });
  }, [allSources, destinationEntries]);

  const displayedSources = useMemo(() => {
    if (!selectedSuppliers.length) return allSources;
    return selectedSuppliers;
  }, [allSources, selectedSuppliers]);

  const chartDataWithStyles = useMemo(
    () =>
      chartData.map((row, index) => {
        const year = Number(row.year);
        const monthIndex = Number(row.monthIndex);
        const dotted = isDottedPeriod(year, monthIndex);
        const next = chartData[index + 1];
        const nextIsDotted =
          next !== undefined &&
          isDottedPeriod(Number(next.year), Number(next.monthIndex));
        const nextRow: Record<string, string | number | null> = { ...row };
        displayedSources.forEach((source) => {
          const value = row[source];
          nextRow[`${source}Solid`] = dotted ? null : (value as number | null);
          // Keep the immediate pre-dotted point in dashed series to create a visible dashed segment.
          nextRow[`${source}Dotted`] =
            dotted || nextIsDotted ? (value as number | null) : null;
        });
        return nextRow;
      }),
    [chartData, displayedSources]
  );

  const handleSupplierClick = (source: string, ctrlOrMetaPressed: boolean) => {
    setSelectedSuppliers((current) => {
      if (!ctrlOrMetaPressed) return [source];
      if (current.includes(source)) return current.filter((item) => item !== source);
      return [...current, source];
    });
  };

  const allSelected = allSources.length > 0 && allSources.every((source) => selectedSuppliers.includes(source));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card px-6 py-6 max-sm:px-4">
      <RevealOnScroll>
        <section className="mx-auto w-full max-w-[1400px] space-y-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Historical Supplier Comparison</CardTitle>
              <CardDescription>
                {fixedDestination} vs selectable source countries from Jan 2026 to Mar 2026.
              </CardDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSuppliers(allSources)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    allSelected
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSuppliers([])}
                  className="rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Clear
                </button>
                {allSources.map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={(event) => handleSupplierClick(source, event.ctrlKey || event.metaKey)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      selectedSuppliers.includes(source)
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Use Ctrl+Click (Cmd+Click on Mac) to add or remove multiple countries,
                or click Select All.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDataWithStyles} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
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
                      <YAxis
                        tick={{ fontSize: 12, fill: "#a1a1aa" }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip content={<Trends2Tooltip />} />
                      <Legend wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }} />
                      {displayedSources.map((source, index) => (
                        <React.Fragment key={source}>
                          <Line
                            type="monotone"
                            dataKey={`${source}Solid`}
                            name={source}
                            stroke={LINE_COLORS[index % LINE_COLORS.length]}
                            strokeWidth={2.4}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey={`${source}Dotted`}
                            name={source}
                            stroke={LINE_COLORS[index % LINE_COLORS.length]}
                            strokeWidth={2.4}
                            strokeDasharray="6 4"
                            dot={false}
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
        </section>
      </RevealOnScroll>
    </div>
  );
};

export default Trends2Page;
