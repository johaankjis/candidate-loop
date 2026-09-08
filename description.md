# CandidateLoop — Multi-Agent Build Harness

> **Project:** CandidateLoop  
> **Hackathon:** Agents for Humans Hackathon 2026  
> **Track:** Professional Agents  
> **Primary framework:** Strands Agents SDK  
> **Target submission:** September 14, 2026  
> **Coding agents:** Claude Code, OpenAI Codex, Antigravity  
> **Status:** New hackathon project; build from scratch

---

## 0. Purpose of This File

This document is the **single source of truth for all coding agents working on CandidateLoop**.

Before changing code, every coding agent MUST:

1. Read this file completely.
2. Read `TASKS.md`.
3. Read `HANDOFF.md`.
4. Inspect the existing repository before creating new abstractions.
5. Work only on an unclaimed task or a task explicitly assigned by the human.
6. Run the relevant tests before declaring work complete.
7. Update `HANDOFF.md` after meaningful work.
8. Never silently redesign the architecture.

When instructions conflict, priority is:

1. Direct human instruction
2. This file
3. `TASKS.md`
4. `HANDOFF.md`
5. Existing implementation conventions
6. Agent preference

The objective is **not to build the most elaborate recruiting platform possible**. The objective is to submit a polished, believable, technically agentic hackathon project with an excellent five-minute demo.

---

# 1. Product Vision

## One-line pitch

**CandidateLoop is an autonomous recruiting operations agent that handles the repetitive work between hiring decisions and only interrupts recruiters when human judgment is actually required.**

## Problem

Recruiters repeatedly spend time:

- checking which candidates are stuck in a stage,
- chasing interviewers for feedback,
- following up with candidates,
- coordinating interviews,
- checking whether required information has arrived,
- preparing status summaries,
- determining which candidate needs attention next.

These tasks are important but often administrative.

CandidateLoop handles the operational loop while leaving consequential hiring decisions to humans.

## Core principle

> **Automate coordination, not hiring judgment.**

CandidateLoop MUST NOT autonomously decide whether a candidate should be hired, rejected, or advanced based on candidate quality.

It MAY:

- detect missing feedback,
- detect a stalled workflow,
- detect scheduling conflicts,
- prepare evidence summaries,
- draft/send simulated reminders,
- propose next operational actions,
- schedule simulated interviews,
- surface a recruiter decision.

It MUST require human action for:

- Advance
- Reject
- Hold
- any other consequential hiring disposition

---

# 2. Hackathon Goal

The demo should prove that CandidateLoop is an **agent**, not a chatbot wrapper.

The system must visibly demonstrate this loop:

```text
OBSERVE
   ↓
REASON
   ↓
SELECT TOOL
   ↓
TAKE ACTION
   ↓
OBSERVE RESULT
   ↓
CONTINUE AUTONOMOUSLY
   ↓
STOP ONLY WHEN DONE OR HUMAN JUDGMENT IS REQUIRED
```

The demo should show multiple tool calls and state changes from one agent run.

Example:

```text
CandidateLoop scans recruiting state
        ↓
Finds Sarah's interview is complete
        ↓
Finds one missing interviewer scorecard
        ↓
Sends simulated reminder
        ↓
Records action in activity log
        ↓
Checks another candidate
        ↓
Detects candidate stalled for 5 days
        ↓
Sends simulated candidate update
        ↓
Checks another candidate
        ↓
All feedback complete
        ↓
Creates evidence summary
        ↓
Raises HUMAN DECISION REQUIRED
```

That is the central experience.

---

# 3. Target User

Primary user:

**Recruiter / Talent Acquisition professional managing multiple candidates simultaneously.**

Secondary users:

- recruiting coordinators,
- hiring managers,
- small recruiting teams without extensive automation.

The demo should use the recruiter perspective.

---

# 4. MVP Scope

CandidateLoop v1 only needs five operational abilities.

## Capability 1 — Scan candidates

Agent can inspect all active synthetic candidate records.

It should identify:

- current stage,
- how long the candidate has been in the stage,
- interview status,
- outstanding feedback,
- most recent candidate communication,
- scheduled events,
- whether human judgment is required.

## Capability 2 — Chase interview feedback

If an interview is complete and scorecards are missing, the agent may send a **simulated feedback reminder**.

The action must update system state and appear in the activity feed.

## Capability 3 — Candidate follow-up

If a candidate has been waiting beyond a configured threshold without communication, the agent may send a **simulated status update**.

Do not invent a hiring decision.

Safe example:

> "Hi David — your application is still under review. We haven't forgotten about you and we'll share an update as soon as one is available."

Unsafe example:

> "You're likely moving to the next round."

## Capability 4 — Scheduling

When a candidate has already been explicitly advanced by a human and requires another interview, CandidateLoop may:

- inspect synthetic interviewer availability,
- identify valid slots,
- propose or schedule a simulated interview according to configured policy.

