import {
  AssessmentResult,
  BudgetProfileClass,
  DailyBurnPoint,
  Recommendation,
  SimulatorConfig,
  SimulatorResult,
  UserConsumption,
} from '../types';
import { budgetProfileClasses } from '../data/budgetProfileClasses';

/** AI credit contribution per license type, per user per month. */
export const LICENSE_CREDIT_RATES = {
  business: 1900,
  enterprise: 3900,
  cloudAgent: 3900,
  spark: 500,
} as const;

/** Overage cost per AI credit beyond the included pool, in USD. */
export const OVERAGE_RATE_PER_CREDIT = 0.01;

/** Recommended Universal ULB (per-user, per-month) for Enterprise plans. */
export const RECOMMENDED_ENTERPRISE_ULB = 5000;

const BILLING_CYCLE_DAYS = 30;

/**
 * Calculates the total included AI credits pool for the enterprise based on
 * license counts across the four Copilot SKUs.
 */
export function calculateIncludedPool(config: SimulatorConfig): number {
  return (
    config.licenseCountBusiness * LICENSE_CREDIT_RATES.business +
    config.licenseCountEnterprise * LICENSE_CREDIT_RATES.enterprise +
    config.licenseCountCloudAgent * LICENSE_CREDIT_RATES.cloudAgent +
    config.licenseCountSpark * LICENSE_CREDIT_RATES.spark
  );
}

/**
 * Calculates the average daily burn rate (credits/day) based on credits
 * consumed so far in the billing cycle and the number of days elapsed.
 */
export function calculateProjectedBurnRate(config: SimulatorConfig): number {
  const daysElapsed = Math.max(1, config.currentDayOfCycle);
  const consumed = config.creditsConsumedSoFar ?? 0;
  return consumed / daysElapsed;
}

/**
 * Projects the day within the billing cycle on which the included pool will
 * be fully exhausted, given a daily burn rate. Returns Infinity if the burn
 * rate is zero or negative (pool never exhausts).
 */
export function calculateExhaustionDay(pool: number, burnRate: number): number {
  if (burnRate <= 0) return Infinity;
  return pool / burnRate;
}

/**
 * Calculates the projected overage cost in USD, given a projected total
 * credit consumption and the total included pool size.
 */
export function calculateOverageCost(projected: number, pool: number): number {
  return Math.max(0, projected - pool) * OVERAGE_RATE_PER_CREDIT;
}

/**
 * Generates a 30-point daily burn-down series (cumulative credit
 * consumption per day) for the billing cycle.
 *
 * When `withGovernance` is true, consumption is capped per-user by the
 * Universal ULB (or cost-center overrides) which flattens the curve once
 * users hit their budget ceilings, simulating governance controls.
 */
export function generateBurnDownSeries(
  config: SimulatorConfig,
  withGovernance: boolean
): DailyBurnPoint[] {
  const burnRate = calculateProjectedBurnRate(config);
  const pool = calculateIncludedPool(config);
  const totalUsers = getTotalUsers(config);
  const points: DailyBurnPoint[] = [];

  // Without governance: linear/unconstrained daily burn based on observed rate.
  // With governance: burn rate is capped once population-weighted ULB ceilings
  // would otherwise be exceeded, simulating the effect of Tier 2/3 controls.
  const ulbCeilingPerDay =
    totalUsers > 0 ? (RECOMMENDED_ENTERPRISE_ULB * totalUsers) / BILLING_CYCLE_DAYS : Infinity;

  let cumulative = 0;
  for (let day = 1; day <= BILLING_CYCLE_DAYS; day++) {
    let dayCredits = burnRate > 0 ? burnRate : pool / BILLING_CYCLE_DAYS;

    if (withGovernance) {
      // Governance smooths bursty usage toward the sustainable ceiling.
      dayCredits = Math.min(dayCredits, ulbCeilingPerDay * 1.05);
    }

    cumulative += dayCredits;
    points.push({ day, credits: dayCredits, cumulative });
  }

  return points;
}

/**
 * Compares projected credit consumption with and without governance
 * controls (Universal ULB / cost-center ULBs) over the billing cycle.
 */
export function calculateGovernanceImpact(config: SimulatorConfig): {
  withoutGovernance: DailyBurnPoint[];
  withGovernance: DailyBurnPoint[];
} {
  return {
    withoutGovernance: generateBurnDownSeries(config, false),
    withGovernance: generateBurnDownSeries(config, true),
  };
}

function getTotalUsers(config: SimulatorConfig): number {
  return (
    config.licenseCountBusiness +
    config.licenseCountEnterprise +
    config.licenseCountCloudAgent +
    config.licenseCountSpark
  );
}

