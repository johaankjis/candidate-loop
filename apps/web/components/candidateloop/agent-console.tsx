'use client';

import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type {
  AgentAction,
  Candidate,
  RunPhase,
  RunSummary,
} from '@/lib/candidateloop/types';
import type { Busy } from '@/lib/candidateloop/use-candidateloop';

/**
 * The one instruction the backend can execute. `POST /api/agent/run` takes no
 * input: every run enumerates all active candidates and performs only the
 * permitted coordination steps. The composer echoes that contract rather than
 * pretending to accept free-form requests.
 */
export const RUN_INSTRUCTION =
  "Review the pipeline and handle anything that doesn't require my judgment.";

const FAILURE: Record<Exclude<Busy, null>, { label: string; retry: string }> = {
  run: { label: 'Run failed', retry: 'Retry run' },
  reset: { label: 'Reset failed', retry: 'Retry reset' },
  decision: { label: 'Decision not recorded', retry: '' },
  candidate: { label: 'Candidate change failed', retry: '' },
};

/** Same pacing the activity feed uses, so both surfaces reveal in step. */
const REVEAL_BASE_MS = 120;
const REVEAL_STEP_MS = 170;

type OutcomeTone = 'done' | 'decision' | 'none';

const TONE: Record<OutcomeTone, { mark: string; markClass: string }> = {
  done: { mark: '✓', markClass: 'text-success' },
  decision: { mark: '◇', markClass: 'text-agent' },
  none: { mark: '–', markClass: 'text-subtle' },
};

/**
 * Presentation for the backend's own tool names. Anything unrecognised falls
 * back to the event type and the API-authored action text, never to a guess.
 */
const TOOL_OUTCOME: Record<string, { tone: OutcomeTone; label: string }> = {
  send_feedback_reminder: { tone: 'done', label: 'Feedback reminder sent' },
  send_candidate_status_update: { tone: 'done', label: 'Status update sent' },
  schedule_interview: { tone: 'done', label: 'Interview scheduled' },
  create_human_decision: { tone: 'decision', label: 'Escalated to you' },
  record_agent_note: { tone: 'none', label: 'Already up to date' },
};

function outcomeFor(action: AgentAction) {
  const known = TOOL_OUTCOME[action.tool];
  if (known) return known;
  if (action.event_type === 'human_decision')
    return { tone: 'decision' as const, label: 'Escalated to you' };
  if (action.event_type === 'no_action')
    return { tone: 'none' as const, label: 'No action required' };
  return { tone: 'done' as const, label: action.action };
}

function plural(count: number, noun: string, pluralNoun = `${noun}s`) {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

/** Only lines with a non-zero count from the real summary are rendered. */
function summaryLines(summary: RunSummary) {
  const lines: { tone: OutcomeTone; text: string }[] = [];
  if (summary.reminders_sent > 0)
    lines.push({
      tone: 'done',
      text: `Sent ${plural(summary.reminders_sent, 'feedback reminder')}`,
    });
  if (summary.candidate_updates_sent > 0)
    lines.push({
      tone: 'done',
      text: `Sent ${plural(summary.candidate_updates_sent, 'candidate status update')}`,
    });
  if (summary.interviews_scheduled > 0)
    lines.push({
      tone: 'done',
      text: `Scheduled ${plural(summary.interviews_scheduled, 'interview')} after a recruiter Advance`,
    });
  if (summary.human_decisions_created > 0)
    lines.push({
      tone: 'decision',
      text: `${plural(summary.human_decisions_created, 'candidate requires', 'candidates require')} your decision`,
    });
  if (summary.no_action_needed > 0)
    lines.push({
      tone: 'none',
      text: `${plural(summary.no_action_needed, 'candidate')} already up to date`,
    });
  return lines;
}

function formatSeconds(ms: number) {
  return `${Math.max(0, Math.round(ms / 1000))}s`;
}

/** Wall-clock timer for the in-flight request. Measured, never estimated. */
function useRunTimer(phase: RunPhase) {
  const startedAt = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== 'scanning') {
      if (startedAt.current !== null) {
        setLastDurationMs(Date.now() - startedAt.current);
        startedAt.current = null;
      }
      return;
    }
    startedAt.current = Date.now();
    setElapsedMs(0);
    setLastDurationMs(null);
    const tick = setInterval(() => {
      if (startedAt.current !== null)
        setElapsedMs(Date.now() - startedAt.current);
    }, 250);
    return () => clearInterval(tick);
  }, [phase]);

  return { elapsedMs, lastDurationMs };
}

