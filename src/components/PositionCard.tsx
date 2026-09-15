import type { WheelPosition } from "../types";
import { fmt, dayChange, dayChangePct, dte } from "../utils/formatters";
import { PHASE_CONFIG, SOURCE_BADGE, signColor } from "../constants";
import { WheelPhaseIndicator } from "./WheelPhaseIndicator";
import { Sparkline } from "./Sparkline";

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
                fontFamily: "'Syne','Trebuchet MS',sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "#e0e0f8",
                letterSpacing: "-0.01em",
              }}
            >
              {pos.ticker}
            </div>
            <div
              title={pos.companyName}
              style={{
                fontSize: 10,
                color: "#3a3a5a",
                fontFamily: "monospace",
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
}
