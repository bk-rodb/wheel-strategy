import type { KeyboardEvent } from "react";
import type { WatchlistItem as WatchlistItemData } from "../hooks/useWatchlist";
import { fmt } from "../utils/formatters";
import { vars } from "../theme";

interface WatchlistItemProps {
  item: WatchlistItemData;
  onRemove: (symbol: string) => void;
  onOpen: (symbol: string) => void;
}

export function WatchlistItem({ item, onRemove, onOpen }: WatchlistItemProps) {
  const q = item.quote;
  // Render every row as a live daily-session quote: the session price up top,
  // the day's move (vs. prior close) below — shown actively whether or not the
  // market is currently open.
  const flat = q ? q.change === 0 : false;
  const up = q ? q.change >= 0 : true;
  const chgColor = !q ? vars.text.faint : flat ? vars.text.tertiary : up ? vars.status.gain : vars.status.loss;
  const arrow = flat ? "▶" : up ? "▲" : "▼";

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(item.symbol);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.symbol)}
      onKeyDown={onRowKeyDown}
      title={`Open ${item.symbol}`}
      aria-label={`Open ${item.symbol}`}
      style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${vars.bg.raised}`,
        transition: "background 0.1s",
        position: "relative",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = vars.bg.raised)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
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
            fontFamily: vars.font.mono,
            fontWeight: 700,
            color: vars.text.strong,
            letterSpacing: "0.04em",
          }}
        >
          {item.symbol}
        </span>
        <span
          style={{
            fontSize: 13,
            fontFamily: vars.font.mono,
            fontWeight: 700,
            color: q ? vars.text.strong : vars.text.faint,
          }}
        >
          {item.loadingQuote ? "···" : q ? fmt.currency(q.lastPrice) : "—"}
        </span>
      </div>

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
              fontFamily: vars.font.mono,
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

      <button
        type="button"
        aria-label={`Remove ${item.symbol} from watchlist`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.symbol);
        }}
        title={`Remove ${item.symbol}`}
        style={{
          cursor: "pointer",
          fontSize: 9,
          color: vars.text.ghost,
          position: "absolute",
          top: 8,
          right: 10,
          padding: "2px 4px",
          borderRadius: 2,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = vars.status.danger)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = vars.text.ghost)}
      >
        ✕
      </button>
    </div>
  );
}