For MVP, scheduling can be deterministic.

## Capability 5 — Human decision queue

When all operational prerequisites are complete but a hiring judgment is required, the agent must stop autonomous processing for that candidate and create:

```text
HUMAN DECISION REQUIRED
Candidate: Emily Jones
Role: Senior Software Engineer
Reason: Interview feedback complete
Evidence: 4/4 scorecards received
Actions: Advance | Hold | Reject
```

The actual decision comes from the human through the UI.

---

# 5. Explicit Non-Goals

Do NOT spend hackathon time building:

- real Workday integration,
- real Gmail integration,
- real LinkedIn scraping,
- resume truth verification,
- candidate ranking,
- candidate scoring,
- personality inference,
- protected-class inference,
- compensation negotiation,
- offer generation,
- a generalized ATS,
- sophisticated authentication,
- enterprise RBAC,
- a large multi-agent swarm,
- production-scale event infrastructure.

Use realistic **synthetic data and simulated tools**.

A smaller end-to-end agent is better than a large incomplete platform.

---

# 6. Demo Story

The seeded demo dataset must create obvious agent behavior.

## Candidate A — Sarah Chen

```text
Role: Senior Software Engineer
Stage: Technical Interview
Interview: completed yesterday
Scorecards: 3 of 4 complete
Missing reviewer: Alex Morgan
Last reminder: none
```

Expected autonomous action:

```text
Send feedback reminder to Alex Morgan
```

---

## Candidate B — David Park

```text
Role: Product Manager
Stage: Recruiter Review
Days in stage: 5
Last candidate communication: 5 days ago
Human hiring decision: not yet possible/required
```

Expected autonomous action:

```text
Send safe candidate status update
```

---

## Candidate C — Emily Jones

```text
Role: Senior Software Engineer
Stage: Interview Complete
Scorecards: 4 of 4 complete
Operational prerequisites: complete
```

Expected agent behavior:

```text
Create evidence summary
Raise HUMAN DECISION REQUIRED
Do not advance/reject automatically
```

Human clicks:

```text
Advance
```

Then CandidateLoop can continue the operational workflow:

```text
Check panel availability
Find matching slot
Schedule next interview
Log action
```

---

## Candidate D — Marcus Reed

```text
Role: Data Engineer
Interview: tomorrow
Everything ready
```

Expected action:

```text
No action required
```

This candidate demonstrates that the agent can correctly choose to do nothing.

---

# 7. Demo UX

The main screen should be an **operations cockpit**, not a chat interface.

Recommended layout:

```text
┌───────────────────────────────────────────────────────────────────┐
│ CandidateLoop                                   Run Agent ▶       │
├─────────────────┬─────────────────────────────────────────────────┤
│                 │                                                 │
│ Active          │ Agent Activity                                  │
│ Candidates      │                                                 │
│                 │ ✓ Scanned 4 candidates                          │
│ Sarah Chen      │ → Sarah: missing scorecard                      │
│ David Park      │ ✓ Reminder sent to Alex Morgan                  │
│ Emily Jones     │ → David: candidate waiting 5 days               │
│ Marcus Reed     │ ✓ Status update sent                            │
│                 │ → Emily: all prerequisites complete             │
│                 │ ⚠ Human decision required                      │
│                 │ ✓ Marcus: no action needed                      │
│                 │                                                 │
├─────────────────┴─────────────────────────────────────────────────┤
│ Human Decisions                                                   │
│                                                                   │
│ Emily Jones — Interview feedback complete                         │
│ [Advance] [Hold] [Reject]                                         │
└───────────────────────────────────────────────────────────────────┘
```

Additional useful UI:

- candidate detail drawer,
- timeline,
- tool-call activity,
- "why this action?" explanation,
- human decision cards,
- simple metrics:
  - candidates scanned,
  - actions handled,
  - reminders sent,
  - decisions escalated,
  - estimated recruiter touches saved.

Do not overbuild dashboards.

---

# 8. Agent Experience Requirements

Every autonomous action shown in the UI should have four pieces:

```text
Observed
Reason
Action
Result
```

Example:

```text
Observed
Sarah's technical interview ended yesterday.
Only 3 of 4 scorecards are complete.

Reason
Candidate cannot become decision-ready until all required feedback arrives.

Action
Sent a feedback reminder to Alex Morgan.

Result
Reminder recorded successfully.
```

This makes agent reasoning legible without exposing hidden chain-of-thought.

Use concise operational explanations, not private internal reasoning.

---

# 9. Architecture

Prefer a simple two-application architecture.

