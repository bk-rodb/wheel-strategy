import { extendTheme } from "../extendTheme";
import { darkTheme } from "./dark";

/**
 * Your theme. Start from an existing theme and override only the tokens you care about —
 * everything you leave out is inherited. TypeScript will reject unknown token names.
 *
 * This sample is a warm "amber terminal" variant of the dark theme.
 */
export const customTheme = extendTheme(darkTheme, {
  name: "custom",
  label: "Amber",

  bg: {
    app: "#0c0904",
    panel: "#140f08",
    card: "#17110a",
    sunken: "#1a130b",
    raised: "#1f170d",
    overlay: "#241a0f",
    hover: "#2a1f12",
  },

  border: {
    subtle: "#2a1f12",
    default: "#3a2a17",
    strong: "#4a361d",
    emphasis: "#5c4424",
  },

  text: {
    strong: "#fbe9cf",
    primary: "#e8cfa8",
    secondary: "#cbb08a",
    tertiary: "#ad946f",
    muted: "#8f7856",
    subtle: "#7a6447",
    dim: "#66533a",
    faint: "#54432e",
    ghost: "#3f3222",
  },

  accent: "#fbbf24",
  level: { regular: "#fbe9cf" },
  phase: { cc: "#fbbf24" },

  font: {
    display: "'JetBrains Mono', monospace",
  },
});
