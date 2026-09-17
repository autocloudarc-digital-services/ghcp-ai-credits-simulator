import axios, { AxiosError } from 'axios';
import { Session } from 'express-session';
import { getEnterpriseBillingToken } from '../config';
import { CostCenterReportRow, GitHubBudget, GitHubCostCenter } from '../types';
import { getTokenFromSession } from './githubAuthService';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const MAX_RETRIES = 3;
const MAX_PAGES = 100;
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

interface GraphQLErrorResponse {
  message: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLErrorResponse[];
}

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
const GITHUB_TEAM_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/;

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
      let accessHint = '';
      if (status === 403) {
        const headers = axiosErr.response?.headers;
        const payload = axiosErr.response?.data as { message?: unknown } | undefined;
        const message = typeof payload?.message === 'string' ? payload.message : '';
        if (String(headers?.['x-ratelimit-remaining']) === '0' || /rate limit/i.test(message)) {
          accessHint = ' GitHub rate limiting denied this request; wait for the limit to reset before retrying.';
        } else if (String(headers?.['x-github-sso']).startsWith('required') || /SAML|single sign.on/i.test(message)) {
          accessHint = ' GitHub requires SAML SSO authorization for this credential and organization.';
        } else if (/OAuth.*restric|third.party.*restric/i.test(message)) {
          accessHint = ' Organization OAuth app access restrictions block this request; an organization owner must approve the app.';
        } else if (/not accessible by integration/i.test(message)) {
          accessHint = ' GitHub App permissions or installation access do not cover this organization resource.';
        } else if (/not accessible by personal access token/i.test(message)) {
          accessHint = ' The personal access token lacks permission or resource-owner access for this endpoint.';
        } else if (/^\/orgs\/[^/]+\/members$/.test(path)) {
          accessHint = ' Verify organization membership and read:org access (or GitHub App Members: read). Enterprise ownership alone does not grant organization membership.';
        } else if (/^\/orgs\/[^/]+\/copilot\/billing$/.test(path)) {
          accessHint = ' Organization Copilot billing requires an organization owner and read:org or manage_billing:copilot for an OAuth app or classic PAT.';
        }
      }
      throw new GitHubBillingServiceError(
        `GitHub API request to ${path} failed: ${axiosErr.message}${accessHint}`,
        status
      );
    }
  }
  throw lastError instanceof Error ? lastError : new GitHubBillingServiceError('Unknown error');
}

async function authenticatedGetAll<T>(
  session: Session,
  slug: string,
  buildPath: (validatedSlug: string) => string,
  params?: Record<string, string | number | undefined>,
  credential?: string
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageItems = await authenticatedGet<T[]>(session, slug, buildPath, {
      ...params,
      per_page: 100,
      page,
    }, credential);
    items.push(...pageItems);
    if (pageItems.length < 100) return items;
  }
  throw new GitHubBillingServiceError(
    `GitHub API pagination exceeded ${MAX_PAGES} pages for ${buildPath(slug)}.`,
    422
  );
}

async function authenticatedGraphQL<T>(
  session: Session,
  operationName: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const token = getTokenFromSession(session);
  if (!token) {
    throw new GitHubBillingServiceError('No authenticated GitHub session found.', 401);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post<GraphQLResponse<T>>(
        `${GITHUB_API_BASE_URL}/graphql`,
        { operationName, query, variables },
        {
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': API_VERSION,
          },
        }
      );
      if (response.data.errors?.length) {
        throw new GitHubBillingServiceError(
          `GitHub GraphQL ${operationName} failed: ${response.data.errors
            .map((error) => error.message)
            .join('; ')}`,
          422
        );
      }
      if (!response.data.data) {
        throw new GitHubBillingServiceError(
          `GitHub GraphQL ${operationName} returned no data.`,
          502
        );
      }
      return response.data.data;
    } catch (err) {
      if (err instanceof GitHubBillingServiceError) throw err;
      lastError = err;
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status && RETRYABLE_STATUS_CODES.has(status) && attempt < MAX_RETRIES) {
        await sleep(2 ** attempt * 250);
        continue;
      }
      throw new GitHubBillingServiceError(
        `GitHub GraphQL ${operationName} failed: ${axiosErr.message}`,
        status
      );
    }
  }
  throw lastError instanceof Error ? lastError : new GitHubBillingServiceError('Unknown error');
}

