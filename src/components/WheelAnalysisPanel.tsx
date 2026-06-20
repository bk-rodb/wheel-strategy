import { useState } from "react";
import { useWheelAnalysis } from "../hooks/useWheelAnalysis";
import type { AnalysisGranularity, AnalysisLevel, StrikeSuggestion, WheelAnalysis } from "../types";
import { fmt } from "../utils/formatters";
import { API_BASE } from "../config";

const LEVEL_COLOR: Record<AnalysisLevel, string> = {
  safe: "#34d399",
  regular: "#d8d8f0",
  risky: "#f87171",
};

const DTE_CHOICES = [21, 30, 35, 45];

const GRANULARITY_CHOICES: { value: AnalysisGranularity; label: string; title: string }[] = [
  {
    value: "weekly",
    label: "WEEKLY",
    title: "Fewer, wider-spaced samples; default and faster to interpret.",
  },
  {
    value: "daily",
    label: "DAILY",
    title: "~5× more overlapping forward-return samples; empirical percentiles are sharper, but overlapping windows still widen confidence.",
  },
];

export function WheelAnalysisPanel({ symbol }: { symbol: string }) {
  const [dte, setDte] = useState(35);
  const [granularity, setGranularity] = useState<AnalysisGranularity>("weekly");
  const { data, loading, error, refresh } = useWheelAnalysis({ symbol, dte, granularity });

  return (
    <div style={{ padding: "0 4px" }}>
      <Header
        symbol={symbol}
        data={data}
        dte={dte}
        onDte={setDte}
        granularity={granularity}
        onGranularity={setGranularity}
        loading={loading}
        onRefresh={refresh}
      />

      {error && (
        <div
          style={{
            background: "#1a0808",
            border: "1px solid #4a1010",
            borderRadius: 6,
            padding: 12,
            fontSize: 12,
            color: "#f87171",
            fontFamily: "monospace",
            marginBottom: 16,
          }}
        >
          ✗ {error}
          <div style={{ color: "#7a4a4a", fontSize: 10, marginTop: 6 }}>
            Is the analysis backend running on {API_BASE}? (cd backend/WheelStrategy.Api && dotnet run)
          </div>
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: "center", padding: 60, color: "#2a2a4a", fontFamily: "monospace", fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>◌</div>
          ANALYZING {symbol} · {granularity}...
        </div>
      )}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <SideCard
              title="CASH-SECURED PUT"
              subtitle="sell put · want price to stay ABOVE strike"
              accent="#f59e0b"
              rows={data.put}
              spot={data.currentPrice}
            />
            <SideCard
              title="COVERED CALL"
              subtitle="sell call · want price to stay BELOW strike"
              accent="#34d399"
              rows={data.call}
              spot={data.currentPrice}
            />
          </div>

          {data.warnings.length > 0 && (
            <div style={{ marginTop: 16, fontSize: 9, fontFamily: "monospace", color: "#4a4a6a", lineHeight: 1.7 }}>
              {data.warnings.map((w, i) => (
                <div key={i}>· {w}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Header({
  symbol,
  data,
  dte,
  onDte,
  granularity,
  onGranularity,
  loading,
  onRefresh,
}: {
  symbol: string;
  data: WheelAnalysis | null;
  dte: number;
  onDte: (d: number) => void;
  granularity: AnalysisGranularity;
  onGranularity: (g: AnalysisGranularity) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 18,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4a4a6a", letterSpacing: "0.08em", fontWeight: 700 }}>
          WHEEL STRATEGY ANALYSIS · {symbol}
        </div>
        {data && (
          <>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#5a5a7a", marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>SPOT <b style={{ color: "#e8e8f8" }}>{fmt.currency(data.currentPrice)}</b></span>
              <span>IV(realized) <b style={{ color: "#e8e8f8" }}>{(data.realizedVolAnnual * 100).toFixed(1)}%</b></span>
              <span>HORIZON <b style={{ color: "#e8e8f8" }}>{data.horizonPeriods}× {data.granularity}</b></span>
              <span>LOOKBACK <b style={{ color: "#e8e8f8" }}>{(data.lookbackDays / 365).toFixed(1)}y</b></span>
              <span>SAMPLES <b style={{ color: "#e8e8f8" }}>{data.sampleCount}</b></span>
            </div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#4a4a6a", marginTop: 4, letterSpacing: "0.04em" }}>
              ~{data.sampleCount} overlapping windows ·{" "}
              {data.granularity === "daily" ? "tighter empirical percentiles" : "coarser tails"}
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "#4a4a6a", letterSpacing: "0.08em" }}>BARS</span>
          {GRANULARITY_CHOICES.map(({ value, label, title }) => (
            <button
              key={value}
              onClick={() => onGranularity(value)}
              title={title}
              style={toggleBtn(value === granularity)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "#4a4a6a", letterSpacing: "0.08em" }}>DTE</span>
          {DTE_CHOICES.map((d) => (
            <button
              key={d}
              onClick={() => onDte(d)}
              style={toggleBtn(d === dte)}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Re-pull bars from Alpaca"
          style={{
            cursor: loading ? "default" : "pointer",
            background: "#0d0d1e",
            border: "1px solid #1e1e38",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 11,
            fontFamily: "monospace",
            fontWeight: 700,
            color: loading ? "#3a3a5a" : "#8a8aa8",
            letterSpacing: "0.06em",
          }}
        >
          ↻ {loading ? "···" : "REFRESH"}
        </button>
      </div>
    </div>
  );
}

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    background: active ? "#34d39920" : "#0d0d1e",
    border: `1px solid ${active ? "#34d39950" : "#1e1e38"}`,
    borderRadius: 4,
    padding: "4px 9px",
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: 700,
    color: active ? "#34d399" : "#5a5a7a",
  };
}

function SideCard({
  title,
  subtitle,
  accent,
  rows,
  spot,
}: {
  title: string;
  subtitle: string;
  accent: string;
  rows: StrikeSuggestion[] | null;
  spot: number;
}) {
  return (
    <div style={{ background: "#08081a", border: "1px solid #16162e", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid #12122a" }}>
        <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: accent, letterSpacing: "0.06em" }}>
          {title}
        </div>
        <div style={{ fontSize: 9, fontFamily: "monospace", color: "#4a4a6a", marginTop: 3, letterSpacing: "0.04em" }}>
          {subtitle}
        </div>
      </div>

      {!rows || rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#3a3a5a" }}>
          INSUFFICIENT HISTORY
        </div>
      ) : (
        <div style={{ padding: "4px 0" }}>
          {/* column header */}
          <div style={gridRow(true)}>
            <span>LEVEL</span>
            <span style={{ textAlign: "right" }}>STRIKE</span>
            <span style={{ textAlign: "right" }}>% OTM</span>
            <span style={{ textAlign: "right" }}>ASSIGN (HIST/BS)</span>
            <span style={{ textAlign: "right" }}>PREM</span>
            <span style={{ textAlign: "right" }}>ANN YLD</span>
          </div>
          {rows.map((r) => (
            <div key={r.level} style={gridRow(false)}>
              <span style={{ color: LEVEL_COLOR[r.level], fontWeight: 700 }}>{r.level.toUpperCase()}</span>
              <span style={{ textAlign: "right", color: "#e8e8f8", fontWeight: 700 }}>{fmt.currency(r.strike)}</span>
              <span style={{ textAlign: "right", color: r.pctFromSpot >= 0 ? "#34d399" : "#f87171" }}>
                {(r.pctFromSpot * 100).toFixed(1)}%
              </span>
              <span style={{ textAlign: "right", color: "#a0a0c0" }}>
                {(r.empiricalAssignmentProb * 100).toFixed(0)}% / {(r.blackScholesAssignmentProb * 100).toFixed(0)}%
              </span>
              <span style={{ textAlign: "right", color: "#a0a0c0" }}>{fmt.currency(r.estPremium)}</span>
              <span style={{ textAlign: "right", color: "#34d399" }}>{(r.annualizedYield * 100).toFixed(1)}%</span>
            </div>
          ))}
          <div style={{ padding: "8px 14px 4px", fontSize: 8, fontFamily: "monospace", color: "#3a3a5a", letterSpacing: "0.04em" }}>
            spot {fmt.currency(spot)} · premium &amp; yield are Black-Scholes estimates (no IV skew)
          </div>
        </div>
      )}
    </div>
  );
}

function gridRow(isHeader: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "0.8fr 1fr 0.7fr 1.3fr 0.8fr 0.9fr",
    gap: 6,
    padding: isHeader ? "6px 14px" : "7px 14px",
    fontSize: isHeader ? 8 : 11,
    fontFamily: "monospace",
    color: isHeader ? "#3a3a5a" : "#c0c0e0",
    letterSpacing: isHeader ? "0.06em" : "0",
    borderBottom: isHeader ? "1px solid #12122a" : "1px solid #0c0c1c",
    alignItems: "center",
  };
}
