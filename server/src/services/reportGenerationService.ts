import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { AssessmentResult, Recommendation, SimulatorConfig } from '../types';
import { budgetProfileClasses } from '../data/budgetProfileClassesServer';

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

export interface ReportInput {
  simulatorConfig: SimulatorConfig;
  assessmentResult: AssessmentResult | null;
  recommendations: Recommendation[];
}

function buildDocument({ simulatorConfig, assessmentResult, recommendations }: ReportInput) {
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
          `This report outlines the current AI credit consumption posture and recommends a three-tier governance ` +
          `architecture comprising ${recommendations.length} prioritized actions.`
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
        'A three-tier governance model is recommended: Tier 1 Enterprise Spending Limit (hard cap on metered ' +
          'overage), Tier 2 Universal User-Level Budget (per-user cap across the enterprise), and Tier 3 Cost ' +
          'Center ULB Overrides (per-team refinements for overage, abundant, and exponential usage cohorts).'
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
        'All budgets should alert at 75% and 90% of their configured threshold. Tier 1 alerts route to ' +
          'enterprise administrators; Tier 3 alerts route to cost-center and team leads.'
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '8. Implementation Roadmap (30/60/90-day)'),
      React.createElement(Text, { style: styles.bullet }, '\u2022 Days 1-30: Configure Tier 1 Enterprise Spending Limit and Tier 2 Universal ULB.'),
      React.createElement(Text, { style: styles.bullet }, '\u2022 Days 31-60: Establish cost centers and Tier 3 overrides for identified power users.'),
      React.createElement(Text, { style: styles.bullet }, '\u2022 Days 61-90: Tune alert thresholds, review consumption trends, and re-assess.'),

      React.createElement(Text, { style: styles.sectionTitle }, '9. Recommendations Summary'),
      ...recommendations.map((rec, idx) =>
        React.createElement(
          Text,
          { style: styles.bullet, key: idx },
          `\u2022 [${rec.priority.toUpperCase()}] ${rec.budgetClass.name} — ${rec.rationale}`
        )
      ),

      React.createElement(Text, { style: styles.sectionTitle }, '10. References'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'GitHub Enterprise Billing API (2026-03-10), GitHub Copilot AI Credits and Usage-Based Billing documentation.'
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
  const document = buildDocument(input);
  return renderToBuffer(document as any);
}
