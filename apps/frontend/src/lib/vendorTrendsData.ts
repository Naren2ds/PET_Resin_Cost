import type { CountryCost, VendorBreakdownEntry } from "../types";

export const SUPPLIER_TLC_ROW_LABEL = "total resin price abi virgin formula";

/** Parse TLC-style cell; returns null for N/A or missing (distinct from 0). */
export function parseNullableNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "#REF!" || trimmed.toLowerCase() === "n/a") {
    return null;
  }
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

/** Market Research total landed cost for a source country from /countries breakdown. */
export function marketResearchTlcForCountry(
  countries: CountryCost[] | undefined,
  sourceCountry: string
): number | null {
  if (!countries?.length || !sourceCountry) return null;
  const row = countries.find((c) => c.country === sourceCountry);
  if (!row) return null;
  const landed = row.breakdown.find((b) => b.label.toLowerCase().includes("total landed cost"));
  return parseNullableNumber(landed?.amount);
}

export function supplierTlcFromVendorEntry(entry: VendorBreakdownEntry): number | null {
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_TLC_ROW_LABEL
  );
  return parseNullableNumber(row?.amount);
}

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
] as const;

/** Resolve vendor/API month string to 0–11 (handles abbreviations and minor variants). */
export function monthIndexFromVendorMonth(month: string): number {
  const raw = month.trim().toLowerCase().replace(/\./g, "");
  const full = MONTH_ORDER.findIndex((m) => m.toLowerCase() === raw);
  if (full >= 0) return full;
  const abbr3 = raw.slice(0, 3);
  const byAbbr: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    sept: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const idx = byAbbr[abbr3];
  return idx !== undefined ? idx : -1;
}

export const trendPeriodKey = (year: number, monthIndexValue: number) =>
  `${MONTH_ORDER[monthIndexValue]}-${year}`;

/** Map ``Jan-2026``-style keys to supplier TLC from vendor rows (actual API data only). */
export function supplierTlcByPeriodFromEntries(entries: VendorBreakdownEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    const v = supplierTlcFromVendorEntry(entry);
    if (v === null) return;
    const monthIdx = monthIndexFromVendorMonth(entry.month);
    if (monthIdx < 0) return;
    map.set(trendPeriodKey(Number(entry.year), monthIdx), v);
  });
  return map;
}

export type DestinationSourceMonthlyRow = {
  period: string;
  year: number;
  monthIndex: number;
  marketResearchValue: number | null;
  supplierTlcValue: number | null;
};

/** One row per chart period: supplier TLC from vendor rows; MR from latest country breakdown snapshot (repeated per month). */
export function buildDestinationSourceMonthly(args: {
  periods: { year: number; monthIndex: number; period: string }[];
  vendorBreakdowns: VendorBreakdownEntry[];
  destination: string;
  sourceCountry: string;
  countries?: CountryCost[];
}): DestinationSourceMonthlyRow[] {
  const { periods, vendorBreakdowns, destination, sourceCountry, countries } = args;
  const entriesForSource = vendorBreakdowns.filter(
    (e) => e.destination === destination && e.sourceCountry === sourceCountry
  );
  const supplierByPeriod = supplierTlcByPeriodFromEntries(entriesForSource);
  const marketSnapshot = marketResearchTlcForCountry(countries, sourceCountry);

  return periods.map((period) => {
    const key = trendPeriodKey(period.year, period.monthIndex);
    return {
      period: period.period,
      year: period.year,
      monthIndex: period.monthIndex,
      marketResearchValue: marketSnapshot,
      supplierTlcValue: supplierByPeriod.get(key) ?? null,
    };
  });
}
