import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ApiResponse,
  BreakdownItem,
  VendorBreakdownEntry,
  VendorBreakdownRow,
} from "../types";
import { formatAmount } from "../types";
import RevealOnScroll from "../components/RevealOnScroll";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonthOptions } from "../lib/filterUtils";
import { supplierDisplayNameForEntry } from "../lib/supplierDisplay";
import { vendorYearMatches } from "../lib/colombiaVendorTlc";

type CostComponentsPageProps = {
  data: ApiResponse;
};

type CostRow = BreakdownItem | VendorBreakdownRow;

type CostMixDatum = Record<string, unknown> & {
  id: string;
  axisLabel: string;
  label: string;
  kind: "Market Research" | "Supplier";
  total: number;
  amounts: Record<string, number>;
  sourceRows: Record<string, string[]>;
};

type ComponentDefinition = {
  key: string;
  name: string;
  color: string;
};

const COMPONENT_ORDER = [
  "Resin Index",
  "Freight",
  "Insurance",
  "Duty & Import Taxes",
  "Local Taxes & Fees",
  "Logistics & Other Costs",
  "Total Landed Cost (PET Resin)",
];

const STACK_COMPONENTS = COMPONENT_ORDER.filter(
  (component) => component !== "Total Landed Cost (PET Resin)"
);

const COMPONENT_COLORS: Record<string, string> = {
  "Resin Index": "#7A7A7A",
  Freight: "#F97316",
  Insurance: "#3B82F6",
  "Duty & Import Taxes": "#DB3FA2",
  "Local Taxes & Fees": "#8B5CF6",
  "Logistics & Other Costs": "#E6A817",
};

const TOTAL_COMPONENT = "total landed cost";
const DIFFERENCE_COMPONENT = "difference";

const DEFAULT_DESTINATIONS = [
  "Brazil",
  "Argentina",
  "El Salvador and Honduras",
  "Colombia",
  "Peru",
  "Dominican Republic",
  "Nigeria",
  "Bolivia",
  "Korea",
  "Panama",
  "Uruguay",
  "Ecuador",
];

const normalize = (value: string | undefined | null) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "n/a") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const componentSortIndex = (component: string) => {
  const index = COMPONENT_ORDER.indexOf(component);
  return index >= 0 ? index : COMPONENT_ORDER.length;
};

const toComponentName = (row: CostRow) => {
  const component = row.commonComponent?.trim() || row.mappingColumn?.trim() || row.label.trim();
  if (normalize(component).includes(TOTAL_COMPONENT)) return "Total Landed Cost (PET Resin)";
  if (normalize(row.label).includes(DIFFERENCE_COMPONENT)) return "";
  return STACK_COMPONENTS.find(
    (allowedComponent) => normalize(allowedComponent) === normalize(component)
  ) ?? "";
};

const isStackableCostRow = (row: CostRow) => {
  const required = normalize(row.columnRequiredForCalculation);
  if (required === "no") return false;
  const component = toComponentName(row);
  if (!component) return false;
  if (!STACK_COMPONENTS.includes(component)) return false;
  return parseNumber(row.amount) !== null;
};

const rowDisplayLabel = (row: CostRow) => row.rawLabel?.trim() || row.label;

const findTotal = (rows: CostRow[], fallback: number | string | null | undefined) => {
  const totalRow = rows.find((row) => {
    const component = normalize(row.commonComponent);
    const label = normalize(row.label);
    return component.includes(TOTAL_COMPONENT) || label.includes(TOTAL_COMPONENT);
  });
  return parseNumber(totalRow?.amount) ?? parseNumber(fallback);
};

const shouldTreatAsReferenceValue = (component: string, value: number, total: number) => {
  if (normalize(component) === "resin index") return false;
  return Math.abs(value) > Math.abs(total) * 1.25;
};

const buildCostMixDatum = ({
  id,
  label,
  axisLabel,
  kind,
  rows,
  fallbackTotal,
}: {
  id: string;
  label: string;
  axisLabel: string;
  kind: CostMixDatum["kind"];
  rows: CostRow[];
  fallbackTotal: number | string | null | undefined;
}): CostMixDatum | null => {
  const total = findTotal(rows, fallbackTotal);
  if (total === null || !Number.isFinite(total) || total === 0) return null;

  const componentAmounts = new Map<string, number>();
  const sourceRows = new Map<string, string[]>();

  rows.filter(isStackableCostRow).forEach((row) => {
    const component = toComponentName(row);
    const value = parseNumber(row.amount);
    if (!component || value === null) return;
    if (shouldTreatAsReferenceValue(component, value, total)) return;

    componentAmounts.set(component, (componentAmounts.get(component) ?? 0) + value);
    const labels = sourceRows.get(component) ?? [];
    labels.push(rowDisplayLabel(row));
    sourceRows.set(component, labels);
  });

  const datum: CostMixDatum = {
    id,
    axisLabel,
    label,
    kind,
    total,
    amounts: {},
    sourceRows: {},
  };

  componentAmounts.forEach((amount, component) => {
    datum[component] = Number(amount.toFixed(2));
    datum.amounts[component] = amount;
    datum.sourceRows[component] = sourceRows.get(component) ?? [];
  });

  return datum;
};

