'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  STAGE_PIPELINE,
  formatDayTime,
  stageIndex,
} from '@/lib/candidateloop/format';
import type { Candidate, DecisionResolution } from '@/lib/candidateloop/types';

/** Past-tense wording for a recorded recruiter resolution; the API value itself is unchanged. */
const RESOLUTION_LABEL: Record<DecisionResolution, string> = {
  ADVANCE: 'Advanced by you',
  HOLD: 'Held by you',
  REJECT: 'Rejected by you',
};

function StagePipeline({ stage }: { stage: string }) {
  const current = stageIndex(stage);

  if (current === -1) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Workflow closed at{' '}
        <span className="font-medium text-foreground">{stage}</span> by a
        recruiter decision.
      </p>
    );
  }

  return (
    <ol
      className="mt-3 flex max-w-2xl items-start gap-1 overflow-x-auto"
      aria-label="Pipeline stage"
    >
      {STAGE_PIPELINE.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step}
            className={`min-w-20 ${active ? 'flex-[1.3]' : 'flex-1'}`}
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={`block rounded-sm ${
                done
                  ? 'mt-1 h-0.5 bg-foreground/70'
                  : active
                    ? 'h-1.5 bg-agent'
                    : 'mt-1 h-0.5 bg-border'
              }`}
              aria-hidden="true"
            />
            <span
              className={`mt-1 block truncate text-xs ${
                active
                  ? 'font-semibold text-foreground'
                  : done
                    ? 'text-muted-foreground'
                    : 'text-subtle'
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="min-w-0 border-border sm:border-l sm:px-4 sm:first:border-l-0 sm:first:pl-0">
      <dt className="truncate text-[11px] font-semibold uppercase tracking-[0.07em] text-subtle">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm tabular-nums ${
          attention ? 'font-semibold text-waiting' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function CandidateDetail({
  candidate,
  onEdit,
  onRemove,
  disabled,
}: {
  candidate: Candidate | undefined;
  onEdit: (candidate: Candidate) => void;
  onRemove: (candidate: Candidate) => void;
  disabled: boolean;
}) {
  if (!candidate) {
    return (
      <section className="border-b border-border px-6 py-5 text-sm text-muted-foreground">
        Add a candidate to start a workflow.
      </section>
    );
  }

  const required = candidate.required_feedback_count;
  const submitted = candidate.submitted_feedback_count;
  const decisionValue =
    candidate.human_decision_status === 'pending'
      ? 'Ready for review'
      : candidate.last_human_resolution
        ? RESOLUTION_LABEL[candidate.last_human_resolution]
        : 'None pending';

  const paused = candidate.human_decision_status === 'pending';

  return (
    <section className="border-b border-border px-5 py-4 sm:px-6">
      {paused && (
        <p className="mb-3 border-l-2 border-agent bg-agent/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-agent">
            CandidateLoop paused here.
          </span>{' '}
          Evidence is complete; the next step is your call.
        </p>
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-xl font-semibold tracking-[-0.015em]">
              {candidate.name}
            </h1>
            <span className="text-sm text-muted-foreground">
              {candidate.role}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" />}
            aria-label={`Actions for ${candidate.name}`}
            disabled={disabled}
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onEdit(candidate)}>
              <Pencil aria-hidden="true" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onRemove(candidate)}
            >
              <Trash2 aria-hidden="true" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <StagePipeline stage={candidate.stage} />

      <dl className="mt-4 grid gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          label="Waiting"
          value={`${candidate.days_in_stage}d in ${candidate.stage}`}
          attention={candidate.days_in_stage >= 5}
        />
        <Fact
          label="Feedback"
          value={required > 0 ? `${submitted} of ${required}` : 'None due'}
          attention={required > submitted}
        />
        <Fact
          label="Upcoming interview"
          value={
            candidate.next_interview_at
              ? `${formatDayTime(candidate.next_interview_at)} UTC`
              : 'None scheduled'
          }
        />
        <Fact
          label="Decision"
          value={decisionValue}
          attention={candidate.human_decision_status === 'pending'}
        />
      </dl>
    </section>
  );
}
