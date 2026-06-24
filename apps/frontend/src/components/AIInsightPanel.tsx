import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { InsightsRequest } from "../types";
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

  const hasContent = !loading && !error && data?.insights;

  return (
    <Card
      className={`border border-border bg-card shadow-sm transition-all duration-300 ${className}`}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Sparkle icon */}
          <span className="text-primary text-base" aria-hidden>✦</span>
          <CardTitle className="text-sm font-semibold text-foreground">
            AI Insights
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

          {/* Insights – render raw markdown bullets as plain text with simple
              bold conversion so we avoid a full markdown dependency */}
          {hasContent && (
            <ul className="space-y-2 mt-1">
              {data!.insights
                .split("\n")
                .filter((line) => line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*"))
                .map((line, idx) => {
                  // Strip leading bullet character
                  const text = line.replace(/^[\s•\-*]+/, "").trim();
                  // Convert **word** to <strong>
                  const parts = text.split(/\*\*(.+?)\*\*/g);
                  return (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                      <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>
                        {parts.map((part, pi) =>
                          pi % 2 === 1 ? (
                            <strong key={pi} className="font-semibold text-primary">
                              {part}
                            </strong>
                          ) : (
                            <span key={pi}>{part}</span>
                          )
                        )}
                      </span>
                    </li>
                  );
                })}
            </ul>
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
