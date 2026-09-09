# Codex Round 2 handoff

Branch: `agent/codex-round2`

## Outcome

- Validated the merged CandidateLoop backend and complete API demo sequence.
- Strengthened real Strands SDK verification: the scripted model is presented the exact registered
  tool schemas and system policy, every active candidate must be handled, and partial state is
  rolled back if a configured Strands run fails or stops early.
- Preserved `deterministic_local` as the default and verified failed Strands runs return HTTP 502
  without fallback.
- Restored production CORS using exact origins from `CORS_ORIGINS`; allowed methods remain GET/POST
  and the configured request header remains Content-Type. Wildcard origins are rejected.
- Verified both the operational class and actual Strands registry/schema cannot Advance, Hold,
  Reject, hire, rank, score, or resolve a decision.

## Behavioral coverage

- Missing feedback sends one reminder.
- A recent reminder suppresses a duplicate, including parallel and repeated model calls.
- A stale candidate receives the fixed neutral status update.
- Complete feedback creates a human decision without changing candidate stage.
- A no-action candidate receives no communication, decision, or scheduling write.
- Human Advance through the API unlocks scheduling for the next agent pass.
- A rerun performs zero operational writes and records four no-action results.

## Validation

- `apps/agent/.venv/bin/ruff format --check .` — pass.
- `apps/agent/.venv/bin/ruff check .` — pass.
- `apps/agent/.venv/bin/pytest -q` — 33 passed; one upstream Starlette/AnyIO warning on Python 3.14.
- `apps/agent/.venv/bin/pip check` — pass.
- Python compileall and wheel build/package-content check — pass.
- `./scripts/smoke_test.sh` — pass, including backend API startup and frontend lint/build.
- Real HTTP demo sequence on a temporary local API — pass: reset, 3-action first pass, human
  Advance, 1 scheduling action, then 0-action duplicate-safe rerun.
- Credential-pattern scan and `git diff --check` — pass.

## Live Bedrock status

Not run because this environment has no AWS CLI, AWS credential variables/profile files,
`AWS_REGION`, or `CANDIDATELOOP_MODEL_ID`. The exact one-invocation command and required credential
options are documented in `apps/agent/README.md`. The smoke entry point is
`apps/agent/scripts/bedrock_smoke.py`; it refuses deterministic mode and exits nonzero unless the
safe four-candidate outcome is observed.

## Recommended integration order

1. Integrate `agent/codex-round2` so the runtime contract and backend regression gates land first.
2. Integrate frontend-only Round 2 changes and resolve documentation wording in favor of the final
   combined runtime behavior.
3. Integrate deployment/QA changes last, then rerun `./scripts/smoke_test.sh` and the live Bedrock
   command when credentials/model access are available.

Do not merge this branch automatically.
