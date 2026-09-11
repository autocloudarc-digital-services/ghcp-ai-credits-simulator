import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAppStore } from '../../store/appStore';
import { calculateIncludedPool, calculateProjectedBurnRate, runSimulation } from '../../engine/creditCalculationEngine';
import PoolCylinder from './nodes/PoolCylinder';
import GovernanceShield from './nodes/GovernanceShield';
import DecisionDiamond from './nodes/DecisionDiamond';
import OverageTicker from './nodes/OverageTicker';
import UlbTierBars from './nodes/UlbTierBars';
import CostCenterRing from './nodes/CostCenterRing';
import EnterpriseWall from './nodes/EnterpriseWall';
import StopBlock from './nodes/StopBlock';
import ContinueArrow from './nodes/ContinueArrow';
import StarField from './effects/StarField';
import FlowParticles from './effects/FlowParticles';
import SceneControls from './controls/SceneControls';
import FallbackToggle from './controls/FallbackToggle';
import governanceTiers from 'ghcp-ai-credits-simulator-shared/governanceTiers.json';

const NODE_Y = {
  pool: 9,
  shield: 6.5,
  decision: 4,
  overage: 1.5,
  ulb: -1,
  costCenter: -3.5,
  wall: -6,
  outcome: -8.5,
};

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function Fallback2DFlow({
  fillLevel,
  utilization,
  overageActive,
  overageCredits,
}: {
  fillLevel: number;
  utilization: number;
  overageActive: boolean;
  overageCredits: number;
}) {
  const steps = [
    { label: 'Applicable ULB', value: 'Individual > Cost center > Universal; always hard-stop', color: 'bg-blue-500' },
    { label: 'Enterprise Included AI Credits Pool', value: `${Math.round(fillLevel * 100)}% full`, color: 'bg-teal-400' },
    { label: 'Paid usage policy', value: 'Required before metered usage', color: 'bg-blue-500' },
    { label: 'Budget Exceeded?', value: utilization > 0.8 ? 'At risk' : 'Healthy', color: 'bg-amber-400' },
    { label: 'Overage Ticker', value: `${Math.round(overageCredits).toLocaleString()} credits`, color: 'bg-orange-500' },
    { label: 'Modeled usage cohorts', value: 'Universal / Overage / Abundant / Exponential', color: 'bg-teal-400' },
    { label: 'Cost Center Ring', value: `${Math.round(utilization * 100)}% utilized`, color: 'bg-teal-400' },
    ...governanceTiers.filter(control => control.group === 'Metered budgets').map(control => ({ label: control.title, value: 'Scope, exclusions, and Stop usage require verification', color: 'bg-amber-400' })),
    {
      label: overageActive ? 'Modeled overage exposure' : 'No modeled overage',
      value: 'Not a provider enforcement decision',
      color: overageActive ? 'bg-red-500' : 'bg-green-400',
    },
  ];

  return (
    <div className="space-y-2">
      {steps.map((s, idx) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
          <div className="flex-1 min-w-0 bg-slate-900/60 border border-slate-700 rounded-md px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 items-center justify-between">
            <span className="text-sm text-slate-300">{s.label}</span>
            <span className="text-xs font-numeric text-slate-400">{s.value}</span>
          </div>
          {idx < steps.length - 1 && <span className="sr-only">then</span>}
        </div>
      ))}
    </div>
  );
}

export default function AICFlowVisualizer() {
  const { simulatorConfig, simulatorResult, use3DVisualizer } = useAppStore();
  const [webglOk] = useState(isWebGLAvailable);

  const result = useMemo(() => simulatorResult ?? runSimulation(simulatorConfig), [simulatorConfig, simulatorResult]);
  const pool = calculateIncludedPool(simulatorConfig);
  const burnRate = calculateProjectedBurnRate(simulatorConfig);
  const projectedTotal = burnRate * 30;
  const fillLevel = pool > 0 ? Math.max(0, Math.min(1, 1 - result.projectedOverageCredits / pool)) : 0;
  const utilization = pool > 0 ? Math.min(1.2, projectedTotal / pool) : 0;
  const overageActive = result.projectedOverageCredits > 0;

  const allocation = simulatorConfig.populationAllocation;
  const tierBars = [
    { label: 'Universal', value: allocation.universalUlb, max: 200, color: '#2dd4bf' },
    { label: 'Overage', value: allocation.overageUsers, max: 200, color: '#fbbf24' },
    { label: 'Abundant', value: allocation.abundantUsers, max: 200, color: '#3b82f6' },
    { label: 'Exponential', value: allocation.exponentialUsers, max: 200, color: '#ef4444' },
  ];

  const flowPath: [number, number, number][] = [
    [0, NODE_Y.pool - 1.5, 0],
    [0, NODE_Y.shield, 0],
    [0, NODE_Y.decision, 0],
    [0, NODE_Y.overage, 0],
    [0, NODE_Y.ulb, 0],
    [0, NODE_Y.costCenter, 0],
    [0, NODE_Y.wall, 0],
    [0, NODE_Y.outcome, 0],
  ];

  const showFallback = !use3DVisualizer || !webglOk;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">AI Credits Flow Visualizer</h3>
        <FallbackToggle />
      </div>
      {showFallback ? (
        <div className="p-4">
          {!webglOk && (
            <p className="text-xs text-amber-400 mb-3">
              WebGL is unavailable in this environment; showing the 2D fallback flow.
            </p>
          )}
          <Fallback2DFlow
            fillLevel={fillLevel}
            utilization={utilization}
            overageActive={overageActive}
            overageCredits={result.projectedOverageCredits}
          />
        </div>
      ) : (
        <div style={{ height: 520, background: '#050a14' }}>
          <Canvas>
            <Suspense fallback={null}>
              <ambientLight intensity={0.4} />
              <pointLight position={[0, NODE_Y.pool + 2, 3]} color="#2dd4bf" intensity={2} distance={12} />
              <pointLight position={[0, NODE_Y.wall + 2, 3]} color="#3b82f6" intensity={2} distance={12} />
              <StarField count={500} />

              <PoolCylinder position={[0, NODE_Y.pool, 0]} fillLevel={fillLevel} />
              <GovernanceShield position={[0, NODE_Y.shield, 0]} />
              <DecisionDiamond position={[0, NODE_Y.decision, 0]} utilization={utilization} />
              <OverageTicker
                position={[0, NODE_Y.overage, 0]}
                overageCredits={result.projectedOverageCredits}
                active={overageActive}
              />
              <UlbTierBars position={[0, NODE_Y.ulb, 0]} tiers={tierBars} />
              <CostCenterRing position={[0, NODE_Y.costCenter, 0]} utilization={utilization} />
              <EnterpriseWall position={[0, NODE_Y.wall, 0]} />
              <StopBlock position={[-1.4, NODE_Y.outcome, 0]} active={overageActive} />
              <ContinueArrow position={[1.4, NODE_Y.outcome, 0]} active={!overageActive} />

              <FlowParticles path={flowPath} color={overageActive ? '#ef4444' : '#2dd4bf'} />

              <SceneControls />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
}
