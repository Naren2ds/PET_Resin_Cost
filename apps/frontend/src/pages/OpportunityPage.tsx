import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  Factory,
  Handshake,
  Lightbulb,
  PackageCheck,
  Search,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { createApiUrl } from "../lib/api";
import type { OpportunityResponse } from "../types";

const workflowStages = [
  {
    number: "01",
    title: "Identify Opportunity",
    description: "TLC comparison → Gap $/MT → Potential $",
    detail: "Compare the current supplier TLC against the best feasible market benchmark and quantify the value pool using annual volume.",
    icon: Search,
  },
  {
    number: "02",
    title: "GPO Validate",
    description: "Confirm benchmark, volume and feasibility",
    detail: "Validate the route, formula, tax and freight treatment, demand volume, product specification and sourcing feasibility.",
    icon: ClipboardCheck,
  },
  {
    number: "03",
    title: "Negotiate Current Supplier",
    description: "Challenge the vPET cost components",
    detail: "Use the independent market benchmark and component gap to define a fact-based negotiation target with the incumbent supplier.",
    icon: Handshake,
  },
  {
    number: "04",
    title: "Evaluate Market Alternative",
    description: "Validate alternative vPET options",
    detail: "If the incumbent does not close the gap, obtain and validate commercial options from the identified source market.",
    icon: BarChart3,
  },
  {
    number: "05",
    title: "Qualify & Execute",
    description: "Technical + commercial qualification",
    detail: "Complete quality, supply, tolling, logistics and commercial qualification before switching or dual-sourcing.",
    icon: PackageCheck,
  },
  {
    number: "06",
    title: "Capture Value",
    description: "Track savings and close the opportunity",
    detail: "Record the negotiated or sourced benefit, compare it with the validated baseline and track realization to closure.",
    icon: BadgeCheck,
  },
];

const currency = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

const compactCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

const opportunityRange = (low: number, high: number) => {
  const lowLabel = compactCurrency(low);
  const highLabel = compactCurrency(high);
  return lowLabel === highLabel ? lowLabel : `${lowLabel}–${highLabel.replace("$", "")}`;
};

const isTotalComponent = (component: string) =>
  component.toLowerCase().includes("total landed cost");

