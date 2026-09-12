import pytest
from fastapi.testclient import TestClient

from api.main import app
from candidateloop.config import (
    OPENROUTER_BASE_URL,
    AgentConfigurationError,
    AgentExecutionError,
    AgentSettings,
)
from candidateloop.repository import repository
from candidateloop.runner import DeterministicAgentRunner
from candidateloop.strands_runner import StrandsAgentRunner
from candidateloop.strands_tools import (
    FORBIDDEN_AGENT_TOOL_TERMS,
    STRANDS_TOOL_NAMES,
    StrandsRecruitingToolAdapter,
)
from candidateloop.tools import SAFE_CANDIDATE_STATUS_BODY
from tests.scripted_model import ScriptedModel, final_response, parallel_tool_calls, tool_call


def strands_runner(*responses):
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="bedrock",
        model_id="scripted-test-model",
    )
    return StrandsAgentRunner(repository, settings, ScriptedModel(responses))


def openrouter_runner(*responses):
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="openrouter",
        model_id="scripted-test-model",
        openrouter_api_key="test-openrouter-key",
    )
    return StrandsAgentRunner(repository, settings, ScriptedModel(responses))


def safe_seeded_pass(prefix: str = ""):
    return (
        tool_call(f"{prefix}1", "get_active_candidates"),
        tool_call(f"{prefix}2", "get_interview_feedback", {"candidate_id": "cand_sarah"}),
        tool_call(
            f"{prefix}3",
            "send_feedback_reminder",
            {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
        ),
        tool_call(f"{prefix}4", "get_candidate", {"candidate_id": "cand_david"}),
        tool_call(f"{prefix}5", "send_candidate_status_update", {"candidate_id": "cand_david"}),
        tool_call(f"{prefix}6", "get_interview_feedback", {"candidate_id": "cand_emily"}),
        tool_call(f"{prefix}7", "create_human_decision", {"candidate_id": "cand_emily"}),
        tool_call(f"{prefix}8", "get_candidate", {"candidate_id": "cand_marcus"}),
        tool_call(f"{prefix}9", "record_no_action", {"candidate_id": "cand_marcus"}),
        final_response(),
    )


def test_real_strands_loop_performs_seeded_safe_actions():
    runner = strands_runner(
        tool_call("1", "get_active_candidates"),
        tool_call("2", "get_interview_feedback", {"candidate_id": "cand_sarah"}),
        tool_call(
            "3",
            "send_feedback_reminder",
            {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
        ),
        tool_call("4", "get_interview_feedback", {"candidate_id": "cand_david"}),
        tool_call("5", "send_candidate_status_update", {"candidate_id": "cand_david"}),
        tool_call("6", "get_interview_feedback", {"candidate_id": "cand_emily"}),
        tool_call("7", "create_human_decision", {"candidate_id": "cand_emily"}),
        tool_call("8", "get_interview_feedback", {"candidate_id": "cand_marcus"}),
        tool_call("9", "record_no_action", {"candidate_id": "cand_marcus"}),
        final_response(),
    )

    result = runner.run()

    assert result.execution_mode == "strands_bedrock"
    assert result.summary.candidates_scanned == 4
    assert result.summary.reminders_sent == 1
    assert result.summary.candidate_updates_sent == 1
    assert result.summary.human_decisions_created == 1
    assert result.summary.no_action_needed == 1
    assert repository.candidate("cand_emily").stage == "Interview Complete"
    assert repository.candidate("cand_emily").human_decision_status == "pending"
    david_messages = [
        communication
        for communication in repository.communications_for("cand_david")
        if communication.type == "candidate_status_update"
    ]
    assert len(david_messages) == 1
    assert david_messages[0].body == SAFE_CANDIDATE_STATUS_BODY.format(first_name="David")
    assert repository.communications_for("cand_marcus") == []
    assert repository.open_decision_for("cand_marcus") is None
    assert repository.candidate("cand_marcus").next_interview_at.isoformat() == (
        "2026-09-09T14:00:00+00:00"
    )
    assert {spec["name"] for spec in runner.model.tool_specs_history[0]} == STRANDS_TOOL_NAMES
    assert "CandidateLoop operating policy" in runner.model.system_prompts[0]


def test_strands_agent_registers_only_allowlisted_non_judgment_tools():
    runner = strands_runner(final_response())
    adapter = StrandsRecruitingToolAdapter(repository, "run_registry_test")

    agent = runner.build_agent(adapter)

    assert set(agent.tool_names) == STRANDS_TOOL_NAMES
    assert not {
        "advance_candidate",
        "hold_candidate",
        "reject_candidate",
        "hire_candidate",
        "rank_candidates",
        "score_candidate",
        "resolve_decision",
    }.intersection(agent.tool_names)
    assert all(term not in name for name in agent.tool_names for term in FORBIDDEN_AGENT_TOOL_TERMS)
    tool_configs = agent.tool_registry.get_all_tools_config()
    assert set(tool_configs) == STRANDS_TOOL_NAMES
    exposed_parameters = {
        parameter
        for config in tool_configs.values()
        for parameter in config["inputSchema"]["json"]["properties"]
    }
    assert not {
        "advance",
        "hold",
        "reject",
        "hire",
        "rank",
        "score",
        "resolution",
        "decision",
    }.intersection(exposed_parameters)


def test_bedrock_model_uses_configured_model_and_region_without_invocation():
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="bedrock",
        model_id="us.amazon.nova-lite-v1:0",
        aws_region="us-east-1",
    )

    model = StrandsAgentRunner(repository, settings)._build_bedrock_model()

    assert model.get_config()["model_id"] == "us.amazon.nova-lite-v1:0"
    assert model.client.meta.region_name == "us-east-1"


def test_openrouter_strands_loop_reports_openrouter_and_keeps_safe_actions():
    runner = openrouter_runner(*safe_seeded_pass("openrouter_"))

    result = runner.run()

    assert result.execution_mode == "strands_openrouter"
    assert result.summary.candidates_scanned == 4
    assert result.summary.actions_taken == 3
    assert result.summary.interviews_scheduled == 0
    assert repository.candidate("cand_emily").human_decision_status == "pending"
    assert repository.communications_for("cand_marcus") == []
    assert {spec["name"] for spec in runner.model.tool_specs_history[0]} == STRANDS_TOOL_NAMES


def test_openrouter_model_uses_strands_openai_provider_with_openrouter_base_url(monkeypatch):
    for name in ("AWS_REGION", "AWS_DEFAULT_REGION", "AWS_PROFILE", "AWS_ACCESS_KEY_ID"):
        monkeypatch.delenv(name, raising=False)
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="openrouter",
        model_id="openai/gpt-4o-mini",
        openrouter_api_key="test-openrouter-key",
    )

    model = StrandsAgentRunner(repository, settings).build_model()

    from strands.models.openai import OpenAIModel

    assert isinstance(model, OpenAIModel)
    assert model.get_config()["model_id"] == "openai/gpt-4o-mini"
    assert model.get_config()["params"] == {"temperature": 0}
    assert model.client_args == {
        "api_key": "test-openrouter-key",
        "base_url": OPENROUTER_BASE_URL,
    }
    assert OPENROUTER_BASE_URL == "https://openrouter.ai/api/v1"


