import { useState } from 'react';
import axios from 'axios';
import { Github, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import ApiConfigForm from '../components/assessment/ApiConfigForm';
import AssessmentResults from '../components/assessment/AssessmentResults';
import { calculateIncludedPool } from '../engine/creditCalculationEngine';
import { AssessmentConfig } from '../types';

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

  const handleConnect = () => {
    window.location.href = '/auth/github';
  };

  const handleLogout = async () => {
    try {
      await axios.post('/auth/logout');
    } finally {
      setIsConnected(false);
      resetWorkflow();
      navigate('/');
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
      completeAssessment(result, connectedEnterprise ?? enterpriseSlug);
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
