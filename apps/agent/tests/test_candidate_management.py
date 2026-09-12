import pytest
from fastapi.testclient import TestClient

from api.main import app
from candidateloop.models import Feedback, Interviewer
from candidateloop.repository import repository
from candidateloop.tools import RecruitingTools


def candidate_payload(**overrides):
    payload = {
        "name": "Quinn Taylor",
        "role": "Platform Engineer",
        "stage": "Technical Interview",
        "stage_entered_at": "2026-09-06T09:00:00Z",
        "last_candidate_contact_at": "2026-09-07T09:00:00Z",
        "interview_completed_at": "2026-09-07T08:00:00Z",
        "required_feedback_count": 4,
        "submitted_feedback_count": 3,
    }
    payload.update(overrides)
    return payload


def test_create_and_edit_candidate_synchronize_real_feedback_records():
    with TestClient(app) as client:
        created = client.post("/api/candidates", json=candidate_payload())

        assert created.status_code == 201
        candidate = created.json()
        assert candidate["id"].startswith("cand_")
        assert candidate["initials"] == "QT"
        assert candidate["submitted_feedback_count"] == 3
        feedback = repository.feedback_for(candidate["id"])
        assert len(feedback) == 4
        assert [item.status for item in feedback] == [
            "submitted",
            "submitted",
            "submitted",
            "pending",
        ]
        assert all(item.recommendation is None and item.summary is None for item in feedback)

        updated = client.patch(
            f"/api/candidates/{candidate['id']}",
            json={
                "name": "Quinn Avery Taylor",
                "required_feedback_count": 5,
                "submitted_feedback_count": 2,
            },
        )

        assert updated.status_code == 200
        assert updated.json()["initials"] == "QT"
        assert updated.json()["submitted_feedback_count"] == 2
        synchronized = repository.feedback_for(candidate["id"])
        assert len(synchronized) == 5
        assert sum(item.status == "submitted" for item in synchronized) == 2
        assert sum(item.status == "pending" for item in synchronized) == 3
        generated = repository.interviewer(synchronized[-1].interviewer_id)
        assert generated is not None
        assert generated.email.endswith("@example.test")


@pytest.mark.parametrize(
    ("overrides", "expected_detail"),
    [
        (
            {"required_feedback_count": 2, "submitted_feedback_count": 3},
            "submitted_feedback_count",
        ),
        ({"required_feedback_count": -1}, "greater than or equal to 0"),
        ({"stage": "Phone Screen"}, "Input should be"),
        ({"stage_entered_at": "not-a-timestamp"}, "valid datetime"),
        ({"stage_entered_at": "2026-09-06T09:00:00"}, "timezone"),
        ({"human_decision_status": "pending"}, "Extra inputs are not permitted"),
    ],
)
def test_candidate_create_rejects_invalid_or_internal_state(overrides, expected_detail):
    with TestClient(app) as client:
        response = client.post("/api/candidates", json=candidate_payload(**overrides))

    assert response.status_code == 422
    assert expected_detail in str(response.json()["detail"])


@pytest.mark.parametrize("stage", ["Panel Scheduling", "Panel Interview", "On Hold", "Closed"])
def test_candidate_create_rejects_system_controlled_stages(stage):
    with TestClient(app) as client:
        response = client.post("/api/candidates", json=candidate_payload(stage=stage))

    assert response.status_code == 422
    assert "stage" in str(response.json()["detail"])


@pytest.mark.parametrize("stage", ["Panel Scheduling", "Panel Interview", "On Hold", "Closed"])
def test_candidate_patch_rejects_system_controlled_stages(stage):
    with TestClient(app) as client:
        candidate_id = client.post("/api/candidates", json=candidate_payload()).json()["id"]

        response = client.patch(f"/api/candidates/{candidate_id}", json={"stage": stage})

    assert response.status_code == 422
    assert "stage" in str(response.json()["detail"])


def test_candidate_patch_rejects_count_inversion_against_existing_feedback():
    with TestClient(app) as client:
        candidate_id = client.post("/api/candidates", json=candidate_payload()).json()["id"]

        response = client.patch(
            f"/api/candidates/{candidate_id}", json={"required_feedback_count": 2}
        )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "submitted_feedback_count cannot exceed required_feedback_count"
    )


def test_candidate_patch_rejects_client_controlled_decision_state():
    with TestClient(app) as client:
        candidate_id = client.post("/api/candidates", json=candidate_payload()).json()["id"]

        response = client.patch(
            f"/api/candidates/{candidate_id}", json={"last_human_resolution": "ADVANCE"}
        )

    assert response.status_code == 422
    assert "Extra inputs are not permitted" in str(response.json()["detail"])


