import { describe, expect, it } from 'vitest';

import { runInvestigation } from '../src/investigation.js';
import { calculateOrderTotal, paginateResults } from '../src/sampleApp.js';

describe('core investigation behavior', () => {
  it('classifies S1 as USER_ACTION', async () => {
    const result = await runInvestigation({ text: 'I got logged out and my cart is gone' });
    expect(result.classification).toBe('USER_ACTION');
  });

  it('classifies S2 as CONFIG', async () => {
    const result = await runInvestigation({ text: 'Payments fail with invalid key' });
    expect(result.classification).toBe('CONFIG');
  });

  it('classifies S4 as SOFTWARE_DEFECT', async () => {
    const result = await runInvestigation({ text: 'Total is off by one cent on large orders' });
    expect(result.classification).toBe('SOFTWARE_DEFECT');
  });

  it('classifies S5 as SOFTWARE_DEFECT', async () => {
    const result = await runInvestigation({ text: 'Search returns duplicate items on page 2' });
    expect(result.classification).toBe('SOFTWARE_DEFECT');
  });

  it('classifies ambiguous reports as UNKNOWN', async () => {
    const result = await runInvestigation({ text: 'Something weird happened and I cannot tell why' });
    expect(result.classification).toBe('UNKNOWN');
    expect(result.escalated).toBe(true);
  });
});

describe('sample app defect logic', () => {
  it('fails on buggy total rounding and passes on fixed total rounding', () => {
    const buggy = calculateOrderTotal([0.615, 0.615, 0.615], 'buggy');
    const fixed = calculateOrderTotal([0.615, 0.615, 0.615], 'fixed');

    expect(buggy).toBe(1.86);
    expect(fixed).toBe(1.85);
  });

  it('fails on buggy pagination and passes on fixed pagination', () => {
    const items = ['A', 'B', 'C', 'D', 'E'];
    expect(paginateResults(items, 2, 2, 'buggy')).toEqual(['E']);
    expect(paginateResults(items, 2, 2, 'fixed')).toEqual(['C', 'D']);
  });
});