```text
┌───────────────────────────────┐
│         Next.js UI            │
│                               │
│ Candidate list                │
│ Agent activity                │
│ Decision queue                │
│ Candidate drawer              │
└───────────────┬───────────────┘
                │ HTTP / SSE
                ▼
┌───────────────────────────────┐
│       FastAPI Backend         │
│                               │
│ REST endpoints                │
│ Agent runner                  │
│ State/repositories            │
│ Event stream                  │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│     Strands Agents SDK        │
│                               │
│ CandidateLoop Agent           │
│ + custom tools                │
└───────────────┬───────────────┘
                │
       ┌────────┼─────────┐
       ▼        ▼         ▼
     ATS      Email    Calendar
     Tool      Tool       Tool
       │        │         │
       └────────┼─────────┘
                ▼
       Synthetic Repository
```

For MVP, repository state may be:

- in-memory with reset endpoint, or
- SQLite.

Prefer SQLite only if persistence is useful and does not slow implementation.

The entire demo must be resettable to a deterministic initial state.

---

# 10. Recommended Tech Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui or simple accessible components
- Lucide icons
- native `fetch`
- SSE if streaming is straightforward

Do not add Redux unless genuinely necessary.

## Backend

- Python 3.11+
- FastAPI
- Pydantic
- Strands Agents SDK
- Uvicorn
- pytest

## Agent/model

Primary:

- Strands Agents SDK
- Amazon Bedrock model provider

Keep model selection configurable using environment variables.

Example environment concept:

```text
AWS_REGION=
CANDIDATELOOP_MODEL_ID=
```

Never commit AWS credentials.

## Deployment

Preferred hackathon path:

- Frontend: Vercel or AWS-hosted equivalent
- Agent/backend: Amazon Bedrock AgentCore Runtime if practical

Fallback:

- deploy backend using another simple AWS runtime while retaining Strands as the required agent framework.

The local demo MUST work even before cloud deployment.

---

# 11. Why Strands Is Central

CandidateLoop must genuinely use Strands for the agent loop.

Do not implement a deterministic Python workflow and merely call an LLM for summaries.

Use Strands to decide which safe operational tool to invoke based on observed state.

At minimum the Strands agent should have custom tools representing:

1. candidate/ATS inspection,
2. feedback inspection,
3. communications,
4. availability/scheduling,
5. decision escalation.

The application may impose deterministic safety rules around tool execution.

---

# 12. Strands Tool Contract

Tools should be narrow, strongly typed, testable, and have descriptive docstrings.

Suggested tool set:

```python
get_active_candidates()
get_candidate(candidate_id)
get_interview_feedback(candidate_id)
get_interviewer_availability(candidate_id)
send_feedback_reminder(candidate_id, interviewer_id)
send_candidate_status_update(candidate_id)
schedule_interview(candidate_id, slot_id)
create_human_decision(candidate_id, reason, evidence)
record_agent_note(candidate_id, message)
```

Optional:

```python
get_open_human_decisions()
get_recent_actions(candidate_id)
```

Avoid a generic tool like:

```python
execute_action(action: str, payload: dict)
```

Narrow tools are easier to reason about, test, and demo.

---

# 13. Tool Safety Rules

## Read tools

May execute autonomously.

Examples:

- inspect candidate,
- inspect feedback,
- inspect availability,
- inspect action history.

## Low-risk simulated write tools

May execute autonomously during hackathon demo:

- send simulated feedback reminder,
- send safe simulated candidate status update,
- record agent note.

## Scheduling

May execute only when candidate stage/state explicitly permits scheduling.

## Hiring dispositions

NEVER expose an autonomous tool such as:

```python
reject_candidate()
advance_candidate()
hire_candidate()
```

Human-facing API endpoints may record these decisions, but the Strands agent may not invoke them autonomously.

This separation should be visible in the architecture and README.

---

# 14. Agent System Behavior

The CandidateLoop agent should follow an operating policy similar to:

```text
You are CandidateLoop, a recruiting operations agent.

Your job is to reduce repetitive recruiting coordination work.

You may inspect recruiting state and autonomously perform low-risk
operational actions using the tools you are given.

You must never make a consequential hiring judgment.

You may not decide candidate quality, ranking, suitability, rejection,
advancement, hiring, or compensation.

When operational prerequisites are complete and a hiring judgment is
required, use the human-decision mechanism.

Process all active candidates. For each candidate:

1. Inspect current state.
2. Determine whether an operational action is necessary.
3. Use available tools when a safe action is warranted.
4. Do nothing when no action is warranted.
5. Escalate when human judgment is required.
6. Avoid duplicate reminders or duplicate scheduling.
7. Do not claim an action succeeded unless the tool confirms success.

Finish with a concise run summary.
```

Keep the actual system prompt in source control, likely:

```text
apps/agent/candidateloop/prompts/system.md
```

---

# 15. State Model

Suggested entities.

## Candidate

```text
id
name
role
stage
stage_entered_at
status
last_candidate_contact_at
next_interview_at
required_feedback_count
human_decision_status
```

## Interviewer

```text
id
name
email
role
```

## Feedback

```text
id
candidate_id
interviewer_id
interview_id
status
submitted_at
recommendation
summary
```

