# Claude Code — handoff (agent/claude-demo-ux)

## Round summary

Frontend-only round against `apps/web/**`. The goal was to make the existing
cockpit read clearly in a <=5 minute hackathon demo. The backend, the API
contract, and `apps/agent/**` were not touched.

`app/page.tsx` was a single 586-line component holding types, fetching, WebMCP
registration, and all markup. It is now a 136-line composition over a typed data
layer (`lib/candidateloop/`) and five presentation components
(`components/candidateloop/`).

### 1. Agent activity

Each event renders the four operational fields the runner already records —
`observed`, `reason`, `action`, `result` — as a labelled four-row structure with
its own icon and colour, rather than being flattened into a sentence. No hidden
reasoning is displayed; these are the backend's structured execution facts.

Events are grouped by `run_id` ("Latest run" / "Earlier run", with a handled vs
skipped count), styled by `event_type` (tool action, escalation, deliberate
skip), and carry the `tool` name. Escalations get a violet ring and a "stopped
for human judgment" ribbon. A filter toggles All / Actions / Escalations /
Skipped so the idempotency beat can be isolated on stage.

### 2. Human decision required

A high-contrast card: candidate identity, "why this needs you" from
`decision.reason`, an evidence checklist built from `decision.evidence` plus the
candidate's own interview-completed and stage/waiting facts, then Advance / Hold
/ Reject under an explicit "Human action" divider with the line that
CandidateLoop has no tool that can make them. A run that produces a decision
auto-selects that candidate. Resolved decisions stay listed as "recorded by a
recruiter".

### 3. Agent run state

An explicit machine — `idle`, `scanning`, `applying`, `complete`, `no_work`,
`failed` — with a medallion, an indeterminate progress track while in flight, an
`aria-live` status line, and a retry button on failure. `no_work` is a distinct
state, not a silent success, so "nothing needed doing" reads as a result.

### 4. Demo metrics

All seven `RunSummary` fields are shown (previously four): candidates scanned,
routine actions handled, reminders sent, updates sent, interviews scheduled,
decisions surfaced, no action needed. Values animate in on change; decisions
surfaced is emphasised.

### 5. Candidate state

Detail view gained a stage pipeline, waiting time with an age-escalating tone,
feedback status, upcoming interview, and decision status. The rail shows a
derived one-line signal per candidate ("Needs your decision", "Waiting on 1
scorecard", "Ready to schedule", ...), a segmented scorecard meter, and sorts
anything needing a human to the top.

### 6. Polish, responsive, accessibility

Motion is presentational only: the reveal stages the actions the API actually
returned, then clears itself so later filtering and selection are instant. All
animation is disabled under `prefers-reduced-motion`. Timestamps render in UTC
so the fixed demo clock looks identical on every machine. Icon-only controls
have labels, the status line is `aria-live`, rail buttons have visible focus
rings and `aria-current`, and filters expose `aria-pressed`.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/app/page.tsx` | Reduced to layout/composition |
| `apps/web/app/globals.css` | Four keyframes, four utilities, reduced-motion guard |
| `apps/web/.gitignore` | Ignore `*.tsbuildinfo` |
| `apps/web/lib/candidateloop/types.ts` | New — API contract types incl. `RunPhase` |
| `apps/web/lib/candidateloop/format.ts` | New — UTC formatting, stage pipeline, derived candidate signal |
| `apps/web/lib/candidateloop/preview.ts` | New — offline preview seed mirroring `seed.py` |
| `apps/web/lib/candidateloop/use-candidateloop.ts` | New — fetching, run state machine, WebMCP registration |
| `apps/web/components/candidateloop/run-console.tsx` | New — run state + metrics band |
| `apps/web/components/candidateloop/candidate-rail.tsx` | New — prioritised candidate list |
| `apps/web/components/candidateloop/candidate-detail.tsx` | New — pipeline + four state cards |
| `apps/web/components/candidateloop/activity-feed.tsx` | New — Observed/Reason/Action/Result feed |
| `apps/web/components/candidateloop/decision-queue.tsx` | New — human decision cards |

## Validation

- `npm run lint` (oxlint) — pass.
- `npx tsc --noEmit` — pass.
- `npm run build` (vinext) — pass.
- Live browser run against `uvicorn api.main:app` on :8000, cockpit on :3000,
  full demo path exercised in order:
  1. Reset demo — "Demo restored to the four-candidate starting state."
  2. Run 1 — 4 scanned, 3 handled, 1 reminder, 1 update, 1 decision surfaced,
     1 no-action. Emily auto-selected; escalation card rendered.
  3. Advance Emily — recorded as a human decision, stage moved to Panel
     Scheduling, queue shows "recorded by a recruiter".
  4. Run 2 — 1 action, interviews scheduled 1, Emily at Panel Interview with the
     panel slot shown.
  5. Run 3 — "No work required", 0 actions, 4 skipped, each with its own reason
     including Sarah's "A feedback reminder was sent within the cooldown window."
- Two layout bugs found and fixed during that pass: the sticky candidate rail
  overlapped the decision queue at the `lg` breakpoint (now sticky only at `xl`,
  where all three columns share one row), and the staggered reveal replayed on
  every filter change (the reveal map is now cleared once it has played).

## Known issues

- The `xl` three-column layout was verified at an effective viewport of ~1512px
  and the `lg` two-column fallback at ~1081px. Narrower breakpoints (`sm` and
  below) rely on the responsive classes and were not exercised in a browser.
- No automated frontend tests. The demo path was validated manually; a
  Playwright run over those five steps is the obvious follow-up (CL-012).
- The cockpit polls nothing — it refreshes on run, reset, and resolve only. If
  another client mutates state the view is stale until the next action (CL-023
  covers streaming).
- `npm audit` findings from the generated dependency set are unchanged from the
  previous handoff; no force-upgrade was applied.
- `apps/agent/.venv` was created locally to run the API for verification. It is
  gitignored.

## Backend improvement noted, not implemented

`DeterministicAgentRunner._record` writes a raw ISO instant into the
`schedule_interview` result string ("Panel scheduled for
2026-09-10T15:00:00+00:00."). The frontend now rewrites embedded ISO-8601
instants into readable UTC for display (`humanizeTimestamps` in `format.ts`),
which is a presentation fix over the backend's own wording. It would be cleaner
for the runner to emit an already-formatted time, or to carry the slot as a
structured field on `AgentAction` so the client formats it directly. Left to the
agent owner — it is not trivial enough to change under this round's scope.

## Commit

`f49b194636e4af3f378f25957279aa234328b979` on `agent/claude-demo-ux`. Not merged
into `main`. `HANDOFF.md` deliberately untouched.

## Recommended next step

Add one Playwright end-to-end test over the five demo steps above and wire it
into the verify block in `README.md`; that closes CL-012/CL-013 and makes the
demo path a regression gate before the Strands adapter (CL-004) lands and starts
changing what the activity feed receives.
