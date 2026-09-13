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

## 2026-09-12 — CODEX — Milestone A Dynamic Candidate Management

### Completed

- Added strict create/update/delete candidate APIs with server-generated identity and decision-state exclusion.
- Synchronized requested feedback counts to real repository Feedback records used by deterministic and Strands runs.
- Added candidate rail create/edit/remove dialogs and pending-decision deletion protection.
- Covered dynamic reminders, decision escalation, no-action outcomes, five-candidate runs, idempotency, cleanup, and reset.

### Files changed

- Candidate models, in-memory repository, FastAPI routes/CORS, Strands completion validation, and backend tests.
- Web candidate types/state, rail controls, management dialogs, page wiring, and run-console busy state.

### Tests run

- `ruff format --check .`, `ruff check .`, and `pytest -q` — 76 passed.
- `npm run lint` and `npm run build` — pass.
- `git diff --check` — pass.

### Known issues

- State remains intentionally in-memory; reset removes all user-created candidates.
- The existing upstream Starlette/AnyIO deprecation warning remains under Python 3.14.

### Recommended next step

- Review the uncommitted Milestone A diff and exercise the add/edit/remove flow against a local API.

### Important assumptions

- Non-null `next_interview_at` remains blocked until a recorded human Advance exists; the UI does not expose it.
- Generated submitted feedback records represent completion only and contain no recommendation or judgment.

## 2026-09-12 — CODEX — Milestone A Hardening

### Completed

- Restricted candidate-management request stages to Recruiter Review, Technical Interview, and Interview Complete.
- Made candidate create/update plus feedback synchronization atomic under the repository lock with rollback on failure.
- Preserved decision-driven and scheduling-tool stage transitions and locked workflow-controlled stages in the edit UI.

### Files changed

- Candidate request models, repository mutation methods, CRUD route calls, candidate form stage choices, and focused tests.

### Tests run

- `ruff format --check .`, `ruff check .`, and `pytest -q` — 90 passed.
- `npm run lint`, `npm run build`, and `git diff --check` — pass.

### Known issues

- The existing upstream Starlette/AnyIO deprecation warning remains under Python 3.14.

### Recommended next step

- Review the still-uncommitted Milestone A diff before committing.

### Important assumptions

- Metadata edits remain allowed after a workflow-controlled transition, but PATCH must omit the protected stage.

## 2026-09-12 — CODEX — Deterministic CandidateLoop Dates

### Completed

- Replaced combined locale-generated date/time strings with explicit `en-US`/UTC parts and manually inserted punctuation.
- Audited every SSR-visible CandidateLoop date display; all use the shared deterministic helpers.

### Files changed

- `apps/web/lib/candidateloop/format.ts`.

### Tests run

- `npm run lint` and `npm run build` — pass.
- Direct formatter check confirms `2026-09-09T14:00:00Z` renders as `Wed, Sep 9 · 2:00 PM`.

### Known issues

- No first-party frontend test runner or unit-test suite is configured; lint, production build, and a direct runtime check cover this focused change.

## 2026-09-12 — CODEX — CandidateLoop Design Integration

### Completed

- Recreated the supplied compact three-rail operations layout with a neutral visual system, real backend pipeline stages, compact run status, selected-candidate activity, and a responsive decision rail.
- Moved Add/Edit/Remove into the requested rail and selected-candidate controls while reusing the existing candidate-management dialogs and API mutations.
- Kept operational explanations collapsed by default and removed the runtime chip, idle banner, metrics grid, and human-control explainer card.

### Files changed

- Web page shell, global theme, candidate rail/detail, activity feed, decision queue, and run console under `apps/web/`.
- `HANDOFF.md`.

### Tests run

- `npm run lint` and `npm run build` — pass.
- Deterministic focused backend API/candidate-management tests — 38 passed.
- `git diff --check` — pass.

### Known issues

- The existing upstream Starlette/AnyIO deprecation warning remains under Python 3.14.

### Recommended next step

- Exercise the compact layout at demo viewport sizes against a running local API.

### Important assumptions

- The prototype supplies presentation only; all workflow state, actions, decisions, and candidate mutations continue to come from the existing hook and FastAPI backend.

## 2026-09-12 — CLAUDE — Dark Agent-Visible Workspace

### Completed

- Converted the cockpit to a single committed dark operations theme with semantic accents (agent, waiting, success, danger) and fixed the sans font being applied above the element that defines it.
- Added an agent console in the control rail built strictly on `POST /api/agent/run`: fixed supported instruction, live "reviewing N active candidates" state with a measured timer, and a post-run report from the real summary counts and returned events with per-candidate navigation.
- Reframed Human Decisions around "CandidateLoop paused here" with Advance/Hold/Reject unchanged, plus a resolved-by-you history from real decision records.
- Reordered narrow layouts to candidate → agent → decisions → activity via grid areas; the candidate rail becomes a horizontal strip below `lg`.

### Files changed

- `apps/web/app/{globals.css,layout.tsx,page.tsx}`, `apps/web/components/candidateloop/*`, `apps/web/lib/candidateloop/{format.ts,use-candidateloop.ts}`; `run-console.tsx` replaced by `agent-console.tsx`.

### Tests run

- `oxfmt --check`, `oxlint`, `tsc --noEmit`, and `npm run build` — pass.
- Browser QA against the local API: full demo path (run → Advance → schedule → duplicate-safe rerun), candidate add/edit/remove, reset, reload rehydration, failure/retry, 1440px and 390px layouts, no internal ids or provider strings in the DOM.

### Known issues

- The console cannot accept free-form instructions because the backend exposes no conversational endpoint; it echoes the one supported instruction instead.
- Backend untouched; no HANDOFF changes to safety, scheduling, or decision semantics.

## 2026-09-13 — CODEX — CandidateLoop Logo

### Completed

- Added the supplied CandidateLoop mark to the existing header and configured it as the standard and Apple browser icon.
- Preserved the existing title, subtitle, theme, header wrapping, and application behavior.

### Files changed

- `apps/web/app/page.tsx`, `apps/web/app/layout.tsx`, and `apps/web/public/candidateloop-logo.png`.

### Tests run

- `npm run format`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` — pass.
- Local Chrome QA at 1440px, 768px, and 390px; rendered icon metadata and PNG response verified.

### Known issues

- Vinext build continues to emit its existing Node `module.register()` deprecation warning.

### Recommended next step

- Review the uncommitted logo/favicon diff before committing.

### Important assumptions

- The checkerboard in the supplied JPEG was a baked-in background, so the mark was extracted to a transparent PNG for production use.
