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
    mark: '✓',
    markTone: 'text-success',
    label: 'Handled by agent',
    labelTone: 'text-subtle',
    rule: 'border-l-success/50',
    title: 'text-foreground',
  },
  human_decision: {
    mark: '◇',
    markTone: 'text-agent',
    label: 'Paused for you',
    labelTone: 'text-agent',
    rule: 'border-l-agent',
    title: 'font-semibold text-foreground',
  },
  no_action: {
    mark: '–',
    markTone: 'text-subtle',
    label: 'No action',
    labelTone: 'text-subtle',
    rule: 'border-l-border',
    title: 'font-normal text-muted-foreground',
  },
};

/**
 * The four application-generated audit fields, in the order the agent works:
 * what it saw, why that matters, what it did, what changed. Distinct label
 * tones keep the sequence scannable; the text is the backend's own.
 */
const DETAILS: {
  key: keyof AgentAction;
  label: string;
  tone: string;
}[] = [
  { key: 'observed', label: 'Observed', tone: 'text-muted-foreground' },
  { key: 'reason', label: 'Reason', tone: 'text-waiting' },
  { key: 'action', label: 'Action', tone: 'text-agent' },
  { key: 'result', label: 'Result', tone: 'text-success' },
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
      className={`cl-card -ml-2 grid grid-cols-[20px_minmax(0,1fr)] border-b border-l-2 border-b-border/70 py-2.5 pl-2 ${style.rule}`}
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
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            <h3 className={`text-sm leading-5 ${style.title}`}>
              {item.action}
            </h3>
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${style.labelTone}`}
            >
              {style.label}
            </span>
          </div>
          <time className="shrink-0 font-mono text-xs text-subtle">
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
          {expanded ? 'Hide reasoning' : 'Why'}
        </Button>

        {expanded && (
          <dl className="mb-1 mt-1 grid gap-1.5 rounded-md border border-border bg-background/60 p-2.5">
            {DETAILS.map((detail) => (
              <div
                key={detail.label}
                className="grid gap-0.5 text-xs sm:grid-cols-[68px_minmax(0,1fr)] sm:gap-2"
              >
                <dt
                  className={`font-mono text-[11px] uppercase tracking-[0.06em] leading-5 ${detail.tone}`}
                >
                  {detail.label}
                </dt>
                <dd className="leading-5 text-foreground/85">
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
    <section aria-label="Agent activity">
      <div className="flex items-center gap-3 px-5 pb-1 pt-3 sm:px-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Agent activity
        </h2>
        <span className="text-xs tabular-nums text-subtle">
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
            No agent activity yet for this candidate. Run the agent to review
            the pipeline.
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
