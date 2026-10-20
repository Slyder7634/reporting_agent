import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runInvestigation } from './investigation.js';
import { getProviderStatus } from './nvidiaProvider.js';
import { getSeedLabels } from './sampleApp.js';
import { listProposals, updateProposalState } from './testGenerator.js';
import { listAuditLog, redactText } from './toolGateway.js';
import { verifyApprovedTests } from './verification.js';
import type { ProposalRecord, ReportInput } from './types.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const app = express();
const DIAG_TOKEN = process.env.DIAG_TOKEN ?? 'demo-token';
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(projectRoot, 'public')));

function requireDiagToken(req: Request, res: Response, next: NextFunction): void {
  if ((req.headers.authorization ?? '') !== `Bearer ${DIAG_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${field} must be a string no longer than ${maxLength} characters.`);
  }
  return value;
}

function parseReport(value: unknown): ReportInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A report object is required.');
  }
  const body = value as Record<string, unknown>;
  const text = optionalString(body.text, 'text', 5000);
  if (!text?.trim()) {
    throw new Error('Please enter a problem report.');
  }

  let context: ReportInput['context'];
  if (body.context !== undefined) {
    if (!body.context || typeof body.context !== 'object' || Array.isArray(body.context)) {
      throw new Error('context must be an object.');
    }
    const entries = Object.entries(body.context as Record<string, unknown>);
    if (entries.length > 30 || entries.some(([, item]) => !['string', 'number', 'boolean'].includes(typeof item) && item !== null)) {
      throw new Error('context must contain at most 30 primitive values.');
    }
    context = Object.fromEntries(entries) as ReportInput['context'];
  }

  return {
    text: text.trim(),
    currentPage: optionalString(body.currentPage, 'currentPage', 300),
    actionAttempted: optionalString(body.actionAttempted, 'actionAttempted', 1000),
    timestamp: optionalString(body.timestamp, 'timestamp', 100),
    userId: optionalString(body.userId, 'userId', 100),
    context
  };
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res).catch(next);
  };
}

function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction): void {
  const message = redactText(error.message || 'The request failed.');
  const status = message.startsWith('Nemotron') ? 502 : 500;
  res.status(status).json({ error: message });
}

app.get('/api/status', (_req: Request, res: Response) => {
  res.json(getProviderStatus());
});

app.post('/api/report', asyncRoute(async (req, res) => {
  let report: ReportInput;
  try {
    report = parseReport(req.body);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid report.' });
    return;
  }

  res.json(await runInvestigation(report));
}));

app.get('/api/proposals', (_req: Request, res: Response) => {
  res.json(listProposals().map((proposal) => ({
    ...proposal,
    file: path.basename(proposal.file)
  })));
});

app.post('/api/proposals/:id/review', (req: Request, res: Response) => {
  const state = req.body?.state;
  const proposalId = req.params.id;
  const approvedBy = typeof req.body?.approvedBy === 'string' ? req.body.approvedBy.slice(0, 100) : 'web-reviewer';
  if (state !== 'approved' && state !== 'rejected') {
    res.status(400).json({ error: 'state must be approved or rejected.' });
    return;
  }
  if (typeof proposalId !== 'string' || !listProposals().some((proposal) => proposal.id === proposalId)) {
    res.status(404).json({ error: 'Proposal not found.' });
    return;
  }
  const proposals = updateProposalState(proposalId, state as ProposalRecord['state'], approvedBy);
  res.json(proposals.map((proposal) => ({ ...proposal, file: path.basename(proposal.file) })));
});

app.post('/api/verify', asyncRoute(async (req, res) => {
  const build = req.body?.build;
  if (build !== 'buggy' && build !== 'fixed') {
    res.status(400).json({ error: 'build must be buggy or fixed.' });
    return;
  }
  res.json(verifyApprovedTests(build));
}));

app.get('/api/audit', (_req: Request, res: Response) => {
  res.json(listAuditLog().slice(-100));
});

app.get('/diag/health', requireDiagToken, (_req: Request, res: Response) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/diag/session', requireDiagToken, (_req: Request, res: Response) => {
  res.json({ sessionValid: false, reason: 'expired' });
});

app.get('/diag/config', requireDiagToken, (_req: Request, res: Response) => {
  res.json({ paymentEnabled: false, paymentKeyConfigured: false });
});

app.get('/diag/search', requireDiagToken, (_req: Request, res: Response) => {
  const items = ['A', 'B', 'C', 'D', 'E'];
  res.json({ items, page: 2, pageSize: 2, result: ['C', 'D'] });
});

app.get('/diag/labels', requireDiagToken, (_req: Request, res: Response) => {
  res.json(getSeedLabels());
});

app.use(errorHandler);

app.listen(port, host, () => {
  console.log(`Reporting Agent listening on http://${host}:${port}`);
});
