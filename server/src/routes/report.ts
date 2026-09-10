import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { accountId, getAssessment, getReport, latestAssessment, listReports, saveReport } from '../persistence/applicationStore';
import { containsCredentialField, simulatorConfigSchema, recommendationsSchema } from '../persistence/workflowSchema';
import { generateReportPdf, ReportInput } from '../services/reportGenerationService';

const router = Router();

router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// POST /api/report/generate - generates a PDF executive report from the
// posted simulator/assessment/recommendation state and streams it back
// directly, while also caching it under a reportId for later re-download.
router.post('/generate', async (req, res, next) => {
  const input = req.body as ReportInput;

  if (!input?.simulatorConfig) {
    res.status(400).json({ message: 'simulatorConfig is required to generate a report.' });
    return;
  }

  if (!input.assessmentResult) {
    res.status(400).json({ message: 'assessmentResult is required to generate a report.' });
    return;
  }

  try {
    const validConfig = simulatorConfigSchema.safeParse(input.simulatorConfig);
    const validRecommendations = recommendationsSchema.safeParse(input.recommendations ?? []);
    if (!validConfig.success || !validRecommendations.success || containsCredentialField(input)) {
      res.status(400).json({ message: 'Invalid report inputs.' }); return;
    }
    const owner = accountId(req.session);
    const assessmentId = req.body.assessmentId;
    if (assessmentId != null && !z.string().uuid().safeParse(assessmentId).success) { res.status(400).json({ message: 'Invalid assessment reference.' }); return; }
    const assessment = assessmentId ? await getAssessment(owner, assessmentId) : await latestAssessment(owner);
    if (assessment?.status !== 'complete' || !assessment.result) {
      res.status(409).json({ message: 'Complete an assessment before generating a report.' });
      return;
    }
    const snapshot = {
      simulatorConfig: input.simulatorConfig,
      assessmentResult: assessment.result,
      recommendations: input.recommendations ?? [],
    };
    const pdfBuffer = await generateReportPdf(snapshot);

    const reportId = randomUUID();
    const filename = `${String(input.simulatorConfig.enterpriseName).replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100).toLowerCase()}-aic-governance-report.pdf`;
    await saveReport(owner, reportId, filename, { ...snapshot, assessmentId: assessment.id }, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Report-Id', reportId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(Object.assign(new Error('Failed to generate or save the executive report.'), { status: (err as { status?: number }).status ?? 500 }));
  }
});

router.get('/history', async (req, res, next) => {
  try { res.json(await listReports(accountId(req.session))); } catch (error) { next(error); }
});

// GET /api/report/download/:id - re-download a previously generated report.
router.get('/download/:id', async (req, res, next) => {
  try {
  const report = z.string().uuid().safeParse(req.params.id).success ? await getReport(accountId(req.session), req.params.id) : null;
  if (!report) {
    res.status(404).json({ message: 'Report not found.' });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="aic-governance-report.pdf"');
  res.send(Buffer.from(report.pdf_base64, 'base64'));
  } catch (error) { next(error); }
});

export default router;
