from datetime import datetime
from typing import Any
from uuid import uuid4

from candidateloop.config import DEMO_NOW
from candidateloop.models import AgentAction, RunSummary, Stage
from candidateloop.policies import (
    candidate_needs_status_update,
    is_decision_ready,
    missing_feedback,
)
from candidateloop.repository import InMemoryRepository
from candidateloop.tools import RecruitingTools

STRANDS_TOOL_NAMES = frozenset(
    {
        "get_active_candidates",
        "get_candidate",
        "get_interview_feedback",
        "get_interviewer_availability",
        "send_feedback_reminder",
        "send_candidate_status_update",
        "schedule_interview",
        "create_human_decision",
        "record_no_action",
    }
)

FORBIDDEN_AGENT_TOOL_TERMS = frozenset(
    {"advance", "reject", "hire", "rank", "score", "resolve_decision"}
)


class StrandsRecruitingToolAdapter:
    """Expose RecruitingTools to Strands without exposing hiring dispositions."""

    def __init__(
        self,
        repository: InMemoryRepository,
        run_id: str,
        now: datetime = DEMO_NOW,
    ) -> None:
        self.repository = repository
        self.run_id = run_id
        self.now = now
        self.operations = RecruitingTools(repository, now)
        self.summary = RunSummary()

    def build(self) -> list[Any]:
        """Create stateful Strands function tools bound to this single run."""
        from strands import tool

        @tool
        def get_active_candidates() -> list[dict[str, Any]]:
            """List every active synthetic candidate workflow that must be processed."""
            candidates = self.operations.get_active_candidates()
            self.summary.candidates_scanned = len(candidates)
            return [candidate.model_dump(mode="json") for candidate in candidates]

        @tool
        def get_candidate(candidate_id: str) -> dict[str, Any]:
            """Inspect one synthetic candidate's operational workflow state.

            Args:
                candidate_id: Candidate identifier returned by get_active_candidates.
            """
            candidate = self.operations.get_candidate(candidate_id)
            if candidate is None:
                raise ValueError("Unknown candidate")
            return candidate.model_dump(mode="json")

        @tool
        def get_interview_feedback(candidate_id: str) -> list[dict[str, Any]]:
            """Inspect scorecard completion status, never candidate quality.

            Args:
                candidate_id: Candidate identifier returned by get_active_candidates.
            """
            return [
                {
                    "id": item.id,
                    "candidate_id": item.candidate_id,
                    "interviewer_id": item.interviewer_id,
                    "status": item.status,
                    "submitted_at": item.submitted_at.isoformat() if item.submitted_at else None,
                }
                for item in self.operations.get_interview_feedback(candidate_id)
            ]

        @tool
        def get_interviewer_availability(candidate_id: str) -> list[dict[str, Any]]:
            """List panel slots only after an explicit human Advance permits scheduling.

            Args:
                candidate_id: Candidate identifier to schedule.
            """
            return [
                slot.model_dump(mode="json")
                for slot in self.operations.get_interviewer_availability(candidate_id)
            ]

        @tool
        def send_feedback_reminder(candidate_id: str, interviewer_id: str) -> dict[str, Any]:
            """Send one simulated reminder for overdue pending feedback.

            Duplicate reminders inside the cooldown are skipped by the operational tool.

            Args:
                candidate_id: Candidate with overdue pending feedback.
                interviewer_id: Interviewer whose feedback is pending.
            """
            candidate = self._candidate(candidate_id)
            feedback = self.operations.get_interview_feedback(candidate_id)
            missing_count = sum(item.status == "pending" for item in feedback)
            communication = self.operations.send_feedback_reminder(candidate_id, interviewer_id)
            if communication is None:
                self._record_no_action(
                    candidate_id,
                    "A feedback reminder was sent within the cooldown window.",
                )
                return {"status": "skipped", "reason": "reminder cooldown is active"}
            interviewer = self.repository.interviewer(interviewer_id)
            self._record(
                candidate_id,
                "tool_action",
                "send_feedback_reminder",
                (
                    f"The interview is complete; {len(feedback) - missing_count} of "
                    f"{candidate.required_feedback_count} scorecards are submitted."
                ),
                "One required scorecard is still missing.",
                f"Send a feedback reminder to {interviewer.name}.",
                "Reminder sent and recorded successfully.",
            )
            self.summary.actions_taken += 1
            self.summary.reminders_sent += 1
            return {"status": "sent", "communication_id": communication.id}

        @tool
        def send_candidate_status_update(candidate_id: str) -> dict[str, Any]:
            """Send a neutral simulated update when a recruiter-review candidate is stale.

            The fixed message never predicts advancement, rejection, hiring, or an offer.

            Args:
                candidate_id: Candidate identifier returned by get_active_candidates.
            """
            candidate = self._candidate(candidate_id)
            days_waiting = (self.now - candidate.last_candidate_contact_at).days
            communication = self.operations.send_candidate_status_update(candidate_id)
            if communication is None:
                self._record_no_action(
                    candidate_id,
                    "The candidate is not due for a status update.",
                )
                return {"status": "skipped", "reason": "status update is not due"}
            self._record(
                candidate_id,
                "tool_action",
                "send_candidate_status_update",
                f"The candidate has been waiting {days_waiting} days without an update.",
                (
                    "A neutral status message is safe and keeps the candidate informed "
                    "without implying an outcome."
                ),
                "Send a candidate status update.",
                "Status update sent and the communication timestamp was refreshed.",
            )
            self.summary.actions_taken += 1
            self.summary.candidate_updates_sent += 1
            return {"status": "sent", "communication_id": communication.id}

        @tool
        def schedule_interview(candidate_id: str, slot_id: str) -> dict[str, Any]:
            """Schedule a panel only when a recorded human Advance permits it.

            Args:
                candidate_id: Candidate in Panel Scheduling after human Advance.
                slot_id: Available slot returned by get_interviewer_availability.
            """
            slot = self.operations.schedule_interview(candidate_id, slot_id)
            self._record(
                candidate_id,
                "tool_action",
                "schedule_interview",
                "A recruiter explicitly advanced the candidate and panel scheduling is required.",
                "The selected panel slot is available for all required interviewers.",
                "Schedule the panel interview.",
                f"Panel scheduled for {slot.start_at.isoformat()}.",
            )
            self.summary.actions_taken += 1
            self.summary.interviews_scheduled += 1
            return {"status": "scheduled", "slot": slot.model_dump(mode="json")}

        @tool
        def create_human_decision(candidate_id: str) -> dict[str, Any]:
            """Escalate a decision-ready workflow without making a hiring disposition.

            Args:
                candidate_id: Candidate whose required interview feedback is complete.
            """
            candidate = self._candidate(candidate_id)
            existing = self.repository.open_decision_for(candidate_id)
            decision = self.operations.create_human_decision(
                candidate_id,
                "Interview feedback is complete.",
                (
                    f"{candidate.required_feedback_count}/"
                    f"{candidate.required_feedback_count} required scorecards received."
                ),
            )
            if existing is not None:
                self._record_no_action(candidate_id, "A human decision is already pending.")
                return {"status": "skipped", "decision_id": decision.id}
            self._record(
                candidate_id,
                "human_decision",
                "create_human_decision",
                f"All {candidate.required_feedback_count} required scorecards are complete.",
                (
                    "Operational prerequisites are complete; the next step requires "
                    "human hiring judgment."
                ),
                "Raise HUMAN DECISION REQUIRED.",
                f"Decision {decision.id} created. No hiring disposition was made.",
            )
            self.summary.actions_taken += 1
            self.summary.human_decisions_created += 1
            return {"status": "created", "decision_id": decision.id}

        @tool
        def record_no_action(candidate_id: str) -> dict[str, str]:
            """Record that an inspected candidate needs no safe operational action.

            Args:
                candidate_id: Candidate identifier returned by get_active_candidates.
            """
            candidate = self._candidate(candidate_id)
            feedback = self.operations.get_interview_feedback(candidate_id)
            if missing_feedback(candidate, feedback, self.now):
                raise ValueError("Candidate has overdue pending feedback")
            if candidate.stage == Stage.RECRUITER_REVIEW and candidate_needs_status_update(
                candidate, self.now
            ):
                raise ValueError("Candidate is due for a status update")
            if is_decision_ready(candidate, feedback) and not self.repository.open_decision_for(
                candidate_id
            ):
                raise ValueError("Candidate requires a human decision escalation")
            if (
                candidate.stage == Stage.PANEL_SCHEDULING
                and self.operations.get_interviewer_availability(candidate_id)
            ):
                raise ValueError("Candidate has an available human-approved scheduling action")
            if candidate.stage == Stage.RECRUITER_REVIEW:
                reason = "The candidate received a recent status update; no follow-up is due."
            elif candidate.human_decision_status == "pending":
                reason = "A human decision is already pending."
            elif candidate.next_interview_at and candidate.next_interview_at > self.now:
                reason = "The next interview is scheduled and current coordination is complete."
            else:
                reason = "No safe operational action is currently required."
            self._record_no_action(candidate_id, reason)
            return {"status": "recorded", "reason": reason}

        tools = [
            get_active_candidates,
            get_candidate,
            get_interview_feedback,
            get_interviewer_availability,
            send_feedback_reminder,
            send_candidate_status_update,
            schedule_interview,
            create_human_decision,
            record_no_action,
        ]
        names = {item.tool_name for item in tools}
        if names != STRANDS_TOOL_NAMES:
            raise RuntimeError("Strands recruiting tool allowlist does not match registered tools")
        if any(term in name for term in FORBIDDEN_AGENT_TOOL_TERMS for name in names):
            raise RuntimeError("A forbidden hiring-judgment tool was registered")
        return tools

    def _candidate(self, candidate_id: str):
        candidate = self.repository.candidate(candidate_id)
        if candidate is None:
            raise ValueError("Unknown candidate")
        return candidate

    def _record_no_action(self, candidate_id: str, reason: str) -> None:
        self._record(
            candidate_id,
            "no_action",
            "record_agent_note",
            "Candidate workflow inspected.",
            reason,
            "No action required.",
            "State left unchanged.",
        )
        self.summary.no_action_needed += 1

    def _record(
        self,
        candidate_id: str,
        event_type: str,
        tool_name: str,
        observed: str,
        reason: str,
        action: str,
        result: str,
    ) -> None:
        self.operations.record_action(
            AgentAction(
                id=f"action_{uuid4().hex}",
                run_id=self.run_id,
                candidate_id=candidate_id,
                event_type=event_type,
                tool=tool_name,
                observed=observed,
                reason=reason,
                action=action,
                result=result,
                created_at=self.now,
            )
        )
