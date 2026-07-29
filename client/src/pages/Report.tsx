import { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { calculateGovernanceReadinessScore, generateRecommendations } from '../engine/creditCalculationEngine';
import ReportPreview from '../components/report/ReportPreview';
import ReportDownloadButton from '../components/report/ReportDownloadButton';

export default function Report() {
  const { simulatorConfig, assessmentResult, recommendations } = useAppStore();

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Executive Report</h1>
          <p className="text-sm text-slate-400">
            Preview and download a tailored governance strategy report.
          </p>
        </div>
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
  );
}
