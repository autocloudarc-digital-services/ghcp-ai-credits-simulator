import { randomUUID } from 'crypto';
import { Router } from 'express';
import { generateReportPdf, ReportInput } from '../services/reportGenerationService';

const router = Router();

const generatedReports = new Map<string, Buffer>();

// POST /api/report/generate - generates a PDF executive report from the
// posted simulator/assessment/recommendation state and streams it back
// directly, while also caching it under a reportId for later re-download.
router.post('/generate', async (req, res) => {
  const input = req.body as ReportInput;

  if (!input?.simulatorConfig) {
    res.status(400).json({ message: 'simulatorConfig is required to generate a report.' });
    return;
  }

  try {
    const pdfBuffer = await generateReportPdf({
      simulatorConfig: input.simulatorConfig,
      assessmentResult: input.assessmentResult ?? null,
      recommendations: input.recommendations ?? [],
    });

    const reportId = randomUUID();
    generatedReports.set(reportId, pdfBuffer);

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
  const pdfBuffer = generatedReports.get(req.params.id);
  if (!pdfBuffer) {
    res.status(404).json({ message: 'Report not found. It may have expired; please regenerate it.' });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="aic-governance-report.pdf"');
  res.send(pdfBuffer);
});

export default router;
