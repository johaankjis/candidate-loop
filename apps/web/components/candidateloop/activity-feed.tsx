'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatTime, presentOperationalText } from '@/lib/candidateloop/format';
import type {
  AgentAction,
  AgentActionEventType,
} from '@/lib/candidateloop/types';

const EVENT_STYLE: Record<
  AgentActionEventType,
  {
    mark: string;
    markTone: string;
    label: string;
    labelTone: string;
    rule: string;
    title: string;
  }
> = {
  tool_action: {
    mark: '→',
    markTone: 'text-muted-foreground',
    label: '',
    labelTone: 'text-muted-foreground',
    rule: 'border-l-transparent',
    title: 'text-foreground',
  },
  human_decision: {
    mark: '◆',
    markTone: 'text-amber-700',
    label: 'Needs decision',
    labelTone: 'text-amber-800',
    rule: 'border-l-amber-600',
    title: 'font-semibold text-foreground',
  },
  no_action: {
    mark: '–',
    markTone: 'text-muted-foreground/60',
    label: 'No action',
    labelTone: 'text-muted-foreground',
    rule: 'border-l-border/60',
    title: 'font-normal text-muted-foreground',
  },
};

const DETAILS: { key: keyof AgentAction; label: string }[] = [
  { key: 'observed', label: 'Observed' },
  { key: 'reason', label: 'Reason' },
  { key: 'action', label: 'Action' },
  { key: 'result', label: 'Result' },
];

const REVEAL_BASE_MS = 120;
const REVEAL_STEP_MS = 170;

function ActivityRow({
  item,
  expanded,
  onToggle,
  revealIndex,
}: {
  item: AgentAction;
  expanded: boolean;
  onToggle: () => void;
  revealIndex: number | undefined;
}) {
  const style = EVENT_STYLE[item.event_type] ?? EVENT_STYLE.tool_action;

  return (
    <article
      className={`cl-card -ml-2 grid grid-cols-[20px_minmax(0,1fr)] border-b border-l-2 border-b-border/60 py-2 pl-2 ${style.rule}`}
      style={
        revealIndex === undefined
          ? undefined
          : {
              animationDelay: `${REVEAL_BASE_MS + revealIndex * REVEAL_STEP_MS}ms`,
            }
      }
    >
      <span
        className={`font-mono text-xs leading-5 ${style.markTone}`}
        aria-hidden="true"
      >
        {style.mark}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <div className="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-2">
            <h3 className={`text-sm leading-5 ${style.title}`}>
              {item.action}
            </h3>
            {style.label && (
              <span
                className={`text-xs font-semibold uppercase tracking-[0.06em] ${style.labelTone}`}
              >
                {style.label}
              </span>
            )}
          </div>
          <time className="shrink-0 font-mono text-xs text-muted-foreground">
            {formatTime(item.created_at)}
          </time>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {presentOperationalText(item.result)}
        </p>

        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="mt-0.5 -ml-2 h-6 px-2 font-normal text-muted-foreground"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? 'Hide reasoning' : 'Reasoning'}
        </Button>

        {expanded && (
          <dl className="mb-1 grid gap-1 border-l border-border pl-3">
            {DETAILS.map((detail) => (
              <div
                key={detail.label}
                className="grid gap-0.5 text-xs sm:grid-cols-[62px_minmax(0,1fr)] sm:gap-2"
              >
                <dt className="text-muted-foreground">{detail.label}</dt>
                <dd className="leading-5 text-foreground/75">
                  {presentOperationalText(String(item[detail.key]))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
}

export function ActivityFeed({
  actions,
  revealOrder,
}: {
  actions: AgentAction[];
  revealOrder: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allOpen, setAllOpen] = useState(false);

  function toggleAll() {
    setAllOpen((current) => !current);
    setExpanded({});
  }

  return (
    <section>
      <div className="flex items-center gap-3 px-5 pb-1 pt-3 sm:px-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Activity
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {actions.length}
        </span>
        {actions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto font-normal text-muted-foreground"
            onClick={toggleAll}
          >
            {allOpen ? 'Collapse reasoning' : 'Expand reasoning'}
          </Button>
        )}
      </div>

      <div className="px-5 pb-7 sm:px-6">
        {actions.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No activity recorded for this candidate.
          </p>
        ) : (
          actions.map((item, index) => {
            const isExpanded = expanded[item.id] ?? allOpen;
            return (
              <ActivityRow
                key={item.id}
                item={item}
                expanded={isExpanded}
                onToggle={() =>
                  setExpanded((current) => ({
                    ...current,
                    [item.id]: !(current[item.id] ?? allOpen),
                  }))
                }
                revealIndex={
                  revealOrder[item.id] === undefined ? undefined : index
                }
              />
            );
          })
        )}
      </div>
    </section>
  );
}
