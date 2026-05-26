import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LEGACY_OVERVIEW_PATH, ROUTE_TABS, VIEW_TLCS_PATH } from "../lib/navigation";

type TopRightNavigationProps = {
  search: string;
};

const TopRightNavigation: React.FC<TopRightNavigationProps> = ({ search }) => {
  const location = useLocation();
  const activePath =
    location.pathname === LEGACY_OVERVIEW_PATH ? VIEW_TLCS_PATH : location.pathname;

  return (
    <div className="min-w-0">
      <nav
        aria-label="Universal navigation"
        className="pet-portal-tabs pet-app-tabs"
      >
        {ROUTE_TABS.map((item) => {
          const isActive = item.path === activePath;
          return (
            <Link
              key={item.path}
              to={{ pathname: item.path, search }}
              className={`pet-portal-tab ${isActive ? "active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default TopRightNavigation;
