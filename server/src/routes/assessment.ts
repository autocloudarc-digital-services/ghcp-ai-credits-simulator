import { randomUUID } from 'crypto';
import { Router } from 'express';
import { Session, SessionData } from 'express-session';
import {
  getAICreditUsage,
  getCopilotLicenseInventory,
  getCostCenters,
  getEnterpriseAICreditUsage,
  getEnterpriseCopilotLicenseCounts,
  getExistingBudgets,
  GitHubBillingServiceError,
} from '../services/githubBillingService';
import { AssessmentResult, DailyBurnPoint, UserConsumption } from '../types';

const router = Router();

interface AssessmentJob {
  ownerSessionId: string;
  status: 'pending' | 'complete' | 'failed';
  result?: AssessmentResult;
  error?: string;
}

const jobs = new Map<string, AssessmentJob>();

const STANDARD_INCLUDED_CREDITS = {
  'copilot-business': 1900,
  'copilot-enterprise': 3900,
} as const;
const PROMOTIONAL_INCLUDED_CREDITS = {
  'copilot-business': 3000,
  'copilot-enterprise': 7000,
} as const;

function scoreConcentrationRisk(topUsers: UserConsumption[], totalConsumption: number): number {
  if (totalConsumption <= 0 || topUsers.length === 0) return 0;
  const topCount = Math.max(1, Math.ceil(topUsers.length * 0.1));
  const top10 = topUsers.slice(0, topCount).reduce((s, u) => s + u.creditsConsumed, 0);
  return Math.min(100, Math.round((top10 / totalConsumption) * 160));
}

function getCopilotSkuKey(sku: string): string | null {
  const normalizedSku = sku.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalizedSku.includes('copilot')) return null;
  if (normalizedSku.includes('business')) return 'copilot-business';
  if (normalizedSku.includes('enterprise')) return 'copilot-enterprise';
  return null;
}

function getIncludedCreditsPerLicense(
  skuKey: keyof typeof STANDARD_INCLUDED_CREDITS,
  now: Date
): number {
  const promotionStarts = Date.UTC(2026, 5, 1);
  const promotionEnds = Date.UTC(2026, 8, 1);
  const currentTime = now.getTime();
  const rates = currentTime >= promotionStarts && currentTime < promotionEnds
    ? PROMOTIONAL_INCLUDED_CREDITS
    : STANDARD_INCLUDED_CREDITS;
  return rates[skuKey];
}

function getCopilotPlan(skuKey: string): 'Copilot Business' | 'Copilot Enterprise' {
  return skuKey === 'copilot-enterprise' ? 'Copilot Enterprise' : 'Copilot Business';
}

function buildGovernanceGaps(
  existingBudgets: AssessmentResult['existingBudgets'],
  existingCostCenters: AssessmentResult['existingCostCenters'],
  concentrationRiskScore: number,
  budgetsAvailable: boolean,
  costCentersAvailable: boolean
): string[] {
  const gaps: string[] = [];
  if (budgetsAvailable && existingBudgets.length === 0) {
    gaps.push('No Enterprise Spending Limit or Universal ULB budgets are currently configured.');
  }
  if (costCentersAvailable && existingCostCenters.length === 0) {
    gaps.push('No cost centers exist to segment overage, abundant, and exponential user tiers.');
  }
  if (concentrationRiskScore > 40) {
    gaps.push('Usage is highly concentrated among a small subset of users; a Universal ULB is recommended.');
  }
  return gaps;
}

