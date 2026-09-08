'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewCandidates } from './preview';
import type {
  AgentAction,
  Candidate,
  Decision,
  DecisionResolution,
  RunPhase,
  RunResult,
  RunSummary,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Replay pacing for actions the run actually returned. Kept short for a live demo. */
const REVEAL_BASE_MS = 120;
const REVEAL_STEP_MS = 170;
const REVEAL_TAIL_MS = 320;

const RESOLUTIONS: DecisionResolution[] = ['ADVANCE', 'HOLD', 'REJECT'];

export type Busy = 'run' | 'reset' | 'decision' | null;

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
  const [executionMode, setExecutionMode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState('cand_sarah');
  const [busy, setBusy] = useState<Busy>(null);
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to scan candidate workflows.');
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
    const [candidateResponse, actionResponse, decisionResponse] = await Promise.all([
      fetch(`${API_URL}/api/candidates`),
      fetch(`${API_URL}/api/actions`),
      fetch(`${API_URL}/api/decisions`),
    ]);
    if (!candidateResponse.ok || !actionResponse.ok || !decisionResponse.ok) {
      throw new Error('CandidateLoop API is unavailable.');
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
        const health = await fetch(`${API_URL}/health`);
        if (health.ok) {
          const body = (await health.json()) as { execution_mode?: string };
          if (!cancelled && body.execution_mode) setExecutionMode(body.execution_mode);
        }
        await refresh();
      } catch {
        if (cancelled) return;
        setConnected(false);
        setStatusMessage('Preview data loaded — start the local API to run the agent.');
      }
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const pendingDecisions = useMemo(
    () => decisions.filter((decision) => decision.status === 'pending'),
    [decisions],
  );

  const selected = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0],
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

      const settled: RunPhase = result.summary.actions_taken === 0 ? 'no_work' : 'complete';
      if (prefersReducedMotion() || result.actions.length === 0) {
        setRevealOrder({});
        setPhase(settled);
        return;
      }
      setPhase('applying');
      const duration =
        REVEAL_BASE_MS + result.actions.length * REVEAL_STEP_MS + REVEAL_TAIL_MS;
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
    setStatusMessage('Scanning active candidate workflows…');
    try {
      const response = await fetch(`${API_URL}/api/agent/run`, { method: 'POST' });
      if (!response.ok) throw new Error('The agent run could not be started.');
      const result = (await response.json()) as RunResult;
      setSummary(result.summary);
      setExecutionMode(result.execution_mode);
      const snapshot = await refresh();

      // Pull the recruiter straight to whoever now needs them.
      const pending = snapshot.decisions.find((decision) => decision.status === 'pending');
      if (pending) setSelectedId(pending.candidate_id);

      stageReveal(result);
      setStatusMessage(
        result.summary.actions_taken === 0
          ? 'No action required — every workflow is already up to date.'
          : `${result.summary.actions_taken} routine action${
              result.summary.actions_taken === 1 ? '' : 's'
            } handled across ${result.summary.candidates_scanned} candidates.`,
      );
      return result;
    } catch (error) {
      clearRevealTimer();
      setPhase('failed');
      const message =
        error instanceof Error ? error.message : 'The agent run failed.';
      setStatusMessage(message);
      throw error;
    } finally {
      setBusy(null);
    }
  }, [clearRevealTimer, refresh, stageReveal]);

  const resetDemo = useCallback(async () => {
    setBusy('reset');
    try {
      const response = await fetch(`${API_URL}/api/demo/reset`, { method: 'POST' });
      if (!response.ok) throw new Error('Demo state could not be reset.');
      clearRevealTimer();
      setSummary(null);
      setRevealOrder({});
      setPhase('idle');
      await refresh();
      setSelectedId('cand_sarah');
      setStatusMessage('Demo restored to the four-candidate starting state.');
    } catch (error) {
      setPhase('failed');
      setStatusMessage(
        error instanceof Error ? error.message : 'Demo reset failed.',
      );
      throw error;
    } finally {
      setBusy(null);
    }
  }, [clearRevealTimer, refresh]);

  const resolveDecision = useCallback(
    async (decisionId: string, resolution: DecisionResolution) => {
      setBusy('decision');
      try {
        const response = await fetch(`${API_URL}/api/decisions/${decisionId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution }),
        });
        if (!response.ok) throw new Error('The decision could not be recorded.');
        await refresh();
        setStatusMessage(
          `${resolution} recorded by a recruiter. CandidateLoop will pick up the coordination.`,
        );
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : 'Decision update failed.',
        );
        throw error;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
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
    executionMode,
    connected,
    selected,
    selectedId,
    setSelectedId,
    busy,
    phase,
    statusMessage,
    revealOrder,
    runAgent,
    resetDemo,
    resolveDecision,
  };
}
