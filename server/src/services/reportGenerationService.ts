import React from 'react';
import { AssessmentResult, Recommendation, SimulatorConfig } from '../types';
import { budgetProfileClasses } from '../data/budgetProfileClassesServer';
import governanceTiers from 'ghcp-ai-credits-simulator-shared/governanceTiers.json';
import { budgetControlLabel } from 'ghcp-ai-credits-simulator-shared/governanceControls';

export interface ReportInput {
  simulatorConfig: SimulatorConfig;
  assessmentResult: AssessmentResult | null;
  recommendations: Recommendation[];
}

async function loadPdfRenderer() {
  return import('@react-pdf/renderer');
}

function buildDocument(
  renderer: Awaited<ReturnType<typeof loadPdfRenderer>>,
  { simulatorConfig, assessmentResult, recommendations }: ReportInput
) {
  const { Document, Page, Text, View, StyleSheet } = renderer;
  const styles = StyleSheet.create({
    page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' },
    title: { fontSize: 20, marginBottom: 4, color: '#0f172a', fontFamily: 'Helvetica-Bold' },
    subtitle: { fontSize: 10, marginBottom: 16, color: '#475569' },
    sectionTitle: { fontSize: 13, marginTop: 16, marginBottom: 6, color: '#0d9488', fontFamily: 'Helvetica-Bold' },
    paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 6 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 3 },
    tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a', paddingVertical: 4 },
    colSmall: { width: '10%', fontSize: 9 },
    colMedium: { width: '30%', fontSize: 9 },
    colLarge: { width: '40%', fontSize: 9 },
    headerCell: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
    bullet: { fontSize: 10, marginBottom: 4 },
    footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
  });
  const totalUsers =
    simulatorConfig.licenseCountBusiness +
    simulatorConfig.licenseCountEnterprise +
    simulatorConfig.licenseCountCloudAgent +
    simulatorConfig.licenseCountSpark;

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, `${simulatorConfig.enterpriseName}: AI Credits Governance Report`),
      React.createElement(Text, { style: styles.subtitle }, `Generated ${generatedDate}`),

      React.createElement(Text, { style: styles.sectionTitle }, '1. Executive Summary'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `${simulatorConfig.enterpriseName} manages ${totalUsers.toLocaleString()} licensed GitHub Copilot seats. ` +
          `This report outlines the current AI credit consumption posture and documents six budget controls ` +
          `with ${recommendations.length} prioritized budget and organization policy actions.`
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '2. License Inventory'),
      React.createElement(
        View,
        null,
        React.createElement(
          View,
          { style: styles.tableHeaderRow },
          React.createElement(Text, { style: [styles.headerCell, styles.colMedium] }, 'SKU'),
          React.createElement(Text, { style: [styles.headerCell, styles.colSmall] }, 'Licenses'),
          React.createElement(Text, { style: [styles.headerCell, styles.colSmall] }, 'Credits/User')
        ),
        ...[
          ['Copilot Business', simulatorConfig.licenseCountBusiness, '1,900'],
          ['Copilot Enterprise', simulatorConfig.licenseCountEnterprise, '3,900'],
          ['Copilot Cloud Agent', simulatorConfig.licenseCountCloudAgent, '3,900'],
          ['Copilot Spark', simulatorConfig.licenseCountSpark, '500'],
        ].map(([label, count, rate]) =>
          React.createElement(
            View,
            { style: styles.tableRow, key: String(label) },
            React.createElement(Text, { style: styles.colMedium }, String(label)),
            React.createElement(Text, { style: styles.colSmall }, String(count)),
            React.createElement(Text, { style: styles.colSmall }, String(rate))
          )
        )
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '3. Current State Analysis'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        assessmentResult
          ? `Total credits consumed: ${assessmentResult.totalCreditsConsumed.toLocaleString()}. ` +
            `Concentration risk score: ${assessmentResult.concentrationRiskScore}/100.`
          : 'No live assessment data was available at the time this report was generated.'
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '4. Governance Architecture'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        governanceTiers.map(control => `${control.title}. ${control.description}`).join('\n\n') +
          '\n\nULBs are checked first, then included availability, then metered budgets. Metered budgets stop usage only with Stop usage enabled (off by default); paid usage policy must allow overage. Applicable overlapping budgets can still block usage. Included usage controls are separate, license-derived pool caps. These are documented rules, not verified tenant settings.'
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '5. Budget Profile Configuration Guide'),
      React.createElement(
        View,
        null,
        React.createElement(
          View,
          { style: styles.tableHeaderRow },
          React.createElement(Text, { style: [styles.headerCell, styles.colSmall] }, '#'),
          React.createElement(Text, { style: [styles.headerCell, styles.colLarge] }, 'Name'),
          React.createElement(Text, { style: [styles.headerCell, styles.colMedium] }, 'Scope'),
          React.createElement(Text, { style: [styles.headerCell, styles.colMedium] }, 'Type')
        ),
        ...budgetProfileClasses.map((b) =>
          React.createElement(
            View,
            { style: styles.tableRow, key: b.id },
            React.createElement(Text, { style: styles.colSmall }, String(b.id)),
            React.createElement(Text, { style: styles.colLarge }, b.name),
            React.createElement(Text, { style: styles.colMedium }, b.scope),
            React.createElement(Text, { style: styles.colMedium }, b.budgetType)
          )
        )
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '6. Cost Center Mapping'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'Cost centers aic-0011-ovr, aic-0012-abd, and aic-0013-exp map overage, abundant, and exponential ' +
          'user cohorts respectively to their corresponding ULB overrides (Classes 4-6). Organization-level ' +
          'cost centers (org-0001 through org-0009) map business units to Classes 7-10.'
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '7. Alerting Strategy'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'Metered budget alerts support 75%, 90%, and 100% thresholds for enterprise, cost center, and organization budgets. ' +
          'Assign accountable recipients. ULB alerts are not consistently available; use cost center or enterprise monitoring as well.'
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '8. Implementation Roadmap (30/60/90-day)'),
      React.createElement(Text, { style: styles.bullet }, '\u2022 Days 1-30: Establish the universal ULB and enterprise metered budget, with Stop usage and paid usage policy reviewed.'),
      React.createElement(Text, { style: styles.bullet }, '\u2022 Days 31-60: Configure cost center ULBs, individual ULB exceptions, and separate cost center metered budgets.'),
      React.createElement(Text, { style: styles.bullet }, '\u2022 Days 61-90: Review organization metered budgets, license attribution, cost center exclusions, alerts, and enforcement evidence.'),

      React.createElement(Text, { style: styles.sectionTitle }, '9. Recommendations Summary'),
      ...recommendations.map((rec, idx) =>
        React.createElement(
          Text,
          { style: styles.bullet, key: idx },
          `\u2022 [${rec.priority.toUpperCase()}] ${budgetControlLabel(rec.budgetClass)}: ${rec.budgetClass.name} — ${rec.rationale}`
        )
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '10. References'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'GitHub: Budgets for usage-based billing. https://docs.github.com/en/copilot/concepts/billing/budgets-for-usage-based-billing (checked September 11, 2026).'
      ),

      React.createElement(
        Text,
        { style: styles.footer, render: ({ pageNumber, totalPages }: any) => `Page ${pageNumber} of ${totalPages}` },
        ''
      )
    )
  );
}

/**
 * Generates the executive PDF report as a Buffer, ready to be streamed to
 * the client via the /api/report/download endpoint.
 */
export async function generateReportPdf(input: ReportInput): Promise<Buffer> {
  const renderer = await loadPdfRenderer();
  const document = buildDocument(renderer, input);
  return renderer.renderToBuffer(document as any);
}
