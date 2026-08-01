import { randomUUID } from 'crypto';
import { Router } from 'express';
import { Session, SessionData } from 'express-session';
import {
  getAICreditUsage,
  getCostCenters,
  getExistingBudgets,
  getUsageSummary,
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

function scoreConcentrationRisk(topUsers: UserConsumption[], totalConsumption: number): number {
  if (totalConsumption <= 0 || topUsers.length === 0) return 0;
  const topCount = Math.max(1, Math.ceil(topUsers.length * 0.1));
  const top10 = topUsers.slice(0, topCount).reduce((s, u) => s + u.creditsConsumed, 0);
  return Math.min(100, Math.round((top10 / totalConsumption) * 160));
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
  session: Session & Partial<SessionData>
) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const byOrganization: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const userTotals = new Map<string, number>();

    const orgsToAssess = organizations.length > 0 ? organizations : [enterpriseSlug];

    for (const org of orgsToAssess) {
      const [usage, summary] = await Promise.all([
        getAICreditUsage(org, session, year, month),
        getUsageSummary(org, session, year, month),
      ]);

      byOrganization[org] = (byOrganization[org] ?? 0) + summary.totalCredits;
      for (const [model, credits] of Object.entries(summary.byModel)) {
        byModel[model] = (byModel[model] ?? 0) + credits;
      }
      for (const entry of usage) {
        userTotals.set(entry.userId, (userTotals.get(entry.userId) ?? 0) + entry.creditsUsed);
      }
    }

    const totalCreditsConsumed = Object.values(byOrganization).reduce((s, v) => s + v, 0);

    const topUsers: UserConsumption[] = Array.from(userTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, creditsConsumed], idx) => ({
        userId,
        displayName: `Developer ${String(idx + 1).padStart(2, '0')}`,
        creditsConsumed,
        percentOfTotal: totalCreditsConsumed > 0 ? (creditsConsumed / totalCreditsConsumed) * 100 : 0,
      }));

    const dailyTrend: DailyBurnPoint[] = Array.from({ length: periodDays }, (_, i) => {
      const day = i + 1;
      const credits = periodDays > 0 ? totalCreditsConsumed / periodDays : 0;
      return { day, credits, cumulative: credits * day };
    });

    const concentrationRiskScore = scoreConcentrationRisk(topUsers, totalCreditsConsumed);

    const [budgetsResult, costCentersResult] = await Promise.allSettled([
      getExistingBudgets(enterpriseSlug, session),
      getCostCenters(enterpriseSlug, session),
    ]);

    const budgetsAvailable = budgetsResult.status === 'fulfilled';
    const costCentersAvailable = costCentersResult.status === 'fulfilled';
    const existingBudgets = budgetsAvailable ? budgetsResult.value : [];
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

    const governanceGaps = buildGovernanceGaps(
      existingBudgets,
      existingCostCenters,
      concentrationRiskScore,
      budgetsAvailable,
      costCentersAvailable
    );

    const result: AssessmentResult = {
      totalCreditsConsumed,
      byOrganization,
      byModel,
      topUsers,
      dailyTrend,
      concentrationRiskScore,
      governanceGaps,
      governanceDataWarnings,
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
  const { enterpriseSlug, organizations, periodDays } = req.body ?? {};

  if (typeof enterpriseSlug !== 'string' || enterpriseSlug.trim().length === 0) {
    res.status(400).json({ message: 'enterpriseSlug is required.' });
    return;
  }
  if (!Array.isArray(organizations) || organizations.length === 0) {
    res.status(400).json({ message: 'At least one organization slug is required.' });
    return;
  }

  const jobId = randomUUID();
  req.session.assessmentCompleted = false;
  jobs.set(jobId, { ownerSessionId: req.sessionID, status: 'pending' });

  const resolvedEnterprise = enterpriseSlug.trim();
  const orgs = organizations;
  const days = typeof periodDays === 'number' && periodDays > 0 ? periodDays : 30;

  // Fire and forget; client polls /status/:id and /results/:id.
  void runAssessment(jobId, resolvedEnterprise, orgs, days, req.session);

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
