import type { BrokerType } from "../types";
import { AccountPicker } from "./AccountPicker";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { alpha, vars } from "../theme";

interface TopBarProps {
  broker: BrokerType;
  onBrokerChange: (b: BrokerType) => void;
  lastRefresh: Date;
  loading: boolean;
  isMock: boolean;
  onRefresh: () => void;
}

export function TopBar({ broker, onBrokerChange, lastRefresh, loading, isMock, onRefresh }: TopBarProps) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${vars.border.subtle}`,
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: vars.bg.panel,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: vars.font.display,
            fontSize: 16,
            fontWeight: 800,
            color: vars.accent,
            letterSpacing: "-0.01em",
          }}
        >
          WHEEL DESK
        </span>
        <span style={{ fontSize: 9, color: vars.text.ghost, letterSpacing: "0.1em" }}>
          OPTIONS STRATEGY TRACKER
        </span>
        {isMock && (
          <span
            style={{
              fontSize: 9,
              color: vars.status.warning,
              background: alpha(vars.status.warning, 0.094),
              border: `1px solid ${alpha(vars.status.warning, 0.251)}`,
              padding: "1px 7px",
              borderRadius: 3,
              fontFamily: vars.font.mono,
              letterSpacing: "0.08em",
            }}
          >
            MOCK DATA
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ThemeSwitcher />
        <AccountPicker selected={broker} onChange={onBrokerChange} />
        <span style={{ fontSize: 10, color: vars.text.ghost }}>
          {lastRefresh.toLocaleTimeString()}
        </span>
        <button
          type="button"
          aria-label="Refresh positions"
          onClick={onRefresh}
          disabled={loading}
          style={{
            cursor: loading ? "default" : "pointer",
            fontSize: 10,
            fontFamily: vars.font.mono,
            color: loading ? vars.text.ghost : vars.accent,
            border: "1px solid",
            borderColor: loading ? vars.border.default : alpha(vars.accent, 0.251),
            padding: "4px 12px",
            borderRadius: 3,
            letterSpacing: "0.06em",
            transition: "all 0.15s",
          }}
        >
          {loading ? "LOADING..." : "↻ REFRESH"}
        </button>
      </div>
    </div>
  );
}
