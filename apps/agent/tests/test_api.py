import pytest
from fastapi.testclient import TestClient

from api.main import app, cors_origins_from_env
from candidateloop.config import AgentConfigurationError


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


def test_integrated_api_demo_path_prevents_duplicate_writes():
    with TestClient(app) as client:
        assert client.post("/api/demo/reset").status_code == 200

        first = client.post("/api/agent/run")
        assert first.status_code == 200
        assert first.json()["summary"] == {
            "candidates_scanned": 4,
            "actions_taken": 3,
            "reminders_sent": 1,
            "candidate_updates_sent": 1,
            "human_decisions_created": 1,
            "interviews_scheduled": 0,
            "no_action_needed": 1,
        }
        decision = client.get("/api/decisions").json()[0]
        assert decision["candidate_id"] == "cand_emily"

        advanced = client.post(
            f"/api/decisions/{decision['id']}/resolve", json={"resolution": "ADVANCE"}
        )
        assert advanced.status_code == 200
        assert advanced.json()["candidate"]["stage"] == "Panel Scheduling"

        continuation = client.post("/api/agent/run")
        assert continuation.status_code == 200
        assert continuation.json()["summary"]["interviews_scheduled"] == 1
        action_count = len(client.get("/api/actions").json())

        rerun = client.post("/api/agent/run")
        assert rerun.status_code == 200
        assert rerun.json()["summary"]["actions_taken"] == 0
        assert rerun.json()["summary"]["no_action_needed"] == 4
        assert len(client.get("/api/actions").json()) == action_count + 4


def test_cors_origins_are_loaded_as_an_exact_allowlist(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://recruiting.example, https://admin.example/,https://recruiting.example",
    )

    assert cors_origins_from_env() == [
        "https://recruiting.example",
        "https://admin.example",
    ]


def test_cors_rejects_wildcard_origin(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "*")

    with pytest.raises(AgentConfigurationError, match="exact origins"):
        cors_origins_from_env()


def test_cors_preflight_retains_narrow_methods_and_headers():
    with TestClient(app) as client:
        allowed = client.options(
            "/api/agent/run",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
        assert allowed.headers["access-control-allow-methods"] == "GET, POST"
        assert "content-type" in allowed.headers["access-control-allow-headers"].lower()
        assert "*" not in allowed.headers["access-control-allow-methods"]
        assert "*" not in allowed.headers["access-control-allow-headers"]

        rejected = client.options(
            "/api/agent/run",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "DELETE",
            },
        )
        assert rejected.status_code == 400
