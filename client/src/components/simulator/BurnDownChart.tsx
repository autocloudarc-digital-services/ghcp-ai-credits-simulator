import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DailyBurnPoint } from '../../types';

interface BurnDownChartProps {
  withGovernance: DailyBurnPoint[];
  withoutGovernance: DailyBurnPoint[];
  exhaustionThresholdDay?: number;
}

interface ChartRow {
  day: number;
  withGovernance: number;
  withoutGovernance: number;
}

export default function BurnDownChart({
  withGovernance,
  withoutGovernance,
  exhaustionThresholdDay = 25,
}: BurnDownChartProps) {
  const data: ChartRow[] = withoutGovernance.map((point, idx) => ({
    day: point.day,
    withoutGovernance: Math.round(point.cumulative),
    withGovernance: Math.round(withGovernance[idx]?.cumulative ?? 0),
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-slate-200 mb-2">30-Day Credit Burn-Down</h4>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="day"
            stroke="#94a3b8"
            label={{ value: 'Day of Billing Cycle', position: 'insideBottom', offset: -2, fill: '#94a3b8' }}
          />
          <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }}
            formatter={(value: number) => value.toLocaleString()}
          />
          <Legend />
          <ReferenceLine
            x={exhaustionThresholdDay}
            stroke="#fbbf24"
            strokeDasharray="4 4"
            label={{ value: 'Risk Day 25', fill: '#fbbf24', position: 'top' }}
          />
          <Line
            type="monotone"
            dataKey="withGovernance"
            name="With Governance"
            stroke="#2dd4bf"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="withoutGovernance"
            name="Without Governance"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
