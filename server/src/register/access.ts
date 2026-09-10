import axios from 'axios';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { z } from 'zod';
import { getTokenFromSession } from '../services/githubAuthService';
import type { RegisterAccess } from './store';

const roleMap = z.record(z.string().regex(/^\d+$/), z.object({
  tenant: z.string().trim().min(1).max(200),
  role: z.enum(['reader', 'editor', 'approver']),
}).strict());

function accessConfiguration(): string | undefined {
  if (process.env.REGISTER_ACCESS_JSON !== undefined) return process.env.REGISTER_ACCESS_JSON;
  if (process.env.NODE_ENV === 'production') return undefined;
  const localFile = path.resolve(__dirname, '../../../.local/register-access.json');
  return existsSync(localFile) ? readFileSync(localFile, 'utf8') : undefined;
}

export function configuredAccess(githubId: string, configuration = accessConfiguration()): RegisterAccess {
  if (!configuration) throw Object.assign(new Error('Active Register access is not configured by an operator.'), { status: 503 });
  let parsed: z.infer<typeof roleMap>;
  try {
    parsed = roleMap.parse(JSON.parse(configuration));
  } catch {
    throw Object.assign(new Error('Active Register access configuration is invalid.'), { status: 503 });
  }
  const entry = parsed[githubId];
  if (!entry) throw Object.assign(new Error('Your GitHub account has no Active Register role.'), { status: 403 });
  return { ...entry, actor: githubId };
}

export async function resolveRegisterAccess(req: Request): Promise<RegisterAccess> {
  const token = getTokenFromSession(req.session);
  if (!token) throw Object.assign(new Error('Connect GitHub to access the Active Register.'), { status: 401 });
  let githubId: number;
  try {
    const response = await axios.get('https://api.github.com/user', {
      timeout: 10000,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    githubId = response.data.id;
    if (!Number.isSafeInteger(githubId) || githubId <= 0) throw new Error('Invalid identity');
  } catch {
    throw Object.assign(new Error('Unable to verify your GitHub identity. Reconnect and retry.'), { status: 401 });
  }
  return configuredAccess(String(githubId));
}