`recommendation` is synthetic evidence for the human; the agent must not convert it into a hiring decision.

## AvailabilitySlot

```text
id
interviewer_id
start_at
end_at
available
```

## Communication

```text
id
candidate_id
recipient_type
recipient_id
type
subject
body
created_at
status
```

## HumanDecision

```text
id
candidate_id
decision_type
reason
evidence
status
created_at
resolved_at
resolution
```

## AgentAction

```text
id
run_id
candidate_id
tool
observed
reason
action
result
created_at
```

---

# 16. API Contract

Recommended minimum endpoints.

```text
GET  /health
GET  /api/candidates
GET  /api/candidates/{id}
GET  /api/actions
GET  /api/decisions

POST /api/agent/run
POST /api/decisions/{id}/resolve
POST /api/demo/reset
```

Optional:

```text
GET /api/agent/runs/{run_id}
GET /api/agent/runs/{run_id}/events
```

If streaming is implemented:

```text
POST /api/agent/run
GET  /api/agent/runs/{run_id}/events
```

Use Server-Sent Events unless WebSockets clearly provide additional value.

---

# 17. Deterministic Demo Reset

Implement:

```text
POST /api/demo/reset
```

This MUST restore the exact demo scenario.

The demo should never depend on manually editing data before recording.

Also provide a UI control in development/demo builds:

```text
Reset Demo
```

Potential confirmation:

```text
Reset CandidateLoop to the seeded hackathon scenario?
```

---

# 18. Suggested Repository Structure

```text
candidateloop/
│
├── README.md
├── AGENTS.md
├── CANDIDATELOOP_BUILD_HARNESS.md   ← this file
├── TASKS.md
├── HANDOFF.md
├── DEMO_SCRIPT.md
├── .env.example
├── .gitignore
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── types/
│   │   └── tests/
│   │
│   └── agent/
│       ├── candidateloop/
│       │   ├── agent.py
│       │   ├── config.py
│       │   ├── policies.py
│       │   ├── models.py
│       │   ├── repository.py
│       │   ├── seed.py
│       │   ├── prompts/
│       │   │   └── system.md
│       │   └── tools/
│       │       ├── ats.py
│       │       ├── communications.py
│       │       ├── calendar.py
│       │       └── decisions.py
│       │
│       ├── api/
│       │   ├── main.py
│       │   ├── candidates.py
│       │   ├── agent_runs.py
│       │   ├── decisions.py
│       │   └── demo.py
│       │
│       └── tests/
│
├── docs/
│   ├── architecture.md
│   ├── safety.md
│   └── judging.md
│
└── scripts/
    ├── dev.sh
    ├── test.sh
    └── seed_demo.py
```

Do not create empty architecture layers just to match this tree. Create directories when they become useful.

---

# 19. Multi-Agent Coding Harness

Claude Code, Codex, and Antigravity may all work on this repository.

The main risk is conflicting edits and architecture drift.

Use the following protocol.

## `TASKS.md`

Every meaningful unit of work gets an ID.

Example:

```text
CL-001 Bootstrap backend
CL-002 Seed synthetic recruiting data
CL-003 Implement Strands tools
CL-004 Implement CandidateLoop agent
CL-005 Agent API
CL-006 Web shell
CL-007 Activity feed
CL-008 Human decision queue
CL-009 Agent run integration
CL-010 Demo reset
CL-011 Tests
CL-012 AgentCore deployment
CL-013 README
CL-014 Demo video script
```

Statuses:

```text
TODO
CLAIMED:CLAUDE
CLAIMED:CODEX
CLAIMED:ANTIGRAVITY
BLOCKED
REVIEW
DONE
```

An agent should not modify another agent's claimed task without human instruction.

---

# 20. `HANDOFF.md` Protocol

After each meaningful work session, append:

```markdown
## YYYY-MM-DD — AGENT NAME — CL-XXX

### Completed
- ...

### Files changed
- ...

### Tests run
- ...

### Known issues
- ...

### Recommended next step
- ...

### Important assumptions
- ...
```

Do not write essays.

The handoff exists so another coding agent can safely continue.

---

# 21. Suggested Agent Ownership

This is the default split. The human may override it.

## Codex — backend + agent correctness

Primary ownership:

- Python backend
- Strands integration
- tools
- repository/state
- policies
- tests
- FastAPI
- integration debugging
- API contracts

Codex should prioritize correctness and executable tests.

---

## Claude Code — frontend + product UX

Primary ownership:

- Next.js
- visual hierarchy
- candidate list
- activity timeline
- decision cards
- candidate drawer
- run/reset interactions
- loading/error states
- demo polish
- accessibility

Claude Code should not invent backend APIs without checking the current contract.

---

## Antigravity — integration + QA + deployment

Primary ownership:

- architecture review
- integration testing
- API/frontend mismatches
- AWS packaging
- AgentCore deployment
- environment setup
- smoke tests
- README checks
- demo reliability
- technical-debt triage

Antigravity should prefer fixing integration gaps over redesigning working features.

---

# 22. Rules for All Coding Agents

## Rule A — inspect first

Before coding:

```text
git status
git log --oneline -10
inspect repository tree
read relevant implementation
read TASKS.md
read HANDOFF.md
```

Never assume a file is unchanged.

---

## Rule B — smallest coherent change

Do not refactor unrelated code.

Do not replace frameworks without explicit approval.

Do not introduce infrastructure merely because it is more "production-grade."

---

## Rule C — tests are part of implementation

Backend logic must have unit tests.

Critical expected scenarios:

1. missing feedback → reminder sent,
2. recent reminder → duplicate not sent,
3. stale candidate → safe status update,
4. completed feedback → human decision created,
5. decision-ready candidate → agent does not advance automatically,
6. no-action candidate → no unnecessary tool writes,
7. human advance → scheduling allowed,
8. demo reset → deterministic state.

---

## Rule D — do not fake agent behavior

The UI must not display hardcoded "agent reasoning" that was never produced by an actual agent run/tool result.

It is fine to transform structured execution events into concise UI copy.

---

## Rule E — no hidden magic

Business/safety thresholds belong in config or policy code.

Example:

```python
CANDIDATE_FOLLOWUP_AFTER_DAYS = 3
FEEDBACK_REMINDER_AFTER_HOURS = 24
FEEDBACK_REMINDER_COOLDOWN_HOURS = 24
```

---

## Rule F — idempotency

Repeated agent runs should not spam duplicate actions.

Tools should detect obvious duplicate actions.

Example:

```text
Already sent reminder to Alex within cooldown.
No action taken.
```

This is an important hackathon edge case.

---

## Rule G — deterministic demo first

Before adding advanced features:

```text
reset demo
run agent
observe expected actions
resolve Emily decision
run/continue workflow
see scheduled interview
```

must work reliably.

---

## Rule H — never leak secrets

Never commit:

- AWS keys,
- Bedrock credentials,
- tokens,
- `.env`,
- personal candidate information.

All demo people are synthetic.

---

# 23. Human-in-the-Loop Boundary

This is a major judging/demo feature.

The backend should encode the boundary structurally, not only in prompt text.

Recommended design:

```text
Strands tools:
    read candidate
    read feedback
    send reminder
    send candidate update
    inspect calendar
    schedule permitted interview
    create decision request

Human API:
    resolve decision: ADVANCE / HOLD / REJECT
```

The agent does NOT possess the human resolution endpoint as a tool.

This makes autonomous misuse materially harder.

---

# 24. Explainability Event Schema

Prefer structured events from the agent layer.

Example:

```json
{
  "candidate_id": "cand_sarah",
  "event_type": "tool_action",
  "observed": "Technical interview is complete; 3 of 4 required scorecards are submitted.",
  "reason": "One required scorecard is still missing.",
  "action": "Send feedback reminder to Alex Morgan.",
  "result": "Reminder sent successfully.",
  "tool": "send_feedback_reminder"
}
```

The frontend renders these fields.

Do not expose private chain-of-thought.

---

# 25. Run Summary

At the end of an agent run, produce structured summary data such as:

```json
{
  "candidates_scanned": 4,
  "actions_taken": 2,
  "reminders_sent": 1,
  "candidate_updates_sent": 1,
  "human_decisions_created": 1,
  "no_action_needed": 1
}
```

This powers the demo metrics.

---

# 26. Development Phases

## Phase 0 — repository skeleton

Definition of done:

- repo initializes,
- backend starts,
- frontend starts,
- `/health` works,
- synthetic data structure defined,
- README has dev commands.

---

## Phase 1 — deterministic operational backend

Definition of done:

- demo seed exists,
- candidates API works,
- safe tool functions work without LLM,
- actions are recorded,
- decisions are recorded,
- reset works,
- tests pass.

Important: tools may be called directly in tests.

---

## Phase 2 — Strands agent

Definition of done:

- actual Strands Agent is instantiated,
- custom tools are registered,
- one invocation processes demo candidates,
- expected safe actions occur,
- Emily becomes human-decision-required,
- agent does not make hiring decision,
- duplicate-run safety works.

This is the core hackathon milestone.

---

## Phase 3 — UI

Definition of done:

- candidate list,
- Run Agent,
- activity feed,
- decision queue,
- resolve decision,
- reset demo,
- loading/error states.

Do not wait for perfect styling.

---

## Phase 4 — end-to-end continuation

Definition of done:

- human advances Emily,
- state updates,
- scheduling becomes allowed,
- agent or controlled continuation schedules interview,
- activity feed reflects result.

---

## Phase 5 — polish

Add only high-demo-value improvements:

- streaming events,
- candidate drawer,
- metrics,
- action explanations,
- subtle animations,
- better empty states,
- demo mode.

