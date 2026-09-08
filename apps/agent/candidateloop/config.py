from datetime import UTC, datetime

CANDIDATE_FOLLOWUP_AFTER_DAYS = 3
FEEDBACK_REMINDER_AFTER_HOURS = 24
FEEDBACK_REMINDER_COOLDOWN_HOURS = 24

# Keeping demo time fixed makes reset, tests, and recorded walkthroughs reproducible.
DEMO_NOW = datetime(2026, 9, 8, 16, 0, tzinfo=UTC)
