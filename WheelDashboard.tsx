import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type WheelPhase = "cash-secured-put" | "stock-holding" | "covered-call";
type DataSource = "etrade" | "alpaca" | "polygon" | "yfinance";

interface OptionLeg {
  type: "put" | "call";
  strike: number;
  expiration: string;
  premiumReceived: number;
  contracts: number;
  currentOptionPrice: number;
}

interface PricePoint {
  date: string;
  price: number;
}

interface WheelPosition {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  phase: WheelPhase;
  shares: number;
  costBasis: number;
  currentPrice: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
  priceHistory: PricePoint[];
  activeOption?: OptionLeg;
  premiumCollectedTotal: number;
  cashDeployed: number;
  unrealizedPnL: number;
  dataSource: DataSource;
  lastUpdated: string;
}

// ─── Mock Data (replace fetch calls with real API endpoints) ─────────────────

const MOCK_POSITIONS: WheelPosition[] = [
  {
    id: "TSLA",
    ticker: "TSLA",
    companyName: "Tesla, Inc.",
    sector: "Consumer Cyclical",
    phase: "covered-call",
    shares: 100,
    costBasis: 218.5,
    currentPrice: 241.3,
    previousClose: 237.8,
    dayHigh: 244.1,
    dayLow: 236.9,
    volume: 84200000,
    marketCap: 770000000000,
    priceHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000)
        .toISOString()
        .slice(0, 10),
      price: parseFloat(
        (200 + Math.sin(i / 4) * 18 + i * 1.4 + Math.random() * 6).toFixed(2),
      ),
    })),
    activeOption: {
      type: "call",
      strike: 250,
      expiration: "2025-07-18",
      premiumReceived: 4.2,
      contracts: 1,
      currentOptionPrice: 2.85,
    },
    premiumCollectedTotal: 1840,
    cashDeployed: 21850,
    unrealizedPnL: 2280,
    dataSource: "alpaca",
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "NVDA",
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    phase: "cash-secured-put",
    shares: 0,
    costBasis: 0,
    currentPrice: 118.4,
    previousClose: 121.2,
    dayHigh: 122.0,
    dayLow: 117.3,
    volume: 210000000,
    marketCap: 2890000000000,
    priceHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000)
        .toISOString()
        .slice(0, 10),
      price: parseFloat(
        (105 + Math.cos(i / 3.5) * 10 + i * 0.5 + Math.random() * 5).toFixed(2),
      ),
    })),
    activeOption: {
      type: "put",
      strike: 115,
      expiration: "2025-07-11",
      premiumReceived: 2.1,
      contracts: 2,
      currentOptionPrice: 3.4,
    },
    premiumCollectedTotal: 620,
    cashDeployed: 23000,
    unrealizedPnL: -260,
    dataSource: "polygon",
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "AMZN",
    ticker: "AMZN",
    companyName: "Amazon.com, Inc.",
    sector: "Consumer Cyclical",
    phase: "stock-holding",
    shares: 50,
    costBasis: 186.3,
    currentPrice: 193.7,
    previousClose: 191.5,
    dayHigh: 195.2,
    dayLow: 190.8,
    volume: 42000000,
    marketCap: 2040000000000,
    priceHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000)
        .toISOString()
        .slice(0, 10),
      price: parseFloat(
        (175 + i * 0.65 + Math.sin(i / 5) * 8 + Math.random() * 4).toFixed(2),
      ),
    })),
    premiumCollectedTotal: 940,
    cashDeployed: 9315,
    unrealizedPnL: 370,
    dataSource: "yfinance",
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "SPY",
    ticker: "SPY",
    companyName: "SPDR S&P 500 ETF",
    sector: "ETF",
    phase: "covered-call",
    shares: 200,
    costBasis: 524.1,
    currentPrice: 538.6,
    previousClose: 536.4,
    dayHigh: 540.1,
    dayLow: 535.7,
    volume: 68000000,
    marketCap: 0,
    priceHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000)
        .toISOString()
        .slice(0, 10),
      price: parseFloat(
        (510 + i * 0.9 + Math.sin(i / 6) * 5 + Math.random() * 3).toFixed(2),
      ),
    })),
    activeOption: {
      type: "call",
      strike: 545,
      expiration: "2025-06-27",
      premiumReceived: 3.8,
      contracts: 2,
      currentOptionPrice: 1.2,
    },
    premiumCollectedTotal: 3120,
    cashDeployed: 104820,
    unrealizedPnL: 2900,
    dataSource: "etrade",
    lastUpdated: new Date().toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = {
  currency: (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n),
  compact: (n: number) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n),
  pct: (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
  num: (n: number) => n.toLocaleString("en-US"),
};

