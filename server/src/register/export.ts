import { stringify } from 'csv-stringify/sync';
import type { ActiveRegisterDocument } from './schema';
import { registerClient, type RegisterAccess, type StoredRecord } from './store';

export interface RegisterExport {
  exported_at: string;
  records: StoredRecord[];
  revisions: { record_id: string; revision: number; actor_id: string; recorded_at: string; document: ActiveRegisterDocument }[];
}

export async function exportRegister(access: RegisterAccess): Promise<RegisterExport> {
  const response = await registerClient(access).post<RegisterExport>('/rpc/export_register', {});
  return response.data;
}

export function registerCsv(snapshot: RegisterExport): string {
  const keyFields = ['record_type', 'scope_id', 'enterprise_control_id', 'policy_or_profile', 'profile_version'];
  const fields = [...new Set(snapshot.revisions.flatMap(revision => Object.keys(revision.document)))].filter(field => !keyFields.includes(field)).sort();
  const columns = ['exported_at', 'record_id', 'revision', 'actor_id', 'recorded_at', ...keyFields, ...fields];
  const rows = snapshot.revisions.map(revision => {
    const row: Record<string, unknown> = { ...revision, exported_at: snapshot.exported_at, ...revision.document, policy_or_profile: revision.document.policy_or_profile ?? 'not-applicable', profile_version: revision.document.profile_version ?? 0 };
    for (const field of fields) {
      const value = row[field];
      if (Array.isArray(value)) {
        row[field] = field === 'alert_thresholds' ? value.map(threshold => `${threshold.value}${threshold.unit}`).join(';')
          : value.every(item => typeof item === 'string') ? value.join(';') : JSON.stringify(value);
      }
    }
    return row;
  });
  return stringify(rows, { header: true, columns, escape_formulas: true });
}