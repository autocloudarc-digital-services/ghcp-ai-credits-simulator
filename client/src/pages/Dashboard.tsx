import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { runSimulation, generateRecommendations, calculateGovernanceReadinessScore } from '../engine/creditCalculationEngine';
import DashboardSummary from '../components/dashboard/DashboardSummary';
import GovernanceReadinessScore from '../components/dashboard/GovernanceReadinessScore';
import AICFlowVisualizer from '../components/visualization/AICFlowVisualizer';

export default function Dashboard() {
  const navigate = useNavigate();
  const { simulatorConfig, simulatorResult, setSimulatorResult, assessmentResult, recommendations, setRecommendations } =
    useAppStore();

  useEffect(() => {
    if (!simulatorResult) {
      setSimulatorResult(runSimulation(simulatorConfig));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = simulatorResult ?? runSimulation(simulatorConfig);

  useEffect(() => {
    setRecommendations(generateRecommendations(assessmentResult, simulatorConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentResult, simulatorConfig]);

  const governanceScore = useMemo(
    () => calculateGovernanceReadinessScore(recommendations),
    [recommendations]
  );

  const totalUsers =
    simulatorConfig.licenseCountBusiness +
    simulatorConfig.licenseCountEnterprise +
    simulatorConfig.licenseCountCloudAgent +
    simulatorConfig.licenseCountSpark;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400">
            {simulatorConfig.enterpriseName} · AI Credits governance at a glance
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/assessment')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-md text-sm transition-colors"
          >
            <Search className="w-4 h-4" /> Run Assessment
          </button>
          <button
            onClick={() => navigate('/simulator')}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-medium px-4 py-2 rounded-md text-sm transition-colors"
          >
            <Play className="w-4 h-4" /> Start Simulation
          </button>
        </div>
      </div>

      <DashboardSummary result={result} totalUsers={totalUsers} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AICFlowVisualizer />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col items-center justify-center gap-4">
          <GovernanceReadinessScore score={governanceScore} />
          <p className="text-xs text-slate-500 text-center">
            Based on {recommendations.length} outstanding recommendation
            {recommendations.length === 1 ? '' : 's'} across the three governance tiers.
          </p>
        </div>
      </div>
    </div>
  );
}
