# CandidateLoop Handoff Log

This file records handoffs between Claude Code, Codex, Antigravity, and the human.

## Project invariants

- Strands Agents SDK will power the core model-driven agent loop.
- Synthetic recruiting data only for the hackathon.
- CandidateLoop automates coordination, not hiring judgment.
- Advance/Hold/Reject always requires a human.
- Essential demo behavior must be reproducible after Reset Demo.
- Repeated runs must not create duplicate operational actions.

## 2026-09-08 — CODEX — CL-001/CL-011

### Completed

- Bootstrapped the local FastAPI service and Vinext/React operations cockpit.
- Added deterministic seed data, resettable in-memory state, safe recruiting tools, and policies.
- Added structured action events, run metrics, decision resolution, and advance-gated scheduling.
- Connected run, reset, and decision controls to the local API.
- Added WebMCP registrations for those same three visible actions.
- Added backend/API coverage for the seeded run, safety boundary, idempotency, reset, and continuation.

### Files changed

- Root project instructions, task queue, environment example, README, and ignore rules.
- `apps/agent` domain, repository, tools, runner, API, prompts, and tests.
- `apps/web` CandidateLoop cockpit, theme, metadata, and WebMCP type contract.

### Tests run

- `ruff format .` and `ruff check .` — pass.
- `pytest -q` — 9 passed.
- `npm run lint` — pass.
- `npm run build` — pass.
- Live API demo path — expected first run, human Advance, scheduling continuation, and zero-action duplicate run.

### Known issues

- CL-004 remains: the current API truthfully reports `deterministic_local`; Strands is not connected yet.
- Frontend interaction tests and browser-level end-to-end coverage remain.
- Generated web dependencies currently report 11 npm audit findings; no force-upgrade was applied.
- WebMCP source is present but was not contract-tested in a supported WebMCP browser context.

### Recommended next step

- Implement the Strands adapter over the existing narrow tools with a test model/provider, then add one frontend end-to-end test for the full demo path.

### Important assumptions

- AWS credentials, Bedrock model selection, AgentCore packaging, and deployment are intentionally deferred per human instruction.
