import type { TrendChip, TrendChipTone } from "../utils/trendMetrics";

const TONE_COLOR: Record<TrendChipTone, string> = {
  positive: "#34d399",
  negative: "#f87171",
  neutral: "#8a8aa8",
  warning: "#f59e0b",
};

const TONE_BG: Record<TrendChipTone, string> = {
  positive: "#0a1a14",
  negative: "#1a0a0a",
  neutral: "#12122a",
  warning: "#1a1408",
};

export function TrendSnapshotChips({ chips }: { chips: TrendChip[] }) {
  if (chips.length === 0) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #141428" }}>
      <div
        style={{
          fontSize: 9,
          color: "#4a4a6a",
          fontFamily: "monospace",
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
              border: `1px solid ${TONE_COLOR[chip.tone]}33`,
              background: TONE_BG[chip.tone],
              minWidth: 72,
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: "#5a5a7a",
                fontFamily: "monospace",
                letterSpacing: "0.06em",
              }}
            >
              {chip.label.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "monospace",
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