export interface GitHubOrganizationDetails {
  id: number;
  nodeId: string;
  login: string;
  name: string | null;
}

export interface GitHubOrganizationMember {
  id: number;
  nodeId: string;
  login: string;
}

export interface GitHubTeamMember extends GitHubOrganizationMember {
  role: 'member' | 'maintainer';
}

export interface GitHubTeam {
  id: number;
  nodeId: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: string;
  permission: string;
  parentTeamId: number | null;
}

export interface GitHubEnterpriseMember {
  id: number | null;
  nodeId: string;
  login: string;
  name: string | null;
  email: string | null;
}

interface GraphQLPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface EnterpriseOrganizationsResponse {
  enterprise: {
    organizations: {
      nodes: Array<{
        id: string;
        databaseId: number;
        login: string;
        name: string | null;
      }>;
      pageInfo: GraphQLPageInfo;
    };
  } | null;
}

interface EnterpriseMembersResponse {
  enterprise: {
    members: {
      nodes: Array<{
        __typename: 'User' | 'EnterpriseUserAccount';
        id: string;
        databaseId?: number;
        login: string;
        name: string | null;
        email?: string;
      }>;
      pageInfo: GraphQLPageInfo;
    };
  } | null;
}

interface GitHubOrganizationDetailsResponse {
  id: number;
  node_id: string;
  login: string;
  name?: string | null;
}

interface GitHubMemberResponse {
  id: number;
  node_id: string;
  login: string;
}

interface GitHubTeamResponse {
  id: number;
  node_id: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: string;
  permission: string;
  parent?: { id: number } | null;
}

interface GitHubEnterpriseTeamResponse {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  organization_selection_type?: 'disabled' | 'selected' | 'all';
  group_id: string | null;
  group_name?: string | null;
}

interface GitHubEnterpriseTeamMemberResponse {
  id: number;
  node_id: string;
  login: string;
  name?: string | null;
  email?: string | null;
}

export interface GitHubEnterpriseTeam {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  organizationSelectionType: 'disabled' | 'selected' | 'all';
  groupId: string | null;
  groupName: string | null;
}

