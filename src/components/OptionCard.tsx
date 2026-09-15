import type { OptionLeg, WheelPhase } from "../types";
import { fmt, dte } from "../utils/formatters";
import { StatRow } from "./StatRow";
import { alpha, vars } from "../theme";

export function OptionCard({ opt, phase }: { opt: OptionLeg; phase: WheelPhase }) {
  const d = dte(opt.expiration);
  const urgency = d <= 7 ? vars.status.danger : d <= 14 ? vars.status.warning : vars.status.gain;
  const pnlPerContract = (opt.premiumReceived - opt.currentOptionPrice) * 100;
  return (
    <div
      style={{
        background: vars.bg.sunken,
        border: `1px solid ${vars.border.strong}`,
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
            fontFamily: vars.font.mono,
            color: phase === "covered-call" ? vars.status.gain : vars.status.warning,
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          {opt.type.toUpperCase()} OPTION
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: vars.font.mono,
            color: urgency,
            background: alpha(urgency, 0.094),
            padding: "2px 8px",
            borderRadius: 3,
            border: `1px solid ${alpha(urgency, 0.251)}`,
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
