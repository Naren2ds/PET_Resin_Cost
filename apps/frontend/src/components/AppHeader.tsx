import React from "react";
import { Link } from "react-router-dom";

const AppHeader: React.FC = () => (
  <header className="buyers-header">
    <Link to="/" className="buyers-header-brand" aria-label="PET Intelligence home">
      <img src="/buyers/connect_one_color.svg" alt="One Connect" />
      <span className="buyers-header-divider" aria-hidden="true" />
      <span className="buyers-header-product">Buyers</span>
      <span className="buyers-header-divider buyers-header-app-divider" aria-hidden="true" />
      <span className="buyers-header-app">PET Intelligence</span>
    </Link>
    <span className="buyers-header-context">Procurement analytics</span>
  </header>
);

export default AppHeader;
