import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ABITab, ABITabPanel, ABITabs, Orientation } from "@ab-inbev-labs/ux-react-components";
import { LEGACY_OVERVIEW_PATH, ROUTE_TABS, VIEW_TLCS_PATH } from "../lib/navigation";

type TopRightNavigationProps = {
  search: string;
};

const TopRightNavigation: React.FC<TopRightNavigationProps> = ({ search }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const activePath =
    location.pathname === LEGACY_OVERVIEW_PATH ? VIEW_TLCS_PATH : location.pathname;
  const activeIndex = Math.max(
    ROUTE_TABS.findIndex((item) => item.path === activePath),
    0
  );

  return (
    <div className="min-w-0">
      <div aria-label="Universal navigation" className="pet-portal-tabs pet-app-tabs">
        <ABITabs orientation={Orientation.Horizontal} defaultTab={activeIndex}>
        {ROUTE_TABS.flatMap((item) => [
          <ABITab
            key={`tab-${item.path}`}
            label={item.label}
            onChange={() => navigate({ pathname: item.path, search })}
          />,
          <ABITabPanel key={`panel-${item.path}`}>
            <div className="hidden">{item.path === activePath ? item.label : ""}</div>
          </ABITabPanel>,
        ])}
        </ABITabs>
      </div>
    </div>
  );
};

export default TopRightNavigation;
