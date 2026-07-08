import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse, VendorBreakdownEntry } from "../types";
import RevealOnScroll from "../components/RevealOnScroll";
import { getMonthOptions, getYearOptions } from "../lib/filterUtils";
import {
  ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL,
  BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL,
  BRAZIL_APRIL_2026_CRISTALPET_VENDOR_LABEL,
  BRAZIL_APRIL_2026_ENGEPACK_VENDOR_LABEL,
  BRAZIL_APRIL_2026_VALGROUP_VENDOR_LABEL,
  getArgentinaApril2026SharedSupplierTlc,
  getColombiaMarch2026SharedSupplierTlc,
  getDominicanRepublicApril2026SharedSupplierTlc,
  getEcuadorMarch2026SharedSupplierTlc,
  getPanamaApril2026SharedSupplierTlc,
  getPeruApril2026SharedSupplierTlc,
  isArgentinaApril2026View,
  isBrazilApril2026View,
  isColombiaMarch2026View,
  isDominicanRepublicApril2026View,
  isEcuadorMarch2026View,
  isPanamaApril2026View,
  isPeruApril2026View,
  parseVendorTlcAmount,
  vendorYearMatches,
} from "../lib/colombiaVendorTlc";
import {
  isBrazilAmcorLocationEntry,
  supplierDisplayNameForEntry,
  supplierNameMatchesEntry,
} from "../lib/supplierDisplay";
import { formatAmount, formatDeltaVersusMarketForCompany } from "../types";
import AIInsightPanel from "../components/AIInsightPanel";
import CostComponentChart from "../components/CostComponentChart";

type HomePageProps = {
  data: ApiResponse;
};

const DEFAULT_DESTINATIONS = [
  "Brazil",
  "Bolivia",
  "Argentina",
  "El Salvador",
  "Honduras",
  "Colombia",
  "Peru",
  "Dominican Republic",
  "Panama",
  "Uruguay",
  "Ecuador",
];
const COMBINED_EL_SALVADOR_HONDURAS = "El Salvador and Honduras";
const PRIMARY_EL_SALVADOR_HONDURAS_OPTION = "El Salvador";
const DEFAULT_OPEN_DESTINATION = "Colombia";
const DEFAULT_OPEN_MONTH = "March";
const DEFAULT_OPEN_YEAR = "2026";

function normalizeDestinationForUi(value: string): string {
  return value === COMBINED_EL_SALVADOR_HONDURAS
    ? PRIMARY_EL_SALVADOR_HONDURAS_OPTION
    : value;
}
const TOTAL_LANDED_COST_KEY = "total landed cost";
const DIFFERENCE_KEY = "difference";
type SortKey = "tlc" | "supplierTlc" | "delta";
type SortOrder = "desc" | "asc";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
type SupplierDeviation = {
  marketCountry: string;
  delta: number;
};
/** When Brazil is the destination market, every source country row shows these four suppliers. */
const BRAZIL_DESTINATION = "Brazil";
const BRAZIL_DESTINATION_SUPPLIERS = [
  "Amcor",
  "Valgroup",
  "Cristalpet",
  "Engepack",
] as const;
/** These destination markets show a single supplier column: Amcor. */
const AMCOR_ONLY_DESTINATIONS = new Set([
  "Argentina",
  "El Salvador",
  "Honduras",
  "El Salvador and Honduras",
  "Colombia",
  "Ecuador",
]);
const AMCOR_ONLY_SUPPLIERS = ["Amcor"] as const;

const PERU_DESTINATION = "Peru";
const PERU_DESTINATION_SUPPLIERS = ["Pastiglas S.A"] as const;
const DOMINICAN_REPUBLIC_DESTINATION = "Dominican Republic";
const DOMINICAN_REPUBLIC_DESTINATION_SUPPLIERS = ["SMI PET"] as const;

const NIGERIA_DESTINATION = "Nigeria";
const NIGERIA_DESTINATION_SUPPLIERS = ["No contract (Resin formula unknown)"] as const;
const BOLIVIA_DESTINATION = "Bolivia";
const BOLIVIA_DESTINATION_SUPPLIERS = [
  "Gestora, Administradora e Industrializadora Preformas S.A.",
] as const;
/** No contracted supplier for this destination — empty list (not null). */
const KOREA_DESTINATION = "Korea";
const KOREA_DESTINATION_SUPPLIERS: readonly string[] = [];
const PANAMA_DESTINATION = "Panama";
const PANAMA_DESTINATION_SUPPLIERS = ["Pastiglas S.A"] as const;
const URUGUAY_DESTINATION = "Uruguay";
const URUGUAY_DESTINATION_SUPPLIERS = ["Cristalpet"] as const;

function isAmcorOnlyDestination(destination: string): boolean {
  return AMCOR_ONLY_DESTINATIONS.has(destination);
}