function Marker({ tone, pending }: { tone: OutcomeTone; pending?: boolean }) {
  if (pending) {
    return (
      <span
        className="cl-pulse mt-1.5 size-2 shrink-0 rounded-full border border-agent/70"
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={`w-3 shrink-0 text-center font-mono text-xs leading-5 ${TONE[tone].markClass}`}
      aria-hidden="true"
    >
      {TONE[tone].mark}
    </span>
  );
}

function ConsoleHeader({ phase }: { phase: RunPhase }) {
  const state: Record<RunPhase, { label: string; tone: string }> = {
    idle: { label: 'Idle', tone: 'text-subtle' },
    scanning: { label: 'Reviewing', tone: 'text-agent' },
    applying: { label: 'Applying', tone: 'text-agent' },
    complete: { label: 'Complete', tone: 'text-success' },
    no_work: { label: 'Complete', tone: 'text-success' },
    failed: { label: 'Failed', tone: 'text-danger' },
  };
  const current = state[phase];
  return (
    <div className="flex min-h-10 shrink-0 items-center gap-2 border-b border-border px-3.5 py-2">
      <Sparkles className="size-3.5 text-agent" aria-hidden="true" />
      <h2 className="text-xs font-semibold uppercase tracking-[0.07em] text-foreground">
        CandidateLoop Agent
      </h2>
      <span
        className={`ml-auto flex items-center gap-1.5 text-xs ${current.tone}`}
      >
        {(phase === 'scanning' || phase === 'applying') && (
          <span
            className="cl-pulse size-1.5 rounded-full bg-agent"
            aria-hidden="true"
          />
        )}
        {current.label}
      </span>
    </div>
  );
}

function Composer({
  compact,
  disabled,
  connected,
  onRun,
}: {
  compact: boolean;
  disabled: boolean;
  connected: boolean;
  onRun: () => void;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          Run the same review again
        </p>
        <Button size="sm" onClick={onRun} disabled={disabled}>
          <Sparkles aria-hidden="true" /> Run agent
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3.5 py-3">
      <p className="text-xs text-muted-foreground">
        Ask CandidateLoop to handle recruiting operations.
      </p>
      <div className="mt-2 rounded-md border border-input bg-background/60 px-3 py-2.5">
        <p className="text-sm leading-5 text-foreground">{RUN_INSTRUCTION}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[11px] leading-4 text-subtle">
            {connected
              ? 'Single supported instruction — a full pipeline review.'
              : 'Start the local API to run the agent.'}
          </p>
          <Button size="sm" onClick={onRun} disabled={disabled}>
            <Sparkles aria-hidden="true" /> Run agent
          </Button>
        </div>
      </div>

      <dl className="mt-3 grid gap-1.5 text-xs leading-5">
        <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
          <dt className="text-subtle">Handles</dt>
          <dd className="text-muted-foreground">
            Feedback reminders, neutral status updates, decision requests, and
            scheduling once you have advanced someone.
          </dd>
        </div>
        <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
          <dt className="text-subtle">Never</dt>
          <dd className="text-muted-foreground">
            Advance, hold, reject, rank, or score. Hiring judgment stops at you.
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ReviewInProgress({
  candidates,
  elapsedMs,
}: {
  candidates: Candidate[];
  elapsedMs: number;
}) {
  return (
    <div className="px-3.5 py-3" aria-live="polite">
      <p className="text-sm font-medium leading-5">
        Reviewing {plural(candidates.length, 'active candidate')}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Checking feedback, contact cadence, decision readiness, and approved
        scheduling ·{' '}
        <span className="font-mono tabular-nums">
          {formatSeconds(elapsedMs)}
        </span>
      </p>
      <span className="mt-2.5 block h-0.5 w-full overflow-hidden rounded-full bg-border">
        <span className="cl-indeterminate block h-full w-1/4 bg-agent" />
      </span>
      <ul className="mt-2.5 grid gap-px">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="cl-scanning flex items-start gap-2 rounded-sm px-1.5 py-1"
          >
            <Marker tone="none" pending />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5">
                {candidate.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {candidate.stage} · reviewing workflow
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunReport({
  summary,
  actions,
  revealOrder,
  selectedId,
  durationMs,
  pendingDecisions,
  onSelectCandidate,
}: {
  summary: RunSummary;
  actions: AgentAction[];
  revealOrder: Record<string, number>;
  selectedId: string;
  durationMs: number | null;
  pendingDecisions: number;
  onSelectCandidate: (id: string) => void;
}) {
  const [showCandidates, setShowCandidates] = useState(true);
  const lines = summaryLines(summary);
  const escalated = summary.human_decisions_created > 0;

  return (
    <div className="px-3.5 py-3">
      <p className="text-sm font-medium leading-5">
        CandidateLoop reviewed{' '}
        {plural(summary.candidates_scanned, 'active candidate')}
        {durationMs !== null && durationMs >= 1000 && (
          <span className="font-normal text-muted-foreground">
            {' '}
            in {formatSeconds(durationMs)}
          </span>
        )}
        .
      </p>

      <ul className="mt-2 grid gap-1">
        {lines.length === 0 ? (
          <li className="flex gap-2 text-sm leading-5 text-muted-foreground">
            <Marker tone="none" />
            Every workflow is already up to date.
          </li>
        ) : (
          lines.map((line) => (
            <li key={line.text} className="flex gap-2 text-sm leading-5">
              <Marker tone={line.tone} />
              <span
                className={
                  line.tone === 'none'
                    ? 'text-muted-foreground'
                    : line.tone === 'decision'
                      ? 'font-medium text-foreground'
                      : 'text-foreground'
                }
              >
                {line.text}
              </span>
            </li>
          ))
        )}
      </ul>

      {escalated && (
        <p className="mt-2.5 border-l-2 border-agent pl-2.5 text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">
            CandidateLoop paused here.
          </span>{' '}
          {pendingDecisions > 0
            ? 'You decide in Human decisions below — coordination resumes on the next run.'
            : 'You have decided — the next run picks up the coordination.'}
        </p>
      )}

      {actions.length > 0 && (
        <>
          <button
            type="button"
            className="mt-3 flex w-full items-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
            aria-expanded={showCandidates}
            onClick={() => setShowCandidates((current) => !current)}
          >
            <span className="font-semibold uppercase tracking-[0.07em]">
              By candidate
            </span>
            <span className="tabular-nums">{actions.length}</span>
            {showCandidates ? (
              <ChevronUp className="ml-auto size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="ml-auto size-3.5" aria-hidden="true" />
            )}
          </button>

          {showCandidates && (
            <ul className="mt-1.5 grid gap-px">
              {actions.map((action) => {
                const outcome = outcomeFor(action);
                const revealIndex = revealOrder[action.id];
                const isSelected = action.candidate_id === selectedId;
                return (
                  <li
                    key={action.id}
                    className={
                      revealIndex === undefined ? undefined : 'cl-card'
                    }
                    style={
                      revealIndex === undefined
                        ? undefined
                        : {
                            animationDelay: `${REVEAL_BASE_MS + revealIndex * REVEAL_STEP_MS}ms`,
                          }
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCandidate(action.candidate_id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`flex w-full items-start gap-2 rounded-sm px-1.5 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 ${
                        isSelected
                          ? 'bg-surface-hover'
                          : 'hover:bg-surface-hover/70'
                      }`}
                    >
                      <Marker tone={outcome.tone} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm leading-5">
                          {action.candidate_name}
                        </span>
                        <span
                          className={`block truncate text-xs ${
                            outcome.tone === 'decision'
                              ? 'text-agent'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {outcome.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function AgentConsole({
  phase,
  summary,
  lastRunActions,
  candidates,
  revealOrder,
  selectedId,
  pendingDecisions,
  connected,
  busy,
  failedAction,
  statusMessage,
  onRun,
  onRetry,
  onSelectCandidate,
}: {
  phase: RunPhase;
  summary: RunSummary | null;
  lastRunActions: AgentAction[];
  candidates: Candidate[];
  revealOrder: Record<string, number>;
  selectedId: string;
  pendingDecisions: number;
  connected: boolean;
  busy: Busy;
  failedAction: Busy;
  statusMessage: string;
  onRun: () => void;
  onRetry: (action: Exclude<Busy, null>) => void;
  onSelectCandidate: (id: string) => void;
}) {
  const { elapsedMs, lastDurationMs } = useRunTimer(phase);
  const active = candidates.filter(
    (candidate) => candidate.status === 'active',
  );
  const failure =
    phase === 'failed' && failedAction ? FAILURE[failedAction] : null;
  const showReport =
    summary !== null &&
    (phase === 'applying' || phase === 'complete' || phase === 'no_work');

  return (
    <section
      className="flex flex-col border-b border-border bg-card"
      aria-label="CandidateLoop agent"
    >
      <ConsoleHeader phase={phase} />

      {failure && (
        <div className="border-b border-border px-3.5 py-3" role="alert">
          <p className="text-xs font-semibold text-danger">{failure.label}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {statusMessage}
          </p>
          {failure.retry && failedAction && (
            <Button
              variant="outline"
              size="xs"
              className="mt-2"
              onClick={() => onRetry(failedAction)}
              disabled={busy !== null}
            >
              {failure.retry}
            </Button>
          )}
        </div>
      )}

      {phase === 'scanning' && (
        <ReviewInProgress candidates={active} elapsedMs={elapsedMs} />
      )}

      {showReport && summary && (
        <RunReport
          summary={summary}
          actions={lastRunActions}
          revealOrder={revealOrder}
          selectedId={selectedId}
          durationMs={lastDurationMs}
          pendingDecisions={pendingDecisions}
          onSelectCandidate={onSelectCandidate}
        />
      )}

      {phase !== 'scanning' && (
        <Composer
          compact={showReport || (phase === 'failed' && summary !== null)}
          disabled={busy !== null}
          connected={connected}
          onRun={onRun}
        />
      )}

      {phase !== 'failed' && (
        <p
          className="border-t border-border px-3.5 py-2 text-[11px] leading-4 text-subtle"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      )}
    </section>
  );
}