def test_model_factory_passes_openrouter_settings_to_openai_model(monkeypatch):
    captured: dict = {}

    class FakeOpenAIModel:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr("strands.models.openai.OpenAIModel", FakeOpenAIModel)
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="openrouter",
        model_id="anthropic/claude-3.5-haiku",
        openrouter_api_key="test-openrouter-key",
    )

    model = StrandsAgentRunner(repository, settings).build_model()

    assert isinstance(model, FakeOpenAIModel)
    assert captured["model_id"] == "anthropic/claude-3.5-haiku"
    assert captured["client_args"]["base_url"] == OPENROUTER_BASE_URL
    assert captured["client_args"]["api_key"] == "test-openrouter-key"


def test_model_factory_dispatches_bedrock_without_openrouter_credentials():
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="bedrock",
        model_id="us.amazon.nova-lite-v1:0",
        aws_region="us-east-1",
    )

    model = StrandsAgentRunner(repository, settings).build_model()

    from strands.models import BedrockModel

    assert isinstance(model, BedrockModel)
    assert model.get_config()["model_id"] == "us.amazon.nova-lite-v1:0"


def test_model_factory_requires_openrouter_api_key():
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="openrouter",
        model_id="openai/gpt-4o-mini",
    )

    with pytest.raises(AgentConfigurationError, match="OPENROUTER_API_KEY"):
        StrandsAgentRunner(repository, settings).build_model()


def test_model_factory_requires_openrouter_model_id():
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="openrouter",
        openrouter_api_key="test-openrouter-key",
    )

    with pytest.raises(AgentConfigurationError, match="CANDIDATELOOP_MODEL_ID"):
        StrandsAgentRunner(repository, settings).build_model()


