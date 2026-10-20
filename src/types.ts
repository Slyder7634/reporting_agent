export type Classification = 'USER_ACTION' | 'CONFIG' | 'NETWORK' | 'SOFTWARE_DEFECT' | 'UNKNOWN';

export type BuildName = 'buggy' | 'fixed';

export interface EvidenceItem {
  tool: string;
  source: string;
  summary: string;
}

export interface InvestigationResult {
  investigationId: string;
  provider: 'local' | 'nvidia-nemotron';
  classification: Classification;
  confidence: number;
  evidence: EvidenceItem[];
  escalated: boolean;
  message?: string;
  transient?: boolean;
  status: 'resolved' | 'escalated';
  incidentReport?: string;
  generatedProposals?: Array<{ id: string; file: string; state: 'pending' | 'approved' | 'rejected' }>;
}

export interface ReportInput {
  text: string;
  currentPage?: string;
  actionAttempted?: string;
  timestamp?: string;
  userId?: string;
  context?: Record<string, string | number | boolean | null>;
}

export interface IncidentDraft {
  investigationId: string;
  scenarioId: string;
  summary: string;
  reproductionSteps: string[];
  expectedBehavior: string;
  actualBehavior: string;
  evidence: EvidenceItem[];
  suspectedArea: string;
}

export interface ProposalRecord {
  id: string;
  scenarioId: string;
  incidentId: string;
  title: string;
  behavior: string;
  why: string;
  file: string;
  content: string;
  state: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}
