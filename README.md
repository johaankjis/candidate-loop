# CandidateLoop

CandidateLoop is a recruiting operations agent that handles routine coordination between hiring
decisions. It inspects synthetic candidate workflows, chases missing feedback, sends neutral status
updates, schedules approved next steps, and stops when recruiter judgment is required.

## Current milestone

The repository currently includes a complete local deterministic workflow and operations cockpit.
It intentionally reports `deterministic_local` as its execution mode. This makes the safety policy,
tools, state transitions, API contract, and demo path testable before the Strands model runtime and
AWS deployment are connected.

Hiring decisions are structurally separated: the operational tool surface has no advance, reject,
hire, or rank function. A recruiter resolves a decision through the human-facing API, and only an
explicit Advance permits the next run to schedule an interview.

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
models, deterministic repository, safety policies, narrow recruiting tools, and tests. The later
Strands adapter will consume the same tool layer; AWS credentials and deployment configuration are
deliberately excluded for now.

