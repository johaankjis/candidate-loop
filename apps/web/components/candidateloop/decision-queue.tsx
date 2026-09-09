'use client';

import {
  Check,
  CircleCheck,
  Hand,
  Inbox,
  Loader2,
  PauseCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDayTime, titleCase } from '@/lib/candidateloop/format';
import type { Candidate, Decision, DecisionResolution } from '@/lib/candidateloop/types';

const CHOICES: {
  resolution: DecisionResolution;
  label: string;
  icon: LucideIcon;
  hint: string;
  className: string;
}[] = [
  {
    resolution: 'ADVANCE',
    label: 'Advance',
    icon: Check,
    hint: 'Unlocks panel scheduling on the next run',
    className: 'bg-violet-700 text-white hover:bg-violet-800',
  },
  {
    resolution: 'HOLD',
    label: 'Hold',
    icon: PauseCircle,
    hint: 'Pauses the workflow with no candidate contact',
    className: '',
  },
  {
    resolution: 'REJECT',
    label: 'Reject',
    icon: XCircle,
    hint: 'Closes the workflow',
    className: '',
  },
];

function EvidenceRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-5 text-violet-900">
      <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-violet-600" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function DecisionCard({
  decision,
  candidate,
  disabled,
  onResolve,
}: {
  decision: Decision;
  candidate: Candidate | undefined;
  disabled: boolean;
  onResolve: (id: string, resolution: DecisionResolution) => void;
}) {
  const [submitting, setSubmitting] = useState<DecisionResolution | null>(null);

  function choose(resolution: DecisionResolution) {
    setSubmitting(resolution);
    onResolve(decision.id, resolution);
  }

  return (
    <article className="cl-card overflow-hidden rounded-xl border-2 border-violet-400 bg-violet-50 shadow-[0_2px_12px_rgb(109_40_217/0.12)]">
      <div className="flex items-center gap-2 bg-violet-700 px-3 py-2 text-white">
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.09em]">
          Human decision required
        </p>
        <span className="ml-auto size-2 rounded-full bg-white/90 cl-pulse" aria-hidden="true" />
      </div>

      <div className="p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-200 text-xs font-semibold text-violet-900">
            {candidate?.initials ?? decision.candidate_name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-violet-950">
              {decision.candidate_name}
            </h3>
            <p className="truncate text-xs text-violet-800">{decision.role}</p>
          </div>
        </div>

        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.07em] text-violet-700">
          Why this needs you
        </p>
        <p className="mt-1 text-sm leading-6 text-violet-950">{decision.reason}</p>

        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.07em] text-violet-700">
          Evidence complete
        </p>
        <ul className="mt-1.5 space-y-1 rounded-lg bg-white/70 p-2.5">
          <EvidenceRow>{decision.evidence}</EvidenceRow>
          {candidate?.interview_completed_at && (
            <EvidenceRow>
              Interview completed {formatDayTime(candidate.interview_completed_at)} UTC
            </EvidenceRow>
          )}
          {candidate && (
            <EvidenceRow>
              Stage {candidate.stage} · {candidate.days_in_stage}d waiting
            </EvidenceRow>
          )}
        </ul>

        <div className="mt-4 flex items-center gap-2">
          <Hand className="size-3.5 shrink-0 text-violet-700" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.07em] text-violet-700">
            Human action
          </p>
          <span className="h-px flex-1 bg-violet-300" aria-hidden="true" />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {CHOICES.map((choice) => {
            const ChoiceIcon = choice.icon;
            const active = submitting === choice.resolution;
            return (
              <Button
                key={choice.resolution}
                size="sm"
                variant={choice.resolution === 'ADVANCE' ? 'default' : 'outline'}
                className={`px-2 text-xs ${choice.className}`}
                title={choice.hint}
                aria-label={`${choice.label} ${decision.candidate_name} — recruiter decision`}
                disabled={disabled}
                onClick={() => choose(choice.resolution)}
              >
                {active ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <ChoiceIcon aria-hidden="true" />
                )}
                {choice.label}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-[0.68rem] leading-4 text-violet-800">
          Advance, Hold, and Reject are recruiter actions. CandidateLoop has no tool that can
          make them.
        </p>
      </div>
    </article>
  );
}

export function DecisionQueue({
  decisions,
  candidates,
  busy,
  onResolve,
}: {
  decisions: Decision[];
  candidates: Candidate[];
  busy: boolean;
  onResolve: (id: string, resolution: DecisionResolution) => void;
}) {
  const pending = decisions.filter((decision) => decision.status === 'pending');
  const resolved = decisions.filter((decision) => decision.status === 'resolved');

  return (
    <section className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Human decisions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pending.length === 0
              ? 'Nothing needs you right now'
              : `${pending.length} waiting on a recruiter`}
          </p>
        </div>
        {pending.length > 0 && (
          <span className="grid size-8 place-items-center rounded-lg bg-violet-100 text-violet-700">
            <ShieldAlert className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="space-y-3 p-3">
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-7 text-center">
            <Inbox className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Queue is clear</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              CandidateLoop surfaces a candidate here only once every operational
              prerequisite is complete.
            </p>
          </div>
        ) : (
          pending.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              candidate={candidates.find((item) => item.id === decision.candidate_id)}
              disabled={busy}
              onResolve={onResolve}
            />
          ))
        )}

        {resolved.length > 0 && (
          <div className="rounded-xl border border-border p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Recorded by a recruiter
            </h3>
            <ul className="mt-2 space-y-1.5">
              {resolved.map((decision) => (
                <li key={decision.id} className="flex items-center gap-2 text-xs">
                  <CircleCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="truncate font-medium">{decision.candidate_name}</span>
                  <span className="ml-auto shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[0.68rem] text-muted-foreground">
                    {decision.resolution ? titleCase(decision.resolution) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
