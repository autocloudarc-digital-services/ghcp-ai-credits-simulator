import { randomUUID } from 'crypto';
import { Router } from 'express';
import { Session, SessionData } from 'express-session';
import {
  getAICreditUsage,
  getCopilotLicenseInventory,
  getCostCenterReportRow,
  getCostCenters,
  getEnterpriseAICreditUsage,
  getEnterpriseCopilotLicenseCounts,
  getEnterpriseMembers,
  getEnterpriseOrganizations,
  getEnterpriseTeamMembers,
  getEnterpriseTeams,
  getExistingBudgets,
  getOrganizationDetails,
  getOrganizationMembers,
  getOrganizationTeams,
  getTeamMembers,
  GitHubBillingServiceError,
} from '../services/githubBillingService';
import {
  AssessmentResult,
  DailyBurnPoint,
  GitHubTeamMembership,
  UserConsumption,
} from '../types';

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

async function settleInBatches<T, TResult>(
  items: T[],
  batchSize: number,
  operation: (item: T) => Promise<TResult>
): Promise<PromiseSettledResult<TResult>[]> {
  const results: PromiseSettledResult<TResult>[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.allSettled(items.slice(index, index + batchSize).map(operation)));
  }
  return results;
}

async function mapInBatches<T, TResult>(
  items: T[],
  batchSize: number,
  operation: (item: T) => Promise<TResult>
): Promise<TResult[]> {
  const results: TResult[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.all(items.slice(index, index + batchSize).map(operation)));
  }
  return results;
}

async function collectOrganizationInventory(org: string, session: Session) {
  const [detailsResult, membersResult, teamsResult] = await Promise.allSettled([
    getOrganizationDetails(org, session),
    getOrganizationMembers(org, session),
    getOrganizationTeams(org, session),
  ]);
  const teams = teamsResult.status === 'fulfilled' ? teamsResult.value : [];
  const teamMemberResults = await settleInBatches(
    teams,
    5,
    async (team) => ({ team, members: await getTeamMembers(org, team.slug, session) })
  );
  return { org, detailsResult, membersResult, teamsResult, teamMemberResults };
}

function getFailureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Unknown GitHub API error.';
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
    const [enterpriseOrganizationsResult, enterpriseMembersResult, enterpriseTeamsResult] = await Promise.allSettled([
      getEnterpriseOrganizations(enterpriseSlug, session, enterpriseBillingToken),
      getEnterpriseMembers(enterpriseSlug, session, enterpriseBillingToken),
      getEnterpriseTeams(enterpriseSlug, session, enterpriseBillingToken),
    ]);
    const discoveredOrganizations = enterpriseOrganizationsResult.status === 'fulfilled'
      ? enterpriseOrganizationsResult.value
      : [];
    const inventoryOrganizationSlugs = Array.from(new Map(
      [...discoveredOrganizations.map((organization) => organization.login), ...orgsToAssess]
        .map((organization) => [organization.toLowerCase(), organization])
    ).values());
    const discoveredOrganizationsBySlug = new Map(
      discoveredOrganizations.map((organization) => [organization.login.toLowerCase(), organization])
    );
    const enterpriseTeams = enterpriseTeamsResult.status === 'fulfilled'
      ? enterpriseTeamsResult.value
      : [];
    const enterpriseTeamMemberResults = await settleInBatches(
      enterpriseTeams,
      5,
      async (team) => ({
        team,
        members: await getEnterpriseTeamMembers(
          enterpriseSlug,
          team.id,
          session,
          enterpriseBillingToken
        ),
      })
    );

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
      organizationInventoryResults,
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
      mapInBatches(inventoryOrganizationSlugs, 5, (org) => collectOrganizationInventory(org, session)),
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

    const organizationInventory: NonNullable<AssessmentResult['organizations']> = [];
    const teams: NonNullable<AssessmentResult['teams']> = [];
    const teamMemberships: GitHubTeamMembership[] = [];
    const usersByLogin = new Map<string, {
      id: number | null;
      nodeId: string;
      login: string;
      displayName: string | null;
      email: string | null;
      organizations: Set<string>;
      teams: Map<string, {
        id: number;
        name: string;
        slug: string;
        scope: 'enterprise' | 'organization';
        organization: string | null;
      }>;
    }>();
    const organizationInventoryFailures: string[] = [];
    const userInventoryFailures: string[] = [];
    const teamInventoryFailures: string[] = [];

    if (enterpriseMembersResult.status === 'fulfilled') {
      for (const member of enterpriseMembersResult.value) {
        usersByLogin.set(member.login.toLowerCase(), {
          id: member.id,
          nodeId: member.nodeId,
          login: member.login,
          displayName: member.name,
          email: member.email,
          organizations: new Set<string>(),
          teams: new Map<string, {
            id: number;
            name: string;
            slug: string;
            scope: 'enterprise' | 'organization';
            organization: string | null;
          }>(),
        });
      }
    }

    enterpriseTeamMemberResults.forEach((memberResult, index) => {
      const enterpriseTeam = enterpriseTeams[index];
      if (memberResult.status === 'rejected') {
        teamInventoryFailures.push(
          `enterprise/${enterpriseTeam.slug}: ${getFailureMessage(memberResult.reason)}`
        );
        return;
      }

      for (const member of memberResult.value.members) {
        if (member.id === null) continue;
        teamMemberships.push({
          teamId: enterpriseTeam.id,
          userId: member.id,
          login: member.login,
          scope: 'enterprise',
          organization: null,
          role: 'member',
          state: 'active',
        });
        const memberKey = member.login.toLowerCase();
        const user = usersByLogin.get(memberKey) ?? {
          id: member.id,
          nodeId: member.nodeId,
          login: member.login,
          displayName: member.name,
          email: member.email,
          organizations: new Set<string>(),
          teams: new Map(),
        };
        user.id ??= member.id;
        user.displayName ??= member.name;
        user.email ??= member.email;
        user.teams.set(`enterprise:${enterpriseTeam.id}`, {
          id: enterpriseTeam.id,
          name: enterpriseTeam.name,
          slug: enterpriseTeam.slug,
          scope: 'enterprise',
          organization: null,
        });
        usersByLogin.set(memberKey, user);
      }
    });

    teams.push(...enterpriseTeams.map((team, index) => ({
      id: team.id,
      nodeId: null,
      scope: 'enterprise' as const,
      organization: null,
      name: team.name,
      slug: team.slug,
      description: team.description,
      privacy: null,
      permission: null,
      parentTeamId: null,
      memberCount: enterpriseTeamMemberResults[index]?.status === 'fulfilled'
        ? enterpriseTeamMemberResults[index].value.members.length
        : null,
      organizationSelectionType: team.organizationSelectionType,
    })));

    for (const inventory of organizationInventoryResults) {
      const details = inventory.detailsResult.status === 'fulfilled'
        ? inventory.detailsResult.value
        : discoveredOrganizationsBySlug.get(inventory.org.toLowerCase()) ?? null;
      const members = inventory.membersResult.status === 'fulfilled'
        ? inventory.membersResult.value
        : [];
      const organizationTeams = inventory.teamsResult.status === 'fulfilled'
        ? inventory.teamsResult.value
        : [];
      organizationInventory.push({
        id: details?.id ?? null,
        nodeId: details?.nodeId ?? null,
        slug: inventory.org,
        name: details?.name ?? null,
        memberCount: inventory.membersResult.status === 'fulfilled' ? members.length : null,
        teamCount: inventory.teamsResult.status === 'fulfilled' ? organizationTeams.length : null,
      });
      if (inventory.detailsResult.status === 'rejected' && !details) {
        organizationInventoryFailures.push(
          `${inventory.org}: ${getFailureMessage(inventory.detailsResult.reason)}`
        );
      }
      if (inventory.membersResult.status === 'rejected') {
        userInventoryFailures.push(
          `${inventory.org}: ${getFailureMessage(inventory.membersResult.reason)}`
        );
      }
      if (inventory.teamsResult.status === 'rejected') {
        teamInventoryFailures.push(
          `${inventory.org}: ${getFailureMessage(inventory.teamsResult.reason)}`
        );
      }

      for (const member of members) {
        const memberKey = member.login.toLowerCase();
        const user = usersByLogin.get(memberKey) ?? {
          id: member.id,
          nodeId: member.nodeId,
          login: member.login,
          displayName: null,
          email: null,
          organizations: new Set<string>(),
          teams: new Map(),
        };
        user.id ??= member.id;
        user.organizations.add(inventory.org);
        usersByLogin.set(memberKey, user);
      }

      const memberCountByTeam = new Map<number, number>();
      for (const teamMemberResult of inventory.teamMemberResults) {
        if (teamMemberResult.status === 'rejected') continue;
        const { team, members: teamMembers } = teamMemberResult.value;
        memberCountByTeam.set(team.id, teamMembers.length);
        for (const member of teamMembers) {
          teamMemberships.push({
            teamId: team.id,
            userId: member.id,
            login: member.login,
            scope: 'organization',
            organization: inventory.org,
            role: member.role,
            state: 'active',
          });
          const memberKey = member.login.toLowerCase();
          const user = usersByLogin.get(memberKey) ?? {
            id: member.id,
            nodeId: member.nodeId,
            login: member.login,
            displayName: null,
            email: null,
            organizations: new Set<string>(),
            teams: new Map(),
          };
          user.id ??= member.id;
          user.organizations.add(inventory.org);
          user.teams.set(`organization:${inventory.org}:${team.id}`, {
            id: team.id,
            name: team.name,
            slug: team.slug,
            scope: 'organization',
            organization: inventory.org,
          });
          usersByLogin.set(memberKey, user);
        }
      }
      inventory.teamMemberResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const team = organizationTeams[index];
          teamInventoryFailures.push(
            `${inventory.org}/${team?.slug ?? 'unknown team'}: ${getFailureMessage(result.reason)}`
          );
        }
      });

      teams.push(...organizationTeams.map((team) => ({
        id: team.id,
        nodeId: team.nodeId,
        scope: 'organization' as const,
        organization: inventory.org,
        name: team.name,
        slug: team.slug,
        description: team.description,
        privacy: team.privacy,
        permission: team.permission,
        parentTeamId: team.parentTeamId,
        memberCount: memberCountByTeam.get(team.id) ?? null,
        organizationSelectionType: null,
      })));
    }

    const users: NonNullable<AssessmentResult['users']> = Array.from(usersByLogin.values())
      .map((user) => {
        const creditsConsumed = user.id === null ? null : userTotals.get(String(user.id)) ?? null;
        return {
          id: user.id,
          nodeId: user.nodeId,
          login: user.login,
          displayName: user.displayName,
          email: user.email,
          status: 'active',
          organizations: Array.from(user.organizations).sort(),
          teams: Array.from(user.teams.values()).sort((first, second) =>
            first.name.localeCompare(second.name)
          ),
          creditsConsumed,
          percentOfTotal: creditsConsumed !== null && totalCreditsConsumed > 0
            ? (creditsConsumed / totalCreditsConsumed) * 100
            : null,
        };
      })
      .sort((first, second) => first.login.localeCompare(second.login));
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
    const activeCostCenters = existingCostCenters.filter((costCenter) => costCenter.state === 'active');
    const reportingResults = await settleInBatches(
      activeCostCenters,
      4,
      (costCenter) => getCostCenterReportRow(
        enterpriseSlug,
        costCenter,
        session,
        year,
        month,
        enterpriseBillingToken
      )
    );
    const costCenterReporting = costCentersAvailable
      ? {
          enterprise: enterpriseSlug,
          fetchedAt: now.toISOString(),
          period: { year, month },
          costCenters: reportingResults.flatMap((reportingResult) =>
            reportingResult.status === 'fulfilled' ? [reportingResult.value] : []
          ),
          warnings: reportingResults.flatMap((reportingResult, index) =>
            reportingResult.status === 'rejected'
              ? [`${activeCostCenters[index].name}: ${getFailureMessage(reportingResult.reason)}`]
              : []
          ),
        }
      : null;
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
    if (organizationInventoryFailures.length > 0) {
      governanceDataWarnings.push({
        source: 'organizations',
        message: `Organization details are unavailable for ${organizationInventoryFailures.join(', ')}.`,
      });
    }
    if (enterpriseOrganizationsResult.status === 'rejected') {
      governanceDataWarnings.push({
        source: 'organizations',
        message: `Enterprise organization discovery failed; showing submitted organizations only. ${getFailureMessage(enterpriseOrganizationsResult.reason)}`,
      });
    }
    if (enterpriseMembersResult.status === 'rejected') {
      governanceDataWarnings.push({
        source: 'users',
        message: `Enterprise member discovery failed; showing members visible through organization and team APIs only. ${getFailureMessage(enterpriseMembersResult.reason)}`,
      });
    }
    if (enterpriseTeamsResult.status === 'rejected') {
      governanceDataWarnings.push({
        source: 'teams',
        message: `Enterprise team inventory is unavailable. ${getFailureMessage(enterpriseTeamsResult.reason)}`,
      });
    }
    if (userInventoryFailures.length > 0) {
      governanceDataWarnings.push({
        source: 'users',
        message: `Organization member inventory is unavailable for ${userInventoryFailures.join(', ')}.`,
      });
    }
    if (teamInventoryFailures.length > 0) {
      governanceDataWarnings.push({
        source: 'teams',
        message: `Team inventory is incomplete for ${teamInventoryFailures.join(', ')}.`,
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
      organizations: organizationInventory,
      teams,
      users,
      teamMemberships,
      costCenterReporting,
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
