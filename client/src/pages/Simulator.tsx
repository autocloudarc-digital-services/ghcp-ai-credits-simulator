import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { runSimulation } from '../engine/creditCalculationEngine';
import LicensePoolConfig from '../components/simulator/LicensePoolConfig';
import PopulationAllocation from '../components/simulator/PopulationAllocation';
import WhatIfScenarioBuilder from '../components/simulator/WhatIfScenarioBuilder';

const TABS = [
  { id: 'license', label: 'License & Pool Config' },
  { id: 'population', label: 'Developer Population' },
  { id: 'whatif', label: 'What-If Scenarios' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Simulator() {
  const [activeTab, setActiveTab] = useState<TabId>('license');
  const { simulatorConfig, setSimulatorResult } = useAppStore();

  useEffect(() => {
    setSimulatorResult(runSimulation(simulatorConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulatorConfig]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Simulator</h1>
        <p className="text-sm text-slate-400">Model license pools, developer population, and what-if scenarios.</p>
      </div>

      <div className="flex gap-2 border-b border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-teal-400 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'license' && <LicensePoolConfig />}
      {activeTab === 'population' && <PopulationAllocation />}
      {activeTab === 'whatif' && <WhatIfScenarioBuilder />}
    </div>
  );
}
