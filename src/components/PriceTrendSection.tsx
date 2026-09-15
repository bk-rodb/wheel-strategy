import { useMemo } from "react";
import type { PricePoint } from "../types";
import { buildTrendSnapshot } from "../utils/trendMetrics";
import { PriceTrendChart } from "./PriceTrendChart";
import { TrendSnapshotChips } from "./TrendSnapshotChips";
import { CardLabel, EmptyState } from "./ui";

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
      <CardLabel>30-DAY PRICE TREND</CardLabel>
      {chartData.length > 0 ? (
        <>
          <PriceTrendChart data={chartData} costBasis={costBasis} strike={strike} />
          <TrendSnapshotChips chips={snapshot.chips} />
        </>
      ) : (
        <EmptyState>NO PRICE HISTORY</EmptyState>
      )}
    </div>
  );
}
