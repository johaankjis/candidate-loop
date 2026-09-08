from datetime import datetime, timedelta

from candidateloop.config import (
    CANDIDATE_FOLLOWUP_AFTER_DAYS,
    FEEDBACK_REMINDER_AFTER_HOURS,
    FEEDBACK_REMINDER_COOLDOWN_HOURS,
)
from candidateloop.models import Candidate, Communication, Feedback, Stage


def missing_feedback(
    candidate: Candidate, feedback: list[Feedback], now: datetime
) -> list[Feedback]:
    if candidate.interview_completed_at is None:
        return []
    if now - candidate.interview_completed_at < timedelta(hours=FEEDBACK_REMINDER_AFTER_HOURS):
        return []
    return [item for item in feedback if item.status == "pending"]


def can_send_feedback_reminder(
    candidate_id: str,
    interviewer_id: str,
    communications: list[Communication],
    now: datetime,
) -> bool:
    cutoff = now - timedelta(hours=FEEDBACK_REMINDER_COOLDOWN_HOURS)
    return not any(
        item.candidate_id == candidate_id
        and item.recipient_id == interviewer_id
        and item.type == "feedback_reminder"
        and item.created_at >= cutoff
        for item in communications
    )


def candidate_needs_status_update(candidate: Candidate, now: datetime) -> bool:
    return now - candidate.last_candidate_contact_at >= timedelta(
        days=CANDIDATE_FOLLOWUP_AFTER_DAYS
    )


def is_decision_ready(candidate: Candidate, feedback: list[Feedback]) -> bool:
    submitted = sum(item.status == "submitted" for item in feedback)
    return (
        candidate.stage == Stage.INTERVIEW_COMPLETE
        and candidate.required_feedback_count > 0
        and submitted >= candidate.required_feedback_count
    )


def can_schedule(candidate: Candidate) -> bool:
    return (
        candidate.stage == Stage.PANEL_SCHEDULING and candidate.last_human_resolution == "ADVANCE"
    )
