'use client';

import { Button } from '@/components/ui/button';
import { presentOperationalText } from '@/lib/candidateloop/format';
import type {
  Candidate,
  Decision,
  DecisionResolution,
} from '@/lib/candidateloop/types';

/** Only ever rendered from a decision the API already resolved; nothing is inferred. */
const RESOLUTION_PRESENTATION: Record<
  DecisionResolution,
  { label: string; tone: string }
> = {
  ADVANCE: { label: 'Advanced by you', tone: 'text-success' },
  HOLD: { label: 'Held by you', tone: 'text-waiting' },
  REJECT: { label: 'Rejected by you', tone: 'text-danger' },
};

function DecisionCard({
  decision,
  candidate,
  selected,
  disabled,
  onResolve,
  onSelectCandidate,
}: {
  decision: Decision;
  candidate: Candidate | undefined;
  selected: boolean;
  disabled: boolean;
  onResolve: (id: string, resolution: DecisionResolution) => void;
  onSelectCandidate: (id: string) => void;
}) {
  return (
    <article
      className={`border-b border-border border-l-2 px-3.5 py-3 ${
        selected ? 'border-l-agent bg-surface-2' : 'border-l-agent/50'
      }`}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-agent">
        <span className="size-1.5 rounded-full bg-agent" aria-hidden="true" />
        CandidateLoop paused here
      </p>

      <div className="mt-1.5 flex items-baseline gap-2">
        <button
          type="button"
          className="min-w-0 truncate text-left text-sm font-semibold outline-none hover:underline focus-visible:underline"
          onClick={() => onSelectCandidate(decision.candidate_id)}
        >
          {decision.candidate_name}
        </button>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {candidate?.stage}
        </span>
      </div>
      <p className="truncate text-xs text-muted-foreground">{decision.role}</p>

      <div className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
        <p>{presentOperationalText(decision.reason)}</p>
        <p>{presentOperationalText(decision.evidence)}</p>
        {candidate && (
          <p className="text-subtle">
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
          className="text-danger hover:text-danger"
          onClick={() => onResolve(decision.id, 'REJECT')}
          disabled={disabled}
        >
          Reject
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-subtle">
        You decide. The agent resumes coordination afterward.
      </p>
    </article>
  );
}

function ResolvedRow({
  decision,
  onSelectCandidate,
}: {
  decision: Decision;
  onSelectCandidate: (id: string) => void;
}) {
  const resolution = decision.resolution;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelectCandidate(decision.candidate_id)}
        className="flex w-full items-baseline gap-2 rounded-sm px-1.5 py-1 text-left outline-none transition-colors hover:bg-surface-hover/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
      >
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          {decision.candidate_name}
        </span>
        {resolution && (
          <span
            className={`shrink-0 text-xs font-medium ${RESOLUTION_PRESENTATION[resolution].tone}`}
          >
            {RESOLUTION_PRESENTATION[resolution].label}
          </span>
        )}
      </button>
    </li>
  );
}

export function DecisionQueue({
  decisions,
  candidates,
  selectedId,
  busy,
  onResolve,
  onSelectCandidate,
}: {
  decisions: Decision[];
  candidates: Candidate[];
  selectedId: string;
  busy: boolean;
  onResolve: (id: string, resolution: DecisionResolution) => void;
  onSelectCandidate: (id: string) => void;
}) {
  const pending = decisions.filter((decision) => decision.status === 'pending');
  const resolved = decisions.filter(
    (decision) => decision.status === 'resolved' && decision.resolution,
  );
  const hasPending = pending.length > 0;

  return (
    <section
      className={`min-h-full ${hasPending ? 'bg-card' : 'bg-background'}`}
      aria-label="Human decisions"
    >
      <div className="flex min-h-10 items-center border-b border-border px-3.5 py-2">
        <h2
          className={`text-xs font-semibold uppercase tracking-[0.07em] ${
            hasPending ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          Human decisions
        </h2>
        <span
          className={`ml-auto text-xs tabular-nums ${
            hasPending ? 'font-medium text-agent' : 'text-subtle'
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
          selected={decision.candidate_id === selectedId}
          disabled={busy}
          onResolve={onResolve}
          onSelectCandidate={onSelectCandidate}
        />
      ))}

      {!hasPending && (
        <p className="px-3.5 py-3 text-xs leading-5 text-subtle">
          Nothing waiting on you. CandidateLoop escalates here when a candidate
          needs hiring judgment, and never advances, holds, or rejects on its
          own.
        </p>
      )}

      {resolved.length > 0 && (
        <div className="border-t border-border px-2 py-2">
          <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-subtle">
            Resolved by you
          </p>
          <ul className="grid gap-px">
            {resolved.map((decision) => (
              <ResolvedRow
                key={decision.id}
                decision={decision}
                onSelectCandidate={onSelectCandidate}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
