import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { ScrollProgressBar } from "../components/ScrollProgressBar";
import { cn } from "@/lib/utils";

const SHELL =
  "rounded-[14px] border border-border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-primary/50";

const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline transition hover:opacity-90";

const btnSecondary =
  "inline-flex items-center justify-center rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground no-underline transition hover:border-primary/40 hover:bg-secondary/80";

const LandingPage: React.FC = () => {
  return (
    <>
      <ScrollProgressBar />
      <AppHeader />
      <div className="min-h-screen bg-gradient-to-b from-background to-card">
        <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-7 max-sm:p-4">
          <section
            id="top"
            className={cn(SHELL, "relative overflow-hidden border-2 border-border/80 p-6 sm:p-8")}
          >
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-2xl"
              aria-hidden
            />
            <p className="pet-section-kicker relative z-[1]">
              PET Resin Sourcing Intelligence • Market-driven • Monthly refresh
            </p>
            <h1 className="relative z-[1] mt-3 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              <span className="pet-gradient-heading bg-clip-text text-transparent">
                From supplier-led pricing to market-led sourcing decisions.
              </span>
            </h1>
            <p className="relative z-[1] mt-4 max-w-3xl text-sm text-muted-foreground sm:text-base">
              A transparent procurement cockpit that digitizes the Total Landed Cost model,
              reconciles supplier prices against market-implied cost, and equips the business to
              negotiate, challenge, and plan sourcing with confidence.
            </p>

            <div className="relative z-[1] mt-6 flex flex-wrap gap-3">
              <a className={btnPrimary} href="#solution">
                Explore the solution
              </a>
              <a className={btnSecondary} href="#flow">
                See how it works
              </a>
              <Link className={btnPrimary} to="/overview">
                View TLCs
              </Link>
            </div>

            <div className="relative z-[1] mt-8 grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Total PET Spend", value: "$312M", delta: "+4.1% YoY" },
                  { label: "Market TLC Gap", value: "-$18.4/MT", delta: "vs supplier price" },
                  { label: "Savings Opportunity", value: "$6.8M", delta: "annualized" },
                  { label: "Watchlist Suppliers", value: "7", delta: "above market" },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-border bg-secondary/60 p-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {kpi.label}
                    </p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{kpi.delta}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-3">
                {[
                  {
                    step: "1",
                    title: "Market inputs",
                    desc: "Resin indices, freight benchmarks, tariffs, duties",
                  },
                  {
                    step: "2",
                    title: "TLC engine",
                    desc: "Apply Deloitte formula logic and calculate landed cost",
                  },
                  {
                    step: "3",
                    title: "Reconciliation",
                    desc: "Compare supplier price against market-implied cost",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="flex gap-3 rounded-lg border border-border/80 bg-card/80 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                      {item.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="solution" className={cn(SHELL, "border-2 border-border/80 p-6 sm:p-8")}>
            <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">
              What the platform delivers
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              The goal is not just to visualize prices. It is to create a trusted decision layer for
              monthly visibility, negotiation leverage, and annual sourcing strategy support.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: "📈",
                  title: "Monthly market visibility",
                  desc: "Track how resin, freight, and taxes move over time and see their direct effect on Total Landed Cost.",
                },
                {
                  icon: "⚖️",
                  title: "Supplier challenge & negotiation",
                  desc: "Compare supplier quotes to market-implied landed cost and isolate where the gaps create leverage.",
                },
                {
                  icon: "🎯",
                  title: "Strategic sourcing support",
                  desc: "Run controlled scenarios to support annual sourcing decisions without forcing monthly supplier switching.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-border bg-secondary/30 p-5 transition hover:border-primary/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-lg">
                    {card.icon}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{card.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="flow" className={cn(SHELL, "border-2 border-border/80 p-6 sm:p-8")}>
            <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              A simple flow from raw inputs to business action.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { n: "1", title: "Ingest market data", desc: "Resin indices, freight, tariffs and duties", active: false },
                {
                  n: "2",
                  title: "Compute TLC",
                  desc: "Use the Deloitte-based formula engine to calculate landed cost by route",
                  active: true,
                },
                { n: "3", title: "Process supplier sheets", desc: "Standardize inputs and extract supplier landed cost", active: false },
                { n: "4", title: "Reconcile the gap", desc: "Show supplier price vs market cost and highlight variances", active: false },
                { n: "5", title: "Support action", desc: "Generate scenario, negotiation and sourcing strategy views", active: false },
              ].map((step) => (
                <div
                  key={step.n}
                  className={cn(
                    "rounded-xl border p-4 min-h-[120px]",
                    step.active
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-secondary/30",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold",
                        step.active
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-foreground",
                      )}
                    >
                      {step.n}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={cn(SHELL, "border-2 border-border/80 p-6 sm:p-8")}>
              <h2 className="text-xl font-extrabold text-foreground">Market and supplier view</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A clean comparison layer to see where the market sits versus supplier pricing.
              </p>
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="pet-data-table w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-secondary/80">
                      <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Lane
                      </th>
                      <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        FOB
                      </th>
                      <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Freight
                      </th>
                      <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        TLC delta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Brazil", "$1,218", "$62", "-$62"],
                      ["Argentina", "$1,117", "$64", "+$196"],
                      ["Colombia", "$815", "$47", "-$139"],
                      ["Peru", "$875", "$49", "-$149"],
                    ].map(([lane, fob, freight, delta]) => (
                      <tr key={lane} className="border-b border-border/60 hover:bg-secondary/25">
                        <td className="px-3 py-2.5 text-foreground">{lane}</td>
                        <td className="px-3 py-2.5 text-foreground">{fob}</td>
                        <td className="px-3 py-2.5 text-foreground">{freight}</td>
                        <td className="px-3 py-2.5 font-semibold text-foreground">{delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Example only. The idea is to make the market visible every month, not rely on
                supplier-provided numbers.
              </p>
            </section>

            <section className={cn(SHELL, "border-2 border-border/80 p-6 sm:p-8")}>
              <h2 className="text-xl font-extrabold text-foreground">Alerts &amp; recommendations</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A quick view of what needs attention right now.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-xl border border-primary/40 bg-[rgba(230,168,23,0.1)] p-4">
                  <p className="text-sm font-semibold text-primary">3 suppliers above market</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated negotiation upside: $2.3M
                  </p>
                </div>
                <div className="rounded-xl border border-success/40 bg-success/10 p-4">
                  <p className="text-sm font-semibold text-success">Brazil route most protected</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Duty and tax stack materially impacts landed cost.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/50 p-4">
                  <p className="text-sm font-semibold text-foreground">Annual strategy ready</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Run scenario comparisons before sourcing review or RFQ.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className={cn(SHELL, "border-2 border-border/80 p-6 sm:p-8")}>
            <h2 className="text-xl font-extrabold text-foreground">Business impact</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              The platform is built to improve control, transparency and decision quality across PET
              resin sourcing.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "Trusted market reference",
                "Negotiation leverage",
                "Scenario-backed sourcing",
                "Monthly monitoring",
              ].map((label, i) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-secondary/30 p-4 text-center"
                >
                  <p className="text-3xl font-extrabold text-primary">{i + 1}</p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            className={cn(
              SHELL,
              "flex flex-col items-start justify-between gap-6 border-2 border-primary/30 bg-gradient-to-br from-card to-secondary/40 p-6 sm:flex-row sm:items-center sm:p-8",
            )}
          >
            <div>
              <h2 className="text-xl font-extrabold sm:text-2xl">
                <span className="pet-gradient-heading bg-clip-text text-transparent">
                  Bring transparency into PET resin sourcing.
                </span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                A market-anchored landing page for a market-anchored procurement capability —
                designed to support Joao&apos;s monthly monitoring, negotiation, and annual sourcing
                decisions.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Market visibility", "TLC engine", "Reconciliation", "Scenario analytics"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className={btnSecondary} href="#top">
                View above the fold
              </a>
              <Link className={btnPrimary} to="/overview">
                View TLCs
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default LandingPage;
