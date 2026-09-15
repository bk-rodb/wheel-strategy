import type { WheelPosition } from "../types";
import { fmt, dayChange, dayChangePct, dte } from "../utils/formatters";
import { PHASE_CONFIG, SOURCE_BADGE, signColor } from "../constants";
import { WheelPhaseIndicator } from "./WheelPhaseIndicator";
import { Sparkline } from "./Sparkline";
import { vars } from "../theme";

interface PositionCardProps {
  position: WheelPosition;
  onSelect: (id: string) => void;
}

/** Shared dashboard tile for any wheel position — one renderer, data-driven. */
export function PositionCard({ position: pos, onSelect }: PositionCardProps) {
  const chg = dayChange(pos);
  const chgPct = dayChangePct(pos);
  const chgColor = signColor(chg);
  const phaseCfg = PHASE_CONFIG[pos.phase];

  return (
    <button
      type="button"
      onClick={() => onSelect(pos.id)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        width: "100%",
        height: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        background: vars.bg.card,
        border: `1px solid ${vars.border.default}`,
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
        (e.currentTarget as HTMLButtonElement).style.borderColor = vars.border.default;
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
      }}
    >
      <div
        aria-hidden
        data-testid="position-card-accent"
        style={{
          height: 2,
          flexShrink: 0,
          width: "100%",
          background: phaseCfg.color,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          padding: 14,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
            <div
              style={{
                fontFamily: vars.font.display,
                fontSize: 18,
                fontWeight: 800,
                color: vars.text.strong,
                letterSpacing: "-0.01em",
              }}
            >
              {pos.ticker}
            </div>
            <div
              title={pos.companyName}
              style={{
                fontSize: 10,
                color: vars.text.faint,
                fontFamily: vars.font.mono,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pos.companyName}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                fontFamily: vars.font.mono,
                fontSize: 15,
                fontWeight: 700,
                color: vars.text.strong,
              }}
            >
              {fmt.currency(pos.currentPrice)}
            </div>
            <div style={{ fontFamily: vars.font.mono, fontSize: 10, color: chgColor }}>
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
              color: vars.text.onBrand,
              background: SOURCE_BADGE[pos.dataSource],
              padding: "1px 6px",
              borderRadius: 2,
              fontFamily: vars.font.mono,
            }}
          >
            {pos.dataSource}
          </span>
        </div>

        <div style={{ height: 48, minHeight: 48, marginBottom: 10, flexShrink: 0 }}>
          <Sparkline data={pos.priceHistory} color={phaseCfg.color} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            marginTop: "auto",
          }}
        >
          <div>
            <div style={{ fontSize: 9, color: vars.text.faint, fontFamily: vars.font.mono }}>
              UNREALIZED
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: vars.font.mono,
                color: pos.unrealizedPnL >= 0 ? vars.status.gain : vars.status.loss,
                fontWeight: 600,
              }}
            >
              {fmt.currency(pos.unrealizedPnL)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: vars.text.faint, fontFamily: vars.font.mono }}>
              PREMIUM
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: vars.font.mono,
                color: vars.status.gain,
                fontWeight: 600,
              }}
            >
              {fmt.currency(pos.premiumCollectedTotal)}
            </div>
          </div>
          {pos.activeOption && (
            <>
              <div>
                <div style={{ fontSize: 9, color: vars.text.faint, fontFamily: vars.font.mono }}>
                  STRIKE
                </div>
                <div style={{ fontSize: 12, fontFamily: vars.font.mono, color: vars.text.primary }}>
                  {fmt.currency(pos.activeOption.strike)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: vars.text.faint, fontFamily: vars.font.mono }}>
                  DTE
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: vars.font.mono,
                    color: dte(pos.activeOption.expiration) <= 7 ? vars.status.danger : vars.text.primary,
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
}
