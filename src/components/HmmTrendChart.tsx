import { useMemo, useState } from "react";
import type { HmmTrendResult } from "../types";
import { fmt } from "../utils/formatters";

const STATE_COLORS = {
  bear: "#f87171",
  neutral: "#94a3b8",
  bull: "#34d399",
} as const;

const STATE_KEYS = ["bear", "neutral", "bull"] as const;
const STATE_LABELS = ["BEAR", "NEUT", "BULL"] as const;

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function maxProb(probs: readonly number[]): number {
  return Math.max(...probs);
}

function tickIndexes(length: number, count = 5): number[] {
  if (length <= 1) return [0];
  const slots = Math.min(count, length);
  return Array.from({ length: slots }, (_, i) => Math.round((i * (length - 1)) / (slots - 1)));
}

export function HmmTrendChart({ data }: { data: HmmTrendResult }) {
  const history = useMemo(() => data.history.slice(-52), [data.history]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div style={{ fontSize: 11, color: "#3a3a5a", fontFamily: "monospace", textAlign: "center", padding: 24 }}>
        NO REGIME HISTORY
      </div>
    );
  }

  const ticks = tickIndexes(history.length);
  const hovered = hoverIdx !== null ? history[hoverIdx] : history[history.length - 1];

  return (
    <div style={{ userSelect: "none" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          minHeight: 18,
        }}
      >
        <div style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "monospace", letterSpacing: "0.06em" }}>
          DOMINANT REGIME
        </div>
        {hovered && (
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "#8a8aa8" }}>
            <span style={{ color: regimeColor(hovered.dominantState), fontWeight: 700 }}>
              {hovered.dominantState.toUpperCase()}
            </span>
            {" · "}
            {hovered.date}
            {" · "}
            {(maxProb(hovered.stateProbs) * 100).toFixed(0)}% conf.
          </div>
        )}
      </div>

      {/* Dominant-regime ribbon */}
      <div style={{ display: "flex", gap: 1, height: 18, marginBottom: 10, borderRadius: 3, overflow: "hidden" }}>
        {history.map((snap, i) => {
          const color = regimeColor(snap.dominantState);
          const confidence = maxProb(snap.stateProbs);
          const active = hoverIdx === null || hoverIdx === i;
          return (
            <div
              key={snap.date}
              title={`${snap.date} · ${snap.dominantState}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                flex: 1,
                background: color,
                opacity: active ? 0.35 + confidence * 0.65 : 0.18,
                outline: hoverIdx === i ? `1px solid ${color}` : "none",
                outlineOffset: -1,
                transition: "opacity 0.1s",
                cursor: "crosshair",
              }}
            />
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "monospace", letterSpacing: "0.06em", marginBottom: 6 }}>
        STATE PROBABILITIES
      </div>

      {/* Per-state probability heatmap */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 36, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, paddingTop: 1 }}>
          {STATE_LABELS.map((label, row) => (
            <div
              key={label}
              style={{
                height: 20,
                display: "flex",
                alignItems: "center",
                fontSize: 8,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: STATE_COLORS[STATE_KEYS[row]],
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {STATE_KEYS.map((key, row) => (
            <div key={key} style={{ display: "flex", gap: 1, height: 20, marginBottom: row < 2 ? 2 : 0 }}>
              {history.map((snap, i) => {
                const prob = snap.stateProbs[row] ?? 0;
                const color = STATE_COLORS[key];
                const active = hoverIdx === null || hoverIdx === i;
                return (
                  <div
                    key={`${snap.date}-${key}`}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    style={{
                      flex: 1,
                      borderRadius: 1,
                      background: hexAlpha(color, active ? 0.08 + prob * 0.92 : 0.04 + prob * 0.35),
                      boxShadow: hoverIdx === i ? `inset 0 0 0 1px ${hexAlpha(color, 0.55)}` : "none",
                      cursor: "crosshair",
                    }}
                  />
                );
              })}
            </div>
          ))}

          <div style={{ display: "flex", marginTop: 6 }}>
            {history.map((snap, i) => (
              <div
                key={`tick-${snap.date}`}
                style={{
                  flex: 1,
                  fontSize: 8,
                  fontFamily: "monospace",
                  color: ticks.includes(i) ? "#4a4a6a" : "transparent",
                  textAlign: i === 0 ? "left" : i === history.length - 1 ? "right" : "center",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {snap.date.slice(5)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hover detail strip */}
      {hovered && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 10,
            padding: "8px 10px",
            background: "#0a0a18",
            border: "1px solid #1a1a30",
            borderRadius: 4,
          }}
        >
          {STATE_KEYS.map((key, i) => (
            <div key={key} style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "#4a4a6a", fontFamily: "monospace", marginBottom: 2 }}>
                {STATE_LABELS[i]}
              </div>
              <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: STATE_COLORS[key] }}>
                {(hovered.stateProbs[i] * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 9,
  color: "#4a4a6a",
  fontFamily: "monospace",
  letterSpacing: "0.06em",
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid #1a1a30",
};

const tdStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#c8c8e0",
  fontFamily: "monospace",
  padding: "6px 8px",
  borderBottom: "1px solid #12122a",
};

export function HmmForecastTable({ data }: { data: HmmTrendResult }) {
  if (data.forecast.length === 0) return null;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
      <thead>
        <tr>
          <th style={thStyle}>HORIZON</th>
          <th style={thStyle}>EXP. RETURN</th>
          <th style={{ ...thStyle, color: STATE_COLORS.bear }}>BEAR</th>
          <th style={{ ...thStyle, color: STATE_COLORS.neutral }}>NEUTRAL</th>
          <th style={{ ...thStyle, color: STATE_COLORS.bull }}>BULL</th>
        </tr>
      </thead>
      <tbody>
        {data.forecast.map((row) => (
          <tr key={row.days}>
            <td style={tdStyle}>{row.days}d</td>
            <td style={{ ...tdStyle, color: row.expectedReturnPct >= 0 ? "#34d399" : "#f87171" }}>
              {fmt.pct(row.expectedReturnPct)}
            </td>
            <td style={tdStyle}>{fmt.pctFromRatio(row.bearProb)}</td>
            <td style={tdStyle}>{fmt.pctFromRatio(row.stateProbs[1])}</td>
            <td style={tdStyle}>{fmt.pctFromRatio(row.bullProb)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function regimeColor(regime: string): string {
  if (regime === "bear") return STATE_COLORS.bear;
  if (regime === "bull") return STATE_COLORS.bull;
  if (regime === "neutral") return STATE_COLORS.neutral;
  return "#6a6a8a";
}
