import React, { useMemo, useState } from "react";
import type { BreakdownItem } from "../types";
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
  valueFormat?: "currency" | "percentage";
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
  valueFormat?: "currency" | "percentage";
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
  "resin price index": "Resin Index",
  "resin with assumptions": "Resin Index",
  "icis asia se low (n-1)": "Resin Index",
  "icis asia se low (m-2)": "Resin Index",
  finance: "Insurance",
  "freight china-buenaventura (regular)": "Freight",
  "freight china-buenaventura (incremental)": "Freight",
  "duty 5% (change according to regulation)": "Duty & Import Taxes",
  "landed factor 8%": "Local Taxes & Fees",
  "zf legislation change": "Local Taxes & Fees",
  "sur charge alpek br": "Logistics & Other Costs",
  "additional cost index china": "Duty & Import Taxes",
  "taxes (vat/import)": "Duty & Import Taxes",
  // Brazil Amcor SUAPE / MANAUS â€” raw label from standardized workbook
  duties: "Duty & Import Taxes",
  "total resin price abi virgin formula": "Total Landed Cost (PET Resin)",
};

const DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING: Record<string, string> = {
  "resin index vpet": "Resin Index",
  freight: "Freight",
  tax: "Local Taxes & Fees",
  insurance: "Insurance",
  others: "Logistics & Other Costs",
  discount: "Logistics & Other Costs",
  fx: "Logistics & Other Costs",
  index: "Resin Index",
  "total landing cost": "Total Landed Cost (PET Resin)",
  "total landing cost (lc)": "Total Landed Cost (PET Resin)",
};

const HIDDEN_SUPPLIER_COMPARISON_LABELS = new Set([
  "sub total (with incremental freight)",
  "sub total (with regular freight)",
  "sub total (cif)",
]);

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

const formatBreakdownAmount = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatMetricTon = (value: string | number | null | undefined) =>
  `$${formatBreakdownAmount(toNumber(value) ?? 0)}`;

const formatDetailAmount = (row: DetailCellRow) => {
  const value = toNumber(row.amount) ?? 0;
  if (row.valueFormat === "percentage") {
    return `${formatBreakdownAmount(value * 100).replace(/\.00$/, "")}%`;
  }
  return `$${formatBreakdownAmount(value)}`;
};

const formatDifference = (value: number) =>
  `${value > 0 ? "+" : ""}$${formatBreakdownAmount(value)}`;

const costSharePercent = (value: number, total: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return null;
  return Math.round((value / total) * 100);
};

const differenceClass = (value: number) => {
  if (value < 0) return "text-destructive";
  if (value > 0) return "text-success";
  return "text-foreground";
};

const mappedSupplierComponent = (item: VendorBreakdownItem) => {
  const key = normalize(item.label);
  const rawKey = normalize(item.rawLabel);
  const mappingKey = normalize(item.mappingColumn);
  const commonKey = normalize(item.commonComponent);

  if (
    mappingKey.includes("total landing cost") ||
    key.includes("total resin price abi virgin formula") ||
    key.includes("total landing cost") ||
    rawKey.includes("total resin price abi virgin formula") ||
    rawKey.includes("total landing cost")
  ) {
    return "Total Landed Cost (PET Resin)";
  }

  // Prefer explicit bucket mappings first to avoid leaking raw component names.
  const mapped =
    SUPPLIER_MAPPING[rawKey] ||
    SUPPLIER_MAPPING[key] ||
    DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING[mappingKey] ||
    DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING[key] ||
    DESTINATION_INPUTS_FINAL_SUPPLIER_MAPPING[commonKey];
  if (mapped) return mapped;

  if (mappingKey === "freight" || commonKey === "freight") return "Freight";
  if (mappingKey === "insurance" || commonKey === "insurance") return "Insurance";
  if (mappingKey === "resin index vpet" || mappingKey === "index" || commonKey === "resin index") {
    return "Resin Index";
  }
  if (mappingKey === "tax" || commonKey === "tax") return "Local Taxes & Fees";
  if (
    mappingKey === "others" ||
    mappingKey === "discount" ||
    mappingKey === "fx" ||
    commonKey === "others"
  ) {
    return "Logistics & Other Costs";
  }

  return (
    item.commonComponent ||
    item.mappingColumn ||
    item.label
  );
};

const isSupplierComparisonRow = (item: VendorBreakdownItem) => {
  const labelKey = normalize(item.label);
  const mappingKey = normalize(item.mappingColumn);
  if (HIDDEN_SUPPLIER_COMPARISON_LABELS.has(labelKey)) return false;
  if (mappingKey === "sub total (cif)") return false;
  return true;
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
  if (normalize(component) === "internalization") {
    return COMMON_COMPONENT_ORDER.indexOf("Total Landed Cost (PET Resin)") - 0.5;
  }
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
      <span className="text-[11px] font-medium text-foreground/75">
        ({share}%)
      </span>
    ) : null}
  </span>
);

