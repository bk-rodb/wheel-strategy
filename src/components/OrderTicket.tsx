import { useEffect, useState } from "react";
import type { OrderAction, PreTradeResult } from "../api/preTradeCheck";
import { fmt } from "../utils/formatters";
import { alpha, vars } from "../theme";

export interface OrderTicketProps {
  action: OrderAction;
  optionType: "call" | "put";
  contractSymbol: string;
  strike: number;
  expiration: string;
  qty: number;
  onQtyChange: (q: number) => void;
  maxQty: number;
  limitPrice: number;
  check: PreTradeResult;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  accent: string;
  simulate?: boolean;
}

export function OrderTicket({
  action,
  optionType,
  contractSymbol,
  strike,
  expiration,
  qty,
  onQtyChange,
  maxQty,
  limitPrice,
  check,
  busy,
  onConfirm,
  onCancel,
  accent,
  simulate,
}: OrderTicketProps) {
  const [acked, setAcked] = useState(false);
  const actionLabel = action === "sell_to_open" ? "SELL TO OPEN" : "BUY TO CLOSE";
  const cashLabel = check.estCashFlow >= 0 ? "EST. CREDIT" : "EST. DEBIT";
  const canSubmit = check.ok && acked && !busy;

  useEffect(() => {
    setAcked(false);
  }, [qty, limitPrice, contractSymbol]);

  return (
    <div
      style={{
        background: vars.bg.raised,
        border: `1px solid ${alpha(accent, 0.251)}`,
        borderRadius: 6,
        padding: 14,
        margin: "0 0 10px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: vars.font.mono,
          color: accent,
          fontWeight: 800,
          letterSpacing: "0.1em",
          marginBottom: 10,
        }}
      >
        ORDER TICKET · {actionLabel}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 16px",
          fontSize: 11,
          fontFamily: vars.font.mono,
          color: vars.text.primary,
          marginBottom: 12,
        }}
      >
        <Row label="CONTRACT" value={contractSymbol} />
        <Row label="TYPE" value={`${optionType.toUpperCase()} · ${expiration}`} />
        <Row label="STRIKE" value={fmt.currency(strike)} />
        <Row label="LIMIT" value={fmt.currency(limitPrice)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: vars.text.dim, fontSize: 9, letterSpacing: "0.06em" }}>QTY</span>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            disabled={busy}
            onChange={(e) =>
              onQtyChange(
                Math.min(maxQty, Math.max(1, parseInt(e.target.value, 10) || 1)),
              )
            }
            style={{
              width: 56,
              background: vars.bg.card,
              border: `1px solid ${vars.border.emphasis}`,
              borderRadius: 3,
              color: vars.text.strong,
              fontFamily: vars.font.mono,
              fontSize: 12,
              padding: "3px 6px",
            }}
          />
          <span style={{ color: vars.text.faint, fontSize: 9 }}>max {maxQty}</span>
        </div>
        <Row
          label={cashLabel}
          value={fmt.currency(Math.abs(check.estCashFlow))}
          valueColor={check.estCashFlow >= 0 ? vars.status.gain : vars.status.loss}
        />
        {check.collateralRequired > 0 && (
          <Row label="COLLATERAL" value={fmt.currency(check.collateralRequired)} />
        )}
        {check.sharesLocked > 0 && (
          <Row label="SHARES LOCKED" value={String(check.sharesLocked)} />
        )}
        {action === "sell_to_open" && (
          <Row
            label="ASSIGN EXPOSURE"
            value={`${qty * 100} sh @ ${fmt.currency(strike)}`}
          />
        )}
      </div>

      {check.blockers.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {check.blockers.map((b, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                fontFamily: vars.font.mono,
                color: vars.status.loss,
                marginBottom: 2,
              }}
            >
              ✗ {b}
            </div>
          ))}
        </div>
      )}

      {check.warnings.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {check.warnings.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                fontFamily: vars.font.mono,
                color: vars.status.warning,
                marginBottom: 2,
              }}
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          fontFamily: vars.font.mono,
          color: vars.text.tertiary,
          marginBottom: 12,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={acked}
          disabled={busy}
          onChange={(e) => setAcked(e.target.checked)}
        />
        I acknowledge the terms, risk, and collateral above
      </label>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={btnStyle(vars.text.subtle, "transparent", vars.border.emphasis)}
        >
          DISMISS
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onConfirm}
          style={{
            ...btnStyle(
              canSubmit ? vars.tint.gainSurface : vars.text.faint,
              canSubmit ? accent : vars.border.default,
              "transparent",
            ),
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? "pointer" : "default",
          }}
        >
          {busy ? "SUBMITTING…" : simulate ? "SIMULATE ORDER" : "CONFIRM ORDER"}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: vars.text.dim, fontSize: 9, letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ color: valueColor ?? vars.text.strong, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function btnStyle(color: string, bg: string, border: string): React.CSSProperties {
  return {
    cursor: "pointer",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 3,
    padding: "6px 14px",
    fontSize: 10,
    fontFamily: vars.font.mono,
    fontWeight: 800,
    color,
    letterSpacing: "0.06em",
  };
}
