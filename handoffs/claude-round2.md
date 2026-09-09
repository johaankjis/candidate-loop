# Claude Code — Round 2 Handoff

**Branch:** `agent/claude-round2`
**Baseline:** `e40fb36` (round1-integrated)
**Commit:** `6964828` — `fix(web): correct agent-activity truthfulness and API failure states`
**Scope:** `apps/web/**` only. `apps/agent/**` was read for contract verification and not modified.

Round 2 was integration validation and demo polish against the real merged backend,
not a redesign. No new features were added and no layout was reworked.

---

## 1. How this was validated

The frontend was run against a live `apps/agent` FastAPI instance
(`uvicorn api.main:app --port 8000`, `execution_mode: deterministic_local`) — first
in `vinext dev`, then in the **served production build** (`wrangler dev` on the
`dist/` output). Backend ground truth was captured independently with `curl` and
compared field-by-field against what the cockpit rendered.

### The required demo path — passes end to end

| Step | Backend result | Cockpit |
| --- | --- | --- |
| Reset Demo | 4 seeded candidates | metrics/feed/queue cleared, "Demo restored to the four-candidate starting state." |
| Run Agent | `actions_taken 3`, `no_action_needed 1` | all 7 metrics match the API summary exactly |
| Sarah — missing feedback | `send_feedback_reminder`, 3/4 scorecards, reminder to Alex Morgan | rendered verbatim as Observed/Reason/Action/Result |
| David — stale candidate | `send_candidate_status_update`, waiting 5 days | rendered verbatim |
| Emily — escalation | `create_human_decision`, 4/4 scorecards | violet "Human decision required" card + "Stopped for human judgment" ribbon |
| Marcus — no action | `record_agent_note` | dashed "no action" card |
| Recruiter clicks Advance | decision `resolved/ADVANCE`, stage → `Panel Scheduling` | queue clears, "Recorded by a recruiter — Advance", rail shows "Ready to schedule" |
| Rerun → schedules | `interviews_scheduled 1`, panel `2026-09-10T15:00Z` | "Interviews scheduled = 1", new run group |
| Rerun → duplicate prevention | `actions_taken 0`, `no_action_needed 4` | phase "No work required" + each backend cooldown/idempotency reason shown |

Duplicate-prevention reasons render as the backend words them, e.g. Sarah →
"A feedback reminder was sent within the cooldown window."

### `NEXT_PUBLIC_API_URL` — confirmed working in both modes

- **Development:** works; falls back to `http://localhost:8000` when unset.
- **Production build:** `vinext` **inlines `NEXT_PUBLIC_*` into the client bundle at build time.**
  Verified by building with a sentinel value and finding it in
  `dist/client/_next/static/chunks/`, and by building with `http://127.0.0.1:8000`,
  serving `dist/`, and confirming via `performance.getEntriesByType('resource')`
  that live calls went to `127.0.0.1:8000` — the inlined value, not the default.
- When unset, no bare `process.env` reference is left in the client bundle.

**Deployment consequence:** the API URL must be present when `npm run build` runs.
Setting it only in the runtime environment has no effect on an already-built app.

### Other states exercised

Loading (`scanning` → `applying`), completed, no-op, escalation, cold start with
the API down (preview data + explanatory status), API unreachable mid-session,
and an HTTP error path (real `409` from resolving an already-resolved decision).

### Laptop presentation

Measured in a true 1440×900 viewport: three-column layout, no horizontal
overflow (`scrollWidth` 1417), "Human decision required" at y=247 — above the
fold and the most visually dominant element on screen.

---

## 2. Integration problems found and fixed (all in `apps/web`)

1. **The UI attributed work the backend never did.** Marcus Reed's detail panel
   read *"Scheduled by CandidateLoop after a human advance"* for his **seeded**
   interview, on a candidate the agent explicitly took no action on — directly
   contradicting the adjacent "Decision status: Not required". Attribution now
   requires an actual recruiter `ADVANCE`; otherwise it reads "Already on the
   calendar". *(This was the most substantive finding.)*

2. **Agent activity replayed each run backwards.** `/api/actions` returns
   newest-first, and within a run that is the reverse of scan order — and because
   every event in a run shares one `created_at`, nothing on screen revealed the
   inversion. The feed opened on Marcus's no-op and buried Sarah's reminder last.
   Each run group is now flipped back into scan order (Sarah → David → Emily →
   Marcus); newest run still sorts first, and the reveal stagger follows display
   order.

