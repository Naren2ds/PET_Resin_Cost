import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApiResponse, VendorBreakdownEntry } from "../types";
import BreakdownTable from "../components/BreakdownTable";
import RevealOnScroll from "../components/RevealOnScroll";
import { Card, CardContent } from "@/components/ui/card";
import type { BreakdownItem, VendorBreakdownRow } from "../types";
import { formatAmount, formatDeltaVersusMarketForCompany } from "../types";
import { getMonthOptions, getYearOptions } from "../lib/filterUtils";
import {
  ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL,
  BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL,
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
  vendorYearMatches,
} from "../lib/colombiaVendorTlc";
import {
  isBrazilAmcorLocationEntry,
  supplierBaseNameForEntry,
  supplierDisplayNameForEntry,
  supplierNameMatchesEntry,
} from "../lib/supplierDisplay";

type CurrentLayoutPageProps = {
  data: ApiResponse;
};

const DEFAULT_DESTINATIONS = [
  "Brazil",
  "Argentina",
  "El Salvador and Honduras",
  "Colombia",
  "Peru",
  "Dominican Republic",
  "Panama",
  "Uruguay",
  "Ecuador",
];

const TOTAL_LANDED_COST_KEY = "total landed cost";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
function getMarketTlc(breakdown: BreakdownItem[]) {
  return (
    breakdown.find((b) => b.label.toLowerCase().includes(TOTAL_LANDED_COST_KEY))
      ?.amount ?? null
  );
}

function parseBreakdownNumeric(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || normalized.toLowerCase() === "n/a" || normalized === "-") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function getSupplierTlc(vendorBreakdown: VendorBreakdownRow[]) {
  return (
    vendorBreakdown.find(
      (row) => row.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
    )?.amount ?? null
  );
}

function formatTlc(value: number | string | null | undefined) {
  if (typeof value === "number") return `$${formatAmount(value)}/MT`;
  if (value === null || value === undefined || value === "") return "$0/MT";
  return formatAmount(value);
}

function entrySupplierSlot(item: VendorBreakdownEntry): string {
  return supplierBaseNameForEntry(item).trim().toLowerCase();
}

function entrySupplierDisplay(item: VendorBreakdownEntry | undefined): string {
  return supplierDisplayNameForEntry(item);
}

function fallbackSupplierNameForDestination(destination: string): string {
  if (destination === "Brazil") return "Amcor";
  if (destination === "Peru") return "San Miguel Industrias (SMI)";
  if (destination === "Dominican Republic") return "SMI PET";
  if (destination === "Panama") return "Pastiglas S.A";
  if (destination === "Uruguay") return "Cristalpet";
  if (destination === "Bolivia") {
    return "Gestora, Administradora e Industrializadora Preformas S.A.";
  }
  if (
    destination === "Argentina" ||
    destination === "Colombia" ||
    destination === "Ecuador" ||
    destination === "El Salvador and Honduras"
  ) {
    return "Amcor";
  }
  return "";
}

