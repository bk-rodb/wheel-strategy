import { useVolatilityMetrics } from "../hooks/useVolatilityMetrics";
import { vars } from "../theme";

export function VolatilityBar({ symbol }: { symbol: string }) {
  const { realizedVol, impliedVol, vrp, loading, error } = useVolatilityMetrics(symbol);

  if (loading && realizedVol == null && impliedVol == null) {
    return (
      <div style={{ fontSize: 10, color: vars.text.faint, fontFamily: vars.font.mono, padding: "4px 0" }}>
        Loading volatility…
      </div>
    );
  }

  if (realizedVol == null && impliedVol == null) {
    if (error) return null;
    return null;
  }

  const rvPct = realizedVol != null ? (realizedVol * 100).toFixed(1) : "—";
  const ivPct = impliedVol != null ? (impliedVol * 100).toFixed(1) : "—";
  const vrpPct =
    vrp != null ? `${vrp >= 0 ? "+" : ""}${(vrp * 100).toFixed(1)}%` : "—";
  const vrpColor =
    vrp == null ? vars.text.tertiary : vrp >= 0.05 ? vars.status.gain : vrp <= -0.05 ? vars.status.loss : vars.text.tertiary;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: "8px 0 4px",
        borderTop: `1px solid ${vars.border.subtle}`,
        marginTop: 8,
        fontSize: 10,
        fontFamily: vars.font.mono,
        color: vars.text.subtle,
      }}
    >
      <span style={{ letterSpacing: "0.08em", color: vars.text.dim }}>VOLATILITY</span>
      <span>
        RV <b style={{ color: vars.text.strong }}>{rvPct}%</b>
      </span>
      <span style={{ color: vars.text.ghost }}>·</span>
      <span>
        IV <b style={{ color: vars.text.strong }}>{ivPct}%</b>
      </span>
      <span style={{ color: vars.text.ghost }}>·</span>
      <span>
        VRP <b style={{ color: vrpColor }}>{vrpPct}</b>
      </span>
    </div>
  );
}
