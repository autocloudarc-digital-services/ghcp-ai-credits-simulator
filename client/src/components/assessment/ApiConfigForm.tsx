import { useState } from 'react';
import { AssessmentConfig } from '../../types';

const API_VERSION = '2026-03-10';

interface ApiConfigFormProps {
  enterpriseSlug: string;
  onSubmit: (config: AssessmentConfig) => void;
  isSubmitting: boolean;
}

export default function ApiConfigForm({ enterpriseSlug, onSubmit, isSubmitting }: ApiConfigFormProps) {
  const [organizations, setOrganizations] = useState('');
  const [period, setPeriod] = useState<'7' | '30' | 'custom'>('30');
  const [customDays, setCustomDays] = useState(14);

  const periodDays = period === 'custom' ? customDays : Number(period);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      enterpriseSlug,
      organizations: organizations
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      sessionId: '',
      apiVersion: API_VERSION,
      periodDays,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
      <h3 className="text-lg font-semibold text-slate-100">Assessment Configuration</h3>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          Organizations (comma separated, blank = all)
        </span>
        <input
          type="text"
          value={organizations}
          onChange={(e) => setOrganizations(e.target.value)}
          placeholder="autocloudarc-digital-services, autocloudarc-space-fleet"
          className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Assessment Period</span>
        <div className="flex gap-2 flex-wrap">
          {(['7', '30', 'custom'] as const).map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => setPeriod(opt)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                period === opt
                  ? 'bg-teal-500 border-teal-400 text-slate-900 font-medium'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-teal-400'
              }`}
            >
              {opt === '7' ? 'Last 7 days' : opt === '30' ? 'Last 30 days' : 'Custom'}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <input
            type="number"
            min={1}
            max={90}
            value={customDays}
            onChange={(e) => setCustomDays(Number(e.target.value))}
            className="w-32 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-numeric focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        )}
      </div>

      <div className="text-xs text-slate-500">
        API Version: <span className="font-numeric text-slate-300">{API_VERSION}</span> (auto-set)
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-medium py-2 rounded-md transition-colors"
      >
        {isSubmitting ? 'Assessing…' : 'Assess Now'}
      </button>
    </form>
  );
}