def test_next_interview_input_cannot_bypass_human_advance():
    with TestClient(app) as client:
        response = client.post(
            "/api/candidates",
            json=candidate_payload(next_interview_at="2026-09-10T15:00:00Z"),
        )

    assert response.status_code == 422
    assert response.json()["detail"] == "next_interview_at requires an explicit human ADVANCE"


@pytest.mark.parametrize(
    ("resolution", "expected_stage", "expected_status"),
    [
        ("ADVANCE", "Panel Scheduling", "active"),
        ("HOLD", "On Hold", "active"),
        ("REJECT", "Closed", "closed"),
    ],
)
def test_human_decision_api_retains_system_controlled_stage_transitions(
    resolution, expected_stage, expected_status
):
    with TestClient(app) as client:
        candidate = client.post(
            "/api/candidates",
            json=candidate_payload(
                stage="Interview Complete",
                required_feedback_count=4,
                submitted_feedback_count=4,
            ),
        ).json()
        client.post("/api/agent/run")
        decision = next(
            item
            for item in client.get("/api/decisions").json()
            if item["candidate_id"] == candidate["id"]
        )

        resolved = client.post(
            f"/api/decisions/{decision['id']}/resolve", json={"resolution": resolution}
        )

    assert resolved.status_code == 200
    assert resolved.json()["candidate"]["stage"] == expected_stage
    assert resolved.json()["candidate"]["status"] == expected_status


def test_scheduling_tool_retains_panel_scheduling_to_panel_interview_transition():
    with TestClient(app) as client:
        candidate = client.post(
            "/api/candidates",
            json=candidate_payload(
                stage="Interview Complete",
                required_feedback_count=4,
                submitted_feedback_count=4,
            ),
        ).json()
        client.post("/api/agent/run")
        decision = next(
            item
            for item in client.get("/api/decisions").json()
            if item["candidate_id"] == candidate["id"]
        )
        client.post(f"/api/decisions/{decision['id']}/resolve", json={"resolution": "ADVANCE"})

        slot = RecruitingTools(repository).schedule_interview(candidate["id"], "slot_panel_01")

        transitioned = client.get(f"/api/candidates/{candidate['id']}").json()
    assert slot.id == "slot_panel_01"
    assert transitioned["stage"] == "Panel Interview"
    assert transitioned["next_interview_at"] == "2026-09-10T15:00:00Z"


def _partially_mutate_feedback_then_fail(candidate_id, *_):
    repository.feedback[f"fb_partial_{candidate_id}"] = Feedback(
        id=f"fb_partial_{candidate_id}",
        candidate_id=candidate_id,
        interviewer_id="int_partial_failure",
        interview_id=f"iv_partial_{candidate_id}",
        status="pending",
    )
    repository.interviewers["int_partial_failure"] = Interviewer(
        id="int_partial_failure",
        name="Synthetic Failure",
        email="synthetic-failure@example.test",
        role="Test panelist",
    )
    raise RuntimeError("forced feedback synchronization failure")


def test_create_rolls_back_candidate_and_feedback_when_synchronization_fails(monkeypatch):
    with TestClient(app) as client:
        before = repository.snapshot()
        monkeypatch.setattr(
            repository,
            "synchronize_candidate_feedback",
            _partially_mutate_feedback_then_fail,
        )

        with pytest.raises(RuntimeError, match="forced feedback synchronization failure"):
            client.post("/api/candidates", json=candidate_payload())

        assert repository.candidates == before.candidates
        assert repository.feedback == before.feedback
        assert repository.interviewers == before.interviewers


def test_update_restores_candidate_and_feedback_when_synchronization_fails(monkeypatch):
    with TestClient(app) as client:
        candidate_id = client.post("/api/candidates", json=candidate_payload()).json()["id"]
        before = repository.snapshot()
        monkeypatch.setattr(
            repository,
            "synchronize_candidate_feedback",
            _partially_mutate_feedback_then_fail,
        )

        with pytest.raises(RuntimeError, match="forced feedback synchronization failure"):
            client.patch(
                f"/api/candidates/{candidate_id}",
                json={
                    "name": "Changed Name",
                    "required_feedback_count": 2,
                    "submitted_feedback_count": 1,
                },
            )

        assert repository.candidates == before.candidates
        assert repository.feedback == before.feedback
        assert repository.interviewers == before.interviewers


