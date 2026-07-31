import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { runSimulation } from '../engine/creditCalculationEngine';
import LicensePoolConfig from '../components/simulator/LicensePoolConfig';
import PopulationAllocation from '../components/simulator/PopulationAllocation';
import WhatIfScenarioBuilder from '../components/simulator/WhatIfScenarioBuilder';
import {
  createPopulationAllocationFormSchema,
  licensePoolFormSchema,
} from '../schemas/forms';

const TABS = [
  { id: 'license', label: 'License & Pool Config' },
  { id: 'population', label: 'Developer Population' },
  { id: 'whatif', label: 'What-If Scenarios' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Simulator() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('license');
  const [validationError, setValidationError] = useState<string | null>(null);
  const hasValidLicenseInputs = useRef(true);
  const hasValidPopulationAllocation = useRef(true);
  const { simulatorConfig, assessmentResult, confirmSimulation } = useAppStore();

  const handleConfirm = () => {
    if (!hasValidLicenseInputs.current) {
      setActiveTab('license');
      setValidationError('Resolve the highlighted license and pool fields before continuing.');
      return;
    }

    if (!hasValidPopulationAllocation.current) {
      setActiveTab('population');
      setValidationError('Allocate every licensed user to exactly one population tier before continuing.');
      return;
    }

    const licenseValidation = licensePoolFormSchema.safeParse({
      enterpriseName: simulatorConfig.enterpriseName,
      licenseCountBusiness: simulatorConfig.licenseCountBusiness,
      licenseCountEnterprise: simulatorConfig.licenseCountEnterprise,
      licenseCountCloudAgent: simulatorConfig.licenseCountCloudAgent,
      licenseCountSpark: simulatorConfig.licenseCountSpark,
      billingCycleStartDate: simulatorConfig.billingCycleStartDate,
      currentDayOfCycle: simulatorConfig.currentDayOfCycle,
      creditsConsumedSoFar: simulatorConfig.creditsConsumedSoFar ?? 0,
    });
    if (!licenseValidation.success) {
      setActiveTab('license');
      setValidationError(licenseValidation.error.issues[0].message);
      return;
    }

    const totalUsers =
      simulatorConfig.licenseCountBusiness +
      simulatorConfig.licenseCountEnterprise +
      simulatorConfig.licenseCountCloudAgent +
      simulatorConfig.licenseCountSpark;
    const allocationValidation = createPopulationAllocationFormSchema(totalUsers).safeParse(
      simulatorConfig.populationAllocation
    );
    if (!allocationValidation.success) {
      setActiveTab('population');
      setValidationError(allocationValidation.error.issues[0].message);
      return;
    }

    setValidationError(null);
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

      {activeTab === 'license' && (
        <LicensePoolConfig onValidityChange={(isValid) => { hasValidLicenseInputs.current = isValid; }} />
      )}
      {activeTab === 'population' && (
        <PopulationAllocation onValidityChange={(isValid) => { hasValidPopulationAllocation.current = isValid; }} />
      )}
      {activeTab === 'whatif' && <WhatIfScenarioBuilder />}

      {validationError && (
        <div role="alert" className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-md px-4 py-3">
          {validationError}
        </div>
      )}

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
