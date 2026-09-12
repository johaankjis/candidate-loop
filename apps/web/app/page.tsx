'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ActivityFeed } from '@/components/candidateloop/activity-feed';
import { AgentConsole } from '@/components/candidateloop/agent-console';
import { CandidateDetail } from '@/components/candidateloop/candidate-detail';
import {
  CandidateEditorDialog,
  RemoveCandidateDialog,
} from '@/components/candidateloop/candidate-management';
import { CandidateRail } from '@/components/candidateloop/candidate-rail';
import { DecisionQueue } from '@/components/candidateloop/decision-queue';
import { Button } from '@/components/ui/button';
import { CANDIDATE_MANAGEMENT_STAGES } from '@/lib/candidateloop/format';
import { useCandidateLoop } from '@/lib/candidateloop/use-candidateloop';
import type {
  Candidate,
  CandidateInput,
  CandidateUpdateInput,
  DecisionResolution,
} from '@/lib/candidateloop/types';
import type { Busy } from '@/lib/candidateloop/use-candidateloop';

/** The hook surfaces every failure as status text, so handlers only stop propagation. */
function swallow() {
  return undefined;
}

function AgentStatus({ connected, busy }: { connected: boolean; busy: Busy }) {
  const working = busy === 'run';
  const label = !connected
    ? 'Agent offline'
    : working
      ? 'Agent working'
      : 'Agent online';
  const dot = !connected
    ? 'bg-subtle'
    : working
      ? 'cl-pulse bg-agent'
      : 'bg-success';
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title={
        connected
          ? 'Connected to the CandidateLoop API'
          : 'Start the local API to run the agent'
      }
    >
      <span
        className={`size-1.5 shrink-0 rounded-full ${dot}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export default function Home() {
  const loop = useCandidateLoop();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(
    null,
  );
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removingCandidate, setRemovingCandidate] = useState<Candidate | null>(
    null,
  );

  function handleRun() {
    loop.runAgent().catch(swallow);
  }

  function handleReset() {
    loop.resetDemo().catch(swallow);
  }

  function handleResolve(id: string, resolution: DecisionResolution) {
    loop.resolveDecision(id, resolution).catch(swallow);
  }

  function handleRetry(action: Exclude<Busy, null>) {
    if (action === 'reset') handleReset();
    else if (action === 'run') handleRun();
  }

  function handleAddCandidate() {
    setEditingCandidate(null);
    setEditorOpen(true);
  }

  function handleEditCandidate(candidate: Candidate) {
    setEditingCandidate(candidate);
    setEditorOpen(true);
  }

  function handleRemoveCandidate(candidate: Candidate) {
    setRemovingCandidate(candidate);
    setRemoveOpen(true);
  }

  function saveCandidate(input: CandidateInput) {
    if (!editingCandidate) return loop.createCandidate(input);
    const update: CandidateUpdateInput = { ...input };
    if (
      !CANDIDATE_MANAGEMENT_STAGES.includes(
        editingCandidate.stage as (typeof CANDIDATE_MANAGEMENT_STAGES)[number],
      )
    ) {
      delete update.stage;
    }
    return loop.updateCandidate(editingCandidate.id, update);
  }

  const running = loop.busy === 'run';
  const candidateBusy = loop.busy === 'candidate';
  const selectedId = loop.selected?.id ?? loop.selectedId;
  const selectedActions = loop.selected
    ? loop.actions.filter((action) => action.candidate_id === loop.selected?.id)
    : [];

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-4 py-2 sm:px-5">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-agent" aria-hidden="true" />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="shrink-0 text-sm font-semibold tracking-[-0.012em]">
              CandidateLoop
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Autonomous recruiting operations
            </span>
          </div>
        </div>

        <AgentStatus connected={loop.connected} busy={loop.busy} />

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={loop.busy !== null}
            aria-label="Reset demo to the four-candidate starting state"
          >
            {loop.busy === 'reset' ? 'Resetting…' : 'Reset demo'}
          </Button>
          <Button size="sm" onClick={handleRun} disabled={loop.busy !== null}>
            <Sparkles aria-hidden="true" />
            {running ? 'Reviewing…' : 'Run agent'}
          </Button>
        </div>
      </header>

      <div className="cl-shell min-h-0 flex-1">
        <div data-area="rail" className="flex min-h-0 flex-col">
          <CandidateRail
            candidates={loop.candidates}
            selectedId={selectedId}
            onSelect={loop.setSelectedId}
            onAdd={handleAddCandidate}
            disabled={loop.busy !== null}
          />
        </div>

        <section data-area="detail" className="min-w-0 bg-card">
          <CandidateDetail
            candidate={loop.selected}
            onEdit={handleEditCandidate}
            onRemove={handleRemoveCandidate}
            disabled={loop.busy !== null}
          />
        </section>

        <section
          data-area="activity"
          className="min-h-0 min-w-0 bg-card lg:overflow-y-auto"
        >
          <ActivityFeed
            actions={selectedActions}
            revealOrder={loop.revealOrder}
          />
        </section>

        <div
          data-area="control"
          className="min-h-0 border-t border-border lg:border-l lg:border-t-0 lg:overflow-y-auto"
        >
          <AgentConsole
            phase={loop.phase}
            summary={loop.summary}
            lastRunActions={loop.lastRunActions}
            candidates={loop.candidates}
            revealOrder={loop.revealOrder}
            selectedId={selectedId}
            pendingDecisions={loop.pendingDecisions.length}
            connected={loop.connected}
            busy={loop.busy}
            failedAction={loop.failedAction}
            statusMessage={loop.statusMessage}
            onRun={handleRun}
            onRetry={handleRetry}
            onSelectCandidate={loop.setSelectedId}
          />
          <DecisionQueue
            decisions={loop.decisions}
            candidates={loop.candidates}
            selectedId={selectedId}
            busy={loop.busy !== null}
            onResolve={handleResolve}
            onSelectCandidate={loop.setSelectedId}
          />
        </div>
      </div>

      <CandidateEditorDialog
        open={editorOpen}
        candidate={editingCandidate}
        busy={candidateBusy}
        onOpenChange={setEditorOpen}
        onSave={saveCandidate}
      />
      <RemoveCandidateDialog
        open={removeOpen}
        candidate={removingCandidate}
        busy={candidateBusy}
        onOpenChange={setRemoveOpen}
        onRemove={() =>
          removingCandidate
            ? loop.deleteCandidate(removingCandidate.id)
            : Promise.reject(new Error('No candidate selected.'))
        }
      />
    </main>
  );
}
