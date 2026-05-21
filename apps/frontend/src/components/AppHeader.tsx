import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import TopRightNavigation from "./TopRightNavigation";
import abinbevLogo from "../assets/ABInbev.png";

const AppHeader: React.FC = () => {
  const [searchParams] = useSearchParams();

  return (
    <header className="pet-brand-bar sticky top-0 z-[900]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-8 max-sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="shrink-0 no-underline hover:opacity-90" aria-label="Back to landing page">
            <img src={abinbevLogo} alt="AB InBev" className="brand-logo" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="truncate text-[0.95rem] font-bold tracking-wide text-foreground">
                PET resin
              </span>
              <span className="pet-logo-badge shrink-0">Quotes</span>
            </div>
            <p className="truncate text-[0.78rem] font-medium text-muted-foreground max-sm:hidden">
              Supplier quotes vs market research
            </p>
          </div>
        </div>
        <TopRightNavigation search={searchParams.toString()} />
      </div>
    </header>
  );
};

export default AppHeader;
