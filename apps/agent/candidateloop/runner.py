from datetime import datetime
from uuid import uuid4

from candidateloop.config import DEMO_NOW, AgentSettings
from candidateloop.models import AgentAction, AgentRunResult, RunSummary, Stage
from candidateloop.policies import (
    candidate_needs_status_update,
    is_decision_ready,
    missing_feedback,
)
from candidateloop.repository import InMemoryRepository
from candidateloop.tools import RecruitingTools


class DeterministicAgentRunner:
    """Deterministic local/test/demo fallback for the operational workflow.

    It executes the same narrow tools and records the same evidence-backed events the
    Strands runtime will consume. The API labels this mode explicitly to avoid claiming
    model-driven behavior during local development.
    """

    def __init__(self, repository: InMemoryRepository, now: datetime = DEMO_NOW) -> None:
        self.repository = repository
        self.now = now
        self.tools = RecruitingTools(repository, now)

    def run(self) -> AgentRunResult:
        run_id = f"run_{uuid4().hex}"
        summary = RunSummary()
        for candidate in self.tools.get_active_candidates():
            summary.candidates_scanned += 1
            feedback = self.tools.get_interview_feedback(candidate.id)

            missing = missing_feedback(candidate, feedback, self.now)
            if missing:
                reminder = self.tools.send_feedback_reminder(
                    candidate.id, missing[0].interviewer_id
                )
                interviewer = self.repository.interviewer(missing[0].interviewer_id)
                if reminder:
                    submitted_count = len(feedback) - len(missing)
                    self._record(
                        run_id,
                        candidate.id,
                        "tool_action",
                        "send_feedback_reminder",
                        (
                            f"The interview is complete; {submitted_count} of "
                            f"{candidate.required_feedback_count} scorecards are submitted."
                        ),
                        "One required scorecard is still missing.",
                        f"Send a feedback reminder to {interviewer.name}.",
                        "Reminder sent and recorded successfully.",
                    )
                    summary.actions_taken += 1
                    summary.reminders_sent += 1
                else:
                    self._no_action(
                        run_id,
                        candidate.id,
                        "A feedback reminder was sent within the cooldown window.",
                    )
                    summary.no_action_needed += 1
                continue

            if candidate.stage == Stage.RECRUITER_REVIEW and candidate_needs_status_update(
                candidate, self.now
            ):
                self.tools.send_candidate_status_update(candidate.id)
                days_waiting = (self.now - candidate.last_candidate_contact_at).days
                self._record(
                    run_id,
                    candidate.id,
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
                summary.actions_taken += 1
                summary.candidate_updates_sent += 1
                continue

            if is_decision_ready(candidate, feedback):
                existing = self.repository.open_decision_for(candidate.id)
                decision = self.tools.create_human_decision(
                    candidate.id,
                    "Interview feedback is complete.",
                    (
                        f"{candidate.required_feedback_count}/"
                        f"{candidate.required_feedback_count} required scorecards received."
                    ),
                )
                if existing is None:
                    self._record(
                        run_id,
                        candidate.id,
                        "human_decision",
                        "create_human_decision",
                        (
                            f"All {candidate.required_feedback_count} required scorecards "
                            "are complete."
                        ),
                        (
                            "Operational prerequisites are complete; the next step requires "
                            "human hiring judgment."
                        ),
                        "Raise HUMAN DECISION REQUIRED.",
                        f"Decision {decision.id} created. No hiring disposition was made.",
                    )
                    summary.actions_taken += 1
                    summary.human_decisions_created += 1
                else:
                    self._no_action(run_id, candidate.id, "A human decision is already pending.")
                    summary.no_action_needed += 1
                continue

            if candidate.stage == Stage.PANEL_SCHEDULING:
                slots = self.tools.get_interviewer_availability(candidate.id)
                if slots:
                    slot = self.tools.schedule_interview(candidate.id, slots[0].id)
                    self._record(
                        run_id,
                        candidate.id,
                        "tool_action",
                        "schedule_interview",
                        (
                            "A recruiter explicitly advanced the candidate and panel scheduling "
                            "is required."
                        ),
                        "The earliest valid panel slot is available for all required interviewers.",
                        "Schedule the panel interview.",
                        f"Panel scheduled for {slot.start_at.isoformat()}.",
                    )
                    summary.actions_taken += 1
                    summary.interviews_scheduled += 1
                    continue

            if candidate.stage == Stage.RECRUITER_REVIEW:
                reason = "The candidate received a recent status update; no follow-up is due."
            elif candidate.next_interview_at and candidate.next_interview_at > self.now:
                reason = "The next interview is scheduled and all current coordination is complete."
            else:
                reason = "No safe operational action is currently required."
            self._no_action(run_id, candidate.id, reason)
            summary.no_action_needed += 1

        return AgentRunResult(
            run_id=run_id,
            execution_mode="deterministic_local",
            summary=summary,
            actions=self.repository.action_views(run_id),
        )

    def _no_action(self, run_id: str, candidate_id: str, reason: str) -> None:
        self._record(
            run_id,
            candidate_id,
            "no_action",
            "record_agent_note",
            "Candidate workflow inspected.",
            reason,
            "No action required.",
            "State left unchanged.",
        )

    def _record(
        self,
        run_id: str,
        candidate_id: str,
        event_type: str,
        tool: str,
        observed: str,
        reason: str,
        action: str,
        result: str,
    ) -> None:
        self.tools.record_action(
            AgentAction(
                id=f"action_{uuid4().hex}",
                run_id=run_id,
                candidate_id=candidate_id,
                event_type=event_type,
                tool=tool,
                observed=observed,
                reason=reason,
                action=action,
                result=result,
                created_at=self.now,
            )
        )


def build_agent_runner(repository: InMemoryRepository, settings: AgentSettings | None = None):
    """Select the explicitly configured runner without silently changing execution mode."""
    resolved = settings or AgentSettings.from_env()
    if resolved.execution_mode == "deterministic_local":
        return DeterministicAgentRunner(repository)

    from candidateloop.strands_runner import StrandsAgentRunner

    return StrandsAgentRunner(repository, settings=resolved)
