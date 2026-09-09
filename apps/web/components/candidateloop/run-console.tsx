'use client';

import {
  CalendarCheck,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Loader2,
  Mail,
  MinusCircle,
  Radar,
  ScanLine,
  Send,
  UserRoundCheck,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Busy } from '@/lib/candidateloop/use-candidateloop';
import type { RunPhase, RunSummary } from '@/lib/candidateloop/types';

type PhasePresentation = {
  icon: LucideIcon;
  label: string;
  /** Tailwind classes for the status medallion. */
  tone: string;
  spin?: boolean;
  /** Drives the indeterminate track shown while a run is in flight. */
  busy?: boolean;
};

const PHASES: Record<RunPhase, PhasePresentation> = {
  idle: { icon: Radar, label: 'Idle', tone: 'bg-slate-100 text-slate-500' },
  scanning: {
    icon: ScanLine,
    label: 'Scanning',
    tone: 'bg-sky-100 text-sky-700',
    spin: true,
    busy: true,
  },
  applying: {
    icon: Loader2,
    label: 'Acting',
    tone: 'bg-indigo-100 text-indigo-700',
    spin: true,
    busy: true,
  },
  complete: {
    icon: CircleCheck,
    label: 'Run complete',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  no_work: {
    icon: CircleSlash,
    label: 'No work required',
    tone: 'bg-slate-100 text-slate-600',
  },
  failed: {
    icon: CircleAlert,
    label: 'Run failed',
    tone: 'bg-red-100 text-red-700',
  },
};

/**
 * Reset and decision failures used to surface as "Run failed", which named the
 * wrong control. Each retryable control gets its own wording instead.
 */
const FAILURE: Record<Exclude<Busy, null>, { label: string; retry: string }> = {
  run: { label: 'Run failed', retry: 'Retry run' },
  reset: { label: 'Reset failed', retry: 'Retry reset' },
  decision: { label: 'Decision not recorded', retry: '' },
};

type Metric = {
  key: keyof RunSummary;
  label: string;
  icon: LucideIcon;
  /** Emphasised tiles are the ones a recruiter cares about most. */
  emphasis?: string;
};

const METRICS: Metric[] = [
  { key: 'candidates_scanned', label: 'Candidates scanned', icon: ScanLine },
  { key: 'actions_taken', label: 'Routine actions handled', icon: Zap },
  { key: 'reminders_sent', label: 'Reminders sent', icon: Mail },
  { key: 'candidate_updates_sent', label: 'Updates sent', icon: Send },
  { key: 'interviews_scheduled', label: 'Interviews scheduled', icon: CalendarCheck },
  {
    key: 'human_decisions_created',
    label: 'Decisions surfaced',
    icon: UserRoundCheck,
    emphasis: 'text-violet-700',
  },
  { key: 'no_action_needed', label: 'No action needed', icon: MinusCircle },
];

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
  const presentation = PHASES[phase];
  const Icon = presentation.icon;
  const failure = phase === 'failed' && failedAction ? FAILURE[failedAction] : null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
      aria-label="Agent run status and metrics"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl ${presentation.tone}`}
        >
          <Icon className={`size-4 ${presentation.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{failure?.label ?? presentation.label}</p>
            {summary && phase !== 'failed' && (
              <span className="text-xs text-muted-foreground">
                · {summary.candidates_scanned} workflows inspected
              </span>
            )}
          </div>
          {/*
            aria-live so the run outcome is announced rather than only shown.
            The message always comes from the API result or its error.
          */}
          <p
            aria-live="polite"
            className={`mt-0.5 truncate text-xs ${
              phase === 'failed' ? 'text-red-700' : 'text-muted-foreground'
            }`}
          >
            {statusMessage}
          </p>
        </div>
        {failure?.retry && failedAction && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(failedAction)}
            disabled={retryDisabled}
          >
            {failure.retry}
          </Button>
        )}
      </div>

      <div
        className="h-0.5 w-full overflow-hidden bg-border"
        role="presentation"
        data-active={presentation.busy ? 'true' : 'false'}
      >
        {presentation.busy && <div className="cl-indeterminate h-full w-1/3 bg-sky-500" />}
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-4 xl:grid-cols-7 xl:divide-y-0">
        {METRICS.map((metric) => {
          const value = summary?.[metric.key];
          const MetricIcon = metric.icon;
          return (
            <div key={metric.key} className="min-w-0 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MetricIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{metric.label}</span>
              </dt>
              <dd
                // Remounting on value change replays the count-in animation.
                key={String(value)}
                className={`cl-metric mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums ${
                  value ? (metric.emphasis ?? 'text-foreground') : 'text-muted-foreground/50'
                }`}
              >
                {value ?? '—'}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