const OpportunityPage: React.FC = () => {
  const [data, setData] = useState<OpportunityResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedStage, setSelectedStage] = useState(0);
  const [selectedKey, setSelectedKey] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "savings" | "increase">("all");

  useEffect(() => {
    const controller = new AbortController();
    fetch(createApiUrl("/opportunities"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Opportunity data could not be loaded (${response.status}).`);
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new Error(
            "The Opportunity API returned the application page instead of data. Restart the frontend and backend services."
          );
        }
        return (await response.json()) as OpportunityResponse;
      })
      .then((payload) => {
        setData(payload);
        const first = payload.summary[0];
        if (first) setSelectedKey(`${first.destination}|${first.supplierLocation}`);
      })
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      });
    return () => controller.abort();
  }, []);

  const selectedSummary = useMemo(() => {
    if (!data) return null;
    return (
      data.summary.find(
        (item) => `${item.destination}|${item.supplierLocation}` === selectedKey
      ) ?? data.summary[0] ?? null
    );
  }, [data, selectedKey]);

  const selectedBreakdown = useMemo(() => {
    if (!data || !selectedSummary) return [];
    return data.breakdowns.filter(
      (item) =>
        item.destination === selectedSummary.destination &&
        item.supplierLocation === selectedSummary.supplierLocation
    );
  }, [data, selectedSummary]);

  const filteredSummary = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "savings") {
      return data.summary.filter((item) => item.estimatedOpportunity > 0);
    }
    if (statusFilter === "increase") {
      return data.summary.filter((item) => item.estimatedOpportunity <= 0);
    }
    return data.summary;
  }, [data, statusFilter]);

  const componentRows = selectedBreakdown.filter((item) => !isTotalComponent(item.component));
  const maxContribution = Math.max(
    1,
    ...componentRows.map((item) => Math.abs(item.savingsContribution))
  );

  if (error) {
    return (
      <main className="pet-page-bg min-h-[70vh] px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-[1380px] rounded-2xl border border-destructive/30 bg-white p-8">
          <p className="text-sm font-semibold text-destructive">Opportunity data unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!data || !selectedSummary) {
    return (
      <main className="pet-page-bg grid min-h-[70vh] place-items-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-foreground" />
          Loading opportunity analysis…
        </div>
      </main>
    );
  }

  const selectedStageItem = workflowStages[selectedStage];
  const perMtOpportunity = selectedSummary.supplierTlc - selectedSummary.marketTlc;
  const downloadUrl = createApiUrl("/opportunities/download").toString();

  return (
    <main className="pet-page-bg min-h-screen">
      <div className="mx-auto w-full max-w-[1380px] px-5 py-8 sm:px-8 sm:py-10">
        <section className="relative overflow-hidden rounded-2xl bg-[#111] text-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
          <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#F5E003]/25 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
                <Lightbulb className="h-3.5 w-3.5 text-[#F5E003]" />
                Opportunity intelligence · {data.metrics.period}
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                Turn TLC gaps into an actionable value pipeline.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                Prioritize the largest sourcing gaps, understand which cost component is driving them, and move each opportunity from validation to realized value.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F5E003]">Directional net opportunity</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {opportunityRange(data.metrics.opportunityLow, data.metrics.opportunityHigh)}
              </p>
              <p className="mt-3 text-xs leading-5 text-white/55">
                Range reflects the Brazil Amcor Suape versus Manaus scenario. It is a benchmark value pool, not committed savings.
              </p>
              <a
                href={downloadUrl}
                download="PET_Quantification_Breakdown_By_Destination.xlsx"
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#F5E003] px-4 text-xs font-bold text-black no-underline transition hover:-translate-y-0.5 hover:bg-[#E8D200]"
              >
                <Download className="h-4 w-4" />
                Download calculations
              </a>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Assessed volume", value: `${number(data.metrics.assessedVolume)} MT`, icon: Factory },
            { label: "Destinations assessed", value: String(data.metrics.destinationCount), icon: ShieldCheck },
            { label: "Positive opportunity", value: `${data.metrics.positiveDestinationCount} / ${data.metrics.destinationCount}`, icon: TrendingDown },
            { label: "Benchmark period", value: data.metrics.period, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-border bg-white p-5 shadow-[0_5px_24px_rgba(0,0,0,0.035)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F5E003]/70"><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-[-0.025em]">{value}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-white p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <p className="pet-section-kicker">Value realization workflow</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">From identified gap to captured value</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">Select a stage to see its decision objective. The workflow keeps benchmark opportunity separate from validated and realized savings.</p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {workflowStages.map((stage, index) => {
              const Icon = stage.icon;
              const active = selectedStage === index;
              return (
                <button
                  type="button"
                  key={stage.number}
                  onClick={() => setSelectedStage(index)}
                  className={`group relative min-h-[178px] rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-foreground bg-[#111] text-white shadow-lg"
                      : "border-border bg-[#F7F7F3] hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold tracking-[0.12em] ${active ? "text-[#F5E003]" : "text-muted-foreground"}`}>{stage.number}</span>
                    <Icon className={`h-4 w-4 ${active ? "text-[#F5E003]" : "text-muted-foreground"}`} />
                  </div>
                  <p className="mt-8 text-sm font-semibold leading-5">{stage.title}</p>
                  <p className={`mt-2 text-xs leading-5 ${active ? "text-white/60" : "text-muted-foreground"}`}>{stage.description}</p>
                  {index < workflowStages.length - 1 && (
                    <ArrowRight className="absolute -right-[11px] top-1/2 z-10 hidden h-5 w-5 rounded-full bg-white text-muted-foreground xl:block" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#E6D500] bg-[#FEFAC4]/55 px-4 py-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F5E003] text-xs font-bold">{selectedStageItem.number}</span>
            <div>
              <p className="text-sm font-semibold">{selectedStageItem.title}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{selectedStageItem.detail}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:p-7 lg:flex-row lg:items-end">
            <div>
              <p className="pet-section-kicker">Prioritized pipeline</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Opportunity by supplier and destination</h2>
            </div>
            <div className="inline-flex rounded-full border border-border bg-[#F7F7F3] p-1">
              {([
                ["all", "All"],
                ["savings", "Savings"],
                ["increase", "Cost increase"],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${statusFilter === value ? "bg-[#111] text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="pet-data-table w-full min-w-[1080px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left">Destination / supplier</th>
                  <th className="px-4 py-3 text-left">Alternative source</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Supplier TLC</th>
                  <th className="px-4 py-3 text-right">Market TLC</th>
                  <th className="px-4 py-3 text-right">Gap / MT</th>
                  <th className="px-5 py-3 text-right">Potential</th>
                  <th className="px-5 py-3 text-left">Primary driver</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummary.map((item) => {
                  const key = `${item.destination}|${item.supplierLocation}`;
                  const selected = key === selectedKey;
                  const isSaving = item.estimatedOpportunity > 0;
                  return (
                    <tr
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`cursor-pointer border-t border-border transition ${selected ? "bg-[#FEFAC4]/55" : "bg-white"}`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold">{item.destination}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.supplierLocation}</p>
                      </td>
                      <td className="px-4 py-4 font-medium">{item.alternativeSource}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{number(item.volume)} MT</td>
                      <td className="px-4 py-4 text-right tabular-nums">{currency(item.supplierTlc, 2)}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{currency(item.marketTlc, 2)}</td>
                      <td className={`px-4 py-4 text-right font-semibold tabular-nums ${isSaving ? "text-success" : "text-destructive"}`}>
                        {currency(item.supplierTlc - item.marketTlc, 2)}
                      </td>
                      <td className={`px-5 py-4 text-right font-semibold tabular-nums ${isSaving ? "text-success" : "text-destructive"}`}>
                        {compactCurrency(item.estimatedOpportunity)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-border bg-[#F7F7F3] px-2.5 py-1 text-xs font-semibold">{item.primaryCostDriver}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border bg-[#F7F7F3] px-5 py-3 text-xs text-muted-foreground sm:px-7">
            {data.metrics.brazilScenarioNote}
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <article className="rounded-2xl border border-border bg-white p-5 sm:p-7">
            <p className="pet-section-kicker">Selected opportunity</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.025em]">{selectedSummary.destination}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedSummary.supplierLocation} → {selectedSummary.alternativeSource} benchmark</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${selectedSummary.estimatedOpportunity > 0 ? "bg-success/10 text-[#147A3D]" : "bg-destructive/10 text-destructive"}`}>
                {selectedSummary.status}
              </span>
            </div>

            <div className="mt-6 rounded-2xl bg-[#111] p-5 text-white">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div>
                  <p className="text-xs text-white/50">Supplier TLC</p>
                  <p className="mt-1 text-xl font-semibold">{currency(selectedSummary.supplierTlc, 2)}</p>
                </div>
                <span className="text-white/35">−</span>
                <div className="text-right">
                  <p className="text-xs text-white/50">Market TLC</p>
                  <p className="mt-1 text-xl font-semibold">{currency(selectedSummary.marketTlc, 2)}</p>
                </div>
              </div>
              <div className="my-4 h-px bg-white/10" />
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-white/50">Gap × {number(selectedSummary.volume)} MT</p>
                  <p className="mt-1 text-lg font-semibold text-[#F5E003]">{currency(perMtOpportunity, 2)}/MT</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50">Directional potential</p>
                  <p className={`mt-1 text-2xl font-semibold ${selectedSummary.estimatedOpportunity > 0 ? "text-[#69D38A]" : "text-[#FF8B7C]"}`}>
                    {compactCurrency(selectedSummary.estimatedOpportunity)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Component contribution</p>
                <p className="text-xs text-muted-foreground">Supplier − Market × Volume</p>
              </div>
              <div className="mt-4 space-y-4">
                {componentRows.map((item) => {
                  const positive = item.savingsContribution >= 0;
                  const width = Math.max(3, (Math.abs(item.savingsContribution) / maxContribution) * 100);
                  return (
                    <div key={item.component}>
                      <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="font-medium">{item.component}</span>
                        <span className={`font-semibold tabular-nums ${positive ? "text-success" : "text-destructive"}`}>{compactCurrency(item.savingsContribution)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#ECEDE8]">
                        <div className={`h-full rounded-full ${positive ? "bg-success" : "bg-destructive"}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="border-b border-border p-5 sm:p-7">
              <p className="pet-section-kicker">Negotiation fact base</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Common-component breakdown</h2>
              <p className="mt-2 text-sm text-muted-foreground">Positive contribution indicates a supplier cost above the selected market benchmark.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="pet-data-table w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">Component</th>
                    <th className="px-4 py-3 text-right">Market / MT</th>
                    <th className="px-4 py-3 text-right">Supplier / MT</th>
                    <th className="px-4 py-3 text-right">Supplier − Market</th>
                    <th className="px-5 py-3 text-right">Value contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBreakdown.map((item) => {
                    const contribution = item.savingsContribution;
                    return (
                      <tr key={item.component} className={`border-t border-border ${isTotalComponent(item.component) ? "bg-[#F7F7F3] font-semibold" : "bg-white"}`}>
                        <td className="px-5 py-4">{item.component}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{currency(item.marketCost, 2)}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{currency(item.supplierCost, 2)}</td>
                        <td className={`px-4 py-4 text-right font-medium tabular-nums ${item.supplierCost - item.marketCost >= 0 ? "text-success" : "text-destructive"}`}>
                          {currency(item.supplierCost - item.marketCost, 2)}
                        </td>
                        <td className={`px-5 py-4 text-right font-semibold tabular-nums ${contribution >= 0 ? "text-success" : "text-destructive"}`}>
                          {currency(contribution, 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-[#F7F7F3] p-5 sm:px-7">
              <div className="flex items-start gap-3">
                <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">Recommended negotiation focus: {selectedSummary.primaryCostDriver}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedSummary.driverInterpretation}. Validate the benchmark and feasibility with GPO before treating the amount as a committed target.</p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:p-7">
          <div>
            <p className="text-sm font-semibold">How the opportunity is calculated</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Potential opportunity = (Current supplier TLC − selected alternative market TLC) × annual volume. The value remains directional until the benchmark, volume, product specification, taxes, freight and route feasibility are validated.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-[#F7F7F3] px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {data.metrics.period} benchmark
          </span>
        </section>
      </div>
    </main>
  );
};

export default OpportunityPage;