export async function getEnterpriseOrganizations(
  enterprise: string,
  session: Session
): Promise<GitHubOrganizationDetails[]> {
  if (!GITHUB_SLUG_PATTERN.test(enterprise)) {
    throw new GitHubBillingServiceError(`Invalid GitHub organization/enterprise slug: "${enterprise}"`, 400);
  }

  const organizations: GitHubOrganizationDetails[] = [];
  let cursor: string | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result: EnterpriseOrganizationsResponse = await authenticatedGraphQL<EnterpriseOrganizationsResponse>(
      session,
      'EnterpriseOrganizations',
      `query EnterpriseOrganizations($slug: String!, $cursor: String) {
        enterprise(slug: $slug) {
          organizations(first: 100, after: $cursor) {
            nodes { id databaseId login name }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { slug: enterprise, cursor }
    );
    if (!result.enterprise) {
      throw new GitHubBillingServiceError(`GitHub enterprise "${enterprise}" was not found or is not visible.`, 404);
    }
    const connection: EnterpriseOrganizationsResponse['enterprise'] extends null
      ? never
      : NonNullable<EnterpriseOrganizationsResponse['enterprise']>['organizations'] = result.enterprise.organizations;
    organizations.push(...connection.nodes.map((organization) => ({
      id: organization.databaseId,
      nodeId: organization.id,
      login: organization.login,
      name: organization.name,
    })));
    if (!connection.pageInfo.hasNextPage) return organizations;
    cursor = connection.pageInfo.endCursor;
  }
  throw new GitHubBillingServiceError(
    `GitHub GraphQL pagination exceeded ${MAX_PAGES} pages for enterprise organizations.`,
    422
  );
}

export async function getEnterpriseMembers(
  enterprise: string,
  session: Session
): Promise<GitHubEnterpriseMember[]> {
  if (!GITHUB_SLUG_PATTERN.test(enterprise)) {
    throw new GitHubBillingServiceError(`Invalid GitHub organization/enterprise slug: "${enterprise}"`, 400);
  }

  const members: GitHubEnterpriseMember[] = [];
  let cursor: string | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result: EnterpriseMembersResponse = await authenticatedGraphQL<EnterpriseMembersResponse>(
      session,
      'EnterpriseMembers',
      `query EnterpriseMembers($slug: String!, $cursor: String) {
        enterprise(slug: $slug) {
          members(first: 100, after: $cursor) {
            nodes {
              __typename
              ... on User { id databaseId login name email }
              ... on EnterpriseUserAccount { id login name }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { slug: enterprise, cursor }
    );
    if (!result.enterprise) {
      throw new GitHubBillingServiceError(`GitHub enterprise "${enterprise}" was not found or is not visible.`, 404);
    }
    const connection = result.enterprise.members;
    members.push(...connection.nodes.map((member) => ({
      id: member.databaseId ?? null,
      nodeId: member.id,
      login: member.login,
      name: member.name,
      email: member.email || null,
    })));
    if (!connection.pageInfo.hasNextPage) return members;
    cursor = connection.pageInfo.endCursor;
  }
  throw new GitHubBillingServiceError(
    `GitHub GraphQL pagination exceeded ${MAX_PAGES} pages for enterprise members.`,
    422
  );
}

/**
 * Retrieves enterprise-scoped teams using a classic PAT with read:enterprise.
 * GET /enterprises/{enterprise}/teams
 */
export async function getEnterpriseTeams(
  enterprise: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubEnterpriseTeam[]> {
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise team inventory requires GHCP_ENTERPRISE_BILLING_TOKEN with read:enterprise.',
      503
    );
  }

  const teams = await authenticatedGetAll<GitHubEnterpriseTeamResponse>(
    session,
    enterprise,
    (validatedEnterprise) => `/enterprises/${validatedEnterprise}/teams`,
    undefined,
    enterpriseBillingToken
  );
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description ?? null,
    organizationSelectionType: team.organization_selection_type ?? 'disabled',
    groupId: team.group_id,
    groupName: team.group_name ?? null,
  }));
}

/**
 * Retrieves membership for one enterprise-scoped team.
 * GET /enterprises/{enterprise}/teams/{enterprise-team}/memberships
 */
export async function getEnterpriseTeamMembers(
  enterprise: string,
  teamId: number,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubEnterpriseMember[]> {
  if (!Number.isSafeInteger(teamId) || teamId <= 0) {
    throw new GitHubBillingServiceError(`Invalid GitHub enterprise team ID: "${teamId}"`, 400);
  }
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise team membership requires GHCP_ENTERPRISE_BILLING_TOKEN with read:enterprise.',
      503
    );
  }

  const members = await authenticatedGetAll<GitHubEnterpriseTeamMemberResponse>(
    session,
    enterprise,
    (validatedEnterprise) =>
      `/enterprises/${validatedEnterprise}/teams/${teamId}/memberships`,
    undefined,
    enterpriseBillingToken
  );
  return members.map((member) => ({
    id: member.id,
    nodeId: member.node_id,
    login: member.login,
    name: member.name ?? null,
    email: member.email ?? null,
  }));
}

/**
 * Retrieves organizations assigned to one enterprise-scoped team.
 * GET /enterprises/{enterprise}/teams/{enterprise-team}/organizations
 */