3. **Network failures showed the raw browser string "Failed to fetch".**
   `fetch` rejects before the `!response.ok` check, so the outage path never hit
   the intended copy. An unreachable API now names the configured URL; an HTTP
   error keeps its status code, so a 5xx is not mistaken for an outage.

4. **Failures named the wrong control.** A failed *reset* reported "Run failed"
   with a "Retry run" button. A rejected *decision* changed only the status line
   and left a green "Run complete" banner above it. Each now has its own wording
   and retry target.

5. **The cockpit kept claiming a live backend after it went away.** `connected`
   was only ever set true. An unreachable API now clears it, and the
   connection chip — previously hidden below 768px — is always visible and turns
   amber, so preview data cannot be mistaken for live state.

6. **Grammar:** "1 decision need you" → "1 decision needs you".

7. **Env configuration trap:** `vinext` loads `.env` from `apps/web`, not the repo
   root, so the root `.env.example` does not configure the frontend. Added
   `apps/web/.env.example` documenting this and the build-time inlining.

**Checked and found clean:** the preview seed in `lib/candidateloop/preview.ts`
matches `apps/agent/candidateloop/seed.py` exactly (including `days_in_stage`
against the pinned `DEMO_NOW`) and is fully replaced by live data on connect — no
hardcoded state conflicts with real API state. Every Observed/Reason/Action/Result
string is the backend's own; the only transform is ISO-instant formatting.

---

## 3. For Codex — backend issues found, not fixed here

**BLOCKER for CL-016/CL-017 (deploy): CORS is hardcoded to localhost:3000.**
`apps/agent/api/main.py` sets `allow_origins=["http://localhost:3000",
"http://127.0.0.1:3000"]`. The root `.env.example` documents a `CORS_ORIGINS`
variable, but **nothing in `apps/agent` reads it** (`grep -rn CORS_ORIGINS
apps/agent` → no match). Verified:

```
Origin: http://localhost:3000              -> 200, access-control-allow-origin echoed
Origin: https://candidateloop.example.com  -> 400 Bad Request (preflight rejected)
```

A deployed frontend will be blocked no matter what `NEXT_PUBLIC_API_URL` is set to.
Suggested fix: read `CORS_ORIGINS` in `AgentSettings` and pass it to the middleware.

**Minor — every event in a run shares one timestamp.** `DeterministicAgentRunner`
stamps all actions with `DEMO_NOW`, so the feed shows the same clock time on every
card and per-event order is not recoverable from the data. The frontend now relies
on array order (fix #2 above). If a future runner emits real per-event timestamps,
that workaround should be revisited.

**Minor — `docs/deployment.md` §4 says "Copy `.env.example` to `.env`"** at the repo
root. That does not configure the frontend (see fix #7). The doc should point at
`apps/web/.env.example` and state that `NEXT_PUBLIC_API_URL` is needed at build
time. `docs/` is outside my ownership, so it was left unchanged.

---

## 4. Known limitations / not addressed

- **Below the `xl` breakpoint (< 1280px) the decision queue drops below the fold**
  (y≈1699 at 1152px, y≈2475 at 1024px). There is no horizontal overflow at any
  width and the header "N decisions need you" chip stays visible, but the
  escalation panel is no longer above the fold. The demo target (1440×900) is
  unaffected. **Recommend demoing at ≥1280px wide.** Changing this means moving the
  three-column breakpoint or reordering the grid, which is a layout change I judged
  out of scope for a validation round.
- `oxfmt --check` reports formatting differences in **all 9** `candidateloop`
  source files, including ones this round did not touch. The repo has never been
  oxfmt-formatted; running it would produce a large unrelated diff. Left alone.
  `npm run lint` (oxlint) — the check the README specifies — passes clean.
- No automated frontend tests were added. All verification this round was manual
  against the live backend. A browser-level end-to-end test for the demo path is
  still the highest-value gap (carried over from round 1).
- WebMCP tool registrations are present but still untested in a real WebMCP host.

---

## 5. Checks run

```
apps/web:  npm run lint      -> pass (oxlint, exit 0)
apps/web:  npx tsc --noEmit  -> pass (exit 0)
apps/web:  npm run build     -> pass (exit 0)
```

Plus the live-backend demo path in dev and in the served production build, and the
failure/no-op/escalation/cold-start states listed above.

## 6. State

Committed as `6964828` and pushed to `agent/claude-round2`. **Not merged.**
