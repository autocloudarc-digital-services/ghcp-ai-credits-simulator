import { z } from 'zod';

const amount = z.number().finite().nonnegative();
const count = amount.int();
export const simulatorConfigSchema = z.object({
  enterpriseName: z.string().min(1).max(100),
  licenseCountBusiness: count, licenseCountEnterprise: count, licenseCountCloudAgent: count, licenseCountSpark: count,
  billingCycleStartDate: z.string().max(40).refine(value => !Number.isNaN(Date.parse(value))),
  currentDayOfCycle: count.min(1).max(31), creditsConsumedSoFar: amount.optional(),
  populationAllocation: z.object({ universalUlb: count, overageUsers: count, abundantUsers: count, exponentialUsers: count }).strict(),
}).strict();
const point = z.object({ day: amount, credits: amount, cumulative: amount }).strict();
const result = z.object({
  totalIncludedPool: amount, projectedDailyBurnRate: amount, projectedExhaustionDay: amount.nullable(), projectedOverageCredits: amount, projectedOverageCost: amount,
  governanceImpact: z.object({ withoutGovernance: z.array(point).max(366), withGovernance: z.array(point).max(366) }).strict(),
}).strict();
export const recommendationsSchema = z.array(z.object({
  priority: z.enum(['critical', 'high', 'medium', 'low']), tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  budgetClass: z.object({ id: count, name: z.string(), slug: z.string(), scope: z.enum(['enterprise', 'organization', 'cost-center', 'user']), budgetType: z.enum(['included', 'metered-overage', 'ulb', 'org-policy']), skus: z.array(z.string()) }).passthrough(),
  rationale: z.string().max(20000), configuredValue: amount, implementationSteps: z.array(z.string().max(20000)).max(100),
}).strict()).max(100);
export const workflowSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  governanceInsights: z.object({
    view: z.enum(['overview', 'findings', 'register']).default('overview'),
    findingsQuery: z.string().max(200).default(''),
    registerQuery: z.string().max(200).default(''),
    priority: z.enum(['all', 'critical', 'high', 'medium', 'low']).default('all'),
    phase: z.enum(['all', 'Prepare', 'Baseline', 'Design', 'Approve', 'Pilot', 'Rollout', 'Operate']).default('all'),
    attentionOnly: z.boolean().default(false),
  }).strict().default({}),
  allocationPlans: z.record(z.string().max(200), z.object({ budget: amount.positive(), percentages: z.record(z.string().max(200), amount.max(100)) }).strict()).default({}),
  simulatorConfig: simulatorConfigSchema,
  simulatorResult: result.nullable(),
  scenarios: z.array(z.object({ id: z.string().max(100), name: z.string().max(60), simulatorConfig: simulatorConfigSchema, result: result.optional() }).strict()).max(4),
  assessmentId: z.string().uuid().nullable(),
  recommendations: recommendationsSchema,
  hasConfirmedSimulation: z.boolean(), hasReviewedDashboard: z.boolean(), hasReviewedRecommendations: z.boolean(), use3DVisualizer: z.boolean(),
}).strict().superRefine((document, context) => {
  if (document.hasReviewedDashboard && (!document.assessmentId || !document.hasConfirmedSimulation || !document.simulatorResult)) {
    context.addIssue({ code: 'custom', path: ['hasReviewedDashboard'], message: 'Review requires an assessment and confirmed simulation.' });
  }
});

export function containsCredentialField(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) => /token|secret|password|authorization|cookie/i.test(key) || containsCredentialField(nested));
}