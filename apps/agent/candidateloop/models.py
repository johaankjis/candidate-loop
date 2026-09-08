from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class Stage(StrEnum):
    RECRUITER_REVIEW = "Recruiter Review"
    TECHNICAL_INTERVIEW = "Technical Interview"
    INTERVIEW_COMPLETE = "Interview Complete"
    PANEL_SCHEDULING = "Panel Scheduling"
    PANEL_INTERVIEW = "Panel Interview"
    ON_HOLD = "On Hold"
    CLOSED = "Closed"


class DecisionStatus(StrEnum):
    NONE = "none"
    PENDING = "pending"
    RESOLVED = "resolved"


class DecisionResolution(StrEnum):
    ADVANCE = "ADVANCE"
    HOLD = "HOLD"
    REJECT = "REJECT"


class FeedbackStatus(StrEnum):
    PENDING = "pending"
    SUBMITTED = "submitted"


class Candidate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    name: str
    initials: str
    role: str
    stage: Stage
    stage_entered_at: datetime
    status: str = "active"
    last_candidate_contact_at: datetime
    interview_completed_at: datetime | None = None
    next_interview_at: datetime | None = None
    required_feedback_count: int = 0
    human_decision_status: DecisionStatus = DecisionStatus.NONE
    last_human_resolution: DecisionResolution | None = None


class Interviewer(BaseModel):
    id: str
    name: str
    email: str
    role: str


class Feedback(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    candidate_id: str
    interviewer_id: str
    interview_id: str
    status: FeedbackStatus
    submitted_at: datetime | None = None
    recommendation: str | None = None
    summary: str | None = None


class AvailabilitySlot(BaseModel):
    id: str
    interviewer_ids: list[str]
    start_at: datetime
    end_at: datetime
    available: bool = True


class Communication(BaseModel):
    id: str
    candidate_id: str
    recipient_type: str
    recipient_id: str
    type: str
    subject: str
    body: str
    created_at: datetime
    status: str = "sent"


class HumanDecision(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    candidate_id: str
    decision_type: str = "hiring_disposition"
    reason: str
    evidence: str
    status: DecisionStatus = DecisionStatus.PENDING
    created_at: datetime
    resolved_at: datetime | None = None
    resolution: DecisionResolution | None = None


class AgentAction(BaseModel):
    id: str
    run_id: str
    candidate_id: str
    event_type: str
    tool: str
    observed: str
    reason: str
    action: str
    result: str
    created_at: datetime


class CandidateView(Candidate):
    days_in_stage: int
    submitted_feedback_count: int


class AgentActionView(AgentAction):
    candidate_name: str


class HumanDecisionView(HumanDecision):
    candidate_name: str
    role: str


class RunSummary(BaseModel):
    candidates_scanned: int = 0
    actions_taken: int = 0
    reminders_sent: int = 0
    candidate_updates_sent: int = 0
    human_decisions_created: int = 0
    interviews_scheduled: int = 0
    no_action_needed: int = 0


class AgentRunResult(BaseModel):
    run_id: str
    execution_mode: str
    summary: RunSummary
    actions: list[AgentActionView]


class ResolveDecisionRequest(BaseModel):
    resolution: DecisionResolution
