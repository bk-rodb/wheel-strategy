import { useMemo } from "react";
import type { PricePoint } from "../types";
import { buildTrendSnapshot } from "../utils/trendMetrics";
import { PriceTrendChart } from "./PriceTrendChart";
import { TrendSnapshotChips } from "./TrendSnapshotChips";

const cardLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#4a4a6a",
  fontFamily: "monospace",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#3a3a5a",
  fontFamily: "monospace",
  padding: "12px 0",
  textAlign: "center",
};

/** Last 30 sessions for the chart; full history feeds SMA50 in trend chips. */
function chartWindow(data: PricePoint[]): PricePoint[] {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(-30);
}

export function PriceTrendSection({
  data,
  currentPrice,
  costBasis = 0,
  strike,
}: {
  data: PricePoint[];
  currentPrice: number;
  costBasis?: number;
  strike?: number;
}) {
  const chartData = useMemo(() => chartWindow(data), [data]);
  const snapshot = useMemo(
    () => buildTrendSnapshot(data, currentPrice, costBasis),
    [data, currentPrice, costBasis],
  );

  return (
    <div>
      <div style={cardLabelStyle}>30-DAY PRICE TREND</div>
      {chartData.length > 0 ? (
        <>
          <PriceTrendChart data={chartData} costBasis={costBasis} strike={strike} />
          <TrendSnapshotChips chips={snapshot.chips} />
        </>
      ) : (
        <div style={emptyStyle}>NO PRICE HISTORY</div>
      )}
    </div>
  );
}