def test_new_missing_feedback_candidate_drives_fifth_agent_outcome_and_is_idempotent():
    with TestClient(app) as client:
        candidate_id = client.post("/api/candidates", json=candidate_payload()).json()["id"]

        first = client.post("/api/agent/run").json()

        assert first["summary"]["candidates_scanned"] == 5
        assert len(first["actions"]) == 5
        dynamic_action = next(
            item for item in first["actions"] if item["candidate_id"] == candidate_id
        )
        assert dynamic_action["tool"] == "send_feedback_reminder"
        reminders = [
            item
            for item in repository.communications_for(candidate_id)
            if item.type == "feedback_reminder"
        ]
        assert len(reminders) == 1

        second = client.post("/api/agent/run").json()

        assert second["summary"]["candidates_scanned"] == 5
        assert len(second["actions"]) == 5
        assert len(repository.communications_for(candidate_id)) == 1
        repeated = next(item for item in second["actions"] if item["candidate_id"] == candidate_id)
        assert repeated["event_type"] == "no_action"


def test_new_complete_feedback_candidate_requires_human_without_disposition():
    with TestClient(app) as client:
        created = client.post(
            "/api/candidates",
            json=candidate_payload(
                stage="Interview Complete",
                required_feedback_count=4,
                submitted_feedback_count=4,
            ),
        ).json()

        result = client.post("/api/agent/run").json()

        action = next(item for item in result["actions"] if item["candidate_id"] == created["id"])
        assert action["tool"] == "create_human_decision"
        assert "No hiring disposition was made" in action["result"]
        candidate = client.get(f"/api/candidates/{created['id']}").json()
        assert candidate["stage"] == "Interview Complete"
        assert candidate["human_decision_status"] == "pending"
        assert candidate["last_human_resolution"] is None


def test_new_candidate_with_no_pending_work_has_exactly_one_no_action_outcome():
    with TestClient(app) as client:
        created = client.post(
            "/api/candidates",
            json=candidate_payload(
                stage="Technical Interview",
                interview_completed_at=None,
                required_feedback_count=0,
                submitted_feedback_count=0,
            ),
        ).json()

        result = client.post("/api/agent/run").json()

        outcomes = [item for item in result["actions"] if item["candidate_id"] == created["id"]]
        assert len(outcomes) == 1
        assert outcomes[0]["event_type"] == "no_action"


def test_delete_removes_candidate_dependent_state():
    with TestClient(app) as client:
        candidate_id = client.post("/api/candidates", json=candidate_payload()).json()["id"]
        client.post("/api/agent/run")
        assert repository.communications_for(candidate_id)
        client.patch(
            f"/api/candidates/{candidate_id}",
            json={
                "stage": "Interview Complete",
                "required_feedback_count": 4,
                "submitted_feedback_count": 4,
            },
        )
        client.post("/api/agent/run")
        decision_id = repository.open_decision_for(candidate_id).id
        client.post(f"/api/decisions/{decision_id}/resolve", json={"resolution": "HOLD"})
        assert any(item.candidate_id == candidate_id for item in repository.decisions.values())

        deleted = client.delete(f"/api/candidates/{candidate_id}")

        assert deleted.status_code == 204
        assert client.get(f"/api/candidates/{candidate_id}").status_code == 404
        assert repository.feedback_for(candidate_id) == []
        assert repository.communications_for(candidate_id) == []
        assert all(item.candidate_id != candidate_id for item in repository.actions.values())
        assert all(item.candidate_id != candidate_id for item in repository.decisions.values())


def test_delete_is_blocked_while_human_decision_is_pending():
    with TestClient(app) as client:
        created = client.post(
            "/api/candidates",
            json=candidate_payload(
                stage="Interview Complete",
                required_feedback_count=4,
                submitted_feedback_count=4,
            ),
        ).json()
        client.post("/api/agent/run")

        response = client.delete(f"/api/candidates/{created['id']}")

        assert response.status_code == 409
        assert response.json()["detail"] == "Candidate has a pending human decision"
        assert client.get(f"/api/candidates/{created['id']}").status_code == 200


def test_demo_reset_removes_user_candidates_and_restores_canonical_feedback():
    with TestClient(app) as client:
        client.post("/api/candidates", json=candidate_payload())

        response = client.post("/api/demo/reset")

        assert [item["id"] for item in response.json()["candidates"]] == [
            "cand_sarah",
            "cand_david",
            "cand_emily",
            "cand_marcus",
        ]
        assert len(repository.feedback) == 8
