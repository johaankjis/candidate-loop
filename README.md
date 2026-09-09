# CandidateLoop

CandidateLoop is a recruiting operations agent that handles routine coordination between hiring
decisions. It inspects synthetic candidate workflows, chases missing feedback, sends neutral status
updates, schedules approved next steps, and stops when recruiter judgment is required.

## Current milestone

The repository includes a complete local deterministic workflow, operations cockpit, and a real
Strands Agents SDK execution path for Amazon Bedrock. `deterministic_local` remains the explicit
default for reproducible local development, tests, and demos; setting the documented runtime
environment switches to `strands_bedrock` without silently falling back after a model failure.

Hiring decisions are structurally separated: the operational tool surface has no Advance, Hold,
Reject, hire, rank, or score function. A recruiter resolves a decision through the human-facing
API, and only an explicit Advance permits the next run to schedule an interview.

## Run locally

The backend requires Python 3.11+ and the web app requires Node 22+.

```bash
cd apps/agent
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/uvicorn api.main:app --reload
```

In a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`. API docs are available at `http://localhost:8000/docs`.

## Verify

```bash
cd apps/agent
.venv/bin/ruff check .
.venv/bin/pytest -q

cd ../web
npm run lint
npm run build
```

For the exact live Bedrock smoke-test command and required environment variables, see the
[agent service README](apps/agent/README.md#live-amazon-bedrock-smoke-test).

## Local demo path

1. Reset the demo to restore Sarah, David, Emily, and Marcus.
2. Run the local agent workflow.
3. Observe a feedback reminder for Sarah and a neutral candidate update for David.
4. Observe that Emily is escalated for human judgment and Marcus requires no action.
5. Advance Emily as the recruiter.
6. Run again to schedule the earliest shared panel slot.
7. Run once more and verify that no duplicate message or decision is created.

## Architecture

`apps/web` contains the Vinext/React operations cockpit. `apps/agent` contains FastAPI, the domain
models, deterministic repository, safety policies, narrow recruiting tools, and both deterministic
and Strands runners. The Strands registry exposes coordination tools only; Advance, Hold, and
Reject remain exclusive to the human-facing API. AWS credentials and deployment are deliberately
excluded from the repository.
