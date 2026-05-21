import type { VendorBreakdownEntry } from "../types";

/**
 * Vendor breakdown rows are keyed by destination × sourceCountry × month × year.
 * Trends / simulation need a single source row stream. If the URL requests a source
 * with no rows for the destination, fall back to any source that has data (prefer China).
 */
export function pickEffectiveVendorSourceCountry(
  vendorBreakdowns: VendorBreakdownEntry[],
  destination: string,
  requestedSource: string
): string {
  const dest = destination.trim();
  const pool = vendorBreakdowns.filter((e) => !dest || e.destination === dest);
  const requested = requestedSource.trim();

  if (requested && pool.some((e) => e.sourceCountry === requested)) {
    return requested;
  }

  const sources = [...new Set(pool.map((e) => e.sourceCountry))].filter(Boolean);
  sources.sort((a, b) => a.localeCompare(b));
  if (sources.includes("China")) return "China";
  return sources[0] ?? "China";
}
