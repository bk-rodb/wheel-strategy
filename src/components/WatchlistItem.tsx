import type { WatchlistItem as WatchlistItemData } from "../hooks/useWatchlist";
import { fmt } from "../utils/formatters";

interface WatchlistItemProps {
  item: WatchlistItemData;
  onRemove: (symbol: string) => void;
}

export function WatchlistItem({ item, onRemove }: WatchlistItemProps) {
  const q = item.quote;
  // Render every row as a live daily-session quote: the session price up top,
  // the day's move (vs. prior close) below — shown actively whether or not the
  // market is currently open.
  const flat = q ? q.change === 0 : false;
  const up = q ? q.change >= 0 : true;
  const chgColor = !q ? "#3a3a5a" : flat ? "#8a8aa8" : up ? "#34d399" : "#f87171";
  const arrow = flat ? "▶" : up ? "▲" : "▼";

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
      {/* Row 1: symbol + closing price */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
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

      {/* Row 2: arrow + change + change % (daily session move) */}
      {q && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
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
            {q.change >= 0 ? "+" : "−"}
            {fmt.currency(Math.abs(q.change))}
            <span style={{ fontSize: 10, opacity: 0.85 }}>
              ({q.changePct >= 0 ? "+" : ""}
              {q.changePct.toFixed(2)}%)
            </span>
          </span>
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
