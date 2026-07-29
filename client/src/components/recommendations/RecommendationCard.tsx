import { CheckCircle2 } from 'lucide-react';
import { Recommendation } from '../../types';

const PRIORITY_STYLES: Record<Recommendation['priority'], string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  high: 'bg-amber-400/20 text-amber-400 border-amber-400/40',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

const TIER_LABELS: Record<Recommendation['tier'], string> = {
  1: 'Tier 1 · Enterprise Spending Limit',
  2: 'Tier 2 · Universal ULB',
  3: 'Tier 3 · Cost Center Override',
};

export default function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span
          className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded border ${
            PRIORITY_STYLES[recommendation.priority]
          }`}
        >
          {recommendation.priority}
        </span>
        <span className="text-xs text-slate-400">{TIER_LABELS[recommendation.tier]}</span>
      </div>

      <h4 className="text-lg font-semibold text-slate-100">{recommendation.budgetClass.name}</h4>
      <p className="text-sm text-slate-300">{recommendation.rationale}</p>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Recommended value:</span>
        <span className="font-numeric text-teal-400 font-semibold">
          {recommendation.configuredValue.toLocaleString()}
        </span>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-slate-400">Implementation Steps</span>
        <ul className="mt-2 space-y-1.5">
          {recommendation.implementationSteps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
