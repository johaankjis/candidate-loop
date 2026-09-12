from copy import deepcopy
from dataclasses import dataclass
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


class PendingHumanDecisionError(ValueError):
    """Raised when destructive cleanup would remove an unresolved recruiter decision."""


@dataclass(frozen=True)
class RepositorySnapshot:
    """Deep-copied repository state used to make model-driven runs atomic."""

    candidates: dict[str, Candidate]
    interviewers: dict[str, Interviewer]
    feedback: dict[str, Feedback]
    availability: dict[str, AvailabilitySlot]
    communications: dict[str, Communication]
    decisions: dict[str, HumanDecision]
    actions: dict[str, AgentAction]


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

    def snapshot(self) -> RepositorySnapshot:
        """Capture state before a model-driven run begins."""
        with self._lock:
            return RepositorySnapshot(
                candidates=deepcopy(self.candidates),
                interviewers=deepcopy(self.interviewers),
                feedback=deepcopy(self.feedback),
                availability=deepcopy(self.availability),
                communications=deepcopy(self.communications),
                decisions=deepcopy(self.decisions),
                actions=deepcopy(self.actions),
            )

    def restore(self, snapshot: RepositorySnapshot) -> None:
        """Restore a prior snapshot after an incomplete or failed run."""
        with self._lock:
            self.candidates = deepcopy(snapshot.candidates)
            self.interviewers = deepcopy(snapshot.interviewers)
            self.feedback = deepcopy(snapshot.feedback)
            self.availability = deepcopy(snapshot.availability)
            self.communications = deepcopy(snapshot.communications)
            self.decisions = deepcopy(snapshot.decisions)
            self.actions = deepcopy(snapshot.actions)

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

    def create_candidate_with_feedback(
        self, candidate: Candidate, required_count: int, submitted_count: int
    ) -> None:
        """Atomically create a candidate and its synchronized feedback records."""
        with self._lock:
            if candidate.id in self.candidates:
                raise ValueError("Candidate already exists")
            previous_feedback = deepcopy(self.feedback)
            previous_interviewers = deepcopy(self.interviewers)
            try:
                self.candidates[candidate.id] = candidate
                self.synchronize_candidate_feedback(candidate.id, required_count, submitted_count)
            except Exception:
                self.candidates.pop(candidate.id, None)
                self.feedback = previous_feedback
                self.interviewers = previous_interviewers
                raise

    def update_candidate_with_feedback(
        self, candidate: Candidate, required_count: int, submitted_count: int
    ) -> None:
        """Atomically replace a candidate and synchronize its feedback records."""
        with self._lock:
            previous_candidate = deepcopy(self.candidates.get(candidate.id))
            if previous_candidate is None:
                raise ValueError("Unknown candidate")
            previous_feedback = deepcopy(self.feedback)
            previous_interviewers = deepcopy(self.interviewers)
            try:
                self.candidates[candidate.id] = candidate
                self.synchronize_candidate_feedback(candidate.id, required_count, submitted_count)
            except Exception:
                self.candidates[candidate.id] = previous_candidate
                self.feedback = previous_feedback
                self.interviewers = previous_interviewers
                raise

    def synchronize_candidate_feedback(
        self, candidate_id: str, required_count: int, submitted_count: int
    ) -> None:
        """Make scorecard objects exactly match the candidate's requested counts.

        Existing feedback/interviewer assignments are retained in insertion order. New
        entries use demo interviewers first, then candidate-scoped synthetic interviewers.
        Generated submitted entries carry completion state only, never recommendations.
        """
        if required_count < 0 or submitted_count < 0 or submitted_count > required_count:
            raise ValueError("Feedback counts are invalid")
        with self._lock:
            candidate = self.candidates.get(candidate_id)
            if candidate is None:
                raise ValueError("Unknown candidate")

            existing = [
                item for item in self.feedback.values() if item.candidate_id == candidate_id
            ]
            interviewer_ids = [item.interviewer_id for item in existing[:required_count]]
            for interviewer in demo_interviewers():
                if len(interviewer_ids) >= required_count:
                    break
                if interviewer.id not in interviewer_ids:
                    interviewer_ids.append(interviewer.id)

            while len(interviewer_ids) < required_count:
                index = len(interviewer_ids) + 1
                interviewer_id = f"int_generated_{candidate_id}_{index:02d}"
                if interviewer_id not in self.interviewers:
                    self.interviewers[interviewer_id] = Interviewer(
                        id=interviewer_id,
                        name=f"Synthetic Interviewer {index}",
                        email=f"{interviewer_id}@example.test",
                        role="Interview panelist",
                    )
                interviewer_ids.append(interviewer_id)

            synchronized: dict[str, Feedback] = {}
            submitted_at = candidate.interview_completed_at or candidate.stage_entered_at
            interview_id = f"iv_{candidate_id}_feedback"
            for index, interviewer_id in enumerate(interviewer_ids):
                prior = existing[index] if index < len(existing) else None
                is_submitted = index < submitted_count
                feedback_id = prior.id if prior else f"fb_{candidate_id}_{index + 1:02d}"
                synchronized[feedback_id] = Feedback(
                    id=feedback_id,
                    candidate_id=candidate_id,
                    interviewer_id=interviewer_id,
                    interview_id=prior.interview_id if prior else interview_id,
                    status="submitted" if is_submitted else "pending",
                    submitted_at=(
                        ((prior.submitted_at if prior else None) or submitted_at)
                        if is_submitted
                        else None
                    ),
                    recommendation=prior.recommendation if prior and is_submitted else None,
                    summary=prior.summary if prior and is_submitted else None,
                )

            self.feedback = {
                feedback_id: item
                for feedback_id, item in self.feedback.items()
                if item.candidate_id != candidate_id
            }
            self.feedback.update(synchronized)
            candidate.required_feedback_count = required_count
            self.candidates[candidate_id] = candidate

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

    def delete_candidate(self, candidate_id: str) -> bool:
        """Delete a candidate and all candidate-owned state, unless judgment is pending."""
        with self._lock:
            candidate = self.candidates.get(candidate_id)
            if candidate is None:
                return False
            if any(
                item.candidate_id == candidate_id and item.status == "pending"
                for item in self.decisions.values()
            ):
                raise PendingHumanDecisionError("Candidate has a pending human decision")

            self.feedback = {
                item_id: item
                for item_id, item in self.feedback.items()
                if item.candidate_id != candidate_id
            }
            self.communications = {
                item_id: item
                for item_id, item in self.communications.items()
                if item.candidate_id != candidate_id
            }
            self.actions = {
                item_id: item
                for item_id, item in self.actions.items()
                if item.candidate_id != candidate_id
            }
            self.decisions = {
                item_id: item
                for item_id, item in self.decisions.items()
                if item.candidate_id != candidate_id
            }
            generated_prefix = f"int_generated_{candidate_id}_"
            self.interviewers = {
                item_id: item
                for item_id, item in self.interviewers.items()
                if not item_id.startswith(generated_prefix)
            }
            del self.candidates[candidate_id]
            return True

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
