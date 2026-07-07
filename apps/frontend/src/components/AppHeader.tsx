import React from "react";
import { useSearchParams } from "react-router-dom";
import { ABIAppBar, LightOrDark } from "@ab-inbev-labs/ux-react-components";
import TopRightNavigation from "./TopRightNavigation";

const AppHeader: React.FC = () => {
  const [searchParams] = useSearchParams();

  return (
    <ABIAppBar
      theme={LightOrDark.Light}
      appTitle="PET TLC Modelling"
      className="pet-brand-bar sticky top-0 z-[900]"
    >
      <TopRightNavigation search={searchParams.toString()} />
    </ABIAppBar>
  );
};

export default AppHeader;
