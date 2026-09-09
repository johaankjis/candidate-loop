# Codex handoff — CL-004

## Completed work

- Added a real Strands `Agent` execution path selected by environment configuration, with Amazon
  Bedrock as the supported production provider.
- Preserved `deterministic_local` as the default local/test/demo fallback and kept execution-mode
  reporting truthful without silent fallback.
- Wrapped the existing `RecruitingTools` with nine allowlisted, typed Strands tools and a sequential
  executor. No hiring disposition, ranking, or scoring tool is registered.
- Kept duplicate prevention and policy validation inside the operational write tools, including
  protection from out-of-order or same-turn model calls.
- Preserved the structural human-only Advance/Hold/Reject API boundary and verified Strands
  scheduling only becomes possible after human Advance.
- Added no-network scripted-model coverage that runs through the real Strands agent loop.

## Files changed

- `apps/agent/candidateloop/strands_runner.py`
- `apps/agent/candidateloop/strands_tools.py`
- `apps/agent/candidateloop/config.py`
- `apps/agent/candidateloop/runner.py`
- `apps/agent/candidateloop/tools.py`
- `apps/agent/candidateloop/prompts/system.md`
- `apps/agent/api/main.py`
- `apps/agent/pyproject.toml`
- `apps/agent/README.md`
- `apps/agent/tests/`

## Tests run

- `.venv/bin/ruff format .` — pass.
- `.venv/bin/ruff format --check .` — pass.
- `.venv/bin/ruff check .` — pass.
- `.venv/bin/pytest -q` — 25 passed.
- `.venv/bin/pip check` — pass.
- `.venv/bin/python -m compileall -q api candidateloop tests` — pass.
- Built the wheel with `pip wheel --no-deps .`; verified the packaged wheel contains
  `candidateloop/prompts/system.md`.
- `git diff --check` and scoped credential-pattern scan — pass.

## Known issues

- A live Bedrock invocation was not run because no AWS credentials/model access were available.
  It requires boto3-compatible AWS credentials plus access to `CANDIDATELOOP_MODEL_ID` in the
  configured region.
- Tests emit one upstream Starlette/AnyIO deprecation warning under Python 3.14.
- Root-level public README and `.env.example` still describe Strands as a later milestone; they were
  left unchanged to stay within this round's `apps/agent/**` ownership.

## Commit SHA

- Implementation: `619233aa97ca004a8d4f4bdea163111f7ffc0c1e`

## Recommended next step

- Run one Bedrock smoke test with an enabled tool-capable model, then let the documentation owner
  update the root README/environment example and complete CL-013 end-to-end verification.