const dayChange = (pos: WheelPosition) => pos.currentPrice - pos.previousClose;
const dayChangePct = (pos: WheelPosition) =>
  ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100;

const dte = (expiration: string): number => {
  const diff = new Date(expiration).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const PHASE_CONFIG: Record<
  WheelPhase,
  { label: string; color: string; step: number }
> = {
  "cash-secured-put": { label: "CSP", color: "#f59e0b", step: 0 },
  "stock-holding": { label: "STOCK", color: "#60a5fa", step: 1 },
  "covered-call": { label: "CC", color: "#34d399", step: 2 },
};

const SOURCE_BADGE: Record<DataSource, string> = {
  etrade: "#ef4444",
  alpaca: "#8b5cf6",
  polygon: "#3b82f6",
  yfinance: "#10b981",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function WheelPhaseIndicator({ phase }: { phase: WheelPhase }) {
  const steps: WheelPhase[] = [
    "cash-secured-put",
    "stock-holding",
    "covered-call",
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => {
        const cfg = PHASE_CONFIG[s];
        const active = s === phase;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                padding: "2px 10px",
                fontSize: 10,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontWeight: 700,
                letterSpacing: "0.08em",
                border: `1px solid ${active ? cfg.color : "#2a2a3a"}`,
                color: active ? cfg.color : "#3a3a5a",
                background: active ? `${cfg.color}18` : "transparent",
                borderRadius:
                  i === 0 ? "3px 0 0 3px" : i === 2 ? "0 3px 3px 0" : 0,
                transition: "all 0.2s",
              }}
            >
              {cfg.label}
            </div>
            {i < 2 && (
              <div
                style={{
                  width: 0,
                  height: 20,
                  borderLeft: "1px solid #1a1a2e",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data, color }: { data: PricePoint[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PriceTrendChart({
  data,
  costBasis,
  strike,
}: {
  data: PricePoint[];
  costBasis: number;
  strike?: number;
}) {
  const min = Math.min(...data.map((d) => d.price)) * 0.98;
  const max = Math.max(...data.map((d) => d.price)) * 1.02;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "#4a4a6a", fontSize: 10, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.slice(5)}
          interval={4}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fill: "#4a4a6a", fontSize: 10, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: "#0d0d1a",
            border: "1px solid #2a2a3a",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "monospace",
            color: "#e0e0f0",
          }}
          formatter={(v: number) => [fmt.currency(v), "Price"]}
          labelStyle={{ color: "#6a6a8a" }}
        />
        {costBasis > 0 && (
          <ReferenceLine
            y={costBasis}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: "BASIS",
              fill: "#f59e0b",
              fontSize: 9,
              fontFamily: "monospace",
              position: "insideTopLeft",
            }}
          />
        )}
        {strike && (
          <ReferenceLine
            y={strike}
            stroke="#60a5fa"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: "STRIKE",
              fill: "#60a5fa",
              fontSize: 9,
              fontFamily: "monospace",
              position: "insideTopLeft",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="price"
          stroke="#34d399"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: "1px solid #14142a",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "#4a4a6a",
          fontFamily: "monospace",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontFamily: "monospace",
          fontWeight: 600,
          color: accent ? "#34d399" : "#c0c0e0",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function OptionCard({ opt, phase }: { opt: OptionLeg; phase: WheelPhase }) {
  const d = dte(opt.expiration);
  const urgency = d <= 7 ? "#ef4444" : d <= 14 ? "#f59e0b" : "#34d399";
  const pnlPerContract = (opt.premiumReceived - opt.currentOptionPrice) * 100;
  return (
    <div
      style={{
        background: "#0a0a18",
        border: "1px solid #1e1e38",
        borderRadius: 6,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: phase === "covered-call" ? "#34d399" : "#f59e0b",
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          {opt.type.toUpperCase()} OPTION
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: urgency,
            background: `${urgency}18`,
            padding: "2px 8px",
            borderRadius: 3,
            border: `1px solid ${urgency}40`,
          }}
        >
          {d}d DTE
        </span>
      </div>
      <StatRow label="Strike" value={fmt.currency(opt.strike)} />
      <StatRow label="Expiration" value={opt.expiration} />
      <StatRow label="Contracts" value={String(opt.contracts)} />
      <StatRow
        label="Premium Received"
        value={fmt.currency(opt.premiumReceived)}
      />
      <StatRow
        label="Current Price"
        value={fmt.currency(opt.currentOptionPrice)}
      />
      <StatRow
        label="P&L / Contract"
        value={fmt.currency(pnlPerContract)}
        accent={pnlPerContract >= 0}
      />
    </div>
  );
}

// ─── Ticker Detail Tab ────────────────────────────────────────────────────────

function TickerDetail({ pos }: { pos: WheelPosition }) {
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
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
          <div
            style={{ fontSize: 12, color: "#5a5a7a", fontFamily: "monospace" }}
          >
            {pos.companyName} · {pos.sector}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 26,
              fontFamily: "monospace",
              fontWeight: 700,
              color: "#e8e8f8",
            }}
          >
            {fmt.currency(pos.currentPrice)}
          </div>
          <div
            style={{ fontSize: 13, fontFamily: "monospace", color: chgColor }}
          >
            {chg >= 0 ? "▲" : "▼"} {fmt.currency(Math.abs(chg))} (
            {fmt.pct(chgPct)})
          </div>
        </div>
      </div>

      {/* Phase */}
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
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
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
          <StatRow
            label="Cost Basis"
            value={pos.costBasis > 0 ? fmt.currency(pos.costBasis) : "—"}
          />
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
          <StatRow
            label="Cash Deployed"
            value={fmt.currency(pos.cashDeployed)}
          />
          <StatRow
            label="Unrealized P&L"
            value={fmt.currency(pos.unrealizedPnL)}
            accent={pos.unrealizedPnL >= 0}
          />
          <StatRow
            label="Premium Collected"
            value={fmt.currency(pos.premiumCollectedTotal)}
            accent
          />
          <StatRow
            label="Prev. Close"
            value={fmt.currency(pos.previousClose)}
          />
        </div>
      </div>

      {/* Option card */}
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

// ─── Summary Dashboard ────────────────────────────────────────────────────────

function SummaryDashboard({
  positions,
  onSelectTicker,
}: {
  positions: WheelPosition[];
  onSelectTicker: (id: string) => void;
}) {
  const totalDeployed = positions.reduce((s, p) => s + p.cashDeployed, 0);
  const totalUnrealized = positions.reduce((s, p) => s + p.unrealizedPnL, 0);
  const totalPremium = positions.reduce(
    (s, p) => s + p.premiumCollectedTotal,
    0,
  );
  const totalDayChange = positions.reduce(
    (s, p) => s + dayChange(p) * p.shares,
    0,
  );

  const expiringSoon = positions
    .filter((p) => p.activeOption && dte(p.activeOption.expiration) <= 14)
    .sort(
      (a, b) =>
        dte(a.activeOption!.expiration) - dte(b.activeOption!.expiration),
    );

  return (
    <div>
      {/* Portfolio metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Cash Deployed",
            value: fmt.currency(totalDeployed),
            accent: false,
          },
          {
            label: "Unrealized P&L",
            value: fmt.currency(totalUnrealized),
            accent: totalUnrealized >= 0,
          },
          {
            label: "Premium Collected",
            value: fmt.currency(totalPremium),
            accent: true,
          },
          {
            label: "Day Change",
            value: fmt.currency(totalDayChange),
            accent: totalDayChange >= 0,
          },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "#08081a",
              border: "1px solid #1a1a30",
              borderRadius: 6,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#4a4a6a",
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontSize: 16,
                fontFamily: "monospace",
                fontWeight: 700,
                color: m.accent ? "#34d399" : "#c0c0e0",
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Expiry alerts */}
      {expiringSoon.length > 0 && (
        <div
          style={{
            background: "#100a00",
            border: "1px solid #3a2000",
            borderRadius: 6,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#f59e0b",
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            ⚠ EXPIRING WITHIN 14 DAYS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {expiringSoon.map((p) => {
              const d = dte(p.activeOption!.expiration);
              const c = d <= 7 ? "#ef4444" : "#f59e0b";
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectTicker(p.id)}
                  style={{
                    background: `${c}10`,
                    border: `1px solid ${c}50`,
                    borderRadius: 4,
                    padding: "4px 10px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: 12,
                      color: c,
                    }}
                  >
                    {p.ticker}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "#8a6020",
                    }}
                  >
                    {d}d · {p.activeOption!.type.toUpperCase()}{" "}
                    {fmt.currency(p.activeOption!.strike)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Position cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {positions.map((pos) => {
          const chg = dayChange(pos);
          const chgPct = dayChangePct(pos);
          const chgColor = chg >= 0 ? "#34d399" : "#f87171";
          const phaseCfg = PHASE_CONFIG[pos.phase];

          return (
            <button
              key={pos.id}
              onClick={() => onSelectTicker(pos.id)}
              style={{
                background: "#08081a",
                border: "1px solid #1a1a30",
                borderRadius: 8,
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, transform 0.15s",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  phaseCfg.color + "60";
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "#1a1a30";
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(0)";
              }}
            >
              {/* Top accent bar */}
              <div
                style={{ height: 2, background: phaseCfg.color, opacity: 0.7 }}
              />
              <div style={{ padding: 14 }}>
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "'Syne','Trebuchet MS',sans-serif",
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#e0e0f8",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {pos.ticker}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#3a3a5a",
                        fontFamily: "monospace",
                      }}
                    >
                      {pos.companyName}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#d8d8f0",
                      }}
                    >
                      {fmt.currency(pos.currentPrice)}
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: chgColor,
                      }}
                    >
                      {fmt.pct(chgPct)}
                    </div>
                  </div>
                </div>

                {/* Phase + source */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <WheelPhaseIndicator phase={pos.phase} />
                  <span
                    style={{
                      fontSize: 9,
                      color: "#fff",
                      background: SOURCE_BADGE[pos.dataSource],
                      padding: "1px 6px",
                      borderRadius: 2,
                      fontFamily: "monospace",
                    }}
                  >
                    {pos.dataSource}
                  </span>
                </div>

                {/* Sparkline */}
                <div style={{ height: 48, marginBottom: 10 }}>
                  <Sparkline data={pos.priceHistory} color={phaseCfg.color} />
                </div>

                {/* Bottom stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#3a3a5a",
                        fontFamily: "monospace",
                      }}
                    >
                      UNREALIZED
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: pos.unrealizedPnL >= 0 ? "#34d399" : "#f87171",
                        fontWeight: 600,
                      }}
                    >
                      {fmt.currency(pos.unrealizedPnL)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#3a3a5a",
                        fontFamily: "monospace",
                      }}
                    >
                      PREMIUM
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "#34d399",
                        fontWeight: 600,
                      }}
                    >
                      {fmt.currency(pos.premiumCollectedTotal)}
                    </div>
                  </div>
                  {pos.activeOption && (
                    <>
                      <div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "#3a3a5a",
                            fontFamily: "monospace",
                          }}
                        >
                          STRIKE
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: "#c0c0e0",
                          }}
                        >
                          {fmt.currency(pos.activeOption.strike)}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "#3a3a5a",
                            fontFamily: "monospace",
                          }}
                        >
                          DTE
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color:
                              dte(pos.activeOption.expiration) <= 7
                                ? "#ef4444"
                                : "#c0c0e0",
                          }}
                        >
                          {dte(pos.activeOption.expiration)}d
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── API Hook ─────────────────────────────────────────────────────────────────

/**
 * Replace this hook's internals with real fetch calls to your APIs.
 *
 * Suggested mapping:
 *   - Position list + shares/costBasis  → E*TRADE /v1/accounts/{accountId}/portfolio
 *   - Current price / OHLCV             → Alpaca /v2/stocks/{symbol}/quotes/latest
 *   - 30-day price history              → Polygon /v2/aggs/ticker/{symbol}/range/1/day/{from}/{to}
 *   - Option chain / active leg         → E*TRADE /v1/market/optionchains
 *   - Fallback price history            → yFinance (via your .NET proxy)
 */
function useWheelPositions() {
  const [positions, setPositions] = useState<WheelPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ── REPLACE WITH REAL API CALLS ──────────────────────────────────────
      // Example structure for your .NET 10 backend to aggregate:
      //
      // const [portfolio, quotes, history, options] = await Promise.all([
      //   fetch("/api/wheel/positions").then(r => r.json()),
      //   fetch("/api/market/quotes?symbols=TSLA,NVDA,AMZN,SPY").then(r => r.json()),
      //   fetch("/api/market/history?symbols=TSLA,NVDA,AMZN,SPY&days=30").then(r => r.json()),
      //   fetch("/api/wheel/options/active").then(r => r.json()),
      // ]);
      // const merged = mergePositionData(portfolio, quotes, history, options);
      // setPositions(merged);
      // ─────────────────────────────────────────────────────────────────────

      await new Promise((r) => setTimeout(r, 600)); // simulate network
      setPositions(MOCK_POSITIONS);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchPositions]);

  return { positions, loading, error, lastRefresh, refresh: fetchPositions };
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function WheelDashboard() {
  const { positions, loading, error, lastRefresh, refresh } =
    useWheelPositions();
  const [activeTab, setActiveTab] = useState<string>("__summary__");

  const tabs = [
    { id: "__summary__", label: "DASHBOARD" },
    ...positions.map((p) => ({ id: p.id, label: p.ticker })),
  ];

  const activePosition = positions.find((p) => p.id === activeTab);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060613",
        color: "#c0c0e0",
        fontFamily: "monospace",
      }}
    >
      {/* Global styles via injected style tag */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #060613; }
        ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 2px; }
        button { all: unset; }
      `}</style>

      {/* Top bar */}
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
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
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
          <span
            style={{ fontSize: 9, color: "#2a2a4a", letterSpacing: "0.1em" }}
          >
            OPTIONS STRATEGY TRACKER
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 10, color: "#2a2a4a" }}>
            {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={refresh}
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

      {/* Tab bar */}
      <div
        style={{
          borderBottom: "1px solid #12122a",
          padding: "0 24px",
          display: "flex",
          gap: 0,
          overflowX: "auto",
          background: "#07071a",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const pos = positions.find((p) => p.id === tab.id);
          const phase = pos ? PHASE_CONFIG[pos.phase] : null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 18px",
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: isActive ? (phase ? phase.color : "#34d399") : "#3a3a5a",
                borderBottom: isActive
                  ? `2px solid ${phase ? phase.color : "#34d399"}`
                  : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
              {pos && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 9,
                    color: dayChange(pos) >= 0 ? "#34d399" : "#f87171",
                    fontWeight: 400,
                  }}
                >
                  {fmt.pct(dayChangePct(pos))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px" }}>
        {error && (
          <div
            style={{
              background: "#1a0808",
              border: "1px solid #4a1010",
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 12,
              color: "#f87171",
              fontFamily: "monospace",
            }}
          >
            ✗ {error}
          </div>
        )}

        {loading && positions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              color: "#2a2a4a",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>◌</div>
            LOADING POSITIONS...
          </div>
        ) : activeTab === "__summary__" ? (
          <SummaryDashboard
            positions={positions}
            onSelectTicker={setActiveTab}
          />
        ) : activePosition ? (
          <TickerDetail pos={activePosition} />
        ) : null}
      </div>
    </div>
  );
}
