from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from candidateloop.config import DEMO_NOW
from candidateloop.models import ResolveDecisionRequest, Stage
from candidateloop.repository import repository
from candidateloop.runner import DeterministicAgentRunner


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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "execution_mode": "deterministic_local"}


@app.get("/api/candidates")
def list_candidates():
    return repository.candidate_views()


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: str):
    candidate = repository.candidate_view(candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@app.get("/api/actions")
def list_actions():
    return repository.action_views()


@app.get("/api/decisions")
def list_decisions():
    return repository.decision_views()


@app.post("/api/agent/run")
def run_agent():
    return DeterministicAgentRunner(repository).run()


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
