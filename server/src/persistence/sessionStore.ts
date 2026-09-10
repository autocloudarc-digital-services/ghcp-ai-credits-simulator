import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Store, type SessionData } from 'express-session';
import { persistenceClient } from './client';

type EncryptedSession = { iv: string; tag: string; ciphertext: string };
type Callback = (error?: unknown) => void;

export class PostgresSessionStore extends Store {
  private readonly key: Buffer;

  constructor(secret: string) {
    super();
    if (secret.length < 32 || secret === 'insecure-development-secret-change-me') throw new Error('A stable SESSION_SECRET of at least 32 characters is required for persistent sessions.');
    this.key = createHash('sha256').update(`application-session:${secret}`).digest();
  }

  private identity(sid: string) { return createHash('sha256').update(sid).digest('hex'); }
  private expires(session: SessionData) { return session.cookie.expires ? new Date(session.cookie.expires).toISOString() : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); }

  get(sid: string, callback: (error: unknown, session?: SessionData | null) => void) {
    const id = this.identity(sid);
    void persistenceClient('application_sessions', id).get('/application_sessions', { params: { id: `eq.${id}`, expires_at: `gt.${new Date().toISOString()}`, limit: 1 } }).then(response => {
      const payload: EncryptedSession | undefined = response.data[0]?.payload;
      if (!payload) { callback(null, null); return; }
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(payload.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
      const json = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'hex')), decipher.final()]).toString('utf8');
      callback(null, JSON.parse(json));
    }).catch(() => callback(new Error('Unable to load the encrypted login session.')));
  }

  set(sid: string, session: SessionData, callback: Callback = () => {}) {
    const id = this.identity(sid);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
    const payload: EncryptedSession = { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('hex') };
    void persistenceClient('application_sessions', id).post('/application_sessions', { id, payload, expires_at: this.expires(session) }, { headers: { Prefer: 'resolution=merge-duplicates' } }).then(() => callback()).catch(callback);
  }

  touch(sid: string, session: SessionData, callback: Callback = () => {}) {
    const id = this.identity(sid);
    void persistenceClient('application_sessions', id).patch('/application_sessions', { expires_at: this.expires(session) }, { params: { id: `eq.${id}` } }).then(() => callback()).catch(callback);
  }

  destroy(sid: string, callback: Callback = () => {}) {
    const id = this.identity(sid);
    void persistenceClient('application_sessions', id).delete('/application_sessions', { params: { id: `eq.${id}` } }).then(() => callback()).catch(callback);
  }

  async prune() { await persistenceClient('application_sessions', 'session-maintenance').post('/rpc/prune_application_sessions'); }
}