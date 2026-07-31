import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { FieldError, Path, UseFormRegister, useForm } from 'react-hook-form';
import { useAppStore } from '../../store/appStore';
import {
  calculateExhaustionDay,
  calculateIncludedPool,
  calculateOverageCost,
  calculateProjectedBurnRate,
} from '../../engine/creditCalculationEngine';
import { licensePoolFormSchema, LicensePoolFormValues } from '../../schemas/forms';

interface NumberFieldProps {
  label: string;
  name: Path<LicensePoolFormValues>;
  register: UseFormRegister<LicensePoolFormValues>;
  onBlur: () => void;
  error?: FieldError;
  min?: number;
}

function NumberField({ label, name, register, onBlur, error, min = 0 }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        {...register(name, {
          setValueAs: (value) => (value === '' ? 0 : Number(value)),
          onBlur,
        })}
        aria-invalid={Boolean(error)}
        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-numeric focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
      {error && <span className="text-xs text-red-400">{error.message}</span>}
    </label>
  );
}

export default function LicensePoolConfig({ onValidityChange }: { onValidityChange: (isValid: boolean) => void }) {
  const { simulatorConfig, setSimulatorConfig } = useAppStore();
  const {
    register,
    getValues,
    watch,
    formState: { errors },
  } = useForm<LicensePoolFormValues>({
    resolver: zodResolver(licensePoolFormSchema),
    mode: 'onChange',
    defaultValues: {
      enterpriseName: simulatorConfig.enterpriseName,
      licenseCountBusiness: simulatorConfig.licenseCountBusiness,
      licenseCountEnterprise: simulatorConfig.licenseCountEnterprise,
      licenseCountCloudAgent: simulatorConfig.licenseCountCloudAgent,
      licenseCountSpark: simulatorConfig.licenseCountSpark,
      billingCycleStartDate: simulatorConfig.billingCycleStartDate,
      currentDayOfCycle: simulatorConfig.currentDayOfCycle,
      creditsConsumedSoFar: simulatorConfig.creditsConsumedSoFar ?? 0,
    },
  });

  const commitValidValues = () => {
    const parsed = licensePoolFormSchema.safeParse(getValues());
    onValidityChange(parsed.success);
    if (parsed.success) {
      setSimulatorConfig(parsed.data);
    }
  };

  useEffect(() => {
    onValidityChange(licensePoolFormSchema.safeParse(getValues()).success);
    const subscription = watch((values) => {
      onValidityChange(licensePoolFormSchema.safeParse(values).success);
    });
    return () => subscription.unsubscribe();
  }, [getValues, onValidityChange, watch]);

  const pool = calculateIncludedPool(simulatorConfig);
  const burnRate = calculateProjectedBurnRate(simulatorConfig);
  const exhaustionDay = calculateExhaustionDay(pool, burnRate);
  const projectedTotal = burnRate * 30;
  const projectedOverageCost = calculateOverageCost(projectedTotal, pool);

  const exhaustionDate = (() => {
    const start = new Date(simulatorConfig.billingCycleStartDate);
    if (!isFinite(exhaustionDay) || isNaN(start.getTime())) return 'N/A';
    const date = new Date(start);
    date.setDate(date.getDate() + Math.round(exhaustionDay));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={(event) => event.preventDefault()} noValidate className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">License &amp; Pool Configuration</h3>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">Enterprise Name</span>
          <input
            type="text"
            {...register('enterpriseName', { onBlur: commitValidValues })}
            aria-invalid={Boolean(errors.enterpriseName)}
            className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          {errors.enterpriseName && <span className="text-xs text-red-400">{errors.enterpriseName.message}</span>}
        </label>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Copilot Business ($19/mo)" name="licenseCountBusiness" register={register} onBlur={commitValidValues} error={errors.licenseCountBusiness} />
          <NumberField label="Copilot Enterprise ($39/mo)" name="licenseCountEnterprise" register={register} onBlur={commitValidValues} error={errors.licenseCountEnterprise} />
          <NumberField label="Copilot Cloud Agent ($39/mo)" name="licenseCountCloudAgent" register={register} onBlur={commitValidValues} error={errors.licenseCountCloudAgent} />
          <NumberField label="Copilot Spark" name="licenseCountSpark" register={register} onBlur={commitValidValues} error={errors.licenseCountSpark} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Billing Cycle Start Date</span>
            <input
              type="date"
              {...register('billingCycleStartDate', { onBlur: commitValidValues })}
              aria-invalid={Boolean(errors.billingCycleStartDate)}
              className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {errors.billingCycleStartDate && <span className="text-xs text-red-400">{errors.billingCycleStartDate.message}</span>}
          </label>
          <NumberField label="Current Day of Cycle" name="currentDayOfCycle" register={register} onBlur={commitValidValues} error={errors.currentDayOfCycle} min={1} />
        </div>
        <NumberField label="Credits Consumed So Far" name="creditsConsumedSoFar" register={register} onBlur={commitValidValues} error={errors.creditsConsumedSoFar} />
      </form>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Calculated Projections</h3>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total Included Pool" value={`${Math.round(pool).toLocaleString()} credits`} color="text-teal-400" />
          <Stat label="Daily Burn Rate" value={`${Math.round(burnRate).toLocaleString()} credits/day`} color="text-blue-500" />
          <Stat label="Projected Exhaustion Day" value={isFinite(exhaustionDay) ? `Day ${Math.round(exhaustionDay)}` : 'N/A'} color="text-amber-400" />
          <Stat label="Estimated Exhaustion Date" value={exhaustionDate} color="text-amber-400" />
          <Stat label="Projected Overage" value={`${Math.max(0, Math.round(projectedTotal - pool)).toLocaleString()} credits`} color="text-red-500" />
          <Stat label="Projected Overage Cost" value={`$${projectedOverageCost.toFixed(2)}`} color="text-red-500" />
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
