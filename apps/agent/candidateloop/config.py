import os
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

CANDIDATE_FOLLOWUP_AFTER_DAYS = 3
FEEDBACK_REMINDER_AFTER_HOURS = 24
FEEDBACK_REMINDER_COOLDOWN_HOURS = 24

# Keeping demo time fixed makes reset, tests, and recorded walkthroughs reproducible.
DEMO_NOW = datetime(2026, 9, 8, 16, 0, tzinfo=UTC)

ExecutionMode = Literal["deterministic_local", "strands"]


class AgentConfigurationError(ValueError):
    """Raised when the requested agent runtime cannot be configured safely."""


class AgentExecutionError(RuntimeError):
    """Raised when a configured model-driven run does not complete safely."""


@dataclass(frozen=True)
class AgentSettings:
    """Runtime settings loaded from environment variables for each request."""

    execution_mode: ExecutionMode = "deterministic_local"
    model_provider: str = "bedrock"
    model_id: str | None = None
    aws_region: str | None = None

    @classmethod
    def from_env(cls) -> "AgentSettings":
        execution_mode = os.getenv("CANDIDATELOOP_EXECUTION_MODE", "deterministic_local").strip()
        if execution_mode not in {"deterministic_local", "strands"}:
            raise AgentConfigurationError(
                "CANDIDATELOOP_EXECUTION_MODE must be 'deterministic_local' or 'strands'"
            )
        settings = cls(
            execution_mode=execution_mode,
            model_provider=os.getenv("CANDIDATELOOP_MODEL_PROVIDER", "bedrock").strip().lower(),
            model_id=os.getenv("CANDIDATELOOP_MODEL_ID") or None,
            aws_region=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or None,
        )
        if settings.execution_mode == "strands" and settings.model_provider != "bedrock":
            raise AgentConfigurationError(
                "CANDIDATELOOP_MODEL_PROVIDER currently supports only 'bedrock'"
            )
        if settings.execution_mode == "strands" and not settings.model_id:
            raise AgentConfigurationError(
                "CANDIDATELOOP_MODEL_ID is required when CANDIDATELOOP_EXECUTION_MODE=strands"
            )
        return settings

    @property
    def reported_execution_mode(self) -> str:
        if self.execution_mode == "deterministic_local":
            return self.execution_mode
        return f"strands_{self.model_provider}"
