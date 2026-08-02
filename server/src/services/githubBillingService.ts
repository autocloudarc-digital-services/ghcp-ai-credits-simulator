import axios, { AxiosError } from 'axios';
import { Session } from 'express-session';
import { getEnterpriseBillingToken } from '../config';
import { GitHubBudget, GitHubCostCenter } from '../types';
import { getTokenFromSession } from './githubAuthService';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

export class GitHubBillingServiceError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'GitHubBillingServiceError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GitHub organization/enterprise slugs may only contain alphanumeric
// characters and hyphens (and cannot start/end with a hyphen), matching
// GitHub's own login/slug naming rules. This allow-list is enforced
// immediately below, at the exact point the request URL is assembled and
// used, so a caller-supplied value (e.g. from the request body of
// POST /api/assessment/start) can never inject path segments, query
// separators, or other characters that could redirect the request to an
// unintended host or path.
const GITHUB_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/;

/**
 * Performs an authenticated GET request against the GitHub REST API using
 * either an endpoint-specific server credential or the OAuth token stored
 * server-side in the session. Never exposes either token outside this module.
 * Retries with exponential backoff on 429/503 responses, up to MAX_RETRIES
 * attempts.
 *
 * `slug` is the single caller-supplied path segment (an organization or
 * enterprise name) that `buildPath` interpolates into the request path;
 * it is validated against `GITHUB_SLUG_PATTERN` right here, immediately
 * before the resulting URL is used, so the request can never be forged to
 * target an unintended path.
 */
async function authenticatedGet<T>(
  session: Session,
  slug: string,
  buildPath: (validatedSlug: string) => string,
  params?: Record<string, string | number | undefined>,
  credential?: string
): Promise<T> {
  if (!GITHUB_SLUG_PATTERN.test(slug)) {
    throw new GitHubBillingServiceError(`Invalid GitHub organization/enterprise slug: "${slug}"`, 400);
  }

  const token = credential ?? getTokenFromSession(session);
  if (!token) {
    throw new GitHubBillingServiceError('No authenticated GitHub session found.', 401);
  }

  const path = buildPath(slug);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get<T>(`${GITHUB_API_BASE_URL}${path}`, {
        params,
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
        },
      });
      return response.data;
    } catch (err) {
      lastError = err;
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status && RETRYABLE_STATUS_CODES.has(status) && attempt < MAX_RETRIES) {
        await sleep(2 ** attempt * 250);
        continue;
      }
      throw new GitHubBillingServiceError(
        `GitHub API request to ${path} failed: ${axiosErr.message}`,
        status
      );
    }
  }
  throw lastError instanceof Error ? lastError : new GitHubBillingServiceError('Unknown error');
}

export interface AICreditUsageEntry {
  userId: string;
  login: string;
  creditsUsed: number;
  model?: string;
  organization?: string;
}

/**
 * Retrieves AI credit usage for an organization for a given billing period.
 * GET /organizations/{org}/settings/billing/ai_credit/usage
 */
export async function getAICreditUsage(
  org: string,
  session: Session,
  year: number,
  month: number
): Promise<AICreditUsageEntry[]> {
  const data = await authenticatedGet<{ usageItems?: AICreditUsageEntry[] }>(
    session,
    org,
    (validatedOrg) => `/organizations/${validatedOrg}/settings/billing/ai_credit/usage`,
    { year, month }
  );
  return data.usageItems ?? [];
}

export interface UsageSummary {
  totalCredits: number;
  byModel: Record<string, number>;
}

interface GitHubBudgetResponse {
  id: string;
  budget_entity_name?: string;
  user?: string;
  budget_type: string;
  budget_scope: string;
  budget_product_sku?: string;
  budget_product_skus?: string[];
  budget_amount: number;
  prevent_further_usage: boolean;
  budget_alerting: {
    will_alert: boolean;
    alert_recipients: string[];
  };
  consumed_amount?: number;
  effective_budget?: {
    consumed_amount?: number;
  };
}

interface GitHubCostCenterResponse {
  id: string;
  name: string;
  state?: 'active' | 'deleted';
  ai_credit_pool_enabled?: boolean;
  ai_credit_pool_state?: {
    target_amount: number | null;
    current_amount: number | null;
  };
  resources?: Array<{
    type: string;
    name: string;
  }>;
}

/**
 * Retrieves the aggregated usage summary for an organization.
 * GET /organizations/{org}/settings/billing/usage/summary
 */
export async function getUsageSummary(
  org: string,
  session: Session,
  year: number,
  month: number
): Promise<UsageSummary> {
  const data = await authenticatedGet<Partial<UsageSummary>>(
    session,
    org,
    (validatedOrg) => `/organizations/${validatedOrg}/settings/billing/usage/summary`,
    { year, month }
  );
  return { totalCredits: data.totalCredits ?? 0, byModel: data.byModel ?? {} };
}

/**
 * Retrieves configured cost centers for an enterprise.
 * GET /enterprises/{enterprise}/settings/billing/cost-centers
 */
export async function getCostCenters(
  enterprise: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubCostCenter[]> {
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise cost-center data requires GHCP_ENTERPRISE_BILLING_TOKEN.',
      503
    );
  }

  const data = await authenticatedGet<{ costCenters?: GitHubCostCenterResponse[] }>(
    session,
    enterprise,
    (validatedEnterprise) => `/enterprises/${validatedEnterprise}/settings/billing/cost-centers`,
    undefined,
    enterpriseBillingToken
  );
  return (data.costCenters ?? []).map((costCenter) => ({
    id: costCenter.id,
    name: costCenter.name,
    state: costCenter.state ?? 'active',
    aiCreditPoolEnabled: costCenter.ai_credit_pool_enabled,
    aiCreditPoolState: costCenter.ai_credit_pool_state
      ? {
          targetAmount: costCenter.ai_credit_pool_state.target_amount,
          currentAmount: costCenter.ai_credit_pool_state.current_amount,
        }
      : undefined,
    resources: costCenter.resources ?? [],
  }));
}

/**
 * Retrieves configured budgets for an enterprise.
 * GET /enterprises/{enterprise}/settings/billing/budgets
 */
export async function getExistingBudgets(
  enterprise: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubBudget[]> {
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise budget data requires GHCP_ENTERPRISE_BILLING_TOKEN.',
      503
    );
  }

  const data = await authenticatedGet<{ budgets?: GitHubBudgetResponse[] }>(
    session,
    enterprise,
    (validatedEnterprise) => `/enterprises/${validatedEnterprise}/settings/billing/budgets`,
    undefined,
    enterpriseBillingToken
  );
  return (data.budgets ?? []).map((budget) => ({
    id: budget.id,
    name:
      budget.budget_entity_name ||
      `${budget.budget_scope}: ${budget.budget_product_sku ?? budget.budget_product_skus?.join(', ') ?? 'unknown'}`,
    budgetType: budget.budget_type,
    skus: budget.budget_product_skus ?? (budget.budget_product_sku ? [budget.budget_product_sku] : []),
    scope: budget.budget_scope,
    scopeTarget: budget.budget_entity_name || budget.user || enterprise,
    excludeCostCenterUsage: null,
    limit: budget.budget_amount,
    used:
      budget.effective_budget?.consumed_amount ??
      budget.consumed_amount ??
      0,
    preventFurtherUsage: budget.prevent_further_usage,
    alertsEnabled: budget.budget_alerting.will_alert,
    alertRecipients: budget.budget_alerting.alert_recipients,
  }));
}
