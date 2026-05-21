import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import type { ApiResponse } from "../types";
import HomePage from "../pages/HomePage";
import CurrentLayoutPage from "../pages/CurrentLayoutPage";
import TrendsPage from "../pages/TrendsPage";
import Trends2Page from "../pages/Trends2Page";
import SimulationPage from "../pages/SimulationPage";
import AppHeader from "../components/AppHeader";
import { ScrollProgressBar } from "../components/ScrollProgressBar";

const DataLayout: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const paramsString = searchParams.toString();
    const url = new URL(
      "http://127.0.0.1:8000/countries" + (paramsString ? `?${paramsString}` : ""),
    );

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

  return (
    <>
      <ScrollProgressBar />
      <AppHeader />
      <Routes>
        <Route path="/overview" element={<HomePage data={data} />} />
        <Route path="/deep-dive" element={<CurrentLayoutPage data={data} />} />
        <Route path="/trends" element={<TrendsPage data={data} />} />
        <Route path="/trends-2" element={<Trends2Page data={data} />} />
        <Route path="/simulation" element={<SimulationPage data={data} />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </>
  );
};

export default DataLayout;
