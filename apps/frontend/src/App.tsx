import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DataLayout from "./layouts/DataLayout";
import AppShell from "./layouts/AppShell";

import "./index.css";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppShell><LandingPage /></AppShell>} />
      <Route path="/*" element={<DataLayout />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
