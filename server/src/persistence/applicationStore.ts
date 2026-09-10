import type { Session, SessionData } from 'express-session';
import type { AssessmentResult } from '../types';
import { persistenceClient } from './client';

export interface AssessmentJob {
  id: string;
  owner_id: string;
  status: 'pending' | 'complete' | 'failed';
  input: { enterpriseSlug: string; organizations: string[]; periodDays: number };
  result?: AssessmentResult | null;
  error?: string | null;
  created_at: string;
  lease_expires_at: string;
}

export function accountId(session: Session & Partial<SessionData>): string {
  const id = session.githubUserId;
  if (!id || !/^[1-9][0-9]{0,19}$/.test(id)) throw Object.assign(new Error('Reconnect GitHub to verify the account for saved data.'), { status: 401 });
  return id;
}

export async function createAssessment(owner: string, id: string, input: AssessmentJob['input']) {
  await persistenceClient('application_data', owner).post('/assessment_jobs', { id, owner_id: owner, status: 'pending', input });
}

export async function updateAssessment(owner: string, id: string, update: Partial<Pick<AssessmentJob, 'status' | 'result' | 'error'>>) {
  await persistenceClient('application_data', owner).patch('/assessment_jobs', { ...update, updated_at: new Date().toISOString(), lease_expires_at: new Date(Date.now() + 120000).toISOString() }, { params: { id: `eq.${id}`, status: 'eq.pending' } });
}

export async function getAssessment(owner: string, id: string): Promise<AssessmentJob | null> {
  const response = await persistenceClient('application_data', owner).get('/assessment_jobs', { params: { id: `eq.${id}`, limit: 1 } });
  const job: AssessmentJob | undefined = response.data[0];
  if (job?.status === 'pending' && Date.parse(job.lease_expires_at) <= Date.now()) {
    job.status = 'failed';
    job.error = 'Assessment was interrupted. Run it again with the required credentials.';
    await updateAssessment(owner, id, { status: job.status, error: job.error });
  }
  return job ?? null;
}

export async function latestAssessment(owner: string): Promise<AssessmentJob | null> {
  const response = await persistenceClient('application_data', owner).get('/assessment_jobs', { params: { status: 'eq.complete', order: 'created_at.desc,id.desc', limit: 1 } });
  return response.data[0] ?? null;
}

export async function listAssessments(owner: string) {
  return (await persistenceClient('application_data', owner).get('/assessment_jobs', { params: { select: 'id,status,input,error,created_at', order: 'created_at.desc,id.desc', limit: 100 } })).data;
}

export async function getWorkflow(owner: string) {
  return (await persistenceClient('application_data', owner).get('/workflows', { params: { limit: 1 } })).data[0] ?? null;
}

export async function saveWorkflow(owner: string, document: unknown, revision: number) {
  return (await persistenceClient('application_data', owner).post('/rpc/save_workflow', { candidate: document, expected_revision: revision })).data[0];
}

export async function saveReport(owner: string, id: string, filename: string, input: unknown, buffer: Buffer) {
  await persistenceClient('application_data', owner).post('/generated_reports', { id, owner_id: owner, filename, input, pdf_base64: buffer.toString('base64') });
}

export async function getReport(owner: string, id: string) {
  return (await persistenceClient('application_data', owner).get('/generated_reports', { params: { id: `eq.${id}`, limit: 1 } })).data[0] ?? null;
}

export async function listReports(owner: string) {
  return (await persistenceClient('application_data', owner).get('/generated_reports', { params: { select: 'id,filename,created_at', order: 'created_at.desc,id.desc', limit: 100 } })).data;
}