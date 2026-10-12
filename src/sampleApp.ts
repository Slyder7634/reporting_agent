import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type AppBuild = 'buggy' | 'fixed';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateOrderTotal(items: number[], build: AppBuild = 'fixed'): number {
  const total = items.reduce((sum, item) => sum + item, 0);

  if (build === 'buggy') {
    return roundCurrency(items.reduce((sum, item) => sum + roundCurrency(item), 0));
  }

  return roundCurrency(total);
}

export function paginateResults<T>(items: T[], page: number, pageSize: number, build: AppBuild = 'fixed'): T[] {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const offset = build === 'buggy' ? safePage * safeSize : (safePage - 1) * safeSize;
  return items.slice(offset, offset + safeSize);
}

export function getSeedLabels(): Record<string, { classification: string; rootCause: string }> {
  const labelsPath = path.join(currentDir, 'fixtures', 'labels.json');
  const file = readFileSync(labelsPath, 'utf8');
  const parsed = JSON.parse(file) as Record<string, { classification: string; rootCause: string }>;
  return parsed;
}

export const demoScenarios = {
  S1: { label: 'USER_ACTION', description: 'Session expired after 30 minutes. Guide the user to sign in again.' },
  S2: { label: 'CONFIG', description: 'Missing or incorrect payment settings.' },
  S3: { label: 'NETWORK', description: 'Upstream API timeout is simulated.' },
  S4: { label: 'SOFTWARE_DEFECT', description: 'Rounding is applied per line item instead of once per order.' },
  S5: { label: 'SOFTWARE_DEFECT', description: 'Pagination offset is off by one.' }
};
