import {
  ArrowRight,
  BarChart3,
  Calculator,
  CircleDollarSign,
  Database,
  Layers3,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

const workspaces = [
  {
    title: "Compare landed costs",
    description: "Benchmark supplier pricing against market-implied TLC by destination and source.",
    path: "/view-tlcs",
    icon: BarChart3,
  },
  {
    title: "Inspect cost drivers",
    description: "Review resin, freight, duties, taxes and other inputs behind each TLC.",
    path: "/supplier-analysis",
    icon: Layers3,
  },
  {
    title: "Follow the trend",
    description: "Track actual and forecast movement for supplier TLC and resin indices.",
    path: "/trends",
    icon: TrendingUp,
  },
  {
    title: "Test a scenario",
    description: "Model changes in cost components and compare them with the market outlook.",
    path: "/simulation",
    icon: Calculator,
  },
  {
    title: "Prioritize opportunity",
    description: "Quantify sourcing gaps and identify the components to validate or negotiate.",
    path: "/opportunity",
    icon: CircleDollarSign,
  },
];

const statusItems = [
  { label: "Supplier coverage", value: "10", detail: "Destination groups" },
  { label: "Market research", value: "95", detail: "Source-destination routes" },
  { label: "Latest actuals", value: "Oct 2026", detail: "Monthly refresh" },
  { label: "PET spend in scope", value: "$356M", detail: "Annual reference" },
];

const LandingPage: React.FC = () => (
  <div className="pet-page-bg min-h-full">
    <div className="mx-auto w-full max-w-[1480px] space-y-6 p-6 sm:p-10">
      <section className="grid gap-8 rounded-lg border border-border bg-white p-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:p-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-[#F7F7F7] px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            Data refreshed through October 2026
          </div>
          <p className="mt-6 text-sm font-semibold text-muted-foreground">PET PROCUREMENT INTELLIGENCE</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Make sourcing decisions with a clear view of total landed cost.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-6 text-muted-foreground">
            Compare supplier pricing with independent market benchmarks, understand the cost gap and prepare a fact-based negotiation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/view-tlcs" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0E0E0E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#292929]">
              Open TLC comparison
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/opportunity" className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[#F7F7F7]">
              View opportunity
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-[#F7F7F7] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Current data scope</p>
              <p className="mt-1 text-sm text-muted-foreground">Supplier and market TLC intelligence</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFC629]">
              <Database className="h-5 w-5" />
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border bg-white p-4">
              <dt className="text-xs text-muted-foreground">Active suppliers</dt>
              <dd className="mt-1 text-2xl font-semibold">8</dd>
            </div>
            <div className="rounded-md border border-border bg-white p-4">
              <dt className="text-xs text-muted-foreground">Market sources</dt>
              <dd className="mt-1 text-2xl font-semibold">10</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="status-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="pet-section-kicker">Platform snapshot</p>
            <h2 id="status-heading" className="mt-1 text-2xl font-semibold">Coverage at a glance</h2>
          </div>
          <p className="text-sm text-muted-foreground">Monthly supplier refresh · Quarterly market freight refresh</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statusItems.map((item) => (
            <article key={item.label} className="rounded-lg border border-border bg-white p-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-[28px] font-semibold leading-tight">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="workspace-heading" className="rounded-lg border border-border bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="pet-section-kicker">Workspaces</p>
            <h2 id="workspace-heading" className="mt-1 text-2xl font-semibold">Start with a business question</h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">Choose the view that matches the sourcing decision you need to make.</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {workspaces.map(({ title, description, path, icon: Icon }) => (
            <Link key={title} to={path} className="group flex min-h-[210px] flex-col rounded-lg border border-border bg-white p-5 text-foreground no-underline transition-[border-color,background-color] duration-150 hover:border-[#BFBFBF] hover:bg-[#F7F7F7]">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF2C7]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
              <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold">
                Open
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Resin index coverage">
        <article className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-semibold">Supplier resin indices</p>
          <p className="mt-1 text-sm text-muted-foreground">Applied according to each supplier formula and destination lag.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["ICIS FOB China", "IHS PET China Mid", "ICIS Asia SE Low"].map((item) => (
              <span key={item} className="rounded-md border border-border bg-[#F7F7F7] px-3 py-1.5 text-xs font-medium">{item}</span>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-border bg-white p-6">
          <p className="text-sm font-semibold">Market research resin indices</p>
          <p className="mt-1 text-sm text-muted-foreground">Broader source-country benchmarks used for route comparison.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["China", "Mexico", "Asia SE", "India", "South Korea", "Taiwan", "Global ICIS"].map((item) => (
              <span key={item} className="rounded-md border border-border bg-[#F7F7F7] px-3 py-1.5 text-xs font-medium">{item}</span>
            ))}
          </div>
        </article>
      </section>
    </div>
  </div>
);

export default LandingPage;
