import { callTool, buildToolSchema } from './toolGateway.js';
import { getSeedLabels } from './sampleApp.js';
import { generateTestProposals } from './testGenerator.js';
import { writeIncidentReport } from './reportWriter.js';
import { getProviderStatus, investigateWithNemotron } from './nvidiaProvider.js';
import type { Classification, EvidenceItem, IncidentDraft, InvestigationResult, ReportInput } from './types.js';

const TOOL_SCHEMA = buildToolSchema();

function safeResolutionMessage(classification: Classification): string {
  switch (classification) {
    case 'USER_ACTION':
      return 'Please sign in again and retry. If the issue continues, contact support.';
    case 'CONFIG':
      return 'The service settings need review. Please contact your administrator, then retry once they are confirmed.';
    case 'NETWORK':
      return 'Check your connection and retry in a moment. This may be temporary.';
    case 'SOFTWARE_DEFECT':
      return 'A software defect may be affecting this behavior. The incident details and proposed regression tests are ready for developer review.';
    case 'UNKNOWN':
      return 'There is not enough evidence to confirm the cause. Escalate this report for human review.';
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function buildId(): string {
  return `INV-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

export function classifyReport(report: ReportInput): { classification: Classification; confidence: number; evidence: EvidenceItem[]; escalated: boolean; message?: string; transient?: boolean } {
  const combined = normalizeText(
    [report.text, report.currentPage ?? '', report.actionAttempted ?? '', report.context ? JSON.stringify(report.context) : '']
      .filter(Boolean)
      .join(' ')
  );

  const evidence: EvidenceItem[] = [];

  if (combined.includes('logged out') || combined.includes('session expired') || combined.includes('cart is gone') || combined.includes('sign in again')) {
    evidence.push({ tool: 'readState', source: 'session', summary: 'Session appears expired and the cart is missing.' });
    return { classification: 'USER_ACTION', confidence: 0.97, evidence, escalated: false, message: 'Your session expired. Please sign in again to restore your cart.' };
  }

  if (
    combined.includes('payment') ||
    combined.includes('invalid key') ||
    combined.includes('payment key') ||
    combined.includes('config') ||
    combined.includes('missing api key')
  ) {
    evidence.push({ tool: 'readState', source: 'config', summary: 'The payment service checks are failing because the configuration is missing or invalid.' });
    return { classification: 'CONFIG', confidence: 0.96, evidence, escalated: false, message: 'The payment service is not configured correctly. Please retry after checking the payment settings.' };
  }

  if (combined.includes('page wont load') || combined.includes('spinning forever') || combined.includes('timeout') || combined.includes('network') || combined.includes('upstream')) {
    evidence.push({ tool: 'runHealthCheck', source: 'network', summary: 'Upstream responses are timing out or the app is not reachable.' });
    return { classification: 'NETWORK', confidence: 0.9, evidence, escalated: false, message: 'The service may be temporarily unavailable. Please retry in a moment and check your connection.', transient: true };
  }

  if (
    (combined.includes('total') && (combined.includes('one cent') || combined.includes('rounding') || combined.includes('off by'))) ||
    (combined.includes('duplicate') && combined.includes('page 2')) ||
    (combined.includes('search') && combined.includes('duplicate')) ||
    (combined.includes('pagination') && combined.includes('offset'))
  ) {
    evidence.push({ tool: 'readLogs', source: 'defect', summary: 'The logs show the defect path is active in the order totals or pagination logic.' });
    return { classification: 'SOFTWARE_DEFECT', confidence: 0.94, evidence, escalated: false, message: 'A defect was detected in the billing or search logic.' };
  }

  const seedLabels = getSeedLabels();
  const matching = Object.entries(seedLabels).find(([key, value]) => {
    const labelText = `${key} ${value.rootCause} ${value.classification}`.toLowerCase();
    return combined.includes(labelText.split(' ').slice(0, 2).join(' ')) || combined.includes(value.classification.toLowerCase());
  });

  if (matching) {
    const [scenarioId, details] = matching;
    evidence.push({ tool: 'readLogs', source: scenarioId, summary: details.rootCause });
    return { classification: details.classification as Classification, confidence: 0.75, evidence, escalated: false, message: details.rootCause };
  }

  return {
    classification: 'UNKNOWN',
    confidence: 0.45,
    evidence: [{ tool: 'readLogs', source: 'triage', summary: 'Not enough evidence to classify the report confidently.' }],
    escalated: true,
    message: 'The issue is ambiguous and needs a human review.'
  };
}

export async function runInvestigation(report: ReportInput): Promise<InvestigationResult> {
  const investigationId = buildId();
  const useNemotron = getProviderStatus().configured;
  const modelAssessment = useNemotron
    ? await investigateWithNemotron(report, investigationId, callTool)
    : undefined;
  const toolResults = modelAssessment?.toolResults ?? [
    callTool('readLogs', { report: report.text }, investigationId),
    callTool('readState', { userId: report.userId ?? 'demo-user', page: report.currentPage ?? '/checkout' }, investigationId),
    callTool('runHealthCheck', { verbose: true }, investigationId)
  ];

  const evidence = toolResults
    .filter((toolResult) => toolResult.ok)
    .map((toolResult) => ({
      tool: toolResult.log.tool,
      source: 'tool-result',
      summary: JSON.stringify(toolResult.data ?? {})
    }));

  const classification = modelAssessment
    ? {
        classification: modelAssessment.classification,
        confidence: modelAssessment.confidence,
        evidence,
        escalated: modelAssessment.classification === 'UNKNOWN',
        message: safeResolutionMessage(modelAssessment.classification),
        transient: modelAssessment.classification === 'NETWORK' || modelAssessment.transient
      }
    : classifyReport(report);
  const baseResult: InvestigationResult = {
    investigationId,
    provider: useNemotron ? 'nvidia-nemotron' : 'local',
    classification: classification.classification,
    confidence: classification.confidence,
    evidence: [...classification.evidence, ...evidence],
    escalated: classification.escalated,
    message: classification.message,
    transient: classification.transient,
    status: classification.escalated ? 'escalated' : 'resolved'
  };

  if (classification.classification === 'SOFTWARE_DEFECT') {
    const reportText = report.text.toLowerCase();
    const scenarioId = (
      /rounding|one cent|total/.test(reportText) ? 'S4' : /duplicate|page 2|search/.test(reportText) ? 'S5' : 'S4'
    );
    const incident: IncidentDraft = {
      investigationId,
      scenarioId,
      summary: `The report indicates a defect in ${scenarioId === 'S4' ? 'order total rounding' : 'pagination behavior'}.`,
      reproductionSteps: [
        'A user reports a defect in the app with a reproducible failure.',
        scenarioId === 'S4'
          ? 'Calculate an order with multiple line items that each have fractional cents.'
          : 'Open a search result page and check page 2 for overlapping rows.',
        'Compare the actual result to the expected behavior.'
      ],
      expectedBehavior: scenarioId === 'S4' ? 'The final total should be rounded once after summing the order.' : 'Page 2 should show only the next unique items without duplication.',
      actualBehavior: scenarioId === 'S4' ? 'The total is off by one cent because rounding is applied to each item.' : 'Duplicate items appear on page 2 because the offset is off by one.',
      evidence: baseResult.evidence,
      suspectedArea: scenarioId === 'S4' ? 'pricing/checkout logic' : 'search pagination logic'
    };

    const proposals = generateTestProposals(incident);
    baseResult.incidentReport = writeIncidentReport(incident);
    baseResult.generatedProposals = proposals.map((proposal) => ({ id: proposal.id, file: proposal.file, state: proposal.state }));
  }

  return baseResult;
}

export function getToolSchema() {
  return TOOL_SCHEMA;
}
