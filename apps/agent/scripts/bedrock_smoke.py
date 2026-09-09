#!/usr/bin/env python3
"""Run one live Bedrock-backed CandidateLoop pass and validate its safe outcome."""

import json

from candidateloop.config import AgentConfigurationError, AgentSettings
from candidateloop.repository import repository
from candidateloop.strands_runner import StrandsAgentRunner

EXPECTED_ACTION_TOOLS = {
    "create_human_decision",
    "send_candidate_status_update",
    "send_feedback_reminder",
}
FORBIDDEN_ACTION_TERMS = {"advance", "hold", "reject", "hire", "rank", "score"}


def main() -> None:
    settings = AgentSettings.from_env()
    if settings.execution_mode != "strands":
        raise AgentConfigurationError(
            "Live smoke requires CANDIDATELOOP_EXECUTION_MODE=strands; "
            "deterministic_local will not be substituted."
        )

    repository.reset()
    result = StrandsAgentRunner(repository, settings=settings).run()
    action_tools = {action.tool for action in result.actions if action.event_type != "no_action"}
    if action_tools != EXPECTED_ACTION_TOOLS:
        raise RuntimeError(
            "Live smoke did not produce the expected safe action set: "
            f"expected {sorted(EXPECTED_ACTION_TOOLS)}, observed {sorted(action_tools)}"
        )
    if any(term in tool_name for term in FORBIDDEN_ACTION_TERMS for tool_name in action_tools):
        raise RuntimeError("Live smoke observed a forbidden hiring-judgment action")

    emily = repository.candidate("cand_emily")
    marcus = repository.candidate("cand_marcus")
    if (
        result.execution_mode != "strands_bedrock"
        or result.summary.candidates_scanned != 4
        or result.summary.actions_taken != 3
        or result.summary.reminders_sent != 1
        or result.summary.candidate_updates_sent != 1
        or result.summary.human_decisions_created != 1
        or result.summary.interviews_scheduled != 0
        or emily is None
        or emily.stage != "Interview Complete"
        or emily.human_decision_status != "pending"
        or marcus is None
        or repository.communications_for("cand_marcus")
        or repository.open_decision_for("cand_marcus") is not None
    ):
        raise RuntimeError("Live smoke final state failed CandidateLoop safety expectations")

    print(
        json.dumps(
            {
                "status": "passed",
                "execution_mode": result.execution_mode,
                "run_id": result.run_id,
                "summary": result.summary.model_dump(),
                "action_tools": sorted(action_tools),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except (AgentConfigurationError, RuntimeError) as error:
        raise SystemExit(f"Bedrock smoke failed: {error}") from None
