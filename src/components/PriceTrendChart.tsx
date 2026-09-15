import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { PricePoint } from "../types";
import { fmt } from "../utils/formatters";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { useTheme } from "../theme";

interface PriceTrendChartProps {
  data: PricePoint[];
  costBasis: number;
  strike?: number;
}

interface ChartPoint {
  date: string;
  price: number;
  pctFromStart: number;
}

function toPct(price: number, startPrice: number): number {
  return ((price - startPrice) / startPrice) * 100;
}

function PriceTrendChartInner({ data, costBasis, strike }: PriceTrendChartProps) {
  const { theme } = useTheme();
  const startPrice = data[0]?.price ?? 0;

  const chartData = useMemo<ChartPoint[]>(
    () =>
      data
        .filter((d) => Number.isFinite(d.price))
        .map((d) => ({
          date: d.date,
          price: d.price,
          pctFromStart: toPct(d.price, startPrice),
        })),
    [data, startPrice],
  );

  if (chartData.length === 0 || !Number.isFinite(startPrice) || startPrice <= 0) {
    return null;
  }

  const periodHigh = Math.max(...chartData.map((d) => d.price));
  const periodLow = Math.min(...chartData.map((d) => d.price));
  const lastPrice = chartData[chartData.length - 1]?.price ?? startPrice;
  const highDate = chartData.find((d) => d.price === periodHigh)?.date ?? chartData[0].date;
  const lowDate = chartData.find((d) => d.price === periodLow)?.date ?? chartData[0].date;
  const netPct = toPct(lastPrice, startPrice);
  const isUp = netPct >= 0;

  const pctValues = chartData.map((d) => d.pctFromStart);
  const levelPcts = [
    toPct(periodHigh, startPrice),
    toPct(periodLow, startPrice),
    ...(costBasis > 0 ? [toPct(costBasis, startPrice)] : []),
    ...(strike ? [toPct(strike, startPrice)] : []),
  ];
  const yMin = Math.min(...pctValues, ...levelPcts);
  const yMax = Math.max(...pctValues, ...levelPcts);
  const pad = Math.max(1.5, (yMax - yMin) * 0.08);

  const trendColor = isUp ? theme.status.gain : theme.status.loss;
  const gradientId = isUp ? "price-up-fill" : "price-down-fill";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
          gap: 12,
        }}
      >
        <div style={{ fontSize: 9, color: theme.text.dim, fontFamily: theme.font.mono, letterSpacing: "0.06em" }}>
          % FROM {data[0].date.slice(5)} OPEN ({fmt.currency(startPrice)})
        </div>
        <div style={{ fontSize: 13, fontFamily: theme.font.mono, fontWeight: 700, color: trendColor }}>
          {netPct >= 0 ? "+" : ""}
          {netPct.toFixed(2)}%
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={trendColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={theme.border.subtle} vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fill: theme.text.dim, fontSize: 10, fontFamily: theme.font.mono }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => String(v).slice(5)}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={[yMin - pad, yMax + pad]}
            tick={{ fill: theme.text.dim, fontSize: 10, fontFamily: theme.font.mono }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
            width={44}
          />

          <Tooltip
            contentStyle={{
              background: theme.bg.raised,
              border: `1px solid ${theme.border.emphasis}`,
              borderRadius: 4,
              fontSize: 11,
              fontFamily: theme.font.mono,
              color: theme.text.strong,
            }}
            formatter={(_v: number, _name: string, item) => {
              const row = item.payload as ChartPoint;
              return [`${fmt.currency(row.price)} (${row.pctFromStart >= 0 ? "+" : ""}${row.pctFromStart.toFixed(2)}%)`, "Price"];
            }}
            labelStyle={{ color: theme.text.muted }}
          />

          <ReferenceLine y={0} stroke={theme.text.faint} strokeWidth={1} strokeDasharray="3 3" />

          <ReferenceLine
            y={toPct(periodHigh, startPrice)}
            stroke={theme.status.gain}
            strokeDasharray="4 3"
            strokeWidth={1}
            strokeOpacity={0.55}
            label={{
              value: `H ${fmt.currency(periodHigh)}`,
              fill: theme.status.gain,
              fontSize: 9,
              fontFamily: theme.font.mono,
              position: "insideTopRight",
            }}
          />
          <ReferenceLine
            y={toPct(periodLow, startPrice)}
            stroke={theme.status.loss}
            strokeDasharray="4 3"
            strokeWidth={1}
            strokeOpacity={0.55}
            label={{
              value: `L ${fmt.currency(periodLow)}`,
              fill: theme.status.loss,
              fontSize: 9,
              fontFamily: theme.font.mono,
              position: "insideBottomRight",
            }}
          />
          {costBasis > 0 && (
            <ReferenceLine
              y={toPct(costBasis, startPrice)}
              stroke={theme.status.warning}
              strokeDasharray="4 3"
              strokeWidth={1}
              strokeOpacity={0.7}
              label={{
                value: `BASIS ${fmt.currency(costBasis)}`,
                fill: theme.status.warning,
                fontSize: 9,
                fontFamily: theme.font.mono,
                position: "insideTopLeft",
              }}
            />
          )}
          {strike && (
            <ReferenceLine
              y={toPct(strike, startPrice)}
              stroke={theme.status.info}
              strokeDasharray="4 3"
              strokeWidth={1}
              strokeOpacity={0.7}
              label={{
                value: `STRIKE ${fmt.currency(strike)}`,
                fill: theme.status.info,
                fontSize: 9,
                fontFamily: theme.font.mono,
                position: "insideBottomLeft",
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="pctFromStart"
            stroke="none"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="pctFromStart"
            stroke={trendColor}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, index } = props;
              if (!cx || !cy || !payload) return <g />;
              const isLast = index === chartData.length - 1;
              const isHigh = payload.date === highDate;
              const isLow = payload.date === lowDate;
              if (!isLast && !isHigh && !isLow) return <g />;

              let fill = trendColor;
              if (isHigh) fill = theme.status.gain;
              if (isLow) fill = theme.status.loss;

              return (
                <circle
                  key={payload.date}
                  cx={cx}
                  cy={cy}
                  r={isLast ? 5 : 4}
                  fill={fill}
                  stroke={theme.bg.card}
                  strokeWidth={isLast ? 2 : 1.5}
                />
              );
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceTrendChart(props: PriceTrendChartProps) {
  return (
    <ChartErrorBoundary fallbackLabel="PRICE CHART UNAVAILABLE">
      <PriceTrendChartInner {...props} />
    </ChartErrorBoundary>
  );
}
