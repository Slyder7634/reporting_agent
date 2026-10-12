import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { IncidentDraft, ProposalRecord } from './types.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const proposalsDir = path.join(currentDir, 'proposals');

function ensureProposalDir() {
  fs.mkdirSync(proposalsDir, { recursive: true });
}

export function generateTestProposals(incident: IncidentDraft): ProposalRecord[] {
  ensureProposalDir();

  const scenarioId = incident.scenarioId;
  const proposals: ProposalRecord[] = [];

  if (scenarioId === 'S4') {
    proposals.push({
      id: 'S4-ROUNDING',
      scenarioId: 'S4',
      incidentId: incident.investigationId,
      title: 'Order total rounds after summing',
      behavior: 'The order total should round once after summing all line items.',
      why: 'Defect was caused by rounding each line item individually instead of the full order total.',
      file: path.join(proposalsDir, 's4-rounding.test.ts'),
      content: `import { describe, expect, it } from 'vitest';\nimport { calculateOrderTotal } from '../sampleApp.js';\n\ndescribe('S4 rounding regression', () => {\n  it('rounds the total after summing the order', () => {\n    const build = process.env.APP_BUILD ?? 'fixed';\n    const total = calculateOrderTotal([0.615, 0.615, 0.615], build as 'buggy' | 'fixed');\n    expect(total).toBe(1.85);\n  });\n});\n`,
      state: 'pending'
    });

    proposals.push({
      id: 'S4-EDGE-LARGE-ORDER',
      scenarioId: 'S4',
      incidentId: incident.investigationId,
      title: 'Large order remains stable',
      behavior: 'Large orders should not drift by one cent due to per-item rounding.',
      why: 'Nearby edge case for large purchase totals.',
      file: path.join(proposalsDir, 's4-large-order.test.ts'),
      content: `import { describe, expect, it } from 'vitest';\nimport { calculateOrderTotal } from '../sampleApp.js';\n\ndescribe('S4 edge case', () => {\n  it('keeps large totals stable', () => {\n    const build = process.env.APP_BUILD ?? 'fixed';\n    const total = calculateOrderTotal([12.345, 12.345, 12.345], build as 'buggy' | 'fixed');\n    expect(total).toBe(37.04);\n  });\n});\n`,
      state: 'pending'
    });
  }

  if (scenarioId === 'S5') {
    proposals.push({
      id: 'S5-PAGINATION',
      scenarioId: 'S5',
      incidentId: incident.investigationId,
      title: 'Page 2 does not duplicate results',
      behavior: 'Page 2 should show the next slice without reusing the previous results.',
      why: 'The pagination offset was off by one, overlapping results from adjacent pages.',
      file: path.join(proposalsDir, 's5-pagination.test.ts'),
      content: `import { describe, expect, it } from 'vitest';\nimport { paginateResults } from '../sampleApp.js';\n\ndescribe('S5 pagination regression', () => {\n  it('returns the right items on page 2', () => {\n    const build = process.env.APP_BUILD ?? 'fixed';\n    const items = ['A', 'B', 'C', 'D', 'E'];\n    const page = paginateResults(items, 2, 2, build as 'buggy' | 'fixed');\n    expect(page).toEqual(['C', 'D']);\n  });\n});\n`,
      state: 'pending'
    });

    proposals.push({
      id: 'S5-EDGE-PAGE-1',
      scenarioId: 'S5',
      incidentId: incident.investigationId,
      title: 'Page 1 remains correct',
      behavior: 'The first page should remain stable after the offset fix.',
      why: 'Nearby edge case ensuring the offset fix does not change page 1 behavior.',
      file: path.join(proposalsDir, 's5-page-one.test.ts'),
      content: `import { describe, expect, it } from 'vitest';\nimport { paginateResults } from '../sampleApp.js';\n\ndescribe('S5 edge case', () => {\n  it('keeps the first page stable', () => {\n    const build = process.env.APP_BUILD ?? 'fixed';\n    const items = ['A', 'B', 'C', 'D', 'E'];\n    const page = paginateResults(items, 1, 2, build as 'buggy' | 'fixed');\n    expect(page).toEqual(['A', 'B']);\n  });\n});\n`,
      state: 'pending'
    });
  }

  const storePath = path.join(currentDir, 'proposals', 'proposals.json');
  fs.writeFileSync(storePath, JSON.stringify(proposals, null, 2));

  for (const proposal of proposals) {
    fs.writeFileSync(proposal.file, proposal.content);
  }

  return proposals;
}

export function listProposals(): ProposalRecord[] {
  const storePath = path.join(currentDir, 'proposals', 'proposals.json');
  if (!fs.existsSync(storePath)) {
    return [];
  }

  const raw = fs.readFileSync(storePath, 'utf8');
  return JSON.parse(raw) as ProposalRecord[];
}

export function updateProposalState(id: string, state: ProposalRecord['state'], approvedBy?: string): ProposalRecord[] {
  const proposals = listProposals();
  const next = proposals.map((proposal) => {
    if (proposal.id !== id) {
      return proposal;
    }

    return {
      ...proposal,
      state,
      approvedBy: approvedBy ?? proposal.approvedBy,
      approvedAt: state === 'approved' ? new Date().toISOString() : proposal.approvedAt
    };
  });

  const storePath = path.join(currentDir, 'proposals', 'proposals.json');
  fs.writeFileSync(storePath, JSON.stringify(next, null, 2));
  return next;
}
