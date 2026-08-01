import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AssessmentConfig } from '../../types';
import {
  assessmentFormSchema,
  AssessmentFormValues,
} from '../../schemas/forms';

const API_VERSION = '2026-03-10';

interface ApiConfigFormProps {
  onSubmit: (config: AssessmentConfig) => void;
  isSubmitting: boolean;
  disabled?: boolean;
}

export default function ApiConfigForm({ onSubmit, isSubmitting, disabled = false }: ApiConfigFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: {
      enterpriseSlug: '',
      organizations: '',
      period: '30',
      customDays: 14,
    },
  });
  const period = watch('period');

  const submitAssessment = (values: AssessmentFormValues) => {
    onSubmit({
      enterpriseSlug: values.enterpriseSlug,
      organizations: values.organizations
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      sessionId: '',
      apiVersion: API_VERSION,
      periodDays: values.period === 'custom' ? values.customDays : Number(values.period),
    });
  };

  return (
    <form onSubmit={handleSubmit(submitAssessment)} noValidate className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
      <h3 className="text-lg font-semibold text-slate-100">Assessment Configuration</h3>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Enterprise slug</span>
        <input
          type="text"
          {...register('enterpriseSlug')}
          placeholder="autocloudarc"
          aria-invalid={Boolean(errors.enterpriseSlug)}
          className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {errors.enterpriseSlug && <span className="text-xs text-red-400">{errors.enterpriseSlug.message}</span>}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          Organizations (comma separated)
        </span>
        <input
          type="text"
          {...register('organizations')}
          placeholder="autocloudarc-digital-services, autocloudarc-space-fleet"
          aria-invalid={Boolean(errors.organizations)}
          className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {errors.organizations && <span className="text-xs text-red-400">{errors.organizations.message}</span>}
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Assessment Period</span>
        <div className="flex gap-2 flex-wrap">
          {(['7', '30', 'custom'] as const).map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => setValue('period', opt, { shouldValidate: true })}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                period === opt
                  ? 'bg-teal-500 border-teal-400 text-slate-900 font-medium'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-teal-400'
              }`}
            >
              {opt === '7' ? 'Last 7 days' : opt === '30' ? 'Last 30 days' : 'Custom'}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <input
            type="number"
            min={1}
            max={90}
            {...register('customDays', { valueAsNumber: true })}
            aria-invalid={Boolean(errors.customDays)}
            className="w-32 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-numeric focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        )}
        {errors.customDays && <span className="text-xs text-red-400">{errors.customDays.message}</span>}
      </div>

      <div className="text-xs text-slate-500">
        API Version: <span className="font-numeric text-slate-300">{API_VERSION}</span> (auto-set)
      </div>

      <button
        type="submit"
        disabled={isSubmitting || disabled}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-medium py-2 rounded-md transition-colors"
      >
        {isSubmitting ? 'Assessing…' : disabled ? 'Connect to Run Assessment' : 'Assess Now'}
      </button>
    </form>
  );
}
