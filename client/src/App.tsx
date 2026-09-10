import { ReactNode, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  SlidersHorizontal,
  Search,
  ListChecks,
  FileText,
  LockKeyhole,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Simulator from './pages/Simulator';
import Assessment from './pages/Assessment';
import Recommendations from './pages/Recommendations';
import Report from './pages/Report';
import { useAppStore } from './store/appStore';
import { loadWorkflow, flushWorkflow, stopWorkflowPersistence } from './lib/workflowPersistence';

const NAV_ITEMS = [
  { to: '/', label: 'Assessment', icon: Search, requirement: 'assessment' },
  { to: '/simulator', label: 'Simulator', icon: SlidersHorizontal, requirement: 'simulation' },
  { to: '/dashboard', label: 'Governance Insights', icon: LayoutDashboard, requirement: 'dashboard' },
  { to: '/recommendations', label: 'Recommendations', icon: ListChecks, requirement: 'recommendations' },
  { to: '/report', label: 'Reports', icon: FileText, requirement: 'report' },
];

function WorkflowGate({ allowed, redirectTo, children }: { allowed: boolean; redirectTo: string; children: ReactNode }) {
  return allowed ? children : <Navigate to={redirectTo} replace />;
}

export default function App() {
  const [hasCheckedAuthentication, setHasCheckedAuthentication] = useState(false);
  const {
    assessmentResult,
    setIsConnected,
    resetWorkflow,
    hasConfirmedSimulation,
    hasReviewedDashboard,
    persistenceStatus,
    persistenceError,
    hydrationVersion,
  } = useAppStore();

  useEffect(() => {
    let active = true;
    axios
      .get('/auth/status')
      .then(async (response) => {
        if (!active) return;
        if (response.data.connected) {
          setIsConnected(true, response.data.enterprise);
          await loadWorkflow().catch(() => {});
        } else {
          setIsConnected(false);
          resetWorkflow();
        }
      })
      .catch(() => {
        if (!active) return;
        setIsConnected(false);
        resetWorkflow();
      })
      .finally(() => { if (active) setHasCheckedAuthentication(true); });
    return () => { active = false; stopWorkflowPersistence(); };
  }, [resetWorkflow, setIsConnected]);

  const completedAssessment = assessmentResult !== null;
  const access = {
    assessment: true,
    simulation: completedAssessment,
    dashboard: completedAssessment && hasConfirmedSimulation,
    recommendations: completedAssessment && hasConfirmedSimulation && hasReviewedDashboard,
    report: true,
  };

  const lockReason = {
    assessment: '',
    simulation: 'Complete an assessment first',
    dashboard: 'Confirm simulator inputs first',
    recommendations: 'Review the dashboard first',
    report: '',
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100 lg:flex-row">
      <aside className="w-full shrink-0 bg-slate-950/60 border-b border-slate-800 flex flex-col lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 lg:px-5 lg:py-5">
          <Sparkles className="w-6 h-6 text-teal-400" />
          <div>
            <div className="text-sm font-semibold leading-tight">GHCP AI Credits</div>
            <div className="text-xs text-slate-400 leading-tight">Simulator</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 lg:block lg:flex-1 lg:space-y-1 lg:overflow-visible lg:py-4">
          {NAV_ITEMS.map((item, index) => {
            const isUnlocked = access[item.requirement as keyof typeof access];
            return isUnlocked ? (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-400/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent'
                  }`
                }
              >
                <span className="w-4 text-xs text-center">{index + 1}</span>
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ) : (
              <div
                key={item.to}
                title={lockReason[item.requirement as keyof typeof lockReason]}
                className="flex shrink-0 items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-600 cursor-not-allowed border border-transparent"
              >
                <span className="w-4 text-xs text-center">{index + 1}</span>
                <item.icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                <LockKeyhole className="w-3.5 h-3.5" />
              </div>
            );
          })}
        </nav>
        <div className="hidden px-5 py-4 border-t border-slate-800 text-xs text-slate-500 lg:block">
          Governance for GitHub Copilot AI Credits under Usage-Based Billing.
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {persistenceStatus !== 'idle' && <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-400" role="status" aria-live="polite">
          <span>{persistenceError ?? (persistenceStatus === 'saving' ? 'Saving...' : persistenceStatus === 'loading' ? 'Loading saved data...' : 'Saved to PostgreSQL')}</span>
          {persistenceError && <>
            <button type="button" className="flex items-center gap-1 text-teal-400" onClick={() => { void flushWorkflow().catch(() => {}); }}><RefreshCw className="h-3 w-3" /> Retry save</button>
            <button type="button" className="flex items-center gap-1 text-teal-400" onClick={() => {
              if (window.confirm('Reload saved data and discard unsaved changes in this tab?')) void loadWorkflow().catch(() => {});
            }}><RefreshCw className="h-3 w-3" /> Reload saved data</button>
          </>}
        </div>}
        {!hasCheckedAuthentication ? (
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-400">
            Validating GitHub session…
          </div>
        ) : <Routes key={hydrationVersion}>
          <Route path="/" element={<Assessment />} />
          <Route path="/assessment" element={<Navigate to="/" replace />} />
          <Route
            path="/simulator"
            element={<WorkflowGate allowed={completedAssessment} redirectTo="/"><Simulator /></WorkflowGate>}
          />
          <Route
            path="/dashboard"
            element={<WorkflowGate allowed={access.dashboard} redirectTo={completedAssessment ? '/simulator' : '/'}><Dashboard /></WorkflowGate>}
          />
          <Route
            path="/recommendations"
            element={<WorkflowGate allowed={access.recommendations} redirectTo={access.dashboard ? '/dashboard' : completedAssessment ? '/simulator' : '/'}><Recommendations /></WorkflowGate>}
          />
          <Route
            path="/report"
            element={<Report />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>}
      </main>
    </div>
  );
}