async function runAssessment(
  jobId: string,
  enterpriseSlug: string,
  organizations: string[],
  periodDays: number,
  session: Session & Partial<SessionData>,
  enterpriseBillingToken?: string
) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const byOrganization: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const includedUsageByOrganization = new Map<string, number>();
    const userTotals = new Map<string, number>();
    const unavailableUsageOrganizations: string[] = [];

    const orgsToAssess = organizations.length > 0 ? organizations : [enterpriseSlug];

    for (const org of orgsToAssess) {
      let usage;
      try {
        usage = await getAICreditUsage(org, session, year, month);
      } catch (error) {
        if (error instanceof GitHubBillingServiceError && error.status === 404) {
          unavailableUsageOrganizations.push(org);
          continue;
        }
        throw error;
      }
      byOrganization[org] = usage.reduce((total, item) => total + item.grossQuantity, 0);
      includedUsageByOrganization.set(
        org.toLowerCase(),
        usage.reduce((total, item) => total + item.discountQuantity, 0)
      );
      for (const entry of usage) {
        byModel[entry.model] = (byModel[entry.model] ?? 0) + entry.grossQuantity;
        if (entry.userId) {
          userTotals.set(entry.userId, (userTotals.get(entry.userId) ?? 0) + entry.grossQuantity);
        }
      }
    }

    const [
      governanceResults,
      licenseInventoryResults,
      enterpriseLicenseResults,
      enterpriseUsageResults,
    ] = await Promise.all([
      Promise.allSettled([
        getExistingBudgets(enterpriseSlug, session, enterpriseBillingToken),
        getCostCenters(enterpriseSlug, session, enterpriseBillingToken),
      ]),
      Promise.allSettled(
        orgsToAssess.map((org) => getCopilotLicenseInventory(org, session))
      ),
      Promise.allSettled([
        getEnterpriseCopilotLicenseCounts(
          enterpriseSlug,
          session,
          year,
          month,
          enterpriseBillingToken
        ),
      ]),
      Promise.allSettled([
        getEnterpriseAICreditUsage(
          enterpriseSlug,
          session,
          year,
          month,
          enterpriseBillingToken
        ),
      ]),
    ]);
    const [budgetsResult, costCentersResult] = governanceResults;
    const enterpriseLicenseResult = enterpriseLicenseResults[0];
    const enterpriseUsageResult = enterpriseUsageResults[0];

    const budgetsAvailable = budgetsResult.status === 'fulfilled';
    const costCentersAvailable = costCentersResult.status === 'fulfilled';
    const enterpriseUsage = enterpriseUsageResult?.status === 'fulfilled'
      ? enterpriseUsageResult.value
      : null;
    if (enterpriseUsage) {
      for (const model of Object.keys(byModel)) delete byModel[model];
      for (const entry of enterpriseUsage) {
        byModel[entry.model] = (byModel[entry.model] ?? 0) + entry.grossQuantity;
      }
    }
    const totalCreditsConsumed = enterpriseUsage
      ? enterpriseUsage.reduce((total, item) => total + item.grossQuantity, 0)
      : Object.values(byOrganization).reduce((total, value) => total + value, 0);
    const topUsers: UserConsumption[] = Array.from(userTotals.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 10)
      .map(([userId, creditsConsumed], index) => ({
        userId,
        displayName: `Developer ${String(index + 1).padStart(2, '0')}`,
        creditsConsumed,
        percentOfTotal: totalCreditsConsumed > 0
          ? (creditsConsumed / totalCreditsConsumed) * 100
          : 0,
      }));
    const dailyTrend: DailyBurnPoint[] = Array.from({ length: periodDays }, (_, index) => {
      const day = index + 1;
      const credits = periodDays > 0 ? totalCreditsConsumed / periodDays : 0;
      return { day, credits, cumulative: credits * day };
    });
    const concentrationRiskScore = scoreConcentrationRisk(topUsers, totalCreditsConsumed);
    const licenseCountsByOrganization = new Map<string, Map<string, number>>();
    const unavailableLicenseOrganizations: string[] = [];
    licenseInventoryResults.forEach((licenseResult, index) => {
      const organization = orgsToAssess[index];
      if (licenseResult.status === 'fulfilled') {
        const skuKey = getCopilotSkuKey(licenseResult.value.sku);
        licenseCountsByOrganization.set(
          organization.toLowerCase(),
          skuKey ? new Map([[skuKey, licenseResult.value.count]]) : new Map()
        );
      } else {
        unavailableLicenseOrganizations.push(organization);
      }
    });
    const enterpriseLicenseCounts = new Map<string, number>();
    if (enterpriseLicenseResult?.status === 'fulfilled') {
      for (const [sku, count] of Object.entries(enterpriseLicenseResult.value)) {
        const skuKey = getCopilotSkuKey(sku);
        if (skuKey) enterpriseLicenseCounts.set(skuKey, count);
      }
    }

    const organizationBusinessLicenses = Array.from(licenseCountsByOrganization.values())
      .reduce((total, counts) => total + (counts.get('copilot-business') ?? 0), 0);
    const organizationEnterpriseLicenses = Array.from(licenseCountsByOrganization.values())
      .reduce((total, counts) => total + (counts.get('copilot-enterprise') ?? 0), 0);
    const businessLicenseCount = organizationBusinessLicenses
      + (enterpriseLicenseCounts.get('copilot-business') ?? 0);
    const enterpriseLicenseCount = organizationEnterpriseLicenses
      + (enterpriseLicenseCounts.get('copilot-enterprise') ?? 0);
    const totalLicenseCount = businessLicenseCount + enterpriseLicenseCount;
    const enterpriseIncludedUsage = enterpriseUsageResult?.status === 'fulfilled'
      ? enterpriseUsageResult.value.reduce(
          (total, item) => total + item.discountQuantity,
          0
        )
      : null;
    const meteredCreditsConsumed = enterpriseUsageResult?.status === 'fulfilled'
      ? enterpriseUsageResult.value.reduce((total, item) => total + item.netQuantity, 0)
      : null;
    const includedCreditPools: AssessmentResult['includedCreditPools'] = totalLicenseCount > 0
      ? [{
          id: `enterprise:${enterpriseSlug}`,
          scope: 'enterprise',
          scopeTarget: enterpriseSlug,
          businessLicenseCount,
          enterpriseLicenseCount,
          totalLicenseCount,
          used: enterpriseIncludedUsage,
          limit:
            businessLicenseCount * getIncludedCreditsPerLicense('copilot-business', now)
            + enterpriseLicenseCount * getIncludedCreditsPerLicense('copilot-enterprise', now),
          resetDate: new Date(Date.UTC(year, month, 1)).toISOString(),
        }]
      : [];

    const existingBudgets = budgetsAvailable
      ? budgetsResult.value.map((budget) => {
          const skuKey = budget.skus
            .map(getCopilotSkuKey)
            .find((key): key is string => key !== null);
          const isOrganizationScope = budget.scope.toLowerCase() === 'organization';
          const isEnterpriseScope = budget.scope.toLowerCase() === 'enterprise';
          let organizationLicenseCount: number | null = null;
          if (skuKey && isOrganizationScope) {
            organizationLicenseCount =
              licenseCountsByOrganization.get(budget.scopeTarget.toLowerCase())?.get(skuKey) ??
              (licenseCountsByOrganization.has(budget.scopeTarget.toLowerCase()) ? 0 : null);
          } else if (skuKey && isEnterpriseScope && unavailableLicenseOrganizations.length === 0) {
            organizationLicenseCount = Array.from(licenseCountsByOrganization.values())
              .reduce((total, countsBySku) => total + (countsBySku.get(skuKey) ?? 0), 0);
          }

          return {
            ...budget,
            enterpriseLicenseCount:
              skuKey && enterpriseLicenseResult?.status === 'fulfilled'
                ? enterpriseLicenseCounts.get(skuKey) ?? 0
                : null,
            organizationLicenseCount,
          };
        })
      : [];
    const existingCostCenters = costCentersAvailable ? costCentersResult.value : [];
    const governanceDataWarnings: AssessmentResult['governanceDataWarnings'] = [];

    if (!budgetsAvailable) {
      governanceDataWarnings.push({
        source: 'budgets',
        message: budgetsResult.reason instanceof Error
          ? budgetsResult.reason.message
          : 'Enterprise budget data is unavailable.',
      });
    }
    if (!costCentersAvailable) {
      governanceDataWarnings.push({
        source: 'costCenters',
        message: costCentersResult.reason instanceof Error
          ? costCentersResult.reason.message
          : 'Enterprise cost-center data is unavailable.',
      });
    }
    const licenseWarnings: string[] = [];
    if (unavailableLicenseOrganizations.length > 0) {
      licenseWarnings.push(
        `organization inventory is unavailable for ${unavailableLicenseOrganizations.join(', ')}`
      );
    }
    if (!enterpriseLicenseResult || enterpriseLicenseResult.status === 'rejected') {
      licenseWarnings.push('enterprise-assigned inventory is unavailable');
    }
    if (licenseWarnings.length > 0) {
      governanceDataWarnings.push({
        source: 'licenses',
        message: `Copilot license inventory is incomplete: ${licenseWarnings.join('; ')}.`,
      });
    }
    const includedCreditWarnings: string[] = [];
    if (unavailableUsageOrganizations.length > 0) {
      includedCreditWarnings.push(
        `organization usage attribution is unavailable for ${unavailableUsageOrganizations.join(', ')}`
      );
    }
    if (!enterpriseUsageResult || enterpriseUsageResult.status === 'rejected') {
      includedCreditWarnings.push('enterprise included-credit consumption is unavailable');
    }
    if (includedCreditWarnings.length > 0) {
      governanceDataWarnings.push({
        source: 'includedCredits',
        message: `Included AI credit data is incomplete: ${includedCreditWarnings.join('; ')}.`,
      });
    }

    const governanceGaps = buildGovernanceGaps(
      existingBudgets,
      existingCostCenters,
      concentrationRiskScore,
      budgetsAvailable,
      costCentersAvailable
    );

    const result: AssessmentResult = {
      totalCreditsConsumed,
      meteredCreditsConsumed,
      byOrganization,
      byModel,
      topUsers,
      dailyTrend,
      concentrationRiskScore,
      governanceGaps,
      governanceDataWarnings,
      includedCreditPools,
      existingBudgets,
      existingCostCenters,
    };

    session.assessmentCompleted = true;
    await new Promise<void>((resolve, reject) => {
      session.save((error) => (error ? reject(error) : resolve()));
    });
    jobs.set(jobId, { ownerSessionId: job.ownerSessionId, status: 'complete', result });
  } catch (err) {
    const message = err instanceof GitHubBillingServiceError ? err.message : 'Assessment failed unexpectedly.';
    jobs.set(jobId, { ownerSessionId: job.ownerSessionId, status: 'failed', error: message });
  }
}

