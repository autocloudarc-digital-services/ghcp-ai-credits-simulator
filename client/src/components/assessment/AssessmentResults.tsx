import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Building2,
  Check,
  CircleDollarSign,
  Coins,
  Database,
  Eye,
  Filter,
  Gauge,
  Info,
  LockKeyhole,
  OctagonX,
  Route,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { AssessmentResult, GitHubBudget } from '../../types';
import ConcentrationRiskChart from './ConcentrationRiskChart';

interface AssessmentResultsProps {
  result: AssessmentResult;
  totalIncludedPool: number;
}

type BudgetSortKey =
  | 'sku'
  | 'scope'
  | 'scopeTarget'
  | 'budgetAmount'
  | 'percent'
  | 'alertRecipients';
type BudgetSort = { key: BudgetSortKey; direction: 'ascending' | 'descending' };
type GovernanceTab = 'budgets' | 'costCenters' | 'organizations' | 'teams' | 'users';

const governanceTabs: GovernanceTab[] = ['budgets', 'costCenters', 'organizations', 'teams', 'users'];

export default function AssessmentResults({ result, totalIncludedPool }: AssessmentResultsProps) {
  const [budgetSort, setBudgetSort] = useState<BudgetSort | null>(null);
  const [activeGovernanceTab, setActiveGovernanceTab] = useState<GovernanceTab>('budgets');
  const [costCenterStatusFilter, setCostCenterStatusFilter] =
    useState<'all' | 'active' | 'deleted'>('all');
  const [costCenterStatusSort, setCostCenterStatusSort] =
    useState<'active-first' | 'deleted-first'>('active-first');
  const governanceDataWarnings = result.governanceDataWarnings ?? [];
  const includedCreditPool = (result.includedCreditPools ?? [])[0];
  const budgetsWarning = governanceDataWarnings.find((warning) => warning.source === 'budgets');
  const costCentersWarning = governanceDataWarnings.find((warning) => warning.source === 'costCenters');
  const organizationsWarning = governanceDataWarnings.find((warning) => warning.source === 'organizations');
  const teamsWarning = governanceDataWarnings.find((warning) => warning.source === 'teams');
  const usersWarning = governanceDataWarnings.find((warning) => warning.source === 'users');
  const poolUtilization =
    totalIncludedPool > 0 ? Math.min(999, (result.totalCreditsConsumed / totalIncludedPool) * 100) : 0;

  const modelEntries = Object.entries(result.byModel).sort((a, b) => b[1] - a[1]);
  const modelTotal = modelEntries.reduce((s, [, v]) => s + v, 0);

  const orgEntries = Object.entries(result.byOrganization).sort((a, b) => b[1] - a[1]);
  const organizationInventory = result.organizations ?? [];
  const teamInventory = result.teams ?? [];
  const userInventory = result.users ?? [];
  const teamMemberships = result.teamMemberships ?? [];
  const assessedUserCount = userInventory.length > 0 ? userInventory.length : result.topUsers.length;
  const visibleBudgets = sortBudgets(result.existingBudgets, budgetSort);
  const visibleCostCenters = result.existingCostCenters
    .filter((costCenter) => costCenterStatusFilter === 'all' || costCenter.state === costCenterStatusFilter)
    .sort((first, second) => {
      if (first.state === second.state) return first.name.localeCompare(second.name);
      const activeFirst = costCenterStatusSort === 'active-first';
      return first.state === 'active' ? (activeFirst ? -1 : 1) : activeFirst ? 1 : -1;
    });

  const riskColor =
    result.concentrationRiskScore > 66
      ? 'text-red-500'
      : result.concentrationRiskScore > 33
      ? 'text-amber-400'
      : 'text-green-400';

  const toggleBudgetSort = (key: BudgetSortKey) => {
    setBudgetSort((currentSort) => ({
      key,
      direction:
        currentSort?.key === key && currentSort.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
  };

  const handleGovernanceTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: GovernanceTab
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = governanceTabs.indexOf(currentTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? governanceTabs.length - 1
        : event.key === 'ArrowRight'
          ? (currentIndex + 1) % governanceTabs.length
          : (currentIndex - 1 + governanceTabs.length) % governanceTabs.length;
    const nextTab = governanceTabs[nextIndex];
    setActiveGovernanceTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`governance-tab-${nextTab}`)?.focus());
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Credits Consumed" value={result.totalCreditsConsumed.toLocaleString()} color="text-teal-400" />
        <StatCard label="Pool Utilization" value={`${poolUtilization.toFixed(1)}%`} color="text-blue-500" />
        <StatCard
          label="Concentration Risk"
          value={`${result.concentrationRiskScore}/100`}
          color={riskColor}
        />
        <StatCard label="Organizations Assessed" value={String(orgEntries.length)} color="text-slate-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Consumption by Organization</h4>
          <div className="space-y-2">
            {orgEntries.map(([org, credits]) => (
              <div key={org} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 truncate">{org}</span>
                <span className="font-numeric text-teal-400">{credits.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Model Breakdown</h4>
          <div className="space-y-2">
            {modelEntries.map(([model, credits]) => (
              <div key={model} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{model}</span>
                  <span className="font-numeric text-blue-400">
                    {modelTotal > 0 ? ((credits / modelTotal) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${modelTotal > 0 ? (credits / modelTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConcentrationRiskChart topUsers={result.topUsers} />

      {governanceDataWarnings.length > 0 && (
        <div className="bg-amber-400/10 border border-amber-400/40 text-amber-200 rounded-md px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4" /> Some enterprise governance data is unavailable
          </div>
          <ul className="mt-2 space-y-1">
            {governanceDataWarnings.map((warning) => (
              <li key={warning.source} className="text-xs break-words">
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-2">Daily Consumption Trend</h4>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={result.dailyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
            <Area type="monotone" dataKey="credits" stroke="#2dd4bf" fill="url(#trendGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Governance Gap Analysis
        </h4>
        {result.governanceGaps.length === 0 ? (
          <p className="text-sm text-green-400">No governance gaps detected.</p>
        ) : (
          <ul className="space-y-2">
            {result.governanceGaps.map((gap, idx) => (
              <li key={idx} className="text-sm text-slate-300 flex gap-2">
                <span className="text-amber-400">•</span> {gap}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(300px,0.9fr)_minmax(520px,1.1fr)] lg:items-center">
            <div className="flex items-start gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white shadow-sm shadow-blue-950/50">
                1
              </span>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-blue-300">
                  Monthly Included AI Credits (AIC) Shared Enterprise Pool
                </h4>
                <p className="text-xs leading-5 text-slate-400">
                  Included AI credits consumed by Copilot users across the assessed enterprise.
                </p>
              </div>
            </div>
            {includedCreditPool && (
              <div className="min-w-0 lg:border-l lg:border-slate-700 lg:pl-5">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-blue-300">
                  <span>Automatic shared pool</span>
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1.1fr)_20px_minmax(0,1fr)] items-center gap-1">
                  <PoolFlowStep
                    tooltipId="assigned-license-pool-help"
                    icon={<Users className="h-4 w-4" aria-hidden="true" />}
                    label="Eligible licenses"
                    value={`${includedCreditPool.totalLicenseCount.toLocaleString()} assigned`}
                    tooltip={`GitHub aggregates ${includedCreditPool.businessLicenseCount.toLocaleString()} Copilot Business and ${includedCreditPool.enterpriseLicenseCount.toLocaleString()} Copilot Enterprise licenses.`}
                  />
                  <ArrowRight className="h-4 w-4 justify-self-center text-slate-500" aria-hidden="true" />
                  <PoolFlowStep
                    tooltipId="shared-credit-pool-help"
                    icon={<Coins className="h-4 w-4" aria-hidden="true" />}
                    label="Shared AIC pool"
                    value={`${includedCreditPool.limit.toLocaleString()} monthly`}
                    tooltip="GitHub automatically creates one shared monthly included AI credit pool. No manual pool configuration is required."
                    emphasized
                  />
                  <ArrowRight className="h-4 w-4 justify-self-center text-slate-500" aria-hidden="true" />
                  <PoolFlowStep
                    tooltipId="enterprise-access-pool-help"
                    icon={<Users className="h-4 w-4" aria-hidden="true" />}
                    label="Enterprise access"
                    value="All licensed users"
                    tooltip="Every licensed Copilot user in the enterprise consumes included AI credits from the same shared pool each month."
                  />
                </div>
              </div>
            )}
          </div>
          {(result.includedCreditPools ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No included AI credit pools were reported.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="min-w-[1080px] w-full text-left text-sm">
                <caption className="sr-only">
                  Monthly enterprise included AI credit consumption and license totals by Copilot SKU
                </caption>
                <thead className="bg-slate-900/70 text-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Scope</th>
                    <th className="px-3 py-2 font-semibold">Scope target</th>
                    <th className="px-3 py-2 text-right font-semibold">Copilot Business</th>
                    <th className="px-3 py-2 text-right font-semibold">Copilot Enterprise</th>
                    <th className="px-3 py-2 text-right font-semibold">Total licenses</th>
                    <th className="w-80 px-3 py-2 font-semibold">Included credits</th>
                    <th className="px-3 py-2 font-semibold">Monthly reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-200">
                  {(result.includedCreditPools ?? []).map((pool) => {
                    const utilization = getIncludedCreditUtilization(pool.used, pool.limit);
                    const progressColor = getIncludedCreditProgressColor(pool.used, utilization);
                    const usedLabel = pool.used === null ? 'Not reported' : pool.used.toLocaleString();

                    return (
                      <tr key={pool.id}>
                        <td className="px-3 py-3 capitalize">{pool.scope}</td>
                        <td className="max-w-48 break-words px-3 py-3">{pool.scopeTarget}</td>
                        <td className="px-3 py-3 text-right font-numeric">
                          {pool.businessLicenseCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-numeric">
                          {pool.enterpriseLicenseCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-numeric font-semibold">
                          {pool.totalLicenseCount.toLocaleString()}
                        </td>
                        <td className="w-80 px-3 py-3">
                          <div className="mb-2 font-numeric text-slate-100">
                            {usedLabel} / {pool.limit.toLocaleString()} AI credits
                          </div>
                          <div
                            className="h-2 w-full overflow-hidden rounded-full bg-slate-700"
                            role="progressbar"
                            aria-label={`Enterprise included AI credits used for ${pool.scopeTarget}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pool.used === null ? undefined : Math.min(100, utilization)}
                            aria-valuetext={
                              pool.used === null
                                ? 'Usage not reported'
                                : `${utilization.toFixed(1)} percent used`
                            }
                          >
                            <div
                              className={`h-full rounded-full ${progressColor}`}
                              style={{ width: `${pool.used === null ? 0 : Math.min(100, utilization)}%` }}
                            />
                          </div>
                        </td>
                        <td className="max-w-64 px-3 py-3 text-xs text-slate-400">
                          {formatIncludedCreditReset(pool.resetDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <GovernancePolicyTable />

        <AICConsumptionFlow result={result} />

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-4 border-b border-slate-700">
            <h4 className="mb-3 text-sm font-semibold text-slate-200">Governance Configuration</h4>
            <div
              className="flex gap-1 overflow-x-auto"
              role="tablist"
              aria-label="Governance configuration tables"
            >
              {governanceTabs.map((tab) => (
                <button
                  key={tab}
                  id={`governance-tab-${tab}`}
                  type="button"
                  role="tab"
                  aria-selected={activeGovernanceTab === tab}
                  aria-controls={`governance-panel-${tab}`}
                  tabIndex={activeGovernanceTab === tab ? 0 : -1}
                  onClick={() => setActiveGovernanceTab(tab)}
                  onKeyDown={(event) => handleGovernanceTabKeyDown(event, tab)}
                  className={`shrink-0 border-b-2 px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                    activeGovernanceTab === tab
                      ? 'border-teal-400 text-teal-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {formatGovernanceTabLabel(tab, {
                    budgets: result.existingBudgets.length,
                    costCenters: result.existingCostCenters.length,
                    organizations: organizationInventory.length > 0
                      ? organizationInventory.length
                      : orgEntries.length,
                    teams: teamInventory.length,
                    users: assessedUserCount,
                  })}
                </button>
              ))}
            </div>
          </div>

          <div
            id="governance-panel-budgets"
            role="tabpanel"
            aria-labelledby="governance-tab-budgets"
            hidden={activeGovernanceTab !== 'budgets'}
          >
          {budgetsWarning ? (
            <p className="text-sm text-amber-300">Budget data unavailable.</p>
          ) : result.existingBudgets.length === 0 ? (
            <p className="text-sm text-slate-500">No budgets currently configured.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="min-w-[1360px] w-full text-left text-sm">
                <caption className="sr-only">Normalized enterprise budget configuration records</caption>
                <thead className="bg-slate-900/70 text-slate-200">
                  <tr>
                    <SortableBudgetHeader
                      label="SKU"
                      sortKey="sku"
                      activeSort={budgetSort}
                      onSort={toggleBudgetSort}
                    />
                    <th className="px-3 py-2 text-right font-semibold">Licenses</th>
                    <SortableBudgetHeader
                      label="Scope"
                      sortKey="scope"
                      activeSort={budgetSort}
                      onSort={toggleBudgetSort}
                    />
                    <SortableBudgetHeader
                      label="Scope target"
                      sortKey="scopeTarget"
                      activeSort={budgetSort}
                      onSort={toggleBudgetSort}
                    />
                    <th className="px-3 py-2 font-semibold">Coverage</th>
                    <SortableBudgetHeader
                      label="Amount"
                      sortKey="budgetAmount"
                      activeSort={budgetSort}
                      onSort={toggleBudgetSort}
                      align="right"
                      className="pr-8"
                    />
                    <th className="px-3 py-2 text-right font-semibold">Used</th>
                    <SortableBudgetHeader
                      label="Percent"
                      sortKey="percent"
                      activeSort={budgetSort}
                      onSort={toggleBudgetSort}
                      className="w-48"
                    />
                    <th className="px-3 py-2 font-semibold">Stop at limit</th>
                    <th className="px-3 py-2 font-semibold">Threshold alerts</th>
                    <SortableBudgetHeader
                      label="Alert recipients"
                      sortKey="alertRecipients"
                      activeSort={budgetSort}
                      onSort={toggleBudgetSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-200">
                  {visibleBudgets.map((budget) => {
                    const percentUsed = budget.limit > 0 ? (budget.used / budget.limit) * 100 : 0;
                    const licenses = formatBudgetLicenses(budget);

                    return (
                    <tr key={budget.id}>
                      <td className="px-3 py-3">
                        {budget.skus.length === 0
                          ? 'Not reported'
                          : budget.skus.map(formatBudgetSku).join(', ')}
                      </td>
                      <td
                        className="px-3 py-3 text-right font-numeric"
                        title={licenses.description}
                        aria-label={licenses.description}
                      >
                        {licenses.label}
                      </td>
                      <td className="px-3 py-3 capitalize">{formatBudgetScope(budget.scope)}</td>
                      <td className="max-w-48 break-words px-3 py-3">{budget.scopeTarget}</td>
                      <td className="whitespace-nowrap px-3 py-3">{resolveBudgetType(budget)}</td>
                      <td className="py-3 pl-3 pr-8 text-right font-numeric">
                        ${budget.limit.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-numeric">
                        ${budget.used.toLocaleString()}
                      </td>
                      <td className="w-48 px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-slate-700"
                            role="progressbar"
                            aria-label={`${formatBudgetSku(budget.skus[0] ?? 'budget')} budget used`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.min(100, percentUsed)}
                          >
                            <div
                              className="h-full rounded-full bg-teal-400"
                              style={{ width: `${Math.min(100, percentUsed)}%` }}
                            />
                          </div>
                          <span className="min-w-12 text-right font-numeric font-semibold text-teal-300">
                            {percentUsed.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <ReadOnlyCheckbox checked={budget.preventFurtherUsage} />
                      </td>
                      <td className="px-3 py-3">
                        <ReadOnlyCheckbox checked={budget.alertsEnabled} />
                      </td>
                      <td className="max-w-56 break-words px-3 py-3">
                        {formatAlertRecipients(budget)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>

          <div
            id="governance-panel-costCenters"
            role="tabpanel"
            aria-labelledby="governance-tab-costCenters"
            hidden={activeGovernanceTab !== 'costCenters'}
          >
          {costCentersWarning ? (
            <p className="text-sm text-amber-300">Cost-center data unavailable.</p>
          ) : result.existingCostCenters.length === 0 ? (
            <p className="text-sm text-slate-500">No cost centers currently configured.</p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <Filter className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Filter by status</span>
                  <select
                    value={costCenterStatusFilter}
                    onChange={(event) =>
                      setCostCenterStatusFilter(event.target.value as 'all' | 'active' | 'deleted')
                    }
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <ArrowUpDown className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Sort by status</span>
                  <select
                    value={costCenterStatusSort}
                    onChange={(event) =>
                      setCostCenterStatusSort(event.target.value as 'active-first' | 'deleted-first')
                    }
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"
                  >
                    <option value="active-first">Active first</option>
                    <option value="deleted-first">Deleted first</option>
                  </select>
                </label>
              </div>
              {visibleCostCenters.length === 0 ? (
                <p className="text-sm text-slate-500">No cost centers match this status.</p>
              ) : (
                <div className="divide-y divide-slate-700">
                  {visibleCostCenters.map((c) => (
                    <div key={c.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-200">
                          {c.name}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-medium ${
                            c.state === 'active' ? 'text-green-400' : 'text-slate-500'
                          }`}
                        >
                          {c.state === 'active' ? 'Active' : 'Deleted'}
                        </span>
                      </div>
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <label className="flex items-center gap-2 text-slate-400">
                          <CheckboxMark
                            checked={c.aiCreditPoolEnabled === true}
                            ariaLabel="AI credit included usage cap"
                          />
                          <span>AI credit included usage cap</span>
                        </label>
                        <span className="text-slate-500">
                          {c.aiCreditPoolEnabled === undefined
                            ? 'Not reported'
                            : c.aiCreditPoolEnabled
                              ? 'Enabled'
                              : 'Disabled'}
                        </span>
                        {c.aiCreditPoolEnabled && c.aiCreditPoolState && (
                          <span className="basis-full text-slate-500">
                            {c.aiCreditPoolState.currentAmount === null
                              ? 'Current usage pending'
                              : `${c.aiCreditPoolState.currentAmount.toLocaleString()} credits used`}
                            {' / '}
                            {c.aiCreditPoolState.targetAmount === null
                              ? 'cap pending'
                              : `${c.aiCreditPoolState.targetAmount.toLocaleString()} credit cap`}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto rounded-md border border-slate-700">
                        <table className="w-full table-fixed text-left text-xs">
                          <caption className="sr-only">
                            Resource types and names assigned to {c.name}
                          </caption>
                          <thead className="bg-slate-900/70 text-slate-400">
                            <tr>
                              <th className="w-1/3 px-3 py-2 font-medium">resource-type</th>
                              <th className="px-3 py-2 font-medium">resource-name</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {c.resources.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="px-3 py-3 text-slate-500">
                                  No resources assigned
                                </td>
                              </tr>
                            ) : (
                              c.resources.map((resource, index) => (
                                <tr key={`${resource.type}:${resource.name}:${index}`}>
                                  <td className="break-words px-3 py-2 text-slate-400">
                                    {resource.type}
                                  </td>
                                  <td className="break-words px-3 py-2 text-slate-300">
                                    {resource.name}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          </div>

          <div
            id="governance-panel-organizations"
            role="tabpanel"
            aria-labelledby="governance-tab-organizations"
            hidden={activeGovernanceTab !== 'organizations'}
          >
            {organizationInventory.length === 0 ? (
              <p className={`text-sm ${organizationsWarning ? 'text-amber-300' : 'text-slate-500'}`}>
                {organizationsWarning?.message ?? 'No organization inventory was reported.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-700">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <caption className="sr-only">Assessed organization inventory and AI credit consumption</caption>
                  <thead className="bg-slate-900/70 text-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Organization ID</th>
                      <th className="px-3 py-2 font-semibold">Organization</th>
                      <th className="px-3 py-2 font-semibold">Node ID</th>
                      <th className="px-3 py-2 font-semibold">Slug</th>
                      <th className="px-3 py-2 text-right font-semibold">Members</th>
                      <th className="px-3 py-2 text-right font-semibold">Teams</th>
                      <th className="px-3 py-2 text-right font-semibold">Credits consumed</th>
                      <th className="px-3 py-2 text-right font-semibold">Share of total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-slate-200">
                    {organizationInventory.map((organization) => {
                      const credits = result.byOrganization[organization.slug] ?? 0;
                      const share = result.totalCreditsConsumed > 0
                        ? (credits / result.totalCreditsConsumed) * 100
                        : 0;
                      return (
                        <tr key={organization.slug}>
                          <td className="px-3 py-3 font-numeric text-xs text-slate-400">{organization.id ?? 'Unavailable'}</td>
                          <td className="max-w-80 break-words px-3 py-3 font-medium">{organization.name ?? organization.slug}</td>
                          <td className="max-w-64 break-words px-3 py-3 font-numeric text-xs text-slate-400">{organization.nodeId ?? 'Unavailable'}</td>
                          <td className="max-w-64 break-words px-3 py-3 text-slate-300">{organization.slug}</td>
                          <td className="px-3 py-3 text-right font-numeric">{organization.memberCount?.toLocaleString() ?? 'Unavailable'}</td>
                          <td className="px-3 py-3 text-right font-numeric">{organization.teamCount?.toLocaleString() ?? 'Unavailable'}</td>
                          <td className="px-3 py-3 text-right font-numeric">{credits.toLocaleString()}</td>
                          <td className="px-3 py-3 text-right font-numeric">{share.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            id="governance-panel-teams"
            role="tabpanel"
            aria-labelledby="governance-tab-teams"
            hidden={activeGovernanceTab !== 'teams'}
          >
            {teamInventory.length === 0 ? (
              <p className={`text-sm ${teamsWarning ? 'text-amber-300' : 'text-slate-500'}`}>
                {teamsWarning?.message ?? 'No teams were reported by the assessed organizations.'}
              </p>
            ) : (
            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <caption className="sr-only">Organization team inventory and memberships</caption>
                <thead className="bg-slate-900/70 text-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Team ID</th>
                    <th className="px-3 py-2 font-semibold">Organization ID</th>
                    <th className="px-3 py-2 font-semibold">Parent team ID</th>
                    <th className="px-3 py-2 font-semibold">Slug</th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Privacy</th>
                    <th className="px-3 py-2 font-semibold">Permission</th>
                    <th className="px-3 py-2 text-right font-semibold">Members</th>
                    <th className="px-3 py-2 text-right font-semibold">Maintainers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-200">
                  {teamInventory.map((team) => {
                    const organizationId = organizationInventory.find(
                      (organization) => organization.slug === team.organization
                    )?.id;
                    return (
                      <tr key={`${team.organization}:${team.id}`}>
                        <td className="px-3 py-3 font-numeric text-xs text-slate-400">{team.id}</td>
                        <td className="px-3 py-3 font-numeric text-xs text-slate-400">{organizationId ?? 'Unavailable'}</td>
                        <td className="px-3 py-3 font-numeric text-xs text-slate-400">{team.parentTeamId ?? 'None'}</td>
                        <td className="max-w-64 break-words px-3 py-3 text-slate-300">{team.slug}</td>
                        <td className="max-w-80 break-words px-3 py-3 font-medium">{team.name}</td>
                        <td className="px-3 py-3 text-slate-300">{team.privacy}</td>
                        <td className="px-3 py-3 text-slate-300">{team.permission}</td>
                        <td className="px-3 py-3 text-right font-numeric">{team.memberCount.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-numeric">
                          {teamMemberships.filter(
                            (membership) => membership.teamId === team.id
                              && membership.organization === team.organization
                              && membership.role === 'maintainer'
                          ).length.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          <div
            id="governance-panel-users"
            role="tabpanel"
            aria-labelledby="governance-tab-users"
            hidden={activeGovernanceTab !== 'users'}
          >
            {userInventory.length === 0 ? (
              <p className={`text-sm ${usersWarning ? 'text-amber-300' : 'text-slate-500'}`}>
                {usersWarning?.message ?? 'No organization members were reported.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-700">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <caption className="sr-only">Organization member inventory with team memberships and AI credit consumption</caption>
                  <thead className="bg-slate-900/70 text-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold">User ID</th>
                      <th className="px-3 py-2 font-semibold">Login</th>
                      <th className="px-3 py-2 font-semibold">Display name</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Organizations</th>
                      <th className="px-3 py-2 font-semibold">Teams</th>
                      <th className="px-3 py-2 text-right font-semibold">Credits consumed</th>
                      <th className="px-3 py-2 text-right font-semibold">Share of total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-slate-200">
                    {userInventory.map((user) => (
                      <tr key={user.id}>
                        <td className="max-w-72 break-words px-3 py-3 font-numeric text-xs text-slate-400">{user.id}</td>
                        <td className="px-3 py-3 font-medium">{user.login}</td>
                        <td className="px-3 py-3 text-slate-400">{user.displayName ?? 'Not provided by member inventory'}</td>
                        <td className="px-3 py-3 text-slate-400">{user.email ?? 'Not provided by member inventory'}</td>
                        <td className="px-3 py-3 text-slate-300">{user.status}</td>
                        <td className="max-w-72 break-words px-3 py-3 text-slate-300">{user.organizations.join(', ')}</td>
                        <td className="max-w-96 break-words px-3 py-3 text-slate-300">
                          {user.teams.length > 0
                            ? user.teams.map((team) => `${team.organization}/${team.slug}`).join(', ')
                            : 'None'}
                        </td>
                        <td className="px-3 py-3 text-right font-numeric">{user.creditsConsumed?.toLocaleString() ?? 'Not attributed'}</td>
                        <td className="px-3 py-3 text-right font-numeric">{user.percentOfTotal !== null ? `${user.percentOfTotal.toFixed(1)}%` : 'Not attributed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const governancePolicies = [
  {
    id: 'user-level-budget-policy-help',
    icon: UserRoundCheck,
    title: 'User-Level Budget (ULB)',
    summary: 'Most specific budget applies first.',
    detail: 'Individual ULB, then Cost Center ULB, then Universal ULB. Budgets are not additive and apply to all AI credit SKUs.',
    status: 'Applicable',
  },
  {
    id: 'cost-center-policy-help',
    icon: Building2,
    title: 'Cost Center Policies',
    summary: 'Optional overage routing and exclusions.',
    detail: 'Cost center policies can route metered overage to a cost center budget and define policy or usage exclusions.',
    status: 'Optional',
  },
  {
    id: 'model-governance-policy-help',
    icon: ShieldCheck,
    title: 'Model Governance & Access',
    summary: 'Controls model access and availability.',
    detail: 'Policies can allow or block models, define model selection behavior, and control which models are available to users.',
    status: 'Applicable',
  },
  {
    id: 'consumption-control-policy-help',
    icon: Gauge,
    title: 'AI Credit Consumption Controls',
    summary: 'Token-based, model-specific credit rates.',
    detail: 'AI credit consumption is measured from token usage using the credit rate assigned to each model.',
    status: 'Applicable',
  },
  {
    id: 'other-enterprise-policy-help',
    icon: LockKeyhole,
    title: 'Other Policies',
    summary: 'Security, compliance, and audit controls.',
    detail: 'Enterprise controls may also govern data residency, auditing, feature access, security, and compliance requirements.',
    status: 'Applicable',
  },
] as const;

function GovernancePolicyTable() {
  return (
    <section className="rounded-lg border border-green-700/70 bg-slate-800 p-4" aria-labelledby="governance-policy-title">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-green-700 text-xs font-bold text-white shadow-sm shadow-green-950/50">
          2
        </span>
        <div>
          <h4 id="governance-policy-title" className="mb-1 text-sm font-semibold text-green-300">
            Governance &amp; Policy Enforcement
          </h4>
          <p className="text-xs leading-5 text-slate-400">
            Policies are evaluated for every AI request in every phase.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-green-800/60">
        <table className="min-w-[920px] w-full table-fixed text-left">
          <caption className="sr-only">Enterprise governance and policy controls applied to AI credit requests</caption>
          <thead className="bg-green-950/30">
            <tr>
              {governancePolicies.map((policy) => {
                const Icon = policy.icon;
                return (
                  <th key={policy.id} scope="col" className="border-r border-green-900/60 px-3 py-3 last:border-r-0">
                    <div className="flex items-center gap-2 text-green-300">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold leading-4">{policy.title}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              {governancePolicies.map((policy) => (
                <td key={policy.id} className="border-r border-slate-700 px-3 py-3 last:border-r-0">
                  <HoverCallout
                    tooltipId={policy.id}
                    tooltip={policy.detail}
                    className="rounded outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                    tooltipClassName="border-green-800"
                  >
                    <div className="mb-2 inline-flex items-center gap-1 rounded bg-green-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-300">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      {policy.status}
                    </div>
                    <p className="text-xs leading-5 text-slate-300">{policy.summary}</p>
                    <Info className="mt-2 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  </HoverCallout>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AICConsumptionFlow({ result }: { result: AssessmentResult }) {
  const pool = (result.includedCreditPools ?? [])[0];
  const poolUsageAvailable = pool?.used !== null && pool?.used !== undefined;
  const poolUsed = pool?.used ?? 0;
  const poolRemaining = pool ? Math.max(0, pool.limit - poolUsed) : null;
  const poolExhausted = Boolean(pool && poolUsageAvailable && poolUsed >= pool.limit);
  const meteredCredits = result.meteredCreditsConsumed !== undefined
    ? result.meteredCreditsConsumed
    : poolUsageAvailable
      ? Math.max(0, result.totalCreditsConsumed - poolUsed)
      : null;
  const normalizedBudgets = result.existingBudgets.map((budget) => ({
    budget,
    scope: normalizeBudgetScope(budget.scope),
  }));
  const userLevelBudgets = normalizedBudgets.filter(({ scope }) =>
    scope.includes('user') || scope.includes('costcenter')
  );
  const organizationBudgets = normalizedBudgets.filter(({ scope }) => scope.includes('organization'));
  const enterpriseBudgets = normalizedBudgets.filter(({ scope }) => scope === 'enterprise');
  const activeCostCenters = result.existingCostCenters.filter((costCenter) => costCenter.state === 'active');
  const assignedCostCenters = activeCostCenters.filter((costCenter) => costCenter.resources.length > 0);
  const exhaustedEnterpriseBudgets = enterpriseBudgets.filter(
    ({ budget }) => budget.limit > 0 && budget.used >= budget.limit
  );
  const blockingBudgets = normalizedBudgets.filter(
    ({ budget }) => budget.preventFurtherUsage && budget.limit > 0 && budget.used >= budget.limit
  );
  const enterpriseBudgetRemaining = enterpriseBudgets.reduce(
    (total, { budget }) => total + Math.max(0, budget.limit - budget.used),
    0
  );
  const budgetsUnavailable = result.governanceDataWarnings.some((warning) => warning.source === 'budgets');
  const costCentersUnavailable = result.governanceDataWarnings.some(
    (warning) => warning.source === 'costCenters'
  );
  const stopEnabledCount = normalizedBudgets.filter(
    ({ budget }) => budget.preventFurtherUsage
  ).length;
  const poolValue = pool
    ? `${pool.limit.toLocaleString()} monthly`
    : 'Not reported';
  const poolDecisionValue = poolUsageAvailable
    ? (poolExhausted ? 'Yes' : 'No')
    : 'Unavailable';
  const meteredValue = meteredCredits === null
    ? 'Not reported'
    : `${meteredCredits.toLocaleString()} credits`;

  return (
    <section className="space-y-3" aria-label="AI credit end-to-end activity flow references">
      <div className="overflow-hidden rounded-lg border border-blue-800/60 bg-slate-800">
        <table className="w-full table-fixed text-left">
          <caption className="sr-only">End-to-end AI credit activity flow with current assessment values</caption>
          <colgroup>
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[10%]" /><col className="w-[1.5%]" />
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[8%]" /><col className="w-[1.5%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-blue-950/20">
            <tr>
              <th colSpan={19} className="px-4 py-3 text-xs font-semibold uppercase text-blue-300">
                End-to-End Flow (UML Activity Diagram Style)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="h-44 align-middle">
              <td className="px-1">
                <UmlActivityNode index="1" tone="blue" icon={<Database className="h-5 w-5" />} title="Automatic Included Pool Established" value={poolValue} detail="GitHub automatically establishes one shared monthly included AI credit pool from eligible Copilot licenses." />
              </td>
              <FlowArrow />
              <td className="px-1">
                <UmlActivityNode index="2" tone="green" icon={<ShieldCheck className="h-5 w-5" />} title="Governance & Policy Enforcement" value="All requests" detail="Enterprise governance and policy controls are evaluated for every AI request in every phase." />
              </td>
              <FlowArrow />
              <td className="relative px-1">
                <UmlDecisionNode index="3" title="Included Pool Exhausted?" value={poolDecisionValue} detail={pool ? `${poolRemaining?.toLocaleString()} of ${pool.limit.toLocaleString()} included AI credits remain.` : 'No included enterprise AI credit pool was reported.'} />
              </td>
              <FlowArrow label="Yes" />
              <td className="px-1">
                <UmlActivityNode index="4" tone="orange" icon={<Coins className="h-5 w-5" />} title="Metered AI Credits Begin" value={meteredValue} detail="Additional usage is metered using actual token consumption and model-specific AI credit rates." />
              </td>
              <FlowArrow />
              <td className="px-1">
                <UmlActivityNode index="5" tone="purple" icon={<UserRoundCheck className="h-5 w-5" />} title="Applicable ULB Enforcement" value={budgetsUnavailable ? 'Unavailable' : `${userLevelBudgets.length} scoped`} detail="The most specific applicable user-level budget applies: individual, then cost center, then universal." />
              </td>
              <FlowArrow />
              <td className="px-1">
                <UmlActivityNode tone="slate" icon={<Users className="h-5 w-5" />} title="User Assigned to a Cost Center?" value={costCentersUnavailable ? 'Unavailable' : assignedCostCenters.length > 0 ? 'Yes / No routes' : 'No assignments'} detail="Cost center resource assignments determine whether metered usage follows the cost center or organization route." />
              </td>
              <FlowArrow />
              <td className="px-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-green-300">Yes</span><ArrowRight className="h-3 w-3 text-slate-500" /></div>
                  <UmlActivityNode index="6a" tone="cyan" compact icon={<Building2 className="h-4 w-4" />} title="Cost Center Overage Budget" value={costCentersUnavailable ? 'Unavailable' : `${assignedCostCenters.length} assigned`} detail={`${activeCostCenters.length} active cost centers were reported; ${assignedCostCenters.length} have resource assignments.`} />
                  <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-red-300">No</span><ArrowRight className="h-3 w-3 text-slate-500" /></div>
                  <UmlActivityNode index="6b" tone="cyan" compact icon={<Route className="h-4 w-4" />} title="Organization Budget" value={budgetsUnavailable ? 'Unavailable' : `${organizationBudgets.length} configured`} detail="Users without a cost center follow the applicable organization budget route." />
                </div>
              </td>
              <FlowArrow />
              <td className="px-1">
                <UmlActivityNode index="7" tone="red" icon={<CircleDollarSign className="h-5 w-5" />} title="Enterprise Spending Budget" value={budgetsUnavailable ? 'Unavailable' : `$${enterpriseBudgetRemaining.toLocaleString()} remaining`} detail={`${enterpriseBudgets.length} enterprise ${pluralize(enterpriseBudgets.length, 'budget')} configured as the universal metered-overage safeguard.`} />
              </td>
              <FlowArrow />
              <td className="px-1">
                <UmlDecisionNode index="8" title="Enterprise Budget Exhausted?" value={budgetsUnavailable ? 'Unavailable' : exhaustedEnterpriseBudgets.length > 0 ? 'Yes' : 'No'} detail={`${exhaustedEnterpriseBudgets.length} of ${enterpriseBudgets.length} enterprise budgets have reached their limit.`} />
              </td>
              <FlowArrow label="Yes" />
              <td className="px-1">
                <UmlActivityNode index="9" tone="purple" icon={<Settings className="h-5 w-5" />} title="Stop Usage Setting?" value={budgetsUnavailable ? 'Unavailable' : `${stopEnabledCount} enabled`} detail="An exhausted applicable budget blocks requests only when prevent-further-usage is enabled." />
              </td>
              <td className="px-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-red-300">Yes</span><ArrowRight className="h-3 w-3 text-slate-500" /></div>
                  <UmlActivityNode index="10a" tone="red" compact icon={<OctagonX className="h-4 w-4" />} title="Blocked" value={budgetsUnavailable ? 'Unavailable' : `${blockingBudgets.length} blocking`} detail="Requests are blocked when an exhausted applicable budget prevents further usage." />
                  <div className="flex items-center gap-1"><span className="text-[10px] font-semibold text-green-300">No</span><ArrowRight className="h-3 w-3 text-slate-500" /></div>
                  <UmlActivityNode index="10b" tone="orange" compact icon={<CircleDollarSign className="h-4 w-4" />} title="Continue Billing" value={budgetsUnavailable ? 'Unavailable' : blockingBudgets.length === 0 ? 'Current path' : 'Conditional'} detail="Usage continues in a paid state when the applicable budget does not block further requests." />
                </div>
              </td>
            </tr>
            <tr className="h-10 text-[10px] text-slate-400">
              <td colSpan={5} className="px-5 pb-3">
                <div className="relative border-t border-dashed border-slate-500 pt-2 text-center">
                  Included credits remaining
                  <span className="absolute right-1 -top-3 flex items-center gap-1 font-semibold text-orange-300">
                    <ArrowUp className="h-3 w-3" /> No
                  </span>
                </div>
              </td>
              <td colSpan={8} className="px-5 pb-3">
                <div className="border-t border-dashed border-slate-500 pt-2 text-center">Metered usage and budget routing</div>
              </td>
              <td colSpan={6} className="px-5 pb-3">
                <div className="border-t border-dashed border-slate-500 pt-2 text-center">Enterprise budget safeguard and stop control</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <IconLegendTable />
        <TermsTable
          pool={pool}
          poolRemaining={poolRemaining}
          meteredCredits={meteredCredits}
          userLevelBudgetCount={userLevelBudgets.length}
          assignedCostCenterCount={assignedCostCenters.length}
          organizationBudgetCount={organizationBudgets.length}
          enterpriseBudgetCount={enterpriseBudgets.length}
          enterpriseBudgetRemaining={enterpriseBudgetRemaining}
          budgetsUnavailable={budgetsUnavailable}
          costCentersUnavailable={costCentersUnavailable}
        />
      </div>
    </section>
  );
}

type FlowTone = 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'red' | 'slate';

const flowToneClasses: Record<FlowTone, { border: string; badge: string; text: string }> = {
  blue: { border: 'border-blue-700/70', badge: 'bg-blue-600', text: 'text-blue-300' },
  green: { border: 'border-green-700/70', badge: 'bg-green-700', text: 'text-green-300' },
  orange: { border: 'border-orange-700/70', badge: 'bg-orange-600', text: 'text-orange-300' },
  purple: { border: 'border-violet-700/70', badge: 'bg-violet-600', text: 'text-violet-300' },
  cyan: { border: 'border-cyan-700/70', badge: 'bg-cyan-700', text: 'text-cyan-300' },
  red: { border: 'border-red-800/70', badge: 'bg-red-700', text: 'text-red-300' },
  slate: { border: 'border-slate-600', badge: 'bg-slate-600', text: 'text-slate-300' },
};

function UmlActivityNode({
  index,
  tone,
  icon,
  title,
  value,
  detail,
  compact = false,
}: {
  index?: string;
  tone: FlowTone;
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  compact?: boolean;
}) {
  const colors = flowToneClasses[tone];
  const tooltipId = `aic-flow-${(index ?? title).replace(/[^a-z0-9]/gi, '').toLowerCase()}-help`;

  return (
    <HoverCallout
      tooltipId={tooltipId}
      tooltip={detail}
      tooltipClassName={colors.border}
      className={`flex min-w-0 flex-col items-center justify-center rounded-md border bg-slate-900/40 p-1.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 ${compact ? 'min-h-14' : 'min-h-24'} ${colors.border}`}
    >
      {index && <span className={`mb-1 flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold text-white ${colors.badge}`}>{index}</span>}
      <div className={`mb-1 flex items-center gap-1.5 ${colors.text}`}>
        {icon}
        <Info className="h-3 w-3 opacity-70" aria-hidden="true" />
      </div>
      <div className="break-words text-[10px] font-semibold leading-3 text-slate-100">{title}</div>
      <div className="mt-1 max-w-full break-words font-numeric text-[9px] leading-3 text-slate-300">{value}</div>
    </HoverCallout>
  );
}

function UmlDecisionNode({ index, title, value, detail }: { index: string; title: string; value: string; detail: string }) {
  return (
    <HoverCallout tooltipId={`aic-decision-${index}-help`} tooltip={detail} tooltipClassName="border-orange-700/70" className="relative flex h-28 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
      <div className="absolute h-16 w-16 rotate-45 border border-orange-500 bg-orange-950/20" aria-hidden="true" />
      <div className="relative z-10 flex w-16 flex-col items-center text-center">
        <span className="mb-1 flex h-5 min-w-5 items-center justify-center rounded bg-blue-600 px-1 text-[10px] font-bold text-white">{index}</span>
        <span className="text-[9px] font-semibold leading-3 text-slate-100">{title}</span>
        <span className="mt-1 font-numeric text-[9px] text-orange-300">{value}</span>
      </div>
    </HoverCallout>
  );
}

function FlowArrow({ label }: { label?: string }) {
  return (
    <td className="px-0 text-center" aria-hidden="true">
      {label && <div className="mb-1 text-[10px] font-semibold text-orange-300">{label}</div>}
      <ArrowRight className="mx-auto h-4 w-4 text-slate-500" />
    </td>
  );
}

const iconLegend = [
  { icon: Users, label: 'Users' },
  { icon: Building2, label: 'Cost Center' },
  { icon: ShieldCheck, label: 'Policy / Shield' },
  { icon: Settings, label: 'Governance' },
  { icon: Database, label: 'Data / Stored' },
  { icon: CircleDollarSign, label: 'Budget / Finance' },
  { icon: Eye, label: 'Visibility' },
  { icon: Bell, label: 'Alert / Notification' },
  { icon: Gauge, label: 'Workflow / Decision' },
  { icon: OctagonX, label: 'Stop / Blocked' },
] as const;

function IconLegendTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-blue-800/60 bg-slate-800">
      <table className="min-w-[620px] w-full text-left text-xs">
        <caption className="sr-only">Icon legend for the AI credit activity flow</caption>
        <thead className="bg-blue-950/20"><tr><th colSpan={5} className="px-3 py-2 font-semibold uppercase text-blue-300">Icon Legend</th></tr></thead>
        <tbody className="divide-y divide-slate-700">
          {[iconLegend.slice(0, 5), iconLegend.slice(5)].map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map(({ icon: Icon, label }) => (
                <td key={label} className="px-3 py-3 text-slate-300">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" /><span>{label}</span></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TermsTable({ pool, poolRemaining, meteredCredits, userLevelBudgetCount, assignedCostCenterCount, organizationBudgetCount, enterpriseBudgetCount, enterpriseBudgetRemaining, budgetsUnavailable, costCentersUnavailable }: {
  pool: AssessmentResult['includedCreditPools'][number] | undefined;
  poolRemaining: number | null;
  meteredCredits: number | null;
  userLevelBudgetCount: number;
  assignedCostCenterCount: number;
  organizationBudgetCount: number;
  enterpriseBudgetCount: number;
  enterpriseBudgetRemaining: number;
  budgetsUnavailable: boolean;
  costCentersUnavailable: boolean;
}) {
  const terms = [
    ['AIC (AI Credits)', 'Token-based unit used for included and metered AI consumption.', meteredCredits === null ? 'Metered usage not reported' : `${meteredCredits.toLocaleString()} metered this month`],
    ['Included Pool', 'Shared monthly pool created automatically from eligible licenses.', pool ? `${poolRemaining?.toLocaleString()} / ${pool.limit.toLocaleString()} remaining` : 'Not reported'],
    ['User-Level Budget (ULB)', 'Most specific user budget: individual, cost center, then universal.', budgetsUnavailable ? 'Unavailable' : `${userLevelBudgetCount} scoped ${pluralize(userLevelBudgetCount, 'limit')}`],
    ['Cost Center Overage Budget', 'Metered overage charged to an assigned cost center.', costCentersUnavailable ? 'Unavailable' : `${assignedCostCenterCount} assigned`],
    ['Organization Budget', 'Alternative route for metered overage without a cost center.', budgetsUnavailable ? 'Unavailable' : `${organizationBudgetCount} configured`],
    ['Enterprise Spending Budget', 'Universal safeguard for remaining metered overage.', budgetsUnavailable ? 'Unavailable' : `${enterpriseBudgetCount} configured · $${enterpriseBudgetRemaining.toLocaleString()} remaining`],
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-blue-800/60 bg-slate-800">
      <table className="min-w-[720px] w-full text-left text-xs">
        <caption className="sr-only">Terms and current assessment values for AI credit flow</caption>
        <thead className="bg-blue-950/20"><tr><th className="px-3 py-2 font-semibold uppercase text-blue-300">Terms</th><th className="px-3 py-2 font-semibold text-slate-300">Definition</th><th className="px-3 py-2 font-semibold text-slate-300">Current assessment</th></tr></thead>
        <tbody className="divide-y divide-slate-700">
          {terms.map(([term, definition, current]) => <tr key={term}><th scope="row" className="px-3 py-2 font-semibold text-slate-200">{term}</th><td className="px-3 py-2 text-slate-400">{definition}</td><td className="px-3 py-2 font-numeric text-slate-300">{current}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

interface PoolFlowStepProps {
  tooltipId: string;
  icon: ReactNode;
  label: string;
  value: string;
  tooltip: string;
  emphasized?: boolean;
}

function PoolFlowStep({
  tooltipId,
  icon,
  label,
  value,
  tooltip,
  emphasized = false,
}: PoolFlowStepProps) {
  return (
    <HoverCallout
      tooltipId={tooltipId}
      tooltip={tooltip}
      className={`group relative min-w-0 rounded-md border px-2.5 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 ${
        emphasized
          ? 'border-blue-500/70 bg-blue-500/10'
          : 'border-slate-700 bg-slate-900/40'
      }`}
    >
      <div className={`mb-1 flex items-center gap-1.5 ${emphasized ? 'text-blue-300' : 'text-slate-400'}`}>
        {icon}
        <span className="truncate text-[10px] font-semibold uppercase">{label}</span>
      </div>
      <div className="truncate text-xs font-semibold text-slate-100">{value}</div>
    </HoverCallout>
  );
}

interface HoverCalloutProps {
  tooltipId: string;
  tooltip: string;
  children: ReactNode;
  className?: string;
  tooltipClassName?: string;
}

function HoverCallout({
  tooltipId,
  tooltip,
  children,
  className = '',
  tooltipClassName = 'border-slate-600',
}: HoverCalloutProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    placement: 'above' | 'below';
  } | null>(null);

  const showCallout = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const bounds = trigger.getBoundingClientRect();
    const width = 256;
    const edgePadding = 8;
    const placement = bounds.top >= 128 ? 'above' : 'below';
    setPosition({
      left: Math.max(
        edgePadding,
        Math.min(window.innerWidth - width - edgePadding, bounds.left + bounds.width / 2 - width / 2)
      ),
      top: placement === 'above' ? bounds.top - 8 : bounds.bottom + 8,
      placement,
    });
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        tabIndex={0}
        aria-describedby={position ? tooltipId : undefined}
        onMouseEnter={showCallout}
        onMouseLeave={() => setPosition(null)}
        onFocus={showCallout}
        onBlur={() => setPosition(null)}
      >
        {children}
      </div>
      {position && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none fixed z-50 w-64 rounded-md border bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-5 text-slate-200 shadow-xl ${tooltipClassName} ${
            position.placement === 'above' ? '-translate-y-full' : ''
          }`}
          style={{ left: position.left, top: position.top }}
        >
          {tooltip}
        </div>,
        document.body
      )}
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className={`font-numeric text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function formatBudgetSku(sku: string): string {
  return sku === 'ai_credits'
    ? 'All AI Credit SKUs'
    : sku.replace(/_/g, ' ').replace(/\b\w/g, (character: string) => character.toUpperCase());
}

function formatBudgetScope(scope: string): string {
  return scope.replace(/_/g, ' ');
}

function formatGovernanceTabLabel(
  tab: GovernanceTab,
  counts: Record<GovernanceTab, number>
): string {
  switch (tab) {
    case 'budgets':
      return `Budgets (monthly) · ${counts.budgets}`;
    case 'costCenters':
      return `Cost Centers · ${counts.costCenters}`;
    case 'organizations':
      return `Organizations · ${counts.organizations}`;
    case 'teams':
      return `Teams · ${counts.teams}`;
    case 'users':
      return `Users · ${counts.users}`;
  }
}

function normalizeBudgetScope(scope: string): string {
  return scope.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function getIncludedCreditUtilization(used: number | null, limit: number): number {
  return used !== null && limit > 0 ? (used / limit) * 100 : 0;
}

function getIncludedCreditProgressColor(used: number | null, utilization: number): string {
  if (used === null || used <= 0) return 'bg-slate-500';
  if (utilization >= 90) return 'bg-red-500';
  if (utilization > 75) return 'bg-amber-400';
  return 'bg-green-500';
}

function formatIncludedCreditReset(resetDate: string): string {
  const reset = new Date(resetDate);
  const daysUntilReset = Math.max(
    0,
    Math.ceil((reset.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(reset);
  return `Resets in ${daysUntilReset} ${daysUntilReset === 1 ? 'day' : 'days'} on ${formattedDate}.`;
}

function resolveBudgetType(budget: GitHubBudget): string {
  const hasAllAiCreditSkus = budget.skus.some(
    (sku) => sku.toLowerCase().replace(/[^a-z0-9]/g, '') === 'aicredits'
  );
  if (!hasAllAiCreditSkus) return budget.budgetType || 'Not reported';

  const normalizedScope = budget.scope.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalizedScope === 'enterprise') return 'additional';
  if (normalizedScope === 'multiusercostcenter') return 'included+additional';
  if (normalizedScope === 'organization' || normalizedScope === 'organizational') {
    return 'included';
  }
  return budget.budgetType || 'Not reported';
}

const budgetSortCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function sortBudgets(budgets: GitHubBudget[], sort: BudgetSort | null): GitHubBudget[] {
  if (!sort) return budgets;

  return budgets
    .map((budget, index) => ({ budget, index }))
    .sort((first, second) => {
      const firstValue = getBudgetSortValue(first.budget, sort.key);
      const secondValue = getBudgetSortValue(second.budget, sort.key);
      const comparison =
        typeof firstValue === 'number' && typeof secondValue === 'number'
          ? firstValue - secondValue
          : budgetSortCollator.compare(String(firstValue), String(secondValue));
      if (comparison === 0) return first.index - second.index;
      return sort.direction === 'ascending' ? comparison : -comparison;
    })
    .map(({ budget }) => budget);
}

function getBudgetSortValue(budget: GitHubBudget, key: BudgetSortKey): string | number {
  switch (key) {
    case 'sku':
      return budget.skus.length === 0
        ? 'Not reported'
        : budget.skus.map(formatBudgetSku).join(', ');
    case 'scope':
      return formatBudgetScope(budget.scope);
    case 'scopeTarget':
      return budget.scopeTarget;
    case 'budgetAmount':
      return budget.limit;
    case 'percent':
      return budget.limit > 0 ? (budget.used / budget.limit) * 100 : 0;
    case 'alertRecipients':
      return formatAlertRecipients(budget);
  }
}

function formatAlertRecipients(budget: GitHubBudget): string {
  return budget.alertRecipients.length > 0
    ? budget.alertRecipients.join(', ')
    : 'Default enterprise recipients';
}

function SortableBudgetHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: BudgetSortKey;
  activeSort: BudgetSort | null;
  onSort: (key: BudgetSortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const isActive = activeSort?.key === sortKey;
  const direction = isActive ? activeSort.direction : 'none';
  const SortIcon = !isActive
    ? ArrowUpDown
    : activeSort.direction === 'ascending'
      ? ArrowUp
      : ArrowDown;

  return (
    <th
      className={`px-3 py-2 font-semibold ${align === 'right' ? 'text-right' : ''} ${className}`}
      aria-sort={direction}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
          align === 'right' ? 'justify-end' : ''
        }`}
        aria-label={`Sort by ${label} ${isActive && activeSort.direction === 'ascending' ? 'descending' : 'ascending'}`}
      >
        <span>{label}</span>
        <SortIcon className={`h-3.5 w-3.5 ${isActive ? 'text-teal-300' : 'text-slate-500'}`} />
      </button>
    </th>
  );
}

function formatBudgetLicenses(budget: GitHubBudget): { label: string; description: string } {
  const enterpriseCount = budget.enterpriseLicenseCount;
  const organizationCount = budget.organizationLicenseCount;
  if (enterpriseCount === null && organizationCount === null) {
    return { label: 'Not reported', description: 'License inventory not reported' };
  }

  const enterpriseTotal = enterpriseCount ?? 0;
  const organizationTotal = organizationCount ?? 0;
  const total = enterpriseTotal + organizationTotal;
  if (enterpriseTotal > 0 && organizationTotal > 0) {
    return {
      label: `${total.toLocaleString()}(e+o)`,
      description: `${total.toLocaleString()} licenses: ${enterpriseTotal.toLocaleString()} enterprise-assigned and ${organizationTotal.toLocaleString()} organization-assigned`,
    };
  }
  if (enterpriseTotal > 0) {
    return {
      label: `${enterpriseTotal.toLocaleString()}(ent)`,
      description: `${enterpriseTotal.toLocaleString()} enterprise-assigned licenses`,
    };
  }
  if (organizationTotal > 0 || organizationCount !== null) {
    return {
      label: `${organizationTotal.toLocaleString()}(org)`,
      description: `${organizationTotal.toLocaleString()} organization-assigned licenses`,
    };
  }
  return {
    label: `${enterpriseTotal.toLocaleString()}(ent)`,
    description: `${enterpriseTotal.toLocaleString()} enterprise-assigned licenses`,
  };
}

function ReadOnlyCheckbox({ checked, label }: { checked: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <CheckboxMark checked={checked} ariaLabel={label ?? (checked ? 'Yes' : 'No')} />
      <span className="text-slate-500">{label ?? (checked ? 'Yes' : 'No')}</span>
    </span>
  );
}

function CheckboxMark({ checked, ariaLabel }: { checked: boolean; ariaLabel: string }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled
        aria-label={ariaLabel}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          checked ? 'border-green-400 bg-green-500/15' : 'border-slate-600 bg-slate-900'
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5 text-green-400" strokeWidth={4} />}
      </span>
    </span>
  );
}
