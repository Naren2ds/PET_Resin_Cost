import type { VendorBreakdownEntry } from "../types";

const BRAZIL_DESTINATION = "brazil";
const AMCOR_SUPPLIER = "amcor";

const normalizeKey = (value: string | undefined | null) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const formatSupplierLocation = (location: string) =>
  location
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const supplierLocationForEntry = (entry: VendorBreakdownEntry | undefined) =>
  (entry?.location?.trim() ||
    entry?.rows.find((row) => row.location?.trim())?.location?.trim() ||
    "");

export const rawSupplierNameForEntry = (entry: VendorBreakdownEntry | undefined) =>
  (entry?.supplierName ?? entry?.supplier ?? entry?.vendor ?? "").trim();

export const supplierBaseNameForEntry = (entry: VendorBreakdownEntry | undefined) => {
  const location = supplierLocationForEntry(entry);
  const raw = (entry?.supplier ?? entry?.supplierName ?? entry?.vendor ?? "").trim();
  if (!raw || !location) return raw;
  return raw.replace(new RegExp(`\\s*-\\s*${escapeRegExp(location)}$`, "i"), "").trim();
};

export const isBrazilAmcorLocationEntry = (entry: VendorBreakdownEntry | undefined) => {
  if (!entry) return false;
  const location = supplierLocationForEntry(entry);
  return (
    normalizeKey(entry.destination) === BRAZIL_DESTINATION &&
    normalizeKey(supplierBaseNameForEntry(entry)) === AMCOR_SUPPLIER &&
    Boolean(location) &&
    normalizeKey(location) !== normalizeKey(entry.destination)
  );
};

export const supplierDisplayNameForEntry = (entry: VendorBreakdownEntry | undefined) => {
  const base = supplierBaseNameForEntry(entry) || rawSupplierNameForEntry(entry);
  if (isBrazilAmcorLocationEntry(entry)) {
    return `${base} (${formatSupplierLocation(supplierLocationForEntry(entry))})`;
  }
  return rawSupplierNameForEntry(entry) || base;
};

export const supplierNameMatchesEntry = (
  entry: VendorBreakdownEntry | undefined,
  requestedName: string
) => {
  const requested = normalizeKey(requestedName);
  if (!entry || !requested) return false;

  const base = supplierBaseNameForEntry(entry);
  const location = supplierLocationForEntry(entry);
  const baseKey = normalizeKey(base);
  const specificAliases = [
    supplierDisplayNameForEntry(entry),
    rawSupplierNameForEntry(entry),
    entry.vendor ?? "",
    location ? `${base} - ${location}` : "",
    location ? `${base} (${formatSupplierLocation(location)})` : "",
  ]
    .map(normalizeKey)
    .filter((alias) => alias && (!location || alias !== baseKey));

  if (
    specificAliases.some(
      (alias) =>
        alias === requested ||
        alias.includes(requested) ||
        requested.includes(alias)
    )
  ) {
    return true;
  }

  const baseAliases = [base, entry.supplier ?? ""].map(normalizeKey).filter(Boolean);
  return baseAliases.some(
    (alias) =>
      alias === requested ||
      (!location && (alias.includes(requested) || requested.includes(alias)))
  );
};

export const fallbackSupplierNameForDestination = (destination: string | undefined) => {
  const value = (destination ?? "").trim();
  if (value === "Brazil") return "Amcor";
  if (value === "Peru") return "Pastiglas S.A";
  if (value === "Dominican Republic") return "SMI PET";
  if (value === "Panama") return "Pastiglas S.A";
  if (value === "Uruguay") return "Cristalpet";
  if (value === "Bolivia") {
    return "Gestora, Administradora e Industrializadora Preformas S.A.";
  }
  if (
    value === "Argentina" ||
    value === "Colombia" ||
    value === "Ecuador" ||
    value === "El Salvador and Honduras"
  ) {
    return "Amcor";
  }
  return "";
};
