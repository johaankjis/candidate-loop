'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewCandidates } from './preview';
import type {
  AgentAction,
  Candidate,
  CandidateInput,
  CandidateUpdateInput,
  Decision,
  DecisionResolution,
  RunPhase,
  RunResult,
  RunSummary,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Raised when the request never reached the API at all. `fetch` only rejects on
 * a transport failure, so this is the "backend is not running" case and needs
 * different copy from an API that answered with an error status.
 */
class ApiUnavailableError extends Error {
  constructor() {
    super(
      `Cannot reach the CandidateLoop API at ${API_URL}. Start the backend, then try again.`,
    );
    this.name = 'ApiUnavailableError';
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiUnavailableError();
  }
}

/** Keeps the HTTP status visible so a 4xx/5xx is not mistaken for an outage. */
function requireOk(response: Response, message: string): Response {
  if (!response.ok) throw new Error(`${message} (HTTP ${response.status})`);
  return response;
}

async function requireMutationOk(
  response: Response,
  message: string,
): Promise<Response> {
  if (response.ok) return response;
  const payload = (await response.json().catch(() => null)) as {
    detail?: unknown;
  } | null;
  const detail = typeof payload?.detail === 'string' ? payload.detail : null;
  throw new Error(detail ?? `${message} (HTTP ${response.status})`);
}

/**
 * Tools whose events represent a completed operational write, mapped to the
 * counter the backend increments for them. `record_agent_note` is absent on
 * purpose: it records a deliberate skip, never a write.
 */
const WRITE_TOOL_COUNTERS: Partial<Record<string, keyof RunSummary>> = {
  send_feedback_reminder: 'reminders_sent',
  send_candidate_status_update: 'candidate_updates_sent',
  create_human_decision: 'human_decisions_created',
  schedule_interview: 'interviews_scheduled',
};

/**
 * Rebuilds the newest run's counters and event list from the persisted action
 * feed, so a page reload does not present a finished demo as an untouched Idle
 * console.
 *
 * Counts only what the events themselves state — every candidate scanned in a
 * run gets exactly one event, so the run is fully described by its own records.
 * No text is interpreted, no record is synthesised, and no hiring outcome is
 * inferred. Returns null when nothing has run yet.
 */
function summariseNewestRun(
  actions: AgentAction[],
): { summary: RunSummary; actions: AgentAction[] } | null {
  const newest = actions[0];
  if (!newest) return null;
  const run = actions.filter((action) => action.run_id === newest.run_id);

  const summary: RunSummary = {
    candidates_scanned: new Set(run.map((action) => action.candidate_id)).size,
    actions_taken: 0,
    reminders_sent: 0,
    candidate_updates_sent: 0,
    human_decisions_created: 0,
    interviews_scheduled: 0,
    no_action_needed: 0,
  };

  for (const action of run) {
    if (action.event_type === 'no_action') {
      summary.no_action_needed += 1;
      continue;
    }
    summary.actions_taken += 1;
    // Guarded by event_type so a skipped write can never be counted as a sent
    // one, whatever tool the event names.
    const counter = WRITE_TOOL_COUNTERS[action.tool];
    if (counter) summary[counter] += 1;
  }
  return { summary, actions: run };
}

/** One wording for a settled run, shared by the live run and by rehydration. */
function describeRun(summary: RunSummary) {
  return summary.actions_taken === 0
    ? 'No action required — every workflow is already up to date.'
    : `${summary.actions_taken} routine action${
        summary.actions_taken === 1 ? '' : 's'
      } handled across ${summary.candidates_scanned} candidates.`;
}

/** Replay pacing for actions the run actually returned. Kept short for a live demo. */
const REVEAL_BASE_MS = 120;
const REVEAL_STEP_MS = 170;
const REVEAL_TAIL_MS = 320;

const RESOLUTIONS: DecisionResolution[] = ['ADVANCE', 'HOLD', 'REJECT'];

export type Busy = 'run' | 'reset' | 'decision' | 'candidate' | null;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isResolution(value: unknown): value is DecisionResolution {
  return RESOLUTIONS.includes(value as DecisionResolution);
}

type Snapshot = {
  candidates: Candidate[];
  actions: AgentAction[];
  decisions: Decision[];
};

export function useCandidateLoop() {
  const [candidates, setCandidates] = useState<Candidate[]>(previewCandidates);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  /**
   * The newest run's own events, exactly as the API returned or persisted
   * them, so the agent console can list what happened per candidate.
   */
  const [lastRunActions, setLastRunActions] = useState<AgentAction[]>([]);
  const [executionMode, setExecutionMode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState('cand_sarah');
  const [busy, setBusy] = useState<Busy>(null);
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [statusMessage, setStatusMessage] = useState(
    'Ready to scan candidate workflows.',
  );
  /** Which control last failed, so the console can name it instead of always saying "run". */
  const [failedAction, setFailedAction] = useState<Busy>(null);
  /** Action id → position in the newest run, used only for staggered reveal. */
  const [revealOrder, setRevealOrder] = useState<Record<string, number>>({});

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (revealTimer.current !== null) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  }, []);

  useEffect(() => clearRevealTimer, [clearRevealTimer]);

  const refresh = useCallback(async (): Promise<Snapshot> => {
    const [candidateResponse, actionResponse, decisionResponse] =
      await Promise.all([
        apiFetch('/api/candidates'),
        apiFetch('/api/actions'),
        apiFetch('/api/decisions'),
      ]);
    for (const response of [
      candidateResponse,
      actionResponse,
      decisionResponse,
    ]) {
      requireOk(response, 'CandidateLoop state could not be loaded.');
    }
    const snapshot: Snapshot = {
      candidates: (await candidateResponse.json()) as Candidate[],
      actions: (await actionResponse.json()) as AgentAction[],
      decisions: (await decisionResponse.json()) as Decision[],
    };
    setCandidates(snapshot.candidates);
    setActions(snapshot.actions);
    setDecisions(snapshot.decisions);
    setConnected(true);
    return snapshot;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const health = await apiFetch('/health');
        if (health.ok) {
          const body = (await health.json()) as { execution_mode?: string };
          if (!cancelled && body.execution_mode)
            setExecutionMode(body.execution_mode);
        }
        const snapshot = await refresh();
        if (cancelled) return;
        // A reload keeps the persisted feed but loses the in-memory summary, so
        // restore the newest run's console state from the events themselves.
        const restored = summariseNewestRun(snapshot.actions);
        if (restored) {
          setSummary(restored.summary);
          setLastRunActions(restored.actions);
          setPhase(
            restored.summary.actions_taken === 0 ? 'no_work' : 'complete',
          );
          setStatusMessage(describeRun(restored.summary));
        }
      } catch {
        if (cancelled) return;
        setConnected(false);
        setStatusMessage(
          'Preview data loaded — start the local API to run the agent.',
        );
      }
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /**
   * One place that decides what a failed control says. An unreachable API also
   * clears `connected`, so the header stops claiming a live backend.
   */
  const reportFailure = useCallback(
    (action: Exclude<Busy, null>, error: unknown) => {
      if (error instanceof ApiUnavailableError) setConnected(false);
      setFailedAction(action);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'The request failed. Please try again.',
      );
    },
    [],
  );

  const pendingDecisions = useMemo(
    () => decisions.filter((decision) => decision.status === 'pending'),
    [decisions],
  );

  const selected = useMemo(
    () =>
      candidates.find((candidate) => candidate.id === selectedId) ??
      candidates[0],
    [candidates, selectedId],
  );

  /**
   * Replays the actions this run returned so a viewer can follow them one at a
   * time. Nothing is synthesised — only the API's own events are staged.
   */
  const stageReveal = useCallback(
    (result: RunResult) => {
      clearRevealTimer();
      const order: Record<string, number> = {};
      result.actions.forEach((action, index) => {
        order[action.id] = index;
      });
      setRevealOrder(order);

      const settled: RunPhase =
        result.summary.actions_taken === 0 ? 'no_work' : 'complete';
      if (prefersReducedMotion() || result.actions.length === 0) {
        setRevealOrder({});
        setPhase(settled);
        return;
      }
      setPhase('applying');
      const duration =
        REVEAL_BASE_MS +
        result.actions.length * REVEAL_STEP_MS +
        REVEAL_TAIL_MS;
      revealTimer.current = setTimeout(() => {
        setPhase(settled);
        // Drop the stagger once it has played so later re-renders (filtering,
        // selecting a candidate) show the feed instantly instead of replaying it.
        setRevealOrder({});
      }, duration);
    },
    [clearRevealTimer],
  );

  const runAgent = useCallback(async () => {
    setBusy('run');
    setPhase('scanning');
    setRevealOrder({});
    setFailedAction(null);
    setStatusMessage('Scanning active candidate workflows…');
    try {
      const response = await apiFetch('/api/agent/run', { method: 'POST' });
      requireOk(response, 'The agent run could not be started.');
      const result = (await response.json()) as RunResult;
      setSummary(result.summary);
      setLastRunActions(result.actions);
      setExecutionMode(result.execution_mode);
      const snapshot = await refresh();

      // Pull the recruiter straight to whoever now needs them.
      const pending = snapshot.decisions.find(
        (decision) => decision.status === 'pending',
      );
      if (pending) setSelectedId(pending.candidate_id);

      stageReveal(result);
      setStatusMessage(describeRun(result.summary));
      return result;
    } catch (error) {
      clearRevealTimer();
      setPhase('failed');
      reportFailure('run', error);
      throw error;
    } finally {
      setBusy(null);
    }
  }, [clearRevealTimer, refresh, reportFailure, stageReveal]);

  const resetDemo = useCallback(async () => {
    setBusy('reset');
    setFailedAction(null);
    try {
      const response = await apiFetch('/api/demo/reset', { method: 'POST' });
      requireOk(response, 'Demo state could not be reset.');
      clearRevealTimer();
      setSummary(null);
      setLastRunActions([]);
      setRevealOrder({});
      setPhase('idle');
      await refresh();
      setSelectedId('cand_sarah');
      setStatusMessage('Demo restored to the four-candidate starting state.');
    } catch (error) {
      setPhase('failed');
      reportFailure('reset', error);
      throw error;
    } finally {
      setBusy(null);
    }
  }, [clearRevealTimer, refresh, reportFailure]);

  const resolveDecision = useCallback(
    async (decisionId: string, resolution: DecisionResolution) => {
      setBusy('decision');
      setFailedAction(null);
      try {
        const response = await apiFetch(
          `/api/decisions/${decisionId}/resolve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution }),
          },
        );
        requireOk(response, 'The decision could not be recorded.');
        await refresh();
        // Clear a previous failure banner; a run result stays as it was.
        setPhase((current) => (current === 'failed' ? 'idle' : current));
        setStatusMessage(
          `${resolution} recorded by a recruiter. CandidateLoop will pick up the coordination.`,
        );
      } catch (error) {
        setPhase('failed');
        reportFailure('decision', error);
        throw error;
      } finally {
        setBusy(null);
      }
    },
    [refresh, reportFailure],
  );

  const createCandidate = useCallback(
    async (input: CandidateInput) => {
      setBusy('candidate');
      try {
        const response = await apiFetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        await requireMutationOk(response, 'The candidate could not be added.');
        const candidate = (await response.json()) as Candidate;
        await refresh();
        setSelectedId(candidate.id);
        setStatusMessage(
          `${candidate.name} added. The next run will inspect this workflow.`,
        );
        return candidate;
      } catch (error) {
        if (error instanceof ApiUnavailableError) setConnected(false);
        throw error;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const updateCandidate = useCallback(
    async (candidateId: string, input: CandidateUpdateInput) => {
      setBusy('candidate');
      try {
        const response = await apiFetch(`/api/candidates/${candidateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        await requireMutationOk(
          response,
          'The candidate could not be updated.',
        );
        const candidate = (await response.json()) as Candidate;
        await refresh();
        setSelectedId(candidate.id);
        setStatusMessage(`${candidate.name}'s workflow was updated.`);
        return candidate;
      } catch (error) {
        if (error instanceof ApiUnavailableError) setConnected(false);
        throw error;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const deleteCandidate = useCallback(
    async (candidateId: string) => {
      setBusy('candidate');
      try {
        const candidate = candidates.find((item) => item.id === candidateId);
        const response = await apiFetch(`/api/candidates/${candidateId}`, {
          method: 'DELETE',
        });
        await requireMutationOk(
          response,
          'The candidate could not be removed.',
        );
        const snapshot = await refresh();
        if (selectedId === candidateId)
          setSelectedId(snapshot.candidates[0]?.id ?? '');
        setStatusMessage(
          `${candidate?.name ?? 'Candidate'} removed from active workflows.`,
        );
      } catch (error) {
        if (error instanceof ApiUnavailableError) setConnected(false);
        throw error;
      } finally {
        setBusy(null);
      }
    },
    [candidates, refresh, selectedId],
  );

  // Same three visible actions the cockpit exposes, offered to a WebMCP host.
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const options = { signal: lifecycle.signal };
    const emptyInput = {
      type: 'object',
      properties: {},
      additionalProperties: false,
    };

    void Promise.all([
      context.registerTool(
        {
          name: 'candidateloop_run',
          title: 'Run CandidateLoop',
          description:
            'Scan all active candidate workflows and complete permitted recruiting coordination actions.',
          inputSchema: emptyInput,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute() {
            const result = await runAgent();
            return { status: 'complete', summary: result.summary };
          },
        },
        options,
      ),
      context.registerTool(
        {
          name: 'candidateloop_reset_demo',
          title: 'Reset CandidateLoop demo',
          description:
            'Restore the exact four-candidate synthetic demo state and clear prior actions.',
          inputSchema: emptyInput,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute() {
            await resetDemo();
            return { status: 'reset', candidateCount: 4 };
          },
        },
        options,
      ),
      context.registerTool(
        {
          name: 'candidateloop_resolve_human_decision',
          title: 'Resolve human decision',
          description:
            'Record a recruiter decision for one pending decision request. This is a human-authorized action.',
          inputSchema: {
            type: 'object',
            properties: {
              decisionId: { type: 'string', minLength: 1 },
              resolution: { type: 'string', enum: RESOLUTIONS },
            },
            required: ['decisionId', 'resolution'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            if (typeof input !== 'object' || input === null) {
              throw new Error('decisionId and resolution are required.');
            }
            const { decisionId, resolution } = input as Record<string, unknown>;
            if (typeof decisionId !== 'string' || !isResolution(resolution)) {
              throw new Error('Invalid decision request.');
            }
            await resolveDecision(decisionId, resolution);
            return { status: 'resolved', decisionId, resolution };
          },
        },
        options,
      ),
    ]).catch(() => undefined);

    return () => lifecycle.abort();
  }, [runAgent, resetDemo, resolveDecision]);

  return {
    candidates,
    actions,
    decisions,
    pendingDecisions,
    summary,
    lastRunActions,
    executionMode,
    connected,
    selected,
    selectedId,
    setSelectedId,
    busy,
    phase,
    failedAction,
    statusMessage,
    revealOrder,
    runAgent,
    resetDemo,
    resolveDecision,
    createCandidate,
    updateCandidate,
    deleteCandidate,
  };
}
