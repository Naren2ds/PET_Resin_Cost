import React from "react";
import { Link, useLocation } from "react-router-dom";

type TopRightNavigationProps = {
  search: string;
};

const ITEMS = [
  { label: "View TLCs", path: "/overview" },
  { label: "Deep Dive", path: "/deep-dive" },
  { label: "Trends", path: "/trends" },
  { label: "Trends 2", path: "/trends-2" },
  { label: "Simulation", path: "/simulation" },
];

const TopRightNavigation: React.FC<TopRightNavigationProps> = ({ search }) => {
  const location = useLocation();
  const activePath = location.pathname;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <nav
        aria-label="Universal navigation"
        className="flex flex-wrap items-center gap-6 text-[0.85rem] text-muted-foreground"
      >
        {ITEMS.map((item, index) => {
          const isActive = item.path === activePath;
          return (
            <React.Fragment key={item.path}>
              <Link
                to={{ pathname: item.path, search }}
                className={
                  isActive
                    ? "font-semibold text-foreground no-underline"
                    : "transition-colors duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-foreground no-underline hover:no-underline"
                }
              >
                {item.label}
              </Link>
              {index < ITEMS.length - 1 ? (
                <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden>
                  /
                </span>
              ) : null}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};

export default TopRightNavigation;
