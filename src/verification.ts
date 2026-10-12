import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ProposalRecord } from './types.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const proposalsDir = path.join(currentDir, 'proposals');

function loadProposals(): ProposalRecord[] {
  const storePath = path.join(proposalsDir, 'proposals.json');
  if (!fs.existsSync(storePath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as ProposalRecord[];
}

export function verifyApprovedTests(build: 'buggy' | 'fixed' = 'fixed') {
  const proposals = loadProposals().filter((proposal) => proposal.state === 'approved');

  if (proposals.length === 0) {
    return {
      build,
      allPassed: false,
      results: [],
      message: 'No approved tests are available for verification.'
    };
  }

  const results = proposals.map((proposal) => {
    const env = { ...process.env, APP_BUILD: build };
    const command = spawnSync('npx', ['vitest', 'run', proposal.file, '--reporter=basic'], {
      cwd: path.resolve(currentDir, '..'),
      env,
      encoding: 'utf8'
    });

    return {
      proposalId: proposal.id,
      file: proposal.file,
      passed: command.status === 0,
      output: command.stdout + command.stderr,
      exitCode: command.status ?? 1
    };
  });

  const failed = results.filter((result) => !result.passed);

  return {
    build,
    allPassed: failed.length === 0,
    results,
    message: failed.length === 0 ? 'All approved tests passed.' : 'Some approved tests failed.'
  };
}
