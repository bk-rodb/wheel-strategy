import type { WheelPosition } from "../types";
import { fmt, dayChange, dayChangePct, dte } from "../utils/formatters";
import { PHASE_CONFIG, SOURCE_BADGE } from "../constants";
import { WheelPhaseIndicator } from "./WheelPhaseIndicator";
import { Sparkline } from "./Sparkline";

interface SummaryDashboardProps {
  positions: WheelPosition[];
  onSelectTicker: (id: string) => void;
}

export function SummaryDashboard({ positions, onSelectTicker }: SummaryDashboardProps) {
  const totalDeployed = positions.reduce((s, p) => s + p.cashDeployed, 0);
  const totalUnrealized = positions.reduce((s, p) => s + p.unrealizedPnL, 0);
  const totalPremium = positions.reduce((s, p) => s + p.premiumCollectedTotal, 0);
  const totalDayChange = positions.reduce((s, p) => s + dayChange(p) * p.shares, 0);

  const expiringSoon = positions
    .filter((p) => p.activeOption && dte(p.activeOption.expiration) <= 14)
    .sort((a, b) => dte(a.activeOption!.expiration) - dte(b.activeOption!.expiration));

  const metrics = [
    { label: "Cash Deployed", value: fmt.currency(totalDeployed), accent: false },
    { label: "Unrealized P&L", value: fmt.currency(totalUnrealized), accent: totalUnrealized >= 0 },
    { label: "Premium Collected", value: fmt.currency(totalPremium), accent: true },
    { label: "Day Change", value: fmt.currency(totalDayChange), accent: totalDayChange >= 0 },
  ];

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
        {metrics.map((m) => (
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
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: c }}>
                    {p.ticker}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#8a6020" }}>
                    {d}d · {p.activeOption!.type.toUpperCase()} {fmt.currency(p.activeOption!.strike)}
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
                (e.currentTarget as HTMLButtonElement).style.borderColor = phaseCfg.color + "60";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a1a30";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              <div style={{ height: 2, background: phaseCfg.color, opacity: 0.7 }} />
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
                    <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "monospace" }}>
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
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: chgColor }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "#3a3a5a", fontFamily: "monospace" }}>
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
                    <div style={{ fontSize: 9, color: "#3a3a5a", fontFamily: "monospace" }}>
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
                        <div style={{ fontSize: 9, color: "#3a3a5a", fontFamily: "monospace" }}>
                          STRIKE
                        </div>
                        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#c0c0e0" }}>
                          {fmt.currency(pos.activeOption.strike)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "#3a3a5a", fontFamily: "monospace" }}>
                          DTE
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: dte(pos.activeOption.expiration) <= 7 ? "#ef4444" : "#c0c0e0",
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
