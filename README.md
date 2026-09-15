# CandidateLoop

CandidateLoop is a recruiting operations agent that handles routine coordination between hiring
decisions. It inspects synthetic candidate workflows, chases missing feedback, sends neutral status
updates, schedules approved next steps, and stops when recruiter judgment is required.

![CandidateLoop operations cockpit](apps/web/public/candidateloop-logo.png)

## What it does

- Runs an agent pass over all active candidates and emits structured action events.
- Chases overdue interviewer feedback with a single reminder per open slot.
- Sends a neutral candidate status update when a pipeline stage goes quiet.
- Escalates to a human decision queue when the workflow cannot continue without Advance/Hold/Reject.
- Schedules the earliest shared panel slot once a recruiter records an Advance.
- Skips any candidate that requires no action and never creates duplicate messages or decisions.

Hiring decisions are structurally separated: the agent's tool surface exposes no Advance, Hold,
Reject, hire, rank, or score function. A recruiter resolves decisions through the human-facing API,
and only an explicit Advance permits the next run to schedule an interview.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic v2 |
| Agent runtime | [Strands Agents SDK](https://strandsagents.com) (Amazon Bedrock or OpenRouter) with a deterministic local fallback |
| Frontend | Next.js 15, React 19, Tailwind CSS v4, dark operations theme |

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

`deterministic_local` is the default execution mode — no AWS credentials or model access needed.

## Execution modes

| Mode | How to activate |
|---|---|
| `deterministic_local` | Default — no environment variables required |
| `strands_bedrock` | Set `CANDIDATELOOP_EXECUTION_MODE=strands` and `CANDIDATELOOP_MODEL_PROVIDER=bedrock` plus AWS credentials |
| `strands_openrouter` | Set `CANDIDATELOOP_EXECUTION_MODE=strands`, `CANDIDATELOOP_MODEL_PROVIDER=openrouter`, and `OPENROUTER_API_KEY` |

See `.env.example` for the full variable list and the
[agent service README](apps/agent/README.md#live-amazon-bedrock-smoke-test) for the exact
live smoke-test commands.

Setting an unsupported provider or a failed model pass returns an error — there is no silent
fallback to the deterministic runner.

## Verify

```bash
cd apps/agent
.venv/bin/ruff format --check .
.venv/bin/ruff check .
.venv/bin/pytest -q

cd ../web
npm run lint
npm run build
```

## Local demo path

1. Open the cockpit at `http://localhost:3000`.
2. Click **Reset Demo** to restore the four synthetic candidates: Sarah, David, Emily, and Marcus.
3. Click **Run Agent** in the Agent Console rail.
4. Observe a feedback reminder for Sarah and a neutral status update for David.
5. Observe that Emily is escalated to the Human Decisions queue and Marcus receives no action.
6. Record an **Advance** decision for Emily.
7. Run the agent again — it schedules the earliest shared panel slot for Emily.
8. Run once more and verify that no duplicate message or decision is created.

You can also add, edit, or remove candidates at any time using the controls in the Candidates rail.
Workflow-controlled stages (Panel Scheduling, Panel Interview, On Hold, Closed) are locked in the
edit form.

## Architecture

```
apps/
  agent/            FastAPI service
    api/            HTTP routes + CORS
    candidateloop/  Domain models, in-memory repository, safety policies,
                    recruiting tools, deterministic runner, Strands runner
    scripts/        Live Bedrock and OpenRouter smoke tests
    tests/          pytest suite (90+ tests)
  web/              Next.js operations cockpit
    app/            Dark theme, layout, root page
    components/
      candidateloop/  Candidate rail, agent console, decision queue,
                      activity feed, candidate detail, management dialogs
    lib/candidateloop/ API hooks and date formatting helpers
```

The Strands tool registry exposes nine coordination-only tools. Advance, Hold, and Reject are
exclusive to the human-facing API. AWS credentials can be provided via the local environment or an
IAM Task Role when deployed.
