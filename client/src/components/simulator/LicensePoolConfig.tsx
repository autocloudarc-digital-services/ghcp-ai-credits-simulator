import { ChangeEvent } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  calculateExhaustionDay,
  calculateIncludedPool,
  calculateOverageCost,
  calculateProjectedBurnRate,
} from '../../engine/creditCalculationEngine';

function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-numeric focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
    </label>
  );
}

export default function LicensePoolConfig() {
  const { simulatorConfig, setSimulatorConfig } = useAppStore();

  const pool = calculateIncludedPool(simulatorConfig);
  const burnRate = calculateProjectedBurnRate(simulatorConfig);
  const exhaustionDay = calculateExhaustionDay(pool, burnRate);
  const projectedTotal = burnRate * 30;
  const projectedOverageCost = calculateOverageCost(projectedTotal, pool);

  const exhaustionDate = (() => {
    const start = new Date(simulatorConfig.billingCycleStartDate);
    if (!isFinite(exhaustionDay) || isNaN(start.getTime())) return 'N/A';
    const d = new Date(start);
    d.setDate(d.getDate() + Math.round(exhaustionDay));
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">License &amp; Pool Configuration</h3>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">Enterprise Name</span>
          <input
            type="text"
            value={simulatorConfig.enterpriseName}
            onChange={(e) => setSimulatorConfig({ enterpriseName: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Copilot Business ($19/mo)"
            value={simulatorConfig.licenseCountBusiness}
            onChange={(v) => setSimulatorConfig({ licenseCountBusiness: v })}
          />
          <NumberField
            label="Copilot Enterprise ($39/mo)"
            value={simulatorConfig.licenseCountEnterprise}
            onChange={(v) => setSimulatorConfig({ licenseCountEnterprise: v })}
          />
          <NumberField
            label="Copilot Cloud Agent ($39/mo)"
            value={simulatorConfig.licenseCountCloudAgent}
            onChange={(v) => setSimulatorConfig({ licenseCountCloudAgent: v })}
          />
          <NumberField
            label="Copilot Spark"
            value={simulatorConfig.licenseCountSpark}
            onChange={(v) => setSimulatorConfig({ licenseCountSpark: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Billing Cycle Start Date
            </span>
            <input
              type="date"
              value={simulatorConfig.billingCycleStartDate}
              onChange={(e) => setSimulatorConfig({ billingCycleStartDate: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </label>
          <NumberField
            label="Current Day of Cycle"
            value={simulatorConfig.currentDayOfCycle}
            onChange={(v) => setSimulatorConfig({ currentDayOfCycle: v })}
            min={1}
          />
        </div>
        <NumberField
          label="Credits Consumed So Far"
          value={simulatorConfig.creditsConsumedSoFar ?? 0}
          onChange={(v) => setSimulatorConfig({ creditsConsumedSoFar: v })}
        />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Calculated Projections</h3>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total Included Pool" value={`${Math.round(pool).toLocaleString()} credits`} color="text-teal-400" />
          <Stat
            label="Daily Burn Rate"
            value={`${Math.round(burnRate).toLocaleString()} credits/day`}
            color="text-blue-500"
          />
          <Stat
            label="Projected Exhaustion Day"
            value={isFinite(exhaustionDay) ? `Day ${Math.round(exhaustionDay)}` : 'N/A'}
            color="text-amber-400"
          />
          <Stat label="Estimated Exhaustion Date" value={exhaustionDate} color="text-amber-400" />
          <Stat
            label="Projected Overage"
            value={`${Math.max(0, Math.round(projectedTotal - pool)).toLocaleString()} credits`}
            color="text-red-500"
          />
          <Stat
            label="Projected Overage Cost"
            value={`$${projectedOverageCost.toFixed(2)}`}
            color="text-red-500"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-md p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`font-numeric text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
