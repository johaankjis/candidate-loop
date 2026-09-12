import os
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from candidateloop.config import (
    DEMO_NOW,
    AgentConfigurationError,
    AgentExecutionError,
    AgentSettings,
)
from candidateloop.models import (
    Candidate,
    CandidateCreateRequest,
    CandidateUpdateRequest,
    ResolveDecisionRequest,
    Stage,
)
from candidateloop.repository import PendingHumanDecisionError, repository
from candidateloop.runner import build_agent_runner

DEFAULT_CORS_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def cors_origins_from_env() -> list[str]:
    """Return exact allowed origins; an explicitly empty value disables CORS."""
    configured = os.getenv("CORS_ORIGINS")
    if configured is None:
        return list(DEFAULT_CORS_ORIGINS)
    origins = list(dict.fromkeys(origin.strip().rstrip("/") for origin in configured.split(",")))
    origins = [origin for origin in origins if origin]
    if any("*" in origin for origin in origins):
        raise AgentConfigurationError("CORS_ORIGINS must contain exact origins, not '*'")
    return origins


@asynccontextmanager
async def lifespan(_: FastAPI):
    repository.reset()
    yield


app = FastAPI(
    title="CandidateLoop API",
    version="0.1.0",
    description=(
        "Local-first recruiting operations service with a structural human-decision boundary."
    ),
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_from_env(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    try:
        execution_mode = AgentSettings.from_env().reported_execution_mode
    except AgentConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"status": "ok", "execution_mode": execution_mode}


@app.get("/api/candidates")
def list_candidates():
    return repository.candidate_views()


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: str):
    candidate = repository.candidate_view(candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


def _candidate_initials(name: str) -> str:
    parts = name.split()
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


def _validate_next_interview(next_interview_at, last_human_resolution) -> None:
    if next_interview_at is not None and last_human_resolution != "ADVANCE":
        raise HTTPException(
            status_code=422,
            detail="next_interview_at requires an explicit human ADVANCE",
        )


@app.post("/api/candidates", status_code=status.HTTP_201_CREATED)
def create_candidate(request: CandidateCreateRequest):
    _validate_next_interview(request.next_interview_at, None)
    candidate_id = f"cand_{uuid4().hex}"
    candidate = Candidate(
        id=candidate_id,
        name=request.name,
        initials=_candidate_initials(request.name),
        role=request.role,
        stage=request.stage,
        stage_entered_at=request.stage_entered_at,
        last_candidate_contact_at=request.last_candidate_contact_at,
        interview_completed_at=request.interview_completed_at,
        next_interview_at=request.next_interview_at,
        required_feedback_count=request.required_feedback_count,
    )
    repository.create_candidate_with_feedback(
        candidate,
        request.required_feedback_count,
        request.submitted_feedback_count,
    )
    return repository.candidate_view(candidate.id)


@app.patch("/api/candidates/{candidate_id}")
def update_candidate(candidate_id: str, request: CandidateUpdateRequest):
    candidate = repository.candidate(candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    current_view = repository.candidate_view(candidate_id)
    required_count = (
        request.required_feedback_count
        if request.required_feedback_count is not None
        else candidate.required_feedback_count
    )
    submitted_count = (
        request.submitted_feedback_count
        if request.submitted_feedback_count is not None
        else current_view.submitted_feedback_count
    )
    if submitted_count > required_count:
        raise HTTPException(
            status_code=422,
            detail="submitted_feedback_count cannot exceed required_feedback_count",
        )

    changes = request.model_dump(exclude_unset=True)
    changes.pop("submitted_feedback_count", None)
    if "next_interview_at" in changes:
        _validate_next_interview(changes["next_interview_at"], candidate.last_human_resolution)
    for field, value in changes.items():
        setattr(candidate, field, value)
    if "name" in changes:
        candidate.initials = _candidate_initials(candidate.name)
    repository.update_candidate_with_feedback(candidate, required_count, submitted_count)
    return repository.candidate_view(candidate.id)


@app.delete("/api/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(candidate_id: str):
    try:
        deleted = repository.delete_candidate(candidate_id)
    except PendingHumanDecisionError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/actions")
def list_actions():
    return repository.action_views()


@app.get("/api/decisions")
def list_decisions():
    return repository.decision_views()


@app.post("/api/agent/run")
def run_agent():
    try:
        return build_agent_runner(repository).run()
    except AgentConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AgentExecutionError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/decisions/{decision_id}/resolve")
def resolve_decision(decision_id: str, request: ResolveDecisionRequest):
    decision = repository.decision(decision_id)
    if decision is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    if decision.status != "pending":
        raise HTTPException(status_code=409, detail="Decision is already resolved")
    candidate = repository.candidate(decision.candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    decision.status = "resolved"
    decision.resolution = request.resolution
    decision.resolved_at = DEMO_NOW
    candidate.human_decision_status = "resolved"
    candidate.last_human_resolution = request.resolution
    candidate.stage_entered_at = DEMO_NOW
    if request.resolution == "ADVANCE":
        candidate.stage = Stage.PANEL_SCHEDULING
    elif request.resolution == "HOLD":
        candidate.stage = Stage.ON_HOLD
    else:
        candidate.stage = Stage.CLOSED
        candidate.status = "closed"
    repository.save_candidate(candidate)
    repository.save_decision(decision)
    return {"decision": decision, "candidate": repository.candidate_view(candidate.id)}


@app.post("/api/demo/reset")
def reset_demo():
    repository.reset()
    return {"status": "reset", "candidates": repository.candidate_views()}
