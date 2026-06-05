import { ResponsiveContainer, LineChart, Line } from "recharts";
import type { PricePoint } from "../types";

export function Sparkline({ data, color }: { data: PricePoint[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <Line type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
