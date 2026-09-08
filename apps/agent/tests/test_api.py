from fastapi.testclient import TestClient

from api.main import app


def test_health_and_seeded_candidates():
    with TestClient(app) as client:
        assert client.get("/health").json() == {
            "status": "ok",
            "execution_mode": "deterministic_local",
        }
        candidates = client.get("/api/candidates").json()
        assert [candidate["name"] for candidate in candidates] == [
            "Sarah Chen",
            "David Park",
            "Emily Jones",
            "Marcus Reed",
        ]


def test_human_advance_then_next_run_schedules_panel():
    with TestClient(app) as client:
        run = client.post("/api/agent/run")
        assert run.status_code == 200
        decision = client.get("/api/decisions").json()[0]

        resolved = client.post(
            f"/api/decisions/{decision['id']}/resolve",
            json={"resolution": "ADVANCE"},
        )
        assert resolved.status_code == 200
        assert resolved.json()["candidate"]["stage"] == "Panel Scheduling"

        continuation = client.post("/api/agent/run").json()
        assert continuation["summary"]["interviews_scheduled"] == 1
        emily = client.get("/api/candidates/cand_emily").json()
        assert emily["stage"] == "Panel Interview"
        assert emily["next_interview_at"] == "2026-09-10T15:00:00Z"


def test_reset_restores_exact_demo_state():
    with TestClient(app) as client:
        client.post("/api/agent/run")
        assert client.get("/api/actions").json()

        reset = client.post("/api/demo/reset")
        assert reset.status_code == 200
        assert len(reset.json()["candidates"]) == 4
        assert client.get("/api/actions").json() == []
        assert client.get("/api/decisions").json() == []


def test_invalid_or_repeated_decision_is_rejected():
    with TestClient(app) as client:
        client.post("/api/agent/run")
        decision_id = client.get("/api/decisions").json()[0]["id"]

        invalid = client.post(
            f"/api/decisions/{decision_id}/resolve",
            json={"resolution": "AUTO_HIRE"},
        )
        assert invalid.status_code == 422

        assert (
            client.post(
                f"/api/decisions/{decision_id}/resolve", json={"resolution": "HOLD"}
            ).status_code
            == 200
        )
        assert (
            client.post(
                f"/api/decisions/{decision_id}/resolve", json={"resolution": "REJECT"}
            ).status_code
            == 409
        )