const detailCellRows = (rows: DetailCellRow[], emptyText: string) => {
  if (!rows.length) {
    return <span className="text-sm text-foreground">{emptyText}</span>;
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
              <span className="mt-1 inline-block rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Reference
              </span>
            ) : null}
          </div>
          <span className="text-right text-sm tabular-nums text-foreground">
            {formatDetailAmount(row)}
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
}) => {
  const [showCostDetailTable, setShowCostDetailTable] = useState(true);

  const compactVendorBreakdown = useMemo(
    () => dedupeVendorRows(vendorBreakdown),
    [vendorBreakdown]
  );

  const comparisonRows = useMemo(() => {
    const marketSums = new Map<string, number>();
    const supplierSums = new Map<string, number>();
    const supplierRates = new Map<string, number[]>();

    breakdown.filter(isMarketResearchComparisonRow).forEach((item) => {
      const mapped = mappedMarketComponent(item);
      if (!mapped) return;
      marketSums.set(mapped, (marketSums.get(mapped) ?? 0) + (toNumber(item.amount) ?? 0));
    });

    compactVendorBreakdown.filter(isSupplierComparisonRow).forEach((item) => {
      const mapped = mappedSupplierComponent(item);
      if (!mapped) return;
      const value = toNumber(item.amount) ?? 0;
      if (item.valueFormat === "percentage") {
        const rates = supplierRates.get(mapped) ?? [];
        rates.push(value * 100);
        supplierRates.set(mapped, rates);
        return;
      }
      supplierSums.set(mapped, (supplierSums.get(mapped) ?? 0) + value);
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
        supplierRates: supplierRates.get(component) ?? [],
        supplierHasCurrency: supplierSums.has(component),
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

    compactVendorBreakdown.filter(isSupplierComparisonRow).forEach((item) => {
      const component = mappedSupplierComponent(item);
      if (!component) return;
      const rows = supplierGroups.get(component) ?? [];
      rows.push({
        label: detailDisplayLabel(item, component),
        amount: item.amount,
        valueFormat: item.valueFormat,

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
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-b-2 border-primary/80 bg-[#EEF2F5] hover:bg-[#EEF2F5]">
                <TableHead className="w-[42px] text-center text-[12px] font-bold uppercase tracking-widest text-black">
                  #
                </TableHead>
                <TableHead className="text-[12px] font-bold uppercase tracking-widest text-black">
                  Common Component
                </TableHead>
                <TableHead className="w-[180px] text-right text-[12px] font-bold uppercase tracking-widest text-black">
                  Market Research
                  <span className="block text-[9px] font-semibold normal-case tracking-normal opacity-80">
                    $ per Metric Ton
                  </span>
                </TableHead>
                <TableHead className="w-[180px] text-right text-[12px] font-bold uppercase tracking-widest text-black">
                  Supplier
                  <span className="block text-[9px] font-semibold normal-case tracking-normal opacity-80">
                    $ per Metric Ton
                  </span>
                </TableHead>
                <TableHead className="w-[190px] text-right text-[12px] font-bold uppercase tracking-widest text-black">
                  Difference
                  <span className="block text-[9px] font-semibold normal-case tracking-normal opacity-80">
                    Market - Supplier
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonRows.map((row, idx) => (
                <TableRow key={row.component} className="h-10">
                  <TableCell className="text-center text-[11px] text-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.component}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    <AmountWithShare value={row.marketValue} share={row.marketShare} />
                  </TableCell>
<TableCell className="text-right tabular-nums text-foreground">
                    {row.supplierHasCurrency ? (
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <AmountWithShare value={row.supplierValue} share={row.supplierShare} />
                        {row.supplierRates.length ? (
                          <span className="text-[11px] text-foreground/75">
                            Rate: {row.supplierRates.map((rate) => `${formatBreakdownAmount(rate).replace(/\.00$/, "")}%`).join(" + ")}
                          </span>
                        ) : null}
                      </span>
                    ) : row.supplierRates.length ? (
                      <span>{row.supplierRates.map((rate) => `${formatBreakdownAmount(rate).replace(/\.00$/, "")}%`).join(" + ")}</span>
                    ) : (
                      <AmountWithShare value={row.supplierValue} share={row.supplierShare} />
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${differenceClass(row.differenceValue)}`}>
                    {row.supplierRates.length && !row.supplierHasCurrency
                      ? "N/A"
                      : formatDifference(row.differenceValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-[#EEF2F5]">
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
                      Market Research Breakdown
                    </TableHead>
                    <TableHead className="w-[39%] whitespace-normal break-words">
                      Supplier Raw Cost Breakdown
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedDetailRows.map((row, idx) => (
                    <TableRow key={row.component}>
                      <TableCell className="align-top">
                        <div className="flex gap-2">
                          <span className="mt-0.5 text-[11px] text-foreground">
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
                          <span className="mt-0.5 text-[11px] text-foreground">
                            {combinedDetailRows.length + 1}
                          </span>
                          <span className="font-semibold text-foreground">TLC Formulae</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-xs leading-relaxed text-foreground">
                        {marketTlcFormula || "No Market Research formula available."}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words align-top text-xs leading-relaxed text-foreground">
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