---

## Phase 6 — AWS deployment

Definition of done:

- Strands backend deployed,
- environment documented,
- live demo reachable if feasible,
- health endpoint available,
- reset still works,
- no secrets committed.

Prefer AgentCore Runtime when practical because it reinforces the AWS/agent story.

---

## Phase 7 — submission

Required project artifacts:

- public repo,
- concise README,
- architecture diagram,
- demo video <= 5 minutes,
- hackathon description,
- setup instructions,
- AWS Builder ID information supplied separately by human,
- optional live demo.

---

# 27. Definition of Done for the MVP

CandidateLoop is MVP-complete when this exact path succeeds:

```text
1. Open application.
2. Click Reset Demo.
3. See four seeded candidates.
4. Click Run Agent.
5. Agent scans candidates.
6. Sarah triggers interviewer reminder.
7. David triggers safe candidate update.
8. Emily becomes Human Decision Required.
9. Marcus produces no action.
10. Activity stream accurately shows each result.
11. Human clicks Advance for Emily.
12. Candidate state changes.
13. Next interview can be scheduled.
14. Refresh does not corrupt state.
15. Running agent again does not send duplicate reminders.
```

Everything else is optional.

---

# 28. Demo Reliability Rules

The recorded hackathon demo must not rely on random model behavior for essential story beats.

Use a combination of:

- strong tool descriptions,
- system policy,
- deterministic synthetic state,
- bounded actions,
- validation in tools,
- retries only where appropriate.

If the LLM requests an invalid write, the tool should safely reject it.

Critical transitions should be validated by application policy.

---

# 29. Demo Script Target

The five-minute recording should roughly follow:

## 0:00–0:30 — Problem

Recruiting teams lose time chasing feedback, checking stalled candidates, following up, and coordinating next steps.

## 0:30–0:55 — Product

CandidateLoop handles the repetitive operational loop and interrupts recruiters only for human judgment.

## 0:55–2:45 — Autonomous run

Show:

- Run Agent
- Sarah reminder
- David follow-up
- Emily decision escalation
- Marcus no-op

## 2:45–3:35 — Human-in-loop

Advance Emily.

Show that CandidateLoop now handles scheduling.

## 3:35–4:20 — Technical implementation

Briefly show:

- Strands agent,
- custom tools,
- safety boundary,
- synthetic state,
- AWS/AgentCore deployment.

## 4:20–4:50 — Edge case

Run again.

Show:

```text
Reminder already sent recently → skipped
```

This is a strong proof of implementation quality.

## 4:50–5:00 — Close

> CandidateLoop automates coordination, not hiring judgment.

---

# 30. README Story

The public README should answer immediately:

## What does CandidateLoop do?

An autonomous recruiting operations agent built with the Strands Agents SDK.

## Who is it for?

Recruiters and recruiting coordinators managing repetitive candidate workflows.

## How does it work?

It inspects synthetic ATS, communication, interview feedback, and calendar state; chooses safe operational tools; acts autonomously; and escalates consequential hiring decisions to a human.

## What makes it agentic?

The Strands agent repeatedly observes state, selects tools, performs actions, evaluates results, and continues until there is no safe work remaining or human judgment is needed.

---

# 31. Judging-Oriented Features

When choosing between two possible additions, prefer the feature that improves one of:

### Technical implementation
Actual agent execution, tool use, deployment, reliability, idempotency.

### Design
Clear activity visualization and human decision boundary.

### Impact
Visible reduction in repetitive recruiter touches.

### Originality
Agent operates around the hiring decision rather than pretending AI should make the decision.

### Presentation
A demo sequence that is immediately understandable.

---

# 32. Metrics for the Demo

Use believable operational metrics, not fabricated business ROI.

Safe examples:

```text
4 candidates scanned
2 routine actions handled
1 human decision surfaced
1 candidate needed no action
2 recruiter follow-up touches avoided
```

Avoid claiming:

```text
CandidateLoop increases hiring quality by 37%
```

unless actual evidence exists.

---

# 33. Error Handling

The UI should handle:

- backend unavailable,
- model failure,
- AWS permission failure,
- agent run interrupted,
- tool validation failure,
- no actions necessary,
- duplicate action skipped.

Agent failure should not corrupt candidate state.

Return useful error objects.

---

# 34. Logging

Keep application logs useful.

Recommended fields:

```text
timestamp
run_id
candidate_id
event_type
tool_name
status
duration
```

Never log secrets.

For demo, persist enough activity to populate the timeline.

---

# 35. Testing Strategy

## Unit

- repositories
- policy checks
- tool validation
- duplicate prevention
- decision boundary

## Agent integration

Use seeded demo state.

Validate final state rather than exact natural-language output.

Do not write brittle tests expecting identical LLM prose.

## API

Test critical endpoints.

## Frontend

At minimum:

