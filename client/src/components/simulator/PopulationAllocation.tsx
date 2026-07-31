import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useAppStore } from '../../store/appStore';
import { calculateGovernanceImpact } from '../../engine/creditCalculationEngine';
import {
  createPopulationAllocationFormSchema,
  populationAllocationSchema,
} from '../../schemas/forms';
import BurnDownChart from './BurnDownChart';

const TIERS: { key: 'universalUlb' | 'overageUsers' | 'abundantUsers' | 'exponentialUsers'; label: string; color: string; creditsPerUser: number }[] = [
  { key: 'universalUlb', label: 'Universal ULB Population', color: 'bg-teal-400', creditsPerUser: 5000 },
  { key: 'overageUsers', label: 'Overage Users', color: 'bg-amber-400', creditsPerUser: 6000 },
  { key: 'abundantUsers', label: 'Abundant Users', color: 'bg-blue-500', creditsPerUser: 7000 },
  { key: 'exponentialUsers', label: 'Exponential Users', color: 'bg-red-500', creditsPerUser: 8000 },
];

export default function PopulationAllocation({ onValidityChange }: { onValidityChange: (isValid: boolean) => void }) {
  const { simulatorConfig, setSimulatorConfig } = useAppStore();

  const totalUsers =
    simulatorConfig.licenseCountBusiness +
    simulatorConfig.licenseCountEnterprise +
    simulatorConfig.licenseCountCloudAgent +
    simulatorConfig.licenseCountSpark;

  const allocationFormSchema = useMemo(
    () => createPopulationAllocationFormSchema(totalUsers),
    [totalUsers]
  );
  const {
    register,
    getValues,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(allocationFormSchema),
    mode: 'onChange',
    defaultValues: simulatorConfig.populationAllocation,
  });
  const allocation = watch();
  const allocatedTotal =
    allocation.universalUlb + allocation.overageUsers + allocation.abundantUsers + allocation.exponentialUsers;

  useEffect(() => {
    onValidityChange(allocationFormSchema.safeParse(getValues()).success);
    const subscription = watch((values) => {
      onValidityChange(allocationFormSchema.safeParse(values).success);
      const parsed = populationAllocationSchema.safeParse(values);
      if (parsed.success) {
        setSimulatorConfig({ populationAllocation: parsed.data });
      }
    });
    return () => subscription.unsubscribe();
  }, [allocationFormSchema, getValues, onValidityChange, setSimulatorConfig, watch]);

  const governanceImpact = useMemo(
    () => calculateGovernanceImpact(simulatorConfig),
    [simulatorConfig]
  );

  return (
    <div className="space-y-6">
      <form onSubmit={(event) => event.preventDefault()} noValidate className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Developer Population Allocation</h3>
          <span
            className={`font-numeric text-sm ${
              allocatedTotal === totalUsers ? 'text-teal-400' : 'text-amber-400'
            }`}
          >
            {allocatedTotal.toLocaleString()} / {totalUsers.toLocaleString()} users allocated
          </span>
        </div>
        {errors.universalUlb?.message && (
          <p className="text-xs text-amber-400">
            {errors.universalUlb.message}
          </p>
        )}
        <div className="space-y-5">
          {TIERS.map((tier) => (
            <div key={tier.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{tier.label}</span>
                <span className="font-numeric text-slate-100">{allocation[tier.key].toLocaleString()} users</span>
              </div>
              <input
                type="range"
                min={0}
                max={totalUsers}
                {...register(tier.key, { valueAsNumber: true })}
                aria-invalid={Boolean(errors[tier.key])}
                className={`w-full accent-teal-400`}
              />
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className={`h-full ${tier.color}`}
                  style={{ width: `${totalUsers > 0 ? (allocation[tier.key] / totalUsers) * 100 : 0}%` }}
                />
              </div>
              <div className="text-xs text-slate-500">
                Projected consumption: {(allocation[tier.key] * tier.creditsPerUser).toLocaleString()} credits/month
              </div>
            </div>
          ))}
        </div>
      </form>

      <BurnDownChart
        withGovernance={governanceImpact.withGovernance}
        withoutGovernance={governanceImpact.withoutGovernance}
      />
    </div>
  );
}
