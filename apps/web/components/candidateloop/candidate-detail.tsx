'use client';

import { CalendarDays, Check, ClipboardCheck, Clock3, UserRoundCheck } from 'lucide-react';
import {
  STAGE_PIPELINE,
  candidateSignal,
  formatDayTime,
  stageIndex,
  stageTone,
  titleCase,
  waitTone,
} from '@/lib/candidateloop/format';
import type { Candidate } from '@/lib/candidateloop/types';

/** Horizontal pipeline so "where is this candidate" is answered without reading. */
function StagePipeline({ stage }: { stage: string }) {
  const current = stageIndex(stage);

  if (current === -1) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Workflow closed at <span className="font-medium text-slate-800">{stage}</span> by a
        recruiter decision.
      </div>
    );
  }

  return (
    <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Pipeline stage">
      {STAGE_PIPELINE.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-1">
            <div className="min-w-0 flex-1">
              <span
                className={`block h-1 rounded-full transition-colors ${
                  done ? 'bg-emerald-400' : active ? 'bg-sky-500' : 'bg-border'
                }`}
              />
              <span
                className={`mt-1.5 block truncate text-[0.68rem] leading-4 ${
                  active
                    ? 'font-medium text-foreground'
                    : done
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                }`}
              >
                {step}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </p>
      <p className={`mt-1.5 font-heading text-lg font-semibold tracking-tight ${tone ?? ''}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

export function CandidateDetail({ candidate }: { candidate: Candidate | undefined }) {
  if (!candidate) return null;
  const signal = candidateSignal(candidate);
  const required = candidate.required_feedback_count;
  const submitted = candidate.submitted_feedback_count;

  const decisionValue =
    candidate.human_decision_status === 'pending'
      ? 'Awaiting you'
      : candidate.last_human_resolution
        ? titleCase(candidate.last_human_resolution)
        : 'Not required';
  const decisionDetail =
    candidate.human_decision_status === 'pending'
      ? 'CandidateLoop stopped and escalated'
      : candidate.last_human_resolution
        ? 'Recorded by a recruiter'
        : 'No hiring judgment is due yet';

  return (
    <section className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${stageTone(candidate.stage)}`}
          >
            {candidate.stage}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-xs ${signal.chip}`}>
            {signal.label}
          </span>
        </div>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.035em]">
          {candidate.name}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {candidate.role} · {signal.detail}
        </p>
        <div className="mt-4">
          <StagePipeline stage={candidate.stage} />
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        <Stat
          icon={Clock3}
          label="Waiting time"
          value={`${candidate.days_in_stage}d`}
          detail={`In ${candidate.stage} since ${formatDayTime(candidate.stage_entered_at)} UTC`}
          tone={waitTone(candidate.days_in_stage)}
        />
        <Stat
          icon={ClipboardCheck}
          label="Feedback status"
          value={required > 0 ? `${submitted}/${required}` : 'None due'}
          detail={
            required === 0
              ? 'No interview scorecards are expected at this stage'
              : submitted >= required
                ? 'All required scorecards received'
                : `${required - submitted} scorecard${required - submitted === 1 ? '' : 's'} still outstanding`
          }
          tone={
            required > 0 && submitted < required ? 'text-amber-700' : 'text-emerald-700'
          }
        />
        <Stat
          icon={CalendarDays}
          label="Upcoming interview"
          value={candidate.next_interview_at ? formatDayTime(candidate.next_interview_at) : 'None'}
          detail={
            // Only claim the agent booked this when a recruiter advance actually
            // unlocked scheduling. Seeded interviews are not the agent's work.
            !candidate.next_interview_at
              ? 'Nothing is currently on the calendar'
              : candidate.last_human_resolution === 'ADVANCE'
                ? 'Scheduled by CandidateLoop after the recruiter advance'
                : 'Already on the calendar'
          }
        />
        <Stat
          icon={candidate.human_decision_status === 'pending' ? UserRoundCheck : Check}
          label="Decision status"
          value={decisionValue}
          detail={decisionDetail}
          tone={
            candidate.human_decision_status === 'pending' ? 'text-violet-700' : undefined
          }
        />
      </div>
    </section>
  );
}
