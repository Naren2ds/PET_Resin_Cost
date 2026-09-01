import { ArrowRight, BarChart3, Calculator, Database, Layers3, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { ScrollProgressBar } from "../components/ScrollProgressBar";

const navigationCards = [
  {
    title: "Compare landed costs",
    description: "Benchmark supplier pricing against market-implied TLC by destination and source country.",
    path: "/view-tlcs",
    icon: BarChart3,
    accent: "bg-[#F5E003]",
  },
  {
    title: "Inspect cost drivers",
    description: "Understand the resin, freight, duties, taxes and other inputs behind each TLC.",
    path: "/supplier-analysis",
    icon: Layers3,
    accent: "bg-[#DDECF7]",
  },
  {
    title: "Follow the trend",
    description: "Review actual and forecast movements for supplier TLC and resin indices.",
    path: "/trends",
    icon: TrendingUp,
    accent: "bg-[#DFF3E7]",
  },
  {
    title: "Test a scenario",
    description: "Model percentage changes and see their impact against the market outlook.",
    path: "/simulation",
    icon: Calculator,
    accent: "bg-[#F3E6FA]",
  },
];

const statusItems = [
  { label: "Supplier coverage", value: "10 destinations", detail: "8 active suppliers" },
  { label: "Market research", value: "10 destinations", detail: "Multiple sourcing markets" },
  { label: "Latest actuals", value: "August 2026", detail: "Monthly refresh" },
];

const LandingPage: React.FC = () => {
  return (
    <>
      <ScrollProgressBar />
      <AppHeader />
      <div className="pet-page-bg min-h-screen">
        <main className="mx-auto w-full max-w-[1380px] px-5 py-8 sm:px-8 sm:py-12">
          <section className="relative overflow-hidden rounded-2xl border border-border bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#F5E003]/20 blur-3xl" aria-hidden />
            <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#DDECF7]/55 blur-3xl" aria-hidden />

            <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:items-end lg:px-14 lg:py-16">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-[#F7F7F3] px-3 py-1.5 text-xs font-semibold text-foreground">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  PET procurement intelligence
                </div>
                <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-[4rem]">
                  Make every PET sourcing decision with a clearer view of cost.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Compare supplier pricing with market benchmarks, understand the gap, and plan the next negotiation from one trusted view.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link to="/view-tlcs" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-[#F5E003] transition hover:-translate-y-0.5 hover:bg-[#252525]">
                    Open the platform
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/trends" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-white px-6 text-sm font-semibold text-foreground transition hover:border-foreground hover:bg-[#F7F7F3]">
                    View latest trends
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Platform snapshot</p>
                    <p className="mt-1 text-sm font-medium text-foreground">Current procurement scope</p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F5E003]">
                    <Database className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#F5F6F7] p-4">
                    <p className="text-2xl font-semibold tracking-tight">$356M</p>
                    <p className="mt-1 text-xs text-muted-foreground">PET spend in scope</p>
                  </div>
                  <div className="rounded-xl bg-[#F5F6F7] p-4">
                    <p className="text-2xl font-semibold tracking-tight">8</p>
                    <p className="mt-1 text-xs text-muted-foreground">Active suppliers</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5 text-xs text-foreground">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Actuals available through August 2026
                </div>
              </div>
            </div>
          </section>

          <section className="py-12 sm:py-16">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Start with a decision</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">What would you like to understand?</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Choose a workspace based on the question you are answering.</p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {navigationCards.map(({ title, description, path, icon: Icon, accent }) => (
                <Link key={title} to={path} className="group flex min-h-[240px] flex-col rounded-2xl border border-border bg-white p-6 shadow-[0_5px_24px_rgba(0,0,0,0.035)] transition duration-300 hover:-translate-y-1 hover:border-foreground/30 hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-8 text-lg font-semibold tracking-[-0.015em]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-foreground">
                    Explore
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="grid lg:grid-cols-[0.8fr_2.2fr]">
              <div className="border-b border-border bg-[#111] p-7 text-white lg:border-b-0 lg:border-r">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F5E003]">Data status</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">Ready for the latest review.</h2>
                <p className="mt-3 text-sm leading-6 text-white/65">Supplier and market datasets are aligned to support monthly TLC comparison and forecasting.</p>
              </div>
              <div className="grid sm:grid-cols-3">
                {statusItems.map((item, index) => (
                  <div key={item.label} className={`p-6 sm:p-7 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                    <p className="mt-3 text-xl font-semibold tracking-tight">{item.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="mt-5 rounded-2xl border border-border bg-white p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resin index coverage</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Benchmarks used in the model</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Supplier formulas use the contracted index basis, while Market Research compares a broader set of sourcing benchmarks.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-[#F7F7F3] p-5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#F5E003] ring-4 ring-[#F5E003]/20" />
                    <h3 className="text-sm font-semibold">Supplier indices</h3>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["ICIS FOB China", "IHS PET China Mid", "ICIS Asia SE Low"].map((index) => (
                      <span key={index} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground">{index}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-[#F7F7F3] p-5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#00A3E0] ring-4 ring-[#00A3E0]/15" />
                    <h3 className="text-sm font-semibold">Market Research indices</h3>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["ICIS FOB China", "ICIS FOB Mexico", "ICIS Asia SE", "ICIS FOB India", "ICIS FOB South Korea", "ICIS FOB Taiwan"].map((index) => (
                      <span key={index} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground">{index}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>        </main>
      </div>
      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-8 py-3 max-sm:flex-col max-sm:items-start max-sm:px-5">
          <img src="/connect_one_color.svg" alt="AB InBev" className="h-8 w-auto" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Anheuser-Busch InBev. Internal use only.</p>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;
