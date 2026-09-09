'use client';

import { CalendarDays, Clock3, ShieldCheck, UsersRound } from 'lucide-react';
import { useMemo } from 'react';
import {
  candidateSignal,
  formatDayTime,
  stageTone,
  waitTone,
} from '@/lib/candidateloop/format';
import type { Candidate } from '@/lib/candidateloop/types';

/** Segmented scorecard meter — reads faster than "3/4" at a glance. */
function FeedbackMeter({ submitted, required }: { submitted: number; required: number }) {
  return (
    <span
      className="flex items-center gap-1"
      aria-label={`${submitted} of ${required} required scorecards received`}
    >
      {Array.from({ length: required }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-4 rounded-full transition-colors ${
            index < submitted ? 'bg-emerald-500' : 'bg-amber-300'
          }`}
        />
      ))}
      <span className="ml-1 text-xs tabular-nums text-muted-foreground">
        {submitted}/{required}
      </span>
    </span>
  );
}

export function CandidateRail({
  candidates,
  selectedId,
  onSelect,
}: {
  candidates: Candidate[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  // Anything needing a human sorts first, then the longest-waiting workflows.
  const ordered = useMemo(
    () =>
      [...candidates]
        .map((candidate) => ({ candidate, signal: candidateSignal(candidate) }))
        .sort(
          (a, b) =>
            a.signal.priority - b.signal.priority ||
            b.candidate.days_in_stage - a.candidate.days_in_stage,
        ),
    [candidates],
  );

  return (
    <aside className="flex flex-col rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)] xl:sticky xl:top-[5.75rem] xl:max-h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Active candidates</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {candidates.length} workflows in motion
          </p>
        </div>
        <span className="grid size-8 place-items-center rounded-lg bg-secondary text-muted-foreground">
          <UsersRound className="size-4" aria-hidden="true" />
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {ordered.map(({ candidate, signal }) => {
          const isSelected = candidate.id === selectedId;
          return (
            <button
              type="button"
              key={candidate.id}
              onClick={() => onSelect(candidate.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={`relative w-full overflow-hidden rounded-xl border p-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                isSelected
                  ? 'border-primary/25 bg-secondary shadow-[0_1px_2px_rgb(15_23_42/0.06)]'
                  : 'border-transparent hover:border-border hover:bg-secondary/60'
              }`}
            >
              {signal.key === 'decision' && (
                <span
                  className="absolute inset-y-0 left-0 w-1 bg-violet-500"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/5 text-xs font-semibold text-primary">
                  {candidate.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{candidate.name}</span>
                    <span
                      className={`ml-auto size-2 shrink-0 rounded-full ${signal.dot} ${
                        signal.key === 'decision' ? 'cl-pulse' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {candidate.role}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[0.68rem] leading-4 ${stageTone(candidate.stage)}`}
                    >
                      {candidate.stage}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[0.68rem] leading-4 ${waitTone(candidate.days_in_stage)}`}
                    >
                      <Clock3 className="size-3" aria-hidden="true" />
                      {candidate.days_in_stage}d waiting
                    </span>
                  </div>

                  <p
                    className={`mt-2 w-fit rounded-md border px-1.5 py-0.5 text-[0.68rem] leading-4 ${signal.chip}`}
                  >
                    {signal.label}
                  </p>

                  {candidate.required_feedback_count > 0 && (
                    <div className="mt-2">
                      <FeedbackMeter
                        submitted={candidate.submitted_feedback_count}
                        required={candidate.required_feedback_count}
                      />
                    </div>
                  )}

                  {candidate.next_interview_at && (
                    <p className="mt-1.5 flex items-center gap-1 text-[0.68rem] leading-4 text-muted-foreground">
                      <CalendarDays className="size-3" aria-hidden="true" />
                      {formatDayTime(candidate.next_interview_at)} UTC
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="m-3 mt-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
          <ShieldCheck className="size-4" aria-hidden="true" /> Human-controlled
        </p>
        <p className="mt-1.5 text-xs leading-5 text-emerald-800">
          CandidateLoop coordinates work. Advance, Hold, and Reject exist only as human
          actions.
        </p>
      </div>
    </aside>
  );
}
