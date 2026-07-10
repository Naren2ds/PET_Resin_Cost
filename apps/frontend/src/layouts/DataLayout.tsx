import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import HomePage from "../pages/HomePage";
import CurrentLayoutPage from "../pages/CurrentLayoutPage";
import TrendsPage from "../pages/TrendsPage";
import CostComponentsPage from "../pages/CostComponentsPage";
import SimulationPage from "../pages/SimulationPage";
import AppHeader from "../components/AppHeader";
import { ScrollProgressBar } from "../components/ScrollProgressBar";
import { createApiUrl } from "../lib/api";
import { LEGACY_OVERVIEW_PATH, VIEW_TLCS_PATH } from "../lib/navigation";

const DataLayout: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const paramsString = searchParams.toString();
    const url = createApiUrl("/countries");
    if (paramsString) {
      const nextParams = new URLSearchParams(paramsString);
      nextParams.forEach((value, key) => url.searchParams.set(key, value));
    }

    url.searchParams.set("includeVendorBreakdowns", "true");

    fetch(url.toString())
      .then((res) => res.json())
      .then((payload: ApiResponse) => {
        setData(payload);
      });
  }, [searchParams.toString()]);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-background">
        <ScrollProgressBar />
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin-slow" />
        <p className="text-muted-foreground text-sm animate-pulse">
          Loading PET resin cost data…
        </p>
      </div>
    );
  }

  const routeSearch = searchParams.toString();
  const viewTlcsRoute = {
    pathname: VIEW_TLCS_PATH,
    search: routeSearch ? `?${routeSearch}` : "",
  };

  return (
    <>
      <ScrollProgressBar />
      <AppHeader />
      <Routes>
        <Route path={VIEW_TLCS_PATH} element={<HomePage data={data} />} />
        <Route
          path={LEGACY_OVERVIEW_PATH}
          element={<Navigate to={viewTlcsRoute} replace />}
        />
        <Route path="/supplier-analysis" element={<CurrentLayoutPage data={data} />} />
        <Route path="/trends" element={<TrendsPage data={data} />} />
        <Route path="/cost-components" element={<CostComponentsPage data={data} />} />
        <Route path="/simulation" element={<SimulationPage data={data} />} />
        <Route path="*" element={<Navigate to={viewTlcsRoute} replace />} />
      </Routes>
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

export default DataLayout;
