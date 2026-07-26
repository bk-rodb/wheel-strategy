import type { WheelPosition } from "../types";
import { PHASE_CONFIG } from "../constants";
import { fmt, dayChange, dayChangePct } from "../utils/formatters";

export interface Tab {
  id: string;
  label: string;
  closeable?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  positions: WheelPosition[];
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
}

export function TabBar({ tabs, activeTab, positions, onSelect, onClose }: TabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Desk views"
      style={{
        borderBottom: "1px solid #12122a",
        padding: "0 24px",
        display: "flex",
        gap: 0,
        overflowX: "auto",
        background: "#07071a",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const pos = positions.find((p) => p.id === tab.id);
        const phase = pos ? PHASE_CONFIG[pos.phase] : null;
        return (
          <div
            key={tab.id}
            style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              id={`tab-${tab.id}`}
              onClick={() => onSelect(tab.id)}
              className={`ticker-tab-bar__tab${isActive ? " ticker-tab-bar__tab--active" : ""}`}
              style={{
                padding: "10px 18px",
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: isActive ? (phase ? phase.color : "#34d399") : "#3a3a5a",
                borderBottom: isActive
                  ? `2px solid ${phase ? phase.color : "#34d399"}`
                  : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
              {pos?.activeOption && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 9,
                    color: dayChange(pos) >= 0 ? "#34d399" : "#f87171",
                    fontWeight: 400,
                  }}
                >
                  {fmt.pct(dayChangePct(pos))}
                </span>
              )}
            </button>
            {tab.closeable && onClose && (
              <button
                type="button"
                aria-label={`Close ${tab.label} tab`}
                title={`Close ${tab.label}`}
                onClick={() => onClose(tab.id)}
                style={{
                  padding: "10px 8px 10px 0",
                  fontSize: 10,
                  color: "#3a3a5a",
                  cursor: "pointer",
                  borderBottom: isActive
                    ? `2px solid ${phase ? phase.color : "#34d399"}`
                    : "2px solid transparent",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ef4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#3a3a5a";
                }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
