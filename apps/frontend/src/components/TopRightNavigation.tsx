import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CircleDollarSign,
  Home,
  Layers3,
  LineChart,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import { LEGACY_OVERVIEW_PATH, ROUTE_TABS, VIEW_TLCS_PATH } from "../lib/navigation";

type TopRightNavigationProps = {
  search: string;
};

const icons = {
  "/": Home,
  [VIEW_TLCS_PATH]: TableProperties,
  "/supplier-analysis": Layers3,
  "/trends": LineChart,
  "/simulation": SlidersHorizontal,
  "/opportunity": CircleDollarSign,
};

const TopRightNavigation: React.FC<TopRightNavigationProps> = ({ search }) => {
  const location = useLocation();
  const activePath =
    location.pathname === LEGACY_OVERVIEW_PATH ? VIEW_TLCS_PATH : location.pathname;

  return (
    <nav aria-label="PET Intelligence navigation" className="buyers-app-nav">
      {ROUTE_TABS.map((item) => {
        const isActive = item.path === activePath;
        const Icon = icons[item.path as keyof typeof icons] ?? Layers3;
        return (
          <Link
            key={item.path}
            to={{ pathname: item.path, search }}
            className={`buyers-app-nav-item ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            title={item.label}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default TopRightNavigation;
