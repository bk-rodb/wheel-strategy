import { useTickerSnapshot } from "../hooks/useTickerSnapshot";
import { fmt } from "../utils/formatters";
import { PriceTrendChart } from "./PriceTrendChart";
import { StatRow } from "./StatRow";
import { WheelAnalysisPanel } from "./WheelAnalysisPanel";

const cardStyle: React.CSSProperties = {
  background: "#08081a",
  border: "1px solid #1a1a30",
  borderRadius: 6,
  padding: 14,
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#4a4a6a",
  fontFamily: "monospace",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#3a3a5a",
  fontFamily: "monospace",
  padding: "12px 0",
  textAlign: "center",
};

export function WatchlistTickerDetail({ symbol }: { symbol: string }) {
  const snap = useTickerSnapshot(symbol);

  if (snap.loading) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "#2a2a4a", fontFamily: "monospace", fontSize: 12 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>◌</div>
        LOADING {symbol}...
      </div>
    );
  }

  if (snap.error) {
    return (
      <div
        style={{
          background: "#1a0808",
          border: "1px solid #4a1010",
          borderRadius: 6,
          padding: 12,
          fontSize: 12,
          color: "#f87171",
          fontFamily: "monospace",
        }}
      >
        ✗ {snap.error}
      </div>
    );
  }

  const chgColor = snap.change >= 0 ? "#34d399" : "#f87171";

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontFamily: "'Syne', 'Trebuchet MS', sans-serif",
                fontWeight: 800,
                color: "#e8e8f8",
                letterSpacing: "-0.02em",
              }}
            >
              {symbol}
            </h2>
            <span
              style={{
                fontSize: 10,
                color: "#8a8aa8",
                background: "#16162e",
                border: "1px solid #2a2a3a",
                padding: "2px 7px",
                borderRadius: 3,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              WATCHLIST
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5a5a7a", fontFamily: "monospace" }}>
            Not currently held · research view
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontFamily: "monospace", fontWeight: 700, color: "#e8e8f8" }}>
            {fmt.currency(snap.lastPrice)}
          </div>
          <div style={{ fontSize: 13, fontFamily: "monospace", color: chgColor }}>
            {snap.change >= 0 ? "▲" : "▼"} {fmt.currency(Math.abs(snap.change))} ({fmt.pct(snap.changePct)})
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={cardLabelStyle}>30-DAY PRICE TREND</div>
        {snap.priceHistory.length > 0 ? (
          <PriceTrendChart data={snap.priceHistory} costBasis={0} />
        ) : (
          <div style={emptyStyle}>NO PRICE HISTORY</div>
        )}
      </div>

      {/* 2-col: stock details + current balance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>STOCK DETAILS</div>
          <StatRow label="Last Price" value={fmt.currency(snap.lastPrice)} />
          <StatRow label="Prev. Close" value={fmt.currency(snap.prevClose)} />
          <StatRow label="Day High" value={fmt.currency(snap.dayHigh)} />
          <StatRow label="Day Low" value={fmt.currency(snap.dayLow)} />
          <StatRow label="Volume" value={fmt.compact(snap.volume)} />
        </div>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>CURRENT BALANCE</div>
          <div style={emptyStyle}>
            NO SHARES HELD
            <br />
            <span style={{ fontSize: 9 }}>NOT IN THIS ACCOUNT</span>
          </div>
        </div>
      </div>

      {/* Open options */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={cardLabelStyle}>OPEN OPTIONS</div>
        <div style={emptyStyle}>NO OPEN OPTIONS FOR {symbol}</div>
      </div>

      {/* Options entry suggestions — data-driven CSP / covered-call strikes */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ ...cardLabelStyle, marginBottom: 12 }}>OPTIONS ENTRY SUGGESTIONS</div>
        <WheelAnalysisPanel symbol={symbol} />
      </div>
    </div>
  );
}
