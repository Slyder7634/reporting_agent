#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const cliPath = path.join(projectRoot, 'src', 'cli.ts');
const args = process.argv.slice(2);

const child = spawn(process.execPath, ['--import', 'tsx', cliPath, ...args], {
  cwd: projectRoot,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
