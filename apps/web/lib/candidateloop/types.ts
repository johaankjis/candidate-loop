/** Mirrors the CandidateLoop FastAPI response contract in `apps/agent/candidateloop/models.py`. */

export type DecisionStatus = 'none' | 'pending' | 'resolved';
export type DecisionResolution = 'ADVANCE' | 'HOLD' | 'REJECT';

export type Candidate = {
  id: string;
  name: string;
  initials: string;
  role: string;
  stage: string;
  stage_entered_at: string;
  status: string;
  last_candidate_contact_at: string;
  interview_completed_at: string | null;
  next_interview_at: string | null;
  required_feedback_count: number;
  human_decision_status: DecisionStatus;
  last_human_resolution: DecisionResolution | null;
  days_in_stage: number;
  submitted_feedback_count: number;
};

/** `tool_action` and `human_decision` change state; `no_action` records a deliberate skip. */
export type AgentActionEventType = 'tool_action' | 'human_decision' | 'no_action';

export type AgentAction = {
  id: string;
  run_id: string;
  candidate_id: string;
  candidate_name: string;
  event_type: AgentActionEventType;
  tool: string;
  observed: string;
  reason: string;
  action: string;
  result: string;
  created_at: string;
};

export type Decision = {
  id: string;
  candidate_id: string;
  candidate_name: string;
  role: string;
  decision_type: string;
  reason: string;
  evidence: string;
  status: DecisionStatus;
  created_at: string;
  resolved_at: string | null;
  resolution: DecisionResolution | null;
};

export type RunSummary = {
  candidates_scanned: number;
  actions_taken: number;
  reminders_sent: number;
  candidate_updates_sent: number;
  human_decisions_created: number;
  interviews_scheduled: number;
  no_action_needed: number;
};

export type RunResult = {
  run_id: string;
  execution_mode: string;
  summary: RunSummary;
  actions: AgentAction[];
};

/**
 * Lifecycle of one Run Agent press. `scanning` covers the in-flight request and
 * `applying` replays the actions the API actually returned, one at a time.
 */
export type RunPhase =
  | 'idle'
  | 'scanning'
  | 'applying'
  | 'complete'
  | 'no_work'
  | 'failed';
