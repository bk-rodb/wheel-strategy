import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initTheme, ThemeProvider } from "./theme";
import WheelDashboard from "./WheelDashboard";

// Apply the saved theme before the first paint so the page never flashes the default.
const initialTheme = initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider initialTheme={initialTheme}>
      <WheelDashboard />
    </ThemeProvider>
  </StrictMode>
);
