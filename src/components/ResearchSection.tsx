import { useState } from "react";
import { useHmmTrend } from "../hooks/useHmmTrend";
import type { AnalysisGranularity } from "../types";
import { API_BASE } from "../config";
import { fmt } from "../utils/formatters";
import { HmmForecastTable, HmmTrendChart, regimeColor } from "./HmmTrendChart";

const cardLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#4a4a6a",
  fontFamily: "monospace",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const GRANULARITY_CHOICES: { value: AnalysisGranularity; label: string }[] = [
  { value: "weekly", label: "WEEKLY" },
  { value: "daily", label: "DAILY" },
];

export function ResearchSection({ symbol }: { symbol: string }) {
  const [granularity, setGranularity] = useState<AnalysisGranularity>("weekly");
  const { data, loading, error, refresh } = useHmmTrend({ symbol, granularity });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={cardLabelStyle}>HMM TREND FORECAST</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {GRANULARITY_CHOICES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGranularity(g.value)}
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                padding: "3px 8px",
                borderRadius: 3,
                border: `1px solid ${granularity === g.value ? "#34d399" : "#2a2a3a"}`,
                background: granularity === g.value ? "#0a1a14" : "transparent",
                color: granularity === g.value ? "#34d399" : "#5a5a7a",
                cursor: "pointer",
              }}
            >
              {g.label}
            </button>
          ))}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              padding: "3px 8px",
              borderRadius: 3,
              border: "1px solid #2a2a3a",
              background: "transparent",
              color: "#5a5a7a",
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

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
            marginBottom: 12,
          }}
        >
          ✗ {error}
          <div style={{ color: "#7a4a4a", fontSize: 10, marginTop: 6 }}>
            Is the analysis backend running on {API_BASE}?
          </div>
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: "center", padding: 40, color: "#2a2a4a", fontFamily: "monospace", fontSize: 12 }}>
          FITTING HMM · {symbol}...
        </div>
      )}

      {data && data.history.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <RegimeBadge label="CURRENT REGIME" regime={data.currentRegime} />
            <ProbPill label="BEAR" prob={data.currentStateProbs[0]} color="#f87171" />
            <ProbPill label="NEUTRAL" prob={data.currentStateProbs[1]} color="#94a3b8" />
            <ProbPill label="BULL" prob={data.currentStateProbs[2]} color="#34d399" />
          </div>

          <HmmTrendChart data={data} />

          <HmmForecastTable data={data} />

          {data.transitionMatrix.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...cardLabelStyle, marginBottom: 6 }}>TRANSITION MATRIX</div>
              <TransitionMatrix labels={data.stateLabels} matrix={data.transitionMatrix} />
            </div>
          )}

          {data.warnings.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 9, color: "#4a4a6a", fontFamily: "monospace", lineHeight: 1.5 }}>
              {data.warnings.map((w) => (
                <div key={w}>⚠ {w}</div>
              ))}
            </div>
          )}
        </>
      )}

      {data && data.history.length === 0 && !error && (
        <div style={{ fontSize: 11, color: "#3a3a5a", fontFamily: "monospace", textAlign: "center", padding: 24 }}>
          INSUFFICIENT HISTORY FOR HMM
        </div>
      )}
    </div>
  );
}

function RegimeBadge({ label, regime }: { label: string; regime: string }) {
  const color = regimeColor(regime);
  return (
    <div>
      <div style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "monospace", marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontFamily: "monospace",
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {regime}
      </div>
    </div>
  );
}

function ProbPill({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "monospace", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, fontFamily: "monospace", color }}>{fmt.pct(prob)}</div>
    </div>
  );
}

function TransitionMatrix({
  labels,
  matrix,
}: {
  labels: readonly string[];
  matrix: readonly (readonly number[])[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: 240 }}>
        <thead>
          <tr>
            <th style={thMini} />
            {labels.map((l) => (
              <th key={l} style={{ ...thMini, textTransform: "uppercase" }}>
                {l.slice(0, 4)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={labels[i]}>
              <td style={{ ...tdMini, textTransform: "uppercase", color: regimeColor(labels[i]) }}>{labels[i].slice(0, 4)}</td>
              {row.map((p, j) => (
                <td key={j} style={tdMini}>
                  {fmt.pct(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thMini: React.CSSProperties = {
  fontSize: 8,
  color: "#4a4a6a",
  fontFamily: "monospace",
  padding: "4px 10px",
  textAlign: "center",
};

const tdMini: React.CSSProperties = {
  fontSize: 10,
  color: "#a8a8c8",
  fontFamily: "monospace",
  padding: "4px 10px",
  textAlign: "center",
  borderTop: "1px solid #12122a",
};
