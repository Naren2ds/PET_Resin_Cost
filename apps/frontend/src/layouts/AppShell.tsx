import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import TopRightNavigation from "../components/TopRightNavigation";
import { ScrollProgressBar } from "../components/ScrollProgressBar";

type AppShellProps = {
  children: ReactNode;
};

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [searchParams] = useSearchParams();

  return (
    <div className="buyers-shell">
      <ScrollProgressBar />
      <AppHeader />
      <div className="buyers-shell-body">
        <TopRightNavigation search={searchParams.toString()} />
        <main className="buyers-content" id="main-content">
          {children}
        </main>
      </div>
      <footer className="buyers-footer">
        <div className="buyers-footer-brands" aria-label="AB InBev One Supply Chain">
          <img src="/buyers/ABInBev.png" alt="AB InBev" />
          <span aria-hidden="true" />
          <img src="/buyers/logo_one_footer.svg" alt="One Supply Chain" />
        </div>
      </footer>
    </div>
  );
};

export default AppShell;