/**
 * Runs the full simulation for a given configuration, producing the pool
 * size, burn rate, exhaustion projection, overage cost, and governance
 * impact comparison.
 */
export function runSimulation(config: SimulatorConfig): SimulatorResult {
  const totalIncludedPool = calculateIncludedPool(config);
  const projectedDailyBurnRate = calculateProjectedBurnRate(config);
  const projectedExhaustionDay = calculateExhaustionDay(totalIncludedPool, projectedDailyBurnRate);
  const projectedTotalConsumption = projectedDailyBurnRate * BILLING_CYCLE_DAYS;
  const projectedOverageCredits = Math.max(0, projectedTotalConsumption - totalIncludedPool);
  const projectedOverageCost = calculateOverageCost(projectedTotalConsumption, totalIncludedPool);
  const governanceImpact = calculateGovernanceImpact(config);

  return {
    totalIncludedPool,
    projectedDailyBurnRate,
    projectedExhaustionDay,
    projectedOverageCredits,
    projectedOverageCost,
    governanceImpact,
  };
}

/**
 * Scores concentration risk (0-100) based on how much of total consumption
 * is concentrated among the top users. Higher scores indicate a small
 * group of users are responsible for a disproportionate share of usage,
 * which increases the risk of unmanaged overage cost.
 */
export function scoreConcentrationRisk(
  topUsers: UserConsumption[],
  totalConsumption: number
): number {
  if (totalConsumption <= 0 || topUsers.length === 0) return 0;

  const topCount = Math.max(1, Math.ceil(topUsers.length * 0.1));
  const top10PercentConsumption = topUsers
    .slice(0, topCount)
    .reduce((sum, u) => sum + u.creditsConsumed, 0);

  const shareOfTotal = top10PercentConsumption / totalConsumption;
  // Scale so that a 40% share (the risk threshold) maps to a score of ~65,
  // and 100% concentration maps to 100.
  const score = Math.min(100, Math.round(shareOfTotal * 160));
  return score;
}

/**
 * Applies the 5 recommendation rules against assessment results (or a
 * simulator configuration when no live assessment is available) to produce
 * a prioritized list of governance recommendations mapped to the 10 Budget
 * Profile Classes.
 */
