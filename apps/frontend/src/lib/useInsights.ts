import { useCallback, useEffect, useRef, useState } from "react";
import type { InsightsRequest, InsightsResult } from "../types";
import { createApiUrl } from "./api";

type UseInsightsState = {
  data: InsightsResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Fetches AI insights for the given page by POSTing the current data payload
 * to /insights.  Re-fetches whenever `request` reference changes (shallow compare
 * on JSON serialisation so it doesn't re-fire on every render).
 */
export function useInsights(request: InsightsRequest): UseInsightsState {
  const [data, setData] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Serialise to detect meaningful changes without deep-equal library
  const requestKey = JSON.stringify(request);
  const prevKey = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchInsights = useCallback(
    (key: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      const url = createApiUrl("/insights");

      fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: key,
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<InsightsResult>;
        })
        .then((payload) => {
          setData(payload);
          setLoading(false);
        })
        .catch((err) => {
          if ((err as Error).name === "AbortError") return;
          setError(String(err));
          setLoading(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (requestKey === prevKey.current) return;
    prevKey.current = requestKey;
    fetchInsights(requestKey);
  }, [requestKey, fetchInsights]);

  const refresh = useCallback(() => {
    fetchInsights(requestKey);
  }, [fetchInsights, requestKey]);

  return { data, loading, error, refresh };
}
