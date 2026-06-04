import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import TopRightNavigation from "./TopRightNavigation";

const AppHeader: React.FC = () => {
  const [searchParams] = useSearchParams();

  return (
    <header className="pet-brand-bar sticky top-0 z-[900]">
      <div className="mx-auto max-w-[1480px] px-8 max-sm:px-5">
        <div className="pet-app-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="shrink-0 no-underline hover:opacity-90" aria-label="Back to landing page">
              <span className="truncate text-[1rem] font-bold tracking-[-0.01em] text-foreground">
                PET TLC Modelling
              </span>
            </Link>
          </div>
        </div>
        <TopRightNavigation search={searchParams.toString()} />
      </div>
    </header>
  );
};

export default AppHeader;
