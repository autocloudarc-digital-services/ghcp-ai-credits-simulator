import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import axios from 'axios';
import { AssessmentResult, Recommendation, SimulatorConfig } from '../../types';
import { useAppStore } from '../../store/appStore';

const reportIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const { isConnected, assessmentId } = useAppStore();
  const [history, setHistory] = useState<Array<{ id: string; filename: string; created_at: string }>>([]);
  const [selectedReport, setSelectedReport] = useState('');
  const selectedSavedReport = history.find(item => item.id === selectedReport && item.id.length === 36 && reportIdPattern.test(item.id));
  const handleReportSelection = (id: string) => {
    if (id === '') {
      setSelectedReport('');
      setError(null);
      return;
    }
    const report = history.find(item => item.id === id && item.id.length === 36 && reportIdPattern.test(item.id));
    if (!report) {
      setSelectedReport('');
      setError('Invalid saved report selection. Please select a report from the history.');
      return;
    }
    setSelectedReport(report.id);
    setError(null);
  };
  const refreshHistory = async () => {
    try { setHistory((await axios.get('/api/report/history')).data); }
    catch { setError('Saved report history could not be loaded.'); }
  };
  useEffect(() => { if (isConnected) void refreshHistory(); else setHistory([]); }, [isConnected]);

  const handleDownload = async () => {
    if (!assessmentResult) return;

    setIsGenerating(true);
    setError(null);
    try {
      const response = await axios.post(
        '/api/report/generate',
        { simulatorConfig, assessmentResult, recommendations, assessmentId },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${simulatorConfig.enterpriseName.replace(/\s+/g, '-').toLowerCase()}-aic-governance-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      await refreshHistory();
    } catch {
      setError('Unable to generate the report. Please ensure the server is running and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex min-w-0 max-w-full flex-col items-start gap-2">
      <button
        onClick={handleDownload}
        disabled={isGenerating || !assessmentResult}
        className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-medium px-4 py-2 rounded-md transition-colors"
      >
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {isGenerating
          ? 'Generating report…'
          : assessmentResult
            ? 'Download Executive Report (PDF)'
            : 'Complete assessment to download PDF'}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
      {history.length > 0 && <div className="flex w-full min-w-0 items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400">Saved reports
          <select aria-label="Saved report" value={selectedSavedReport?.id ?? ''} onChange={event => handleReportSelection(event.target.value)} className="h-9 w-full min-w-0 max-w-sm rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100">
            <option value="">Select a report</option>
            {history.map(item => <option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleString()} / {item.filename}</option>)}
          </select>
        </label>
        {selectedSavedReport && <a href={`/api/report/download/${encodeURIComponent(selectedSavedReport.id)}`} title="Download saved report" aria-label="Download saved report" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700"><Download className="h-4 w-4" /></a>}
      </div>}
    </div>
  );
}
