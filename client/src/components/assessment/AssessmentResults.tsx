import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { AssessmentResult } from '../../types';
import ConcentrationRiskChart from './ConcentrationRiskChart';

interface AssessmentResultsProps {
  result: AssessmentResult;
  totalIncludedPool: number;
}

export default function AssessmentResults({ result, totalIncludedPool }: AssessmentResultsProps) {
  const poolUtilization =
    totalIncludedPool > 0 ? Math.min(999, (result.totalCreditsConsumed / totalIncludedPool) * 100) : 0;

  const modelEntries = Object.entries(result.byModel).sort((a, b) => b[1] - a[1]);
  const modelTotal = modelEntries.reduce((s, [, v]) => s + v, 0);

  const orgEntries = Object.entries(result.byOrganization).sort((a, b) => b[1] - a[1]);

  const riskColor =
    result.concentrationRiskScore > 66
      ? 'text-red-500'
      : result.concentrationRiskScore > 33
      ? 'text-amber-400'
      : 'text-green-400';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Credits Consumed" value={result.totalCreditsConsumed.toLocaleString()} color="text-teal-400" />
        <StatCard label="Pool Utilization" value={`${poolUtilization.toFixed(1)}%`} color="text-blue-500" />
        <StatCard
          label="Concentration Risk"
          value={`${result.concentrationRiskScore}/100`}
          color={riskColor}
        />
        <StatCard label="Organizations Assessed" value={String(orgEntries.length)} color="text-slate-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Consumption by Organization</h4>
          <div className="space-y-2">
            {orgEntries.map(([org, credits]) => (
              <div key={org} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 truncate">{org}</span>
                <span className="font-numeric text-teal-400">{credits.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Model Breakdown</h4>
          <div className="space-y-2">
            {modelEntries.map(([model, credits]) => (
              <div key={model} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{model}</span>
                  <span className="font-numeric text-blue-400">
                    {modelTotal > 0 ? ((credits / modelTotal) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${modelTotal > 0 ? (credits / modelTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConcentrationRiskChart topUsers={result.topUsers} />

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-2">Daily Consumption Trend</h4>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={result.dailyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
            <Area type="monotone" dataKey="credits" stroke="#2dd4bf" fill="url(#trendGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Governance Gap Analysis
        </h4>
        {result.governanceGaps.length === 0 ? (
          <p className="text-sm text-green-400">No governance gaps detected.</p>
        ) : (
          <ul className="space-y-2">
            {result.governanceGaps.map((gap, idx) => (
              <li key={idx} className="text-sm text-slate-300 flex gap-2">
                <span className="text-amber-400">•</span> {gap}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Existing Budgets</h4>
          {result.existingBudgets.length === 0 ? (
            <p className="text-sm text-slate-500">No budgets currently configured.</p>
          ) : (
            <div className="space-y-2">
              {result.existingBudgets.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{b.name}</span>
                  <span className="font-numeric text-slate-400">
                    {b.used.toLocaleString()} / {b.limit.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Existing Cost Centers</h4>
          {result.existingCostCenters.length === 0 ? (
            <p className="text-sm text-slate-500">No cost centers currently configured.</p>
          ) : (
            <div className="space-y-2">
              {result.existingCostCenters.map((c) => (
                <div key={c.id} className="text-sm text-slate-300">
                  {c.name}{' '}
                  <span className="text-slate-500">({c.resources.length} resources)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className={`font-numeric text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
