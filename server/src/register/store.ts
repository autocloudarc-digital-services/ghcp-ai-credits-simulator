import axios from 'axios';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import jwt from 'jsonwebtoken';
import type { ActiveRegisterDocument } from './schema';

export interface RegisterAccess {
  actor: string;
  tenant: string;
  role: 'reader' | 'editor' | 'approver';
}
export interface StoredRecord {
  id: string;
  tenant_id: string;
  revision: number;
  document: ActiveRegisterDocument;
  created_at: string;
  updated_at: string;
}

export function registerSettings() {
  const localFile = path.resolve(__dirname, '../../../.local/register.env');
  const local = process.env.NODE_ENV !== 'production' && existsSync(localFile) ? parseEnv(readFileSync(localFile, 'utf8')) : {};
  const secret = process.env.REGISTER_JWT_SECRET ?? local.REGISTER_JWT_SECRET;
  const url = process.env.REGISTER_GATEWAY_URL ?? `http://127.0.0.1:${local.REGISTER_GATEWAY_PORT ?? '3302'}`;
  if (!secret || secret.length < 32) throw Object.assign(new Error('Active Register storage is not configured.'), { status: 503 });
  return { secret, url };
}

export function registerClient(access: RegisterAccess) {
  const { secret, url } = registerSettings();
  const token = jwt.sign({ role: 'register_api', tenant: access.tenant, access: access.role }, secret, {
    algorithm: 'HS256', subject: access.actor, expiresIn: 60,
  });
  return axios.create({ baseURL: url, timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
}

export async function listRecords(access: RegisterAccess) {
  const response = await registerClient(access).get<StoredRecord[]>('/records', { params: { order: 'updated_at.desc,id.asc', limit: 1000 } });
  return response.data;
}

export async function getRecord(access: RegisterAccess, id: string) {
  const response = await registerClient(access).get<StoredRecord[]>('/records', { params: { id: `eq.${id}`, limit: 1 } });
  return response.data[0] ?? null;
}

export async function saveRecord(access: RegisterAccess, document: ActiveRegisterDocument, revision: number, id: string | null) {
  const response = await registerClient(access).post<StoredRecord>('/rpc/save_record', { candidate: document, expected_revision: revision, record_id: id });
  return response.data;
}

export async function recordHistory(access: RegisterAccess, id: string) {
  const response = await registerClient(access).get('/revisions', { params: { record_id: `eq.${id}`, order: 'revision.desc', limit: 1000 } });
  return response.data;
}