import type { OptionLeg, WheelPhase } from "../types";
import { fmt, dte } from "../utils/formatters";
import { StatRow } from "./StatRow";

export function OptionCard({ opt, phase }: { opt: OptionLeg; phase: WheelPhase }) {
  const d = dte(opt.expiration);
  const urgency = d <= 7 ? "#ef4444" : d <= 14 ? "#f59e0b" : "#34d399";
  const pnlPerContract = (opt.premiumReceived - opt.currentOptionPrice) * 100;
  return (
    <div
      style={{
        background: "#0a0a18",
        border: "1px solid #1e1e38",
        borderRadius: 6,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: phase === "covered-call" ? "#34d399" : "#f59e0b",
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          {opt.type.toUpperCase()} OPTION
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: urgency,
            background: `${urgency}18`,
            padding: "2px 8px",
            borderRadius: 3,
            border: `1px solid ${urgency}40`,
          }}
        >
          {d}d DTE
        </span>
      </div>
      <StatRow label="Strike" value={fmt.currency(opt.strike)} />
      <StatRow label="Expiration" value={opt.expiration} />
      <StatRow label="Contracts" value={String(opt.contracts)} />
      <StatRow label="Premium Received" value={fmt.currency(opt.premiumReceived)} />
      <StatRow label="Current Price" value={fmt.currency(opt.currentOptionPrice)} />
      <StatRow label="P&L / Contract" value={fmt.currency(pnlPerContract)} accent={pnlPerContract >= 0} />
    </div>
  );
}
