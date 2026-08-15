import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  CreditCard,
  Database,
  Download,
  FileWarning,
  Gauge,
  Layers3,
  ReceiptText,
  Save,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CostCenterReportingSnapshot } from '../../types';
import {
  buildConsolidatedReport,
  calculateAllocationRows,
  getAllocationStorageKey,
  getConsolidatedReportFilename,
  loadAllocationPlan,
} from '../../lib/costCenterReporting';

interface CostCenterReportingProps {
  snapshot: CostCenterReportingSnapshot | null;
  includedCreditBudget: number;
}

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export default function CostCenterReporting({
  snapshot,
  includedCreditBudget,
}: CostCenterReportingProps) {
  const costCenters = snapshot?.costCenters ?? [];
  const [selectedCostCenterId, setSelectedCostCenterId] = useState(costCenters[0]?.id ?? '');
  const [plan, setPlan] = useState(() => snapshot
    ? loadAllocationPlan(snapshot.enterprise, costCenters, includedCreditBudget)
    : { budget: includedCreditBudget || '' as const, percentages: {} }
  );
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (!snapshot) return;
    setPlan(loadAllocationPlan(snapshot.enterprise, snapshot.costCenters, includedCreditBudget));
    setSelectedCostCenterId(snapshot.costCenters[0]?.id ?? '');
  }, [snapshot, includedCreditBudget]);

  if (!snapshot) {
    return (
      <section className="border border-amber-400/30 bg-amber-400/5 px-6 py-10 text-center rounded-lg">
        <FileWarning className="mx-auto h-8 w-8 text-amber-300" />
        <h2 className="mt-3 text-lg font-semibold text-slate-100">Cost-center snapshot unavailable</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
          This assessment predates cost-center reporting or the billing data source was unavailable.
          Run a new assessment to collect the current-month showback and chargeback ledger.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400"
        >
          <BarChart3 className="h-4 w-4" /> Run assessment
        </Link>
      </section>
    );
  }

  if (costCenters.length === 0) {
    return (
      <section className="border border-slate-700 bg-slate-800 px-6 py-10 text-center rounded-lg">
        <Building2 className="mx-auto h-8 w-8 text-slate-500" />
        <h2 className="mt-3 text-lg font-semibold text-slate-100">No active cost centers returned</h2>
        <p className="mt-2 text-sm text-slate-400">
          GitHub returned no reportable active cost centers for {snapshot.enterprise}.
        </p>
        {snapshot.warnings.map((warning) => (
          <p key={warning} className="mt-2 text-xs text-amber-300">{warning}</p>
        ))}
      </section>
    );
  }

  const selectedCostCenter = costCenters.find((costCenter) => costCenter.id === selectedCostCenterId)
    ?? costCenters[0];
  const budget = Number(plan.budget);
  const validBudget = Number.isFinite(budget) && budget > 0;
  const allocationTotal = costCenters.reduce(
    (total, costCenter) => total + (Number(plan.percentages[costCenter.id]) || 0),
    0
  );
  const invalidPercentage = costCenters.some((costCenter) => {
    const percentage = Number(plan.percentages[costCenter.id]);
    return !Number.isFinite(percentage) || percentage < 0 || percentage > 100;
  });
  const validAllocation = validBudget && !invalidPercentage && Math.abs(allocationTotal - 100) <= 0.001;
  const allocationRows = calculateAllocationRows(validBudget ? budget : 0, plan.percentages, costCenters);
  const chartData = allocationRows.map((row) => ({
    name: row.name,
    Allocated: Math.round(row.allocatedCredits),
    Actual: Math.round(row.actualUsage),
  }));
  const reportingPeriod = new Date(
    Date.UTC(snapshot.period.year, snapshot.period.month - 1, 1)
  ).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const utilization = selectedCostCenter.utilization;
  const metrics = selectedCostCenter.metrics;
  const metricDefinitions = [
    { label: 'Assigned resources', value: integerFormatter.format(metrics.assignedResources), icon: Users, tone: 'text-sky-300' },
    { label: 'AI credit pool', value: selectedCostCenter.aiCreditPoolEnabled ? 'Enabled' : 'Shared pool', icon: ShieldCheck, tone: 'text-cyan-300' },
    { label: 'Pool target', value: compactFormatter.format(selectedCostCenter.poolTargetCredits), icon: Gauge, tone: 'text-blue-300' },
    { label: 'Pool consumption', value: compactFormatter.format(selectedCostCenter.poolCurrentCredits), icon: WalletCards, tone: 'text-emerald-300' },
    { label: 'Gross quantity', value: compactFormatter.format(metrics.grossQuantity), icon: Layers3, tone: 'text-teal-300' },
    { label: 'Gross amount', value: currencyFormatter.format(metrics.grossAmount), icon: CircleDollarSign, tone: 'text-green-300' },
    { label: 'Included value', value: currencyFormatter.format(metrics.discountAmount), icon: Tag, tone: 'text-fuchsia-300' },
    { label: 'Net AI chargeback', value: currencyFormatter.format(metrics.netAmount), icon: CreditCard, tone: 'text-orange-300' },
    { label: 'Other metered spend', value: currencyFormatter.format(metrics.otherMeteredSpend), icon: ShoppingCart, tone: 'text-indigo-300' },
    { label: 'Usage line items', value: integerFormatter.format(metrics.usageLineItems), icon: Database, tone: 'text-slate-300' },
    { label: 'Total metered spend', value: currencyFormatter.format(metrics.totalMeteredSpend), icon: ReceiptText, tone: 'text-amber-300' },
  ];

  const updatePercentage = (costCenterId: string, value: string) => {
    setPlan((current) => ({
      ...current,
      percentages: { ...current.percentages, [costCenterId]: Number(value) },
    }));
    setSaveStatus('');
  };

  const savePlan = () => {
    if (!validAllocation) return;
    localStorage.setItem(getAllocationStorageKey(snapshot.enterprise), JSON.stringify(plan));
    setSaveStatus('Allocation plan saved in this browser.');
  };

  const downloadReport = () => {
    const report = buildConsolidatedReport(snapshot, validBudget ? budget : null, allocationRows);
    const url = URL.createObjectURL(new Blob([`\uFEFF${report}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = getConsolidatedReportFilename(snapshot);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-700 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-teal-300">FinOps / Current-month billing</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Cost center overview</h2>
          <p className="mt-1 text-sm text-slate-400">
            {snapshot.enterprise} · {reportingPeriod} · captured{' '}
            {new Date(snapshot.fetchedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-56 flex-col gap-1 text-xs uppercase text-slate-400">
            Cost center
            <select
              value={selectedCostCenter.id}
              onChange={(event) => setSelectedCostCenterId(event.target.value)}
              className="h-10 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm normal-case text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              {costCenters.map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={downloadReport}
            className="flex h-10 items-center justify-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-slate-950 hover:bg-teal-400"
          >
            <Download className="h-4 w-4" /> Download CSV
          </button>
        </div>
      </section>

      {snapshot.warnings.length > 0 && (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">Some cost centers could not be loaded.</p>
          {snapshot.warnings.map((warning) => <p key={warning} className="mt-1 text-xs">{warning}</p>)}
        </div>
      )}

      <section className="grid overflow-hidden rounded-lg border border-slate-700 bg-slate-800 lg:grid-cols-[minmax(260px,0.9fr)_minmax(360px,1.1fr)]">
        <div className="p-5 lg:border-r lg:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-sky-400/10 text-sky-300">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-numeric text-xs uppercase text-slate-500">ID {selectedCostCenter.id.slice(0, 8)}</p>
                <h3 className="truncate text-lg font-semibold text-slate-100">{selectedCostCenter.name}</h3>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              selectedCostCenter.aiCreditPoolEnabled
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'bg-slate-700 text-slate-300'
            }`}>
              {selectedCostCenter.aiCreditPoolEnabled ? 'Cap active' : 'Shared pool'}
            </span>
          </div>
          <p className="mt-5 text-sm text-slate-400">
            {selectedCostCenter.azureSubscription
              ? `Azure subscription ${selectedCostCenter.azureSubscription}`
              : `${selectedCostCenter.resources.length} assigned resources`}
          </p>
        </div>
        <div className="border-t border-slate-700 p-5 lg:border-t-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Included pool utilization</p>
              <p className="mt-1 font-numeric text-3xl font-semibold text-slate-100">
                {utilization === null ? 'N/A' : `${Math.round(utilization)}%`}
              </p>
            </div>
            <p className="text-sm text-slate-400">{reportingPeriod}</p>
          </div>
          <div
            role="progressbar"
            aria-label="Included pool utilization"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={utilization === null ? undefined : Math.round(utilization)}
            className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700"
          >
            <div
              className={`h-full rounded-full ${
                (utilization ?? 0) >= 90 ? 'bg-orange-400' : (utilization ?? 0) >= 75 ? 'bg-amber-300' : 'bg-emerald-400'
              }`}
              style={{ width: `${utilization ?? 0}%` }}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="reporting-kpis-title">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 id="reporting-kpis-title" className="text-base font-semibold text-slate-100">Monthly snapshot</h3>
          <span className="text-sm text-slate-500">{selectedCostCenter.name}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricDefinitions.map(({ label, value, icon: Icon, tone }) => (
            <article key={label} className="min-h-28 rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
              </div>
              <p className="mt-4 break-words font-numeric text-xl font-semibold text-slate-100">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="allocation-title" className="border-t border-slate-700 pt-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="allocation-title" className="text-base font-semibold text-slate-100">Included credit allocation</h3>
            <p className="mt-1 text-sm text-slate-400">Compare departmental allocation with actual gross consumption.</p>
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-sky-400" /> Allocated</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-emerald-400" /> Actual</span>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.8fr)]">
          <form
            onSubmit={(event) => { event.preventDefault(); savePlan(); }}
            className="rounded-lg border border-slate-700 bg-slate-800 p-5"
          >
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-400">
              Enterprise included-credit budget
              <div className="flex items-center rounded-md border border-slate-600 bg-slate-900 focus-within:ring-2 focus-within:ring-teal-400">
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={plan.budget}
                  onChange={(event) => {
                    setPlan((current) => ({ ...current, budget: event.target.value === '' ? '' : Number(event.target.value) }));
                    setSaveStatus('');
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 font-numeric text-sm text-slate-100 outline-none"
                />
                <span className="pr-3 text-xs normal-case text-slate-500">credits</span>
              </div>
            </label>
            <div className="mt-4 flex items-center justify-between border-b border-slate-700 pb-3 text-sm">
              <span className="text-slate-400">Total allocated</span>
              <strong className={`font-numeric ${Math.abs(allocationTotal - 100) <= 0.001 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {Number(allocationTotal.toFixed(3))}%
              </strong>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {costCenters.map((costCenter) => {
                const allocation = allocationRows.find((row) => row.id === costCenter.id);
                return (
                  <div key={costCenter.id} className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3 border-b border-slate-700 py-3">
                    <label htmlFor={`allocation-${costCenter.id}`} className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-200">{costCenter.name}</span>
                      <span className="block text-xs text-slate-500">{compactFormatter.format(costCenter.metrics.grossQuantity)} actual</span>
                    </label>
                    <div>
                      <div className="flex items-center rounded-md border border-slate-600 bg-slate-900">
                        <input
                          id={`allocation-${costCenter.id}`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.001}
                          value={plan.percentages[costCenter.id] ?? 0}
                          onChange={(event) => updatePercentage(costCenter.id, event.target.value)}
                          className="w-full bg-transparent py-1.5 pl-2 font-numeric text-sm text-slate-100 outline-none"
                        />
                        <span className="pr-2 text-xs text-slate-500">%</span>
                      </div>
                      <span className="mt-1 block text-right text-xs text-slate-500">
                        {compactFormatter.format(allocation?.allocatedCredits ?? 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className={`mt-3 min-h-5 text-xs ${validAllocation ? 'text-emerald-300' : 'text-amber-300'}`} aria-live="polite">
              {saveStatus || (
                !validBudget
                  ? 'Enter an enterprise budget greater than zero.'
                  : invalidPercentage
                    ? 'Use a percentage from 0 to 100 for every cost center.'
                    : Math.abs(allocationTotal - 100) > 0.001
                      ? 'Adjust allocation percentages to total 100%.'
                      : '100% allocated. Ready to save.'
              )}
            </p>
            <button
              type="submit"
              disabled={!validAllocation}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              <Save className="h-4 w-4" /> Save allocations
            </button>
          </form>

          <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-800 p-4 sm:p-5">
            {validBudget ? (
              <ResponsiveContainer width="100%" height={390}>
                <BarChart data={chartData} margin={{ top: 16, right: 8, left: 8, bottom: 48 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    angle={-24}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(value) => compactFormatter.format(value)} />
                  <Tooltip
                    formatter={(value) => `${integerFormatter.format(Number(value))} credits`}
                    contentStyle={{ background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="Allocated" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual" fill="#34d399" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-[390px] place-items-center text-center text-sm text-slate-500">
                Enter the enterprise included-credit budget to build the comparison.
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="flex items-start gap-3 border-l-2 border-sky-400 bg-sky-400/5 px-4 py-3 text-sm leading-6 text-slate-300">
        <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <p>
          Values come from GitHub's current-month billing APIs. Cost-center resources are not licensed-user
          counts, and fixed license allocation remains separate from metered chargeback.
        </p>
      </aside>
    </div>
  );
}