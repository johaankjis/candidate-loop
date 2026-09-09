from candidateloop.repository import repository
from candidateloop.runner import DeterministicAgentRunner
from candidateloop.tools import SAFE_CANDIDATE_STATUS_BODY, RecruitingTools


def test_seeded_run_performs_expected_safe_actions():
    result = DeterministicAgentRunner(repository).run()

    assert result.summary.candidates_scanned == 4
    assert result.summary.reminders_sent == 1
    assert result.summary.candidate_updates_sent == 1
    assert result.summary.human_decisions_created == 1
    assert result.summary.no_action_needed == 1
    assert {action.tool for action in result.actions} == {
        "send_feedback_reminder",
        "send_candidate_status_update",
        "create_human_decision",
        "record_agent_note",
    }

    emily = repository.candidate("cand_emily")
    assert emily is not None
    assert emily.human_decision_status == "pending"
    assert emily.stage == "Interview Complete"


def test_second_run_prevents_duplicate_writes():
    runner = DeterministicAgentRunner(repository)
    runner.run()
    communication_count = len(repository.communications)
    decision_count = len(repository.decisions)

    second = runner.run()

    assert len(repository.communications) == communication_count
    assert len(repository.decisions) == decision_count
    assert second.summary.actions_taken == 0
    assert second.summary.no_action_needed == 4


def test_candidate_update_is_neutral_and_refreshes_contact_time():
    DeterministicAgentRunner(repository).run()
    message = next(
        item
        for item in repository.communications.values()
        if item.type == "candidate_status_update"
    )

    assert message.body == SAFE_CANDIDATE_STATUS_BODY.format(first_name="David")
    assert "next round" not in message.body.lower()
    assert "offer" not in message.body.lower()
    assert repository.candidate("cand_david").last_candidate_contact_at == message.created_at


def test_scheduling_tool_rejects_candidate_without_human_advance():
    tools = RecruitingTools(repository)

    try:
        tools.schedule_interview("cand_emily", "slot_panel_01")
    except ValueError as error:
        assert "explicit human advance" in str(error)
    else:
        raise AssertionError("Scheduling should require a human advance decision")


def test_write_tools_enforce_policy_when_called_out_of_order():
    tools = RecruitingTools(repository)

    assert tools.send_candidate_status_update("cand_marcus") is None
    try:
        tools.send_feedback_reminder("cand_marcus", "int_alex")
    except ValueError as error:
        assert "overdue pending feedback" in str(error)
    else:
        raise AssertionError("Reminder should require overdue pending feedback")

    try:
        tools.create_human_decision("cand_marcus", "Unsafe", "Unsafe")
    except ValueError as error:
        assert "complete interview feedback" in str(error)
    else:
        raise AssertionError("Decision escalation should require completed feedback")


def test_tool_surface_has_no_hiring_disposition_method():
    exposed = set(dir(RecruitingTools))
    assert {
        "advance_candidate",
        "hold_candidate",
        "reject_candidate",
        "hire_candidate",
        "rank_candidates",
        "score_candidate",
        "resolve_decision",
    }.isdisjoint(exposed)
