import type { IncidentDraft } from './types.js';

export function writeIncidentReport(incident: IncidentDraft): string {
  const evidenceBlock = incident.evidence
    .map((entry, index) => `- [Evidence ${index + 1}] ${entry.tool}: ${entry.summary}`)
    .join('\n');

  return `# Incident Report: ${incident.investigationId}

- Investigation ID: ${incident.investigationId}
- Scenario: ${incident.scenarioId}

## Summary
${incident.summary}

## Reproduction Steps
${incident.reproductionSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## Expected Behavior
${incident.expectedBehavior}

## Actual Behavior
${incident.actualBehavior}

## Evidence
${evidenceBlock}

## Suspected Area
${incident.suspectedArea}
`;
}
