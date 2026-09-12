from datetime import datetime
from enum import StrEnum

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator


class Stage(StrEnum):
    RECRUITER_REVIEW = "Recruiter Review"
    TECHNICAL_INTERVIEW = "Technical Interview"
    INTERVIEW_COMPLETE = "Interview Complete"
    PANEL_SCHEDULING = "Panel Scheduling"
    PANEL_INTERVIEW = "Panel Interview"
    ON_HOLD = "On Hold"
    CLOSED = "Closed"


class CandidateManagementStage(StrEnum):
    """Stages that generic candidate management may set without workflow authorization."""

    RECRUITER_REVIEW = Stage.RECRUITER_REVIEW
    TECHNICAL_INTERVIEW = Stage.TECHNICAL_INTERVIEW
    INTERVIEW_COMPLETE = Stage.INTERVIEW_COMPLETE


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


class CandidateCreateRequest(BaseModel):
    """Recruiter-editable candidate workflow fields accepted by the public API."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=120)
    stage: CandidateManagementStage
    stage_entered_at: AwareDatetime
    last_candidate_contact_at: AwareDatetime
    interview_completed_at: AwareDatetime | None = None
    next_interview_at: AwareDatetime | None = None
    required_feedback_count: int = Field(default=0, ge=0)
    submitted_feedback_count: int = Field(default=0, ge=0)

    @field_validator("name", "role")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("must not be blank")
        return normalized

    @model_validator(mode="after")
    def validate_feedback_counts(self):
        if self.submitted_feedback_count > self.required_feedback_count:
            raise ValueError("submitted_feedback_count cannot exceed required_feedback_count")
        return self


class CandidateUpdateRequest(BaseModel):
    """Partial recruiter edit; omitted fields retain their current values."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, min_length=1, max_length=120)
    stage: CandidateManagementStage | None = None
    stage_entered_at: AwareDatetime | None = None
    last_candidate_contact_at: AwareDatetime | None = None
    interview_completed_at: AwareDatetime | None = None
    next_interview_at: AwareDatetime | None = None
    required_feedback_count: int | None = Field(default=None, ge=0)
    submitted_feedback_count: int | None = Field(default=None, ge=0)

    @field_validator("name", "role")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("cannot be null")
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("must not be blank")
        return normalized

    @model_validator(mode="after")
    def validate_patch(self):
        non_nullable = {
            "name",
            "role",
            "stage",
            "stage_entered_at",
            "last_candidate_contact_at",
            "required_feedback_count",
            "submitted_feedback_count",
        }
        null_fields = sorted(
            field for field in self.model_fields_set & non_nullable if getattr(self, field) is None
        )
        if null_fields:
            raise ValueError(f"{', '.join(null_fields)} cannot be null")
        if (
            self.required_feedback_count is not None
            and self.submitted_feedback_count is not None
            and self.submitted_feedback_count > self.required_feedback_count
        ):
            raise ValueError("submitted_feedback_count cannot exceed required_feedback_count")
        if not self.model_fields_set:
            raise ValueError("at least one candidate field is required")
        return self


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