/** Destination-specific supplier columns (null = use source-country preset or defaults). */
function getDestinationFixedSuppliers(destination: string): readonly string[] | null {
  if (destination === BRAZIL_DESTINATION) return BRAZIL_DESTINATION_SUPPLIERS;
  if (isAmcorOnlyDestination(destination)) return AMCOR_ONLY_SUPPLIERS;
  if (destination === PERU_DESTINATION) return PERU_DESTINATION_SUPPLIERS;
  if (destination === DOMINICAN_REPUBLIC_DESTINATION) return DOMINICAN_REPUBLIC_DESTINATION_SUPPLIERS;
  if (destination === NIGERIA_DESTINATION) return NIGERIA_DESTINATION_SUPPLIERS;
  if (destination === BOLIVIA_DESTINATION) return BOLIVIA_DESTINATION_SUPPLIERS;
  if (destination === KOREA_DESTINATION) return KOREA_DESTINATION_SUPPLIERS;
  if (destination === PANAMA_DESTINATION) return PANAMA_DESTINATION_SUPPLIERS;
  if (destination === URUGUAY_DESTINATION) return URUGUAY_DESTINATION_SUPPLIERS;
  return null;
}

function pickHighestDeviation(deviations: SupplierDeviation[]): SupplierDeviation | null {
  const negativeDeviations = deviations.filter((entry) => entry.delta < 0);
  if (negativeDeviations.length) {
    return negativeDeviations.reduce<SupplierDeviation>((mostNegative, current) =>
      current.delta < mostNegative.delta ? current : mostNegative,
    negativeDeviations[0]);
  }

  const positiveDeviations = deviations.filter((entry) => entry.delta > 0);
  if (positiveDeviations.length) {
    return positiveDeviations.reduce<SupplierDeviation>((leastPositive, current) =>
      current.delta < leastPositive.delta ? current : leastPositive,
    positiveDeviations[0]);
  }

  return deviations[0] ?? null;
}

function actualSupplierNames(matches: VendorBreakdownEntry[]): string[] {
  return Array.from(
    new Set(matches.map(supplierDisplayNameForEntry).filter(Boolean))
  );
}

function brazilSupplierNames(matches: VendorBreakdownEntry[]): string[] {
  const actualNames = actualSupplierNames(matches);
  const amcorLocationNames = actualNames
    .filter((name) =>
      matches.some(
        (entry) =>
          isBrazilAmcorLocationEntry(entry) &&
          supplierDisplayNameForEntry(entry) === name
      )
    )
    .sort((a, b) => a.localeCompare(b));
  const otherSuppliers = BRAZIL_DESTINATION_SUPPLIERS.filter(
    (name) => name.trim().toLowerCase() !== "amcor"
  );

  return amcorLocationNames.length
    ? [...amcorLocationNames, ...otherSuppliers]
    : [...BRAZIL_DESTINATION_SUPPLIERS];
}

function findTlcForSupplierName(
  matches: VendorBreakdownEntry[],
  supplierName: string,
  parseNum: (v: number | string | null | undefined) => number | null
): number | null {
  for (const item of matches) {
    if (!supplierNameMatchesEntry(item, supplierName)) continue;
    const row = item.rows.find(
      (r) => r.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
    );
    const amt = parseNum(row?.amount ?? null);
    if (amt !== null) return amt;
  }
  return null;
}
const VIEW_SHELL_CLASS =
  "rounded-[10px] border border-border bg-card shadow-[0_2px_4px_rgba(0,0,0,0.03),0_12px_40px_rgba(0,0,0,0.06),0_40px_80px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/40";

