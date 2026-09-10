import { Router } from 'express';
import { z } from 'zod';
import { accountId, getAssessment, getWorkflow, latestAssessment, saveWorkflow } from '../persistence/applicationStore';
import { containsCredentialField, workflowSchema } from '../persistence/workflowSchema';

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/', async (req, res, next) => {
  try {
    const owner = accountId(req.session);
    const workflow = await getWorkflow(owner);
    const latest = await latestAssessment(owner);
    const linked = workflow?.document.assessmentId ? await getAssessment(owner, workflow.document.assessmentId) : null;
    res.json({ revision: workflow?.revision ?? 0, document: workflow?.document ?? null, assessment: linked?.status === 'complete' ? linked : null, latestAssessment: latest });
  } catch (error) { next(error); }
});
router.put('/', async (req, res, next) => {
  const parsed = z.object({ expectedRevision: z.number().int().nonnegative(), document: workflowSchema }).strict().safeParse(req.body);
  if (!parsed.success || containsCredentialField(req.body)) { res.status(400).json({ message: 'Invalid saved workflow. Credentials cannot be saved in workflow data.' }); return; }
  try {
    const owner = accountId(req.session);
    if (parsed.data.document.assessmentId) {
      const assessment = await getAssessment(owner, parsed.data.document.assessmentId);
      if (assessment?.status !== 'complete') { res.status(400).json({ message: 'The selected assessment is not available to this account.' }); return; }
    }
    const saved = await saveWorkflow(owner, parsed.data.document, parsed.data.expectedRevision);
    res.json({ revision: saved.revision });
  } catch (error) { next(error); }
});
export default router;