import { CostCenterReportRow, CostCenterReportingSnapshot } from '../types';

export interface AllocationRow {
  id: string;
  name: string;
  percentage: number;
  allocatedCredits: number;
  actualUsage: number;
  remainingCredits: number;
  overageCredits: number;
  utilization: number | null;
}

export interface AllocationPlan {
  budget: number | '';
  percentages: Record<string, number>;
}

export function createDefaultPercentages(costCenters: CostCenterReportRow[]): Record<string, number> {
  if (costCenters.length === 0) return {};

  const percentage = Number((100 / costCenters.length).toFixed(6));
  return Object.fromEntries(costCenters.map((costCenter, index) => [
    costCenter.id,
    index === costCenters.length - 1
      ? Number((100 - percentage * (costCenters.length - 1)).toFixed(6))
      : percentage,
  ]));
}

export function calculateAllocationRows(
  budget: number,
  percentages: Record<string, number>,
  costCenters: CostCenterReportRow[]
): AllocationRow[] {
  return costCenters.map((costCenter) => {
    const percentage = Number.isFinite(percentages[costCenter.id]) ? percentages[costCenter.id] : 0;
    const actualUsage = Math.max(costCenter.metrics.grossQuantity, 0);
    const allocatedCredits = Math.max((budget * percentage) / 100, 0);

    return {
      id: costCenter.id,
      name: costCenter.name,
      percentage,
      allocatedCredits,
      actualUsage,
      remainingCredits: Math.max(allocatedCredits - actualUsage, 0),
      overageCredits: Math.max(actualUsage - allocatedCredits, 0),
      utilization: allocatedCredits > 0 ? (actualUsage / allocatedCredits) * 100 : null,
    };
  });
}

export function getAllocationStorageKey(enterprise: string): string {
  return `ghcp-ai-credits:allocation:v1:${enterprise.trim().toLowerCase()}`;
}

export function loadAllocationPlan(
  enterprise: string,
  costCenters: CostCenterReportRow[],
  defaultBudget: number
): AllocationPlan {
  const defaultPercentages = createDefaultPercentages(costCenters);
  try {
    const saved = JSON.parse(localStorage.getItem(getAllocationStorageKey(enterprise)) ?? 'null');
    const savedBudget = Number(saved?.budget);
    return {
      budget: Number.isFinite(savedBudget) && savedBudget > 0 ? savedBudget : defaultBudget || '',
      percentages: Object.fromEntries(costCenters.map((costCenter) => {
        const savedPercentage = Number(saved?.percentages?.[costCenter.id]);
        return [
          costCenter.id,
          Number.isFinite(savedPercentage) ? savedPercentage : defaultPercentages[costCenter.id],
        ];
      })),
    };
  } catch {
    return { budget: defaultBudget || '', percentages: defaultPercentages };
  }
}

function escapeCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function roundPercentage(value: number | null | undefined): number | '' {
  return value === null || value === undefined ? '' : Number(value.toFixed(2));
}

interface ReportContext {
  snapshot: CostCenterReportingSnapshot;
  costCenter: CostCenterReportRow;
  budget: number | null;
  allocation?: AllocationRow;
}

const REPORT_COLUMNS: Array<[string, (context: ReportContext) => unknown]> = [
  ['Enterprise', ({ snapshot }) => snapshot.enterprise],
  ['Data fetched at', ({ snapshot }) => snapshot.fetchedAt],
  ['Reporting period', ({ snapshot }) => `${snapshot.period.year}-${String(snapshot.period.month).padStart(2, '0')}`],
  ['Cost center ID', ({ costCenter }) => costCenter.id],
  ['Cost center name', ({ costCenter }) => costCenter.name],
  ['State', ({ costCenter }) => costCenter.state],
  ['Azure subscription', ({ costCenter }) => costCenter.azureSubscription ?? ''],
  ['Assigned resources', ({ costCenter }) => costCenter.metrics.assignedResources],
  ['AI credit pool enabled', ({ costCenter }) => costCenter.aiCreditPoolEnabled ? 'Yes' : 'No'],
  ['Pool target credits', ({ costCenter }) => costCenter.poolTargetCredits],
  ['Pool consumption credits', ({ costCenter }) => costCenter.poolCurrentCredits],
  ['Included pool utilization percent', ({ costCenter }) => roundPercentage(costCenter.utilization)],
  ['Gross quantity', ({ costCenter }) => costCenter.metrics.grossQuantity],
  ['Gross amount USD', ({ costCenter }) => costCenter.metrics.grossAmount],
  ['Discount amount USD', ({ costCenter }) => costCenter.metrics.discountAmount],
  ['Net AI amount USD', ({ costCenter }) => costCenter.metrics.netAmount],
  ['Other metered spend USD', ({ costCenter }) => costCenter.metrics.otherMeteredSpend],
  ['Usage line items', ({ costCenter }) => costCenter.metrics.usageLineItems],
  ['Total metered spend USD', ({ costCenter }) => costCenter.metrics.totalMeteredSpend],
  ['Enterprise included-credit budget', ({ budget }) => budget ?? ''],
  ['Allocation percent', ({ allocation }) => allocation?.percentage ?? ''],
  ['Allocated credits', ({ allocation }) => allocation?.allocatedCredits ?? ''],
  ['Actual usage credits', ({ allocation }) => allocation?.actualUsage ?? ''],
  ['Remaining allocation credits', ({ allocation }) => allocation?.remainingCredits ?? ''],
  ['Overage credits', ({ allocation }) => allocation?.overageCredits ?? ''],
  ['Allocation utilization percent', ({ allocation }) => roundPercentage(allocation?.utilization)],
];

export function buildConsolidatedReport(
  snapshot: CostCenterReportingSnapshot,
  budget: number | null,
  allocationRows: AllocationRow[]
): string {
  const allocations = new Map(allocationRows.map((row) => [row.id, row]));
  const lines = [REPORT_COLUMNS.map(([heading]) => escapeCsvValue(heading)).join(',')];

  for (const costCenter of snapshot.costCenters) {
    const context = { snapshot, budget, costCenter, allocation: allocations.get(costCenter.id) };
    lines.push(REPORT_COLUMNS.map(([, getValue]) => escapeCsvValue(getValue(context))).join(','));
  }

  return `${lines.join('\r\n')}\r\n`;
}

export function getConsolidatedReportFilename(snapshot: CostCenterReportingSnapshot): string {
  const safeEnterprise = snapshot.enterprise.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const period = `${snapshot.period.year}-${String(snapshot.period.month).padStart(2, '0')}`;
  return `${safeEnterprise || 'enterprise'}-cost-center-report-${period}.csv`;
}