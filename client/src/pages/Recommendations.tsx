import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import {
  calculateGovernanceReadinessScore,
  generateRecommendations,
} from '../engine/creditCalculationEngine';
import RecommendationCard from '../components/recommendations/RecommendationCard';
import BudgetHierarchyDiagram from '../components/recommendations/BudgetHierarchyDiagram';
import GovernanceReadinessScore from '../components/dashboard/GovernanceReadinessScore';

export default function Recommendations() {
  const { assessmentResult, simulatorConfig, recommendations, setRecommendations } = useAppStore();

  useEffect(() => {
    setRecommendations(generateRecommendations(assessmentResult, simulatorConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentResult, simulatorConfig]);

  const governanceScore = useMemo(
    () => calculateGovernanceReadinessScore(recommendations),
    [recommendations]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Recommendations</h1>
        <p className="text-sm text-slate-400">
          Data-driven governance recommendations mapped to the 10 Budget Profile Classes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {recommendations.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center text-slate-500">
              No recommendations available. Configure the simulator or run an assessment first.
            </div>
          ) : (
            recommendations.map((rec, idx) => (
              <RecommendationCard key={`${rec.budgetClass.slug}-${idx}`} recommendation={rec} />
            ))
          )}
        </div>
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col items-center gap-3">
            <GovernanceReadinessScore score={governanceScore} size={120} />
          </div>
          <BudgetHierarchyDiagram />
        </div>
      </div>
    </div>
  );
}
