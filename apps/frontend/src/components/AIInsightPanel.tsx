import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type {
  InsightsRequest,
  ProcurementIntelligence,
  ProcurementIntelligenceRecord,
  ProcurementSummaryItem,
} from "../types";
import { useInsights } from "../lib/useInsights";

type Props = {
  request: InsightsRequest;
  /** Optional extra class names on the outer card */
  className?: string;
};

/**
 * AIInsightPanel
 * Collapsible card that calls the backend /insights endpoint and renders
 * LLM-generated bullet points.  Placed at the top of each data page so the
 * user sees AI commentary before diving into charts.
 */
export default function AIInsightPanel({ request, className = "" }: Props) {
  const { data, loading, error, refresh } = useInsights(request);
  const [expanded, setExpanded] = useState(true);
  const [activeView, setActiveView] = useState<"procurement" | "summary">(
    "procurement"
  );
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const hasContent = !loading && !error && data?.insights;
  const procurement = (data?.analytics?.procurement_intelligence ?? null) as ProcurementIntelligence | null;

  const topRecords = useMemo(() => {
    if (!procurement?.records?.length) return [];
    const sorted = [...procurement.records].sort((a, b) => {
      const aPriority = priorityScore(a.negotiation_priority);
      const bPriority = priorityScore(b.negotiation_priority);
      const aGap = a.gap_abs ?? -999999;
      const bGap = b.gap_abs ?? -999999;
      return bPriority - aPriority || bGap - aGap;
    });

    const grouped = new Map<string, ProcurementIntelligenceRecord[]>();
    for (const record of sorted) {
      const key = String(record.source_country || "Unknown Source");
      const bucket = grouped.get(key) ?? [];
      if (bucket.length < 2) {
        bucket.push(record);
      }
      grouped.set(key, bucket);
    }

    const topCountryKeys = [...grouped.entries()]
      .sort((a, b) => {
        const bestA = a[1][0];
        const bestB = b[1][0];
        const pA = priorityScore(bestA?.negotiation_priority ?? "");
        const pB = priorityScore(bestB?.negotiation_priority ?? "");
        const gA = bestA?.gap_abs ?? -999999;
        const gB = bestB?.gap_abs ?? -999999;
        return pB - pA || gB - gA || a[0].localeCompare(b[0]);
      })
      .slice(0, 2)
      .map(([country]) => country);

    return topCountryKeys.flatMap((country) => grouped.get(country) ?? []);
  }, [procurement]);

  const overallSummary = useMemo(() => {
    const records = procurement?.records ?? [];
    if (!records.length) {
      return {
        avgSupplierTlc: null as number | null,
        avgBenchmarkTlc: null as number | null,
        avgGap: null as number | null,
        highPriorityCount: 0,
        topDrivers: [] as Array<[string, number]>,
        forecastMix: { increasing: 0, decreasing: 0, stable: 0, noData: 0 },
        recommendationLines: [] as string[],
      };
    }

    const numeric = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));
    const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

    const supplierValues = records
      .map((r) => numeric(r.supplier_tlc))
      .filter((v): v is number => v !== null);
    const benchmarkValues = records
      .map((r) => numeric(r.same_source_market_tlc))
      .filter((v): v is number => v !== null);
    const gapValues = records
      .map((r) => numeric(r.gap_abs))
      .filter((v): v is number => v !== null);

    const driverCounts = new Map<string, number>();
    for (const r of records) {
      const drivers = [r.largest_cost_driver, r.second_largest_cost_driver].filter(
        (d) => d && d !== "Unknown"
      );
      for (const d of drivers) {
        driverCounts.set(d, (driverCounts.get(d) ?? 0) + 1);
      }
    }
    const topDrivers = [...driverCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3);

    const forecastMix = { increasing: 0, decreasing: 0, stable: 0, noData: 0 };
    for (const r of records) {
      const trend = String(r.forecast_trend || "").toLowerCase();
      if (!trend || trend === "insufficient data") {
        forecastMix.noData += 1;
      } else if (trend.includes("increasing")) {
        forecastMix.increasing += 1;
      } else if (trend.includes("decreasing")) {
        forecastMix.decreasing += 1;
      } else if (trend.includes("stable")) {
        forecastMix.stable += 1;
      } else {
        forecastMix.noData += 1;
      }
    }

    const highPriority = records.filter((r) => String(r.negotiation_priority).toLowerCase() === "high");
    const recommendationLines = highPriority.slice(0, 3).map(
      (r) => `${r.supplier} (${r.source_country}): ${r.recommended_action}`
    );

    return {
      avgSupplierTlc: mean(supplierValues),
      avgBenchmarkTlc: mean(benchmarkValues),
      avgGap: mean(gapValues),
      highPriorityCount: highPriority.length,
      topDrivers,
      forecastMix,
      recommendationLines,
    };
  }, [procurement]);

  const parsedBullets = useMemo(() => {
    if (!data?.insights) return [];
    return data.insights
      .split("\n")
      .filter((line) => line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*"))
      .map((line) => line.replace(/^[\s•\-*]+/, "").trim());
  }, [data?.insights]);

  const toggleCard = (key: string) => {
    setExpandedCards((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <Card
      className={`border border-border bg-card shadow-sm transition-all duration-300 ${className}`}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Sparkle icon */}
          <span className="text-primary text-base" aria-hidden>✦</span>
          <CardTitle className="text-sm font-semibold text-foreground">
            Procurement Intelligence
          </CardTitle>
          {loading && (
            <span className="ml-1 text-xs text-muted-foreground animate-pulse">
              Analysing…
            </span>
          )}
          {!loading && data && (
            <span className="ml-1 text-[11px] text-muted-foreground">
              {request.month && request.year
                ? `${request.month} ${request.year}`
                : request.year ?? ""}
              {request.destination ? ` · ${request.destination}` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          {!loading && (
            <button
              onClick={refresh}
              title="Regenerate insights"
              className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none"
            >
              ↺
            </button>
          )}
          {/* Collapse / expand */}
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Collapse" : "Expand"}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm leading-none"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-2 py-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-3 rounded bg-muted animate-pulse"
                  style={{ width: `${85 - i * 8}%` }}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <p className="text-sm text-destructive">
              Could not load insights. {error}
            </p>
          )}

          {!loading && !error && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <TabButton
                  active={activeView === "procurement"}
                  onClick={() => setActiveView("procurement")}
                  label="Procurement Intelligence"
                />
                <TabButton
                  active={activeView === "summary"}
                  onClick={() => setActiveView("summary")}
                  label="Overall Summary"
                />
              </div>

              {activeView === "procurement" && (
                <div className="space-y-2">
                  {topRecords.length ? (
                    topRecords.map((record, idx) => {
                      const cardKey = `${record.supplier}-${record.source_country}-${record.location || idx}`;
                      const isOpen = !!expandedCards[cardKey];
                      return (
                        <div key={cardKey} className="rounded-lg border border-border bg-background/30 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {record.supplier} · {record.source_country}
                              </p>
                              <p className="text-xs text-muted-foreground">{record.destination}{record.location ? ` · ${record.location}` : ""}</p>
                            </div>
                            <button
                              onClick={() => toggleCard(cardKey)}
                              className="text-xs font-medium text-primary hover:underline"
                              type="button"
                            >
                              {isOpen ? "Hide evidence" : "Show evidence"}
                            </button>
                          </div>

                          <div className="mt-2 grid gap-1.5 text-xs md:grid-cols-2">
                            <TagLine label="Pricing Opportunity" value={pricingOpportunityLabel(record)} />
                            <TagLine
                              label="Cost Driver"
                              value={`${record.largest_cost_driver}${record.second_largest_cost_driver && record.second_largest_cost_driver !== "Unknown" ? `, ${record.second_largest_cost_driver}` : ""}`}
                            />
                            <TagLine label="Gap Driver" value={gapDriverNarrative(record)} />
                            <TagLine label="Forecast Risk" value={forecastRiskLabel(record)} />
                            <TagLine label="Recommended Action" value={record.recommended_action} className="md:col-span-2" />
                          </div>

                          {isOpen && (
                            <div className="mt-3 rounded-md border border-border/70 bg-card/60 p-2.5 text-xs text-muted-foreground">
                              <p>Supplier TLC: {formatCurrency(record.supplier_tlc)} | Same-source benchmark: {formatCurrency(record.same_source_market_tlc)} | Best market TLC: {formatCurrency(record.best_market_tlc)}</p>
                              <p className="mt-1">Gap: {formatSignedCurrency(record.gap_abs)} ({formatPct(record.gap_pct)}) | Rank: {record.supplier_rank ?? "N/A"}</p>
                              <p className="mt-1">Supplier forecast trend: {isInsufficient(record.forecast_trend) ? "no data" : stripTrendPercentage(record.forecast_trend)} | vs benchmark: {isInsufficient(record.forecast_gap_trend) ? "no benchmark data" : stripTrendPercentage(record.forecast_gap_trend)}</p>
                              <p className="mt-1">Gap opportunity note: {gapOpportunityNarrative(record)}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No procurement intelligence records available for this selection.</p>
                  )}
                </div>
              )}

              {activeView === "summary" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-background/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall Pricing</p>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                      <TagLine label="Avg Supplier TLC" value={formatCurrency(overallSummary.avgSupplierTlc)} />
                      <TagLine label="Avg Benchmark TLC" value={formatCurrency(overallSummary.avgBenchmarkTlc)} />
                      <TagLine label="Avg Gap" value={formatSignedCurrency(overallSummary.avgGap)} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing Breakdown Drivers</p>
                    {overallSummary.topDrivers.length ? (
                      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                        {overallSummary.topDrivers.map(([driver, count]) => (
                          <li key={driver} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                            <span>{driver} appears in {count} supplier scenarios</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">No component drivers available.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-background/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forecast Outlook</p>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
                      <TagLine label="Increasing" value={String(overallSummary.forecastMix.increasing)} />
                      <TagLine label="Stable" value={String(overallSummary.forecastMix.stable)} />
                      <TagLine label="Decreasing" value={String(overallSummary.forecastMix.decreasing)} />
                      <TagLine label="No Data" value={String(overallSummary.forecastMix.noData)} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendations</p>
                    <p className="mt-1 text-sm text-foreground">High-priority negotiations identified: {overallSummary.highPriorityCount}</p>
                    {overallSummary.recommendationLines.length ? (
                      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                        {overallSummary.recommendationLines.map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">No high-priority recommendation lines available.</p>
                    )}
                  </div>

                  <SummaryBlock title="Top Risks" items={procurement?.summary?.top_risks ?? []} />
                  <SummaryBlock title="Top Opportunities" items={procurement?.summary?.top_opportunities ?? []} />
                  <SummaryBlock title="Best Suppliers" items={procurement?.summary?.best_suppliers ?? []} />
                  <SummaryBlock title="Worst Suppliers" items={procurement?.summary?.worst_suppliers ?? []} />
                  {parsedBullets.length ? (
                    <div className="rounded-lg border border-border bg-background/20 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LLM Decision Narrative</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                        {parsedBullets.map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!loading && !error && !hasContent && (
            <p className="text-sm text-muted-foreground italic">
              No insights available for the current selection.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

const priorityScore = (value: string) => {
  const key = String(value || "").toLowerCase();
  if (key === "high") return 3;
  if (key === "medium") return 2;
  return 1;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "N/A";
  return `$${Number(value).toFixed(1)}/MT`;
};

const formatSignedCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}$${Number(value).toFixed(1)}`;
};

const formatPct = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(2)}%`;
};

const pricingOpportunityLabel = (record: ProcurementIntelligenceRecord) => {
  if (record.gap_abs === null || record.gap_abs === undefined || record.same_source_market_tlc == null) {
    return "Benchmark unavailable";
  }
  if (record.gap_abs > 0) {
    return `${formatSignedCurrency(record.gap_abs)} vs same-source benchmark`;
  }
  return `${formatSignedCurrency(record.gap_abs)} below same-source benchmark`;
};

const gapDriverNarrative = (record: ProcurementIntelligenceRecord) => {
  const primary = record.largest_cost_driver && record.largest_cost_driver !== "Unknown"
    ? record.largest_cost_driver
    : "supplier pricing"
  ;
  const secondary = record.second_largest_cost_driver && record.second_largest_cost_driver !== "Unknown"
    ? ` with secondary impact from ${record.second_largest_cost_driver}`
    : "";
  return `Gap appears to be driven by ${primary}${secondary}`;
};

const gapOpportunityNarrative = (record: ProcurementIntelligenceRecord) => {
  if (record.gap_abs === null || record.gap_abs === undefined) {
    return "Insufficient benchmark data to estimate opportunity.";
  }
  if (record.gap_abs > 0) {
    return `Potential negotiation upside of ${formatSignedCurrency(record.gap_abs)} per MT versus same-source benchmark.`;
  }
  return `Current offer is ${formatSignedCurrency(record.gap_abs)} per MT below same-source benchmark; maintain pricing discipline.`;
};

const isInsufficient = (value: string | null | undefined) =>
  !value || value.trim().toLowerCase() === "insufficient data";

const stripTrendPercentage = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\s*\([^)]*%\)\s*/g, "")
    .trim();

const RISK_TIERS = ["Low", "Medium", "High"] as const;
type RiskTier = (typeof RISK_TIERS)[number];

const downgradeRisk = (risk: string): string => {
  const idx = RISK_TIERS.indexOf(risk as RiskTier);
  return idx > 0 ? RISK_TIERS[idx - 1] : risk;
};

const forecastRiskLabel = (record: ProcurementIntelligenceRecord) => {
  // Prefer gap trend (supplier vs benchmark); fall back to supplier forecast trend.
  const gapTrend = stripTrendPercentage(record.forecast_gap_trend);
  const supplierTrend = stripTrendPercentage(record.forecast_trend);

  // When the gap is narrowing the supplier is becoming more competitive;
  // downgrade the displayed risk tier by one level to avoid misleading "High" labels.
  const gapDecreasing = gapTrend.toLowerCase().includes("decreasing");
  const baseRisk = gapDecreasing
    ? downgradeRisk(record.volatility_risk ?? "Low")
    : (record.volatility_risk ?? "Low");

  if (!isInsufficient(gapTrend)) {
    return `${baseRisk} · gap ${gapTrend}`;
  }
  if (!isInsufficient(supplierTrend)) {
    return `${baseRisk} · supplier ${supplierTrend}`;
  }
  return `${baseRisk} risk`;
};

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TagLine({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <p className={`rounded border border-border/50 bg-card/40 px-2 py-1 ${className}`}>
      <span className="font-semibold text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </p>
  );
}

function SummaryBlock({
  title,
  items,
}: {
  title: string;
  items: ProcurementSummaryItem[];
}) {
  return (
    <div className="rounded-lg border border-border bg-background/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
          {items.map((item, idx) => (
            <li key={`${item.supplier}-${item.source_country}-${idx}`} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
              <span>
                {item.supplier} ({item.source_country}) · Gap {formatSignedCurrency(item.gap_abs)} ({formatPct(item.gap_pct)}) · {item.negotiation_priority} priority
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">No records available.</p>
      )}
    </div>
  );
}
