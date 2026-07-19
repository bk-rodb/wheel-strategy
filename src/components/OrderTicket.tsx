import { useState } from "react";
import type { OrderAction, PreTradeResult } from "../api/preTradeCheck";
import { fmt } from "../utils/formatters";

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

  return (
    <div
      style={{
        background: "#0c0c1c",
        border: `1px solid ${accent}40`,
        borderRadius: 6,
        padding: 14,
        margin: "0 0 10px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
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
          fontFamily: "monospace",
          color: "#c0c0e0",
          marginBottom: 12,
        }}
      >
        <Row label="CONTRACT" value={contractSymbol} />
        <Row label="TYPE" value={`${optionType.toUpperCase()} · ${expiration}`} />
        <Row label="STRIKE" value={fmt.currency(strike)} />
        <Row label="LIMIT" value={fmt.currency(limitPrice)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#4a4a6a", fontSize: 9, letterSpacing: "0.06em" }}>QTY</span>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            disabled={busy}
            onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{
              width: 56,
              background: "#08081a",
              border: "1px solid #2a2a3a",
              borderRadius: 3,
              color: "#e8e8f8",
              fontFamily: "monospace",
              fontSize: 12,
              padding: "3px 6px",
            }}
          />
          <span style={{ color: "#3a3a5a", fontSize: 9 }}>max {maxQty}</span>
        </div>
        <Row
          label={cashLabel}
          value={fmt.currency(Math.abs(check.estCashFlow))}
          valueColor={check.estCashFlow >= 0 ? "#34d399" : "#f87171"}
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
                fontFamily: "monospace",
                color: "#f87171",
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
                fontFamily: "monospace",
                color: "#f59e0b",
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
          fontFamily: "monospace",
          color: "#8a8aa8",
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
          style={btnStyle("#5a5a7a", "transparent", "#2a2a3a")}
        >
          DISMISS
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onConfirm}
          style={{
            ...btnStyle(
              canSubmit ? "#04120c" : "#3a3a5a",
              canSubmit ? accent : "#1a1a30",
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
      <span style={{ color: "#4a4a6a", fontSize: 9, letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ color: valueColor ?? "#e8e8f8", fontWeight: 700 }}>{value}</span>
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
    fontFamily: "monospace",
    fontWeight: 800,
    color,
    letterSpacing: "0.06em",
  };
}
