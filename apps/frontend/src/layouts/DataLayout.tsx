import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import HomePage from "../pages/HomePage";
import CurrentLayoutPage from "../pages/CurrentLayoutPage";
import TrendsPage from "../pages/TrendsPage";
import CostComponentsPage from "../pages/CostComponentsPage";
import SimulationPage from "../pages/SimulationPage";
import OpportunityPage from "../pages/OpportunityPage";
import { createApiUrl } from "../lib/api";
import { LEGACY_OVERVIEW_PATH, VIEW_TLCS_PATH } from "../lib/navigation";
import AppShell from "./AppShell";

const DataLayout: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const requiresCountryData = location.pathname !== "/opportunity";

  useEffect(() => {
    if (!requiresCountryData) return;
    const paramsString = searchParams.toString();
    const url = createApiUrl("/countries");
    if (paramsString) {
      const nextParams = new URLSearchParams(paramsString);
      nextParams.forEach((value, key) => url.searchParams.set(key, value));
    }

    url.searchParams.set("includeVendorBreakdowns", "true");

    fetch(url.toString())
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload));
  }, [requiresCountryData, searchParams.toString()]);

  if (requiresCountryData && !data) {
    return (
      <AppShell>
        <div className="buyers-loading-state" role="status" aria-live="polite">
          <div className="buyers-spinner" aria-hidden="true" />
          <p>Loading PET resin cost data…</p>
        </div>
      </AppShell>
    );
  }

  const countryData = data as ApiResponse;
  const routeSearch = searchParams.toString();
  const viewTlcsRoute = {
    pathname: VIEW_TLCS_PATH,
    search: routeSearch ? `?${routeSearch}` : "",
  };

  return (
    <AppShell>
      <Routes>
        <Route path={VIEW_TLCS_PATH} element={<HomePage data={countryData} />} />
        <Route
          path={LEGACY_OVERVIEW_PATH}
          element={<Navigate to={viewTlcsRoute} replace />}
        />
        <Route path="/supplier-analysis" element={<CurrentLayoutPage data={countryData} />} />
        <Route path="/trends" element={<TrendsPage data={countryData} />} />
        <Route path="/cost-components" element={<CostComponentsPage data={countryData} />} />
        <Route path="/simulation" element={<SimulationPage data={countryData} />} />
        <Route path="/opportunity" element={<OpportunityPage />} />
        <Route path="*" element={<Navigate to={viewTlcsRoute} replace />} />
      </Routes>
    </AppShell>
  );
};

export default DataLayout;
