# Reporting Agent

A minimal Node.js + TypeScript MVP for a diagnostic workflow that:

- accepts a user report,
- classifies it into `USER_ACTION`, `CONFIG`, `NETWORK`, `SOFTWARE_DEFECT`, or `UNKNOWN`,
- gathers allowlisted evidence through read-only tools,
- produces an incident report and regression-test proposals for defects,
- verifies approved tests against a `buggy` or `fixed` build.

## Quick start

1. Install dependencies:
   npm install
2. Run the built-in suite:
   npm test
3. Run the CLI on a report:
   npx tsx src/cli.ts investigate --text "Payments fail with invalid key"
4. Review generated proposals:
   npx tsx src/cli.ts review-tests
5. Approve a proposal:
   npx tsx src/cli.ts review-tests --approve S4-ROUNDING
6. Verify against the buggy or fixed build:
   npx tsx src/cli.ts verify --build buggy
   npx tsx src/cli.ts verify --build fixed

## Included behavior

- S1 -> `USER_ACTION`
- S2 -> `CONFIG`
- S3 -> `NETWORK`
- S4 -> `SOFTWARE_DEFECT` with incident report and rounding regression test
- S5 -> `SOFTWARE_DEFECT` with pagination regression test
- ambiguous text -> `UNKNOWN` with escalation

## Sample app notes

The project includes a small Express app and seeded diagnostics under `/diag/*`, protected by a bearer token. The app intentionally models two defect scenarios:

- `S4`: total rounding is wrong on the buggy build.
- `S5`: search pagination duplicates items on page 2 on the buggy build.

The fixed build corrects both defects, and the generated Vitest tests are designed to fail on the buggy build and pass on the fixed build.

## File layout

- `src/investigation.ts` — report classification and investigation loop
- `src/toolGateway.ts` — allowlist, redaction, and audit-ready tool wrapper
- `src/reportWriter.ts` — Markdown incident output
- `src/testGenerator.ts` — generates pending regression proposals
- `src/verification.ts` — runs approved tests against a build
- `src/server.ts` — Express smoke-test server and diagnostic endpoints
- `src/sampleApp.ts` — seeded scenarios and buggy/fixed behavior helpers
- `src/config/permissions.json` — default-deny permissions
- `src/fixtures/labels.json` — scenario metadata