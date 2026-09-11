import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, ClipboardList, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { calculateGovernanceReadinessScore, generateRecommendations } from '../engine/creditCalculationEngine';
import CostCenterReporting from '../components/report/CostCenterReporting';
import ReportPreview from '../components/report/ReportPreview';
import ReportDownloadButton from '../components/report/ReportDownloadButton';
import ActiveRegister from '../components/report/ActiveRegister';

export default function Report() {
  const { simulatorConfig, assessmentResult, recommendations } = useAppStore();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<'cost-centers' | 'executive' | 'register'>(() => searchParams.get('view') === 'register' ? 'register' : 'cost-centers');

  const effectiveRecommendations = useMemo(
    () => (recommendations.length > 0 ? recommendations : generateRecommendations(assessmentResult, simulatorConfig)),
    [recommendations, assessmentResult, simulatorConfig]
  );

  const governanceScore = useMemo(
    () => calculateGovernanceReadinessScore(effectiveRecommendations),
    [effectiveRecommendations]
  );

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">AI Credits Reporting</h1>
          <p className="text-sm text-slate-400">
            Reconcile cost-center showback, included value, and incremental chargeback.
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Report views" className="inline-flex flex-wrap rounded-md border border-slate-700 bg-slate-950 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'cost-centers'}
          onClick={() => setActiveView('cost-centers')}
          className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
            activeView === 'cost-centers' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Building2 className="h-4 w-4" /> Cost center reporting
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'executive'}
          onClick={() => setActiveView('executive')}
          className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
            activeView === 'executive' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <FileText className="h-4 w-4" /> Executive report
        </button>
        <button type="button" role="tab" aria-selected={activeView === 'register'} onClick={() => setActiveView('register')}
          className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${activeView === 'register' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-slate-100'}`}>
          <ClipboardList className="h-4 w-4" /> Active Register
        </button>
      </div>

      {activeView === 'cost-centers' ? (
        <CostCenterReporting
          snapshot={assessmentResult?.costCenterReporting ?? null}
          includedCreditBudget={assessmentResult?.includedCreditPools[0]?.limit ?? 0}
        />
      ) : activeView === 'register' ? <ActiveRegister /> : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ReportDownloadButton
              simulatorConfig={simulatorConfig}
              assessmentResult={assessmentResult}
              recommendations={effectiveRecommendations}
            />
          </div>
          <ReportPreview
            simulatorConfig={simulatorConfig}
            assessmentResult={assessmentResult}
            recommendations={effectiveRecommendations}
            governanceScore={governanceScore}
          />
        </div>
      )}
    </div>
  );
}