export async function getEnterpriseTeamOrganizations(
  enterprise: string,
  teamId: number,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubOrganizationDetails[]> {
  if (!Number.isSafeInteger(teamId) || teamId <= 0) {
    throw new GitHubBillingServiceError(`Invalid GitHub enterprise team ID: "${teamId}"`, 400);
  }
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise team organization assignments require GHCP_ENTERPRISE_BILLING_TOKEN with read:enterprise.',
      503
    );
  }

  const organizations = await authenticatedGetAll<GitHubOrganizationDetailsResponse>(
    session,
    enterprise,
    (validatedEnterprise) =>
      `/enterprises/${validatedEnterprise}/teams/${teamId}/organizations`,
    undefined,
    enterpriseBillingToken
  );
  return organizations.map((organization) => ({
    id: organization.id,
    nodeId: organization.node_id,
    login: organization.login,
    name: organization.name ?? null,
  }));
}

export async function getOrganizationDetails(
  org: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubOrganizationDetails> {
  const organization = await authenticatedGet<GitHubOrganizationDetailsResponse>(
    session,
    org,
    (validatedOrg) => `/orgs/${validatedOrg}`,
    undefined,
    suppliedBillingToken?.trim() || getEnterpriseBillingToken() || undefined
  );
  return {
    id: organization.id,
    nodeId: organization.node_id,
    login: organization.login,
    name: organization.name ?? null,
  };
}

export async function getOrganizationMembers(
  org: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubOrganizationMember[]> {
  const members = await authenticatedGetAll<GitHubMemberResponse>(
    session,
    org,
    (validatedOrg) => `/orgs/${validatedOrg}/members`,
    { filter: 'all', role: 'all' },
    suppliedBillingToken?.trim() || getEnterpriseBillingToken() || undefined
  );
  return members.map((member) => ({
    id: member.id,
    nodeId: member.node_id,
    login: member.login,
  }));
}

export async function getOrganizationTeams(
  org: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubTeam[]> {
  const teams = await authenticatedGetAll<GitHubTeamResponse>(
    session,
    org,
    (validatedOrg) => `/orgs/${validatedOrg}/teams`,
    { team_type: 'organization' },
    suppliedBillingToken?.trim() || getEnterpriseBillingToken() || undefined
  );
  return teams.map((team) => ({
    id: team.id,
    nodeId: team.node_id,
    name: team.name,
    slug: team.slug,
    description: team.description,
    privacy: team.privacy,
    permission: team.permission,
    parentTeamId: team.parent?.id ?? null,
  }));
}

export async function getTeamMembers(
  org: string,
  teamSlug: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<GitHubTeamMember[]> {
  if (!GITHUB_TEAM_SLUG_PATTERN.test(teamSlug)) {
    throw new GitHubBillingServiceError(`Invalid GitHub team slug: "${teamSlug}"`, 400);
  }
  const buildPath = (validatedOrg: string) =>
    `/orgs/${validatedOrg}/teams/${teamSlug}/members`;
  const credential = suppliedBillingToken?.trim() || getEnterpriseBillingToken() || undefined;
  const [members, maintainers] = await Promise.all([
    authenticatedGetAll<GitHubMemberResponse>(session, org, buildPath, { role: 'all' }, credential),
    authenticatedGetAll<GitHubMemberResponse>(session, org, buildPath, { role: 'maintainer' }, credential),
  ]);
  const maintainerIds = new Set(maintainers.map((maintainer) => maintainer.id));
  return members.map((member) => ({
    id: member.id,
    nodeId: member.node_id,
    login: member.login,
    role: maintainerIds.has(member.id) ? 'maintainer' : 'member',
  }));
}

export interface AICreditUsageEntry {
  product: string;
  sku: string;
  model: string;
  unitType: string;
  grossQuantity: number;
  discountQuantity: number;
  netQuantity: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  userId?: string;
  login?: string;
}

export interface EnterpriseUsageSummaryEntry {
  product: string;
  sku: string;
  netAmount: number;
}

export interface EnterpriseUsageSummary {
  timePeriod?: { year: number; month: number };
  usageItems: EnterpriseUsageSummaryEntry[];
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

/**
 * Retrieves enterprise-wide AI credit usage for the current billing period.
 * GET /enterprises/{enterprise}/settings/billing/ai_credit/usage
 */
export async function getEnterpriseAICreditUsage(
  enterprise: string,
  session: Session,
  year: number,
  month: number,
  suppliedBillingToken?: string,
  costCenterId?: string,
  organization?: string
): Promise<AICreditUsageEntry[]> {
  if (organization !== undefined && !GITHUB_SLUG_PATTERN.test(organization)) {
    throw new GitHubBillingServiceError('Invalid GitHub organization filter.', 400);
  }
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise AI credit usage requires GHCP_ENTERPRISE_BILLING_TOKEN.',
      503
    );
  }

  const data = await authenticatedGet<{ usageItems?: AICreditUsageEntry[]; organization?: string }>(
    session,
    enterprise,
    (validatedEnterprise) =>
      `/enterprises/${validatedEnterprise}/settings/billing/ai_credit/usage`,
    { year, month, cost_center_id: costCenterId, organization },
    enterpriseBillingToken
  );
  if (!Array.isArray(data.usageItems)) {
    throw new GitHubBillingServiceError('Enterprise AI credit usage response is incomplete; usageItems is missing.', 502);
  }
  if (organization && data.organization !== undefined && (typeof data.organization !== 'string' || data.organization.toLowerCase() !== organization.toLowerCase())) {
    throw new GitHubBillingServiceError('Enterprise AI credit usage response does not match the requested organization.', 502);
  }
  return data.usageItems;
}

/**
 * Retrieves all metered GitHub usage for one enterprise cost center.
 * GET /enterprises/{enterprise}/settings/billing/usage/summary
 */
export async function getEnterpriseUsageSummary(
  enterprise: string,
  session: Session,
  year: number,
  month: number,
  costCenterId: string,
  suppliedBillingToken?: string
): Promise<EnterpriseUsageSummary> {
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise usage summary requires GHCP_ENTERPRISE_BILLING_TOKEN.',
      503
    );
  }

  const data = await authenticatedGet<{
    timePeriod?: { year: number; month: number };
    usageItems?: EnterpriseUsageSummaryEntry[];
  }>(
    session,
    enterprise,
    (validatedEnterprise) =>
      `/enterprises/${validatedEnterprise}/settings/billing/usage/summary`,
    { year, month, cost_center_id: costCenterId },
    enterpriseBillingToken
  );
  return { timePeriod: data.timePeriod, usageItems: data.usageItems ?? [] };
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
  azure_subscription?: string;
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

interface GitHubCopilotBillingResponse {
  seat_breakdown: {
    total: number;
  };
  plan_type?: 'business' | 'enterprise';
}

interface GitHubBillingUsageItem {
  date: string;
  product: string;
  sku: string;
  quantity: number;
  unitType: string;
  organizationName?: string;
}

export interface CopilotLicenseInventory {
  count: number;
  sku: string;
}

export interface EnterpriseCopilotSeatInventory {
  totalBySku: Record<string, number>;
  organizationAssignedBySku: Record<string, number>;
  enterpriseOnlyBySku: Record<string, number>;
  byOrganization: Record<string, Record<string, number>>;
}

export async function getEnterpriseCopilotSeatInventory(
  enterprise: string,
  session: Session,
  suppliedBillingToken?: string
): Promise<EnterpriseCopilotSeatInventory> {
  const credential = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!credential) throw new GitHubBillingServiceError('Enterprise Copilot seats require GHCP_ENTERPRISE_BILLING_TOKEN with read:enterprise or manage_billing:copilot.', 503);
  const users = new Map<number, { sku: string; organizations: Set<string> }>();
  let expectedTotal: number | undefined;
  let complete = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await authenticatedGet<{
      total_seats?: number;
      seats?: { assignee?: { id: number } | null; organization?: { login: string } | null; plan_type?: string }[];
    }>(session, enterprise, slug => `/enterprises/${slug}/copilot/billing/seats`, { per_page: 100, page }, credential);
    if (!Number.isSafeInteger(data.total_seats) || data.total_seats! < 0 || !Array.isArray(data.seats) || data.seats.length > 100) {
      throw new GitHubBillingServiceError('Enterprise Copilot seat response is incomplete.', 502);
    }
    if (expectedTotal !== undefined && expectedTotal !== data.total_seats) {
      throw new GitHubBillingServiceError('Enterprise Copilot seat total changed during pagination; retry the assessment.', 409);
    }
    expectedTotal = data.total_seats;
    for (const seat of data.seats) {
      if (!seat.assignee || !Number.isSafeInteger(seat.assignee.id) || seat.assignee.id <= 0 || !['business', 'enterprise'].includes(seat.plan_type ?? '')) {
        throw new GitHubBillingServiceError('Enterprise Copilot seats contain an unknown assignee or plan; included entitlement cannot be inferred.', 422);
      }
      if (seat.organization !== null && seat.organization !== undefined && (typeof seat.organization.login !== 'string' || !GITHUB_SLUG_PATTERN.test(seat.organization.login))) {
        throw new GitHubBillingServiceError('Enterprise Copilot seat organization is invalid.', 502);
      }
      const sku = `copilot-${seat.plan_type}`;
      const existing = users.get(seat.assignee.id);
      if (existing && existing.sku !== sku) throw new GitHubBillingServiceError('Enterprise Copilot seats contain conflicting plans for one user; entitlement remains unverified.', 422);
      const user = existing ?? { sku, organizations: new Set<string>() };
      if (seat.organization) user.organizations.add(seat.organization.login.toLowerCase());
      users.set(seat.assignee.id, user);
    }
    if (data.seats.length < 100) { complete = true; break; }
  }
  if (!complete || users.size !== expectedTotal) {
    throw new GitHubBillingServiceError('Enterprise Copilot seat coverage does not match total_seats; no complete license inventory is available.', 422);
  }
  const totalBySku: Record<string, number> = {};
  const organizationAssignedBySku: Record<string, number> = {};
  const enterpriseOnlyBySku: Record<string, number> = {};
  const byOrganization = new Map<string, Record<string, number>>();
  for (const user of users.values()) {
    totalBySku[user.sku] = (totalBySku[user.sku] ?? 0) + 1;
    const partition = user.organizations.size ? organizationAssignedBySku : enterpriseOnlyBySku;
    partition[user.sku] = (partition[user.sku] ?? 0) + 1;
    for (const org of user.organizations) {
      const counts = byOrganization.get(org) ?? {};
      counts[user.sku] = (counts[user.sku] ?? 0) + 1;
      byOrganization.set(org, counts);
    }
  }
  return { totalBySku, organizationAssignedBySku, enterpriseOnlyBySku, byOrganization: Object.fromEntries(byOrganization) };
}

