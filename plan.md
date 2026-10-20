# Implementation Plan: AI Diagnostic & Test Generation Agent (MVP)

Status: Draft v0.1
Companion documents: 01-documentation.md, 02-requirements.md

## 1. Goal

Build a demo that takes one user report through diagnosis, incident creation, regression test generation, and verification, using a sample app with seeded defects. The demo must make the fail-then-pass test cycle visible.

## 2. Pre-Build Decisions

These must be settled before Phase 1. Recommended defaults are marked.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Language | Node.js/TypeScript, Python | Node.js/TypeScript. Keeps the sample app, agent, and Vitest in one stack. |
| D2 | Sample app | Own build, existing open-source app | Own build. Seeded bugs need known root causes. |
| D3 | LLM | Hosted API or local model | NVIDIA Nemotron through the OpenAI-compatible API and JavaScript SDK, configured by environment variables. |
| D4 | Test framework | Vitest, Jest | Vitest. Fast, minimal config. |
| D5 | Interface | CLI, web page | CLI and a local web dashboard. |
| D6 | Code patches | In scope, out of scope | Out of scope for MVP. |
| D7 | Hackathon deadline | Date | Needed to set the phase timing below. |

## 3. Phases

Durations are effort estimates for one developer working part-time. Adjust once D7 is known.

### Phase 0: Validation and research (1 to 2 days)

Goals: confirm the approach and gather prior art.

- Survey existing tools: AI-assisted bug triage (e.g., Sentry AI features, Jira automation), test generation tools (e.g., Diffblue, Qodo, GitHub Copilot test generation), and agent frameworks with tool allowlists.
- Note what each does and does not do. The gap to target: end-to-end chain from user report to verified regression test, with human approval.
- Confirm the NVIDIA Nemotron OpenAI-compatible tool-use flow works with a trivial read-only tool.

Deliverable: a one-page prior-art note and a go/no-go decision.

### Phase 1: Sample app with seeded defects (2 to 3 days)

- Build the Express + SQLite app with login, session expiry, cart, checkout, and search.
- Implement the S4 (rounding) and S5 (pagination) defects.
- Create the `fixed` build with corrections.
- Add `/diag/*` read-only endpoints with token auth.
- Write `fixtures/labels.json` with scenarios S1 to S5.

Exit criteria: the app runs, the defects reproduce manually, and diag endpoints return data.

### Phase 2: Tool gateway and permissions (1 to 2 days)

- Implement the allowlist, config-based permissions (default deny), and the audit log.
- Implement redaction with test fixtures containing fake secrets.
- Write tests for the gateway: blocked tools are rejected, redaction works, audit entries are complete.

Exit criteria: NFR-4 and FR-31 pass their tests. Gateway tests are green.

### Phase 3: Investigator (3 to 4 days)

- Write the tool schemas and the investigation loop with step and time limits.
- Implement the classification output with confidence and evidence.
- Add the `UNKNOWN` fallback and escalation path.
- Write the user-facing resolution messages for `USER_ACTION` and `CONFIG`.

Exit criteria: S1 and S2 classify correctly. S3 and S4 classify correctly at least sometimes. Measure this and record results.

### Phase 4: Incident reports and test generation (2 to 3 days)

- Implement the Report Writer producing the Markdown incident format.
- Implement the Test Generator producing Vitest proposals for S4 and S5.
- Add the proposal store with pending, approved, and rejected states.

Exit criteria: S4 and S5 produce incidents and at least one regression test each. Tests compile without manual edits.

### Phase 5: Review and verification (1 to 2 days)

- CLI commands: `investigate`, `review-tests`, `verify --build buggy|fixed`.
- Implement the verification runner and the fail-then-pass check.
- Record results in a report the judges can read.

Exit criteria: the S4 regression test fails on `buggy` and passes on `fixed`. Same for S5. Full suite runs on `fixed`.

### Phase 6: Evaluation and demo (1 to 2 days)

- Create 20 labeled reports (4 per scenario plus 0 ambiguous ones, adjust for variety).
- Run the evaluation and record accuracy, latency, cost, and validity rate.
- Run the acceptance checklist from 02-requirements.md section 4.
- Prepare a 3-minute demo script and a short README.

Exit criteria: all acceptance criteria pass. Metrics are recorded.

## 4. Timeline Summary

| Phase | Effort | Cumulative |
|---|---|---|
| 0. Validation | 1 to 2 days | 1 to 2 days |
| 1. Sample app | 2 to 3 days | 3 to 5 days |
| 2. Gateway | 1 to 2 days | 4 to 7 days |
| 3. Investigator | 3 to 4 days | 7 to 11 days |
| 4. Incidents and tests | 2 to 3 days | 9 to 14 days |
| 5. Verification | 1 to 2 days | 10 to 16 days |
| 6. Evaluation and demo | 1 to 2 days | 11 to 18 days |

If the hackathon is shorter than about 11 days, cut scope in this order: S3 (network scenario), the S5 scenario, the CLI polish, then the ambiguous-report evaluation. Do not cut the fail-then-pass verification. It is the core claim of the project.

## 5. Success Metrics

| Metric | Target | Measured in |
|---|---|---|
| Classification accuracy (labeled set) | ≥ 80% | Phase 6 |
| Regression test validity on defect scenarios | 100% | Phase 5 and 6 |
| Tool-call violations | 0 | Phase 2 and 6 |
| PII/secret leaks in outputs | 0 | Phase 2 and 6 |
| Median investigation time | Under 30 s | Phase 6 |
| Setup time from clone | ≤ 15 min | Phase 6 |

## 6. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hackathon time is shorter than planned | High | High | Scope cut order in section 4. Keep the verification loop. |
| The model guesses on S3 and S4 | Medium | Medium | Confidence threshold, evidence requirement, labeled evaluation. |
| Generated tests are shallow or always pass | Medium | High | Mandatory fail-on-buggy check. Reject tests that pass on buggy. |
| Scope creep into code patching | Medium | High | D6 is decided and documented. Revisit only after the MVP demo. |
| Judges see only a demo, not the value | Medium | Medium | Show the before/after: manual triage time vs agent output. |
| Prior art already does most of this | Low to medium | Medium | Phase 0 research. Position around the end-to-end human-approved chain. |

## 7. Demo Script (3 minutes)

1. (20 s) Problem statement: a user reports a payment error and a wrong total.
2. (40 s) User report on S2 (config). Agent returns clear guidance. Show the audit log briefly.
3. (60 s) User report on S4 (rounding). Agent classifies as defect, produces incident report and regression test.
4. (40 s) Run `verify --build buggy`: the test fails. Run `verify --build fixed`: the test passes.
5. (20 s) Summary of metrics and what the agent did not do (no code changes, no data writes).

## 8. Next Steps

1. Decide D1 to D7. D7 is the most urgent.
2. Confirm the Phase 0 research scope with the team.
3. Start Phase 0 and Phase 1 in parallel, since they do not depend on each other.