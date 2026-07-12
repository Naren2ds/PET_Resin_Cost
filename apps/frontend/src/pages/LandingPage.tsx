import AppHeader from "../components/AppHeader";
import { ScrollProgressBar } from "../components/ScrollProgressBar";
import { cn } from "@/lib/utils";

const SHELL = "pet-app-surface p-6 sm:p-8";
const ANCHOR_TARGET = "scroll-mt-24";
const LATEST_MONTH_TARGET = "YTD June";

const latestMonthToneClass = (value: string) =>
  value.trim() === LATEST_MONTH_TARGET ? "text-success" : "text-warning";

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
                PET vPET Intelligence
                <span className="h-4 w-px bg-border" aria-hidden />
                <small className="text-[10px] font-normal tracking-[0.16em] text-foreground">
                  Market-driven / Monthly refresh
                </small>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              </div>
            </div>

            <div className="pet-portal-body">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
                <div>
                  <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl lg:text-5xl">
                    From supplier-led pricing to market-led sourcing decisions.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm text-foreground sm:text-base">
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
                    <a className="pet-button-secondary" href="#data-availability">
                      Data Availability
                    </a>
                  </div>
                </div>

                <div className="grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-2">
                  {[
                    { label: "Total PET Spend", value: "$356M", delta: "+0.6% YoY" },
                    { label: "Savings Opportunity", value: "$5.0M", delta: "annualized" },
                    { label: "No of Suppliers", value: "8", delta: "active suppliers" },
                    { label: "Market Research Countries", value: "10", delta: "covered" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-card p-5">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                        {kpi.label}
                      </p>
                      <p className="mt-2 text-3xl font-light tracking-[-0.03em] text-foreground">
                        {kpi.value}
                      </p>
                      <p className="mt-1 text-xs text-foreground">{kpi.delta}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* <div className="mt-8 grid gap-3 md:grid-cols-3">
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
              </div> */}
            </div>
          </section>

          <section id="solution" className={cn(SHELL, ANCHOR_TARGET)}>
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground sm:text-2xl">
              Platform Tabs at a glance
            </h2>
            <p className="mt-2 text-sm text-foreground sm:text-base">
              A quick summary of each tab and the decision support it provides.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                {
                  title: "Home",
                  desc: "Landing hub that summarizes scope, data status, and how to navigate the platform.",
                },
                {
                  title: "View TLCs",
                  desc: "Compare supplier TLC against market-implied TLC by destination, source, and supplier.",
                },
                {
                  title: "Supplier Analysis",
                  desc: "Deep dive into supplier breakdowns to identify component-level cost differences and negotiation points.",
                },
                {
                  title: "Trends",
                  desc: "Track monthly actuals and forecast trajectories for supplier and market benchmarks across 2026.",
                },
                {
                  title: "Simulation",
                  desc: "Run what-if percentage scenarios on supplier TLC and evaluate impact versus market outlook.",
                },
              ].map((card, index) => (
                <div key={card.title} className="pet-metric-card p-5">
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{card.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="flow" className={cn(SHELL, ANCHOR_TARGET)}>
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground sm:text-2xl">How it works</h2>
            <p className="mt-2 text-sm text-foreground sm:text-base">
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
                  <p className="text-xs leading-relaxed text-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-5">
            <section id="data-availability" className={cn(SHELL, ANCHOR_TARGET)}>
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Supplier Data Availability</h2>
              <p className="mt-2 text-sm text-foreground">
                Latest month of supplier data available in the frontend by destination and supplier.
              </p>
              <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
                <table className="pet-data-table w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-border px-3 py-2.5 text-left">Destination Country</th>
                      <th className="border-b border-border px-3 py-2.5 text-left">Supplier</th>
                      <th className="border-b border-border px-3 py-2.5 text-left">Latest Month Available</th>
                      <th className="border-b border-l-2 border-b-border border-l-primary/30 px-3 py-2.5 text-left">Destination Country</th>
                      <th className="border-b border-border px-3 py-2.5 text-left">Supplier</th>
                      <th className="border-b border-border px-3 py-2.5 text-left">Latest Month Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const data = [
                        ["Brazil", "Amcor, Cristalpet, Engepack, Valgroup", "YTD June"],
                        ["Ecuador", "Amcor", "YTD June"],
                        ["Panama", "Pastiglas", "YTD June"],
                        ["Colombia", "Amcor", "YTD June"],
                        ["Peru", "San Miguel Industrias (SMI)", "YTD June"],
                        ["Argentina", "Amcor", "YTD June"],
                        ["Dominican Republic", "SMI PET", "YTD June"],
                        ["Uruguay", "Cristalpet", "YTD June"],
                        ["El Salvador and Honduras", "Amcor", "YTD June"],
                        ["Bolivia","Gestora, Administradora e Industrializadora Preformas S.A.","YTD June"]
                      ];
                      const rows = [];
                      for (let i = 0; i < data.length; i += 2) {
                        const left = data[i];
                        const right = data[i + 1];
                        rows.push(
                          <tr key={i} className="border-b border-border/60">
                            <td className="px-3 py-2.5 text-foreground">{left[0]}</td>
                            <td className="px-3 py-2.5 text-foreground">{left[1]}</td>
                            <td className={cn("px-3 py-2.5 font-semibold", latestMonthToneClass(left[2]))}>
                              {left[2]}
                            </td>
                            {right ? (
                              <>
                                <td className="border-l border-l-border px-3 py-2.5 text-foreground">{right[0]}</td>
                                <td className="px-3 py-2.5 text-foreground">{right[1]}</td>
                                <td className={cn("px-3 py-2.5 font-semibold", latestMonthToneClass(right[2]))}>
                                  {right[2]}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="border-l border-l-border px-3 py-2.5" />
                                <td className="px-3 py-2.5" />
                                <td className="px-3 py-2.5" />
                              </>
                            )}
                          </tr>
                        );
                      }
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-foreground">
                Indexes used ICIS FOB China, IHS FOB China, ICIS Asia SE.
              </p>
            </section>

            <section className={cn(SHELL)}>
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Market Research Data Availability</h2>
              <p className="mt-2 text-sm text-foreground">
                Market research vPET data is currently available for <span className="font-semibold text-warning">Feb 2026</span> only.
              </p>
              <p className="mt-3 text-xs text-foreground">
                Indexes used: ICIS FOB Mexico, ICIS FOB China, ICIS FOB Asia SE, ICIS FOB India, ICIS FOB South Korea, ICIS FOB Taiwan.
              </p>
            </section>
          </div>


        </main>
      </div>
      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-8 py-2.5 max-sm:flex-col max-sm:items-start max-sm:px-5">
          <img src="/connect_one_color.svg" alt="AB InBev" className="h-8 w-auto" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Anheuser-Busch InBev. Internal use only.
          </p>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;
