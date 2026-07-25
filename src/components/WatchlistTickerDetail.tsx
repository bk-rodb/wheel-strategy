import { useTickerSnapshot } from "../hooks/useTickerSnapshot";
import type { AccountInfo } from "../types";
import { fmt } from "../utils/formatters";
import { formatAveragePricePair } from "../utils/priceAverages";
import { OpenOptionsSection } from "./OpenOptionsSection";
import { PriceTrendSection } from "./PriceTrendSection";
import { StatRow } from "./StatRow";
import { WheelAnalysisPanel } from "./WheelAnalysisPanel";
import { ResearchSection } from "./ResearchSection";
import { TickerTabLabel } from "./TickerTabLabel";
import { CatalystsAndNews } from "./CatalystsAndNews";
import { VolatilityBar } from "./VolatilityBar";

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

export function WatchlistTickerDetail({
  symbol,
  account = null,
  focusOpenOptions = false,
  onFocusOpenOptionsHandled,
  onPositionRefresh,
}: {
  symbol: string;
  account?: AccountInfo | null;
  focusOpenOptions?: boolean;
  onFocusOpenOptionsHandled?: () => void;
  onPositionRefresh?: () => void;
}) {
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
          <TickerTabLabel
            symbol={symbol}
            companyName={snap.companyName}
            badge={
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
            }
            subtitle="Not currently held · research view"
          />
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
        <PriceTrendSection
          data={snap.priceHistory}
          currentPrice={snap.lastPrice}
          costBasis={0}
        />
      </div>

      {/* Catalysts & News */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <CatalystsAndNews symbol={symbol} />
      </div>

      {/* 2-col: stock details + current balance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>STOCK DETAILS</div>
          <StatRow label="Last Price" value={fmt.currency(snap.lastPrice)} />
          <StatRow label="Prev. Close" value={fmt.currency(snap.prevClose)} />
          <StatRow
            label="Day High/Low"
            value={`${fmt.currency(snap.dayHigh)}, ${fmt.currency(snap.dayLow)}`}
          />
          <StatRow
            label="52 Week Range"
            value={`${fmt.currency(snap.week52High)}/${fmt.currency(snap.week52Low)}`}
          />
          <StatRow
            label="Average Price (1W/1M)"
            value={formatAveragePricePair(snap.priceHistory)}
          />
          <StatRow label="Volume" value={fmt.compact(snap.volume)} />
          <VolatilityBar symbol={symbol} />
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

      {/* Open options — Friday put ladder + sell-to-open when flat */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <OpenOptionsSection
          symbol={symbol}
          shares={0}
          account={account}
          focusSection={focusOpenOptions}
          onFocusHandled={onFocusOpenOptionsHandled}
          onPositionRefresh={onPositionRefresh}
        />
      </div>

      {/* Research — HMM regime analysis and trend forecast */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ ...cardLabelStyle, marginBottom: 12 }}>RESEARCH</div>
        <ResearchSection symbol={symbol} />
      </div>

      {/* Options entry suggestions — data-driven CSP / covered-call strikes */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ ...cardLabelStyle, marginBottom: 12 }}>OPTIONS ENTRY SUGGESTIONS</div>
        <WheelAnalysisPanel symbol={symbol} />
      </div>
    </div>
  );
}
