import { useCallback, useEffect, useRef, useState } from "react";
import type { InsightsRequest, InsightsResult } from "../types";
import { createApiUrl } from "./api";

type InsightsCacheDocument = {
  generatedAt?: string;
  entries: Record<string, InsightsResult>;
};

const INSIGHTS_CACHE_URL = "/insights-cache.json";
const INSIGHTS_API_PATH = "/insights";
let cachePromise: Promise<InsightsCacheDocument> | null = null;

type InsightsMode = "cache-only" | "api-only" | "hybrid";

const resolveInsightsMode = (): InsightsMode => {
  const rawMode = String(import.meta.env.VITE_INSIGHTS_MODE ?? "hybrid")
    .trim()
    .toLowerCase();
  if (rawMode === "cache-only" || rawMode === "api-only" || rawMode === "hybrid") {
    return rawMode;
  }
  return "hybrid";
};

const INSIGHTS_MODE: InsightsMode = resolveInsightsMode();

type UseInsightsState = {
  data: InsightsResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const normaliseToken = (value: unknown, fallback = "all") => {
  if (value === null || value === undefined) return fallback;
  const token = String(value).trim().toLowerCase();
  if (!token) return fallback;
  return token.replace(/\s+/g, "_");
};

const formatNumericToken = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "na";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "na";
  return parsed.toFixed(2);
};

export const buildInsightsCacheKey = (request: InsightsRequest) => {
  const page = normaliseToken(request.page, "unknown");
  const destination = normaliseToken(request.destination);
  const month = normaliseToken(request.month);
  const year = normaliseToken(request.year);
  const parts = [
    `page=${page}`,
    `destination=${destination}`,
    `month=${month}`,
    `year=${year}`,
  ];

  if (page === "simulation") {
    parts.push(`base_tlc=${formatNumericToken(request.baseTlc)}`);
    parts.push(`simulated_tlc=${formatNumericToken(request.simulatedTlc)}`);
  }

  return parts.join("|");
};

const parseCacheDocument = (payload: unknown): InsightsCacheDocument => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Insights cache payload is not a valid object.");
  }

  const candidate = payload as {
    generatedAt?: unknown;
    entries?: unknown;
  };

  if (!candidate.entries || typeof candidate.entries !== "object") {
    throw new Error("Insights cache does not define a valid entries map.");
  }

  return {
    generatedAt:
      typeof candidate.generatedAt === "string" ? candidate.generatedAt : undefined,
    entries: candidate.entries as Record<string, InsightsResult>,
  };
};

const loadInsightsCache = (forceReload = false): Promise<InsightsCacheDocument> => {
  if (!cachePromise || forceReload) {
    cachePromise = fetch(INSIGHTS_CACHE_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(parseCacheDocument)
      .catch((err) => {
        cachePromise = null;
        throw err;
      });
  }

  return cachePromise;
};

const fetchInsightsFromApi = (request: InsightsRequest): Promise<InsightsResult> => {
  const url = createApiUrl(INSIGHTS_API_PATH);
  return fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<InsightsResult>;
  });
};

/**
 * Fetches AI insights from a pre-generated JSON cache file.
 * Re-fetches whenever the cache lookup key changes.
 */
export function useInsights(request: InsightsRequest): UseInsightsState {
  const [data, setData] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestKey = buildInsightsCacheKey(request);
  const prevKey = useRef<string>("");
  const requestCounter = useRef(0);

  const fetchInsights = useCallback(
    async (requestPayload: InsightsRequest, forceReload = false) => {
      requestCounter.current += 1;
      const activeRequestId = requestCounter.current;
      const key = buildInsightsCacheKey(requestPayload);

      setLoading(true);
      setError(null);

      if (INSIGHTS_MODE !== "api-only") {
        try {
          const cache = await loadInsightsCache(forceReload);
          if (activeRequestId !== requestCounter.current) return;

          const cached = cache.entries[key] ?? null;
          if (cached) {
            setData(cached);
            setLoading(false);
            return;
          }

          if (INSIGHTS_MODE === "cache-only") {
            setData(null);
            setLoading(false);
            return;
          }
        } catch (cacheErr) {
          if (activeRequestId !== requestCounter.current) return;
          if (INSIGHTS_MODE === "cache-only") {
            setError(String(cacheErr));
            setLoading(false);
            return;
          }
        }
      }

      try {
        const payload = await fetchInsightsFromApi(requestPayload);
        if (activeRequestId !== requestCounter.current) return;
        setData(payload);
        setLoading(false);
      } catch (apiErr) {
        if (activeRequestId !== requestCounter.current) return;
        setError(String(apiErr));
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (requestKey === prevKey.current) return;
    prevKey.current = requestKey;
    void fetchInsights(request);
  }, [request, requestKey, fetchInsights]);

  const refresh = useCallback(() => {
    void fetchInsights(request, true);
  }, [fetchInsights, request]);

  return { data, loading, error, refresh };
}
