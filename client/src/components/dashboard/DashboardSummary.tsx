import { TrendingUp, Users, Wallet, AlertTriangle } from 'lucide-react';
import { SimulatorResult } from '../../types';

interface DashboardSummaryProps {
  result: SimulatorResult | null;
  totalUsers: number;
}

function formatCredits(value: number): string {
  if (!isFinite(value)) return '—';
  return Math.round(value).toLocaleString();
}

export default function DashboardSummary({ result, totalUsers }: DashboardSummaryProps) {
  const overageRiskLevel = !result
    ? 'Unknown'
    : result.projectedExhaustionDay < 20
    ? 'Critical'
    : result.projectedExhaustionDay < 28
    ? 'Elevated'
    : 'Low';

  const riskColor =
    overageRiskLevel === 'Critical'
      ? 'text-red-500'
      : overageRiskLevel === 'Elevated'
      ? 'text-amber-400'
      : overageRiskLevel === 'Low'
      ? 'text-green-400'
      : 'text-slate-400';

  const cards = [
    {
      label: 'Modeled Included Pool',
      value: result ? `${formatCredits(result.totalIncludedPool)} credits` : '—',
      icon: Wallet,
      color: 'text-teal-400',
    },
    {
      label: 'Projected Daily Burn',
      value: result ? `${formatCredits(result.projectedDailyBurnRate)} credits/day` : '—',
      icon: TrendingUp,
      color: 'text-blue-500',
    },
    {
      label: 'Projected Exhaustion Cycle Day',
      value: result && isFinite(result.projectedExhaustionDay)
        ? `Day ${Math.max(0, Math.ceil(result.projectedExhaustionDay))}`
        : result ? 'Not projected' : 'Unknown',
      icon: Users,
      color: 'text-amber-400',
    },
    {
      label: 'Modeled Overage Risk',
      value: overageRiskLevel,
      icon: AlertTriangle,
      color: riskColor,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-400">{card.label}</span>
            <card.icon className={`w-4 h-4 ${card.color}`} />
          </div>
          <span className={`font-numeric break-words text-xl font-semibold ${card.color}`}>{card.value}</span>
          {card.label === 'Modeled Included Pool' && (
            <span className="text-xs text-slate-500">{totalUsers.toLocaleString()} planned license seats</span>
          )}
        </div>
      ))}
    </div>
  );
}
