import type { TrendChip, TrendChipTone } from "../utils/trendMetrics";
import { alpha, vars } from "../theme";

const TONE_COLOR: Record<TrendChipTone, string> = {
  positive: vars.status.gain,
  negative: vars.status.loss,
  neutral: vars.text.tertiary,
  warning: vars.status.warning,
};

const TONE_BG: Record<TrendChipTone, string> = {
  positive: vars.tint.gainSurface,
  negative: vars.tint.lossSurface,
  neutral: vars.border.subtle,
  warning: vars.tint.warningSurface,
};

export function TrendSnapshotChips({ chips }: { chips: TrendChip[] }) {
  if (chips.length === 0) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${vars.border.subtle}` }}>
      <div
        style={{
          fontSize: 9,
          color: vars.text.dim,
          fontFamily: vars.font.mono,
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        TREND SNAPSHOT
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {chips.map((chip) => (
          <div
            key={chip.label}
            title={chip.hint}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "6px 10px",
              borderRadius: 4,
              border: `1px solid ${alpha(TONE_COLOR[chip.tone], 0.2)}`,
              background: TONE_BG[chip.tone],
              minWidth: 72,
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: vars.text.subtle,
                fontFamily: vars.font.mono,
                letterSpacing: "0.06em",
              }}
            >
              {chip.label.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: vars.font.mono,
                fontWeight: 700,
                color: TONE_COLOR[chip.tone],
              }}
            >
              {chip.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
