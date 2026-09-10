import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';

export const phases = ['Prepare', 'Baseline', 'Design', 'Approve', 'Pilot', 'Rollout', 'Operate'] as const;
export const testIds = ['P-01', 'P-01a', 'P-02', 'P-03', 'P-04', 'P-05'] as const;
const text = z.string().trim().min(1).max(4000);
const optionalText = text.nullish();
const timestamp = z.string().datetime({ offset: true });
const optionalTimestamp = timestamp.nullish();
const amount = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const strings = z.array(text).max(100);
const evidence = z.object({
  evidence_link: text,
  source_url: z.string().url().refine(value => /^https?:\/\//.test(value)),
  retrieval_timestamp: timestamp,
  valid_until: optionalTimestamp,
  observation: z.enum(['observed', 'calculated', 'forecast', 'unknown']),
  limitations: optionalText,
}).strict();
const controlledTest = z.object({
  test_id: z.enum(testIds),
  test_result: z.enum(['pass', 'fail', 'blocked', 'not-run']),
  tested_at: optionalTimestamp,
  evidence_link: optionalText,
  bounded_population: optionalText,
  decision_owner: optionalText,
}).strict();
const base = z.object({
  record_type: text,
  scope_id: text,
  enterprise_control_id: text,
  provider_control_id: optionalText,
  owner_primary: text,
  owner_delegate: optionalText,
  support_contact: optionalText,
  approving_owner: optionalText,
  operating_owner: optionalText,
  rollback_owner: optionalText,
  escalation: optionalText,
  next_review: optionalTimestamp,
  phase: z.enum(phases),
  record_status: z.enum(['draft', 'active', 'paused', 'retired', 'closed']),
  production_intended: z.boolean(),
  policy_or_profile: optionalText,
  profile_version: z.number().int().positive().nullish(),
  assignment_target: optionalText,
  evidence: z.array(evidence).max(100).default([]),
  tests: z.array(controlledTest).max(100).default([]),
  approval_id: optionalText,
  approval_outcome: z.enum(['approve', 'reject', 'return']).nullish(),
  approval_evidence: optionalText,
  approved_at: optionalTimestamp,
  effective_start: optionalTimestamp,
  effective_end: optionalTimestamp,
  rollback_reference: optionalText,
  billing_cycle_start: optionalTimestamp,
  billing_cycle_end: optionalTimestamp,
  observed_next_reset: optionalTimestamp,
  timezone_source: optionalText,
  review_decision: z.enum(['retain', 'revise', 'rollback']).nullish(),
  review_evidence: optionalText,
  review_owner: optionalText,
  reviewed_at: optionalTimestamp,
  monitoring_notes: optionalText,
  notes: z.string().max(10000).nullish(),
});
const variants = [
  base.extend({ record_type: z.literal('policy-profile'), policy_or_profile: text, profile_version: z.number().int().positive() }).strict(),
  base.extend({ record_type: z.literal('ULB'), ulb_type: z.enum(['universal', 'cost-center', 'individual']).nullish(), ulb_amount_ai_credits: amount.int().nullish(), membership_evidence: optionalText, reset_evidence: optionalText }).strict(),
  base.extend({ record_type: z.literal('entitlement-baseline'), entitlement_basis: optionalText, included_credits_amount: amount.nullish(), baseline_purpose: z.enum(['forecast-only', 'reconciliation-only', 'both']).nullish() }).strict(),
  base.extend({ record_type: z.literal('included-usage-control'), provider_cap_ai_credits: amount.nullish(), assigned_license_evidence: optionalText, observed_cap_behavior: optionalText, downstream_metered_budget_reference: optionalText }).strict(),
  base.extend({ record_type: z.literal('metered-budget'), budget_amount_currency: amount.nullish(), currency: z.literal('USD').nullish(), covered_ai_credit_sku: strings.nullish(), alert_thresholds: z.array(z.object({ value: amount, unit: z.enum(['%', 'USD']), provider_evidence: text }).strict()).max(30).nullish(), alert_recipients: strings.nullish(), response_sla: optionalText, stop_usage_state: z.enum(['enabled', 'disabled', 'unavailable', 'not-verified']).nullish() }).strict(),
  base.extend({ record_type: z.literal('license-baseline'), license_baseline_amount: amount.nullish(), license_baseline_currency: z.string().refine(value => Intl.supportedValuesOf('currency').includes(value), 'Use a recognized ISO currency code.').nullish(), covered_license_sku: strings.nullish(), eligible_count: amount.int().nullish(), forecast_period: optionalText, variance_owner: optionalText }).strict(),
  base.extend({ record_type: z.literal('rollout-wave'), population: optionalText, configured_state: optionalText, effective_state: optionalText, verification_evidence: optionalText, decision_owner: optionalText }).strict(),
  base.extend({ record_type: z.literal('controlled-test'), population: optionalText, configured_state: optionalText, effective_state: optionalText, decision_owner: optionalText }).strict(),
  base.extend({ record_type: z.literal('exception'), exception_id: optionalText, exception_expiry: optionalTimestamp, affected_control: optionalText, reason: optionalText, exception_approver: optionalText, compensating_control: optionalText }).strict(),
] as const;
export const documentSchema = z.discriminatedUnion('record_type', variants).superRefine((document, context) => {
  const phaseIndex = phases.indexOf(document.phase);
  const issue = (field: string, message: string) => context.addIssue({ code: 'custom', path: [field], message });
  const requireFields = (fields: string[]) => {
    const values = document as Record<string, unknown>;
    for (const field of fields) if (values[field] == null || values[field] === '' || (Array.isArray(values[field]) && !(values[field] as unknown[]).length)) issue(field, 'Required at this lifecycle phase.');
  };
  if (Boolean(document.policy_or_profile) !== Boolean(document.profile_version)) issue('profile_version', 'Named patterns require both name and version.');
  if (document.record_status === 'active' && phaseIndex < 3) issue('record_status', 'Active records must reach Approve first.');
  for (const field of ['approved_at', 'reviewed_at'] as const) {
    if (document[field] && Date.parse(document[field]) > Date.now()) issue(field, 'Recorded decision time cannot be in the future.');
  }
  if (phaseIndex >= 1 && !document.evidence.length) issue('evidence', 'Baseline requires timestamped source evidence.');
  for (const entry of document.evidence) {
    if (Date.parse(entry.retrieval_timestamp) > Date.now()) issue('evidence', 'Retrieval timestamp cannot be in the future.');
    if (entry.observation === 'unknown' && !entry.limitations) issue('evidence', 'Unknown observations require limitations.');
    if (entry.valid_until && Date.parse(entry.valid_until) <= Date.parse(entry.retrieval_timestamp)) issue('evidence', 'Evidence expiry must follow retrieval.');
  }
  for (const test of document.tests) {
    if (test.test_result === 'pass' && (!test.tested_at || !test.evidence_link || !test.bounded_population || !test.decision_owner)) issue('tests', 'Passing tests require time, evidence, bounded population, and decision owner.');
    if (test.tested_at && Date.parse(test.tested_at) > Date.now()) issue('tests', 'Test time cannot be in the future.');
  }
  if (new Set(document.tests.map(test => test.test_id)).size !== document.tests.length) issue('tests', 'Test IDs must be unique in a revision.');
  if (phaseIndex >= 3 && document.production_intended) {
    requireFields(['owner_delegate', 'support_contact', 'approving_owner', 'operating_owner', 'rollback_owner', 'escalation', 'next_review', 'approval_id', 'approval_outcome', 'approval_evidence', 'approved_at', 'effective_start', 'effective_end', 'rollback_reference']);
    if (document.approval_outcome !== 'approve') issue('approval_outcome', 'Production progression requires approve.');
  }
  for (const [start, end] of [['billing_cycle_start', 'billing_cycle_end'], ['effective_start', 'effective_end']] as const) {
    if (document[start] && document[end] && Date.parse(document[start]) >= Date.parse(document[end])) issue(end, 'End must follow start.');
  }
  if (document.review_decision) requireFields(['review_evidence', 'review_owner', 'reviewed_at']);
  if (document.review_decision === 'rollback') requireFields(['rollback_reference']);
  if (document.observed_next_reset) requireFields(['timezone_source']);
  if (phaseIndex >= 2) {
    if (document.record_type === 'ULB') {
      requireFields(['ulb_type', 'ulb_amount_ai_credits', 'reset_evidence']);
      if (document.ulb_type === 'cost-center') requireFields(['membership_evidence']);
    }
    if (document.record_type === 'entitlement-baseline') requireFields(['entitlement_basis', 'baseline_purpose', 'billing_cycle_start', 'billing_cycle_end', 'timezone_source']);
    if (document.record_type === 'included-usage-control') requireFields(['assigned_license_evidence', 'observed_cap_behavior']);
    if (document.record_type === 'metered-budget') requireFields(['budget_amount_currency', 'currency', 'covered_ai_credit_sku', 'stop_usage_state']);
    if (document.record_type === 'license-baseline') requireFields(['license_baseline_amount', 'license_baseline_currency', 'covered_license_sku', 'eligible_count', 'forecast_period', 'variance_owner']);
    if (document.record_type === 'rollout-wave' || document.record_type === 'controlled-test') requireFields(['population', 'configured_state', 'decision_owner']);
    if (document.record_type === 'exception') requireFields(['exception_id', 'exception_expiry', 'affected_control', 'reason', 'exception_approver', 'compensating_control', 'next_review']);
  }
  if (document.record_type === 'metered-budget') {
    const thresholds = document.alert_thresholds ?? [];
    if (thresholds.length) requireFields(['alert_recipients', 'response_sla']);
    thresholds.forEach((threshold, index) => {
      if (threshold.unit === '%' && threshold.value > 100) issue('alert_thresholds', 'Percent threshold exceeds 100.');
      if (index && (threshold.unit !== thresholds[0].unit || threshold.value <= thresholds[index - 1].value)) issue('alert_thresholds', 'Thresholds require the same units and strictly increasing values.');
    });
    if (document.stop_usage_state === 'enabled') {
      if (!document.evidence.some(entry => entry.observation === 'observed' && entry.valid_until && Date.parse(entry.valid_until) > Date.now()) || !document.tests.some(test => test.test_id === 'P-04' && test.test_result === 'pass')) issue('stop_usage_state', 'Enabled requires current observed evidence with valid_until and a passing P-04.');
    }
  }
  if (phaseIndex >= 4) {
    const requiredTests: Record<string, readonly string[]> = { ULB: ['P-01', 'P-03'], 'policy-profile': ['P-01a'], 'included-usage-control': ['P-02'], 'metered-budget': ['P-04'], 'controlled-test': testIds, 'rollout-wave': ['P-05'] };
    for (const testId of requiredTests[document.record_type] ?? []) {
      if (!document.tests.some(test => test.test_id === testId && (phaseIndex === 4 || test.test_result === 'pass'))) issue('tests', `${testId} ${phaseIndex === 4 ? 'must be recorded' : 'must pass before rollout'}.`);
    }
  }
  if (document.record_type === 'rollout-wave' && (document.record_status === 'closed' || document.phase === 'Operate')) {
    requireFields(['configured_state', 'effective_state', 'verification_evidence']);
    if (document.configured_state !== document.effective_state) issue('effective_state', 'Configured and effective states must match before closure.');
  }
  if (document.record_type === 'exception' && document.record_status === 'active') {
    requireFields(['exception_expiry']);
    if (document.exception_expiry && Date.parse(document.exception_expiry) <= Date.now()) issue('exception_expiry', 'Expired exceptions cannot be active.');
  }
});
export type ActiveRegisterDocument = z.infer<typeof documentSchema>;

export function validateTransition(previous: ActiveRegisterDocument, next: ActiveRegisterDocument): string[] {
  const errors: string[] = [];
  for (const field of ['record_type', 'scope_id', 'enterprise_control_id', 'policy_or_profile', 'profile_version'] as const) {
    if (previous[field] !== next[field]) errors.push(`${field} is immutable; create a new record for a new identity or named version.`);
  }
  const difference = phases.indexOf(next.phase) - phases.indexOf(previous.phase);
  if (difference < 0 || difference > 1) errors.push('Move forward by one phase; use a review decision for rollback.');
  if (difference > 0 && (previous.record_status === 'paused' || next.record_status === 'paused')) errors.push('Resume a paused record in its current phase before advancing.');
  if (phases.indexOf(previous.phase) >= 3) {
    const materialFields = ['assignment_target', 'production_intended', 'ulb_type', 'ulb_amount_ai_credits', 'budget_amount_currency', 'currency', 'covered_ai_credit_sku', 'alert_thresholds', 'stop_usage_state', 'population'];
    const before = previous as Record<string, unknown>;
    const after = next as Record<string, unknown>;
    if (materialFields.some(field => !isDeepStrictEqual(before[field], after[field]))) errors.push('Material changes to approved controls require a new record and approval.');
  }
  for (const entry of previous.evidence) {
    const replacement = next.evidence.find(candidate => candidate.evidence_link === entry.evidence_link);
    if (replacement && !isDeepStrictEqual(replacement, entry)) errors.push('Existing evidence links are immutable; add a new evidence reference for a restatement.');
  }
  if (phases.indexOf(previous.phase) >= 3 && previous.record_type === 'policy-profile') {
    const fields = ['assignment_target', 'production_intended', 'approval_id', 'approval_evidence', 'approving_owner', 'approved_at', 'effective_start', 'effective_end'] as const;
    if (fields.some(field => JSON.stringify(previous[field]) !== JSON.stringify(next[field]))) errors.push('Approved policy changes require a new version.');
  }
  return errors;
}

export function effectiveStatus(document: ActiveRegisterDocument, now = Date.now()): string {
  return document.record_type === 'exception' && document.exception_expiry && Date.parse(document.exception_expiry) <= now && document.record_status === 'active' ? 'expired' : document.record_status;
}