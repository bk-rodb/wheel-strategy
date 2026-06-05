import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import WheelDashboard from "./WheelDashboard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WheelDashboard />
  </StrictMode>
);
