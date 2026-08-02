// NOTE: This is a server-local mirror of shared/types.ts. It exists because
// the server's tsconfig.json uses "rootDir": "./src", which prevents `tsc`
// from emitting output for source files outside of server/src (like
// shared/types.ts) while producing a flat dist/ matching the package.json
// "start" script. Keep this file in sync with shared/types.ts.

export interface BudgetProfileClass {
  id: number;
  name: string;
  slug: string;
  scope: 'enterprise' | 'organization' | 'cost-center' | 'user';
  budgetType: 'included' | 'metered-overage' | 'ulb' | 'org-policy';
  skus: string[];
  licenseCountBusiness?: number;
  licenseCountEnterprise?: number;
  includedCreditsValue?: number;
  includedCredits?: number;
  budgetLimit?: number;
  budgetCredits?: number;
  unit?: string;
  frequency?: string;
  stopUsage?: boolean | 'not-applicable';
  excludeCostCenter?: boolean | 'not-applicable';
  costCenterId?: string;
  enterpriseOrg?: string;
  enterpriseTeam?: string;
  orgTeam?: string;
  modelOption1?: string;
  modelOption2?: string;
  modelOption3?: string;
  alertThresholds?: number[];
  alertRecipients?: string[];
  chatEnabled?: boolean | 'limited';
  autoModeEnabled?: boolean;
  agentModeEnabled?: boolean | 'limited';
  cloudAgentEnabled?: boolean | 'limited';
  repoRefactorEnabled?: boolean;
  mcpIntegrationsEnabled?: boolean;
}

export interface SimulatorConfig {
  enterpriseName: string;
  licenseCountBusiness: number;
  licenseCountEnterprise: number;
  licenseCountCloudAgent: number;
  licenseCountSpark: number;
  billingCycleStartDate: string;
  currentDayOfCycle: number;
  creditsConsumedSoFar?: number;
  populationAllocation: {
    universalUlb: number;
    overageUsers: number;
    abundantUsers: number;
    exponentialUsers: number;
  };
}

export interface DailyBurnPoint {
  day: number;
  credits: number;
  cumulative: number;
}

export interface SimulatorResult {
  totalIncludedPool: number;
  projectedDailyBurnRate: number;
  projectedExhaustionDay: number;
  projectedOverageCredits: number;
  projectedOverageCost: number;
  governanceImpact: {
    withoutGovernance: DailyBurnPoint[];
    withGovernance: DailyBurnPoint[];
  };
}

export interface UserConsumption {
  userId: string;
  displayName: string;
  creditsConsumed: number;
  percentOfTotal: number;
}

export interface AssessmentConfig {
  enterpriseSlug: string;
  organizations: string[];
  enterpriseBillingToken?: string;
  sessionId: string;
  apiVersion: string;
  periodDays: number;
}

export interface AssessmentResult {
  totalCreditsConsumed: number;
  byOrganization: Record<string, number>;
  byModel: Record<string, number>;
  topUsers: UserConsumption[];
  dailyTrend: DailyBurnPoint[];
  concentrationRiskScore: number;
  governanceGaps: string[];
  governanceDataWarnings: GovernanceDataWarning[];
  existingBudgets: GitHubBudget[];
  existingCostCenters: GitHubCostCenter[];
}

export interface GovernanceDataWarning {
  source: 'budgets' | 'costCenters';
  message: string;
}

export interface GitHubBudget {
  id: string;
  name: string;
  budgetType: string;
  skus: string[];
  scope: string;
  scopeTarget: string;
  excludeCostCenterUsage: boolean | null;
  limit: number;
  used: number;
  preventFurtherUsage: boolean;
  alertsEnabled: boolean;
  alertRecipients: string[];
}

export interface GitHubCostCenter {
  id: string;
  name: string;
  state: 'active' | 'deleted';
  aiCreditPoolEnabled?: boolean;
  aiCreditPoolState?: {
    targetAmount: number | null;
    currentAmount: number | null;
  };
  resources: GitHubCostCenterResource[];
}

export interface GitHubCostCenterResource {
  type: string;
  name: string;
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  tier: 1 | 2 | 3;
  budgetClass: BudgetProfileClass;
  rationale: string;
  configuredValue: number;
  implementationSteps: string[];
}

export interface ScenarioConfig {
  id: string;
  name: string;
  simulatorConfig: SimulatorConfig;
  result?: SimulatorResult;
}
