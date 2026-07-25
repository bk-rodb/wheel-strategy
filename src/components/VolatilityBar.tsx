import { useVolatilityMetrics } from "../hooks/useVolatilityMetrics";

export function VolatilityBar({ symbol }: { symbol: string }) {
  const { realizedVol, impliedVol, vrp, loading, error } = useVolatilityMetrics(symbol);

  if (loading && realizedVol == null && impliedVol == null) {
    return (
      <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "monospace", padding: "4px 0" }}>
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
    vrp == null ? "#8a8aa8" : vrp >= 0.05 ? "#34d399" : vrp <= -0.05 ? "#f87171" : "#8a8aa8";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: "8px 0 4px",
        borderTop: "1px solid #141428",
        marginTop: 8,
        fontSize: 10,
        fontFamily: "monospace",
        color: "#5a5a7a",
      }}
    >
      <span style={{ letterSpacing: "0.08em", color: "#4a4a6a" }}>VOLATILITY</span>
      <span>
        RV <b style={{ color: "#e8e8f8" }}>{rvPct}%</b>
      </span>
      <span style={{ color: "#2a2a4a" }}>·</span>
      <span>
        IV <b style={{ color: "#e8e8f8" }}>{ivPct}%</b>
      </span>
      <span style={{ color: "#2a2a4a" }}>·</span>
      <span>
        VRP <b style={{ color: vrpColor }}>{vrpPct}</b>
      </span>
    </div>
  );
}
