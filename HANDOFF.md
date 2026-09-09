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

## 2026-09-09 — CODEX — CL-004/CL-012/CL-013 Round 2

### Completed

- Required every Strands pass to enumerate and handle all active candidates; incomplete or failed
  passes now roll back partial state and return an error without changing execution mode.
- Verified the actual Strands tool schemas expose only the nine allowlisted coordination tools and
  no Advance, Hold, Reject, hire, rank, score, or decision-resolution capability.
- Added full behavioral/API coverage and restored exact-origin production CORS from
  `CORS_ORIGINS` with GET/POST and Content-Type restrictions.
- Added a fail-closed one-invocation Bedrock smoke script and exact environment documentation.

### Files changed

- Agent runtime, repository transaction support, API CORS/error handling, tests, and live smoke
  script under `apps/agent/`.
- Runtime documentation in `.env.example`, `README.md`, and `docs/deployment.md`.
- `TASKS.md` and Round 2 handoff records.

### Tests run

- Backend Ruff format/check, 33 pytest tests, `pip check`, compileall, wheel/package-content check.
- `./scripts/smoke_test.sh` including live local API startup plus frontend lint/build.
- Full deterministic API path over HTTP: reset, run, human Advance, schedule, duplicate-safe rerun.
- Credential-pattern scan and `git diff --check`.

### Known issues

- Live Bedrock was not invoked: no AWS CLI, boto3-compatible credentials/profile, region, or model
  ID is available in this environment. Run the documented `apps/agent/scripts/bedrock_smoke.py`
  command once account/model access is supplied.
- Tests emit one upstream Starlette/AnyIO deprecation warning under Python 3.14.

### Recommended next step

- Integrate this runtime branch first, then frontend-only Round 2 work, and run deployment/QA work
  last so it validates the final combined tree. Do not merge this branch automatically.

### Important assumptions

- `deterministic_local` remains the intentional local/test/demo default; production Strands mode
  must fail visibly rather than substitute deterministic behavior.
