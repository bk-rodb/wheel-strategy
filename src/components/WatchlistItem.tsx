import type { WatchlistItem as WatchlistItemData } from "../hooks/useWatchlist";
import { fmt } from "../utils/formatters";

interface WatchlistItemProps {
  item: WatchlistItemData;
  onRemove: (symbol: string) => void;
}

export function WatchlistItem({ item, onRemove }: WatchlistItemProps) {
  const q = item.quote;
  const up = q ? q.change >= 0 : true;
  const chgColor = q ? (up ? "#34d399" : "#f87171") : "#3a3a5a";
  const arrow = up ? "▲" : "▼";

  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid #0e0e20",
        transition: "background 0.1s",
        position: "relative",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#0d0d1e")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      {/* Row 1: symbol + last price */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 3,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            fontWeight: 700,
            color: "#d8d8f0",
            letterSpacing: "0.04em",
          }}
        >
          {item.symbol}
        </span>
        <span
          style={{
            fontSize: 13,
            fontFamily: "monospace",
            fontWeight: 700,
            color: q ? "#e0e0f8" : "#3a3a5a",
          }}
        >
          {item.loadingQuote ? "···" : q ? fmt.currency(q.lastPrice) : "—"}
        </span>
      </div>

      {/* Row 2: source label + arrow + change */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            color: "#3a3a5a",
            letterSpacing: "0.06em",
          }}
        >
          {q?.source === "5min" ? "5MIN DELAYED" : "CLOSE"}
        </span>
        {q && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: 600,
              color: chgColor,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 9 }}>{arrow}</span>
            {fmt.currency(Math.abs(q.change))}
            <span style={{ fontSize: 10, opacity: 0.8 }}>
              ({q.changePct >= 0 ? "+" : ""}
              {q.changePct.toFixed(2)}%)
            </span>
          </span>
        )}
      </div>

      {/* Row 3: prev close */}
      {q && (
        <div
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            color: "#3a3a5a",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>PREV CLOSE</span>
          <span style={{ color: "#4a4a6a" }}>{fmt.currency(q.closePrice)}</span>
        </div>
      )}

      {/* Remove */}
      <button
        onClick={() => onRemove(item.symbol)}
        title="Remove"
        style={{
          cursor: "pointer",
          fontSize: 9,
          color: "#2a2a4a",
          position: "absolute",
          top: 8,
          right: 10,
          padding: "2px 4px",
          borderRadius: 2,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#ef4444")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#2a2a4a")}
      >
        ✕
      </button>
    </div>
  );
}