// POST /api/assessment/start - begin an assessment for the given enterprise/orgs.
router.post('/start', (req, res) => {
  const { enterpriseSlug, organizations, periodDays, enterpriseBillingToken } = req.body ?? {};

  if (typeof enterpriseSlug !== 'string' || enterpriseSlug.trim().length === 0) {
    res.status(400).json({ message: 'enterpriseSlug is required.' });
    return;
  }
  if (!Array.isArray(organizations) || organizations.length === 0) {
    res.status(400).json({ message: 'At least one organization slug is required.' });
    return;
  }
  if (enterpriseBillingToken !== undefined && typeof enterpriseBillingToken !== 'string') {
    res.status(400).json({ message: 'enterpriseBillingToken must be a string.' });
    return;
  }

  const suppliedBillingToken = enterpriseBillingToken?.trim();
  if (suppliedBillingToken && suppliedBillingToken.length > 512) {
    res.status(400).json({ message: 'enterpriseBillingToken must be 512 characters or fewer.' });
    return;
  }
  delete req.body.enterpriseBillingToken;

  const jobId = randomUUID();
  req.session.assessmentCompleted = false;
  jobs.set(jobId, { ownerSessionId: req.sessionID, status: 'pending' });

  const resolvedEnterprise = enterpriseSlug.trim();
  const orgs = organizations;
  const days = typeof periodDays === 'number' && periodDays > 0 ? periodDays : 30;

  // Fire and forget; client polls /status/:id and /results/:id.
  void runAssessment(jobId, resolvedEnterprise, orgs, days, req.session, suppliedBillingToken || undefined);

  res.status(202).json({ assessmentId: jobId });
});

// GET /api/assessment/status/:id - check assessment job status.
router.get('/status/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.ownerSessionId !== req.sessionID) {
    res.status(404).json({ message: 'Assessment not found.' });
    return;
  }
  res.json({ status: job.status, error: job.error });
});

// GET /api/assessment/results/:id - fetch completed assessment results.
router.get('/results/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.ownerSessionId !== req.sessionID) {
    res.status(404).json({ message: 'Assessment not found.' });
    return;
  }
  if (job.status !== 'complete' || !job.result) {
    res.status(409).json({ message: `Assessment is not complete (status: ${job.status}).` });
    return;
  }
  res.json(job.result);
});

export default router;
