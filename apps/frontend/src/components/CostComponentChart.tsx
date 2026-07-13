import React, { useMemo } from "react";
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
import { supplierDisplayNameForEntry } from "../lib/supplierDisplay";
import { vendorYearMatches } from "../lib/colombiaVendorTlc";

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
  (c) => c !== "Total Landed Cost (PET Resin)"
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

const componentSortIndex = (c: string) => {
  const i = COMPONENT_ORDER.indexOf(c);
  return i >= 0 ? i : COMPONENT_ORDER.length;
};

const toComponentName = (row: CostRow) => {
  const component = row.commonComponent?.trim() || row.mappingColumn?.trim() || row.label.trim();
  if (normalize(component).includes(TOTAL_COMPONENT)) return "Total Landed Cost (PET Resin)";
  if (normalize(row.label).includes(DIFFERENCE_COMPONENT)) return "";
  return STACK_COMPONENTS.find((a) => normalize(a) === normalize(component)) ?? "";
};

const isStackableCostRow = (row: CostRow) => {
  if (normalize(row.columnRequiredForCalculation) === "no") return false;
  const component = toComponentName(row);
  if (!component || !STACK_COMPONENTS.includes(component)) return false;
  return parseNumber(row.amount) !== null;
};

const rowDisplayLabel = (row: CostRow) => {
  if (normalize(toComponentName(row)) === "resin index") {
    return (
      row.resinIndexType?.trim() ||
      row.forecastResinIndexType?.trim() ||
      row.rawLabel?.trim() ||
      row.label
    );
  }
  return row.rawLabel?.trim() || row.label;
};

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

  const datum: CostMixDatum = { id, axisLabel, label, kind, total, amounts: {}, sourceRows: {} };
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
    if (!bySupplier.has(key)) bySupplier.set(key, entry);
  });
  return Array.from(bySupplier.values()).sort((a, b) =>
    supplierDisplayNameForEntry(a).localeCompare(supplierDisplayNameForEntry(b))
  );
};

const buildComponentDefinitions = (rows: CostMixDatum[]): ComponentDefinition[] => {
  const namesWithData = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row.amounts).filter((c) => row.amounts[c] !== 0)))
  ).filter((c) => STACK_COMPONENTS.includes(c));

  const avgAmount = (c: string) => {
    const values = rows.map((row) => Number(row[c] ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  return namesWithData
    .sort((a, b) => {
      const byAmt = avgAmount(a) - avgAmount(b);
      if (byAmt !== 0) return byAmt;
      const byOrd = componentSortIndex(a) - componentSortIndex(b);
      return byOrd !== 0 ? byOrd : a.localeCompare(b);
    })
    .map((name) => ({ key: name, name, color: COMPONENT_COLORS[name] ?? "#7A7A7A" }));
};

const formatPercent = (value: number | string | undefined) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
};

const componentShareOfTotal = (amount: number, total: number) => {
  if (!Number.isFinite(amount) || !Number.isFinite(total) || total === 0) return 0;
  return (amount / total) * 100;
};

const CostMixTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as CostMixDatum | undefined;
  if (!datum) return null;
  const rows = payload
    .filter((item: any) => Number.isFinite(Number(item.value)) && Number(item.value) !== 0)
    .sort((a: any, b: any) => {
      const aAmount = datum.amounts[String(a.dataKey)] ?? Number(a.value) ?? 0;
      const bAmount = datum.amounts[String(b.dataKey)] ?? Number(b.value) ?? 0;
      return bAmount - aAmount;
    });
  return (
    <div className="pet-tooltip px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-6 text-sm">
        <span className="font-semibold text-foreground">{datum.kind}</span>
        <span className="font-bold text-foreground">${formatAmount(datum.total)}/MT</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((item: any) => {
          const component = String(item.dataKey);
          const amount = datum.amounts[component] ?? 0;
          const sRows = datum.sourceRows[component] ?? [];
          return (
            <div key={component} className="rounded-md bg-secondary px-2.5 py-2">
              <div className="flex items-center justify-between gap-5 text-sm">
                <span className="font-semibold" style={{ color: item.color }}>{component}</span>
                <span className="font-bold text-foreground">${formatAmount(amount)}/MT</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatPercent(componentShareOfTotal(amount, datum.total))} of TLC
              </p>
              {sRows.length ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                  {sRows.slice(0, 3).join(", ")}{sRows.length > 3 ? ` +${sRows.length - 3} more` : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AxisTick = ({ x = 0, y = 0, payload, kindByLabel }: any) => {
  const kind = (kindByLabel as Map<string, string> | undefined)?.get(payload?.value ?? "");
  const isMR = kind === "Market Research";
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="end" transform="rotate(-36)" fill="#5a5a5a" fontSize={11}>
        {payload?.value ?? ""}
      </text>
      {kind ? (
        <text
          x={0}
          y={18}
          dy={8}
          textAnchor="end"
          transform="rotate(-36)"
          fill={isMR ? "#0ea5e9" : "#f59e0b"}
          fontSize={9}
          fontWeight={700}
        >
          {isMR ? "Market Research" : "Supplier"}
        </text>
      ) : null}
    </g>
  );
};

type Props = {
  data: ApiResponse;
  destination: string;
  month: string;
  year: string;
};

/**
 * CostComponentChart
 * Pure chart component: renders the stacked cost-component bar chart
 * for the given destination/month/year context.  No own dropdowns or
 * page shell — intended to be embedded inside a parent card.
 */
const CostComponentChart: React.FC<Props> = ({ data, destination, month, year }) => {
  const chartRows = useMemo(() => {
    const marketRows = data.countries
      .map((country) =>
        buildCostMixDatum({
          id: `market-${country.country}`,
          label: country.country,
          axisLabel: country.country,
          kind: "Market Research",
          rows: country.breakdown,
          fallbackTotal: country.amount,
        })
      )
      .filter((row): row is CostMixDatum => Boolean(row));

    const supplierRows = dedupeSupplierEntries(
      data.vendorBreakdowns.filter(
        (entry) =>
          entry.destination === destination &&
          entry.month === month &&
          vendorYearMatches(entry.year, year)
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
  }, [data.countries, data.vendorBreakdowns, destination, month, year]);

  const componentDefinitions = useMemo(() => buildComponentDefinitions(chartRows), [chartRows]);

  const kindByLabel = useMemo(() => {
    const map = new Map<string, string>();
    chartRows.forEach((row) => map.set(row.axisLabel, row.kind));
    return map;
  }, [chartRows]);

  if (!chartRows.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
        No component rows available for the selected destination and month.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="h-[520px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={{ top: 26, right: 18, left: 2, bottom: 124 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
            <XAxis
              dataKey="axisLabel"
              interval={0}
              minTickGap={0}
              height={112}
              tick={<AxisTick kindByLabel={kindByLabel} />}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, "dataMax"]}
              tick={{ fontSize: 12, fill: "#5a5a5a" }}
              tickFormatter={(v) => `$${formatAmount(Number(v))}`}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip content={<CostMixTooltip />} />
            <Legend
              wrapperStyle={{ color: "#1a1a1a", fontSize: "12px", lineHeight: "20px", paddingTop: "4px" }}
            />
            {componentDefinitions.map((component, index) => (
              <Bar
                key={component.key}
                dataKey={component.key}
                name={component.name}
                stackId="cost"
                fill={component.color}
                radius={index === componentDefinitions.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CostComponentChart;
