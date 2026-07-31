import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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

  // Workflow
  hasConfirmedSimulation: boolean;
  hasReviewedDashboard: boolean;
  hasReviewedRecommendations: boolean;

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
  completeAssessment: (result: AssessmentResult, enterpriseName: string) => void;
  confirmSimulation: (result: SimulatorResult) => void;
  markDashboardReviewed: () => void;
  markRecommendationsReviewed: () => void;
  resetWorkflow: () => void;
  toggle3DVisualizer: () => void;
}

export const useAppStore = create<AppState>()(persist((set) => ({
  simulatorConfig: defaultSimulatorConfig,
  simulatorResult: null,
  scenarios: [],

  assessmentResult: null,
  isAssessing: false,
  isConnected: false,
  connectedEnterprise: null,

  hasConfirmedSimulation: false,
  hasReviewedDashboard: false,
  hasReviewedRecommendations: false,

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
      simulatorResult: null,
      hasConfirmedSimulation: false,
      hasReviewedDashboard: false,
      hasReviewedRecommendations: false,
      recommendations: [],
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
  completeAssessment: (result, enterpriseName) =>
    set((state) => ({
      assessmentResult: result,
      simulatorConfig: {
        ...state.simulatorConfig,
        enterpriseName,
        creditsConsumedSoFar: result.totalCreditsConsumed,
      },
      simulatorResult: null,
      scenarios: [],
      recommendations: [],
      hasConfirmedSimulation: false,
      hasReviewedDashboard: false,
      hasReviewedRecommendations: false,
    })),
  confirmSimulation: (result) =>
    set({
      simulatorResult: result,
      recommendations: [],
      hasConfirmedSimulation: true,
      hasReviewedDashboard: false,
      hasReviewedRecommendations: false,
    }),
  markDashboardReviewed: () => set({ hasReviewedDashboard: true }),
  markRecommendationsReviewed: () => set({ hasReviewedRecommendations: true }),
  resetWorkflow: () =>
    set({
      assessmentResult: null,
      simulatorResult: null,
      scenarios: [],
      recommendations: [],
      hasConfirmedSimulation: false,
      hasReviewedDashboard: false,
      hasReviewedRecommendations: false,
    }),
  toggle3DVisualizer: () => set((state) => ({ use3DVisualizer: !state.use3DVisualizer })),
}), {
  name: 'ghcp-ai-credits-workflow',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    simulatorConfig: state.simulatorConfig,
    simulatorResult: state.simulatorResult,
    scenarios: state.scenarios,
    assessmentResult: state.assessmentResult,
    recommendations: state.recommendations,
    hasConfirmedSimulation: state.hasConfirmedSimulation,
    hasReviewedDashboard: state.hasReviewedDashboard,
    hasReviewedRecommendations: state.hasReviewedRecommendations,
    use3DVisualizer: state.use3DVisualizer,
  }),
}));