const HomePage: React.FC<HomePageProps> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [costChartOpen, setCostChartOpen] = useState(false);
  const paramDestinationRaw = searchParams.get("destination") ?? "";
  const paramDestination = normalizeDestinationForUi(paramDestinationRaw);

  const destinationOptions = useMemo(() => {
    const apiDestination = normalizeDestinationForUi(data.destination);
    return Array.from(new Set([apiDestination, ...DEFAULT_DESTINATIONS])).filter(
      (destination): destination is string =>
        Boolean(destination) && destination !== COMBINED_EL_SALVADOR_HONDURAS
    );
  }, [data.destination]);

  const yearOptions = useMemo(() => getYearOptions(), []);

  const paramMonth = searchParams.get("month") ?? "";
  const paramYear = searchParams.get("year") ?? "";
  const paramSource = searchParams.get("source") ?? "";
  const sortBy = (searchParams.get("sortBy") as SortKey) || "tlc";
  const sortOrder = (searchParams.get("sortOrder") as SortOrder) || "desc";

  const computedDefaultDestination = useMemo(() => {
    if (destinationOptions.includes(DEFAULT_OPEN_DESTINATION)) {
      return DEFAULT_OPEN_DESTINATION;
    }
    return data.destination && destinationOptions.includes(data.destination)
      ? data.destination
      : destinationOptions[0] ?? "";
  }, [data.destination, destinationOptions]);

  const computedDefaultMonth = useMemo(() => {
    return paramMonth || DEFAULT_OPEN_MONTH || data.month || "";
  }, [paramMonth, data.month]);

  const computedDefaultYear = useMemo(() => {
    if (!paramYear && yearOptions.includes(DEFAULT_OPEN_YEAR)) {
      return DEFAULT_OPEN_YEAR;
    }

    const month = paramMonth || data.month || "";
    const destination = paramDestination || computedDefaultDestination;

    const years = data.vendorBreakdowns
      .filter((v) => v.destination === destination && v.month === month)
      .map((v) => Number(v.year))
      .filter((n) => Number.isFinite(n));

    if (!years.length) return yearOptions[0] ?? "";
    return String(Math.max(...years));
  }, [
    data.vendorBreakdowns,
    data.month,
    paramMonth,
    paramDestination,
    computedDefaultDestination,
    yearOptions,
  ]);

  const selectedDestination = paramDestination || computedDefaultDestination;
  const selectedYear = paramYear || computedDefaultYear;
  const monthOptions = useMemo(
    () => getMonthOptions(selectedYear, selectedDestination),
    [selectedYear, selectedDestination]
  );
  const selectedMonthRaw = paramMonth || computedDefaultMonth;
  const selectedMonth =
    selectedMonthRaw && monthOptions.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : monthOptions[0] ?? "";

  const orderedCountries = useMemo(() => {
    const baseCountries = [...data.countries];

    const getNumericMetric = (country: ApiResponse["countries"][number], labelKey: string) => {
      const metric = country.breakdown.find((b) => b.label.toLowerCase().includes(labelKey))?.amount;
      return typeof metric === "number" ? metric : null;
    };

    const compareWithNullsLast = (aValue: number | null, bValue: number | null) => {
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (aValue === bValue) return 0;
      const direction = sortOrder === "asc" ? 1 : -1;
      return (aValue - bValue) * direction;
    };

    if (sortBy === "tlc") {
      return [...baseCountries].sort((a, b) => {
        const byTlc = compareWithNullsLast(
          getNumericMetric(a, TOTAL_LANDED_COST_KEY),
          getNumericMetric(b, TOTAL_LANDED_COST_KEY)
        );
        return byTlc !== 0 ? byTlc : a.country.localeCompare(b.country);
      });
    }

    if (sortBy === "supplierTlc") {
      const colombiaShared = isColombiaMarch2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getColombiaMarch2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const ecuadorShared = isEcuadorMarch2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getEcuadorMarch2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const panamaShared = isPanamaApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getPanamaApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const peruShared = isPeruApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getPeruApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const dominicanShared = isDominicanRepublicApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getDominicanRepublicApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      const argentinaShared = isArgentinaApril2026View(
        selectedDestination,
        selectedMonth,
        selectedYear
      )
        ? getArgentinaApril2026SharedSupplierTlc(data.vendorBreakdowns)
        : null;
      return [...baseCountries].sort((a, b) => {
        const getSupplierTlcValue = (country: ApiResponse["countries"][number]) => {
          if (colombiaShared !== null) return colombiaShared;
          if (ecuadorShared !== null) return ecuadorShared;
          if (panamaShared !== null) return panamaShared;
          if (peruShared !== null) return peruShared;
          if (dominicanShared !== null) return dominicanShared;
          if (argentinaShared !== null) return argentinaShared;
          const match = data.vendorBreakdowns.find(
            (item) =>
              item.destination === selectedDestination &&
              item.sourceCountry === country.country &&
              item.month === selectedMonth &&
              vendorYearMatches(item.year, selectedYear)
          );
          const row = match?.rows.find(
            (r) => r.label.trim().toLowerCase() === "total resin price abi virgin formula"
          );
          return parseVendorTlcAmount(row?.amount ?? null);
        };
        const bySupplier = compareWithNullsLast(
          getSupplierTlcValue(a),
          getSupplierTlcValue(b)
        );
        return bySupplier !== 0 ? bySupplier : a.country.localeCompare(b.country);
      });
    }

    if (sortBy === "delta") {
      return [...baseCountries].sort((a, b) => {
        const byDelta = compareWithNullsLast(
          getNumericMetric(a, DIFFERENCE_KEY),
          getNumericMetric(b, DIFFERENCE_KEY)
        );
        return byDelta !== 0 ? byDelta : a.country.localeCompare(b.country);
      });
    }

    return [...baseCountries].sort((a, b) => {
      const byTlc = compareWithNullsLast(
        getNumericMetric(a, TOTAL_LANDED_COST_KEY),
        getNumericMetric(b, TOTAL_LANDED_COST_KEY)
      );
      return byTlc !== 0 ? byTlc : a.country.localeCompare(b.country);
    });
  }, [data.countries, data.vendorBreakdowns, sortBy, sortOrder, selectedDestination, selectedMonth, selectedYear]);

  const sourceOptions = useMemo(
    () => orderedCountries.map((country) => country.country),
    [orderedCountries]
  );
  const selectedSource =
    paramSource && sourceOptions.includes(paramSource)
      ? paramSource
      : "";

  useEffect(() => {
    const needsDestination = !paramDestinationRaw || paramDestinationRaw !== selectedDestination;
    const needsMonth = !paramMonth;
    const needsYear = !paramYear;
    const hasInvalidSource = paramSource && !sourceOptions.includes(paramSource);

    if (!needsDestination && !needsMonth && !needsYear && !hasInvalidSource) return;

    const next = new URLSearchParams(searchParams);
    next.set("destination", selectedDestination);
    next.set("month", selectedMonth);
    next.set("year", selectedYear);
    if (hasInvalidSource) {
      next.delete("source");
    }

    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paramDestinationRaw,
    paramDestination,
    paramMonth,
    paramYear,
    paramSource,
    selectedDestination,
    selectedMonth,
    selectedYear,
    sourceOptions,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!paramYear) return;
    if (!selectedMonth || !monthOptions.includes(selectedMonth)) return;
    if (paramMonth === selectedMonth) return;

    const next = new URLSearchParams(searchParams);
    next.set("month", selectedMonth);
    setSearchParams(next, { replace: true });
  }, [paramYear, paramMonth, selectedMonth, monthOptions, searchParams, setSearchParams]);

  const parseNumeric = (value: number | string | null | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const numeric = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(numeric) ? numeric : null;
  };

  const findBreakdownNumeric = (country: ApiResponse["countries"][number], labelKey: string) => {
    const entry = country.breakdown.find((b) => b.label.toLowerCase().includes(labelKey))?.amount;
    return parseNumeric(entry);
  };

  const tableRows = useMemo(() => {
    const compareWithNullsLast = (aValue: number | null, bValue: number | null) => {
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (aValue === bValue) return 0;
      const direction = sortOrder === "asc" ? 1 : -1;
      return (aValue - bValue) * direction;
    };

    const pickDirectionalValue = (values: Array<number | null>) => {
      const numericValues = values.filter(
        (value): value is number => value !== null && Number.isFinite(value)
      );
      if (!numericValues.length) return null;
      return sortOrder === "asc"
        ? Math.min(...numericValues)
        : Math.max(...numericValues);
    };

    const sortSuppliers = (
      suppliers: Array<{ name: string; supplierTlc: number | null; delta: number | null }>
    ) => {
      if (sortBy !== "supplierTlc" && sortBy !== "delta") return suppliers;

      return [...suppliers].sort((a, b) => {
        const aValue = sortBy === "supplierTlc" ? a.supplierTlc : a.delta;
        const bValue = sortBy === "supplierTlc" ? b.supplierTlc : b.delta;
        const byValue = compareWithNullsLast(aValue, bValue);
        return byValue !== 0 ? byValue : a.name.localeCompare(b.name);
      });
    };

    const colombiaSharedTlc = isColombiaMarch2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getColombiaMarch2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const ecuadorSharedTlc = isEcuadorMarch2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getEcuadorMarch2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const panamaSharedTlc = isPanamaApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getPanamaApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const peruSharedTlc = isPeruApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getPeruApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const dominicanSharedTlc = isDominicanRepublicApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getDominicanRepublicApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;
    const argentinaSharedTlc = isArgentinaApril2026View(
      selectedDestination,
      selectedMonth,
      selectedYear
    )
      ? getArgentinaApril2026SharedSupplierTlc(data.vendorBreakdowns)
      : null;

    const rows = orderedCountries.map((country) => {
      const marketTlc = findBreakdownNumeric(country, TOTAL_LANDED_COST_KEY);
      const matches = data.vendorBreakdowns.filter(
        (item) =>
          item.destination === selectedDestination &&
          item.sourceCountry === country.country &&
          item.month === selectedMonth &&
          vendorYearMatches(item.year, selectedYear)
      );
      const firstEntry = matches[0];
      const baseSupplierTlc =
        dominicanSharedTlc ??
        argentinaSharedTlc ??
        peruSharedTlc ??
        panamaSharedTlc ??
        ecuadorSharedTlc ??
        colombiaSharedTlc ??
        parseNumeric(
          firstEntry?.rows.find(
            (row) => row.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
          )?.amount ?? null
        );

      const fixedSuppliers = getDestinationFixedSuppliers(selectedDestination);
      const supplierNames =
        selectedDestination === BRAZIL_DESTINATION
          ? brazilSupplierNames(matches)
          : fixedSuppliers !== null
          ? [...fixedSuppliers]
          : actualSupplierNames(matches);
      const suppliers = supplierNames.map((name) => {
        const fromApi = findTlcForSupplierName(matches, name, parseNumeric);
        let value: number | null;
        if (fromApi !== null) {
          value = Number(fromApi.toFixed(1));
        } else if (
          fixedSuppliers !== null &&
          baseSupplierTlc !== null &&
          selectedDestination !== BRAZIL_DESTINATION
        ) {
          // One vendor TLC applied to every named supplier (e.g. Colombia / single Amcor column).
          // Brazil lists multiple suppliers with separate vendor rows — never broadcast `matches[0]`.
          value = Number(baseSupplierTlc.toFixed(1));
        } else {
          value = 0;
        }
        const delta =
          value === null || marketTlc === null
            ? null
            : Number((marketTlc - value).toFixed(1));
        return {
          name,
          supplierTlc: value,
          delta,
        };
      });

      return {
        marketCountry: country.country,
        marketTlc,
        suppliers: sortSuppliers(suppliers),
      };
    }).filter((row) => row.marketTlc !== null);

    const getRowSortValue = (row: (typeof rows)[number]) => {
      if (sortBy === "tlc") return row.marketTlc;
      if (sortBy === "supplierTlc") {
        return pickDirectionalValue(row.suppliers.map((supplier) => supplier.supplierTlc));
      }
      return pickDirectionalValue(row.suppliers.map((supplier) => supplier.delta));
    };

    return [...rows].sort((a, b) => {
      const byValue = compareWithNullsLast(getRowSortValue(a), getRowSortValue(b));
      return byValue !== 0 ? byValue : a.marketCountry.localeCompare(b.marketCountry);
    });
  }, [
    orderedCountries,
    data.vendorBreakdowns,
    selectedDestination,
    selectedMonth,
    selectedYear,
    sortBy,
    sortOrder,
  ]);

  const supplierBenchmarks = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        supplierTlc: number | null;
        marketCount: number;
        deviations: SupplierDeviation[];
      }
    >();

    tableRows.forEach((row) => {
      row.suppliers.forEach((supplier) => {
        const key = `${supplier.name}__${supplier.supplierTlc ?? 0}`;
        const current =
          map.get(key) ??
          {
            name: supplier.name,
            supplierTlc: supplier.supplierTlc,
            marketCount: 0,
            deviations: [],
          };
        current.marketCount += 1;
        if (supplier.delta !== null) {
          current.deviations.push({
            marketCountry: row.marketCountry,
            delta: supplier.delta,
          });
        }
        map.set(key, current);
      });
    });

    return Array.from(map.values())
      .map((supplier) => ({
        ...supplier,
        highestDeviation: pickHighestDeviation(supplier.deviations),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tableRows]);

  const consolidatedSupplier = supplierBenchmarks.length === 1 ? supplierBenchmarks[0] : null;

  const formatTlcDisplay = (value: number | null) =>
    `$${formatAmount(value ?? 0)}/MT`;

  const deltaClass = (delta: number | null) => {
    if (delta === null || delta === 0) return "text-foreground";
    return delta < 0 ? "text-destructive" : "text-success";
  };

  const formatDeltaDisplay = (delta: number | null) =>
    delta === null ? "$0/MT" : formatDeltaVersusMarketForCompany(delta);

  const handleHeaderSort = (column: SortKey) => {
    const next = new URLSearchParams(searchParams);
    if (sortBy === column) {
      next.set("sortOrder", sortOrder === "desc" ? "asc" : "desc");
    } else {
      next.set("sortBy", column);
      next.set("sortOrder", "desc");
    }
    setSearchParams(next);
  };

  const getSortIndicator = (column: SortKey) => {
    if (sortBy !== column) return "";
    return sortOrder === "desc" ? " ↓" : " ↑";
  };

  const getGapLabel = (delta: number | null, lowerCase = false) => {
    const positiveLabel = lowerCase ? "Smallest gap vs market" : "Smallest Gap vs Market";
    const negativeLabel = lowerCase ? "Largest gap vs market" : "Largest Gap vs Market";
    return delta !== null && delta > 0 ? positiveLabel : negativeLabel;
  };

  return (
    <div className="pet-page-bg min-h-screen">
      <main className="mx-auto flex max-w-[1400px] flex-col gap-5 p-7 max-sm:p-4">
        <RevealOnScroll>
          <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground mb-1">Destination</label>
              <select
                value={selectedDestination}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("destination", e.target.value);
                  setSearchParams(next);
                }}
                className="h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                {destinationOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("month", e.target.value);
                  setSearchParams(next);
                }}
                className="h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                {monthOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("year", e.target.value);
                  const nextMonthOptions = getMonthOptions(
                    e.target.value,
                    selectedDestination
                  );
                  const currentMonth = searchParams.get("month") ?? "";
                  const nextMonth = nextMonthOptions.includes(currentMonth)
                    ? currentMonth
                    : nextMonthOptions[0] ?? "";
                  next.set("month", nextMonth);
                  setSearchParams(next);
                }}
                className="h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="2026">2026</option>
                <option value="2027" disabled className="text-foreground opacity-40" title="Data Not Available">2027</option>
              </select>
            </div>
            <div className="ml-auto max-w-[420px] rounded-md border border-border bg-card px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                Data Scope
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                Actuals are till June 2026. Future data are predictions based on Resin Index and Freights.
              </p>
            </div>
          </div>

          <div className={`${VIEW_SHELL_CLASS} overflow-hidden border-2 border-border/80`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border/80 bg-background/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-md font-semibold text-foreground">Market Pricing Snapshot</span>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {selectedDestination || "Destination"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-foreground">
                  <span className="rounded-full border border-border px-2 py-0.5">{tableRows.length} markets</span>
                  <span className="rounded-full border border-border px-2 py-0.5">{supplierBenchmarks.length} suppliers</span>
                </div>
              </div>
              {consolidatedSupplier ? (
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(180px,0.45fr)_minmax(180px,0.45fr)] gap-3 border-b-2 border-border/80 bg-white p-4 max-md:grid-cols-1">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      Supplier benchmark
                    </p>
                    <h3 className="mt-1 truncate text-xl font-extrabold text-foreground">
                      {consolidatedSupplier.name}
                    </h3>
                  </div>
                  <div className="rounded-lg border border-primary/25 bg-primary/10 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      Supplier vPET
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-primary">
                      {formatTlcDisplay(consolidatedSupplier.supplierTlc)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/30 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      {getGapLabel(consolidatedSupplier.highestDeviation?.delta ?? null)}
                    </p>
                    <p
                      className={`mt-1 text-lg font-extrabold ${deltaClass(
                        consolidatedSupplier.highestDeviation?.delta ?? null
                      )}`}
                    >
                      {formatDeltaDisplay(consolidatedSupplier.highestDeviation?.delta ?? null)}
                      {consolidatedSupplier.highestDeviation ? (
                        <span className="ml-1 text-[11px] font-semibold text-foreground">
                          ({consolidatedSupplier.highestDeviation.marketCountry})
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              ) : supplierBenchmarks.length > 1 ? (
                <div className="grid gap-3 border-b-2 border-border/80 bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
                  {supplierBenchmarks.map((supplier) => (
                    <div
                      key={`${supplier.name}-${supplier.supplierTlc ?? 0}`}
                      className="rounded-lg border border-border bg-background/30 px-3 py-2"
                    >
                      <p className="truncate text-sm font-bold text-foreground">{supplier.name}</p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-foreground">TLC</p>
                          <p className="font-extrabold text-primary">{formatTlcDisplay(supplier.supplierTlc)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-foreground">
                            {getGapLabel(supplier.highestDeviation?.delta ?? null, true)}
                          </p>
                          <p
                            className={`font-bold ${deltaClass(
                              supplier.highestDeviation?.delta ?? null
                            )}`}
                          >
                            {formatDeltaDisplay(supplier.highestDeviation?.delta ?? null)}
                            {supplier.highestDeviation ? (
                              <span className="ml-1 text-[10px] font-semibold text-foreground">
                                ({supplier.highestDeviation.marketCountry})
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table
                  className={`pet-data-table w-full ${
                    consolidatedSupplier ? "min-w-[640px]" : "min-w-[920px]"
                  } border-collapse text-sm`}
                >
                  <thead className="sticky top-0 z-10">
                    {consolidatedSupplier ? (
                      <tr className="bg-secondary/80 backdrop-blur">
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-bold tracking-wider text-foreground">
                          Sourcing Countries
                        </th>
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-bold tracking-wider text-foreground">
                          <button
                            type="button"
                            onClick={() => handleHeaderSort("tlc")}
                            className="cursor-pointer select-none text-left"
                          >
                            Market Research vPET{getSortIndicator("tlc")}
                          </button>
                        </th>
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-bold tracking-wider text-foreground">
                          <button
                            type="button"
                            onClick={() => handleHeaderSort("delta")}
                            className="cursor-pointer select-none text-left"
                          >
                            Delta (Market - Supplier){getSortIndicator("delta")}
                          </button>
                        </th>
                      </tr>
                    ) : (
                      <tr className="bg-secondary/80 backdrop-blur">
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-bold tracking-wider text-foreground">
                          Sourcing Countries
                        </th>
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-bold  tracking-wider">
                          <button
                            type="button"
                            onClick={() => handleHeaderSort("tlc")}
                            className="cursor-pointer select-none text-left"
                          >
                            Market Research vPET{getSortIndicator("tlc")}
                          </button>
                        </th>
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-bold tracking-wider text-foreground">
                          <span className="block">Supplier</span>
                          {isArgentinaApril2026View(
                            selectedDestination,
                            selectedMonth,
                            selectedYear
                          ) ? (
                            <span className="mt-0.5 block normal-case font-normal text-[10px] text-foreground/90">
                              Resin (Excel): {ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL}
                            </span>
                          ) : isBrazilApril2026View(
                            selectedDestination,
                            selectedMonth,
                            selectedYear
                          ) ? (
                            <span className="mt-0.5 block normal-case font-normal text-[10px] text-foreground/90">
                              Amcor resin (Excel): {BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL}
                            </span>
                          ) : null}
                        </th>
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-foreground">
                          <button
                            type="button"
                            onClick={() => handleHeaderSort("supplierTlc")}
                            className="cursor-pointer select-none text-left"
                          >
                            Supplier vPET{getSortIndicator("supplierTlc")}
                          </button>
                        </th>
                        <th className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-foreground">
                          <button
                            type="button"
                            onClick={() => handleHeaderSort("delta")}
                            className="cursor-pointer select-none text-left"
                          >
                            Delta{getSortIndicator("delta")}
                          </button>
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {consolidatedSupplier
                      ? tableRows.map((row, rowIndex) => {
                          const isSelectedMarket = selectedSource === row.marketCountry;
                          const rowSupplierDelta = row.suppliers[0]?.delta;
                          const supplierDelta =
                            rowSupplierDelta ??
                            (row.marketTlc !== null &&
                            consolidatedSupplier.supplierTlc !== null
                              ? Number(
                                  (
                                    consolidatedSupplier.supplierTlc -
                                    row.marketTlc
                                  ).toFixed(1)
                                )
                              : null);

                          return (
                            <tr
                              key={`${row.marketCountry}-consolidated-supplier`}
                              className={`cursor-pointer border-b-2 border-border/75 transition ${
                                isSelectedMarket
                                  ? "bg-primary/10"
                                  : rowIndex % 2 === 0
                                    ? "bg-background/10 hover:bg-secondary/25"
                                    : "hover:bg-secondary/25"
                              }`}
                              onClick={() => {
                                const next = new URLSearchParams(searchParams);
                                next.set("source", row.marketCountry);
                                next.set("supplier", consolidatedSupplier.name);
                                setSearchParams(next);
                              }}
                            >
                              <td className="border-r-2 border-border/70 px-4 py-3 font-semibold text-foreground">
                                <div className="flex items-center gap-2">
                                  <span>{row.marketCountry}</span>
                                  {isSelectedMarket ? (
                                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                      Selected
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="border-r-2 border-border/70 px-4 py-3 font-semibold text-primary">
                                {formatTlcDisplay(row.marketTlc)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`font-semibold ${deltaClass(supplierDelta)}`}>
                                  {formatDeltaDisplay(supplierDelta)}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      : tableRows.map((row, rowIndex) => {
                          const isSelectedMarket = selectedSource === row.marketCountry;
                          if (!row.suppliers.length) {
                            return (
                              <tr
                                key={`${row.marketCountry}-no-supplier`}
                                className={`cursor-pointer border-b-2 border-border/75 transition ${
                                  isSelectedMarket
                                    ? "bg-primary/10"
                                    : rowIndex % 2 === 0
                                      ? "bg-background/10 hover:bg-secondary/25"
                                      : "hover:bg-secondary/25"
                                }`}
                                onClick={() => {
                                  const next = new URLSearchParams(searchParams);
                                  next.set("source", row.marketCountry);
                                  next.delete("supplier");
                                  setSearchParams(next);
                                }}
                              >
                                <td className="border-r-2 border-border/70 px-4 py-3 font-semibold text-foreground">
                                  <div className="flex items-center gap-2">
                                    <span>{row.marketCountry}</span>
                                    {isSelectedMarket ? (
                                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                        Selected
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="border-r-2 border-border/70 px-4 py-3 font-semibold text-primary">
                                  {formatTlcDisplay(row.marketTlc)}
                                </td>
                                <td className="px-4 py-2.5 text-foreground">No supplier data</td>
                                <td className="px-4 py-2.5 font-semibold text-primary">$0/MT</td>
                                <td className="px-4 py-2.5 font-semibold text-foreground">$0/MT</td>
                              </tr>
                            );
                          }
                          return row.suppliers.map((supplier, supplierIndex) => (
                            <tr
                              key={`${row.marketCountry}-${supplier.name || "supplier"}-${supplierIndex}`}
                              className={`cursor-pointer border-b-2 border-border/75 transition ${
                                isSelectedMarket
                                  ? "bg-primary/10"
                                  : supplierIndex % 2 === 0
                                    ? "bg-background/10 hover:bg-secondary/25"
                                    : "hover:bg-secondary/25"
                              }`}
                              onClick={() => {
                                const next = new URLSearchParams(searchParams);
                                next.set("source", row.marketCountry);
                                next.set("supplier", supplier.name);
                                setSearchParams(next);
                              }}
                            >
                              {supplierIndex === 0 ? (
                                <>
                                  <td
                                    rowSpan={row.suppliers.length}
                                    className="border-r-2 border-border/70 px-4 py-3 font-semibold text-foreground"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>{row.marketCountry}</span>
                                      {isSelectedMarket ? (
                                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                          Selected
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td
                                    rowSpan={row.suppliers.length}
                                    className="border-r-2 border-border/70 px-4 py-3 font-semibold text-primary"
                                  >
                                    {formatTlcDisplay(row.marketTlc)}
                                  </td>
                                </>
                              ) : null}
                              <td className="px-4 py-2.5">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-foreground">{supplier.name}</span>
                                  {isArgentinaApril2026View(
                                    selectedDestination,
                                    selectedMonth,
                                    selectedYear
                                  ) ? (
                                    <span className="text-[10px] text-foreground">
                                      {ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL}
                                    </span>
                                  ) : isBrazilApril2026View(
                                    selectedDestination,
                                    selectedMonth,
                                    selectedYear
                                  ) &&
                                  supplier.name.trim().toLowerCase().startsWith("amcor") ? (
                                    <span className="text-[10px] text-foreground">
                                      {BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL}
                                    </span>
                                  ) : isBrazilApril2026View(
                                    selectedDestination,
                                    selectedMonth,
                                    selectedYear
                                  ) &&
                                  supplier.name.trim().toLowerCase() === "valgroup" ? (
                                    <span className="text-[10px] text-foreground">
                                      {BRAZIL_APRIL_2026_VALGROUP_VENDOR_LABEL}
                                    </span>
                                  ) : isBrazilApril2026View(
                                    selectedDestination,
                                    selectedMonth,
                                    selectedYear
                                  ) &&
                                  supplier.name.trim().toLowerCase() === "cristalpet" ? (
                                    <span className="text-[10px] text-foreground">
                                      {BRAZIL_APRIL_2026_CRISTALPET_VENDOR_LABEL}
                                    </span>
                                  ) : isBrazilApril2026View(
                                    selectedDestination,
                                    selectedMonth,
                                    selectedYear
                                  ) &&
                                  supplier.name.trim().toLowerCase() === "engepack" ? (
                                    <span className="text-[10px] text-foreground">
                                      {BRAZIL_APRIL_2026_ENGEPACK_VENDOR_LABEL}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-primary">
                                {formatTlcDisplay(supplier.supplierTlc)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`font-semibold ${deltaClass(supplier.delta)}`}>
                                  {formatDeltaDisplay(supplier.delta)}
                                </span>
                              </td>
                            </tr>
                          ));
                        })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </RevealOnScroll>
         <RevealOnScroll>
          <div className="rounded-[10px] border border-border bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setCostChartOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-6 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-primary text-base" aria-hidden>✦</span>
                <span className="text-sm font-semibold text-foreground">Cost Component Mix</span>
                <span className="text-[11px] text-muted-foreground">
                  {selectedMonth} {selectedYear} · {selectedDestination}
                </span>
              </div>
              <span className="text-foreground text-sm">{costChartOpen ? "▲" : "▼"}</span>
            </button>
            {!costChartOpen && (
              <p className="px-6 pb-3 text-[11px] text-muted-foreground">
                USD/MT cost breakdown by component across Market Research countries and suppliers.
              </p>
            )}
            {costChartOpen && (
              <div className="border-t border-border px-4 pb-4 pt-3">
                <p className="mb-3 text-xs text-muted-foreground">
                  Stacked cost breakdown by component (USD/MT) across Market Research countries and suppliers for the selected context.
                </p>
                <CostComponentChart
                  data={data}
                  destination={selectedDestination}
                  month={selectedMonth}
                  year={selectedYear}
                />
              </div>
            )}
          </div>
        </RevealOnScroll>
         <RevealOnScroll>
          <AIInsightPanel
            request={{
              page: "home",
              destination: selectedDestination,
              month: selectedMonth,
              year: selectedYear,
              countries: data.countries,
              marketResearchTrends: data.marketResearchTrends ?? [],
              vendorBreakdowns: data.vendorBreakdowns.filter(
                (e) =>
                  e.destination === selectedDestination
              ),
            }}
            className="mb-1"
          />
        </RevealOnScroll>
      </main>
    </div>
  );
};

export default HomePage;

