import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { runSimulation } from '../../engine/creditCalculationEngine';
import { ScenarioConfig } from '../../types';
import { scenarioFormSchema, ScenarioFormValues } from '../../schemas/forms';

const SCENARIO_COLORS = ['#2dd4bf', '#3b82f6', '#fbbf24', '#ef4444'];

function toCsv(scenarios: ScenarioConfig[]): string {
  const header = [
    'Scenario',
    'Total Included Pool',
    'Daily Burn Rate',
    'Projected Exhaustion Day',
    'Projected Overage Credits',
    'Projected Overage Cost',
  ];
  const rows = scenarios.map((s) => [
    s.name,
    s.result?.totalIncludedPool ?? '',
    s.result?.projectedDailyBurnRate.toFixed(2) ?? '',
    isFinite(s.result?.projectedExhaustionDay ?? Infinity)
      ? Math.round(s.result?.projectedExhaustionDay ?? 0)
      : 'N/A',
    s.result?.projectedOverageCredits.toFixed(0) ?? '',
    s.result?.projectedOverageCost.toFixed(2) ?? '',
  ]);
  return [header, ...rows].map((r) => r.join(',')).join('\n');
}

export default function WhatIfScenarioBuilder() {
  const { simulatorConfig, scenarios, addScenario, removeScenario } = useAppStore();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    mode: 'onChange',
    defaultValues: { scenarioName: '' },
  });

  const handleAddScenario = ({ scenarioName }: ScenarioFormValues) => {
    if (scenarios.length >= 4) return;
    const name = scenarioName.trim() || `Scenario ${scenarios.length + 1}`;
    const result = runSimulation(simulatorConfig);
    addScenario({
      id: `${Date.now()}`,
      name,
      simulatorConfig: { ...simulatorConfig },
      result,
    });
    reset();
  };

  const handleExportCsv = () => {
    const csv = toCsv(scenarios);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aic-scenario-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = [
    {
      metric: 'Overage Cost ($)',
      ...Object.fromEntries(scenarios.map((s) => [s.name, Math.round((s.result?.projectedOverageCost ?? 0) * 100) / 100])),
    },
    {
      metric: 'Exhaustion Day',
      ...Object.fromEntries(
        scenarios.map((s) => [
          s.name,
          isFinite(s.result?.projectedExhaustionDay ?? Infinity)
            ? Math.round(s.result?.projectedExhaustionDay ?? 0)
            : 30,
        ])
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-semibold text-slate-100">What-If Scenarios</h3>
          <form onSubmit={handleSubmit(handleAddScenario)} noValidate className="flex items-start gap-2">
            <label className="flex flex-col gap-1">
            <input
              type="text"
              placeholder="Scenario name"
              {...register('scenarioName')}
              aria-invalid={Boolean(errors.scenarioName)}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {errors.scenarioName && <span className="text-xs text-red-400">{errors.scenarioName.message}</span>}
            </label>
            <button
              type="submit"
              disabled={scenarios.length >= 4}
              className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-medium text-sm px-3 py-1.5 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" /> Snapshot current config
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={scenarios.length === 0}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 text-sm px-3 py-1.5 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </form>
        </div>
        <p className="text-xs text-slate-500">
          Snapshot up to 4 configurations of the current License &amp; Population settings to compare
          projected outcomes side by side.
        </p>

        {scenarios.length === 0 ? (
          <div className="text-slate-500 text-sm py-8 text-center border border-dashed border-slate-700 rounded-md">
            No scenarios yet. Configure the simulator and click &ldquo;Snapshot current config&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {scenarios.map((s, idx) => (
              <div
                key={s.id}
                className="bg-slate-900/60 border border-slate-700 rounded-md p-4 space-y-2"
                style={{ borderLeft: `4px solid ${SCENARIO_COLORS[idx % SCENARIO_COLORS.length]}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{s.name}</span>
                  <button onClick={() => removeScenario(s.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <dl className="text-xs space-y-1 font-numeric">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Pool</dt>
                    <dd className="text-teal-400">{Math.round(s.result?.totalIncludedPool ?? 0).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Burn/day</dt>
                    <dd className="text-blue-400">{Math.round(s.result?.projectedDailyBurnRate ?? 0).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Exhaustion</dt>
                    <dd className="text-amber-400">
                      {isFinite(s.result?.projectedExhaustionDay ?? Infinity)
                        ? `Day ${Math.round(s.result?.projectedExhaustionDay ?? 0)}`
                        : 'N/A'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Overage Cost</dt>
                    <dd className="text-red-400">${(s.result?.projectedOverageCost ?? 0).toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>

      {scenarios.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-2">Comparative Analysis</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="metric" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
              <Legend />
              {scenarios.map((s, idx) => (
                <Bar key={s.id} dataKey={s.name} fill={SCENARIO_COLORS[idx % SCENARIO_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
