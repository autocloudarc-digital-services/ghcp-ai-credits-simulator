import { Router, type Request } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { documentSchema, effectiveStatus, validateTransition } from './schema';
import { resolveRegisterAccess } from './access';
import { exportRegister, registerCsv } from './export';
import { getRecord, listRecords, recordHistory, saveRecord, type RegisterAccess } from './store';

const saveBody = z.object({ document: documentSchema, expected_revision: z.number().int().nonnegative() }).strict();
const idSchema = z.string().uuid();
const approvalFields = ['approval_id', 'approval_outcome', 'approval_evidence', 'approved_at', 'approving_owner'] as const;

export function createRegisterRouter(resolveAccess: (req: Request) => Promise<RegisterAccess> = resolveRegisterAccess) {
  const router = Router();
  router.use(async (req, res, next) => {
    try {
      res.locals.registerAccess = await resolveAccess(req);
      res.setHeader('Cache-Control', 'no-store');
      next();
    } catch (error) { next(error); }
  });
  router.get('/', async (_req, res, next) => {
    try {
      const access = res.locals.registerAccess as RegisterAccess;
      const records = await listRecords(access);
      res.json({ access, records: records.map(record => ({ ...record, effective_status: effectiveStatus(record.document) })), truncated: records.length === 1000 });
    } catch (error) { next(error); }
  });
  router.get('/export', async (req, res, next) => {
    try {
      const format = z.enum(['json', 'csv']).parse(req.query.format ?? 'json');
      const snapshot = await exportRegister(res.locals.registerAccess as RegisterAccess);
      const stamp = new Date(snapshot.exported_at).toISOString().replace(/[:.]/g, '-');
      res.attachment(`active-register-${stamp}.${format}`);
      if (format === 'csv') res.type('text/csv').send(registerCsv(snapshot));
      else res.json(snapshot);
    } catch (error) { next(error); }
  });
  router.get('/:id/history', async (req, res, next) => {
    try {
      const id = idSchema.parse(req.params.id);
      const access = res.locals.registerAccess as RegisterAccess;
      if (!await getRecord(access, id)) { res.status(404).json({ message: 'Record not found.' }); return; }
      res.json({ revisions: await recordHistory(access, id) });
    } catch (error) { next(error); }
  });
  const save: import('express').RequestHandler = async (req, res, next) => {
    try {
      const access = res.locals.registerAccess as RegisterAccess;
      if (access.role === 'reader') { res.status(403).json({ message: 'Editor or approver role required.' }); return; }
      const { document, expected_revision } = saveBody.parse(req.body);
      const id = req.params.id ? idSchema.parse(req.params.id) : null;
      const previous = id ? await getRecord(access, id) : null;
      if (id && !previous) { res.status(404).json({ message: 'Record not found.' }); return; }
      if (!id && (document.phase !== 'Prepare' || expected_revision !== 0)) { res.status(422).json({ message: 'Create records in Prepare with revision zero.' }); return; }
      if (access.role !== 'approver' && (approvalFields.some(field => document[field] !== previous?.document[field]) || document.phase === 'Approve' || (document.production_intended && ['Pilot', 'Rollout', 'Operate'].includes(document.phase)))) {
        res.status(403).json({ message: 'Approver role required for approval or approved production changes.' }); return;
      }
      if (previous) {
        const errors = validateTransition(previous.document, document);
        if (errors.length) { res.status(422).json({ message: errors.join(' ') }); return; }
      }
      const saved = await saveRecord(access, document, expected_revision, id);
      res.status(id ? 200 : 201).json(saved);
    } catch (error) { next(error); }
  };
  router.post('/', save);
  router.put('/:id', save);
  router.use((error: unknown, _req: Request, res: import('express').Response, _next: import('express').NextFunction) => {
    if (error instanceof z.ZodError) { res.status(422).json({ message: 'Register validation failed.', issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }); return; }
    if (axios.isAxiosError(error)) {
      const code = error.response?.data?.code;
      const messages: Record<string, [number, string]> = {
        PT409: [409, 'Revision conflict. Reload before saving.'],
        '40001': [409, 'Revision conflict. Reload before saving.'],
        '23505': [409, 'A record with this canonical identity already exists.'],
        '42501': [403, 'Register operation is not authorized.'],
        P0002: [404, 'Record not found.'],
        '22023': [422, 'Invalid register transition or identity.'],
      };
      const [status, message] = messages[code] ?? [503, 'Active Register storage is unavailable.'];
      res.status(status).json({ message }); return;
    }
    const known = error as { status?: number; message?: string };
    res.status(known.status ?? 500).json({ message: known.status ? known.message : 'Active Register request failed.' });
  });
  return router;
}

export default createRegisterRouter();