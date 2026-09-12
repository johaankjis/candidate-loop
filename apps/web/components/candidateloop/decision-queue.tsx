'use client';

import { Button } from '@/components/ui/button';
import { presentOperationalText } from '@/lib/candidateloop/format';
import type {
  Candidate,
  Decision,
  DecisionResolution,
} from '@/lib/candidateloop/types';

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
  return (
    <article className="border-b border-border px-3.5 py-3">
      <div className="flex items-baseline gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">
          {decision.candidate_name}
        </h3>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {candidate?.stage}
        </span>
      </div>
      <p className="truncate text-xs text-muted-foreground">{decision.role}</p>

      <div className="mt-2 grid gap-1 text-xs leading-5 text-foreground/75">
        <p>{presentOperationalText(decision.reason)}</p>
        <p>{presentOperationalText(decision.evidence)}</p>
        {candidate && (
          <p className="text-muted-foreground">
            {candidate.submitted_feedback_count} of{' '}
            {candidate.required_feedback_count} scorecards received ·{' '}
            {candidate.days_in_stage}d in stage
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          onClick={() => onResolve(decision.id, 'ADVANCE')}
          disabled={disabled}
        >
          Advance
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onResolve(decision.id, 'HOLD')}
          disabled={disabled}
        >
          Hold
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-muted-foreground"
          onClick={() => onResolve(decision.id, 'REJECT')}
          disabled={disabled}
        >
          Reject
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        You decide · agent takes no further step until then
      </p>
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
  const hasPending = pending.length > 0;

  return (
    <section
      className={`min-h-full ${hasPending ? 'bg-card' : 'bg-[oklch(0.985_0.002_90)]'}`}
    >
      <div
        className={`flex min-h-10 items-center border-b px-3.5 py-2 ${
          hasPending ? 'border-border' : 'border-border/50'
        }`}
      >
        <h2
          className={`text-xs font-semibold uppercase tracking-[0.07em] ${
            hasPending ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          Human decisions
        </h2>
        <span
          className={`ml-auto text-xs tabular-nums ${
            hasPending ? 'text-amber-800' : 'text-muted-foreground/70'
          }`}
        >
          {pending.length} pending
        </span>
      </div>

      {pending.map((decision) => (
        <DecisionCard
          key={decision.id}
          decision={decision}
          candidate={candidates.find(
            (candidate) => candidate.id === decision.candidate_id,
          )}
          disabled={busy}
          onResolve={onResolve}
        />
      ))}
    </section>
  );
}