const CurrentLayoutPage: React.FC<CurrentLayoutPageProps> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const destinationOptions = useMemo(() => {
    const apiDestination = data.destination;
    return Array.from(new Set([apiDestination, ...DEFAULT_DESTINATIONS])).filter(
      Boolean
    );
  }, [data.destination]);

  const yearOptions = useMemo(() => getYearOptions(), []);

  const paramDestination = searchParams.get("destination") ?? "";
  const paramMonth = searchParams.get("month") ?? "";
  const paramYear = searchParams.get("year") ?? "";
  const paramSource = searchParams.get("source") ?? "";
  const paramSupplier = searchParams.get("supplier") ?? "";

  const defaultDestination = useMemo(() => {
    return data.destination && destinationOptions.includes(data.destination)
      ? data.destination
      : destinationOptions[0] ?? "";
  }, [data.destination, destinationOptions]);

  const selectedDestination = paramDestination || defaultDestination;

  const derivedDefaultYear = useMemo(() => {
    const month = paramMonth || data.month || "";
    const years = data.vendorBreakdowns
      .filter((v) => v.destination === selectedDestination && v.month === month)
      .map((v) => Number(v.year))
      .filter((n) => Number.isFinite(n));

    if (!years.length) return yearOptions[0] ?? "";
    return String(Math.max(...years));
  }, [data.vendorBreakdowns, data.month, paramMonth, selectedDestination, yearOptions]);

  const selectedYear = paramYear || derivedDefaultYear;
  const monthOptions = useMemo(
    () => getMonthOptions(selectedYear, selectedDestination),
    [selectedYear, selectedDestination]
  );

  const selectedMonthRaw = paramMonth || data.month || "";
  const selectedMonth =
    selectedMonthRaw && monthOptions.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : monthOptions[0] ?? "";

  const selectedSource =
    data.countries.find((c) => c.country === paramSource)?.country ??
    data.countries[0]?.country ??
    "";

  useEffect(() => {
    const sourceValid = !paramSource || data.countries.some((c) => c.country === paramSource);
    const needs =
      !paramDestination ||
      !paramMonth ||
      !paramYear ||
      !paramSource ||
      !sourceValid ||
      !monthOptions.includes(paramMonth || "");

    if (!needs) return;

    const next = new URLSearchParams(searchParams);
    next.set("destination", selectedDestination);
    next.set("month", selectedMonth);
    next.set("year", selectedYear);
    next.set("source", selectedSource);
    setSearchParams(next, { replace: true });
  }, [
    paramDestination,
    paramMonth,
    paramYear,
    paramSource,
    monthOptions,
    selectedDestination,
    selectedMonth,
    selectedYear,
    selectedSource,
    data.countries,
    searchParams,
    setSearchParams,
  ]);

  const activeCountry = data.countries.find((c) => c.country === selectedSource) ?? data.countries[0];

  const selectedVendorEntry = useMemo(() => {
    const pool = data.vendorBreakdowns.filter(
      (item) =>
        item.destination === selectedDestination &&
        item.sourceCountry === activeCountry?.country &&
        item.month === selectedMonth &&
        vendorYearMatches(item.year, selectedYear)
    );

    if (!pool.length) return undefined;

    if (paramSupplier) {
      const requested = pool.find((item) => supplierNameMatchesEntry(item, paramSupplier));
      if (requested) return requested;
    }

    if (selectedDestination === "Brazil" && pool.length > 1) {
      const amcor =
        [...pool]
          .filter(isBrazilAmcorLocationEntry)
          .sort((a, b) => entrySupplierDisplay(a).localeCompare(entrySupplierDisplay(b)))[0] ??
        pool.find((item) => entrySupplierSlot(item) === "amcor");
      return amcor ?? pool[0];
    }
    return pool[0];
  }, [
    data.vendorBreakdowns,
    selectedDestination,
    activeCountry?.country,
    selectedMonth,
    selectedYear,
    paramSupplier,
  ]);

  const vendorBreakdown = useMemo(
    () => selectedVendorEntry?.rows ?? [],
    [selectedVendorEntry]
  );

  const selectedSupplierName =
    entrySupplierDisplay(selectedVendorEntry) ||
    paramSupplier ||
    fallbackSupplierNameForDestination(selectedDestination);

  const marketTlc = activeCountry ? getMarketTlc(activeCountry.breakdown) : null;
  const supplierTlc = useMemo(() => {
    if (isColombiaMarch2026View(selectedDestination, selectedMonth, selectedYear)) {
      const shared = getColombiaMarch2026SharedSupplierTlc(data.vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isEcuadorMarch2026View(selectedDestination, selectedMonth, selectedYear)) {
      const shared = getEcuadorMarch2026SharedSupplierTlc(data.vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isPanamaApril2026View(selectedDestination, selectedMonth, selectedYear)) {
      const shared = getPanamaApril2026SharedSupplierTlc(data.vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isPeruApril2026View(selectedDestination, selectedMonth, selectedYear)) {
      const shared = getPeruApril2026SharedSupplierTlc(data.vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isDominicanRepublicApril2026View(selectedDestination, selectedMonth, selectedYear)) {
      const shared = getDominicanRepublicApril2026SharedSupplierTlc(data.vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isArgentinaApril2026View(selectedDestination, selectedMonth, selectedYear)) {
      const shared = getArgentinaApril2026SharedSupplierTlc(data.vendorBreakdowns);
      if (shared !== null) return shared;
    }
    return getSupplierTlc(vendorBreakdown);
  }, [
    data.vendorBreakdowns,
    selectedDestination,
    selectedMonth,
    selectedYear,
    vendorBreakdown,
  ]);

  /** Supplier TLC − market TLC (same convention as HomePage / SourceCountryCard). */
  const supplierVersusMarketDelta = useMemo(() => {
    const m = parseBreakdownNumeric(marketTlc);
    const s = parseBreakdownNumeric(supplierTlc);
    if (m === null || s === null) return null;
    return Number((s - m).toFixed(1));
  }, [marketTlc, supplierTlc]);

  const isNegativeDelta =
    supplierVersusMarketDelta !== null && supplierVersusMarketDelta < 0;
  const diffDisplay =
    supplierVersusMarketDelta === null
      ? "$0/MT"
      : formatDeltaVersusMarketForCompany(supplierVersusMarketDelta);

  return (
    <div className="pet-page-bg min-h-screen">
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-7 max-sm:p-4">

        <RevealOnScroll>
          <section className="grid grid-cols-[minmax(0,1fr)_320px] items-stretch gap-4 max-md:grid-cols-1">
          <Card className="shadow-lg h-full">
            <CardContent className="p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Selected Source
                </p>
                <h2 className="text-xl font-extrabold pet-gradient-heading pet-deep-dive-heading bg-clip-text text-transparent">
                  {activeCountry?.country ?? "—"}
                </h2>
                {selectedSupplierName ? (
                  <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider">Supplier</span>
                    <span className="truncate font-bold text-foreground">
                      {selectedSupplierName}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 max-lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Market Research (Delloite) TLC
                  </p>
                  <p className="mt-1 text-base font-extrabold text-primary">
                    {formatTlc(marketTlc)}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3 ${
                    isNegativeDelta
                      ? "border-destructive/25 bg-destructive/10"
                      : "border-success/25 bg-success/10"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Supplier TLC - Market Research TLC
                  </p>
                  <p
                    className={`mt-1 text-base font-extrabold ${
                      isNegativeDelta ? "text-destructive" : "text-success"
                    }`}
                  >
                    {diffDisplay}
                  </p>
                </div>

                <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/3 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Supplier TLC
                  </p>
                  {selectedSupplierName ? (
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-foreground">
                      {selectedSupplierName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-base font-extrabold text-primary">
                    {formatTlc(supplierTlc)}
                  </p>
                  {isArgentinaApril2026View(
                    selectedDestination,
                    selectedMonth,
                    selectedYear
                  ) ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Resin index (Excel): {ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL}
                    </p>
                  ) : isBrazilApril2026View(
                    selectedDestination,
                    selectedMonth,
                    selectedYear
                  ) && selectedVendorEntry && entrySupplierSlot(selectedVendorEntry) === "amcor" ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Amcor resin index (Excel): {BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL}
                    </p>
                  ) : null}
                </div>

              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg h-full">
            <CardContent className="p-5 h-full">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Selected Destination
              </p>
              <h3 className="text-xl font-extrabold pet-gradient-heading pet-deep-dive-heading bg-clip-text text-transparent">
                {selectedDestination}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Period: {selectedMonth} {selectedYear}
              </p>
            </CardContent>
          </Card>
          </section>
        </RevealOnScroll>

        <RevealOnScroll delay={0.05}>
          <BreakdownTable
            breakdown={activeCountry?.breakdown ?? []}
            vendorBreakdown={vendorBreakdown}
            supplierName={selectedSupplierName}
          />
        </RevealOnScroll>
      </main>
    </div>
  );
};

export default CurrentLayoutPage;

