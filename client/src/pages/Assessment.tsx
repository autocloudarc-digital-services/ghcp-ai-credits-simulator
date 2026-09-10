import { useEffect, useState } from 'react';
import axios from 'axios';
import { Github, LogOut, ShieldCheck, RefreshCw, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import ApiConfigForm from '../components/assessment/ApiConfigForm';
import AssessmentResults from '../components/assessment/AssessmentResults';
import { calculateIncludedPool } from '../engine/creditCalculationEngine';
import { AssessmentConfig } from '../types';
import { flushWorkflow, stopWorkflowPersistence } from '../lib/workflowPersistence';

async function startAssessment(config: AssessmentConfig): Promise<string> {
  try {
    const response = await axios.post('/api/assessment/start', config);
    return response.data.assessmentId;
  } finally {
    delete config.enterpriseBillingToken;
  }
}

export default function Assessment() {
  const navigate = useNavigate();
  const {
    isConnected,
    connectedEnterprise,
    setIsConnected,
    isAssessing,
    setIsAssessing,
    assessmentResult,
    completeAssessment,
    resetWorkflow,
    simulatorConfig,
  } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; status: string; created_at: string; input: { enterpriseSlug: string } }>>([]);
  const [selectedAssessment, setSelectedAssessment] = useState('');

  const refreshHistory = async () => {
    try { setHistory((await axios.get('/api/assessment/history')).data); }
    catch { setError('Saved assessment history could not be loaded.'); }
  };
  useEffect(() => {
    if (isConnected && !isAssessing) void refreshHistory();
    if (!isConnected) { setHistory([]); setSelectedAssessment(''); }
  }, [isConnected, isAssessing]);

  const restoreAssessment = async () => {
    const selected = history.find(item => item.id === selectedAssessment);
    if (!selected || !window.confirm('Restore this assessment and reset the current simulator review progress?')) return;
    try {
      const response = await axios.get(`/api/assessment/results/${selected.id}`);
      completeAssessment(response.data, selected.input.enterpriseSlug, selected.id);
      await flushWorkflow();
      setError(null);
    } catch { setError('Could not restore and save the selected assessment.'); }
  };

  const handleConnect = () => {
    window.location.href = '/auth/github';
  };

  const handleLogout = async () => {
    try {
      try { await flushWorkflow(); }
      catch { if (!window.confirm('Changes are not saved. Disconnect and discard unsaved changes in this tab?')) return; }
      await axios.post('/auth/logout');
      stopWorkflowPersistence();
      setIsConnected(false);
      resetWorkflow();
      navigate('/');
    } catch {
      setError('Could not save changes or disconnect. Retry when the server is available.');
    }
  };

  const pollAssessment = async (assessmentId: string) => {
    const maxAttempts = 120;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusRes = await axios.get(`/api/assessment/status/${assessmentId}`);
      if (statusRes.data.status === 'complete') {
        const resultsRes = await axios.get(`/api/assessment/results/${assessmentId}`);
        return resultsRes.data;
      }
      if (statusRes.data.status === 'failed') {
        throw new Error(statusRes.data.error || 'Assessment failed');
      }
      await new Promise((r) => setTimeout(r, 750));
    }
    throw new Error('Assessment timed out');
  };

  const handleAssess = async (config: AssessmentConfig) => {
    const enterpriseSlug = config.enterpriseSlug;
    setIsAssessing(true);
    setError(null);
    resetWorkflow();
    try {
      const assessmentId = await startAssessment(config);
      const result = await pollAssessment(assessmentId);
      completeAssessment(result, connectedEnterprise ?? enterpriseSlug, assessmentId);
      await flushWorkflow();
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Failed to start assessment.'
          : err instanceof Error
            ? err.message
            : 'Failed to start assessment.'
      );
    } finally {
      setIsAssessing(false);
    }
  };

  const totalIncludedPool = calculateIncludedPool(simulatorConfig);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Assessment</h1>
          <p className="text-sm text-slate-400">
            Connect a GitHub Enterprise account to assess live AI credit consumption.
          </p>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <ShieldCheck className="w-4 h-4" /> GitHub authenticated
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-md text-sm"
            >
              <LogOut className="w-4 h-4" /> Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 px-4 py-2 rounded-md text-sm transition-colors"
          >
            <Github className="w-4 h-4" /> Connect GitHub Enterprise
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {!isConnected && (
        <div className="bg-amber-400/10 border border-amber-400/40 text-amber-300 text-sm rounded-md px-4 py-3">
          Connect a GitHub Enterprise account via OAuth to enable live assessment. You can still preview the
          assessment configuration below.
        </div>
      )}

      {isConnected && <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400">
          Recent assessments
          <select aria-label="Saved assessment" value={selectedAssessment} onChange={event => setSelectedAssessment(event.target.value)} className="h-9 w-full min-w-0 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100">
            <option value="">Select a saved assessment</option>
            {history.map(item => <option key={item.id} value={item.id} disabled={item.status !== 'complete'}>{item.input.enterpriseSlug} / {new Date(item.created_at).toLocaleString()} / {item.status}</option>)}
          </select>
        </label>
        <button type="button" title="Refresh assessment history" aria-label="Refresh assessment history" onClick={() => { void refreshHistory(); }} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700"><RefreshCw className="h-4 w-4" /></button>
        <button type="button" disabled={!selectedAssessment || isAssessing} onClick={() => { void restoreAssessment(); }} className="flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm disabled:opacity-40"><History className="h-4 w-4" /> Restore</button>
      </div>}

      <ApiConfigForm
        onSubmit={handleAssess}
        isSubmitting={isAssessing}
        disabled={!isConnected}
      />

      {assessmentResult && (
        <AssessmentResults result={assessmentResult} totalIncludedPool={totalIncludedPool} />
      )}
    </div>
  );
}
