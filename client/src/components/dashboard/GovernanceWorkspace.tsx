import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AssessmentResult, Recommendation } from '../../types';
import type { RegisterRecord, RegisterRole } from '../../../../shared/activeRegister';
import { useAppStore, type GovernanceInsightsPreferences } from '../../store/appStore';
import { budgetControlLabel } from 'ghcp-ai-credits-simulator-shared/governanceControls';

interface RegisterSnapshot {
  access: { role: RegisterRole; tenant: string; actor: string };
  records: Array<RegisterRecord & { effective_status?: string }>;
  truncated: boolean;
}

const inputClass = 'min-w-0 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100';
const phases = ['Prepare', 'Baseline', 'Design', 'Approve', 'Pilot', 'Rollout', 'Operate'];
const priorities: Recommendation['priority'][] = ['critical', 'high', 'medium', 'low'];
const severityClass = { critical: 'text-red-400', high: 'text-amber-400', medium: 'text-blue-300', low: 'text-slate-300' };

export default function GovernanceWorkspace({ view, assessment, recommendations, score }: {
  view: 'overview' | 'findings' | 'register'; assessment: AssessmentResult | null; recommendations: Recommendation[]; score: number;
}) {
  const navigate = useNavigate();
  const { governanceInsights, setGovernanceInsights } = useAppStore();
  const query = view === 'register' ? governanceInsights.registerQuery : governanceInsights.findingsQuery;
  const setQuery = (value: string) => setGovernanceInsights(view === 'register' ? { registerQuery: value.slice(0, 200) } : { findingsQuery: value.slice(0, 200) });
  const { priority, phase, attentionOnly } = governanceInsights;
  const setPriority = (value: string) => setGovernanceInsights({ priority: value as GovernanceInsightsPreferences['priority'] });
  const setPhase = (value: string) => setGovernanceInsights({ phase: value as GovernanceInsightsPreferences['phase'] });
  const setAttentionOnly = (value: boolean) => setGovernanceInsights({ attentionOnly: value });
  const [snapshot, setSnapshot] = useState<RegisterSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (view !== 'register') return;
    const controller = new AbortController();
    setLoading(true); setError(null); setSnapshot(null);
    axios.get<RegisterSnapshot>('/api/register', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setSnapshot(response.data); })
      .catch(failure => {
        if (controller.signal.aborted) return;
        const status = axios.isAxiosError(failure) ? failure.response?.status : null;
        setError(status === 401 ? 'Reconnect GitHub to read the register.' : status === 403 ? 'This account has no register access.' : 'Register unavailable. No governance status can be inferred.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [view, refresh]);

  if (view === 'overview') {
    const warnings = assessment?.governanceDataWarnings ?? [];
    const coverage = [
      { source: 'budgets', label: 'Budgets', items: assessment?.existingBudgets },
      { source: 'costCenters', label: 'Cost centers', items: assessment?.existingCostCenters },
      { source: 'organizations', label: 'Organizations', items: assessment?.organizations },
      { source: 'teams', label: 'Teams', items: assessment?.teams },
      { source: 'users', label: 'Users', items: assessment?.users },
    ];
    return <div className="space-y-5">
      <div className="grid gap-6 md:grid-cols-3">
        <section className="space-y-2 border-l-2 border-amber-500 pl-4">
          <h2 className="text-sm font-semibold text-slate-200">Recommendation-derived score</h2>
          <p className="text-3xl font-semibold text-amber-300">{Math.round(score)} <span className="text-sm text-slate-400">/ 100</span></p>
          <p className="text-xs text-slate-400">Heuristic, not verified compliance or provider enforcement.</p>
        </section>
        <section className="space-y-2 border-l-2 border-blue-500 pl-4">
          <h2 className="text-sm font-semibold text-slate-200">Priority actions</h2>
          <p className="text-3xl font-semibold text-blue-300">{recommendations.filter(item => item.priority === 'critical' || item.priority === 'high').length}</p>
          <p className="text-xs text-slate-400">Critical and high-priority proposals, pending review.</p>
        </section>
        <section className="space-y-2 border-l-2 border-teal-500 pl-4">
          <h2 className="text-sm font-semibold text-slate-200">Source warnings</h2>
          <p className="text-3xl font-semibold text-teal-300">{assessment ? warnings.length : 'Unknown'}</p>
          <p className="text-xs text-slate-400">Saved assessment snapshot; no automatic provider refresh.</p>
        </section>
      </div>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">Source coverage</h2>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="border-b border-slate-600 text-slate-400"><tr><th className="p-2">Source</th><th className="p-2">Returned rows</th><th className="p-2">Snapshot status</th></tr></thead>
          <tbody>{coverage.map(item => <tr key={item.source} className="border-b border-slate-800"><th className="p-2 font-medium">{item.label}</th><td className="p-2">{item.items?.length ?? 'Unknown'}</td><td className="p-2 text-slate-300">{warnings.some(warning => warning.source === item.source) ? 'Warning / partial or unavailable' : item.items === undefined ? 'Not captured' : item.items.length === 0 ? 'No rows returned' : 'Returned; completeness not certified'}</td></tr>)}</tbody>
        </table></div>
        {warnings.map((warning, index) => <p key={`${warning.source}-${index}`} className="break-words text-sm text-amber-300"><strong>{warning.source}:</strong> {warning.message}</p>)}
      </section>
    </div>;
  }

  if (view === 'findings') {
    const filtered = recommendations.filter(item => (priority === 'all' || item.priority === priority) && `${item.budgetClass.name} ${item.rationale}`.toLowerCase().includes(query.toLowerCase())).sort((left, right) => priorities.indexOf(left.priority) - priorities.indexOf(right.priority));
    return <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400">Search findings<input className={inputClass} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">Priority<select className={inputClass} value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option>{priorities.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <p role="status" className="text-xs text-slate-400">{filtered.length} matching recommendations</p>
      {filtered.length === 0 && <p className="py-6 text-sm text-slate-400">No matching recommendations. This does not certify governance readiness.</p>}
      <div className="divide-y divide-slate-700">{filtered.map((item, index) => <article key={`${item.budgetClass.slug}-${index}`} className="space-y-3 py-4">
        <div className="flex flex-wrap gap-3"><span className={`text-sm font-semibold uppercase ${severityClass[item.priority]}`}>{item.priority}</span><h2 className="text-base font-semibold">{item.budgetClass.name}</h2><span className="text-xs text-slate-400">{budgetControlLabel(item.budgetClass)}</span></div>
        <p className="break-words text-sm text-slate-300">{item.rationale}</p>
        <details className="text-sm"><summary className="cursor-pointer text-teal-300">Implementation steps</summary><ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-300">{item.implementationSteps.map((step, stepIndex) => <li key={stepIndex} className="break-words">{step}</li>)}</ol></details>
      </article>)}</div>
      <section className="space-y-2 border-t border-slate-700 pt-4"><h2 className="text-base font-semibold">Assessment gaps</h2>
        {assessment?.governanceGaps.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-amber-300">{assessment.governanceGaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul> : <p className="text-sm text-slate-400">No gaps reported in this snapshot; evidence review is still required.</p>}
      </section>
    </div>;
  }

  const now = Date.now();
  const attention = (record: RegisterRecord) => {
    const document = record.document;
    const issues: string[] = [];
    if (!Array.isArray(document.evidence) || document.evidence.length === 0) issues.push('No evidence');
    if (typeof document.next_review === 'string' && Date.parse(document.next_review) <= now) issues.push('Review overdue');
    if (document.record_type === 'exception' && typeof document.exception_expiry === 'string' && Date.parse(document.exception_expiry) <= now) issues.push('Exception expired');
    if (Array.isArray(document.tests) && document.tests.some(test => test && typeof test === 'object' && ['fail', 'blocked', 'not-run'].includes(String(test.test_result)))) issues.push('Tests pending or unsuccessful');
    return issues;
  };
  const records = snapshot?.records ?? [];
  const visible = records.filter(record => (phase === 'all' || record.document.phase === phase) && (!attentionOnly || attention(record).length > 0) && `${record.document.record_type} ${record.document.scope_id} ${record.document.owner_primary} ${record.document.enterprise_control_id}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Register oversight</h2><div className="flex gap-3">
      <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} title="Refresh register insights" aria-label="Refresh register insights" className="rounded border border-slate-600 p-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      <button type="button" onClick={() => navigate('/report?view=register')} className="flex items-center gap-2 text-sm text-teal-300">Open Active Register <ArrowRight className="h-4 w-4" /></button>
    </div></div>
    {loading && <p role="status" className="py-6 text-sm text-slate-400">Loading register insights...</p>}
    {error && <p role="alert" className="py-4 text-sm text-amber-300">{error}</p>}
    {!loading && snapshot && <>
      <p className="break-all text-xs text-slate-400">Register tenant: {snapshot.access.tenant} / {snapshot.access.role}. Register scope is authorized separately from the assessment enterprise.</p>
      {snapshot.truncated && <p role="alert" className="text-sm text-amber-300">Partial inventory: only the first 1,000 records are included. Counts and filters apply to loaded records.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{phases.map(value => <div key={value} className="border-l-2 border-slate-600 pl-3"><p className="text-xs text-slate-400">{value}</p><p className="text-xl font-semibold">{records.filter(record => record.document.phase === value).length}</p></div>)}</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400"><span className="flex items-center gap-1"><Search className="h-3 w-3" /> Search records</span><input className={inputClass} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">Phase<select className={inputClass} value={phase} onChange={event => setPhase(event.target.value)}><option value="all">All phases</option>{phases.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="flex items-center gap-2 py-2 text-sm text-slate-300"><input type="checkbox" checked={attentionOnly} onChange={event => setAttentionOnly(event.target.checked)} /> Needs attention</label>
      </div>
      <p role="status" className="text-xs text-slate-400">{visible.length} of {records.length} loaded records</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-600 text-slate-400"><tr>{['Record / scope', 'Owner', 'Phase', 'Status', 'Attention'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(record => <tr key={record.id} className="border-b border-slate-800 align-top"><td className="max-w-xs break-words p-2"><strong>{record.document.record_type}</strong><p className="text-xs text-slate-400">{record.document.scope_id}</p><p className="text-xs text-slate-400">{record.document.enterprise_control_id}</p></td><td className="max-w-48 break-words p-2">{record.document.owner_primary}</td><td className="p-2">{record.document.phase}</td><td className="p-2">{record.effective_status ?? record.document.record_status}</td><td className="p-2 text-amber-300">{attention(record).join('; ') || 'No tracked flags'}</td></tr>)}</tbody></table></div>
      {visible.length === 0 && <p className="py-6 text-sm text-slate-400">{records.length === 0 ? 'No register records in the authorized tenant.' : 'No records match these filters.'}</p>}
    </>}
  </div>;
}