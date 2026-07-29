import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import axios from 'axios';
import { AssessmentResult, Recommendation, SimulatorConfig } from '../../types';

interface ReportDownloadButtonProps {
  simulatorConfig: SimulatorConfig;
  assessmentResult: AssessmentResult | null;
  recommendations: Recommendation[];
}

export default function ReportDownloadButton({
  simulatorConfig,
  assessmentResult,
  recommendations,
}: ReportDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await axios.post(
        '/api/report/generate',
        { simulatorConfig, assessmentResult, recommendations },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${simulatorConfig.enterpriseName.replace(/\s+/g, '-').toLowerCase()}-aic-governance-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Unable to generate the report. Please ensure the server is running and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleDownload}
        disabled={isGenerating}
        className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-medium px-4 py-2 rounded-md transition-colors"
      >
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {isGenerating ? 'Generating report…' : 'Download Executive Report (PDF)'}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
