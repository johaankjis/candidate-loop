'use client';

import { Command, Play, RefreshCw, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { ActivityFeed } from '@/components/candidateloop/activity-feed';
import { CandidateDetail } from '@/components/candidateloop/candidate-detail';
import { CandidateRail } from '@/components/candidateloop/candidate-rail';
import { DecisionQueue } from '@/components/candidateloop/decision-queue';
import { RunConsole } from '@/components/candidateloop/run-console';
import { Button } from '@/components/ui/button';
import { useCandidateLoop } from '@/lib/candidateloop/use-candidateloop';
import type { DecisionResolution } from '@/lib/candidateloop/types';

/** The hook surfaces every failure as status text, so the handlers only stop propagation. */
function swallow() {
  return undefined;
}

export default function Home() {
  const loop = useCandidateLoop();

  function handleRun() {
    loop.runAgent().catch(swallow);
  }

  function handleReset() {
    loop.resetDemo().catch(swallow);
  }

  function handleResolve(id: string, resolution: DecisionResolution) {
    loop.resolveDecision(id, resolution).catch(swallow);
  }

  const running = loop.busy === 'run';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1540px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Command className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-lg font-semibold tracking-[-0.03em]">
                CandidateLoop
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Recruiting operations cockpit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loop.pendingDecisions.length > 0 && (
              <span className="hidden items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 sm:flex">
                <ShieldAlert className="size-3.5" aria-hidden="true" />
                {loop.pendingDecisions.length} decision
                {loop.pendingDecisions.length === 1 ? '' : 's'} need you
              </span>
            )}

            {/* Truthful execution-mode label straight from the API. */}
            <span
              className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground md:flex"
              title={
                loop.connected
                  ? 'Connected to the local CandidateLoop API'
                  : 'API unavailable — showing preview data'
              }
            >
              {loop.connected ? (
                <Wifi className="size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <WifiOff className="size-3.5 text-amber-600" aria-hidden="true" />
              )}
              {loop.connected ? (loop.executionMode ?? 'connected') : 'preview data'}
            </span>

            <Button
              variant="outline"
              size="sm"
              aria-label="Reset demo to the four-candidate starting state"
              onClick={handleReset}
              disabled={loop.busy !== null}
            >
              <RefreshCw
                className={loop.busy === 'reset' ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Reset demo</span>
            </Button>
            <Button size="sm" onClick={handleRun} disabled={loop.busy !== null}>
              {running ? (
                <RefreshCw className="animate-spin" aria-hidden="true" />
              ) : (
                <Play className="fill-current" aria-hidden="true" />
              )}
              {running ? 'Running…' : 'Run agent'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1540px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <RunConsole
          phase={loop.phase}
          summary={loop.summary}
          statusMessage={loop.statusMessage}
          onRetry={handleRun}
          retryDisabled={loop.busy !== null}
        />

        <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_21rem]">
          <CandidateRail
            candidates={loop.candidates}
            selectedId={loop.selected?.id ?? loop.selectedId}
            onSelect={loop.setSelectedId}
          />

          <section className="min-w-0 space-y-4">
            <CandidateDetail candidate={loop.selected} />
            <ActivityFeed actions={loop.actions} revealOrder={loop.revealOrder} />
          </section>

          <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-[5.75rem]">
            <DecisionQueue
              decisions={loop.decisions}
              candidates={loop.candidates}
              busy={loop.busy !== null}
              onResolve={handleResolve}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
