# Requirements: AI Diagnostic & Test Generation Agent

Status: Draft v0.1
Scope: Hackathon MVP. Items marked [Later] are not in the MVP.

Priority: **M** = must have for MVP, **S** = should have, **L** = later.

## 1. Stakeholders

- **End user**: reports a problem, needs a fix or a clear next step.
- **Developer**: configures permissions, reviews incidents and tests, owns the app.
- **QA / reviewer**: approves tests, checks regressions.

## 2. Functional Requirements

### 2.1 Report intake

| ID | Requirement | Pri |
|---|---|---|
| FR-1 | The system accepts a free-text report with optional context: current page, action attempted, timestamp, user ID (opaque). | M |
| FR-2 | The system assigns each report a unique investigation ID. | M |
| FR-3 | Report intake works from a CLI and from a simple HTTP endpoint. | S |

### 2.2 Investigation

| ID | Requirement | Pri |
|---|---|---|
| FR-4 | The agent receives the report, app documentation, and the tool schema, and returns a classification from `USER_ACTION`, `CONFIG`, `NETWORK`, `SOFTWARE_DEFECT`, or `UNKNOWN`. | M |
| FR-5 | The agent may call only allowlisted diagnostic tools. Any other call is rejected and logged. | M |
| FR-6 | Each investigation stops after at most 8 tool calls or 60 seconds, whichever comes first. | M |
| FR-7 | Each classification includes a confidence score and a list of evidence items, each tied to a tool result. | M |
| FR-8 | When confidence is below 0.6, the classification is `UNKNOWN` and the case is escalated. | M |
| FR-9 | The agent runs one investigation at a time per report, with no state shared across reports. | S |

### 2.3 Resolution (user-side issues)

| ID | Requirement | Pri |
|---|---|---|
| FR-10 | For `USER_ACTION` and `CONFIG` classifications, the agent returns a step-by-step message for the user. | M |
| FR-11 | Resolution messages contain no internal details (stack traces, env var names, internal hostnames). | M |
| FR-12 | For `NETWORK` classifications, the agent suggests retry or check-connection steps and marks the case as possibly transient. | S |

### 2.4 Incident reporting (defects)

| ID | Requirement | Pri |
|---|---|---|
| FR-13 | For `SOFTWARE_DEFECT`, the system produces an incident report in Markdown containing: summary, reproduction steps, expected behavior, actual behavior, evidence, and suspected area. | M |
| FR-14 | Incident reports link back to the investigation ID and the evidence items. | M |
| FR-15 | Incident reports do not include user PII or secrets. | M |

### 2.5 Test generation

| ID | Requirement | Pri |
|---|---|---|
| FR-16 | For each incident, the system generates at least one regression test that reproduces the reported failure. | M |
| FR-17 | The system proposes 1 to 3 edge-case tests near the failing path. | S |
| FR-18 | Generated tests are saved as proposals, not added to the suite until approved. | M |
| FR-19 | Generated tests use the project's test framework (Vitest) and compile without manual edits in the MVP demo scenarios. | M |
| FR-20 | Each proposal shows its target incident, the behavior it checks, and why it was generated. | S |

### 2.6 Review and approval

| ID | Requirement | Pri |
|---|---|---|
| FR-21 | A developer can approve, reject, or edit each proposed test through the CLI. | M |
| FR-22 | Only approved tests enter the suite used for verification. | M |
| FR-23 | Approval records who approved and when. | S |

### 2.7 Verification

| ID | Requirement | Pri |
|---|---|---|
| FR-24 | The system runs approved tests against a named build (`buggy` or `fixed`). | M |
| FR-25 | A regression test is considered valid if it fails on `buggy` and passes on `fixed`. | M |
| FR-26 | Verification output shows pass/fail per test, with the failing assertion where applicable. | M |
| FR-27 | Verification runs in the sandbox only, never against production data. | M |
| FR-28 | The system runs the full existing suite on `fixed` to detect regressions and reports any failures. | S |

### 2.8 Audit and permissions

| ID | Requirement | Pri |
|---|---|---|
| FR-29 | Every tool call is logged with timestamp, tool name, arguments, result size, and investigation ID. | M |
| FR-30 | Permissions are declared in a config file. Missing entries default to deny. | M |
| FR-31 | Log output is redacted for fields listed in the config (tokens, passwords, emails). | M |
| FR-32 | The agent cannot write to application data or execute shell commands. | M |

### 2.9 Sample application

| ID | Requirement | Pri |
|---|---|---|
| FR-33 | The sample app includes at least five seeded scenarios (S1 to S5 in the documentation). | M |
| FR-34 | Each seeded scenario has a documented root cause and expected classification in `fixtures/labels.json`. | M |
| FR-35 | The sample app includes a `fixed` build where S4 and S5 are corrected. | M |
| FR-36 | Diagnostic endpoints are read-only and require a token. | M |

## 3. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Classification accuracy on the labeled scenario set | ≥ 80% on 20 labeled reports (see plan) |
| NFR-2 | Investigation latency, p90 | ≤ 60 s |
| NFR-3 | Regression-test validity rate on defect scenarios | 100% on the MVP set (fails on buggy, passes on fixed) |
| NFR-4 | No tool calls outside the allowlist | 0 violations in test runs |
| NFR-5 | No PII or secrets in incident reports or user-facing messages | 0 leaks in the test set |
| NFR-6 | Setup from clone to first investigation | ≤ 15 minutes with the README |
| NFR-7 | Cost per investigation on the chosen LLM | Recorded and reported; no fixed target in MVP |
| NFR-8 | Human override is always possible | Every automated classification can be overridden in the CLI |

## 4. Acceptance Criteria for the MVP

The MVP is accepted when all of the following are demonstrated end to end:

1. A user report on S1 yields `USER_ACTION` with a clean resolution message.
2. A report on S2 yields `CONFIG` with guidance that does not name the env var.
3. A report on S4 yields `SOFTWARE_DEFECT`, an incident report, and a regression test.
4. The S4 regression test fails on `buggy` and passes on `fixed`.
5. A report on S5 yields the same chain as S4.
6. An ambiguous report yields `UNKNOWN` and escalation.
7. The audit log shows every tool call for the demo investigations.
8. Permission config changes are respected: removing a tool from the allowlist makes the agent unable to use it.

## 5. Out of Scope for MVP

- [L] Automatic code patches or pull requests.
- [L] Production deployment or monitoring integration.
- [L] Multi-app support beyond the sample app.
- [L] Real user PII handling and compliance (GDPR, etc.).
- [L] Learning from past incidents to improve classification.
- [L] Mobile SDK.

## 6. Assumptions and Constraints

- The LLM uses NVIDIA Nemotron through its OpenAI-compatible API. Requests send only redacted data, and API credentials remain server-side.
- The team has about one to two weeks of part-time time. Hackathon constraints may tighten this.
- The MVP uses a single sample app. It is a deliberately small system, so the investigation path can be fully tested.
- The developer writes the app documentation given to the agent. Documentation quality directly affects accuracy.

## 7. Risks to Requirements

| Risk | Impact | Mitigation |
|---|---|---|
| LLM classifies with false confidence | Wrong guidance to users | FR-8 threshold, FR-11 safe messages, labeled evaluation set |
| Generated tests pass trivially | False sense of coverage | FR-25 fail-on-buggy rule is mandatory |
| Tool gateway bypassed | Security exposure | FR-5, FR-30, FR-32, NFR-4 tested explicitly |
| Redaction misses a secret | Data leak in reports | FR-31 with test fixtures containing fake secrets |