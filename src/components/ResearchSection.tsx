import { useState } from "react";
import { useHmmTrend } from "../hooks/useHmmTrend";
import type { AnalysisGranularity } from "../types";
import { API_BASE } from "../config";
import { GRANULARITY_CHOICES } from "../constants";
import { fmt } from "../utils/formatters";
import { HmmForecastTable, HmmTrendChart, regimeColor } from "./HmmTrendChart";
import { Banner, CardLabel, LoadingState, ToggleButton } from "./ui";

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
        <CardLabel marginBottom={0}>HMM TREND FORECAST</CardLabel>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {GRANULARITY_CHOICES.map((g) => (
            <ToggleButton
              key={g.value}
              active={granularity === g.value}
              onClick={() => setGranularity(g.value)}
              title={g.title}
            >
              {g.label}
            </ToggleButton>
          ))}
          <ToggleButton active={false} onClick={refresh} disabled={loading} title="Refit HMM">
            {loading ? "…" : "↻"}
          </ToggleButton>
        </div>
      </div>

      {error && (
        <Banner
          tone="error"
          marginBottom={12}
          hint={`Is the analysis backend running on ${API_BASE}?`}
        >
          ✗ {error}
        </Banner>
      )}

      {loading && !data && (
        <LoadingState label={`FITTING HMM · ${symbol}...`} padding={40} spinner={false} />
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
              <CardLabel marginBottom={6}>TRANSITION MATRIX</CardLabel>
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
      <div style={{ fontSize: 12, fontFamily: "monospace", color }}>{fmt.pctFromRatio(prob)}</div>
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
                  {fmt.pctFromRatio(p)}
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
