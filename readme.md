# Reporting Agent

Signal Desk is a local web dashboard and CLI for turning an issue report into a diagnosis, incident report, reviewed regression-test proposals, and a fail-then-pass verification run.

## Quick start

```sh
npm install
cp .env.example .env
```

Add your NVIDIA API key to `.env` as `NVIDIA_API_KEY`, then start the app:

```sh
npm start
```

Open <http://127.0.0.1:3000>. Without an API key, the dashboard uses the built-in local classifier so the sample workflow still runs.

## NVIDIA Nemotron integration

The server uses the OpenAI JavaScript SDK against NVIDIA's OpenAI-compatible API. The key stays on the server and is never sent to the browser.

```dotenv
NVIDIA_API_KEY=your-NVIDIA-API-key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3-nano-30b-a3b
```

Use a model available to your NVIDIA API account by changing `NVIDIA_MODEL`. The base URL can also be overridden if NVIDIA changes the hosted endpoint or you use a compatible NIM deployment. Reports are scrubbed for common secrets, bearer tokens, email addresses, and phone numbers before being sent to the model. Keep real customer data out of this demo.

## Web workflow

1. Enter an issue or choose one of the example reports.
2. Review classification, confidence, user guidance, diagnostic evidence, and (for defects) the incident report.
3. Approve or reject generated test proposals.
4. Run the approved tests on the `buggy` build to see the regression, then the `fixed` build.
5. Review the recent allowlisted diagnostic calls in the audit panel.

The server binds to `127.0.0.1` by default. Set `HOST` to change that. The demo diagnostic routes use `DIAG_TOKEN` (default `demo-token`) and require a bearer token.

## CLI

```sh
npx tsx src/cli.ts investigate --text "Payments fail with invalid key"
npx tsx src/cli.ts review-tests
npx tsx src/cli.ts review-tests --approve S4-ROUNDING
npx tsx src/cli.ts verify --build buggy
npx tsx src/cli.ts verify --build fixed
```

## HTTP API

- `GET /api/status` — provider and model configuration status (never returns the API key).
- `POST /api/report` — investigate `{ "text": "...", "currentPage": "/checkout" }`.
- `GET /api/proposals` — list proposals.
- `POST /api/proposals/:id/review` — approve or reject a proposal.
- `POST /api/verify` — verify with `{ "build": "buggy" }` or `{ "build": "fixed" }`.
- `GET /api/audit` — latest allowlisted tool calls with sensitive values redacted.

## Local demo scenarios

- S1: expired session → `USER_ACTION`
- S2: missing payment configuration → `CONFIG`
- S3: upstream timeout → `NETWORK`
- S4: per-item total rounding → `SOFTWARE_DEFECT`
- S5: pagination offset → `SOFTWARE_DEFECT`
- Ambiguous report → `UNKNOWN` and escalation

The sample app intentionally has `buggy` and `fixed` implementations for S4 and S5. The generated Vitest proposals must be approved before verification. Run the suite and build with:

```sh
npm test
npm run build
```

## Project layout

- `src/investigation.ts` — local and model-backed investigation workflows
- `src/nvidiaProvider.ts` — Nemotron SDK client and bounded read-only tool-calling loop
- `src/toolGateway.ts` — default-deny tool allowlist, redaction, and audit log
- `src/reportWriter.ts` — Markdown incident report output
- `src/testGenerator.ts` — pending regression-test proposals and review state
- `src/verification.ts` — approved-test execution against a named sample build
- `src/server.ts` — HTTP API and local dashboard server
- `public/index.html` — responsive dashboard
- `src/sampleApp.ts` — seeded scenarios and buggy/fixed behavior helpers
