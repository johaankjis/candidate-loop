from pathlib import Path
from typing import Any
from uuid import uuid4

from candidateloop.config import (
    DEMO_NOW,
    OPENROUTER_BASE_URL,
    SUPPORTED_MODEL_PROVIDERS,
    AgentConfigurationError,
    AgentExecutionError,
    AgentSettings,
)
from candidateloop.models import AgentRunResult
from candidateloop.repository import InMemoryRepository
from candidateloop.strands_tools import StrandsRecruitingToolAdapter

RUN_INSTRUCTION = """Run one complete CandidateLoop operational pass now.

Start by calling get_active_candidates. Process every returned candidate exactly once. Use the
inspection tools before selecting an action. Use only safe coordination tools, call
record_no_action when no write or escalation is warranted, and finish only after every active
candidate has been handled. Do not assess candidate quality or make a hiring disposition.
"""
MAX_AGENT_TURNS = 40


class StrandsAgentRunner:
    """Run CandidateLoop's model-driven loop through the real Strands Agents SDK."""

    def __init__(
        self,
        repository: InMemoryRepository,
        settings: AgentSettings | None = None,
        model: Any | None = None,
    ) -> None:
        self.repository = repository
        self.settings = settings or AgentSettings.from_env()
        self.model = model

    def build_agent(self, adapter: StrandsRecruitingToolAdapter):
        try:
            from strands import Agent
            from strands.tools.executors import SequentialToolExecutor
        except ImportError as error:
            raise AgentConfigurationError(
                "Strands mode requires the 'strands' dependency group"
            ) from error

        return Agent(
            model=self.model or self.build_model(),
            tools=adapter.build(),
            system_prompt=self._system_prompt(),
            callback_handler=None,
            context_manager=False,
            tool_executor=SequentialToolExecutor(),
            name="CandidateLoop",
            description="Safe recruiting operations coordination agent",
        )

    def run(self) -> AgentRunResult:
        run_id = f"run_{uuid4().hex}"
        adapter = StrandsRecruitingToolAdapter(self.repository, run_id, DEMO_NOW)
        snapshot = self.repository.snapshot()
        try:
            agent = self.build_agent(adapter)
            agent(RUN_INSTRUCTION, limits={"turns": MAX_AGENT_TURNS})
            adapter.assert_complete()
        except AgentConfigurationError:
            self.repository.restore(snapshot)
            raise
        except Exception as error:
            self.repository.restore(snapshot)
            raise AgentExecutionError(
                "Strands execution did not complete a safe operational pass; "
                "all run changes were rolled back."
            ) from error
        return AgentRunResult(
            run_id=run_id,
            execution_mode=self.settings.reported_execution_mode,
            summary=adapter.summary,
            actions=self.repository.action_views(run_id),
        )

    def build_model(self):
        """Construct the configured Strands model provider without invoking it."""
        builders = {
            "bedrock": self._build_bedrock_model,
            "openrouter": self._build_openrouter_model,
        }
        builder = builders.get(self.settings.model_provider)
        if builder is None:
            supported = ", ".join(f"'{name}'" for name in SUPPORTED_MODEL_PROVIDERS)
            raise AgentConfigurationError(
                f"CANDIDATELOOP_MODEL_PROVIDER must be one of {supported}"
            )
        return builder()

    def _build_bedrock_model(self):
        if not self.settings.model_id:
            raise AgentConfigurationError(
                "CANDIDATELOOP_MODEL_ID is required when CANDIDATELOOP_EXECUTION_MODE=strands"
            )
        try:
            from strands.models import BedrockModel
        except ImportError as error:
            raise AgentConfigurationError(
                "Strands mode requires the 'strands' dependency group"
            ) from error

        model_options: dict[str, Any] = {
            "model_id": self.settings.model_id,
            "temperature": 0,
        }
        if self.settings.aws_region:
            model_options["region_name"] = self.settings.aws_region
        return BedrockModel(**model_options)

    def _build_openrouter_model(self):
        # OpenRouter exposes an OpenAI-compatible API, so it runs through Strands' OpenAI
        # provider pointed at the OpenRouter base URL. The agent loop, tool adapter, and
        # rollback behavior are identical to the Bedrock path.
        if not self.settings.model_id:
            raise AgentConfigurationError(
                "CANDIDATELOOP_MODEL_ID is required when CANDIDATELOOP_EXECUTION_MODE=strands"
            )
        if not self.settings.openrouter_api_key:
            raise AgentConfigurationError(
                "OPENROUTER_API_KEY is required when CANDIDATELOOP_MODEL_PROVIDER=openrouter"
            )
        try:
            from strands.models.openai import OpenAIModel
        except ImportError as error:
            raise AgentConfigurationError(
                "OpenRouter mode requires the 'strands-agents[openai]' dependency"
            ) from error

        return OpenAIModel(
            client_args={
                "api_key": self.settings.openrouter_api_key,
                "base_url": OPENROUTER_BASE_URL,
            },
            model_id=self.settings.model_id,
            params={"temperature": 0},
        )

    @staticmethod
    def _system_prompt() -> str:
        prompt_path = Path(__file__).parent / "prompts" / "system.md"
        return prompt_path.read_text(encoding="utf-8")