const dedupeSupplierEntries = (entries: VendorBreakdownEntry[]) => {
  const bySupplier = new Map<string, VendorBreakdownEntry>();
  entries.forEach((entry) => {
    const displayName = supplierDisplayNameForEntry(entry);
    const key = [
      normalize(entry.destination),
      normalize(displayName),
      normalize(entry.location),
      normalize(entry.supplier),
      normalize(entry.sourceFile),
    ].join("|");
    if (!bySupplier.has(key)) {
      bySupplier.set(key, entry);
    }
  });
  return Array.from(bySupplier.values()).sort((a, b) =>
    supplierDisplayNameForEntry(a).localeCompare(supplierDisplayNameForEntry(b))
  );
};

const buildComponentDefinitions = (rows: CostMixDatum[]): ComponentDefinition[] => {
  const namesWithData = Array.from(
    new Set(
      rows.flatMap((row) =>
        Object.keys(row.amounts).filter((component) => row.amounts[component] !== 0)
      )
    )
  ).filter((component) => STACK_COMPONENTS.includes(component));
  const averageAmount = (component: string) => {
    const values = rows
      .map((row) => Number(row[component] ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  };

  const names = namesWithData.sort((a, b) => {
    const byAmount = averageAmount(a) - averageAmount(b);
    if (byAmount !== 0) return byAmount;
    const byOrder = componentSortIndex(a) - componentSortIndex(b);
    return byOrder !== 0 ? byOrder : a.localeCompare(b);
  });

  return names.map((name) => ({
    key: name,
    name,
    color: COMPONENT_COLORS[name] ?? "#7A7A7A",
  }));
};

const formatPercent = (value: number | string | undefined) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "0%";
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%`;
};

const componentShareOfTotal = (amount: number, total: number) => {
  if (!Number.isFinite(amount) || !Number.isFinite(total) || total === 0) return 0;
  return (amount / total) * 100;
};

const CostMixTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as CostMixDatum | undefined;
  if (!datum) return null;

  const rows = payload.filter((item: any) => {
    const value = Number(item.value);
    return Number.isFinite(value) && value !== 0;
  });

  return (
    <div className="pet-tooltip px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-6 text-sm">
        <span className="font-semibold text-foreground">{datum.kind}</span>
        <span className="font-bold text-foreground">${formatAmount(datum.total)}/MT</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((item: any) => {
          const component = String(item.dataKey);
          const amount = datum.amounts[component] ?? 0;
          const sourceRows = datum.sourceRows[component] ?? [];
          return (
            <div key={component} className="rounded-md bg-secondary px-2.5 py-2">
              <div className="flex items-center justify-between gap-5 text-sm">
                <span className="font-semibold" style={{ color: item.color }}>
                  {component}
                </span>
                <span className="font-bold text-foreground">
                  ${formatAmount(amount)}/MT
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatPercent(componentShareOfTotal(amount, datum.total))} of TLC
              </p>
              {sourceRows.length ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                  {sourceRows.slice(0, 3).join(", ")}
                  {sourceRows.length > 3 ? ` +${sourceRows.length - 3} more` : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AxisTick = ({ x = 0, y = 0, payload }: any) => (
  <g transform={`translate(${x},${y})`}>
    <text
      x={0}
      y={0}
      dy={12}
      textAnchor="end"
      transform="rotate(-36)"
      fill="#5a5a5a"
      fontSize={11}
    >
      {payload?.value ?? ""}
    </text>
  </g>
);

const CostComponentsPage: React.FC<CostComponentsPageProps> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDestination = searchParams.get("destination") || data.destination || "";
  const selectedYear = searchParams.get("year") || data.year || "2026";
  const monthOptions = useMemo(
    () => getMonthOptions(selectedYear, selectedDestination),
    [selectedDestination, selectedYear]
  );
  const requestedMonth = searchParams.get("month") || data.month || monthOptions[0] || "";
  const selectedMonth = monthOptions.includes(requestedMonth)
    ? requestedMonth
    : monthOptions[0] ?? requestedMonth;

  const destinationOptions = useMemo(() => {
    const options = new Set<string>(DEFAULT_DESTINATIONS);
    if (data.destination) options.add(data.destination);
    data.vendorBreakdowns.forEach((entry) => {
      if (entry.destination) options.add(entry.destination);
    });
    return Array.from(options).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [data.destination, data.vendorBreakdowns]);

  useEffect(() => {
    const missingDestination = !searchParams.get("destination");
    const missingMonth = !searchParams.get("month");
    const missingYear = !searchParams.get("year");
    const invalidMonth = Boolean(requestedMonth) && requestedMonth !== selectedMonth;

    if (!missingDestination && !missingMonth && !missingYear && !invalidMonth) return;

    const next = new URLSearchParams(searchParams);
    next.set("destination", selectedDestination);
    next.set("month", selectedMonth);
    next.set("year", selectedYear);
    setSearchParams(next, { replace: true });
  }, [
    requestedMonth,
    searchParams,
    selectedDestination,
    selectedMonth,
    selectedYear,
    setSearchParams,
  ]);

  const chartRows = useMemo(() => {
    const marketRows = data.countries
      .map((country) =>
        buildCostMixDatum({
          id: `market-${country.country}`,
          label: `MR ${country.country}`,
          axisLabel: `MR ${country.country}`,
          kind: "Market Research",
          rows: country.breakdown,
          fallbackTotal: country.amount,
        })
      )
      .filter((row): row is CostMixDatum => Boolean(row));

    const supplierRows = dedupeSupplierEntries(
      data.vendorBreakdowns.filter(
        (entry) =>
          entry.destination === selectedDestination &&
          entry.month === selectedMonth &&
          vendorYearMatches(entry.year, selectedYear)
      )
    )
      .map((entry) => {
        const supplierName = supplierDisplayNameForEntry(entry);
        return buildCostMixDatum({
          id: `supplier-${supplierName}-${entry.location ?? ""}`,
          label: supplierName,
          axisLabel: supplierName,
          kind: "Supplier",
          rows: entry.rows,
          fallbackTotal: null,
        });
      })
      .filter((row): row is CostMixDatum => Boolean(row));

    return [...marketRows, ...supplierRows];
  }, [
    data.countries,
    data.vendorBreakdowns,
    selectedDestination,
    selectedMonth,
    selectedYear,
  ]);

  const componentDefinitions = useMemo(
    () => buildComponentDefinitions(chartRows),
    [chartRows]
  );

  const marketCount = data.countries.length;
  const supplierCount = chartRows.filter((row) => row.kind === "Supplier").length;

  return (
    <div className="pet-page-bg min-h-screen px-6 py-6 max-sm:px-4">
      <RevealOnScroll>
        <section className="mx-auto w-full max-w-[1480px] space-y-4">
          <Card className="border-primary/10 bg-card/80 shadow-lg">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Cost Component Mix</CardTitle>
                  <CardDescription className="mt-1">
                    Actual USD/MT cost by common component, indexed to the selected destination and month.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[220px]">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Destination
                    </label>
                    <select
                      value={selectedDestination}
                      onChange={(event) => {
                        const next = new URLSearchParams(searchParams);
                        next.set("destination", event.target.value);
                        next.set("month", selectedMonth);
                        next.set("year", selectedYear);
                        next.delete("source");
                        next.delete("supplier");
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
                  <div className="min-w-[180px]">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Month
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(event) => {
                        const next = new URLSearchParams(searchParams);
                        next.set("destination", selectedDestination);
                        next.set("month", event.target.value);
                        next.set("year", selectedYear);
                        next.delete("source");
                        next.delete("supplier");
                        setSearchParams(next);
                      }}
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Destination
                  </p>
                  <p className="mt-1 text-base font-extrabold text-primary">
                    {selectedDestination}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Period
                  </p>
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {selectedMonth} {selectedYear}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Bars
                  </p>
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {marketCount} MR countries
                    <span className="ml-2 text-xs font-semibold text-muted-foreground">
                      {supplierCount} suppliers
                    </span>
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {chartRows.length ? (
                <div className="rounded-xl border border-border bg-card/40 p-3">
                  <div className="h-[560px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartRows}
                        margin={{ top: 26, right: 18, left: 2, bottom: 124 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                        <XAxis
                          dataKey="axisLabel"
                          interval={0}
                          minTickGap={0}
                          height={112}
                          tick={<AxisTick />}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, "dataMax"]}
                          tick={{ fontSize: 12, fill: "#5a5a5a" }}
                          tickFormatter={(value) => `$${formatAmount(Number(value))}`}
                          tickLine={false}
                          axisLine={false}
                          width={72}
                        />
                        <Tooltip content={<CostMixTooltip />} />
                        <Legend
                          wrapperStyle={{
                            color: "#1a1a1a",
                            fontSize: "12px",
                            lineHeight: "20px",
                            paddingTop: "4px",
                          }}
                        />
                        {componentDefinitions.map((component, index) => (
                          <Bar
                            key={component.key}
                            dataKey={component.key}
                            name={component.name}
                            stackId="cost"
                            fill={component.color}
                            radius={
                              index === componentDefinitions.length - 1
                                ? [5, 5, 0, 0]
                                : [0, 0, 0, 0]
                            }
                            maxBarSize={48}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
                  No component rows available for the selected destination and month.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </RevealOnScroll>
    </div>
  );
};

export default CostComponentsPage;
