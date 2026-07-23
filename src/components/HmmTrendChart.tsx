import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { HmmTrendResult } from "../types";
import { fmt } from "../utils/formatters";

const STATE_COLORS = {
  bear: "#f87171",
  neutral: "#94a3b8",
  bull: "#34d399",
} as const;

export function HmmTrendChart({ data }: { data: HmmTrendResult }) {
  const chartData = data.history.slice(-52).map((h) => ({
    date: h.date,
    bear: h.stateProbs[0],
    neutral: h.stateProbs[1],
    bull: h.stateProbs[2],
  }));

  if (chartData.length === 0) {
    return (
      <div style={{ fontSize: 11, color: "#3a3a5a", fontFamily: "monospace", textAlign: "center", padding: 24 }}>
        NO REGIME HISTORY
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1a1a30" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#4a4a6a", fontSize: 9, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => String(v).slice(5)}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 1]}
          tick={{ fill: "#4a4a6a", fontSize: 9, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: "#0d0d1a",
            border: "1px solid #2a2a3a",
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "monospace",
            color: "#e0e0f0",
          }}
          formatter={(v: number, name: string) => [`${(v * 100).toFixed(0)}%`, name.toUpperCase()]}
          labelStyle={{ color: "#6a6a8a" }}
        />
        <Area
          type="monotone"
          dataKey="bear"
          stackId="1"
          stroke={STATE_COLORS.bear}
          fill={STATE_COLORS.bear}
          fillOpacity={0.75}
        />
        <Area
          type="monotone"
          dataKey="neutral"
          stackId="1"
          stroke={STATE_COLORS.neutral}
          fill={STATE_COLORS.neutral}
          fillOpacity={0.65}
        />
        <Area
          type="monotone"
          dataKey="bull"
          stackId="1"
          stroke={STATE_COLORS.bull}
          fill={STATE_COLORS.bull}
          fillOpacity={0.75}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 9,
  color: "#4a4a6a",
  fontFamily: "monospace",
  letterSpacing: "0.06em",
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid #1a1a30",
};

const tdStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#c8c8e0",
  fontFamily: "monospace",
  padding: "6px 8px",
  borderBottom: "1px solid #12122a",
};

export function HmmForecastTable({ data }: { data: HmmTrendResult }) {
  if (data.forecast.length === 0) return null;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
      <thead>
        <tr>
          <th style={thStyle}>HORIZON</th>
          <th style={thStyle}>EXP. RETURN</th>
          <th style={{ ...thStyle, color: STATE_COLORS.bear }}>BEAR</th>
          <th style={{ ...thStyle, color: STATE_COLORS.neutral }}>NEUTRAL</th>
          <th style={{ ...thStyle, color: STATE_COLORS.bull }}>BULL</th>
        </tr>
      </thead>
      <tbody>
        {data.forecast.map((row) => (
          <tr key={row.days}>
            <td style={tdStyle}>{row.days}d</td>
            <td style={{ ...tdStyle, color: row.expectedReturnPct >= 0 ? "#34d399" : "#f87171" }}>
              {fmt.pct(row.expectedReturnPct / 100)}
            </td>
            <td style={tdStyle}>{fmt.pct(row.bearProb)}</td>
            <td style={tdStyle}>{fmt.pct(row.stateProbs[1])}</td>
            <td style={tdStyle}>{fmt.pct(row.bullProb)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function regimeColor(regime: string): string {
  if (regime === "bear") return STATE_COLORS.bear;
  if (regime === "bull") return STATE_COLORS.bull;
  if (regime === "neutral") return STATE_COLORS.neutral;
  return "#6a6a8a";
}
