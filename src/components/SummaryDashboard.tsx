import type { WheelPosition } from "../types";
import { fmt, dayChange, dayChangePct, dte } from "../utils/formatters";
import { PHASE_CONFIG, SOURCE_BADGE } from "../constants";
import { WheelPhaseIndicator } from "./WheelPhaseIndicator";
import { Sparkline } from "./Sparkline";
import { useOpenBlotterOrders } from "../hooks/useOpenBlotterOrders";
import type { BlotterOrder, DeskOrderState } from "../store/orderBlotter";

interface SummaryDashboardProps {
  positions: WheelPosition[];
  onSelectTicker: (id: string) => void;
  /** Navigate to ticker and focus Open Options (pending order click). */
  onSelectPendingOrder?: (underlying: string) => void;
}

const DESK_STATE_LABEL: Partial<Record<DeskOrderState, string>> = {
  submitting: "SUBMITTING",
  orphan_check: "RECONCILING",
  ack_pending: "AWAITING ACK",
  working: "WORKING",
  cancel_requested: "CANCEL REQ",
  cancel_pending: "CANCELING",
};

export function SummaryDashboard({
  positions,
  onSelectTicker,
  onSelectPendingOrder,
}: SummaryDashboardProps) {
  const pendingOrders = useOpenBlotterOrders();
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

  const goPending = (o: BlotterOrder) => {
    const u = o.underlying.toUpperCase();
    if (onSelectPendingOrder) onSelectPendingOrder(u);
    else onSelectTicker(u);
  };

  return (
    <div>
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

      {pendingOrders.length > 0 && (
        <div
          style={{
            background: "#08081a",
            border: "1px solid #2a2040",
            borderRadius: 6,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#a78bfa",
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              marginBottom: 10,
              fontWeight: 700,
            }}
          >
            PENDING ORDERS · {pendingOrders.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingOrders.map((o) => {
              const stateLabel = DESK_STATE_LABEL[o.deskState] ?? o.deskState.toUpperCase();
              const sideColor = o.side === "buy" ? "#60a5fa" : "#f59e0b";
              return (
                <button
                  key={o.clientOrderId}
                  type="button"
                  onClick={() => goPending(o)}
                  title={`Open ${o.underlying} · focus Open Options`}
                  style={{
                    background: "#0c0c1c",
                    border: "1px solid #1e1e38",
                    borderRadius: 4,
                    padding: "10px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "grid",
                    gridTemplateColumns: "0.7fr 1.4fr 0.6fr 0.9fr 1fr",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#a78bfa60";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e1e38";
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: 13,
                      color: "#e8e8f8",
                    }}
                  >
                    {o.underlying}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "#8a8aa8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o.symbol || "—"}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sideColor,
                    }}
                  >
                    {(o.side || "?").toUpperCase()} {o.qty || "?"}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#c0c0e0" }}>
                    {o.limitPrice ? `@ $${o.limitPrice}` : "MKT"}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#a78bfa",
                      letterSpacing: "0.04em",
                      textAlign: "right",
                    }}
                  >
                    {stateLabel} →
                  </span>
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 8,
              fontFamily: "monospace",
              color: "#3a3a5a",
            }}
          >
            Click a row to open the ticker tab and focus Open Options
          </div>
        </div>
      )}

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

                <div style={{ height: 48, marginBottom: 10 }}>
                  <Sparkline data={pos.priceHistory} color={phaseCfg.color} />
                </div>

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
