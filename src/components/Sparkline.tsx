import { memo } from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import type { PricePoint } from "../types";
import { useTheme } from "../theme";

export const Sparkline = memo(function Sparkline({
  data,
  color,
}: {
  data: PricePoint[];
  color: string;
}) {
  // SVG presentation attributes cannot read CSS variables — resolve to a literal.
  const { resolve } = useTheme();
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <Line type="monotone" dataKey="price" stroke={resolve(color)} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
});
