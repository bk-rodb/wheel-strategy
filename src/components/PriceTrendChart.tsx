import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { PricePoint } from "../types";
import { fmt } from "../utils/formatters";

interface PriceTrendChartProps {
  data: PricePoint[];
  costBasis: number;
  strike?: number;
}

export function PriceTrendChart({ data, costBasis, strike }: PriceTrendChartProps) {
  const min = Math.min(...data.map((d) => d.price)) * 0.98;
  const max = Math.max(...data.map((d) => d.price)) * 1.02;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "#4a4a6a", fontSize: 10, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.slice(5)}
          interval={4}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fill: "#4a4a6a", fontSize: 10, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: "#0d0d1a",
            border: "1px solid #2a2a3a",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "monospace",
            color: "#e0e0f0",
          }}
          formatter={(v: number) => [fmt.currency(v), "Price"]}
          labelStyle={{ color: "#6a6a8a" }}
        />
        {costBasis > 0 && (
          <ReferenceLine
            y={costBasis}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: "BASIS", fill: "#f59e0b", fontSize: 9, fontFamily: "monospace", position: "insideTopLeft" }}
          />
        )}
        {strike && (
          <ReferenceLine
            y={strike}
            stroke="#60a5fa"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: "STRIKE", fill: "#60a5fa", fontSize: 9, fontFamily: "monospace", position: "insideTopLeft" }}
          />
        )}
        <Line type="monotone" dataKey="price" stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