/**
 * Retrieves the number of billed Copilot seats for an organization.
 * GET /orgs/{org}/copilot/billing
 */
export async function getCopilotLicenseInventory(
  org: string,
  session: Session
): Promise<CopilotLicenseInventory> {
  const data = await authenticatedGet<GitHubCopilotBillingResponse>(
    session,
    org,
    (validatedOrg) => `/orgs/${validatedOrg}/copilot/billing`
  );
  if (!data.plan_type) {
    throw new GitHubBillingServiceError(
      `GitHub did not report the Copilot plan type for organization ${org}.`
    );
  }
  return {
    count: data.seat_breakdown.total,
    sku: `Copilot ${data.plan_type}`,
  };
}

/**
 * Retrieves enterprise billing usage and converts the latest daily, directly
 * assigned Copilot UserMonths into current seat counts by SKU.
 * GET /enterprises/{enterprise}/settings/billing/usage
 */
export async function getEnterpriseCopilotLicenseCounts(
  enterprise: string,
  session: Session,
  year: number,
  month: number,
  suppliedBillingToken?: string
): Promise<Record<string, number>> {
  const enterpriseBillingToken = suppliedBillingToken?.trim() || getEnterpriseBillingToken();
  if (!enterpriseBillingToken) {
    throw new GitHubBillingServiceError(
      'Enterprise Copilot license data requires GHCP_ENTERPRISE_BILLING_TOKEN.',
      503
    );
  }

  const data = await authenticatedGet<{ usageItems?: GitHubBillingUsageItem[] }>(
    session,
    enterprise,
    (validatedEnterprise) => `/enterprises/${validatedEnterprise}/settings/billing/usage`,
    { year, month },
    enterpriseBillingToken
  );
  const directCopilotItems = (data.usageItems ?? []).filter(
    (item) =>
      item.sku.toLowerCase().includes('copilot') &&
      item.unitType.toLowerCase() === 'usermonths' &&
      !item.organizationName?.trim()
  );
  const latestDateBySku = new Map<string, string>();
  for (const item of directCopilotItems) {
    const date = item.date.slice(0, 10);
    const latestDate = latestDateBySku.get(item.sku);
    if (!latestDate || date > latestDate) latestDateBySku.set(item.sku, date);
  }

  const normalizedDailyQuantityBySku = new Map<string, number>();
  for (const item of directCopilotItems) {
    if (item.date.slice(0, 10) !== latestDateBySku.get(item.sku)) continue;
    normalizedDailyQuantityBySku.set(
      item.sku,
      (normalizedDailyQuantityBySku.get(item.sku) ?? 0) + item.quantity
    );
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Object.fromEntries(
    Array.from(normalizedDailyQuantityBySku, ([sku, quantity]) => [
      sku,
      Math.round(quantity * daysInMonth),
    ])
  );
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
    azureSubscription: costCenter.azure_subscription ?? null,
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

function sumNumbers<T>(items: T[], select: (item: T) => unknown): number {
  return items.reduce((total, item) => total + (Number(select(item)) || 0), 0);
}

/**
 * Joins AI-credit accounting and broader metered usage for one cost center.
 */
export async function getCostCenterReportRow(
  enterprise: string,
  costCenter: GitHubCostCenter,
  session: Session,
  year: number,
  month: number,
  suppliedBillingToken?: string
): Promise<CostCenterReportRow> {
  const [aiCreditUsage, usageSummary] = await Promise.all([
    getEnterpriseAICreditUsage(
      enterprise,
      session,
      year,
      month,
      suppliedBillingToken,
      costCenter.id
    ),
    getEnterpriseUsageSummary(
      enterprise,
      session,
      year,
      month,
      costCenter.id,
      suppliedBillingToken
    ),
  ]);
  const otherUsage = usageSummary.usageItems.filter(
    (item) => !`${item.product ?? ''} ${item.sku ?? ''}`.toLowerCase().includes('ai credit')
  );
  const poolTargetCredits = Number(costCenter.aiCreditPoolState?.targetAmount) || 0;
  const poolCurrentCredits = Number(costCenter.aiCreditPoolState?.currentAmount) || 0;
  const netAmount = sumNumbers(aiCreditUsage, (item) => item.netAmount);
  const otherMeteredSpend = sumNumbers(otherUsage, (item) => item.netAmount);

  return {
    id: costCenter.id,
    name: costCenter.name,
    state: costCenter.state,
    azureSubscription: costCenter.azureSubscription ?? null,
    resources: costCenter.resources,
    aiCreditPoolEnabled: Boolean(costCenter.aiCreditPoolEnabled),
    poolTargetCredits,
    poolCurrentCredits,
    utilization: poolTargetCredits > 0
      ? Math.min((poolCurrentCredits / poolTargetCredits) * 100, 100)
      : null,
    metrics: {
      assignedResources: costCenter.resources.length,
      grossQuantity: sumNumbers(aiCreditUsage, (item) => item.grossQuantity),
      grossAmount: sumNumbers(aiCreditUsage, (item) => item.grossAmount),
      discountAmount: sumNumbers(aiCreditUsage, (item) => item.discountAmount),
      netAmount,
      otherMeteredSpend,
      usageLineItems: usageSummary.usageItems.length,
      totalMeteredSpend: netAmount + otherMeteredSpend,
    },
  };
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
    enterpriseLicenseCount: null,
    organizationLicenseCount: null,
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
