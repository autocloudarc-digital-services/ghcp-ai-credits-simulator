import { randomUUID } from 'crypto';
import { Router } from 'express';
import { generateReportPdf, ReportInput } from '../services/reportGenerationService';

const router = Router();

const generatedReports = new Map<string, { buffer: Buffer; ownerSessionId: string }>();

// POST /api/report/generate - generates a PDF executive report from the
// posted simulator/assessment/recommendation state and streams it back
// directly, while also caching it under a reportId for later re-download.
router.post('/generate', async (req, res) => {
  const input = req.body as ReportInput;

  if (!req.session.assessmentCompleted) {
    res.status(409).json({ message: 'Complete an assessment before generating a report.' });
    return;
  }

  if (!input?.simulatorConfig) {
    res.status(400).json({ message: 'simulatorConfig is required to generate a report.' });
    return;
  }

  if (!input.assessmentResult) {
    res.status(400).json({ message: 'assessmentResult is required to generate a report.' });
    return;
  }

  try {
    const pdfBuffer = await generateReportPdf({
      simulatorConfig: input.simulatorConfig,
      assessmentResult: input.assessmentResult ?? null,
      recommendations: input.recommendations ?? [],
    });

    const reportId = randomUUID();
    generatedReports.set(reportId, { buffer: pdfBuffer, ownerSessionId: req.sessionID });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Report-Id', reportId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${input.simulatorConfig.enterpriseName.replace(/\s+/g, '-').toLowerCase()}-aic-governance-report.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate the executive report.' });
  }
});

// GET /api/report/download/:id - re-download a previously generated report.
router.get('/download/:id', (req, res) => {
  const report = generatedReports.get(req.params.id);
  if (!report || report.ownerSessionId !== req.sessionID) {
    res.status(404).json({ message: 'Report not found. It may have expired; please regenerate it.' });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="aic-governance-report.pdf"');
  res.send(report.buffer);
});

export default router;
