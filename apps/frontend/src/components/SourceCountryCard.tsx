import React, { useMemo } from "react";
import type { CountryCost, VendorBreakdownEntry } from "../types";
import { formatAmount, formatDeltaVersusMarketForCompany } from "../types";
import { Card, CardContent } from "@/components/ui/card";
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
import { supplierDisplayNameForEntry } from "../lib/supplierDisplay";

type SourceCountryCardProps = {
  country: CountryCost;
  destination: string;
  month: string;
  year: string;
  vendorBreakdowns: VendorBreakdownEntry[];
  isSelected?: boolean;
  onSelect?: () => void;
  onDeepDive?: () => void;
};

const TOTAL_LANDED_COST_KEY = "total landed cost";
const DIFFERENCE_KEY = "difference";
const SUPPLIER_TLC_LABEL = "total resin price abi virgin formula";
const BRAZIL_DESTINATION = "Brazil";
const BRAZIL_DESTINATION_SUPPLIERS = [
  "Amcor",
  "Valgroup",
  "Cristalpet",
  "Engepack",
] as const;
const AMCOR_ONLY_DESTINATIONS = new Set([
  "Argentina",
  "El Salvador and Honduras",
  "Colombia",
  "Ecuador",
]);
const AMCOR_ONLY_SUPPLIERS = ["Amcor"] as const;

const PERU_DESTINATION = "Peru";
const PERU_DESTINATION_SUPPLIERS = ["San Miguel Industrias (SMI)"] as const;
const DOMINICAN_REPUBLIC_DESTINATION = "Dominican Republic";
const DOMINICAN_REPUBLIC_DESTINATION_SUPPLIERS = ["SMI PET"] as const;

const NIGERIA_DESTINATION = "Nigeria";
const NIGERIA_DESTINATION_SUPPLIERS = ["No contract (Resin formula unknown)"] as const;
const BOLIVIA_DESTINATION = "Bolivia";
const BOLIVIA_DESTINATION_SUPPLIERS = [
  "Gestora, Administradora e Industrializadora Preformas S.A.",
] as const;
const KOREA_DESTINATION = "Korea";
const KOREA_DESTINATION_SUPPLIERS: readonly string[] = [];
const PANAMA_DESTINATION = "Panama";
const PANAMA_DESTINATION_SUPPLIERS = ["Pastiglas S.A"] as const;
const URUGUAY_DESTINATION = "Uruguay";
const URUGUAY_DESTINATION_SUPPLIERS = ["Cristalpet"] as const;

function isAmcorOnlyDestination(destination: string): boolean {
  return AMCOR_ONLY_DESTINATIONS.has(destination);
}

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

