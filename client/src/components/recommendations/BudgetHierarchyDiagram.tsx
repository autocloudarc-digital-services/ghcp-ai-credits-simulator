import { Users, Wallet } from 'lucide-react';
import governanceTiers from 'ghcp-ai-credits-simulator-shared/governanceTiers.json';

export default function BudgetHierarchyDiagram() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">GitHub Budget Controls</h3>
      <div className="space-y-4">
        {governanceTiers.map(control => (
          <div key={control.id} className="border-b border-slate-700 pb-4 flex items-start gap-3">
            {control.group === 'User-level budgets' ? <Users className="w-5 h-5 shrink-0 text-teal-400" /> : <Wallet className="w-5 h-5 shrink-0 text-amber-400" />}
            <div>
              <div className="text-xs uppercase text-slate-400">{control.group}</div>
              <div className="font-semibold text-slate-100">{control.title}</div>
              <div className="text-sm text-slate-400">{control.description}</div>
            </div>
          </div>
        ))}
        <p className="text-sm text-slate-400">Metered budgets block only with Stop usage enabled (off by default). Paid usage policy must also allow overage. Documented behavior does not verify this tenant's configuration.</p>
        <a className="text-sm text-teal-400 underline" href="https://docs.github.com/en/copilot/concepts/billing/budgets-for-usage-based-billing" target="_blank" rel="noreferrer">GitHub budget documentation</a>
      </div>
    </div>
  );
}
