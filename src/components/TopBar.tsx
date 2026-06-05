import type { BrokerType } from "../types";
import { AccountPicker } from "./AccountPicker";

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
        borderBottom: "1px solid #12122a",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#07071a",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 16,
            fontWeight: 800,
            color: "#34d399",
            letterSpacing: "-0.01em",
          }}
        >
          WHEEL DESK
        </span>
        <span style={{ fontSize: 9, color: "#2a2a4a", letterSpacing: "0.1em" }}>
          OPTIONS STRATEGY TRACKER
        </span>
        {isMock && (
          <span
            style={{
              fontSize: 9,
              color: "#f59e0b",
              background: "#f59e0b18",
              border: "1px solid #f59e0b40",
              padding: "1px 7px",
              borderRadius: 3,
              fontFamily: "monospace",
              letterSpacing: "0.08em",
            }}
          >
            MOCK DATA
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <AccountPicker selected={broker} onChange={onBrokerChange} />
        <span style={{ fontSize: 10, color: "#2a2a4a" }}>
          {lastRefresh.toLocaleTimeString()}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            cursor: loading ? "default" : "pointer",
            fontSize: 10,
            fontFamily: "monospace",
            color: loading ? "#2a2a4a" : "#34d399",
            border: "1px solid",
            borderColor: loading ? "#1a1a2a" : "#34d39940",
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
