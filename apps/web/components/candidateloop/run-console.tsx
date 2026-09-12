'use client';

import { Button } from '@/components/ui/button';
import type { Busy } from '@/lib/candidateloop/use-candidateloop';
import type { RunPhase, RunSummary } from '@/lib/candidateloop/types';

const FAILURE: Record<Exclude<Busy, null>, { label: string; retry: string }> = {
  run: { label: 'Run failed', retry: 'Retry run' },
  reset: { label: 'Reset failed', retry: 'Retry reset' },
  decision: { label: 'Decision not recorded', retry: '' },
  candidate: { label: 'Candidate change failed', retry: '' },
};

function resultText(summary: RunSummary) {
  return `${summary.candidates_scanned} candidate${
    summary.candidates_scanned === 1 ? '' : 's'
  } scanned · ${summary.actions_taken} action${
    summary.actions_taken === 1 ? '' : 's'
  } · ${summary.human_decisions_created} decision${
    summary.human_decisions_created === 1 ? '' : 's'
  } · ${summary.no_action_needed} no action`;
}

export function RunConsole({
  phase,
  summary,
  failedAction,
  statusMessage,
  onRetry,
  retryDisabled,
}: {
  phase: RunPhase;
  summary: RunSummary | null;
  failedAction: Busy;
  statusMessage: string;
  onRetry: (action: Exclude<Busy, null>) => void;
  retryDisabled: boolean;
}) {
  if (phase === 'idle' && !summary) return null;

  const isBusy = phase === 'scanning' || phase === 'applying';
  const failure =
    phase === 'failed' && failedAction ? FAILURE[failedAction] : null;

  return (
    <section
      className={`shrink-0 border-b border-border ${
        phase === 'failed' ? 'bg-red-50' : 'bg-[oklch(0.985_0.002_90)]'
      }`}
      aria-label="Agent run status"
    >
      <div className="flex min-h-9 flex-wrap items-center gap-3 px-4 py-2 sm:px-5">
        {failure ? (
          <>
            <span className="text-xs font-semibold text-red-800">
              {failure.label}
            </span>
            <span className="min-w-0 flex-1 text-xs text-red-700" role="alert">
              {statusMessage}
            </span>
            {failure.retry && failedAction && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onRetry(failedAction)}
                disabled={retryDisabled}
              >
                {failure.retry}
              </Button>
            )}
          </>
        ) : isBusy ? (
          <>
            <span className="text-xs text-foreground/75">
              {phase === 'scanning'
                ? 'Scanning candidate workflows'
                : 'Applying run results'}
            </span>
            <span className="h-0.5 w-20 overflow-hidden rounded-full bg-border">
              <span className="cl-indeterminate block h-full w-1/3 bg-foreground" />
            </span>
            <span className="sr-only" aria-live="polite">
              {statusMessage}
            </span>
          </>
        ) : summary ? (
          <>
            <span className="text-xs tabular-nums text-foreground/75">
              {resultText(summary)}
            </span>
            <span className="sr-only" aria-live="polite">
              {statusMessage}
            </span>
          </>
        ) : null}
      </div>
    </section>
  );
}
