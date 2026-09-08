'use client';

import {
  ArrowRight,
  CircleCheck,
  Eye,
  Hand,
  MinusCircle,
  Scale,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTime, humanizeTimestamps } from '@/lib/candidateloop/format';
import type { AgentAction, AgentActionEventType } from '@/lib/candidateloop/types';

/**
 * The four operational fields the backend records for every event. These are
 * structured tool-execution facts, not model reasoning traces.
 */
const STEPS: { key: keyof AgentAction; label: string; icon: LucideIcon; tone: string }[] = [
  { key: 'observed', label: 'Observed', icon: Eye, tone: 'text-sky-600' },
  { key: 'reason', label: 'Reason', icon: Scale, tone: 'text-amber-600' },
  { key: 'action', label: 'Action', icon: Zap, tone: 'text-indigo-600' },
  { key: 'result', label: 'Result', icon: CircleCheck, tone: 'text-emerald-600' },
];

const EVENT_STYLE: Record<
  AgentActionEventType,
  { icon: LucideIcon; medallion: string; card: string; ribbon?: string }
> = {
  tool_action: {
    icon: Zap,
    medallion: 'bg-emerald-100 text-emerald-700',
    card: 'border-border',
  },
  human_decision: {
    icon: Hand,
    medallion: 'bg-violet-100 text-violet-700',
    card: 'border-violet-300 bg-violet-50/40 ring-1 ring-violet-200',
    ribbon: 'Stopped for human judgment',
  },
  no_action: {
    icon: MinusCircle,
    medallion: 'bg-slate-100 text-slate-500',
    card: 'border-dashed border-border',
  },
};

type Filter = 'all' | 'tool_action' | 'human_decision' | 'no_action';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tool_action', label: 'Actions' },
  { key: 'human_decision', label: 'Escalations' },
  { key: 'no_action', label: 'Skipped' },
];

const REVEAL_BASE_MS = 120;
const REVEAL_STEP_MS = 170;

function ActionCard({
  item,
  revealIndex,
}: {
  item: AgentAction;
  revealIndex: number | undefined;
}) {
  const style = EVENT_STYLE[item.event_type] ?? EVENT_STYLE.tool_action;
  const Icon = style.icon;

  return (
    <article
      className={`cl-card rounded-xl border p-4 ${style.card}`}
      // Replays the run one event at a time; delay only, no synthesized content.
      style={
        revealIndex === undefined
          ? undefined
          : { animationDelay: `${REVEAL_BASE_MS + revealIndex * REVEAL_STEP_MS}ms` }
      }
      data-revealing={revealIndex === undefined ? undefined : 'true'}
    >
      <header className="flex flex-wrap items-start gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${style.medallion}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{item.action}</h3>
            <Badge variant="outline" className="font-normal">
              {item.candidate_name}
            </Badge>
          </div>
          {style.ribbon && (
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-violet-700">
              {style.ribbon}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground">
            {item.tool}
          </code>
          <time className="text-xs tabular-nums text-muted-foreground">
            {formatTime(item.created_at)}
          </time>
        </div>
      </header>

      <dl className="mt-3 space-y-1.5 border-l-2 border-border pl-3">
        {STEPS.map((step) => {
          const StepIcon = step.icon;
          return (
            <div key={step.label} className="grid gap-1 sm:grid-cols-[6.5rem_1fr] sm:gap-3">
              <dt
                className={`flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.07em] ${step.tone}`}
              >
                <StepIcon className="size-3.5 shrink-0" aria-hidden="true" />
                {step.label}
              </dt>
              <dd className="text-sm leading-6 text-foreground/85">
                {humanizeTimestamps(String(item[step.key]))}
              </dd>
            </div>
          );
        })}
      </dl>
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
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? actions : actions.filter((item) => item.event_type === filter)),
    [actions, filter],
  );

  // Actions arrive newest-first, so consecutive ids group cleanly into runs.
  const groups = useMemo(() => {
    const out: { runId: string; items: AgentAction[] }[] = [];
    for (const item of visible) {
      const current = out.at(-1);
      if (current && current.runId === item.run_id) current.items.push(item);
      else out.push({ runId: item.run_id, items: [item] });
    }
    return out;
  }, [visible]);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold">Agent activity</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            Observed <ArrowRight className="size-3" aria-hidden="true" /> Reason
            <ArrowRight className="size-3" aria-hidden="true" /> Action
            <ArrowRight className="size-3" aria-hidden="true" /> Result
          </p>
        </div>
        <div className="flex items-center gap-1" role="toolbar" aria-label="Filter agent activity">
          {FILTERS.map((option) => (
            <Button
              key={option.key}
              size="xs"
              variant={filter === option.key ? 'secondary' : 'ghost'}
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-sky-50 text-sky-700">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-semibold">
              {actions.length === 0
                ? 'The operations queue is ready'
                : 'Nothing matches this filter'}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              {actions.length === 0
                ? 'Run the agent to scan every active workflow and safely handle the routine coordination it finds.'
                : 'Switch back to All to see the rest of this run.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-5">
          {groups.map((group, groupIndex) => {
            const handled = group.items.filter(
              (item) => item.event_type !== 'no_action',
            ).length;
            return (
              <section key={group.runId} aria-label={`Agent run ${group.runId}`}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {groupIndex === 0 ? 'Latest run' : 'Earlier run'}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {handled} handled · {group.items.length - handled} skipped
                  </span>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
                <div className="space-y-2.5">
                  {group.items.map((item) => (
                    <ActionCard key={item.id} item={item} revealIndex={revealOrder[item.id]} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
