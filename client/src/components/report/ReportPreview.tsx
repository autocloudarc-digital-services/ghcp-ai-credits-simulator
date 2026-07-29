import { budgetProfileClasses } from '../../data/budgetProfileClasses';
import { AssessmentResult, Recommendation, SimulatorConfig } from '../../types';

interface ReportPreviewProps {
  simulatorConfig: SimulatorConfig;
  assessmentResult: AssessmentResult | null;
  recommendations: Recommendation[];
  governanceScore: number;
}

const SECTIONS = [
  '1. Executive Summary',
  '2. License Inventory',
  '3. Current State Analysis',
  '4. Governance Architecture',
  '5. Budget Profile Configuration Guide',
  '6. Cost Center Mapping',
  '7. Alerting Strategy',
  '8. Implementation Roadmap (30/60/90-day)',
  '9. References',
];

export default function ReportPreview({
  simulatorConfig,
  assessmentResult,
  recommendations,
  governanceScore,
}: ReportPreviewProps) {
  const totalUsers =
    simulatorConfig.licenseCountBusiness +
    simulatorConfig.licenseCountEnterprise +
    simulatorConfig.licenseCountCloudAgent +
    simulatorConfig.licenseCountSpark;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-6">
      <header className="border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-semibold text-slate-100">
          {simulatorConfig.enterpriseName}: AI Credits Governance Report
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Generated {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </header>

      <nav className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-300">
        {SECTIONS.map((s) => (
          <div key={s} className="px-2 py-1 rounded bg-slate-900/50">
            {s}
          </div>
        ))}
      </nav>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">1. Executive Summary</h3>
        <p className="text-sm text-slate-300">
          {simulatorConfig.enterpriseName} manages {totalUsers.toLocaleString()} licensed GitHub Copilot
          seats. Current governance readiness is scored at {governanceScore}/100, with {recommendations.length}{' '}
          recommended actions across the three governance tiers to reduce unmanaged overage risk and align
          spend with organizational priorities.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">2. License Inventory</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="py-1">SKU</th>
              <th className="py-1">Licenses</th>
              <th className="py-1">Credits/User</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            <tr>
              <td className="py-1">Copilot Business</td>
              <td className="py-1 font-numeric">{simulatorConfig.licenseCountBusiness}</td>
              <td className="py-1 font-numeric">1,900</td>
            </tr>
            <tr>
              <td className="py-1">Copilot Enterprise</td>
              <td className="py-1 font-numeric">{simulatorConfig.licenseCountEnterprise}</td>
              <td className="py-1 font-numeric">3,900</td>
            </tr>
            <tr>
              <td className="py-1">Copilot Cloud Agent</td>
              <td className="py-1 font-numeric">{simulatorConfig.licenseCountCloudAgent}</td>
              <td className="py-1 font-numeric">3,900</td>
            </tr>
            <tr>
              <td className="py-1">Copilot Spark</td>
              <td className="py-1 font-numeric">{simulatorConfig.licenseCountSpark}</td>
              <td className="py-1 font-numeric">500</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">3. Current State Analysis</h3>
        {assessmentResult ? (
          <p className="text-sm text-slate-300">
            Total credits consumed: {assessmentResult.totalCreditsConsumed.toLocaleString()}. Concentration
            risk score: {assessmentResult.concentrationRiskScore}/100.
          </p>
        ) : (
          <p className="text-sm text-slate-500">No live assessment data available. Run an assessment to populate this section.</p>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">4. Governance Architecture</h3>
        <p className="text-sm text-slate-300">
          A three-tier governance model is recommended: Tier 1 Enterprise Spending Limit, Tier 2 Universal
          User-Level Budget, and Tier 3 Cost Center ULB Overrides.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">5. Budget Profile Configuration Guide</h3>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="py-1">#</th>
              <th className="py-1">Name</th>
              <th className="py-1">Scope</th>
              <th className="py-1">Type</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {budgetProfileClasses.map((b) => (
              <tr key={b.id} className="border-b border-slate-800">
                <td className="py-1 font-numeric">{b.id}</td>
                <td className="py-1">{b.name}</td>
                <td className="py-1 capitalize">{b.scope}</td>
                <td className="py-1">{b.budgetType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">6. Cost Center Mapping</h3>
        <p className="text-sm text-slate-300">
          Cost centers aic-0011-ovr, aic-0012-abd, and aic-0013-exp map overage, abundant, and exponential
          user tiers respectively to their corresponding ULB overrides.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">7. Alerting Strategy</h3>
        <p className="text-sm text-slate-300">
          Alerts should fire at 75% and 90% of each budget threshold, routed to enterprise and cost-center
          administrators respectively.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">8. Implementation Roadmap (30/60/90-day)</h3>
        <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
          <li>Days 1-30: Configure Tier 1 Enterprise Spending Limit and Tier 2 Universal ULB.</li>
          <li>Days 31-60: Establish cost centers and Tier 3 overrides for identified power users.</li>
          <li>Days 61-90: Tune alert thresholds, review consumption trends, and re-assess.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-teal-400 mb-2">9. References</h3>
        <p className="text-sm text-slate-500">
          GitHub Enterprise Billing API (2026-03-10), GitHub Copilot AI Credits documentation.
        </p>
      </section>
    </div>
  );
}
