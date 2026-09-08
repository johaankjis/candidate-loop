# CandidateLoop agent instructions

Before changing code, read `candidate-build-harness.md`, `TASKS.md`, `HANDOFF.md`, and
`README.md`. Inspect current changes before editing, work on an unclaimed or human-assigned task,
run the relevant checks, and append a concise entry to `HANDOFF.md` after meaningful work.

Core invariants:

- Use synthetic recruiting data only.
- Automate coordination, never hiring judgment.
- Advance, Hold, and Reject are available only through the human-facing API.
- Keep demo reset deterministic and repeated operational runs idempotent.
- Do not claim model-driven behavior unless execution actually runs through Strands.
- Do not commit credentials or local environment files.

