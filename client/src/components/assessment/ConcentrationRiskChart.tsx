import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { UserConsumption } from '../../types';

interface ConcentrationRiskChartProps {
  topUsers: UserConsumption[];
}

export default function ConcentrationRiskChart({ topUsers }: ConcentrationRiskChartProps) {
  const average =
    topUsers.length > 0 ? topUsers.reduce((s, u) => s + u.creditsConsumed, 0) / topUsers.length : 0;

  const data = topUsers.map((u) => ({
    name: u.displayName,
    credits: u.creditsConsumed,
    isPowerUser: u.creditsConsumed > average * 3,
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-slate-200 mb-2">Top User Consumption vs. Average</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" angle={-30} textAnchor="end" height={60} interval={0} />
          <YAxis stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
          <ReferenceLine y={average} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Average', fill: '#3b82f6' }} />
          <Bar dataKey="credits" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.isPowerUser ? '#ef4444' : '#2dd4bf'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
