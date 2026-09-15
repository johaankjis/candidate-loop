import hashlib
import hmac
import json
import os
import re
import time
from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from candidateloop.config import DEMO_NOW, AgentConfigurationError, AgentExecutionError
from candidateloop.models import AgentRunResult, Stage
from candidateloop.policies import is_decision_ready, missing_feedback
from candidateloop.repository import InMemoryRepository
from candidateloop.runner import build_agent_runner

SLACK_SIGNATURE_VERSION = "v0"
SLACK_SIGNATURE_MAX_AGE_SECONDS = 5 * 60
SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage"


class SlackConfigurationError(ValueError):
    """Raised when the Slack adapter is missing required environment settings."""


class SlackClientError(RuntimeError):
    """Raised when Slack rejects a chat.postMessage request."""


@dataclass(frozen=True)
class SlackSettings:
    signing_secret: str
    bot_token: str

    @classmethod
    def from_env(cls) -> "SlackSettings":
        signing_secret = os.getenv("SLACK_SIGNING_SECRET")
        bot_token = os.getenv("SLACK_BOT_TOKEN")
        missing = [
            name
            for name, value in (
                ("SLACK_SIGNING_SECRET", signing_secret),
                ("SLACK_BOT_TOKEN", bot_token),
            )
            if not value
        ]
        if missing:
            raise SlackConfigurationError(f"Missing required Slack setting: {', '.join(missing)}")
        return cls(signing_secret=signing_secret, bot_token=bot_token)


def verify_slack_signature(
    raw_body: bytes,
    timestamp: str | None,
    signature: str | None,
    signing_secret: str,
    *,
    now: float | None = None,
) -> bool:
    """Verify Slack's v0 signature and reject timestamps outside the replay window."""
    if timestamp is None or signature is None:
        return False
    try:
        request_time = int(timestamp)
    except ValueError:
        return False
    current_time = int(time.time() if now is None else now)
    if abs(current_time - request_time) > SLACK_SIGNATURE_MAX_AGE_SECONDS:
        return False

    basestring = b":".join((SLACK_SIGNATURE_VERSION.encode(), timestamp.encode(), raw_body))
    digest = hmac.new(signing_secret.encode(), basestring, hashlib.sha256).hexdigest()
    expected = f"{SLACK_SIGNATURE_VERSION}={digest}"
    return hmac.compare_digest(expected, signature)


class SlackEventDeduplicator:
    """A bounded, thread-safe in-memory cache of claimed Slack event IDs."""

    def __init__(self, max_events: int = 1_000) -> None:
        self.max_events = max_events
        self._event_ids: set[str] = set()
        self._order: deque[str] = deque()
        self._lock = Lock()

    def claim(self, event_id: str) -> bool:
        with self._lock:
            if event_id in self._event_ids:
                return False
            if len(self._order) >= self.max_events:
                oldest = self._order.popleft()
                self._event_ids.discard(oldest)
            self._order.append(event_id)
            self._event_ids.add(event_id)
            return True

    def clear(self) -> None:
        """Clear cached IDs for isolated tests; demo reset intentionally does not call this."""
        with self._lock:
            self._event_ids.clear()
            self._order.clear()


