import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('license');
  const { simulatorConfig, assessmentResult, confirmSimulation } = useAppStore();

  const handleConfirm = () => {
    confirmSimulation(runSimulation(simulatorConfig));
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Simulator</h1>
        <p className="text-sm text-slate-400">
          Confirm license and population inputs to model the {assessmentResult?.totalCreditsConsumed.toLocaleString()} assessed credits.
        </p>
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

      <div className="flex justify-end border-t border-slate-700 pt-5">
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-medium px-4 py-2 rounded-md text-sm transition-colors"
        >
          Confirm Inputs and View Dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