export function generateRecommendations(
  assessmentResult: AssessmentResult | null,
  simulatorConfig: SimulatorConfig
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const findClass = (slug: string): BudgetProfileClass =>
    budgetProfileClasses.find((c) => c.slug === slug) as BudgetProfileClass;

  const totalIncludedPool = calculateIncludedPool(simulatorConfig);
  const totalUsers = getTotalUsers(simulatorConfig);
  const totalConsumption =
    assessmentResult?.totalCreditsConsumed ??
    calculateProjectedBurnRate(simulatorConfig) * BILLING_CYCLE_DAYS;
  const topUsers = assessmentResult?.topUsers ?? [];

  // Rule 1: Concentration Risk -> Universal ULB (Class 3)
  const concentrationScore = assessmentResult
    ? scoreConcentrationRisk(topUsers, totalConsumption)
    : 0;
  const top10Count = Math.max(1, Math.ceil(topUsers.length * 0.1));
  const top10Share =
    totalConsumption > 0
      ? topUsers.slice(0, top10Count).reduce((s, u) => s + u.creditsConsumed, 0) / totalConsumption
      : 0;

  if (!assessmentResult || top10Share > 0.4 || concentrationScore > 40) {
    const recommendedUlb =
      totalUsers > 0 ? Math.round((totalIncludedPool / totalUsers) * 1.3) : RECOMMENDED_ENTERPRISE_ULB;
    recommendations.push({
      priority: 'critical',
      tier: 2,
      budgetClass: findClass('universal-ulb'),
      rationale:
        'Usage is highly concentrated among a small subset of users, exposing the enterprise ' +
        'to unmanaged overage risk. A Universal User-Level Budget places a per-user ceiling on ' +
        'consumption for every developer, preventing any single user from silently draining the ' +
        'shared included pool.',
      configuredValue: recommendedUlb,
      implementationSteps: [
        'Navigate to Enterprise Settings > Billing > Budgets in the GitHub Enterprise admin console.',
        `Create a new Universal ULB with a per-user monthly limit of ${recommendedUlb.toLocaleString()} AI credits.`,
        'Enable "Stop usage" so the budget hard-stops metered consumption once the limit is reached.',
        'Configure alert thresholds at 75% and 90% of the budget, notifying enterprise admins.',
        'Communicate the new policy to all Copilot users prior to activation.',
      ],
    });
  }

  // Rule 2: Power User Identification -> Cost Center ULB tiers (Classes 4-6)
  if (topUsers.length > 0) {
    const averageConsumption = totalConsumption / Math.max(1, totalUsers || topUsers.length);
    const powerUsers = topUsers.filter((u) => u.creditsConsumed > averageConsumption * 3);
    const highUsers = topUsers.filter(
      (u) => u.creditsConsumed > averageConsumption * 2 && u.creditsConsumed <= averageConsumption * 3
    );
    const moderateUsers = topUsers.filter(
      (u) => u.creditsConsumed > averageConsumption * 1 && u.creditsConsumed <= averageConsumption * 2
    );

    if (moderateUsers.length > 0) {
      recommendations.push({
        priority: 'medium',
        tier: 3,
        budgetClass: findClass('ulb-cost-center-overage-users'),
        rationale: `${moderateUsers.length} user(s) are consuming 1-2x the average, indicating elevated ` +
          'but not yet risky usage. Route them into the Overage Users cost center with a modestly ' +
          'elevated ULB to accommodate legitimate heavy usage while retaining visibility.',
        configuredValue: 6000,
        implementationSteps: [
          'Create the "Overage Users" cost center (aic-0011-ovr) and assign identified users.',
          'Apply a 6,000 credit/user/month ULB scoped to this cost center.',
          'Restrict available models to Auto mode plus cost-efficient frontier models.',
          'Review usage monthly and re-tier users as consumption patterns change.',
        ],
      });
    }
    if (highUsers.length > 0) {
      recommendations.push({
        priority: 'high',
        tier: 3,
        budgetClass: findClass('ulb-cost-center-abundant-users'),
        rationale: `${highUsers.length} user(s) are consuming 2-3x the average. These "abundant" users ` +
          'likely have legitimate high-intensity workloads (e.g., heavy agent/refactor usage) and should ' +
          'be given a higher ceiling under active monitoring rather than being throttled at the default ULB.',
        configuredValue: 7000,
        implementationSteps: [
          'Create the "Abundant Users" cost center (aic-0012-abd) and assign identified users.',
          'Apply a 7,000 credit/user/month ULB scoped to this cost center.',
          'Enable Auto mode plus additional frontier model options.',
          'Set alert thresholds at 75%/90% with notifications to team leads.',
        ],
      });
    }
    if (powerUsers.length > 0) {
      recommendations.push({
        priority: 'high',
        tier: 3,
        budgetClass: findClass('ulb-cost-center-exponential-users'),
        rationale: `${powerUsers.length} user(s) are consuming more than 3x the average, flagged as ` +
          '"exponential" power users. These are typically AI-platform SMEs or automation-heavy engineers. ' +
          'Grant a higher, explicitly-governed ULB so their throughput is preserved while remaining bounded.',
        configuredValue: 8000,
        implementationSteps: [
          'Create the "Exponential Users" cost center (aic-0013-exp) and assign identified users.',
          'Apply an 8,000 credit/user/month ULB scoped to this cost center.',
          'Grant access to the broadest set of models including Auto mode and frontier options.',
          'Review consumption weekly given the elevated ceiling and potential cost exposure.',
        ],
      });
    }
  }

  // Rule 3: Overage Risk -> Enterprise Spending Limit (Class 2)
  const burnRate = calculateProjectedBurnRate(simulatorConfig);
  const exhaustionDay = calculateExhaustionDay(totalIncludedPool, burnRate);
  const projectedTotalConsumption = burnRate * BILLING_CYCLE_DAYS;
  const projectedOverage = Math.max(0, projectedTotalConsumption - totalIncludedPool);

  if (exhaustionDay < 25 && burnRate > 0) {
    recommendations.push({
      priority: 'critical',
      tier: 1,
      budgetClass: findClass('enterprise-spending-limit'),
      rationale:
        `At the current burn rate, the included pool is projected to exhaust by day ` +
        `${Math.round(exhaustionDay)} of the 30-day billing cycle, leaving the enterprise exposed to ` +
        'uncapped metered overage for the remainder of the cycle. An Enterprise Spending Limit provides ' +
        'a hard ceiling on total overage spend as a Tier 1 backstop.',
      configuredValue: Math.round(projectedOverage * 1.2 * OVERAGE_RATE_PER_CREDIT * 100) / 100,
      implementationSteps: [
        'Navigate to Enterprise Settings > Billing > Spending Limits.',
        `Set the metered overage spending limit to $${(
          Math.round(projectedOverage * 1.2 * OVERAGE_RATE_PER_CREDIT * 100) / 100
        ).toLocaleString()} (120% of projected overage) as a safety buffer.`,
        'Enable "Stop usage" once the spending limit is reached to guarantee a hard cap.',
        'Set alert thresholds at 75% and 90% of the spending limit.',
        'Pair this Tier 1 control with Tier 2 Universal ULB to reduce reliance on the hard stop.',
      ],
    });
  }

  // Rule 4: Model Optimization -> restrict frontier models for standard orgs (Classes 7-8)
  const byModel = assessmentResult?.byModel ?? {};
  const totalModelUsage = Object.values(byModel).reduce((s, v) => s + v, 0);
  const frontierKeywords = ['gpt-5', 'claude-opus', 'claude-sonnet', 'frontier', 'o1', 'gpt-5.6'];
  const frontierUsage = Object.entries(byModel)
    .filter(([model]) => frontierKeywords.some((k) => model.toLowerCase().includes(k)))
    .reduce((s, [, v]) => s + v, 0);
  const frontierShare = totalModelUsage > 0 ? frontierUsage / totalModelUsage : 0;

  if (totalModelUsage > 0 && frontierShare > 0.3) {
    recommendations.push({
      priority: 'medium',
      tier: 3,
      budgetClass: findClass('org-policy-standard'),
      rationale:
        `Frontier models account for ${Math.round(frontierShare * 100)}% of total model usage, which ` +
        'is disproportionately expensive in AI credits relative to cost-efficient alternatives. Standard ' +
        'business-tier organizations should be restricted to cost-efficient models by default.',
      configuredValue: 19000,
      implementationSteps: [
        'Apply the "Organization Policy: Standard" profile to non-engineering organizations.',
        'Restrict model access to gpt-5-mini and claude-haiku for standard business users.',
        'Disable Agent Mode and Cloud Agent for these organizations to limit high-consumption workflows.',
        'Monitor for legitimate exceptions and route them to engineering/architect org policies instead.',
      ],
    });
  }

  // Rule 5: Org Policy Alignment -> map orgs to Classes 7-10
  const orgEntries = Object.entries(assessmentResult?.byOrganization ?? {});
  if (orgEntries.length > 0) {
    const avgOrgConsumption =
      orgEntries.reduce((s, [, v]) => s + v, 0) / orgEntries.length;
    orgEntries.forEach(([orgName, consumption]) => {
      let slug = 'org-policy-standard';
      let priority: Recommendation['priority'] = 'low';
      if (consumption > avgOrgConsumption * 2.5) {
        slug = 'org-policy-ai-platform';
        priority = 'high';
      } else if (consumption > avgOrgConsumption * 1.75) {
        slug = 'org-policy-architects';
        priority = 'medium';
      } else if (consumption > avgOrgConsumption * 1.1) {
        slug = 'org-policy-engineering';
        priority = 'medium';
      }
      const budgetClass = findClass(slug);
      recommendations.push({
        priority,
        tier: 3,
        budgetClass,
        rationale: `Organization "${orgName}" consumed ${consumption.toLocaleString()} AI credits, ` +
          `${consumption > avgOrgConsumption ? 'above' : 'at or below'} the ${Math.round(
            avgOrgConsumption
          ).toLocaleString()} average across assessed organizations. Aligning it to the ` +
          `"${budgetClass.name}" profile matches license mix and feature access to actual usage patterns.`,
        configuredValue: budgetClass.includedCredits ?? 0,
        implementationSteps: [
          `Assign organization "${orgName}" to cost center ${budgetClass.costCenterId}.`,
          `Apply the "${budgetClass.name}" org policy including model and feature access rules.`,
          'Validate license mix (Business vs. Enterprise) matches the assigned profile.',
          'Re-assess quarterly and re-map organizations as usage evolves.',
        ],
      });
    });
  } else {
    recommendations.push({
      priority: 'low',
      tier: 3,
      budgetClass: findClass('org-policy-engineering'),
      rationale:
        'No live assessment data is available yet. Run an assessment against connected GitHub ' +
        'organizations to generate data-driven org policy alignment recommendations for Classes 7-10.',
      configuredValue: findClass('org-policy-engineering').includedCredits ?? 0,
      implementationSteps: [
        'Connect a GitHub Enterprise account on the Assessment page.',
        'Run an assessment to collect real per-organization consumption data.',
        'Return to Recommendations once results are available for org-specific guidance.',
      ],
    });
  }

  const priorityOrder: Record<Recommendation['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Computes an overall governance readiness score (0-100) based on how many
 * of the recommended controls are effectively already addressed by the
 * current configuration (proxy: fewer/lower-priority recommendations imply
 * higher readiness).
 */
export function calculateGovernanceReadinessScore(recommendations: Recommendation[]): number {
  if (recommendations.length === 0) return 100;
  const weight: Record<Recommendation['priority'], number> = {
    critical: 30,
    high: 18,
    medium: 8,
    low: 3,
  };
  const penalty = recommendations.reduce((sum, r) => sum + weight[r.priority], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