class SlackClient:
    """Minimal Web API client limited to Slack's chat.postMessage method."""

    def __init__(self, bot_token: str) -> None:
        self._bot_token = bot_token

    def post_message(self, channel: str, text: str) -> None:
        body = json.dumps({"channel": channel, "text": text}).encode()
        request = Request(
            SLACK_POST_MESSAGE_URL,
            data=body,
            headers={
                "Authorization": f"Bearer {self._bot_token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=10) as response:  # noqa: S310 - fixed Slack HTTPS URL
                result = json.loads(response.read())
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            raise SlackClientError("Slack chat.postMessage request failed") from error
        if not result.get("ok"):
            error_code = result.get("error", "unknown_error")
            raise SlackClientError(f"Slack chat.postMessage was rejected: {error_code}")


class SlackAdapter:
    """Translate Slack messages into shared CandidateLoop reads or agent runs."""

    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository
        self.event_ids = SlackEventDeduplicator()

    def should_process(self, payload: dict[str, Any], retry_num: str | None = None) -> bool:
        if payload.get("type") != "event_callback":
            return False
        event = payload.get("event")
        if not isinstance(event, dict) or not self._is_supported_human_message(event):
            return False
        event_id = payload.get("event_id")
        if not isinstance(event_id, str) or not event_id:
            return False
        # Retried envelopes are safe only when their original event ID has not been claimed.
        # In the normal retry case claim() returns False and prevents repeated side effects.
        if retry_num is not None and not retry_num.isdigit():
            return False
        return self.event_ids.claim(event_id)

    def process_event(self, payload: dict[str, Any], bot_token: str) -> None:
        event = payload["event"]
        try:
            response = self.respond(event.get("text", ""))
        except (AgentConfigurationError, AgentExecutionError):
            response = (
                "CandidateLoop could not complete the operational pass. No partial run changes "
                "were kept; check the configured agent runtime and try again."
            )
        SlackClient(bot_token).post_message(event["channel"], response)

    def respond(self, text: str) -> str:
        normalized = self._normalize_message(text)
        decision = self._requested_hiring_action(normalized)
        if decision:
            return self._decision_boundary_response(normalized)
        if self._is_attention_request(normalized):
            return self._attention_brief()
        if self._is_agent_run_request(normalized):
            result = build_agent_runner(self.repository).run()
            return self._run_summary(result)
        if self._is_waiting_on_feedback_question(normalized):
            return self._waiting_on_feedback()
        candidate = self._mentioned_candidate(normalized)
        if candidate is not None:
            return self._candidate_status(candidate.id)
        return (
            "I can show what needs your attention, run CandidateLoop's safe operational pass, "
            "or summarize a candidate's current workflow. Hiring decisions still require the "
            "CandidateLoop human decision workflow."
        )

    @staticmethod
    def _is_supported_human_message(event: dict[str, Any]) -> bool:
        if event.get("bot_id") or event.get("bot_profile") or event.get("subtype"):
            return False
        if not event.get("user") or not event.get("channel") or not event.get("text"):
            return False
        event_type = event.get("type")
        return event_type == "app_mention" or (
            event_type == "message" and event.get("channel_type") == "im"
        )

    @staticmethod
    def _normalize_message(text: str) -> str:
        without_mentions = re.sub(r"<@[A-Z0-9]+>", " ", text, flags=re.IGNORECASE)
        words_only = re.sub(r"[^a-z0-9']+", " ", without_mentions.lower())
        return " ".join(words_only.split())

    @staticmethod
    def _requested_hiring_action(text: str) -> str | None:
        match = re.search(r"\b(advance|hold|reject|hire|rank|score)\b", text)
        return match.group(1) if match else None

    @staticmethod
    def _is_attention_request(text: str) -> bool:
        phrases = (
            "what needs my attention",
            "who needs my attention",
            "what is blocked on me",
            "what's blocked on me",
            "what do i need to review",
            "any candidates waiting on me",
        )
        return any(phrase in text for phrase in phrases)

    @staticmethod
    def _is_agent_run_request(text: str) -> bool:
        phrases = (
            "handle anything you can without me",
            "work the pipeline",
            "handle what you can",
            "run candidateloop",
            "take care of the pipeline",
            "handle routine work",
        )
        return any(phrase in text for phrase in phrases)

    @staticmethod
    def _is_waiting_on_feedback_question(text: str) -> bool:
        return "who is waiting on interview feedback" in text or (
            "who's waiting on interview feedback" in text
        )

    def _decision_boundary_response(self, text: str) -> str:
        candidate = self._mentioned_candidate(text)
        if candidate is not None and (
            self.repository.open_decision_for(candidate.id) is not None
            or is_decision_ready(candidate, self.repository.feedback_for(candidate.id))
        ):
            opening = f"{candidate.name} is awaiting a recruiter-controlled hiring decision."
        elif candidate is not None:
            opening = f"A hiring disposition for {candidate.name} cannot be made in Slack."
        else:
            opening = "Hiring dispositions cannot be made in Slack."
        return (
            f"{opening} Advance, Hold, and Reject require explicit confirmation through "
            "CandidateLoop's human decision workflow."
        )

    def _attention_brief(self) -> str:
        pending_by_candidate = {
            decision.candidate_id: decision
            for decision in self.repository.decision_views()
            if decision.status == "pending"
        }
        items: list[str] = []
        for candidate in self.repository.active_candidates():
            pending = pending_by_candidate.get(candidate.id)
            if pending is not None:
                reason = pending.reason.rstrip(".")
                items.append(
                    f"• {candidate.name} — {reason} and a human hiring decision is required."
                )
            elif is_decision_ready(candidate, self.repository.feedback_for(candidate.id)):
                items.append(
                    f"• {candidate.name} — Interview feedback is complete and a human hiring "
                    "decision is required."
                )
        if not items:
            return (
                "Nothing currently requires your judgment. CandidateLoop can continue handling "
                "routine coordination."
            )
        return (
            "Here's what needs your attention:\n\n"
            + "\n".join(items)
            + "\n\nCandidateLoop is handling the remaining operational work."
        )

    @staticmethod
    def _run_summary(result: AgentRunResult) -> str:
        summary = result.summary
        lines = [f"CandidateLoop reviewed {summary.candidates_scanned} active candidates:"]
        counts = (
            (summary.reminders_sent, "feedback reminder sent", "feedback reminders sent"),
            (
                summary.candidate_updates_sent,
                "candidate status update sent",
                "candidate status updates sent",
            ),
            (
                summary.human_decisions_created,
                "human decision surfaced",
                "human decisions surfaced",
            ),
            (summary.interviews_scheduled, "interview scheduled", "interviews scheduled"),
            (
                summary.no_action_needed,
                "candidate required no action",
                "candidates required no action",
            ),
        )
        for count, singular, plural in counts:
            if count:
                lines.append(f"• {count} {singular if count == 1 else plural}")
        if len(lines) == 1:
            lines.append("• No active candidates required operational work")
        return "\n".join(lines)

    def _waiting_on_feedback(self) -> str:
        waiting: list[str] = []
        for candidate in self.repository.active_candidates():
            overdue = missing_feedback(
                candidate, self.repository.feedback_for(candidate.id), DEMO_NOW
            )
            if overdue:
                waiting.append(
                    f"• {candidate.name} — {len(overdue)} of "
                    f"{candidate.required_feedback_count} scorecards still outstanding"
                )
        if not waiting:
            return "No active candidate is currently waiting on overdue interview feedback."
        return "Candidates waiting on interview feedback:\n\n" + "\n".join(waiting)

    def _mentioned_candidate(self, text: str):
        candidates = self.repository.active_candidates()
        full_matches = [candidate for candidate in candidates if candidate.name.lower() in text]
        if full_matches:
            return full_matches[0]
        token_set = set(text.split())
        partial_matches = [
            candidate
            for candidate in candidates
            if candidate.name.split()[0].lower() in token_set
            or candidate.name.split()[-1].lower() in token_set
        ]
        return partial_matches[0] if len(partial_matches) == 1 else None

    def _candidate_status(self, candidate_id: str) -> str:
        candidate = self.repository.candidate(candidate_id)
        view = self.repository.candidate_view(candidate_id)
        if candidate is None or view is None:
            return "That candidate is not in the current CandidateLoop state."
        pending = self.repository.open_decision_for(candidate_id)
        if pending is not None or is_decision_ready(
            candidate, self.repository.feedback_for(candidate_id)
        ):
            return (
                f"{candidate.name} is at {candidate.stage}. All required interview feedback is "
                "complete, and the next step requires a recruiter-controlled hiring decision."
            )
        overdue = missing_feedback(candidate, self.repository.feedback_for(candidate_id), DEMO_NOW)
        if overdue:
            return (
                f"{candidate.name} is at {candidate.stage}. "
                f"{view.submitted_feedback_count} of {candidate.required_feedback_count} "
                "scorecards are complete; CandidateLoop can handle the overdue feedback reminder."
            )
        if candidate.next_interview_at is not None:
            return (
                f"{candidate.name} is at {candidate.stage}. The next interview is scheduled for "
                f"{candidate.next_interview_at.isoformat()}."
            )
        if candidate.stage == Stage.RECRUITER_REVIEW:
            return (
                f"{candidate.name} is at {candidate.stage} and has been there for "
                f"{view.days_in_stage} days. No hiring disposition has been made."
            )
        return f"{candidate.name} is currently at {candidate.stage}."
