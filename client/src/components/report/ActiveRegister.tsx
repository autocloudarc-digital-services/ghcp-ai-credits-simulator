import { useEffect, useState } from 'react';
import axios from 'axios';
import { ClipboardList, Download, History, Plus, RefreshCw, Save, X } from 'lucide-react';
import type { RegisterDocument, RegisterRecord, RegisterRecordType, RegisterRevision, RegisterRole } from '@shared/activeRegister';

type Field = { name: string; kind?: 'number' | 'json' | 'boolean'; options?: string[] };
const fields = (names: string): Field[] => names.split(' ').map(name => ({ name }));
const number = (name: string): Field => ({ name, kind: 'number' });
const json = (name: string): Field => ({ name, kind: 'json' });
const choice = (name: string, options: string[]): Field => ({ name, options });
const phases = ['Prepare', 'Baseline', 'Design', 'Approve', 'Pilot', 'Rollout', 'Operate'];
const typedFields: Record<RegisterRecordType, Field[]> = {
  'policy-profile': [],
  ULB: [choice('ulb_type', ['universal', 'cost-center', 'individual']), number('ulb_amount_ai_credits'), ...fields('membership_evidence reset_evidence')],
  'entitlement-baseline': [...fields('entitlement_basis'), number('included_credits_amount'), choice('baseline_purpose', ['forecast-only', 'reconciliation-only', 'both'])],
  'included-usage-control': [number('provider_cap_ai_credits'), ...fields('assigned_license_evidence observed_cap_behavior downstream_metered_budget_reference')],
  'metered-budget': [number('budget_amount_currency'), choice('currency', ['USD']), json('covered_ai_credit_sku'), json('alert_thresholds'), json('alert_recipients'), ...fields('response_sla'), choice('stop_usage_state', ['enabled', 'disabled', 'unavailable', 'not-verified'])],
  'license-baseline': [number('license_baseline_amount'), ...fields('license_baseline_currency'), json('covered_license_sku'), number('eligible_count'), ...fields('forecast_period variance_owner')],
  'rollout-wave': fields('population configured_state effective_state verification_evidence decision_owner'),
  'controlled-test': fields('population configured_state effective_state decision_owner'),
  exception: fields('exception_id exception_expiry affected_control reason exception_approver compensating_control'),
};
const groups: { title: string; fields: Field[] }[] = [
  { title: 'Ownership and scope', fields: [...fields('scope_id enterprise_control_id provider_control_id owner_primary owner_delegate support_contact policy_or_profile'), number('profile_version'), ...fields('assignment_target'), { name: 'production_intended', kind: 'boolean' }] },
  { title: 'Evidence and tests', fields: [json('evidence'), json('tests'), ...fields('notes')] },
  { title: 'Approval and operation', fields: [...fields('approval_id'), choice('approval_outcome', ['approve', 'reject', 'return']), ...fields('approval_evidence approved_at approving_owner operating_owner rollback_owner escalation next_review effective_start effective_end rollback_reference')] },
  { title: 'Billing observations', fields: fields('billing_cycle_start billing_cycle_end observed_next_reset timezone_source') },
  { title: 'Monitoring and review', fields: [choice('review_decision', ['retain', 'revise', 'rollback']), ...fields('review_evidence review_owner reviewed_at monitoring_notes')] },
];
const inputStyle = 'w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-60';
const label = (name: string) => name.replace(/_/g, ' ').replace(/\bulb\b/g, 'ULB').replace(/\bai\b/g, 'AI').replace(/^./, first => first.toUpperCase());
function blankDocument(type: RegisterRecordType): RegisterDocument {
  return { record_type: type, scope_id: '', enterprise_control_id: crypto.randomUUID(), owner_primary: '', phase: 'Prepare', record_status: 'draft', production_intended: false, evidence: [], tests: [] };
}
function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    return data?.issues?.map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`).join('\n') ?? data?.message ?? 'Unable to reach the Active Register.';
  }
  return error instanceof Error ? error.message : 'Active Register request failed.';
}

export default function ActiveRegister() {
  const [records, setRecords] = useState<(RegisterRecord & { effective_status?: string })[]>([]);
  const [access, setAccess] = useState<{ role: RegisterRole; tenant: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RegisterRecord | null>(null);
  const [document, setDocument] = useState<RegisterDocument | null>(null);
  const [structured, setStructured] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<RegisterRevision[] | null>(null);
  const canEdit = Boolean(access && access.role !== 'reader');

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get('/api/register', { signal });
      setRecords(data.records);
      setAccess(data.access);
      setNotice(data.truncated ? 'Showing the first 1,000 records. The inventory may be incomplete.' : '');
    } catch (failure) {
      if (!axios.isCancel(failure)) setError(errorMessage(failure));
    } finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  function edit(record: RegisterRecord | null) {
    setSelected(record);
    setDocument(record?.document ?? blankDocument('ULB'));
    setStructured({});
    setHistory(null);
    setError('');
  }
  function change(name: string, value: unknown) {
    setDocument(current => current ? { ...current, [name]: value } : current);
  }
  async function download() {
    setExporting(true);
    setError('');
    try {
      const response = await axios.get('/api/register/export', { params: { format: exportFormat }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `active-register-${new Date().toISOString().replace(/[:.]/g, '-')}.${exportFormat}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { setError('Register export failed. No snapshot was downloaded.'); }
    finally { setExporting(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!document || !canEdit) return;
    setSaving(true);
    setError('');
    try {
      const candidate = { ...document };
      for (const [name, value] of Object.entries(structured)) {
        try { candidate[name] = JSON.parse(value); }
        catch { throw new Error(`${label(name)} must be valid JSON.`); }
      }
      const payload = { document: candidate, expected_revision: selected?.revision ?? 0 };
      const { data } = selected ? await axios.put(`/api/register/${selected.id}`, payload) : await axios.post('/api/register', payload);
      await load();
      edit(data);
      setNotice(`Saved revision ${data.revision}.`);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(false); }
  }
  function renderField(field: Field) {
    if (!document) return null;
    const value = document[field.name];
    const immutable = Boolean(selected && ['scope_id', 'enterprise_control_id', 'policy_or_profile', 'profile_version'].includes(field.name));
    const disabled = !canEdit || saving || immutable;
    return <label key={field.name} className={`block min-w-0 space-y-1 ${field.kind === 'json' ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-slate-400">{label(field.name)}{field.kind === 'json' ? ' (JSON)' : ''}</span>
      {field.kind === 'boolean' ? <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={event => change(field.name, event.target.checked)} className="ml-2 accent-teal-500" />
        : field.options ? <select className={inputStyle} value={String(value ?? '')} disabled={disabled} onChange={event => change(field.name, event.target.value || null)}><option value="">Not recorded</option>{field.options.map(option => <option key={option}>{option}</option>)}</select>
          : field.kind === 'json' ? <textarea className={`${inputStyle} font-mono`} rows={5} spellCheck={false} disabled={disabled} value={structured[field.name] ?? JSON.stringify(value ?? [], null, 2)} onChange={event => setStructured(current => ({ ...current, [field.name]: event.target.value }))} />
            : <input className={inputStyle} type={field.kind === 'number' ? 'number' : 'text'} step="any" value={String(value ?? '')} disabled={disabled} onChange={event => change(field.name, event.target.value === '' ? null : field.kind === 'number' ? Number(event.target.value) : event.target.value)} />}
    </label>;
  }
  const visible = records.filter(record => (!filter || record.document.record_type === filter) && `${record.document.scope_id} ${record.document.owner_primary} ${record.document.enterprise_control_id}`.toLowerCase().includes(query.toLowerCase()));

  return <section className="min-w-0 space-y-4" aria-label="Active Register">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100"><ClipboardList className="h-5 w-5 text-teal-400" />Active Register</h2>{access && <p className="break-all text-xs text-slate-400">{access.tenant} · {access.role}</p>}</div>
      <div className="flex items-center gap-2">
        <select aria-label="Export format" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-300" value={exportFormat} disabled={!access || exporting} onChange={event => setExportFormat(event.target.value)}><option value="json">JSON</option><option value="csv">CSV</option></select>
        <button type="button" title="Export register and history" aria-label="Export register and history" disabled={!access || exporting} onClick={() => void download()} className="rounded p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"><Download className="h-4 w-4" /></button>
        <button type="button" title="Refresh register" aria-label="Refresh register" disabled={loading || saving} onClick={() => void load()} className="rounded p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"><RefreshCw className="h-4 w-4" /></button>
        <button type="button" disabled={!canEdit || saving} onClick={() => edit(null)} className="flex items-center gap-2 rounded bg-teal-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" />New record</button>
      </div>
    </div>
    {error && <div role="alert" className="whitespace-pre-wrap break-words border-l-2 border-red-400 bg-red-950/20 p-3 text-sm text-red-300">{error}</div>}
    {notice && <p role="status" className="text-sm text-slate-400">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs text-slate-400">Record type<select className={inputStyle} value={filter} onChange={event => setFilter(event.target.value)}><option value="">All record types</option>{Object.keys(typedFields).map(type => <option key={type}>{type}</option>)}</select></label>
      <label className="space-y-1 text-xs text-slate-400">Search<input className={inputStyle} value={query} onChange={event => setQuery(event.target.value)} type="search" /></label>
    </div>
    <div className="overflow-x-auto border-y border-slate-800" aria-busy={loading}>
      <table className="w-full text-left text-sm"><thead className="bg-slate-950 text-xs text-slate-400"><tr>{['Type', 'Scope', 'Owner', 'Phase', 'Status', 'Revision'].map(title => <th key={title} className="whitespace-nowrap px-3 py-3">{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800">{visible.map(record => <tr key={record.id} className={selected?.id === record.id ? 'bg-teal-950/30' : 'hover:bg-slate-800/40'}><td className="px-3 py-3"><button type="button" onClick={() => edit(record)} className="text-teal-300 underline-offset-4 hover:underline">{record.document.record_type}</button></td><td className="max-w-64 break-words px-3 text-slate-200">{record.document.scope_id}</td><td className="px-3 text-slate-300">{record.document.owner_primary}</td><td className="px-3 text-slate-300">{record.document.phase}</td><td className="px-3 text-slate-300">{record.effective_status ?? record.document.record_status}</td><td className="px-3 text-slate-400">{record.revision}</td></tr>)}</tbody>
      </table>
      {!visible.length && <p className="px-3 py-8 text-sm text-slate-400">{loading ? 'Loading register...' : access ? 'No matching records.' : 'Register unavailable.'}</p>}
    </div>
    {document && <form onSubmit={event => void save(event)} className="space-y-4 border-t border-slate-700 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold text-slate-100">{selected ? `Revision ${selected.revision}` : 'New record'}</h3><div className="flex gap-2">
        {selected && <button type="button" title="Revision history" aria-label="Revision history" className="rounded p-2 text-slate-300 hover:bg-slate-800" onClick={async () => { try { const response = await axios.get(`/api/register/${selected.id}/history`); setHistory(response.data.revisions); } catch (failure) { setError(errorMessage(failure)); } }}><History className="h-4 w-4" /></button>}
        <button type="submit" disabled={!canEdit || saving} className="flex items-center gap-2 rounded bg-teal-500 px-3 py-2 text-sm text-slate-950 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save revision'}</button>
        <button type="button" title="Close editor" aria-label="Close editor" disabled={saving} className="rounded p-2 text-slate-300 hover:bg-slate-800" onClick={() => { setDocument(null); setSelected(null); setHistory(null); }}><X className="h-4 w-4" /></button>
      </div></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-400">Type<select className={inputStyle} value={document.record_type} disabled={Boolean(selected) || !canEdit || saving} onChange={event => { setDocument(blankDocument(event.target.value as RegisterRecordType)); setStructured({}); }}>{Object.keys(typedFields).map(type => <option key={type}>{type}</option>)}</select></label>
        {renderField(choice('phase', phases))}{renderField(choice('record_status', ['draft', 'active', 'paused', 'retired', 'closed']))}
      </div>
      {[groups[0], { title: 'Control attributes', fields: typedFields[document.record_type] }, ...groups.slice(1)].filter(group => group.fields.length).map((group, index) => <details key={group.title} open={index < 2} className="border-b border-slate-800 pb-4"><summary className="cursor-pointer py-2 text-sm font-medium text-slate-200">{group.title}</summary><div className="grid gap-3 pt-2 sm:grid-cols-2">{group.fields.map(renderField)}</div></details>)}
      {history && <section className="space-y-2" aria-label="Revision history"><h4 className="text-sm font-medium text-slate-200">Revision history</h4>{history.map(revision => <details key={revision.revision} className="border-b border-slate-800 py-2"><summary className="cursor-pointer break-words text-xs text-slate-400">Revision {revision.revision} · {revision.actor_id} · {revision.recorded_at}</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all py-3 text-xs text-slate-300">{JSON.stringify(revision.document, null, 2)}</pre></details>)}</section>}
    </form>}
  </section>;
}