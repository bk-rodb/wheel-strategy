import { useTickerCatalysts } from "../hooks/useTickerCatalysts";
import type { CatalystEvent } from "../types";
import { fmtRelativeTime } from "../utils/formatters";

const cardLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#4a4a6a",
  fontFamily: "monospace",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#3a3a5a",
  fontFamily: "monospace",
  padding: "8px 0",
};

const EVENT_ICON: Record<CatalystEvent["type"], string> = {
  earnings: "◆",
  ex_dividend: "◇",
  split: "÷",
  macro: "◎",
};

const EVENT_COLOR: Record<CatalystEvent["type"], string> = {
  earnings: "#f59e0b",
  ex_dividend: "#60a5fa",
  split: "#a78bfa",
  macro: "#8a8aa8",
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T12:00:00`);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function urgencyColor(days: number): string {
  if (days <= 0) return "#f87171";
  if (days <= 7) return "#f59e0b";
  return "#5a5a7a";
}

function EventRow({ event }: { event: CatalystEvent }) {
  const days = daysUntil(event.date);
  const urgent = days <= 7;
  const color = EVENT_COLOR[event.type];

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid #101020",
      }}
    >
      <span style={{ color, fontSize: 10, marginTop: 2 }}>{EVENT_ICON[event.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: urgent ? "#e8e8f8" : "#b8b8d0",
              fontWeight: urgent ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {event.title}
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              color: urgencyColor(days),
              whiteSpace: "nowrap",
            }}
          >
            {days === 0 ? "TODAY" : days < 0 ? "PAST" : `${days}D`}
          </span>
        </div>
        <div style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "monospace", marginTop: 2 }}>
          {event.date}
          {event.timing ? ` · ${event.timing.toUpperCase()}` : ""}
          {event.detail ? ` · ${event.detail}` : ""}
        </div>
        {event.conflictsWithExpiry && (
          <div
            style={{
              fontSize: 9,
              color: "#f59e0b",
              fontFamily: "monospace",
              marginTop: 4,
            }}
          >
            ⚠ Conflicts with next Friday expiry
          </div>
        )}
        {event.type === "ex_dividend" && event.yieldPct != null && (
          <div style={{ fontSize: 9, color: "#60a5fa", fontFamily: "monospace", marginTop: 2 }}>
            CC early-assignment risk if ITM
          </div>
        )}
      </div>
    </div>
  );
}

/** ~1 headline line + meta + padding per row; 5 rows visible before scroll. */
const NEWS_ROW_HEIGHT = 44;
const NEWS_VISIBLE_ROWS = 5;

function NewsRow({ item }: { item: { headline: string; source: string; url: string; publishedAt: string } }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={item.headline}
      style={{
        display: "block",
        padding: "8px 0",
        borderBottom: "1px solid #101020",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          color: "#c8c8e0",
          lineHeight: 1.4,
          marginBottom: 3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.headline}
      </div>
      <div style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "monospace" }}>
        {item.source} · {fmtRelativeTime(item.publishedAt)}
      </div>
    </a>
  );
}

const columnStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "#3a3a5a",
  fontFamily: "monospace",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

export function CatalystsAndNews({ symbol }: { symbol: string }) {
  const { events, news, loading, error } = useTickerCatalysts(symbol);

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={cardLabelStyle}>CATALYSTS &amp; NEWS</div>
      {loading && (
        <div style={emptyStyle}>Loading catalysts…</div>
      )}
      {error && (
        <div style={{ ...emptyStyle, color: "#f87171" }}>✗ {error}</div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
          gap: 16,
          width: "100%",
          minWidth: 0,
        }}
      >
        <div style={columnStyle}>
          <div style={sectionLabelStyle}>
            UPCOMING EVENTS
          </div>
          {sortedEvents.length === 0 && !loading ? (
            <div style={emptyStyle}>No upcoming events in next 90 days</div>
          ) : (
            sortedEvents.map((e) => <EventRow key={e.id} event={e} />)
          )}
        </div>
        <div style={columnStyle}>
          <div style={sectionLabelStyle}>
            RECENT NEWS
          </div>
          {news.length === 0 && !loading ? (
            <div style={emptyStyle}>No headlines in the last 7 days</div>
          ) : (
            <div
              style={{
                maxHeight: NEWS_ROW_HEIGHT * NEWS_VISIBLE_ROWS,
                overflowY: "auto",
                paddingRight: 4,
                minWidth: 0,
              }}
            >
              {news.map((n) => (
                <NewsRow key={n.id} item={n} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
