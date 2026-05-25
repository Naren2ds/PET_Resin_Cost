import React, { useMemo, useState } from "react";
import type { BreakdownItem } from "../types";
import { formatAmount } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const detailDisplayLabel = (item: { rawLabel?: string; label: string }) =>
  item.rawLabel?.trim() || item.label;

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
        differenceValue: supplierValue - marketValue,
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
          label: detailDisplayLabel(item),
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
        label: detailDisplayLabel(item),
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
      marketRows: marketGroups.get(component) ?? [],
      supplierRows: supplierGroups.get(component) ?? [],
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

  return (
    <Card className="animate-fade-in-up shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Unified Cost Component Comparison</CardTitle>
        <CardDescription>
          Market Research and Supplier values mapped to common components, shown as $ per Metric Ton.
        </CardDescription>
        {supplierName ? (
          <div className="mt-2 inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Supplier</span>
            <span className="truncate font-bold text-foreground">{supplierName}</span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-b-2 border-primary/80 bg-primary hover:bg-primary">
                <TableHead className="w-[42px] text-center text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  #
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Common Component
                </TableHead>
                <TableHead className="w-[180px] text-right text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Market Research
                  <span className="block text-[9px] font-semibold normal-case tracking-normal opacity-80">
                    $ per Metric Ton
                  </span>
                </TableHead>
                <TableHead className="w-[180px] text-right text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Supplier
                  {supplierName ? (
                    <span className="block truncate text-[9px] font-semibold normal-case tracking-normal opacity-90">
                      {supplierName}
                    </span>
                  ) : null}
                  <span className="block text-[9px] font-semibold normal-case tracking-normal opacity-80">
                    $ per Metric Ton
                  </span>
                </TableHead>
                <TableHead className="w-[190px] text-right text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Difference
                  <span className="block text-[9px] font-semibold normal-case tracking-normal opacity-80">
                    Supplier - Market
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonRows.map((row, idx) => (
                <TableRow key={row.component} className="h-10">
                  <TableCell className="text-center text-[11px] text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.component}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    <AmountWithShare value={row.marketValue} share={row.marketShare} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    <AmountWithShare value={row.supplierValue} share={row.supplierShare} />
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${differenceClass(row.differenceValue)}`}>
                    {formatDifference(row.differenceValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[22%] whitespace-normal break-words">
                      Common Component
                    </TableHead>
                    <TableHead className="w-[39%] whitespace-normal break-words">
                      Market Research Column
                      <span className="block text-xs font-normal text-muted-foreground">
                        Raw cost breakdown and $ per Metric Ton
                      </span>
                    </TableHead>
                    <TableHead className="w-[39%] whitespace-normal break-words">
                      Supplier Raw Cost Breakdown
                      {supplierName ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          ({supplierName}) and $ per Metric Ton
                        </span>
                      ) : null}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedDetailRows.map((row, idx) => (
                    <TableRow key={row.component}>
                      <TableCell className="align-top">
                        <div className="flex gap-2">
                          <span className="mt-0.5 text-[11px] text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="whitespace-normal break-words font-semibold leading-snug text-foreground">
                            {row.component}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {detailCellRows(row.marketRows, "No Market Research row")}
                      </TableCell>
                      <TableCell className="align-top">
                        {detailCellRows(row.supplierRows, "No supplier row")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(marketTlcFormula || supplierTlcFormula) ? (
                    <TableRow>
                      <TableCell className="align-top">
                        <div className="flex gap-2">
                          <span className="mt-0.5 text-[11px] text-muted-foreground">
                            {combinedDetailRows.length + 1}
                          </span>
                          <span className="font-semibold text-foreground">TLC Formulae</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-xs leading-relaxed text-muted-foreground">
                        {marketTlcFormula || "No Market Research formula available."}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-xs leading-relaxed text-muted-foreground">
                        {supplierTlcFormula || "No supplier formula available."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default BreakdownTable;
