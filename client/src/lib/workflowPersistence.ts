import axios from 'axios';
import { useAppStore } from '../store/appStore';

function snapshot() {
  const state = useAppStore.getState();
  return {
    allocationPlans: state.allocationPlans,
    simulatorConfig: state.simulatorConfig, simulatorResult: state.simulatorResult, scenarios: state.scenarios,
    assessmentId: state.assessmentId, recommendations: state.recommendations,
    hasConfirmedSimulation: state.hasConfirmedSimulation, hasReviewedDashboard: state.hasReviewedDashboard,
    hasReviewedRecommendations: state.hasReviewedRecommendations, use3DVisualizer: state.use3DVisualizer,
  };
}

let unsubscribe: (() => void) | undefined;
let generation = 0;
let revision = 0;
let saved = '';
let saving: Promise<void> | undefined;
let ready = false;

export function stopWorkflowPersistence() {
  generation += 1;
  ready = false;
  unsubscribe?.();
  unsubscribe = undefined;
  saving = undefined;
}

export async function flushWorkflow() {
  if (!ready) throw new Error('Saved workflow has not loaded.');
  if (saving) return saving;
  const current = generation;
  const operation = async () => {
    while (ready && current === generation && useAppStore.getState().isConnected) {
      const document = snapshot();
      const serialized = JSON.stringify(document);
      if (serialized === saved) break;
      useAppStore.setState({ persistenceStatus: 'saving', persistenceError: null });
      try {
        const response = await axios.put('/api/workflow', { expectedRevision: revision, document });
        if (current !== generation) return;
        revision = response.data.revision;
        saved = serialized;
      } catch (error) {
        if (current !== generation) return;
        useAppStore.setState({ persistenceStatus: 'error', persistenceError: axios.isAxiosError(error) && error.response?.status === 409
          ? 'Another tab changed this workflow. Reload saved data before making more changes.'
          : 'Workflow changes are not saved. Check the connection and retry before leaving.' });
        throw error;
      }
    }
    if (current === generation) useAppStore.setState({ persistenceStatus: 'saved', persistenceError: null });
  };
  saving = Promise.resolve().then(operation).finally(() => { if (current === generation) saving = undefined; });
  return saving;
}

export async function loadWorkflow() {
  stopWorkflowPersistence();
  const current = generation;
  useAppStore.setState({ persistenceStatus: 'loading', persistenceError: null });
  try {
    const response = await axios.get('/api/workflow');
    if (current !== generation) return;
    const { document, assessment, latestAssessment } = response.data;
    revision = response.data.revision;
    if (document) {
      if (document.simulatorResult?.projectedExhaustionDay === null) document.simulatorResult.projectedExhaustionDay = Infinity;
      for (const scenario of document.scenarios) if (scenario.result?.projectedExhaustionDay === null) scenario.result.projectedExhaustionDay = Infinity;
      useAppStore.setState({ ...document, allocationPlans: document.allocationPlans ?? {}, assessmentResult: assessment?.result ?? null });
    }
    else if (latestAssessment) useAppStore.getState().completeAssessment(latestAssessment.result, latestAssessment.input.enterpriseSlug, latestAssessment.id);
    saved = document ? JSON.stringify(snapshot()) : '';
    ready = true;
    unsubscribe = useAppStore.subscribe((state) => {
      if (state.isConnected && JSON.stringify(snapshot()) !== saved && state.persistenceStatus !== 'error') void flushWorkflow().catch(() => {});
    });
    await flushWorkflow();
  } catch (error) {
    if (current === generation && useAppStore.getState().persistenceStatus !== 'error') useAppStore.setState({ persistenceStatus: 'error', persistenceError: 'Saved workflow could not be loaded. Reload before editing.' });
    throw error;
  }
}

window.addEventListener('beforeunload', event => {
  const state = useAppStore.getState();
  if (state.isConnected && ['saving', 'error'].includes(state.persistenceStatus)) { event.preventDefault(); event.returnValue = ''; }
});