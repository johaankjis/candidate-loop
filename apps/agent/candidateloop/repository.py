from copy import deepcopy
from datetime import datetime
from threading import RLock

from candidateloop.config import DEMO_NOW
from candidateloop.models import (
    AgentAction,
    AgentActionView,
    AvailabilitySlot,
    Candidate,
    CandidateView,
    Communication,
    Feedback,
    HumanDecision,
    HumanDecisionView,
    Interviewer,
)
from candidateloop.seed import demo_availability, demo_candidates, demo_feedback, demo_interviewers


class InMemoryRepository:
    """Thread-safe, resettable storage for the deterministic hackathon demo."""

    def __init__(self) -> None:
        self._lock = RLock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.candidates = {item.id: item for item in demo_candidates()}
            self.interviewers = {item.id: item for item in demo_interviewers()}
            self.feedback = {item.id: item for item in demo_feedback()}
            self.availability = {item.id: item for item in demo_availability()}
            self.communications: dict[str, Communication] = {}
            self.decisions: dict[str, HumanDecision] = {}
            self.actions: dict[str, AgentAction] = {}

    def active_candidates(self) -> list[Candidate]:
        with self._lock:
            return deepcopy([item for item in self.candidates.values() if item.status == "active"])

    def candidate(self, candidate_id: str) -> Candidate | None:
        with self._lock:
            item = self.candidates.get(candidate_id)
            return deepcopy(item) if item else None

    def candidate_views(self, now: datetime = DEMO_NOW) -> list[CandidateView]:
        with self._lock:
            return [self._candidate_view(item, now) for item in self.candidates.values()]

    def _candidate_view(self, candidate: Candidate, now: datetime) -> CandidateView:
        submitted = sum(
            item.candidate_id == candidate.id and item.status == "submitted"
            for item in self.feedback.values()
        )
        return CandidateView(
            **candidate.model_dump(),
            days_in_stage=max(0, (now - candidate.stage_entered_at).days),
            submitted_feedback_count=submitted,
        )

    def candidate_view(self, candidate_id: str, now: datetime = DEMO_NOW) -> CandidateView | None:
        with self._lock:
            candidate = self.candidates.get(candidate_id)
            return self._candidate_view(candidate, now) if candidate else None

    def feedback_for(self, candidate_id: str) -> list[Feedback]:
        with self._lock:
            return deepcopy(
                [item for item in self.feedback.values() if item.candidate_id == candidate_id]
            )

    def interviewer(self, interviewer_id: str) -> Interviewer | None:
        with self._lock:
            item = self.interviewers.get(interviewer_id)
            return deepcopy(item) if item else None

    def communications_for(self, candidate_id: str) -> list[Communication]:
        with self._lock:
            return deepcopy(
                [item for item in self.communications.values() if item.candidate_id == candidate_id]
            )

    def save_communication(self, communication: Communication) -> None:
        with self._lock:
            self.communications[communication.id] = communication

    def save_candidate(self, candidate: Candidate) -> None:
        with self._lock:
            self.candidates[candidate.id] = candidate

    def open_decision_for(self, candidate_id: str) -> HumanDecision | None:
        with self._lock:
            match = next(
                (
                    item
                    for item in self.decisions.values()
                    if item.candidate_id == candidate_id and item.status == "pending"
                ),
                None,
            )
            return deepcopy(match) if match else None

    def save_decision(self, decision: HumanDecision) -> None:
        with self._lock:
            self.decisions[decision.id] = decision

    def decision(self, decision_id: str) -> HumanDecision | None:
        with self._lock:
            item = self.decisions.get(decision_id)
            return deepcopy(item) if item else None

    def decision_views(self) -> list[HumanDecisionView]:
        with self._lock:
            views = []
            for item in reversed(self.decisions.values()):
                candidate = self.candidates[item.candidate_id]
                views.append(
                    HumanDecisionView(
                        **item.model_dump(), candidate_name=candidate.name, role=candidate.role
                    )
                )
            return deepcopy(views)

    def available_slots(self) -> list[AvailabilitySlot]:
        with self._lock:
            return deepcopy([item for item in self.availability.values() if item.available])

    def save_slot(self, slot: AvailabilitySlot) -> None:
        with self._lock:
            self.availability[slot.id] = slot

    def save_action(self, action: AgentAction) -> None:
        with self._lock:
            self.actions[action.id] = action

    def action_views(self, run_id: str | None = None) -> list[AgentActionView]:
        with self._lock:
            actions = list(self.actions.values())
            if run_id:
                actions = [item for item in actions if item.run_id == run_id]
            views = [
                AgentActionView(
                    **item.model_dump(), candidate_name=self.candidates[item.candidate_id].name
                )
                for item in reversed(actions)
            ]
            return deepcopy(views)


repository = InMemoryRepository()
