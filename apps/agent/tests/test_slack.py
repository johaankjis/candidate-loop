import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

import candidateloop.slack as slack_module
from api.main import app, slack_adapter
from candidateloop.repository import repository
from candidateloop.slack import SlackClient

SIGNING_SECRET = "test-signing-secret"
BOT_TOKEN = "xoxb-test-token"


@pytest.fixture(autouse=True)
def slack_environment(monkeypatch):
    monkeypatch.setenv("SLACK_SIGNING_SECRET", SIGNING_SECRET)
    monkeypatch.setenv("SLACK_BOT_TOKEN", BOT_TOKEN)
    monkeypatch.setenv("CANDIDATELOOP_EXECUTION_MODE", "deterministic_local")
    slack_adapter.event_ids.clear()
    yield
    slack_adapter.event_ids.clear()


@pytest.fixture
def posted_messages(monkeypatch):
    messages = []

    def capture_message(self, channel, text):
        messages.append({"channel": channel, "text": text})

    monkeypatch.setattr(SlackClient, "post_message", capture_message)
    return messages


def _signed_headers(raw_body: bytes, timestamp: int | None = None, **extra):
    timestamp = timestamp if timestamp is not None else int(time.time())
    basestring = b":".join((b"v0", str(timestamp).encode(), raw_body))
    signature = "v0=" + hmac.new(SIGNING_SECRET.encode(), basestring, hashlib.sha256).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-Slack-Request-Timestamp": str(timestamp),
        "X-Slack-Signature": signature,
        **extra,
    }


def _post_slack(client: TestClient, payload: dict, **headers):
    raw_body = json.dumps(payload, separators=(",", ":")).encode()
    signed_headers = _signed_headers(raw_body)
    signed_headers.update(headers)
    return client.post("/api/slack/events", content=raw_body, headers=signed_headers)


def _mention(text: str, event_id: str = "Ev-default") -> dict:
    return {
        "type": "event_callback",
        "event_id": event_id,
        "event": {
            "type": "app_mention",
            "user": "U123",
            "channel": "C123",
            "text": f"<@UBOT> {text}",
        },
    }


def test_slack_url_verification_challenge():
    payload = {"type": "url_verification", "challenge": "challenge-value"}
    raw_body = json.dumps(payload).encode()

    with TestClient(app) as client:
        response = client.post(
            "/api/slack/events", content=raw_body, headers=_signed_headers(raw_body)
        )

    assert response.status_code == 200
    assert response.json() == {"challenge": "challenge-value"}


def test_valid_slack_signature_is_accepted(posted_messages):
    with TestClient(app) as client:
        response = _post_slack(client, _mention("hello", "Ev-valid"))

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert posted_messages[0]["channel"] == "C123"


def test_invalid_slack_signature_is_rejected(posted_messages):
    payload = _mention("hello", "Ev-invalid")
    raw_body = json.dumps(payload).encode()
    headers = _signed_headers(raw_body)
    headers["X-Slack-Signature"] = "v0=invalid"

    with TestClient(app) as client:
        response = client.post("/api/slack/events", content=raw_body, headers=headers)

    assert response.status_code == 401
    assert posted_messages == []


def test_stale_slack_timestamp_is_rejected(posted_messages):
    payload = _mention("hello", "Ev-stale")
    raw_body = json.dumps(payload).encode()
    stale_timestamp = int(time.time()) - 301

    with TestClient(app) as client:
        response = client.post(
            "/api/slack/events",
            content=raw_body,
            headers=_signed_headers(raw_body, timestamp=stale_timestamp),
        )

    assert response.status_code == 401
    assert posted_messages == []


def test_bot_and_message_edit_events_are_ignored(posted_messages):
    bot_event = _mention("run CandidateLoop", "Ev-bot")
    bot_event["event"]["bot_id"] = "B123"
    changed_event = {
        "type": "event_callback",
        "event_id": "Ev-changed",
        "event": {
            "type": "message",
            "subtype": "message_changed",
            "user": "U123",
            "channel": "D123",
            "channel_type": "im",
            "text": "run CandidateLoop",
        },
    }
    deleted_event = {
        "type": "event_callback",
        "event_id": "Ev-deleted",
        "event": {
            "type": "message",
            "subtype": "message_deleted",
            "user": "U123",
            "channel": "D123",
            "channel_type": "im",
            "text": "run CandidateLoop",
        },
    }

    with TestClient(app) as client:
        assert _post_slack(client, bot_event).status_code == 200
        assert _post_slack(client, changed_event).status_code == 200
        assert _post_slack(client, deleted_event).status_code == 200

    assert posted_messages == []
    assert repository.action_views() == []


def test_direct_message_attention_request_returns_current_human_attention(posted_messages):
    payload = {
        "type": "event_callback",
        "event_id": "Ev-attention",
        "event": {
            "type": "message",
            "user": "U123",
            "channel": "D123",
            "channel_type": "im",
            "text": "What needs my attention?",
        },
    }

    with TestClient(app) as client:
        response = _post_slack(client, payload)

    assert response.status_code == 200
    assert len(posted_messages) == 1
    assert "Emily Jones" in posted_messages[0]["text"]
    assert "human hiring decision is required" in posted_messages[0]["text"]
    assert repository.action_views() == []


def test_handle_routine_work_invokes_existing_agent_run_path(monkeypatch, posted_messages):
    calls = []
    original_build_agent_runner = slack_module.build_agent_runner

    def track_runner(shared_repository):
        calls.append(shared_repository)
        return original_build_agent_runner(shared_repository)

    monkeypatch.setattr(slack_module, "build_agent_runner", track_runner)

    with TestClient(app) as client:
        response = _post_slack(
            client,
            _mention("Handle anything you can without me.", "Ev-agent-run"),
        )

    assert response.status_code == 200
    assert calls == [repository]
    assert len(repository.action_views()) == 4
    assert posted_messages[0]["text"].startswith("CandidateLoop reviewed 4 active candidates:")
    assert "• 1 feedback reminder sent" in posted_messages[0]["text"]
    assert "• 1 human decision surfaced" in posted_messages[0]["text"]


@pytest.mark.parametrize("command", ["Advance Emily", "Hold Emily", "Reject Emily"])
def test_slack_cannot_execute_human_decisions(command, posted_messages):
    with TestClient(app) as client:
        before = client.get("/api/candidates/cand_emily").json()
        response = _post_slack(client, _mention(command, f"Ev-{command.split()[0].lower()}"))
        after = client.get("/api/candidates/cand_emily").json()

    assert response.status_code == 200
    assert before == after
    assert repository.decision_views() == []
    assert "Advance, Hold, and Reject require explicit confirmation" in posted_messages[0]["text"]


def test_duplicate_slack_event_does_not_run_agent_twice(monkeypatch, posted_messages):
    calls = []
    original_build_agent_runner = slack_module.build_agent_runner

    def track_runner(shared_repository):
        calls.append(shared_repository)
        return original_build_agent_runner(shared_repository)

    monkeypatch.setattr(slack_module, "build_agent_runner", track_runner)
    payload = _mention("Run CandidateLoop", "Ev-duplicate")

    with TestClient(app) as client:
        first = _post_slack(client, payload)
        second = _post_slack(client, payload, **{"X-Slack-Retry-Num": "1"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert calls == [repository]
    assert len(posted_messages) == 1
