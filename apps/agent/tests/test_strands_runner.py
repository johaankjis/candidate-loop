from fastapi.testclient import TestClient

from api.main import app
from candidateloop.config import AgentSettings
from candidateloop.repository import repository
from candidateloop.runner import DeterministicAgentRunner
from candidateloop.strands_runner import StrandsAgentRunner
from candidateloop.strands_tools import (
    FORBIDDEN_AGENT_TOOL_TERMS,
    STRANDS_TOOL_NAMES,
    StrandsRecruitingToolAdapter,
)
from tests.scripted_model import ScriptedModel, final_response, parallel_tool_calls, tool_call


def strands_runner(*responses):
    settings = AgentSettings(
        execution_mode="strands",
        model_provider="bedrock",
        model_id="scripted-test-model",
    )
    return StrandsAgentRunner(repository, settings, ScriptedModel(responses))


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


def test_strands_agent_registers_only_allowlisted_non_judgment_tools():
    runner = strands_runner(final_response())
    adapter = StrandsRecruitingToolAdapter(repository, "run_registry_test")

    agent = runner.build_agent(adapter)

    assert set(agent.tool_names) == STRANDS_TOOL_NAMES
    assert not {
        "advance_candidate",
        "reject_candidate",
        "hire_candidate",
        "rank_candidates",
        "score_candidate",
        "resolve_decision",
    }.intersection(agent.tool_names)
    assert all(term not in name for name in agent.tool_names for term in FORBIDDEN_AGENT_TOOL_TERMS)


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
        final_response(),
    )

    result = runner.run()

    reminders = [
        item for item in repository.communications.values() if item.type == "feedback_reminder"
    ]
    assert len(reminders) == 1
    assert result.summary.reminders_sent == 1
    assert result.summary.no_action_needed == 1


def test_repeated_strands_runs_prevent_all_duplicate_operational_writes():
    first = strands_runner(
        tool_call(
            "1",
            "send_feedback_reminder",
            {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
        ),
        tool_call("2", "send_candidate_status_update", {"candidate_id": "cand_david"}),
        tool_call("3", "create_human_decision", {"candidate_id": "cand_emily"}),
        final_response(),
    )
    first.run()
    communication_count = len(repository.communications)
    decision_count = len(repository.decisions)
    second = strands_runner(
        tool_call(
            "4",
            "send_feedback_reminder",
            {"candidate_id": "cand_sarah", "interviewer_id": "int_alex"},
        ),
        tool_call("5", "send_candidate_status_update", {"candidate_id": "cand_david"}),
        tool_call("6", "create_human_decision", {"candidate_id": "cand_emily"}),
        final_response(),
    )

    result = second.run()

    assert len(repository.communications) == communication_count
    assert len(repository.decisions) == decision_count
    assert result.summary.actions_taken == 0
    assert result.summary.no_action_needed == 3


def test_strands_cannot_schedule_without_human_advance():
    runner = strands_runner(
        tool_call(
            "1",
            "schedule_interview",
            {"candidate_id": "cand_emily", "slot_id": "slot_panel_01"},
        ),
        final_response(),
    )

    result = runner.run()

    emily = repository.candidate("cand_emily")
    assert result.summary.interviews_scheduled == 0
    assert emily.stage == "Interview Complete"
    assert emily.next_interview_at is None
    assert repository.available_slots()[0].available is True


def test_strands_cannot_escalate_candidate_before_decision_ready():
    runner = strands_runner(
        tool_call("1", "create_human_decision", {"candidate_id": "cand_marcus"}),
        final_response(),
    )

    result = runner.run()

    assert result.summary.human_decisions_created == 0
    assert repository.open_decision_for("cand_marcus") is None
    assert repository.candidate("cand_marcus").human_decision_status == "none"


def test_strands_cannot_record_no_action_when_safe_work_is_due():
    runner = strands_runner(
        tool_call("1", "record_no_action", {"candidate_id": "cand_sarah"}),
        final_response(),
    )

    result = runner.run()

    assert result.summary.no_action_needed == 0
    assert repository.action_views(result.run_id) == []


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
            tool_call("2", "get_interviewer_availability", {"candidate_id": "cand_emily"}),
            tool_call(
                "3",
                "schedule_interview",
                {"candidate_id": "cand_emily", "slot_id": "slot_panel_01"},
            ),
            final_response(),
        )
        result = runner.run()

        assert result.summary.interviews_scheduled == 1
        assert repository.candidate("cand_emily").stage == "Panel Interview"
        assert repository.candidate("cand_emily").next_interview_at is not None
