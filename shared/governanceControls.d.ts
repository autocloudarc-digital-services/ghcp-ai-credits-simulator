export type BudgetControlId = 'individual-ulb' | 'cost-center-ulb' | 'universal-ulb'
  | 'cost-center-metered-budget' | 'organization-metered-budget' | 'enterprise-metered-budget'
  | 'organization-policy' | 'included-pool' | 'unclassified';
export function classifyBudgetControl(profile: { budgetType: string; scope: string }): BudgetControlId;
export function budgetControlLabel(profile: { budgetType: string; scope: string }): string;