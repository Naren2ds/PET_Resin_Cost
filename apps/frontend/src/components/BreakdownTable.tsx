import React, { useMemo, useState } from "react";
import { ABIResponsiveTable } from "@ab-inbev-labs/ux-react-components";
import type { BreakdownItem } from "../types";
import { formatAmount } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type VendorBreakdownItem = {
  label: string;
  amount: string | number | null | undefined;
  formulaReference?: string;
  commonComponent?: string;
  mappingColumn?: string;
  rawLabel?: string;
  dataType?: string;
  sourceFile?: string;
  location?: string;
  resinIndexType?: string;
  forecastResinIndexType?: string;
};

type BreakdownTableProps = {
  breakdown: BreakdownItem[];
  vendorBreakdown?: VendorBreakdownItem[];
  supplierName?: string;
};

type DetailCellRow = {
  label: string;
  amount: string | number | null | undefined;
  isReference?: boolean;
};

type CombinedDetailRow = {
  component: string;
  marketRows: DetailCellRow[];
  supplierRows: DetailCellRow[];
};

const dedupeDetailRows = (rows: DetailCellRow[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [
      normalize(row.label),
      String(row.amount ?? ""),
      row.isReference ? "ref" : "nonref",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const COMMON_COMPONENT_ORDER = [
  "Resin Index",
  "Freight",
  "Insurance",
  "Duty & Import Taxes",
  "Local Taxes & Fees",
  "Logistics & Other Costs",
  "Total Landed Cost (PET Resin)",
];

const SUPPLIER_MAPPING: Record<string, string> = {
  "icis china mid (n-1)": "Resin Index",
  finance: "Insurance",
  "freight china-buenaventura (regular)": "Freight",
  "freight china-buenaventura (incremental)": "Freight",
  "duty 5% (change according to regulation)": "Duty & Import Taxes",
  "landed factor 8%": "Local Taxes & Fees",
  "zf legislation change": "Local Taxes & Fees",
  "sur charge alpek br": "Logistics & Other Costs",
  "total resin price abi virgin formula": "Total Landed Cost (PET Resin)",
};

const DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING: Record<string, string> = {
  "resin index vpet": "Resin Index",
  freight: "Freight",
  tax: "Duty & Import Taxes",
  insurance: "Insurance",
};

const MARKET_COLUMN_MAPPING: Record<string, string> = {
  "resin index vpet": "Resin Index",
  freight: "Freight",
  insurance: "Insurance",
  tax: "Duty & Import Taxes",
  "customs clearance": "Local Taxes & Fees",
  others: "Logistics & Other Costs",
  "total landing cost": "Total Landed Cost (PET Resin)",
};

const MARKET_MAPPING: Record<string, string> = {
  "pet resin cost (fob)": "Resin Index",
  "pet resin cost (fob):": "Resin Index",
  "freight cost": "Freight",
  "freight cost:": "Freight",
  insurance: "Insurance",
  "import duty": "Duty & Import Taxes",
  "import duty:": "Duty & Import Taxes",
  "anti-dumping duty": "Duty & Import Taxes",
  "anti-dumping duty:": "Duty & Import Taxes",
  ipi: "Duty & Import Taxes",
  pis: "Duty & Import Taxes",
  confins: "Duty & Import Taxes",
  "statistical fee": "Duty & Import Taxes",
  "additional vat": "Duty & Import Taxes",
  "income tax perception": "Duty & Import Taxes",
  ibb: "Duty & Import Taxes",
  "tasa consular": "Duty & Import Taxes",
  "customs service fee": "Local Taxes & Fees",
  irae: "Local Taxes & Fees",
  "customs insurance": "Insurance",
  "impuesto general a las ventas (igv & ipm)": "Duty & Import Taxes",
  "percepcion igv": "Duty & Import Taxes",
  fodinfa: "Duty & Import Taxes",
  "taxes (vat/import)": "Duty & Import Taxes",
  "taxes (vat/import):": "Duty & Import Taxes",
  "destination port to supplier location transportation": "Freight",
  "total landed cost (pet resin)": "Total Landed Cost (PET Resin)",
};

const HIDDEN_MARKET_RESEARCH_DETAIL_LABELS = new Set([
  "difference with current vpet resin price charged by preform supplier",
]);

const normalize = (label: string | undefined) =>
  (label ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || normalized.toLowerCase() === "n/a" || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMetricTon = (value: string | number | null | undefined) =>
  `$${formatAmount(toNumber(value) ?? 0)}`;

const formatDifference = (value: number) =>
  `${value > 0 ? "+" : ""}$${formatAmount(value)}`;

const costSharePercent = (value: number, total: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return null;
  return Math.round((value / total) * 100);
};

const differenceClass = (value: number) => {
  if (value < 0) return "text-destructive";
  if (value > 0) return "text-success";
  return "text-muted-foreground";
};

const mappedSupplierComponent = (item: VendorBreakdownItem) => {
  const key = normalize(item.label);
  return (
    item.commonComponent ||
    SUPPLIER_MAPPING[key] ||
    DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING[key] ||
    item.mappingColumn ||
    item.label
  );
};

const mappedMarketComponent = (item: BreakdownItem) => {
  const labelKey = normalize(item.label);
  const rawLabelKey = normalize(item.rawLabel);
  const mappingColumnKey = normalize(item.mappingColumn);
  return (
    item.commonComponent ||
    MARKET_COLUMN_MAPPING[mappingColumnKey] ||
    MARKET_MAPPING[rawLabelKey] ||
    MARKET_MAPPING[labelKey] ||
    ""
  );
};

const isMarketResearchComparisonRow = (item: BreakdownItem) => {
  if (HIDDEN_MARKET_RESEARCH_DETAIL_LABELS.has(normalize(item.label))) return false;
  return normalize(item.columnRequiredForCalculation) !== "no";
};

const componentSortIndex = (component: string) => {
  const index = COMMON_COMPONENT_ORDER.indexOf(component);
  return index >= 0 ? index : COMMON_COMPONENT_ORDER.length;
};

const detailDisplayLabel = (item: {
  rawLabel?: string;
  label: string;
  resinIndexType?: string;
  forecastResinIndexType?: string;
}, component: string) => {
  if (normalize(component) === "resin index") {
    return (
      item.resinIndexType?.trim() ||
      item.forecastResinIndexType?.trim() ||
      item.rawLabel?.trim() ||
      item.label
    );
  }
  return item.rawLabel?.trim() || item.label;
};

const AmountWithShare = ({
  value,
  share,
}: {
  value: string | number | null | undefined;
  share: number | null;
}) => (
  <span className="inline-flex items-baseline justify-end gap-1.5 whitespace-nowrap">
    <span>{formatMetricTon(value)}</span>
    {share !== null ? (
      <span className="text-[11px] font-medium text-muted-foreground/75">
        ({share}%)
      </span>
    ) : null}
  </span>
);

const detailCellRows = (rows: DetailCellRow[], emptyText: string) => {
  if (!rows.length) {
    return <span className="text-sm text-muted-foreground">{emptyText}</span>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${String(row.amount ?? "")}-${index}`}
          className="grid grid-cols-[minmax(0,1fr)_96px] items-start gap-3 rounded-md border border-border/60 bg-background/30 px-2.5 py-2"
        >
          <div className="min-w-0">
            <p className="whitespace-normal break-words text-sm font-medium leading-snug text-foreground">
              {row.label}
            </p>
            {row.isReference ? (
              <span className="mt-1 inline-block rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reference
              </span>
            ) : null}
          </div>
          <span className="text-right text-sm tabular-nums text-muted-foreground">
            {formatMetricTon(row.amount)}
          </span>
        </div>
      ))}
    </div>
  );
};

const dedupeVendorRows = (rows: VendorBreakdownItem[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [
      normalize(row.label),
      normalize(row.commonComponent),
      normalize(row.mappingColumn),
      normalize(row.formulaReference),
      String(row.amount ?? ""),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const BreakdownTable: React.FC<BreakdownTableProps> = ({
  breakdown,
  vendorBreakdown = [],
  supplierName = "",
}) => {
  const [showCostDetailTable, setShowCostDetailTable] = useState(true);

  const compactVendorBreakdown = useMemo(
    () => dedupeVendorRows(vendorBreakdown),
    [vendorBreakdown]
  );

  const comparisonRows = useMemo(() => {
    const marketSums = new Map<string, number>();
    const supplierSums = new Map<string, number>();

    breakdown.filter(isMarketResearchComparisonRow).forEach((item) => {
      const mapped = mappedMarketComponent(item);
      if (!mapped) return;
      marketSums.set(mapped, (marketSums.get(mapped) ?? 0) + (toNumber(item.amount) ?? 0));
    });

    compactVendorBreakdown.forEach((item) => {
      const mapped = mappedSupplierComponent(item);
      if (!mapped) return;
      supplierSums.set(mapped, (supplierSums.get(mapped) ?? 0) + (toNumber(item.amount) ?? 0));
    });

    const marketTotal = marketSums.get("Total Landed Cost (PET Resin)") ?? 0;
    const supplierTotal = supplierSums.get("Total Landed Cost (PET Resin)") ?? 0;

    return COMMON_COMPONENT_ORDER.map((component) => {
      const marketValue = marketSums.get(component) ?? 0;
      const supplierValue = supplierSums.get(component) ?? 0;
      return {
        component,
        marketValue,
        supplierValue,
        marketShare: costSharePercent(marketValue, marketTotal),
        supplierShare: costSharePercent(supplierValue, supplierTotal),
        differenceValue: marketValue - supplierValue,
      };
    });
  }, [breakdown, compactVendorBreakdown]);

  const combinedDetailRows = useMemo<CombinedDetailRow[]>(() => {
    const marketGroups = new Map<string, DetailCellRow[]>();
    const supplierGroups = new Map<string, DetailCellRow[]>();

    breakdown
      .filter(
        (item) => !HIDDEN_MARKET_RESEARCH_DETAIL_LABELS.has(normalize(item.label))
      )
      .forEach((item) => {
        const component = mappedMarketComponent(item);
        if (!component) return;
        const rows = marketGroups.get(component) ?? [];
        rows.push({
          label: detailDisplayLabel(item, component),
          amount: item.amount,
          isReference: normalize(item.columnRequiredForCalculation) === "no",
        });
        marketGroups.set(component, rows);
      });

    compactVendorBreakdown.forEach((item) => {
      const component = mappedSupplierComponent(item);
      if (!component) return;
      const rows = supplierGroups.get(component) ?? [];
      rows.push({
        label: detailDisplayLabel(item, component),
        amount: item.amount,
      });
      supplierGroups.set(component, rows);
    });

    const components = Array.from(
      new Set([
        ...COMMON_COMPONENT_ORDER,
        ...Array.from(marketGroups.keys()),
        ...Array.from(supplierGroups.keys()),
      ])
    )
      .filter(
        (component) =>
          (marketGroups.get(component)?.length ?? 0) ||
          (supplierGroups.get(component)?.length ?? 0)
      )
      .sort((a, b) => {
        const byOrder = componentSortIndex(a) - componentSortIndex(b);
        return byOrder !== 0 ? byOrder : a.localeCompare(b);
      });

    return components.map((component) => ({
      component,
      marketRows: dedupeDetailRows(marketGroups.get(component) ?? []),
      supplierRows: dedupeDetailRows(supplierGroups.get(component) ?? []),
    }));
  }, [breakdown, compactVendorBreakdown]);

  const marketTlcFormula = useMemo(() => {
    const formula = breakdown
      .filter((item) => mappedMarketComponent(item) === "Total Landed Cost (PET Resin)")
      .map((item) => item.formulaReference?.trim())
      .find((value): value is string => Boolean(value));
    return formula ?? "";
  }, [breakdown]);

  const supplierTlcFormula = useMemo(() => {
    const formula = compactVendorBreakdown
      .map((item) => item.formulaReference?.trim())
      .find((value): value is string => Boolean(value));
    return formula ?? "";
  }, [compactVendorBreakdown]);

  const comparisonHeaders = useMemo(
    () => [
      { header: "Common Component", accessor: "component" },
      { header: "Market Research ($/MT)", accessor: "market" },
      { header: supplierName ? `Supplier ($/MT) - ${supplierName}` : "Supplier ($/MT)", accessor: "supplier" },
      { header: "Difference (Market - Supplier)", accessor: "difference" },
    ],
    [supplierName]
  );

  const comparisonData = useMemo(
    () =>
      comparisonRows.map((row, idx) => ({
        fields: {
          component: [
            <span key="component" className="font-medium text-foreground">
              {idx + 1}. {row.component}
            </span>,
          ],
          market: [
            <span key="market" className="text-right tabular-nums text-muted-foreground">
              <AmountWithShare value={row.marketValue} share={row.marketShare} />
            </span>,
          ],
          supplier: [
            <span key="supplier" className="text-right tabular-nums text-muted-foreground">
              <AmountWithShare value={row.supplierValue} share={row.supplierShare} />
            </span>,
          ],
          difference: [
            <span
              key="difference"
              className={`text-right tabular-nums font-semibold ${differenceClass(
                row.differenceValue
              )}`}>
              {formatDifference(row.differenceValue)}
            </span>,
          ],
        },
      })),
    [comparisonRows]
  );

  const detailHeaders = useMemo(
    () => [
      { header: "Common Component", accessor: "component" },
      { header: "Market Research Column", accessor: "marketDetail" },
      {
        header: supplierName
          ? `Supplier Raw Cost Breakdown (${supplierName})`
          : "Supplier Raw Cost Breakdown",
        accessor: "supplierDetail",
      },
    ],
    [supplierName]
  );

  const detailData = useMemo(() => {
    const rows = combinedDetailRows.map((row, idx) => ({
      fields: {
        component: [
          <span key="component" className="whitespace-normal break-words font-semibold leading-snug text-foreground">
            {idx + 1}. {row.component}
          </span>,
        ],
        marketDetail: [detailCellRows(row.marketRows, "No Market Research row")],
        supplierDetail: [detailCellRows(row.supplierRows, "No supplier row")],
      },
    }));

    if (marketTlcFormula || supplierTlcFormula) {
      rows.push({
        fields: {
          component: [
            <span key="component" className="font-semibold text-foreground">
              {combinedDetailRows.length + 1}. TLC Formulae
            </span>,
          ],
          marketDetail: [
            <span
              key="marketFormula"
              className="whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
              {marketTlcFormula || "No Market Research formula available."}
            </span>,
          ],
          supplierDetail: [
            <span
              key="supplierFormula"
              className="whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
              {supplierTlcFormula || "No supplier formula available."}
            </span>,
          ],
        },
      });
    }

    return rows;
  }, [combinedDetailRows, marketTlcFormula, supplierTlcFormula]);

  return (
    <Card className="animate-fade-in-up shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Unified Cost Component Comparison</CardTitle>
        <CardDescription>
          Market Research and Supplier values mapped to common components, shown as $ per Metric Ton.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-border">
          <ABIResponsiveTable
            id="breakdown-summary-responsive-table"
            ariaLabel="Unified Cost Component Comparison"
            headers={comparisonHeaders}
            data={comparisonData}
            className="!w-full"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowCostDetailTable((prev) => !prev)}
            className="flex w-full items-center justify-between border-l-4 border-primary/50 bg-primary/10 px-3 py-2 text-left"
          >
            <span className="text-sm font-semibold tracking-wide text-foreground">
              Common Component Detail Mapping
            </span>
            <span className="text-base font-bold text-primary/90" aria-hidden>
              {showCostDetailTable ? "-" : "+"}
            </span>
          </button>
          {showCostDetailTable ? (
            <div className="overflow-x-auto border-t border-border">
              <ABIResponsiveTable
                id="breakdown-detail-responsive-table"
                ariaLabel="Common Component Detail Mapping"
                headers={detailHeaders}
                data={detailData}
                className="!w-full !min-w-[980px]"
              />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default BreakdownTable;
