import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, Play, Search } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { runSimulation, generateRecommendations, calculateGovernanceReadinessScore } from '../engine/creditCalculationEngine';
import DashboardSummary from '../components/dashboard/DashboardSummary';
import GovernanceWorkspace from '../components/dashboard/GovernanceWorkspace';
import AICFlowVisualizer from '../components/visualization/AICFlowVisualizer';
import { flushWorkflow } from '../lib/workflowPersistence';

export default function Dashboard() {
  const navigate = useNavigate();
  const { simulatorConfig, simulatorResult, assessmentResult, setRecommendations, markDashboardReviewed, hasReviewedDashboard, governanceInsights, setGovernanceInsights } =
    useAppStore();
  const activeView = governanceInsights.view;
  const setActiveView = (view: typeof activeView) => setGovernanceInsights({ view });
  const [reviewSaving, setReviewSaving] = useState(false);

  const result = simulatorResult ?? runSimulation(simulatorConfig);
  const recommendations = generateRecommendations(assessmentResult, simulatorConfig);

  useEffect(() => {
    setRecommendations(generateRecommendations(assessmentResult, simulatorConfig));
  }, [assessmentResult, simulatorConfig, setRecommendations]);
  const governanceScore = calculateGovernanceReadinessScore(recommendations);

  const totalUsers =
    simulatorConfig.licenseCountBusiness +
    simulatorConfig.licenseCountEnterprise +
    simulatorConfig.licenseCountCloudAgent +
    simulatorConfig.licenseCountSpark;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Governance Insights</h1>
          <p className="text-sm text-slate-400">
            {simulatorConfig.enterpriseName} · AI Credits governance at a glance
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-md text-sm transition-colors"
          >
            <Search className="w-4 h-4" /> Run New Assessment
          </button>
          <button
            onClick={() => navigate('/simulator')}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-medium px-4 py-2 rounded-md text-sm transition-colors"
          >
            <Play className="w-4 h-4" /> Start Simulation
          </button>
          <button type="button" disabled={reviewSaving} onClick={async () => {
            setReviewSaving(true);
            try { await flushWorkflow(); markDashboardReviewed(); await flushWorkflow(); navigate('/recommendations'); }
            catch { if (!hasReviewedDashboard) useAppStore.setState({ hasReviewedDashboard: false }); }
            finally { setReviewSaving(false); }
          }}
            className="flex items-center gap-2 rounded-md border border-teal-700 px-4 py-2 text-sm text-teal-300 hover:bg-slate-800">
            <CheckCheck className="h-4 w-4" /> {reviewSaving ? 'Saving Review...' : hasReviewedDashboard ? 'View Recommendations' : 'Complete Review'}
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Governance insight views" className="flex flex-wrap gap-1 border-b border-slate-700 pb-2">
        {(['overview', 'findings', 'register'] as const).map((view, index, views) => (
          <button key={view} type="button" role="tab" id={`insights-tab-${view}`} aria-controls={`insights-panel-${view}`}
            aria-selected={activeView === view} tabIndex={activeView === view ? 0 : -1}
            onClick={() => setActiveView(view)} onKeyDown={event => {
              const next = event.key === 'ArrowRight' ? (index + 1) % views.length : event.key === 'ArrowLeft' ? (index + views.length - 1) % views.length : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : null;
              if (next !== null) { event.preventDefault(); setActiveView(views[next]); document.getElementById(`insights-tab-${views[next]}`)?.focus(); }
            }} className={`rounded px-4 py-2 text-sm font-medium ${activeView === view ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>
            {view === 'overview' ? 'Overview' : view === 'findings' ? `Findings (${recommendations.length})` : 'Register'}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`insights-panel-${activeView}`} aria-labelledby={`insights-tab-${activeView}`} className="space-y-6">
      {activeView === 'overview' && <>
      <h2 className="text-base font-semibold text-slate-200">Modeled exposure</h2>
      <DashboardSummary result={result} totalUsers={totalUsers} />
      </>}
      <GovernanceWorkspace key={activeView} view={activeView} assessment={assessmentResult} recommendations={recommendations} score={governanceScore} />
      {activeView === 'overview' && <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">Modeled control flow</h2>
        <p className="text-xs text-slate-400">Simulated states, not observed provider enforcement.</p>
        <AICFlowVisualizer />
      </section>}
      </section>
    </div>
  );
}
