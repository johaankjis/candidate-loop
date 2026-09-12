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
SUPPORTED_MODEL_PROVIDERS: tuple[str, ...] = ("bedrock", "openrouter")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


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
    openrouter_api_key: str | None = None

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
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY") or None,
        )
        if settings.execution_mode == "strands":
            settings.validate_provider()
        return settings

    def validate_provider(self) -> None:
        """Fail fast when the selected provider cannot be constructed from these settings.

        Provider credentials are only demanded for the provider actually in use, so
        deterministic_local and strands+bedrock never require OPENROUTER_API_KEY and
        strands+openrouter never requires AWS settings.
        """
        if self.model_provider not in SUPPORTED_MODEL_PROVIDERS:
            supported = ", ".join(f"'{name}'" for name in SUPPORTED_MODEL_PROVIDERS)
            raise AgentConfigurationError(
                f"CANDIDATELOOP_MODEL_PROVIDER must be one of {supported}"
            )
        if not self.model_id:
            raise AgentConfigurationError(
                "CANDIDATELOOP_MODEL_ID is required when CANDIDATELOOP_EXECUTION_MODE=strands"
            )
        if self.model_provider == "openrouter" and not self.openrouter_api_key:
            raise AgentConfigurationError(
                "OPENROUTER_API_KEY is required when CANDIDATELOOP_MODEL_PROVIDER=openrouter"
            )

    @property
    def reported_execution_mode(self) -> str:
        if self.execution_mode == "deterministic_local":
            return self.execution_mode
        return f"strands_{self.model_provider}"