def test_model_factory_rejects_unsupported_provider():
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="unsupported",
        model_id="some-model",
    )

    with pytest.raises(AgentConfigurationError, match="must be one of 'bedrock', 'openrouter'"):
        StrandsAgentRunner(repository, settings).build_model()


def test_unsupported_provider_run_rolls_back_before_any_model_call():
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="unsupported",
        model_id="some-model",
    )

    with pytest.raises(AgentConfigurationError):
        StrandsAgentRunner(repository, settings).run()

    assert repository.actions == {}


def test_strands_feedback_view_excludes_candidate_quality_evidence():
    runner = strands_runner(final_response())
    adapter = StrandsRecruitingToolAdapter(repository, "run_feedback_view_test")
    agent = runner.build_agent(adapter)

    result = agent.tool.get_interview_feedback(candidate_id="cand_emily")
    content = result["content"][0]["text"]

    assert "recommendation" not in content
    assert "summary" not in content
    assert "positive" not in content
    assert "mixed" not in content


def test_strands_parallel_duplicate_calls_create_one_operational_write():
    runner = strands_runner(
        tool_call("1", "get_active_candidates"),
        tool_call("1a", "get_interview_feedback", {"candidate_id": "cand_sarah"}),
        parallel_tool_calls(
            (
                "2a",
                "send_feedback_reminder",
                {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
            ),
            (
                "2b",
                "send_feedback_reminder",
                {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
            ),
        ),
        tool_call("3", "get_candidate", {"candidate_id": "cand_david"}),
        tool_call("4", "send_candidate_status_update", {"candidate_id": "cand_david"}),
        tool_call("5", "get_interview_feedback", {"candidate_id": "cand_emily"}),
        tool_call("6", "create_human_decision", {"candidate_id": "cand_emily"}),
        tool_call("7", "get_candidate", {"candidate_id": "cand_marcus"}),
        tool_call("8", "record_no_action", {"candidate_id": "cand_marcus"}),
        final_response(),
    )

    result = runner.run()

    reminders = [
        item for item in repository.communications.values() if item.type == "feedback_reminder"
    ]
    assert len(reminders) == 1
    assert result.summary.reminders_sent == 1
    assert result.summary.no_action_needed == 2


def test_repeated_strands_runs_prevent_all_duplicate_operational_writes():
    first = strands_runner(*safe_seeded_pass("first_"))
    first.run()
    communication_count = len(repository.communications)
    decision_count = len(repository.decisions)
    second = strands_runner(*safe_seeded_pass("second_"))

    result = second.run()

    assert len(repository.communications) == communication_count
    assert len(repository.decisions) == decision_count
    assert result.summary.actions_taken == 0
    assert result.summary.no_action_needed == 4


def test_strands_cannot_schedule_without_human_advance():
    runner = strands_runner(final_response())
    adapter = StrandsRecruitingToolAdapter(repository, "run_schedule_boundary")
    agent = runner.build_agent(adapter)

    result = agent.tool.schedule_interview(candidate_id="cand_emily", slot_id="slot_panel_01")

    emily = repository.candidate("cand_emily")
    assert result["status"] == "error"
    assert "explicit human advance" in result["content"][0]["text"]
    assert adapter.summary.interviews_scheduled == 0
    assert emily.stage == "Interview Complete"
    assert emily.next_interview_at is None
    assert repository.available_slots()[0].available is True


def test_strands_cannot_escalate_candidate_before_decision_ready():
    runner = strands_runner(final_response())
    adapter = StrandsRecruitingToolAdapter(repository, "run_decision_boundary")
    agent = runner.build_agent(adapter)

    result = agent.tool.create_human_decision(candidate_id="cand_marcus")

    assert result["status"] == "error"
    assert "complete interview feedback" in result["content"][0]["text"]
    assert adapter.summary.human_decisions_created == 0
    assert repository.open_decision_for("cand_marcus") is None
    assert repository.candidate("cand_marcus").human_decision_status == "none"


def test_strands_cannot_record_no_action_when_safe_work_is_due():
    runner = strands_runner(final_response())
    adapter = StrandsRecruitingToolAdapter(repository, "run_no_action_boundary")
    agent = runner.build_agent(adapter)

    result = agent.tool.record_no_action(candidate_id="cand_sarah")

    assert result["status"] == "error"
    assert "overdue pending feedback" in result["content"][0]["text"]
    assert adapter.summary.no_action_needed == 0
    assert repository.action_views("run_no_action_boundary") == []


def test_incomplete_strands_run_rolls_back_partial_writes():
    runner = strands_runner(
        tool_call("1", "get_active_candidates"),
        tool_call(
            "2",
            "send_feedback_reminder",
            {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
        ),
        final_response(),
    )

    with pytest.raises(AgentExecutionError, match="rolled back"):
        runner.run()

    assert repository.communications == {}
    assert repository.actions == {}


def test_wrong_skipped_tool_cannot_satisfy_complete_strands_pass():
    runner = strands_runner(
        tool_call("1", "get_active_candidates"),
        tool_call("2", "send_candidate_status_update", {"candidate_id": "cand_sarah"}),
        tool_call("3", "send_candidate_status_update", {"candidate_id": "cand_david"}),
        tool_call("4", "create_human_decision", {"candidate_id": "cand_emily"}),
        tool_call("5", "record_no_action", {"candidate_id": "cand_marcus"}),
        final_response(),
    )

    with pytest.raises(AgentExecutionError, match="rolled back"):
        runner.run()

    assert repository.communications == {}
    assert repository.decisions == {}
    assert repository.actions == {}


def test_api_executes_the_real_strands_loop(monkeypatch):
    runner = strands_runner(*safe_seeded_pass("api_"))
    monkeypatch.setattr("api.main.build_agent_runner", lambda _: runner)

    with TestClient(app) as client:
        response = client.post("/api/agent/run")

    assert response.status_code == 200
    assert response.json()["execution_mode"] == "strands_bedrock"
    assert response.json()["summary"]["actions_taken"] == 3
    assert len(runner.model.tool_specs_history) == 10


def test_api_health_reports_strands_openrouter(monkeypatch):
    for name in ("AWS_REGION", "AWS_DEFAULT_REGION"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("CANDIDATELOOP_EXECUTION_MODE", "strands")
    monkeypatch.setenv("CANDIDATELOOP_MODEL_PROVIDER", "openrouter")
    monkeypatch.setenv("CANDIDATELOOP_MODEL_ID", "openai/gpt-4o-mini")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-openrouter-key")

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["execution_mode"] == "strands_openrouter"


def test_api_executes_openrouter_strands_loop(monkeypatch):
    runner = openrouter_runner(*safe_seeded_pass("api_openrouter_"))
    monkeypatch.setattr("api.main.build_agent_runner", lambda _: runner)

    with TestClient(app) as client:
        response = client.post("/api/agent/run")

    assert response.status_code == 200
    assert response.json()["execution_mode"] == "strands_openrouter"
    assert response.json()["summary"]["actions_taken"] == 3


def test_api_reports_incomplete_strands_run_without_fallback(monkeypatch):
    runner = strands_runner(
        tool_call("1", "get_active_candidates"),
        tool_call(
            "2",
            "send_feedback_reminder",
            {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
        ),
        final_response(),
    )
    monkeypatch.setattr("api.main.build_agent_runner", lambda _: runner)

    with TestClient(app) as client:
        response = client.post("/api/agent/run")
        actions = client.get("/api/actions").json()

    assert response.status_code == 502
    assert "rolled back" in response.json()["detail"]
    assert actions == []


def test_strands_schedules_only_after_advance_through_human_api():
    with TestClient(app) as client:
        DeterministicAgentRunner(repository).run()
        decision_id = repository.open_decision_for("cand_emily").id
        response = client.post(
            f"/api/decisions/{decision_id}/resolve",
            json={"resolution": "ADVANCE"},
        )
        assert response.status_code == 200

        runner = strands_runner(
            tool_call("1", "get_active_candidates"),
            tool_call("2", "get_interview_feedback", {"candidate_id": "cand_sarah"}),
            tool_call(
                "3",
                "send_feedback_reminder",
                {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
            ),
            tool_call("4", "get_candidate", {"candidate_id": "cand_david"}),
            tool_call("5", "send_candidate_status_update", {"candidate_id": "cand_david"}),
            tool_call("6", "get_interviewer_availability", {"candidate_id": "cand_emily"}),
            tool_call(
                "7",
                "schedule_interview",
                {"candidate_id": "cand_emily", "slot_id": "slot_panel_01"},
            ),
            tool_call("8", "get_candidate", {"candidate_id": "cand_marcus"}),
            tool_call("9", "record_no_action", {"candidate_id": "cand_marcus"}),
            final_response(),
        )
        result = runner.run()

        assert result.summary.interviews_scheduled == 1
        assert repository.candidate("cand_emily").stage == "Panel Interview"
        assert repository.candidate("cand_emily").next_interview_at is not None
