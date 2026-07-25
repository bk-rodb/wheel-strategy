import type { AccountInfo, WheelPosition } from "../types";
import { fmt, dayChange, dayChangePct } from "../utils/formatters";
import { formatAveragePricePair } from "../utils/priceAverages";
import { SOURCE_BADGE } from "../constants";
import { CatalystsAndNews } from "./CatalystsAndNews";
import { WheelPhaseIndicator } from "./WheelPhaseIndicator";
import { PriceTrendSection } from "./PriceTrendSection";
import { StatRow } from "./StatRow";
import { OpenOptionsSection } from "./OpenOptionsSection";
import { ResearchSection } from "./ResearchSection";
import { TickerTabLabel } from "./TickerTabLabel";
import { VolatilityBar } from "./VolatilityBar";
import { WheelAnalysisPanel } from "./WheelAnalysisPanel";

const cardStyle: React.CSSProperties = {
  background: "#08081a",
  border: "1px solid #1a1a30",
  borderRadius: 6,
  padding: 14,
  marginBottom: 16,
};

export function TickerDetail({
  pos,
  account = null,
  focusOpenOptions = false,
  onFocusOpenOptionsHandled,
  onPositionRefresh,
}: {
  pos: WheelPosition;
  account?: AccountInfo | null;
  focusOpenOptions?: boolean;
  onFocusOpenOptionsHandled?: () => void;
  onPositionRefresh?: () => void;
}) {
  const chg = dayChange(pos);
  const chgPct = dayChangePct(pos);
  const chgColor = chg >= 0 ? "#34d399" : "#f87171";

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
            symbol={pos.ticker}
            companyName={pos.companyName}
            badge={
              <span
                style={{
                  fontSize: 10,
                  color: "#fff",
                  background: SOURCE_BADGE[pos.dataSource],
                  padding: "2px 7px",
                  borderRadius: 3,
                  fontFamily: "monospace",
                  fontWeight: 700,
                }}
              >
                {pos.dataSource.toUpperCase()}
              </span>
            }
            subtitle={pos.sector !== "—" ? pos.sector : undefined}
          />
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{ fontSize: 26, fontFamily: "monospace", fontWeight: 700, color: "#e8e8f8" }}
          >
            {fmt.currency(pos.currentPrice)}
          </div>
          <div style={{ fontSize: 13, fontFamily: "monospace", color: chgColor }}>
            {chg >= 0 ? "▲" : "▼"} {fmt.currency(Math.abs(chg))} ({fmt.pct(chgPct)})
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <WheelPhaseIndicator phase={pos.phase} />
      </div>

      {/* Price Chart */}
      <div style={cardStyle}>
        <PriceTrendSection
          data={pos.priceHistory}
          currentPrice={pos.currentPrice}
          costBasis={pos.costBasis}
          strike={pos.activeOption?.strike}
        />
      </div>

      {/* Catalysts & News */}
      <div style={cardStyle}>
        <CatalystsAndNews symbol={pos.ticker} />
      </div>

      {/* 2-col stats */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}
      >
        <div
          style={{
            background: "#08081a",
            border: "1px solid #1a1a30",
            borderRadius: 6,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#4a4a6a",
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            STOCK DETAILS
          </div>
          <StatRow label="Shares" value={fmt.num(pos.shares)} />
          <StatRow label="Cost Basis" value={pos.costBasis > 0 ? fmt.currency(pos.costBasis) : "—"} />
          <StatRow label="Day High" value={fmt.currency(pos.dayHigh)} />
          <StatRow label="Day Low" value={fmt.currency(pos.dayLow)} />
          <StatRow
            label="Average Price (1W/1M)"
            value={formatAveragePricePair(pos.priceHistory)}
          />
          <StatRow label="Volume" value={fmt.compact(pos.volume)} />
          {pos.marketCap > 0 && (
            <StatRow label="Market Cap" value={fmt.compact(pos.marketCap)} />
          )}
          <VolatilityBar symbol={pos.ticker} />
        </div>
        <div
          style={{
            background: "#08081a",
            border: "1px solid #1a1a30",
            borderRadius: 6,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#4a4a6a",
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            P&amp;L SUMMARY
          </div>
          <StatRow label="Cash Deployed" value={fmt.currency(pos.cashDeployed)} />
          <StatRow
            label="Unrealized P&L"
            value={fmt.currency(pos.unrealizedPnL)}
            accent={pos.unrealizedPnL >= 0}
          />
          <StatRow label="Premium Collected" value={fmt.currency(pos.premiumCollectedTotal)} accent />
          <StatRow label="Prev. Close" value={fmt.currency(pos.previousClose)} />
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            fontSize: 10,
            color: "#4a4a6a",
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          RESEARCH
        </div>
        <ResearchSection symbol={pos.ticker} />
      </div>

      <div style={cardStyle}>
        <OpenOptionsSection
          symbol={pos.ticker}
          shares={pos.shares}
          activeOption={pos.activeOption}
          phase={pos.phase}
          account={account}
          focusSection={focusOpenOptions}
          onFocusHandled={onFocusOpenOptionsHandled}
          onPositionRefresh={onPositionRefresh}
        />
      </div>

      <div style={cardStyle}>
        <div
          style={{
            fontSize: 10,
            color: "#4a4a6a",
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          OPTIONS ENTRY SUGGESTIONS
        </div>
        <WheelAnalysisPanel symbol={pos.ticker} />
      </div>

      <div
        style={{
          fontSize: 10,
          color: "#2a2a4a",
          fontFamily: "monospace",
          textAlign: "right",
        }}
      >
        UPDATED {new Date(pos.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}
