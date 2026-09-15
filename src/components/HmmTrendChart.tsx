import { useMemo, useState } from "react";
import type { HmmTrendResult } from "../types";
import { fmt } from "../utils/formatters";
import { alpha, vars } from "../theme";

const STATE_COLORS = {
  bear: vars.status.loss,
  neutral: vars.status.neutral,
  bull: vars.status.gain,
} as const;

const STATE_KEYS = ["bear", "neutral", "bull"] as const;
const STATE_LABELS = ["BEAR", "NEUT", "BULL"] as const;
/** Single-letter glyphs so the regime ribbon is not colour-only (L-31). */
const STATE_GLYPH: Record<(typeof STATE_KEYS)[number], string> = {
  bear: "B",
  neutral: "N",
  bull: "U",
};

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
      <div style={{ fontSize: 11, color: vars.text.faint, fontFamily: vars.font.mono, textAlign: "center", padding: 24 }}>
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
        <div style={{ fontSize: 9, color: vars.text.dim, fontFamily: vars.font.mono, letterSpacing: "0.06em" }}>
          DOMINANT REGIME
        </div>
        {hovered && (
          <div style={{ fontSize: 9, fontFamily: vars.font.mono, color: vars.text.tertiary }}>
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

      {/* Dominant-regime ribbon — colour + letter glyph + keyboard focus */}
      <div
        role="listbox"
        aria-label="Dominant regime history"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setHoverIdx((i) => Math.max(0, (i ?? history.length - 1) - 1));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setHoverIdx((i) => Math.min(history.length - 1, (i ?? history.length - 1) + 1));
          } else if (e.key === "Home") {
            e.preventDefault();
            setHoverIdx(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setHoverIdx(history.length - 1);
          }
        }}
        style={{
          display: "flex",
          gap: 1,
          height: 18,
          marginBottom: 10,
          borderRadius: 3,
          overflow: "hidden",
          outline: "none",
        }}
      >
        {history.map((snap, i) => {
          const key = snap.dominantState as (typeof STATE_KEYS)[number];
          const color = regimeColor(snap.dominantState);
          const confidence = maxProb(snap.stateProbs);
          const active = hoverIdx === null || hoverIdx === i;
          const glyph = STATE_GLYPH[key] ?? "?";
          return (
            <div
              key={snap.date}
              role="option"
              aria-selected={hoverIdx === i}
              title={`${snap.date} · ${snap.dominantState}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                flex: 1,
                minWidth: 0,
                background: color,
                opacity: active ? 0.35 + confidence * 0.65 : 0.18,
                outline: hoverIdx === i ? `1px solid ${color}` : "none",
                outlineOffset: -1,
                transition: "opacity 0.1s",
                cursor: "crosshair",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                fontFamily: vars.font.mono,
                fontWeight: 800,
                color: vars.text.onStatus,
                letterSpacing: 0,
              }}
            >
              {history.length <= 40 ? glyph : ""}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: vars.text.dim, fontFamily: vars.font.mono, letterSpacing: "0.06em", marginBottom: 6 }}>
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
                fontFamily: vars.font.mono,
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
                      background: alpha(color, active ? 0.08 + prob * 0.92 : 0.04 + prob * 0.35),
                      boxShadow: hoverIdx === i ? `inset 0 0 0 1px ${alpha(color, 0.55)}` : "none",
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
                  fontFamily: vars.font.mono,
                  color: ticks.includes(i) ? vars.text.dim : "transparent",
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
            background: vars.bg.sunken,
            border: `1px solid ${vars.border.default}`,
            borderRadius: 4,
          }}
        >
          {STATE_KEYS.map((key, i) => (
            <div key={key} style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: vars.text.dim, fontFamily: vars.font.mono, marginBottom: 2 }}>
                {STATE_LABELS[i]}
              </div>
              <div style={{ fontSize: 12, fontFamily: vars.font.mono, fontWeight: 700, color: STATE_COLORS[key] }}>
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
  color: vars.text.dim,
  fontFamily: vars.font.mono,
  letterSpacing: "0.06em",
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: `1px solid ${vars.border.default}`,
};

const tdStyle: React.CSSProperties = {
  fontSize: 11,
  color: vars.text.primary,
  fontFamily: vars.font.mono,
  padding: "6px 8px",
  borderBottom: `1px solid ${vars.border.subtle}`,
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
            <td style={{ ...tdStyle, color: row.expectedReturnPct >= 0 ? vars.status.gain : vars.status.loss }}>
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
  return vars.text.muted;
}
