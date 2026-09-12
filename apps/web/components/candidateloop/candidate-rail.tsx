'use client';

import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { candidateSignal } from '@/lib/candidateloop/format';
import type { Candidate } from '@/lib/candidateloop/types';

export function CandidateRail({
  candidates,
  selectedId,
  onSelect,
  onAdd,
  disabled,
}: {
  candidates: Candidate[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  disabled: boolean;
}) {
  // Anything needing a human floats to the top; ties fall back to who has
  // waited longest. Order can therefore change after a run — by design.
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
    <aside
      className="flex min-h-0 flex-1 flex-col border-b border-border bg-card lg:border-b-0 lg:border-r"
      aria-label="Candidates"
    >
      <div className="flex min-h-10 shrink-0 items-center border-b border-border px-3.5 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Candidates
        </h2>
        <span className="ml-2 text-xs tabular-nums text-subtle">
          {candidates.length}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={onAdd}
          disabled={disabled}
          className="ml-auto px-2 font-normal text-muted-foreground"
        >
          <Plus aria-hidden="true" /> Add
        </Button>
      </div>

      {/* Below lg the rail is a horizontal strip so the selected candidate and
          the agent stay above the fold; from lg it is the usual vertical list. */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden lg:block lg:overflow-x-hidden lg:overflow-y-auto">
        {ordered.map(({ candidate, signal }) => {
          const isSelected = candidate.id === selectedId;
          return (
            <button
              type="button"
              key={candidate.id}
              onClick={() => onSelect(candidate.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={`relative grid w-44 shrink-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 border-r border-border/70 px-3.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 lg:w-full lg:border-b lg:border-r-0 ${
                isSelected
                  ? 'bg-surface-2 shadow-[inset_0_-2px_0_var(--agent)] lg:shadow-[inset_2px_0_0_var(--agent)]'
                  : 'hover:bg-surface-hover/70'
              }`}
            >
              <span
                className={`truncate text-sm ${isSelected ? 'font-semibold' : 'font-medium'}`}
              >
                {candidate.name}
              </span>
              <span className="hidden whitespace-nowrap text-xs text-subtle lg:inline">
                {candidate.stage}
              </span>
              <span className="col-span-2 truncate text-xs text-muted-foreground lg:col-span-1">
                {candidate.role}
              </span>
              <span className="col-span-2 mt-1 flex min-w-0 items-center gap-1.5">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${signal.dot}`}
                  aria-hidden="true"
                />
                <span
                  className={`truncate text-xs ${
                    signal.key === 'decision'
                      ? 'font-medium text-agent'
                      : signal.key === 'feedback'
                        ? 'font-medium text-waiting'
                        : 'text-muted-foreground'
                  }`}
                >
                  {signal.label}
                </span>
              </span>
            </button>
          );
        })}

        {ordered.length === 0 && (
          <p className="px-3.5 py-3 text-xs text-muted-foreground">
            No active candidates.
          </p>
        )}
      </div>
    </aside>
  );
}