const SourceCountryCard: React.FC<SourceCountryCardProps> = ({
  country,
  destination,
  month,
  year,
  vendorBreakdowns,
  isSelected = false,
  onSelect,
  onDeepDive: _onDeepDive,
}) => {
  const marketTlc = useMemo(() => {
    return (
      country.breakdown.find((b) =>
        b.label.toLowerCase().includes(TOTAL_LANDED_COST_KEY)
      )?.amount ?? null
    );
  }, [country.breakdown]);

  const supplierTlc = useMemo(() => {
    if (isColombiaMarch2026View(destination, month, year)) {
      const shared = getColombiaMarch2026SharedSupplierTlc(vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isEcuadorMarch2026View(destination, month, year)) {
      const shared = getEcuadorMarch2026SharedSupplierTlc(vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isPanamaApril2026View(destination, month, year)) {
      const shared = getPanamaApril2026SharedSupplierTlc(vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isPeruApril2026View(destination, month, year)) {
      const shared = getPeruApril2026SharedSupplierTlc(vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isDominicanRepublicApril2026View(destination, month, year)) {
      const shared = getDominicanRepublicApril2026SharedSupplierTlc(vendorBreakdowns);
      if (shared !== null) return shared;
    }
    if (isArgentinaApril2026View(destination, month, year)) {
      const shared = getArgentinaApril2026SharedSupplierTlc(vendorBreakdowns);
      if (shared !== null) return shared;
    }
    const match = vendorBreakdowns.find(
      (item) =>
        item.destination === destination &&
        item.sourceCountry === country.country &&
        item.month === month &&
        vendorYearMatches(item.year, year)
    );

    const vendorTlc = match?.rows.find(
      (row) => row.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
    );

    return vendorTlc?.amount ?? null;
  }, [vendorBreakdowns, destination, month, year, country.country]);

  const parseNumeric = (value: number | string | null) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const numeric = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(numeric) ? numeric : null;
  };

  const supplierEntries = useMemo(() => {
    const matches = vendorBreakdowns.filter(
      (item) =>
        item.destination === destination &&
        item.sourceCountry === country.country &&
        item.month === month &&
        vendorYearMatches(item.year, year)
    );

    const fromData = matches
      .map((item, index) => {
        const row = item.rows.find(
          (r) => r.label.trim().toLowerCase() === SUPPLIER_TLC_LABEL
        );
        const tlcAmount = row?.amount ?? null;
        const name = supplierDisplayNameForEntry(item) || `Supplier ${index + 1}`;
        return { name, tlcAmount };
      })
      .filter((item) => item.tlcAmount !== null && item.tlcAmount !== "");

    const compactFromData = fromData.filter((item, index, source) => {
      const key = `${item.name.trim().toLowerCase()}|${String(item.tlcAmount ?? "")}`;
      return (
        source.findIndex(
          (candidate) =>
            `${candidate.name.trim().toLowerCase()}|${String(candidate.tlcAmount ?? "")}` === key
        ) === index
      );
    });
    if (compactFromData.length) return compactFromData;

    const supplierBase = parseNumeric(supplierTlc);
    const fixedSuppliers = getDestinationFixedSuppliers(destination);
    if (fixedSuppliers !== null && fixedSuppliers.length === 0) {
      return [];
    }

    if (fixedSuppliers === null) {
      return [];
    }

    if (
      supplierBase !== null &&
      destination !== BRAZIL_DESTINATION
    ) {
      const v = Number(supplierBase.toFixed(1));
      return fixedSuppliers.map((name) => ({
        name,
        tlcAmount: v,
      }));
    }

    return fixedSuppliers.map((name) => ({ name, tlcAmount: 0 }));
  }, [vendorBreakdowns, destination, country.country, month, year, supplierTlc]);

  const primarySupplier = supplierEntries[0] ?? null;
  const additionalSupplierCount = Math.max(supplierEntries.length - 1, 0);

  const deltaVsSupplier = useMemo(() => {
    const diff = country.breakdown.find((b) =>
      b.label.toLowerCase().includes(DIFFERENCE_KEY)
    );
    return typeof diff?.amount === "number" ? diff.amount : null;
  }, [country.breakdown]);

  const formatTlc = (value: number | string | null) => {
    if (typeof value === "number") return `$${formatAmount(value)}/MT`;
    if (value === null || value === "") return "$0/MT";
    return formatAmount(value);
  };

  const marketTlcDisplay = formatTlc(marketTlc);
  const deltaDisplay =
    deltaVsSupplier === null
      ? "$0/MT"
      : `${deltaVsSupplier > 0 ? "+" : ""}$${formatAmount(deltaVsSupplier)}/MT`;
  const isSaving = deltaVsSupplier !== null && deltaVsSupplier < 0;

  return (
    <Card
      onClick={onSelect}
      className={`shadow-lg transition-transform ${
        onSelect ? "cursor-pointer hover:-translate-y-0.5" : "hover:-translate-y-0.5"
      } ${isSelected ? "ring-2 ring-primary/60 border-primary/40" : ""}`}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-3 max-sm:grid-cols-[1fr_1fr]">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-foreground">
              {country.country}
            </h3>
          </div>

          <div>
            <p className="text-base font-bold text-primary">
              {marketTlcDisplay}
            </p>
          </div>

          <div>
            {primarySupplier ? (
              <div>
                <p className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Lead
                  </span>
                  <span className="text-muted-foreground">{primarySupplier.name}:</span>
                  {formatTlc(primarySupplier.tlcAmount)}
                  {additionalSupplierCount > 0 ? (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      +{additionalSupplierCount} more
                    </span>
                  ) : null}
                </p>
                {isArgentinaApril2026View(destination, month, year) ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Resin index (Excel): {ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL}
                  </p>
                ) : null}
                {isBrazilApril2026View(destination, month, year) &&
                primarySupplier?.name.trim().toLowerCase().startsWith("amcor") ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Resin index (Excel): {BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">$0/MT</p>
            )}
          </div>

          <div>
            {primarySupplier ? (() => {
              const supplierValue = parseNumeric(primarySupplier.tlcAmount);
              const marketValue = parseNumeric(marketTlc);
              const supplierDelta =
                supplierValue !== null && marketValue !== null
                  ? Number((supplierValue - marketValue).toFixed(1))
                  : null;
              const supplierSaving = supplierDelta !== null && supplierDelta < 0;
              return (
                <p
                  className={`text-sm font-semibold ${
                    supplierSaving
                      ? "text-destructive"
                      : supplierDelta === null
                        ? "text-muted-foreground"
                        : "text-success"
                  }`}
                >
                  {supplierDelta === null
                    ? "$0/MT"
                    : formatDeltaVersusMarketForCompany(supplierDelta)}
                </p>
              );
            })() : (
              <p
                className={`text-base font-semibold ${
                  isSaving
                    ? "text-destructive"
                    : deltaVsSupplier === null
                      ? "text-muted-foreground"
                      : "text-success"
                }`}
              >
                {deltaDisplay}
              </p>
            )}
          </div>
        </div>
        {isSelected && supplierEntries.length > 1 ? (
          <div className="mt-3 rounded-lg border border-border/70 bg-background/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Supplier Breakdown
              </p>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {supplierEntries.length} suppliers
              </span>
            </div>
            <div className="space-y-2">
              {supplierEntries.map((supplier) => {
                const supplierValue = parseNumeric(supplier.tlcAmount);
                const marketValue = parseNumeric(marketTlc);
                const supplierDelta =
                  supplierValue !== null && marketValue !== null
                    ? Number((supplierValue - marketValue).toFixed(1))
                    : null;
                const supplierSaving = supplierDelta !== null && supplierDelta < 0;
                return (
                  <div
                    key={`${supplier.name}-expanded`}
                    className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-3 rounded-md border border-border/60 bg-card/30 px-2.5 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground truncate">{supplier.name}</span>
                    <span className="text-primary font-semibold">{formatTlc(supplier.tlcAmount)}</span>
                    <span
                      className={`text-right font-semibold ${
                        supplierDelta === null
                          ? "text-muted-foreground"
                          : supplierSaving
                            ? "text-destructive"
                            : "text-success"
                      }`}
                    >
                      {supplierDelta === null
                        ? "$0/MT"
                        : formatDeltaVersusMarketForCompany(supplierDelta)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default SourceCountryCard;

