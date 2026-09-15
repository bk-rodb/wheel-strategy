import { useMemo } from "react";
import type { AccountInfo, WheelPosition } from "../types";
import type { BalanceActivity } from "../api/fetchAccountActivities";
import { sumOptionPremiumCollected } from "../api/fetchAccountActivities";
import { fmt, dayChange, dte, fmtShortDateTime } from "../utils/formatters";
import { PositionCard } from "./PositionCard";
import { RetrospectivePanel } from "./RetrospectivePanel";
import { useOpenBlotterOrders } from "../hooks/useOpenBlotterOrders";
import type { BlotterOrder, DeskOrderState } from "../store/orderBlotter";
import { alpha, vars } from "../theme";

interface SummaryDashboardProps {
  positions: WheelPosition[];
  account: AccountInfo | null;
  activities: BalanceActivity[];
  activitiesLoading?: boolean;
  onSelectTicker: (id: string) => void;
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

function computeMetrics(
  positions: WheelPosition[],
  account: AccountInfo | null,
  activities: BalanceActivity[],
) {
  const positionDeployed = positions.reduce((s, p) => s + p.cashDeployed, 0);
  const positionUnrealized = positions.reduce((s, p) => s + p.unrealizedPnL, 0);
  const positionPremium = positions.reduce((s, p) => s + p.premiumCollectedTotal, 0);
  const positionDayChange = positions.reduce((s, p) => s + dayChange(p) * p.shares, 0);

  const activityPremium = sumOptionPremiumCollected(activities);

  return {
    cashDeployed: positionDeployed || account?.costBasis || account?.longMarketValue || 0,
    unrealizedPnL: positionUnrealized || account?.unrealizedPnL || 0,
    premiumCollected: Math.max(positionPremium, activityPremium),
    dayChange: account?.dayPnL ?? positionDayChange,
  };
}

function withRunningBalances(
  activities: BalanceActivity[],
  currentBalance: number,
): Array<BalanceActivity & { balanceAfter: number }> {
  let balance = currentBalance;
  return activities.map((activity) => {
    const row = { ...activity, balanceAfter: balance };
    balance -= activity.amount;
    return row;
  });
}

export function SummaryDashboard({
  positions,
  account,
  activities,
  activitiesLoading,
  onSelectTicker,
  onSelectPendingOrder,
}: SummaryDashboardProps) {
  const pendingOrders = useOpenBlotterOrders();
  const totals = useMemo(
    () => computeMetrics(positions, account, activities),
    [positions, account, activities],
  );
  const ledger = useMemo(
    () =>
      account
        ? withRunningBalances(activities, account.equity)
        : withRunningBalances(activities, 0),
    [account, activities],
  );
  const expiringSoon = useMemo(
    () =>
      positions
        .filter((p) => p.activeOption && dte(p.activeOption.expiration) <= 14)
        .sort((a, b) => dte(a.activeOption!.expiration) - dte(b.activeOption!.expiration)),
    [positions],
  );
  const metrics = useMemo(
    () => [
      { label: "Cash Deployed", value: fmt.currency(totals.cashDeployed), accent: false },
      {
        label: "Unrealized P&L",
        value: fmt.currency(totals.unrealizedPnL),
        accent: totals.unrealizedPnL >= 0,
        color: totals.unrealizedPnL >= 0 ? vars.status.gain : vars.status.loss,
      },
      { label: "Premium Collected", value: fmt.currency(totals.premiumCollected), accent: true },
      {
        label: "Day Change",
        value: fmt.currency(totals.dayChange),
        accent: totals.dayChange >= 0,
        color: totals.dayChange >= 0 ? vars.status.gain : vars.status.loss,
      },
    ],
    [totals],
  );

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
              background: vars.bg.card,
              border: `1px solid ${vars.border.default}`,
              borderRadius: 6,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: vars.text.dim,
                fontFamily: vars.font.mono,
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontSize: 16,
                fontFamily: vars.font.mono,
                fontWeight: 700,
                color: m.color ?? (m.accent ? vars.status.gain : vars.text.primary),
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <RetrospectivePanel />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1fr) minmax(0, 1.4fr)",
          gap: 16,
          marginBottom: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: vars.bg.card,
            border: `1px solid ${vars.border.default}`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${vars.border.subtle}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: vars.text.tertiary,
                fontFamily: vars.font.mono,
                letterSpacing: "0.08em",
                fontWeight: 700,
              }}
            >
              ACCOUNT ACTIVITY
            </div>
            {account && (
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 8,
                    color: vars.text.dim,
                    fontFamily: vars.font.mono,
                    letterSpacing: "0.08em",
                  }}
                >
                  CURRENT BALANCE
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontFamily: vars.font.mono,
                    fontWeight: 700,
                    color: vars.text.strong,
                  }}
                >
                  {fmt.currency(account.equity)}
                </div>
              </div>
            )}
          </div>

          {activitiesLoading && ledger.length === 0 ? (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                fontSize: 10,
                fontFamily: vars.font.mono,
                color: vars.text.faint,
              }}
            >
              LOADING ACTIVITY...
            </div>
          ) : ledger.length === 0 ? (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                fontSize: 10,
                fontFamily: vars.font.mono,
                color: vars.text.faint,
                lineHeight: 1.8,
              }}
            >
              NO RECENT ACTIVITY
              <br />
              <span style={{ fontSize: 9 }}>FILLS, DIVIDENDS, AND CASH MOVES APPEAR HERE</span>
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {ledger.map((row) => {
                const positive = row.amount >= 0;
                const amountColor = positive ? vars.status.gain : vars.status.loss;
                const sign = positive ? "+" : "−";
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 14px",
                      borderBottom: `1px solid ${vars.bg.overlay}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: vars.font.mono,
                          fontSize: 11,
                          color: vars.text.strong,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.label}
                      </div>
                      <div
                        style={{
                          fontFamily: vars.font.mono,
                          fontSize: 9,
                          color: vars.text.dim,
                          marginTop: 2,
                        }}
                      >
                        {fmtShortDateTime(row.timestamp)}
                        {row.activityType !== "FILL" && (
                          <span style={{ marginLeft: 8, color: vars.text.faint }}>
                            {row.activityType}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: vars.font.mono,
                        fontSize: 12,
                        fontWeight: 700,
                        color: amountColor,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sign}
                      {fmt.currency(Math.abs(row.amount))}
                    </div>
                    <div
                      style={{
                        fontFamily: vars.font.mono,
                        fontSize: 11,
                        color: vars.text.muted,
                        textAlign: "right",
                        minWidth: 88,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmt.currency(row.balanceAfter)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {ledger.length > 0 && (
            <div
              style={{
                padding: "8px 14px",
                borderTop: `1px solid ${vars.border.subtle}`,
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                fontSize: 8,
                fontFamily: vars.font.mono,
                color: vars.text.faint,
                letterSpacing: "0.06em",
              }}
            >
              <span>DESCRIPTION</span>
              <span style={{ textAlign: "right" }}>CHANGE</span>
              <span style={{ textAlign: "right", minWidth: 88 }}>BALANCE</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {pendingOrders.length > 0 && (
            <div
              style={{
                background: vars.bg.card,
                border: `1px solid ${vars.border.emphasis}`,
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: vars.status.highlight,
                  fontFamily: vars.font.mono,
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
                  const sideColor = o.side === "buy" ? vars.status.info : vars.status.warning;
                  return (
                    <button
                      key={o.clientOrderId}
                      type="button"
                      onClick={() => goPending(o)}
                      title={`Open ${o.underlying} · focus Open Options`}
                      style={{
                        background: vars.bg.raised,
                        border: `1px solid ${vars.border.strong}`,
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
                        (e.currentTarget as HTMLButtonElement).style.borderColor = alpha(vars.status.highlight, 0.376);
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = vars.border.strong;
                      }}
                    >
                      <span
                        style={{
                          fontFamily: vars.font.mono,
                          fontWeight: 800,
                          fontSize: 13,
                          color: vars.text.strong,
                        }}
                      >
                        {o.underlying}
                      </span>
                      <span
                        style={{
                          fontFamily: vars.font.mono,
                          fontSize: 11,
                          color: vars.text.tertiary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.symbol || "—"}
                      </span>
                      <span
                        style={{
                          fontFamily: vars.font.mono,
                          fontSize: 11,
                          fontWeight: 700,
                          color: sideColor,
                        }}
                      >
                        {(o.side || "?").toUpperCase()} {o.qty || "?"}
                      </span>
                      <span style={{ fontFamily: vars.font.mono, fontSize: 11, color: vars.text.primary }}>
                        {o.limitPrice ? `@ $${o.limitPrice}` : "MKT"}
                      </span>
                      <span
                        style={{
                          fontFamily: vars.font.mono,
                          fontSize: 10,
                          fontWeight: 700,
                          color: vars.status.highlight,
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
            </div>
          )}

          {expiringSoon.length > 0 && (
            <div
              style={{
                background: vars.tint.warningSurface,
                border: `1px solid ${vars.tint.warningBorder}`,
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: vars.status.warning,
                  fontFamily: vars.font.mono,
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                ⚠ EXPIRING WITHIN 14 DAYS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {expiringSoon.map((p) => {
                  const d = dte(p.activeOption!.expiration);
                  const c = d <= 7 ? vars.status.danger : vars.status.warning;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectTicker(p.id)}
                      style={{
                        background: alpha(c, 0.063),
                        border: `1px solid ${alpha(c, 0.314)}`,
                        borderRadius: 4,
                        padding: "4px 10px",
                        cursor: "pointer",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontFamily: vars.font.mono, fontWeight: 700, fontSize: 12, color: c }}>
                        {p.ticker}
                      </span>
                      <span style={{ fontFamily: vars.font.mono, fontSize: 10, color: vars.tint.warningHint }}>
                        {d}d · {p.activeOption!.type.toUpperCase()} {fmt.currency(p.activeOption!.strike)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {positions.length === 0 && (
            <div
              style={{
                background: vars.bg.card,
                border: `1px solid ${vars.border.default}`,
                borderRadius: 6,
                padding: 24,
                textAlign: "center",
                fontFamily: vars.font.mono,
                color: vars.text.faint,
                fontSize: 10,
                lineHeight: 1.8,
              }}
            >
              NO WHEEL POSITIONS
              <br />
              <span style={{ fontSize: 9 }}>OPEN A TICKER FROM THE WATCHLIST TO RESEARCH STRIKES</span>
            </div>
          )}
        </div>
      </div>

      {positions.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {positions.map((pos) => (
            <PositionCard key={pos.id} position={pos} onSelect={onSelectTicker} />
          ))}
        </div>
      )}
    </div>
  );
}
