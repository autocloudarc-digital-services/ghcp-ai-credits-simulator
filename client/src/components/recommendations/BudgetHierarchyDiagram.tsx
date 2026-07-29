import { ShieldCheck, Users, Building2 } from 'lucide-react';

export default function BudgetHierarchyDiagram() {
  const tiers = [
    {
      tier: 1,
      title: 'Enterprise Spending Limit',
      description: 'Hard cap on metered overage across the entire enterprise.',
      icon: ShieldCheck,
      color: 'border-red-500/50 text-red-400',
    },
    {
      tier: 2,
      title: 'Universal User-Level Budget (ULB)',
      description: 'Per-user cap applied enterprise-wide (recommended 5,000/user/month).',
      icon: Users,
      color: 'border-teal-400/50 text-teal-400',
    },
    {
      tier: 3,
      title: 'Cost Center ULB Overrides',
      description: 'Per-team/cost-center overrides for overage, abundant, and exponential users.',
      icon: Building2,
      color: 'border-blue-500/50 text-blue-400',
    },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">Three-Tier Governance Hierarchy</h3>
      <div className="space-y-4">
        {tiers.map((t, idx) => (
          <div key={t.tier} className="relative">
            <div className={`border rounded-lg p-4 flex items-start gap-3 ${t.color} bg-slate-900/50`}>
              <t.icon className="w-6 h-6 mt-1 shrink-0" />
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Tier {t.tier}</div>
                <div className="font-semibold text-slate-100">{t.title}</div>
                <div className="text-sm text-slate-400">{t.description}</div>
              </div>
            </div>
            {idx < tiers.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="w-0.5 h-4 bg-slate-600" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
