from datetime import datetime
from uuid import uuid4

from candidateloop.config import DEMO_NOW
from candidateloop.models import AgentAction, Communication, HumanDecision, Stage
from candidateloop.policies import (
    can_schedule,
    can_send_feedback_reminder,
    candidate_needs_status_update,
    is_decision_ready,
    missing_feedback,
)
from candidateloop.repository import InMemoryRepository

SAFE_CANDIDATE_STATUS_BODY = (
    "Hi {first_name} — your application is still under review. We haven't forgotten about you "
    "and we'll share an update as soon as one is available."
)


class RecruitingTools:
    """Narrow operational tools. This class intentionally has no hiring-disposition method."""

    def __init__(self, repository: InMemoryRepository, now: datetime = DEMO_NOW) -> None:
        self.repository = repository
        self.now = now

    def get_active_candidates(self):
        return self.repository.active_candidates()

    def get_candidate(self, candidate_id: str):
        return self.repository.candidate(candidate_id)

    def get_interview_feedback(self, candidate_id: str):
        return self.repository.feedback_for(candidate_id)

    def get_interviewer_availability(self, candidate_id: str):
        candidate = self.repository.candidate(candidate_id)
        if candidate is None or not can_schedule(candidate):
            return []
        return self.repository.available_slots()

    def send_feedback_reminder(
        self, candidate_id: str, interviewer_id: str
    ) -> Communication | None:
        candidate = self.repository.candidate(candidate_id)
        if candidate is None:
            raise ValueError("Unknown candidate")
        pending = missing_feedback(candidate, self.repository.feedback_for(candidate_id), self.now)
        if interviewer_id not in {item.interviewer_id for item in pending}:
            raise ValueError("Feedback reminder requires overdue pending feedback")
        communications = self.repository.communications_for(candidate_id)
        if not can_send_feedback_reminder(candidate_id, interviewer_id, communications, self.now):
            return None
        interviewer = self.repository.interviewer(interviewer_id)
        if interviewer is None:
            raise ValueError("Unknown interviewer")
        communication = Communication(
            id=f"comm_{uuid4().hex}",
            candidate_id=candidate_id,
            recipient_type="interviewer",
            recipient_id=interviewer_id,
            type="feedback_reminder",
            subject="Scorecard reminder",
            body=(
                f"Hi {interviewer.name.split()[0]} — please submit the outstanding "
                "interview scorecard."
            ),
            created_at=self.now,
        )
        self.repository.save_communication(communication)
        return communication

    def send_candidate_status_update(self, candidate_id: str) -> Communication | None:
        candidate = self.repository.candidate(candidate_id)
        if candidate is None:
            raise ValueError("Unknown candidate")
        if candidate.stage != Stage.RECRUITER_REVIEW or not candidate_needs_status_update(
            candidate, self.now
        ):
            return None
        communication = Communication(
            id=f"comm_{uuid4().hex}",
            candidate_id=candidate_id,
            recipient_type="candidate",
            recipient_id=candidate_id,
            type="candidate_status_update",
            subject="An update on your application",
            body=SAFE_CANDIDATE_STATUS_BODY.format(first_name=candidate.name.split()[0]),
            created_at=self.now,
        )
        candidate.last_candidate_contact_at = self.now
        self.repository.save_communication(communication)
        self.repository.save_candidate(candidate)
        return communication

    def create_human_decision(self, candidate_id: str, reason: str, evidence: str) -> HumanDecision:
        existing = self.repository.open_decision_for(candidate_id)
        if existing:
            return existing
        candidate = self.repository.candidate(candidate_id)
        if candidate is None:
            raise ValueError("Unknown candidate")
        if not is_decision_ready(candidate, self.repository.feedback_for(candidate_id)):
            raise ValueError("Human decision escalation requires complete interview feedback")
        decision = HumanDecision(
            id=f"decision_{uuid4().hex}",
            candidate_id=candidate_id,
            reason=reason,
            evidence=evidence,
            created_at=self.now,
        )
        candidate.human_decision_status = "pending"
        self.repository.save_candidate(candidate)
        self.repository.save_decision(decision)
        return decision

    def schedule_interview(self, candidate_id: str, slot_id: str):
        candidate = self.repository.candidate(candidate_id)
        if candidate is None or not can_schedule(candidate):
            raise ValueError("Scheduling requires an explicit human advance decision")
        slot = next(
            (item for item in self.repository.available_slots() if item.id == slot_id), None
        )
        if slot is None:
            raise ValueError("Availability slot is not available")
        candidate.stage = Stage.PANEL_INTERVIEW
        candidate.stage_entered_at = self.now
        candidate.next_interview_at = slot.start_at
        slot.available = False
        self.repository.save_candidate(candidate)
        self.repository.save_slot(slot)
        return slot

    def record_action(self, action: AgentAction) -> None:
        self.repository.save_action(action)
