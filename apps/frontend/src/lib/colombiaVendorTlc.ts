import type { VendorBreakdownEntry } from "../types";

const SUPPLIER_ROW = "total resin price abi virgin formula";

export function parseVendorTlcAmount(
  value: number | string | null | undefined
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const numeric = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

export function vendorYearMatches(
  itemYear: string | number | null | undefined,
  selectedYear: string | number | null | undefined
): boolean {
  return String(itemYear ?? "") === String(selectedYear ?? "");
}

/** Colombia Mar 2026 vendor data in JSON is only present for China; Excel still patches that row. */
export function isColombiaMarch2026View(
  destination: string,
  month: string,
  year: string
): boolean {
  return destination === "Colombia" && month === "March" && String(year) === "2026";
}

/**
 * Single Supplier TLC for the Colombia / March / 2026 matrix: prefer China’s breakdown row
 * (the one backend + Excel fill), then any other source for that slice.
 */
export function getColombiaMarch2026SharedSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Colombia" &&
      item.month === "March" &&
      vendorYearMatches(item.year, "2026")
  );
  const china = pool.find((p) => p.sourceCountry === "China");
  const entry = china ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

export function isEcuadorMarch2026View(
  destination: string,
  month: string,
  year: string
): boolean {
  return destination === "Ecuador" && month === "March" && String(year) === "2026";
}

/** Same pattern as Colombia: one TLC for the matrix; backend + Excel fill every source row. */
export function getEcuadorMarch2026SharedSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Ecuador" &&
      item.month === "March" &&
      vendorYearMatches(item.year, "2026")
  );
  const china = pool.find((p) => p.sourceCountry === "China");
  const entry = china ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

export function isPanamaApril2026View(
  destination: string,
  month: string,
  year: string
): boolean {
  return destination === "Panama" && month === "April" && String(year) === "2026";
}

export function getPanamaApril2026SharedSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Panama" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const china = pool.find((p) => p.sourceCountry === "China");
  const entry = china ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

export function isPeruApril2026View(
  destination: string,
  month: string,
  year: string
): boolean {
  return destination === "Peru" && month === "April" && String(year) === "2026";
}

export function getPeruApril2026SharedSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Peru" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const china = pool.find((p) => p.sourceCountry === "China");
  const entry = china ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

export function isDominicanRepublicApril2026View(
  destination: string,
  month: string,
  year: string
): boolean {
  return (
    destination === "Dominican Republic" &&
    month === "April" &&
    String(year) === "2026"
  );
}

export function getDominicanRepublicApril2026SharedSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Dominican Republic" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const china = pool.find((p) => p.sourceCountry === "China");
  const entry = china ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

/** Resin workbook row: supplier / plant for Argentina April 2026 Supplier TLC (Excel ``final_data``). */
export const ARGENTINA_APRIL_2026_RESIN_VENDOR_LABEL = "ALPEK · Suape";

export function isArgentinaApril2026View(
  destination: string,
  month: string,
  year: string
): boolean {
  return destination === "Argentina" && month === "April" && String(year) === "2026";
}

export function getArgentinaApril2026SharedSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Argentina" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const china = pool.find((p) => p.sourceCountry === "China");
  const entry = china ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

export function isBrazilApril2026View(
  destination: string,
  month: string,
  year: string
): boolean {
  return destination === "Brazil" && month === "April" && String(year) === "2026";
}

/** SUAPE / ALPEK / Suape row in Amcor ``final_data`` (resin index for Brazil Amcor TLC). */
export const BRAZIL_APRIL_2026_AMCOR_RESIN_VENDOR_LABEL = "ALPEK · Suape";

export function getBrazilApril2026AmcorSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Brazil" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const amcor = pool.find(
    (p) => (p.supplierName ?? "").trim().toLowerCase() === "amcor"
  );
  const entry = amcor ?? pool.find((p) => p.sourceCountry === "China") ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

/** Valgroup ``final_data``: prefers **TLC ÷ Fx (M-1)** when present (Brazil Valgroup Supplier TLC). */
export const BRAZIL_APRIL_2026_VALGROUP_VENDOR_LABEL =
  "TLC ÷ Fx (M-1) (Excel · Valgroup months)";

export function getBrazilApril2026ValgroupSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Brazil" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const valgroup = pool.find(
    (p) => (p.supplierName ?? "").trim().toLowerCase() === "valgroup"
  );
  const entry = valgroup ?? pool.find((p) => p.sourceCountry === "China") ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

/** Cristalpet ``final_data``: prefers **TLC ÷ Fx (M-1)** when present (Brazil Cristalpet Supplier TLC). */
export const BRAZIL_APRIL_2026_CRISTALPET_VENDOR_LABEL =
  "TLC ÷ Fx (M-1) (Excel · Cristalpet indices)";

export function getBrazilApril2026CristalpetSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Brazil" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const cristalpet = pool.find(
    (p) => (p.supplierName ?? "").trim().toLowerCase() === "cristalpet"
  );
  const entry = cristalpet ?? pool.find((p) => p.sourceCountry === "China") ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}

/** Engepack ``final_data``: **Total Landing Cost** value, April 2026 (Brazil). */
export const BRAZIL_APRIL_2026_ENGEPACK_VENDOR_LABEL =
  "Total Landing Cost (Excel · Engepack indices)";

export function getBrazilApril2026EngepackSupplierTlc(
  vendorBreakdowns: VendorBreakdownEntry[]
): number | null {
  const pool = vendorBreakdowns.filter(
    (item) =>
      item.destination === "Brazil" &&
      item.month === "April" &&
      vendorYearMatches(item.year, "2026")
  );
  const engepack = pool.find(
    (p) => (p.supplierName ?? "").trim().toLowerCase() === "engepack"
  );
  const entry = engepack ?? pool.find((p) => p.sourceCountry === "China") ?? pool[0];
  if (!entry) return null;
  const row = entry.rows.find(
    (r) => r.label.trim().toLowerCase() === SUPPLIER_ROW
  );
  return parseVendorTlcAmount(row?.amount ?? null);
}