- Run Agent flow,
- decision resolution,
- reset demo.

## End-to-end

One happy-path Playwright test is ideal:

```text
reset
run
wait for Emily decision
advance
verify next-stage state
```

---

# 36. Coding Quality Standard

Prefer:

- typed interfaces,
- explicit models,
- small modules,
- descriptive names,
- tests around policies,
- clear boundaries.

Avoid:

- giant service classes,
- unexplained abstractions,
- premature dependency injection frameworks,
- generic "manager" modules,
- deeply nested inheritance,
- unnecessary message queues.

The hackathon repository should be easy for judges to understand.

---

# 37. Git Workflow

This project requires a public code repository.

Recommended:

```text
main
feature/CL-003-strands-tools
feature/CL-006-web-shell
```

Before committing:

```text
git status
run formatter
run tests
inspect diff
```

Commit examples:

```text
feat(agent): add synthetic ATS tools
feat(web): add agent activity feed
feat(api): add human decision resolution
test(agent): cover duplicate feedback reminder
docs: add CandidateLoop demo script
```

Do not commit generated secrets or local environment files.

---

# 38. Agent Startup Prompt — Codex

Use this when starting a Codex coding session:

```text
You are working on CandidateLoop, an Agents for Humans hackathon project.

Read these files before making changes:
1. CANDIDATELOOP_BUILD_HARNESS.md
2. TASKS.md
3. HANDOFF.md
4. README.md

You are primarily responsible for backend, Strands agent integration,
tool contracts, policy enforcement, FastAPI, data/state, and tests.

Inspect the repository before proposing code. Do not redesign working
architecture without a concrete need.

Work on the assigned CL task. Implement the smallest coherent solution,
run relevant tests, inspect the diff, then update HANDOFF.md with:
completed work, files changed, tests, known issues, and recommended next step.

Key product invariant:
CandidateLoop may automate recruiting operations but may never autonomously
advance, reject, rank, or hire a candidate.

Do not fake agent execution. Essential autonomous behavior must run through
the Strands Agents SDK and real registered tools.

Current task:
<PASTE CL TASK HERE>
```

---

# 39. Agent Startup Prompt — Claude Code

Use this when starting a Claude Code coding session:

```text
You are working on CandidateLoop, an Agents for Humans hackathon project.

Read these files before making changes:
1. CANDIDATELOOP_BUILD_HARNESS.md
2. TASKS.md
3. HANDOFF.md
4. README.md

You are primarily responsible for CandidateLoop's frontend and demo UX:
Next.js, candidate views, agent activity, human decision cards, candidate
detail interactions, accessibility, loading/error states, and visual polish.

Inspect the existing API contract and implementation before writing frontend
assumptions. Do not invent endpoints when the backend already defines them.

The UI should feel like an autonomous operations cockpit, not a generic chatbot.

Preserve the key human-in-the-loop message:
CandidateLoop handles coordination; humans make hiring decisions.

Implement the assigned CL task, run relevant checks/tests, inspect the diff,
and update HANDOFF.md when complete.

Current task:
<PASTE CL TASK HERE>
```

---

# 40. Agent Startup Prompt — Antigravity

Use this when starting an Antigravity session:

```text
You are working on CandidateLoop, an Agents for Humans hackathon project.

Read:
1. CANDIDATELOOP_BUILD_HARNESS.md
2. TASKS.md
3. HANDOFF.md
4. README.md

Your default role is integration, QA, architecture consistency, deployment,
AWS/AgentCore packaging, smoke testing, documentation completeness, and
demo reliability.

Do not replace working backend or frontend architecture merely to standardize
it. Find concrete integration gaps and fix the smallest set necessary.

Check:
- frontend/API contract compatibility
- Strands actually powers agent execution
- tool safety boundaries are structural
- demo reset is deterministic
- duplicate actions are prevented
- tests and setup instructions work
- deployment contains no secrets

After work, update HANDOFF.md with completed work, files changed, tests,
remaining issues, and recommended next step.

Current task:
<PASTE CL TASK HERE>
```

---

# 41. Cross-Agent Review Prompt

Use this after one agent finishes a major milestone:

```text
Review the current CandidateLoop implementation against
CANDIDATELOOP_BUILD_HARNESS.md.

Do not begin by rewriting code.

First report:
1. What is implemented correctly.
2. What violates the product or safety invariants.
3. What is missing for the exact MVP demo path.
4. What is unnecessarily complex.
5. The three highest-priority fixes.

Then implement only the fixes explicitly assigned to you.

Pay special attention to:
- real Strands tool use,
- human hiring decision boundary,
- deterministic reset,
- duplicate-action prevention,
- frontend/backend contract consistency,
- demo reliability.
```

---

# 42. First Task Queue

Create `TASKS.md` initially with:

