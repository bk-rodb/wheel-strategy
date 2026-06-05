import type { WheelPhase } from "../types";
import { PHASE_CONFIG } from "../constants";

export function WheelPhaseIndicator({ phase }: { phase: WheelPhase }) {
  const steps: WheelPhase[] = ["cash-secured-put", "stock-holding", "covered-call"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => {
        const cfg = PHASE_CONFIG[s];
        const active = s === phase;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                padding: "2px 10px",
                fontSize: 10,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontWeight: 700,
                letterSpacing: "0.08em",
                border: `1px solid ${active ? cfg.color : "#2a2a3a"}`,
                color: active ? cfg.color : "#3a3a5a",
                background: active ? `${cfg.color}18` : "transparent",
                borderRadius: i === 0 ? "3px 0 0 3px" : i === 2 ? "0 3px 3px 0" : 0,
                transition: "all 0.2s",
              }}
            >
              {cfg.label}
            </div>
            {i < 2 && (
              <div style={{ width: 0, height: 20, borderLeft: "1px solid #1a1a2e" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
