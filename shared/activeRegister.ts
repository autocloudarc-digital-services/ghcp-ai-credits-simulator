export type RegisterRecordType = 'policy-profile' | 'ULB' | 'entitlement-baseline' |
  'included-usage-control' | 'metered-budget' | 'license-baseline' |
  'rollout-wave' | 'controlled-test' | 'exception';
export type RegisterPhase = 'Prepare' | 'Baseline' | 'Design' | 'Approve' | 'Pilot' | 'Rollout' | 'Operate';
export type RegisterRole = 'reader' | 'editor' | 'approver';

export interface RegisterDocument {
  record_type: RegisterRecordType;
  scope_id: string;
  enterprise_control_id: string;
  owner_primary: string;
  phase: RegisterPhase;
  record_status: 'draft' | 'active' | 'paused' | 'retired' | 'closed';
  production_intended: boolean;
  [field: string]: unknown;
}

export interface RegisterRecord {
  id: string;
  tenant_id: string;
  revision: number;
  document: RegisterDocument;
  created_at: string;
  updated_at: string;
}

export interface RegisterRevision {
  record_id: string;
  revision: number;
  document: RegisterDocument;
  actor_id: string;
  recorded_at: string;
}