```markdown
# CandidateLoop Tasks

## P0 — Must Have

- [ ] CL-001 Bootstrap repository and local dev commands
- [ ] CL-002 Define models, repository, and deterministic demo seed
- [ ] CL-003 Implement safe recruiting operation tools
- [ ] CL-004 Build CandidateLoop with Strands Agents SDK
- [ ] CL-005 Add agent run API and structured activity events
- [ ] CL-006 Build frontend operations cockpit
- [ ] CL-007 Add activity feed
- [ ] CL-008 Add human decision queue + resolution
- [ ] CL-009 Connect frontend to live agent run
- [ ] CL-010 Add deterministic demo reset
- [ ] CL-011 Add duplicate-action/idempotency rules
- [ ] CL-012 Complete MVP automated tests
- [ ] CL-013 Verify full demo path end-to-end

## P1 — Submission

- [ ] CL-014 Improve candidate detail drawer
- [ ] CL-015 Add run metrics
- [ ] CL-016 Deploy backend / AgentCore
- [ ] CL-017 Deploy frontend
- [ ] CL-018 Write public README
- [ ] CL-019 Create architecture diagram
- [ ] CL-020 Write and rehearse <=5 minute demo script
- [ ] CL-021 Final security/secrets review
- [ ] CL-022 Final clean-clone setup test

## P2 — Only If Time Remains

- [ ] CL-023 Stream agent events live
- [ ] CL-024 Add additional edge-case candidate
- [ ] CL-025 Add action filters/history
- [ ] CL-026 Add polished demo-mode transitions
```

P0 outranks P1. P1 outranks P2.

Do not work on P2 while P0 is incomplete unless the human explicitly asks.

---

# 43. Initial HANDOFF.md

Start with:

```markdown
# CandidateLoop Handoff Log

This file records handoffs between Claude Code, Codex, Antigravity, and the human.

## Project invariants

- Strands Agents SDK powers the core autonomous agent loop.
- Synthetic recruiting data only for the hackathon.
- CandidateLoop automates coordination, not hiring judgment.
- Advance/Hold/Reject always requires a human.
- Essential demo behavior must be reproducible after Reset Demo.
- Repeated runs must not create obvious duplicate actions.
```

---

# 44. Suggested First Build Sequence

To minimize agent conflicts:

### Codex first

```text
CL-001
CL-002
CL-003
CL-004
CL-005
```

Outcome:

Working backend and Strands agent.

### Claude Code in parallel once API schema is stable

```text
CL-006
CL-007
CL-008
```

Outcome:

Polished static/live-ready UI.

### Codex + Claude integration

```text
CL-009
CL-010
CL-011
CL-012
CL-013
```

### Antigravity

Review/integrate:

```text
CL-013
CL-016
CL-017
CL-021
CL-022
```

This sequence is intentionally biased toward getting the true agent working before investing heavily in polish.

---

# 45. Scope-Cut Order

If time becomes tight, cut features in this order:

1. fancy animations,
2. filters,
3. elaborate candidate detail,
4. streaming,
5. persistent database,
6. sophisticated calendar selection,
7. extra candidates,
8. extra metrics.

Never cut:

- Strands,
- actual tool calls,
- human decision boundary,
- deterministic demo,
- duplicate prevention,
- working UI,
- clear README.

---

# 46. Product Language

Prefer:

- autonomous recruiting operations agent
- routine coordination
- human decision required
- safe operational action
- candidate workflow
- recruiter attention
- evidence summary

Avoid marketing claims like:

- AI recruiter
- replaces recruiters
- chooses the best candidate
- eliminates bias
- guarantees better hires

---

# 47. Final Product North Star

A judge should understand CandidateLoop in less than 20 seconds:

> Recruiting involves lots of repetitive coordination between the moments
> where a recruiter actually needs to make a decision. CandidateLoop uses
> Strands to autonomously inspect candidate workflows, chase missing feedback,
> send routine updates, and coordinate next steps. When hiring judgment is
> required, it stops and asks the recruiter.

And after the demo, the judge should be able to say:

> "I saw the agent notice work, use tools to handle it, avoid an unnecessary
> action, and stop when a human decision was required."

If CandidateLoop achieves that reliably, the project is ready to submit.

---

# 48. Technical Reference Notes

As of the hackathon build window:

- Strands is a library that runs inside your application process.
- It supports Python and TypeScript.
- Python supports custom function tools, MCP, structured output, multi-agent patterns, session management, and OpenTelemetry integration.
- Amazon Bedrock is a first-class/default model-provider path.
- A Strands agent can be integrated into a FastAPI application.
- Amazon Bedrock AgentCore supports deployment of code-based agents built with frameworks including Strands.

Prefer the official Strands and AWS documentation when implementation details differ from this harness.

---

# 49. Decision Rule for Every Agent

Before adding anything, ask:

> **Does this make the autonomous CandidateLoop demo more believable, safer,
> easier to understand, or more reliable before September 14?**

If not, do not build it yet.
