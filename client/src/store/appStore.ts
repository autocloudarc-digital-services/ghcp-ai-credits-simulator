import { create } from 'zustand';
import {
  AssessmentResult,
  Recommendation,
  ScenarioConfig,
  SimulatorConfig,
  SimulatorResult,
} from '../types';

export const defaultSimulatorConfig: SimulatorConfig = {
  enterpriseName: 'AutoCloudArc Enterprise',
  licenseCountBusiness: 120,
  licenseCountEnterprise: 40,
  licenseCountCloudAgent: 15,
  licenseCountSpark: 25,
  billingCycleStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10),
  currentDayOfCycle: 12,
  creditsConsumedSoFar: 210000,
  populationAllocation: {
    universalUlb: 150,
    overageUsers: 30,
    abundantUsers: 15,
    exponentialUsers: 5,
  },
};

interface AppState {
  // Simulator
  simulatorConfig: SimulatorConfig;
  simulatorResult: SimulatorResult | null;
  scenarios: ScenarioConfig[];

  // Assessment
  assessmentResult: AssessmentResult | null;
  isAssessing: boolean;
  isConnected: boolean;
  connectedEnterprise: string | null;

  // Recommendations
  recommendations: Recommendation[];

  // 3D Scene
  use3DVisualizer: boolean;

  // Actions
  setSimulatorConfig: (config: Partial<SimulatorConfig>) => void;
  setSimulatorResult: (result: SimulatorResult) => void;
  addScenario: (scenario: ScenarioConfig) => void;
  updateScenario: (id: string, updates: Partial<ScenarioConfig>) => void;
  removeScenario: (id: string) => void;
  setAssessmentResult: (result: AssessmentResult) => void;
  setIsAssessing: (val: boolean) => void;
  setIsConnected: (val: boolean, enterprise?: string) => void;
  setRecommendations: (recs: Recommendation[]) => void;
  toggle3DVisualizer: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  simulatorConfig: defaultSimulatorConfig,
  simulatorResult: null,
  scenarios: [],

  assessmentResult: null,
  isAssessing: false,
  isConnected: false,
  connectedEnterprise: null,

  recommendations: [],

  use3DVisualizer: true,

  setSimulatorConfig: (config) =>
    set((state) => ({
      simulatorConfig: {
        ...state.simulatorConfig,
        ...config,
        populationAllocation: {
          ...state.simulatorConfig.populationAllocation,
          ...(config.populationAllocation ?? {}),
        },
      },
    })),

  setSimulatorResult: (result) => set({ simulatorResult: result }),

  addScenario: (scenario) =>
    set((state) => ({ scenarios: [...state.scenarios, scenario].slice(-4) })),

  updateScenario: (id, updates) =>
    set((state) => ({
      scenarios: state.scenarios.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  removeScenario: (id) =>
    set((state) => ({ scenarios: state.scenarios.filter((s) => s.id !== id) })),

  setAssessmentResult: (result) => set({ assessmentResult: result }),
  setIsAssessing: (val) => set({ isAssessing: val }),
  setIsConnected: (val, enterprise) =>
    set({ isConnected: val, connectedEnterprise: enterprise ?? null }),
  setRecommendations: (recs) => set({ recommendations: recs }),
  toggle3DVisualizer: () => set((state) => ({ use3DVisualizer: !state.use3DVisualizer })),
}));
