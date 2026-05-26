import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { ScrollProgressBar } from "../components/ScrollProgressBar";
import { cn } from "@/lib/utils";
import { ROUTE_TABS, VIEW_TLCS_PATH } from "../lib/navigation";

const SHELL = "pet-app-surface p-6 sm:p-8";

const LandingPage: React.FC = () => {
  return (
    <>
      <ScrollProgressBar />
      <AppHeader />
      <div className="pet-page-bg min-h-screen">
        <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 p-7 max-sm:p-4">
          <section id="top" className="pet-portal">
            <div className="pet-portal-topbar max-md:flex-col max-md:items-start">
              <div className="pet-portal-brand">
                <span className="pet-portal-brand-mark" aria-hidden />
                PET Resin Sourcing Intelligence
                <span className="h-4 w-px bg-border" aria-hidden />
                <small className="text-[10px] font-normal tracking-[0.16em] text-muted-foreground">
                  Market-driven / Monthly refresh
                </small>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link className="pet-button-secondary" to="/trends">
                  Trends
                </Link>
                <Link className="pet-button-primary" to={VIEW_TLCS_PATH}>
                  View TLCs
                </Link>
              </div>
            </div>

            <nav className="pet-portal-tabs" aria-label="Landing navigation">
              {ROUTE_TABS.map((item, index) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`pet-portal-tab ${index === 0 ? "active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="pet-portal-body">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
                <div>
                  <p className="pet-section-kicker">
                    PET Resin Sourcing Intelligence / Market-driven / Monthly refresh
                  </p>
                  <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl lg:text-5xl">
                    From supplier-led pricing to market-led sourcing decisions.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm text-muted-foreground sm:text-base">
                    A transparent procurement cockpit that digitizes the Total Landed Cost model,
                    reconciles supplier prices against market-implied cost, and equips the business to
                    negotiate, challenge, and plan sourcing with confidence.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a className="pet-button-secondary" href="#solution">
                      Explore the solution
                    </a>
                    <a className="pet-button-secondary" href="#flow">
                      See how it works
                    </a>
                    <Link className="pet-button-primary" to={VIEW_TLCS_PATH}>
                      View TLCs
                    </Link>
                  </div>
                </div>

                <div className="grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-2">
                  {[
                    { label: "Total PET Spend", value: "$312M", delta: "+4.1% YoY" },
                    { label: "Market TLC Gap", value: "-$18.4/MT", delta: "vs supplier price" },
                    { label: "Savings Opportunity", value: "$6.8M", delta: "annualized" },
                    { label: "Watchlist Suppliers", value: "7", delta: "above market" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-card p-5">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {kpi.label}
                      </p>
                      <p className="mt-2 text-3xl font-light tracking-[-0.03em] text-foreground">
                        {kpi.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{kpi.delta}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
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
                  <div key={item.step} className="pet-metric-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-foreground bg-foreground font-mono text-xs font-bold text-primary-foreground">
                        {item.step}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="solution" className={cn(SHELL)}>
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground sm:text-2xl">
              What the platform delivers
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              The goal is not just to visualize prices. It is to create a trusted decision layer for
              monthly visibility, negotiation leverage, and annual sourcing strategy support.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Monthly market visibility",
                  desc: "Track how resin, freight, and taxes move over time and see their direct effect on Total Landed Cost.",
                },
                {
                  title: "Supplier challenge & negotiation",
                  desc: "Compare supplier quotes to market-implied landed cost and isolate where the gaps create leverage.",
                },
                {
                  title: "Strategic sourcing support",
                  desc: "Run controlled scenarios to support annual sourcing decisions without forcing monthly supplier switching.",
                },
              ].map((card, index) => (
                <div key={card.title} className="pet-metric-card p-5">
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="flow" className={cn(SHELL)}>
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground sm:text-2xl">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              A simple flow from raw inputs to business action.
            </p>
            <div className="mt-6 grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
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
                <div key={step.n} className={cn("min-h-[128px] bg-card p-4", step.active ? "shadow-[inset_0_3px_0_var(--ci-accent)]" : "")}>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded font-mono text-sm font-bold",
                        step.active
                          ? "bg-foreground text-primary-foreground"
                          : "border border-border bg-secondary text-foreground",
                      )}
                    >
                      {step.n}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={cn(SHELL)}>
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Market and supplier view</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A clean comparison layer to see where the market sits versus supplier pricing.
              </p>
              <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
                <table className="pet-data-table w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-border px-3 py-2.5 text-left">Lane</th>
                      <th className="border-b border-border px-3 py-2.5 text-left">FOB</th>
                      <th className="border-b border-border px-3 py-2.5 text-left">Freight</th>
                      <th className="border-b border-border px-3 py-2.5 text-left">TLC delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Brazil", "$1,218", "$62", "-$62"],
                      ["Argentina", "$1,117", "$64", "+$196"],
                      ["Colombia", "$815", "$47", "-$139"],
                      ["Peru", "$875", "$49", "-$149"],
                    ].map(([lane, fob, freight, delta]) => (
                      <tr key={lane} className="border-b border-border/60">
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

            <section className={cn(SHELL)}>
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Alerts &amp; recommendations</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A quick view of what needs attention right now.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="border-l-4 border-primary bg-secondary p-4">
                  <p className="text-sm font-semibold text-foreground">3 suppliers above market</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated negotiation upside: $2.3M
                  </p>
                </div>
                <div className="border-l-4 border-success bg-secondary p-4">
                  <p className="text-sm font-semibold text-success">Brazil route most protected</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Duty and tax stack materially impacts landed cost.
                  </p>
                </div>
                <div className="border-l-4 border-border bg-secondary p-4">
                  <p className="text-sm font-semibold text-foreground">Annual strategy ready</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Run scenario comparisons before sourcing review or RFQ.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className={cn(SHELL)}>
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Business impact</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              The platform is built to improve control, transparency and decision quality across PET
              resin sourcing.
            </p>
            <div className="mt-6 grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {[
                "Trusted market reference",
                "Negotiation leverage",
                "Scenario-backed sourcing",
                "Monthly monitoring",
              ].map((label, i) => (
                <div key={label} className="bg-card p-5 text-center">
                  <p className="font-mono text-3xl font-light tracking-[-0.03em] text-foreground">{i + 1}</p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={cn(SHELL, "flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center")}>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl">
                Bring transparency into PET resin sourcing.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                A market-anchored landing page for a market-anchored procurement capability &mdash;
                designed to support Joao&apos;s monthly monitoring, negotiation, and annual sourcing
                decisions.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Market visibility", "TLC engine", "Reconciliation", "Scenario analytics"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="pet-button-secondary" href="#top">
                View above the fold
              </a>
              <Link className="pet-button-primary" to={VIEW_TLCS_PATH}>
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
