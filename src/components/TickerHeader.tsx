import type { ReactNode } from "react";
import { signColor } from "../constants";
import { fmt } from "../utils/formatters";
import { TickerTabLabel } from "./TickerTabLabel";

/** Detail-view header: symbol/company on the left, last price and day move on the right. */
export function TickerHeader({
  symbol,
  companyName,
  badge,
  subtitle,
  price,
  change,
  changePct,
}: {
  symbol: string;
  companyName: string;
  badge?: ReactNode;
  subtitle?: ReactNode;
  price: number;
  change: number;
  changePct: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 20,
      }}
    >
      <div>
        <TickerTabLabel symbol={symbol} companyName={companyName} badge={badge} subtitle={subtitle} />
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 26, fontFamily: "monospace", fontWeight: 700, color: "#e8e8f8" }}>
          {fmt.currency(price)}
        </div>
        <div style={{ fontSize: 13, fontFamily: "monospace", color: signColor(change) }}>
          {change >= 0 ? "▲" : "▼"} {fmt.currency(Math.abs(change))} ({fmt.pct(changePct)})
        </div>
      </div>
    </div>
  );
}
