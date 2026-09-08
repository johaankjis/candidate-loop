from datetime import UTC, datetime

from candidateloop.models import AvailabilitySlot, Candidate, Feedback, Interviewer, Stage


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=UTC)


def demo_candidates() -> list[Candidate]:
    return [
        Candidate(
            id="cand_sarah",
            name="Sarah Chen",
            initials="SC",
            role="Senior Software Engineer",
            stage=Stage.TECHNICAL_INTERVIEW,
            stage_entered_at=dt("2026-09-06T09:00:00"),
            last_candidate_contact_at=dt("2026-09-06T10:00:00"),
            interview_completed_at=dt("2026-09-07T15:00:00"),
            required_feedback_count=4,
        ),
        Candidate(
            id="cand_david",
            name="David Park",
            initials="DP",
            role="Product Manager",
            stage=Stage.RECRUITER_REVIEW,
            stage_entered_at=dt("2026-09-03T09:00:00"),
            last_candidate_contact_at=dt("2026-09-03T11:30:00"),
        ),
        Candidate(
            id="cand_emily",
            name="Emily Jones",
            initials="EJ",
            role="Senior Software Engineer",
            stage=Stage.INTERVIEW_COMPLETE,
            stage_entered_at=dt("2026-09-07T16:00:00"),
            last_candidate_contact_at=dt("2026-09-06T14:00:00"),
            interview_completed_at=dt("2026-09-07T16:00:00"),
            required_feedback_count=4,
        ),
        Candidate(
            id="cand_marcus",
            name="Marcus Reed",
            initials="MR",
            role="Data Engineer",
            stage=Stage.TECHNICAL_INTERVIEW,
            stage_entered_at=dt("2026-09-07T10:00:00"),
            last_candidate_contact_at=dt("2026-09-07T15:00:00"),
            next_interview_at=dt("2026-09-09T14:00:00"),
            required_feedback_count=3,
        ),
    ]


def demo_interviewers() -> list[Interviewer]:
    return [
        Interviewer(
            id="int_alex", name="Alex Morgan", email="alex@example.test", role="Staff Engineer"
        ),
        Interviewer(
            id="int_priya",
            name="Priya Shah",
            email="priya@example.test",
            role="Engineering Manager",
        ),
        Interviewer(
            id="int_luis", name="Luis Ortega", email="luis@example.test", role="Senior Engineer"
        ),
        Interviewer(
            id="int_maya", name="Maya Brooks", email="maya@example.test", role="Product Director"
        ),
    ]


def demo_feedback() -> list[Feedback]:
    feedback: list[Feedback] = []
    for index, interviewer_id in enumerate(["int_priya", "int_luis", "int_maya"]):
        feedback.append(
            Feedback(
                id=f"fb_sarah_{index}",
                candidate_id="cand_sarah",
                interviewer_id=interviewer_id,
                interview_id="iv_sarah_technical",
                status="submitted",
                submitted_at=dt("2026-09-07T17:00:00"),
                recommendation="positive",
                summary="Synthetic scorecard submitted.",
            )
        )
    feedback.append(
        Feedback(
            id="fb_sarah_alex",
            candidate_id="cand_sarah",
            interviewer_id="int_alex",
            interview_id="iv_sarah_technical",
            status="pending",
        )
    )
    for index, interviewer_id in enumerate(["int_alex", "int_priya", "int_luis", "int_maya"]):
        feedback.append(
            Feedback(
                id=f"fb_emily_{index}",
                candidate_id="cand_emily",
                interviewer_id=interviewer_id,
                interview_id="iv_emily_technical",
                status="submitted",
                submitted_at=dt("2026-09-07T18:00:00"),
                recommendation="positive" if index < 3 else "mixed",
                summary="Synthetic evidence for recruiter review.",
            )
        )
    return feedback


def demo_availability() -> list[AvailabilitySlot]:
    return [
        AvailabilitySlot(
            id="slot_panel_01",
            interviewer_ids=["int_alex", "int_priya", "int_luis"],
            start_at=dt("2026-09-10T15:00:00"),
            end_at=dt("2026-09-10T16:00:00"),
        ),
        AvailabilitySlot(
            id="slot_panel_02",
            interviewer_ids=["int_alex", "int_priya", "int_luis"],
            start_at=dt("2026-09-11T17:00:00"),
            end_at=dt("2026-09-11T18:00:00"),
        ),
    ]
