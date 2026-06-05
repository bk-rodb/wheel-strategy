import type { WheelPosition } from "../types";
import { fmt, dayChange, dayChangePct } from "../utils/formatters";
import { SOURCE_BADGE } from "../constants";
import { WheelPhaseIndicator } from "./WheelPhaseIndicator";
import { PriceTrendChart } from "./PriceTrendChart";
import { StatRow } from "./StatRow";
import { OptionCard } from "./OptionCard";

export function TickerDetail({ pos }: { pos: WheelPosition }) {
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
              {pos.ticker}
            </h2>
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
          </div>
          <div style={{ fontSize: 12, color: "#5a5a7a", fontFamily: "monospace" }}>
            {pos.companyName} · {pos.sector}
          </div>
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
      <div
        style={{
          background: "#08081a",
          border: "1px solid #1a1a30",
          borderRadius: 6,
          padding: 14,
          marginBottom: 16,
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
          30-DAY PRICE TREND
        </div>
        <PriceTrendChart
          data={pos.priceHistory}
          costBasis={pos.costBasis}
          strike={pos.activeOption?.strike}
        />
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
          <StatRow label="Volume" value={fmt.compact(pos.volume)} />
          {pos.marketCap > 0 && (
            <StatRow label="Market Cap" value={fmt.compact(pos.marketCap)} />
          )}
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

      {pos.activeOption && (
        <div style={{ marginBottom: 16 }}>
          <OptionCard opt={pos.activeOption} phase={pos.phase} />
        </div>
      )}

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
