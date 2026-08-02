import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';
import { AlertTriangle, ArrowUpDown, Filter } from 'lucide-react';
import { AssessmentResult } from '../../types';
import ConcentrationRiskChart from './ConcentrationRiskChart';

interface AssessmentResultsProps {
  result: AssessmentResult;
  totalIncludedPool: number;
}

export default function AssessmentResults({ result, totalIncludedPool }: AssessmentResultsProps) {
  const [costCenterStatusFilter, setCostCenterStatusFilter] =
    useState<'all' | 'active' | 'deleted'>('all');
  const [costCenterStatusSort, setCostCenterStatusSort] =
    useState<'active-first' | 'deleted-first'>('active-first');
  const governanceDataWarnings = result.governanceDataWarnings ?? [];
  const budgetsWarning = governanceDataWarnings.find((warning) => warning.source === 'budgets');
  const costCentersWarning = governanceDataWarnings.find((warning) => warning.source === 'costCenters');
  const poolUtilization =
    totalIncludedPool > 0 ? Math.min(999, (result.totalCreditsConsumed / totalIncludedPool) * 100) : 0;

  const modelEntries = Object.entries(result.byModel).sort((a, b) => b[1] - a[1]);
  const modelTotal = modelEntries.reduce((s, [, v]) => s + v, 0);

  const orgEntries = Object.entries(result.byOrganization).sort((a, b) => b[1] - a[1]);
  const visibleCostCenters = result.existingCostCenters
    .filter((costCenter) => costCenterStatusFilter === 'all' || costCenter.state === costCenterStatusFilter)
    .sort((first, second) => {
      if (first.state === second.state) return first.name.localeCompare(second.name);
      const activeFirst = costCenterStatusSort === 'active-first';
      return first.state === 'active' ? (activeFirst ? -1 : 1) : activeFirst ? 1 : -1;
    });

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

      {governanceDataWarnings.length > 0 && (
        <div className="bg-amber-400/10 border border-amber-400/40 text-amber-200 rounded-md px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4" /> Some enterprise governance data is unavailable
          </div>
          <ul className="mt-2 space-y-1">
            {governanceDataWarnings.map((warning) => (
              <li key={warning.source} className="text-xs break-words">
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

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
          {budgetsWarning ? (
            <p className="text-sm text-amber-300">Budget data unavailable.</p>
          ) : result.existingBudgets.length === 0 ? (
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
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Cost Centers</h4>
          {costCentersWarning ? (
            <p className="text-sm text-amber-300">Cost-center data unavailable.</p>
          ) : result.existingCostCenters.length === 0 ? (
            <p className="text-sm text-slate-500">No cost centers currently configured.</p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <Filter className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Filter by status</span>
                  <select
                    value={costCenterStatusFilter}
                    onChange={(event) =>
                      setCostCenterStatusFilter(event.target.value as 'all' | 'active' | 'deleted')
                    }
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <ArrowUpDown className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Sort by status</span>
                  <select
                    value={costCenterStatusSort}
                    onChange={(event) =>
                      setCostCenterStatusSort(event.target.value as 'active-first' | 'deleted-first')
                    }
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"
                  >
                    <option value="active-first">Active first</option>
                    <option value="deleted-first">Deleted first</option>
                  </select>
                </label>
              </div>
              {visibleCostCenters.length === 0 ? (
                <p className="text-sm text-slate-500">No cost centers match this status.</p>
              ) : (
                <div className="divide-y divide-slate-700">
                  {visibleCostCenters.map((c) => (
                    <div key={c.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-200">
                          {c.name}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-medium ${
                            c.state === 'active' ? 'text-green-400' : 'text-slate-500'
                          }`}
                        >
                          {c.state === 'active' ? 'Active' : 'Deleted'}
                        </span>
                      </div>
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <label className="flex items-center gap-2 text-slate-400">
                          <input
                            type="checkbox"
                            checked={c.aiCreditPoolEnabled === true}
                            disabled
                            className="h-4 w-4 accent-teal-500"
                          />
                          <span>AI credit included usage cap</span>
                        </label>
                        <span className="text-slate-500">
                          {c.aiCreditPoolEnabled === undefined
                            ? 'Not reported'
                            : c.aiCreditPoolEnabled
                              ? 'Enabled'
                              : 'Disabled'}
                        </span>
                        {c.aiCreditPoolEnabled && c.aiCreditPoolState && (
                          <span className="basis-full text-slate-500">
                            {c.aiCreditPoolState.currentAmount === null
                              ? 'Current usage pending'
                              : `${c.aiCreditPoolState.currentAmount.toLocaleString()} credits used`}
                            {' / '}
                            {c.aiCreditPoolState.targetAmount === null
                              ? 'cap pending'
                              : `${c.aiCreditPoolState.targetAmount.toLocaleString()} credit cap`}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto rounded-md border border-slate-700">
                        <table className="w-full table-fixed text-left text-xs">
                          <caption className="sr-only">
                            Resource types and names assigned to {c.name}
                          </caption>
                          <thead className="bg-slate-900/70 text-slate-400">
                            <tr>
                              <th className="w-1/3 px-3 py-2 font-medium">resource-type</th>
                              <th className="px-3 py-2 font-medium">resource-name</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {c.resources.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="px-3 py-3 text-slate-500">
                                  No resources assigned
                                </td>
                              </tr>
                            ) : (
                              c.resources.map((resource, index) => (
                                <tr key={`${resource.type}:${resource.name}:${index}`}>
                                  <td className="break-words px-3 py-2 text-slate-400">
                                    {resource.type}
                                  </td>
                                  <td className="break-words px-3 py-2 text-slate-300">
                                    {resource.name}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
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
