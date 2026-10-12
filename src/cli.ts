#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { runInvestigation } from './investigation.js';
import { listProposals, updateProposalState } from './testGenerator.js';
import { verifyApprovedTests } from './verification.js';

function printUsage() {
  console.log(`Usage:\n  node src/cli.ts investigate --file report.json\n  node src/cli.ts review-tests --approve S4-ROUNDING\n  node src/cli.ts verify --build fixed`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    printUsage();
    return;
  }

  if (command === 'investigate') {
    const fileIndex = args.indexOf('--file');
    const textIndex = args.indexOf('--text');

    if (fileIndex >= 0 && args[fileIndex + 1]) {
      const filePath = path.resolve(process.cwd(), args[fileIndex + 1]);
      const raw = fs.readFileSync(filePath, 'utf8');
      const report = JSON.parse(raw);
      const result = await runInvestigation(report);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (textIndex >= 0 && args[textIndex + 1]) {
      const report = { text: args[textIndex + 1] };
      const result = await runInvestigation(report);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printUsage();
    return;
  }

  if (command === 'review-tests') {
    const proposals = listProposals();
    const approveIndex = args.indexOf('--approve');
    const rejectIndex = args.indexOf('--reject');

    if (approveIndex >= 0 && args[approveIndex + 1]) {
      const updated = updateProposalState(args[approveIndex + 1], 'approved', 'developer');
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    if (rejectIndex >= 0 && args[rejectIndex + 1]) {
      const updated = updateProposalState(args[rejectIndex + 1], 'rejected', 'developer');
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    console.log(JSON.stringify(proposals, null, 2));
    return;
  }

  if (command === 'verify') {
    const buildIndex = args.indexOf('--build');
    const build = buildIndex >= 0 && args[buildIndex + 1] ? (args[buildIndex + 1] as 'buggy' | 'fixed') : 'fixed';
    const result = verifyApprovedTests(build);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printUsage();
}

void main();
