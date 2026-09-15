import { useTheme } from "../theme";
import { ToggleButton } from "./ui";

export function ThemeSwitcher() {
  const { theme, themes, setTheme } = useTheme();
  return (
    <div role="group" aria-label="Theme" style={{ display: "flex", gap: 4 }}>
      {themes.map((t) => (
        <ToggleButton key={t.name} active={t.name === theme.name} onClick={() => setTheme(t.name)} title={`${t.label} theme`}>
          {t.label.toUpperCase()}
        </ToggleButton>
      ))}
    </div>
  );
}
