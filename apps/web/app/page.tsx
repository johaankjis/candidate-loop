'use client';

import { useState } from 'react';
import { ActivityFeed } from '@/components/candidateloop/activity-feed';
import { CandidateDetail } from '@/components/candidateloop/candidate-detail';
import {
  CandidateEditorDialog,
  RemoveCandidateDialog,
} from '@/components/candidateloop/candidate-management';
import { CandidateRail } from '@/components/candidateloop/candidate-rail';
import { DecisionQueue } from '@/components/candidateloop/decision-queue';
import { RunConsole } from '@/components/candidateloop/run-console';
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
  const hasPendingDecisions = loop.pendingDecisions.length > 0;
  const selectedActions = loop.selected
    ? loop.actions.filter((action) => action.candidate_id === loop.selected?.id)
    : [];

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground xl:h-dvh xl:overflow-hidden">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2 sm:px-5">
        <div className="mr-auto flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-sm font-semibold tracking-[-0.012em]">
            CandidateLoop
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Recruiting operations
          </span>
        </div>

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
          {running ? 'Scanning…' : 'Scan pipeline'}
        </Button>
      </header>

      <RunConsole
        phase={loop.phase}
        summary={loop.summary}
        failedAction={loop.failedAction}
        statusMessage={loop.statusMessage}
        onRetry={handleRetry}
        retryDisabled={loop.busy !== null}
      />

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[258px_minmax(0,1fr)] xl:overflow-hidden ${
          hasPendingDecisions
            ? 'xl:grid-cols-[258px_minmax(400px,1fr)_336px]'
            : 'xl:grid-cols-[258px_minmax(400px,1fr)_186px]'
        }`}
      >
        <CandidateRail
          candidates={loop.candidates}
          selectedId={loop.selected?.id ?? loop.selectedId}
          onSelect={loop.setSelectedId}
          onAdd={handleAddCandidate}
          disabled={loop.busy !== null}
        />

        <section className="min-w-0 bg-card xl:min-h-0 xl:overflow-y-auto">
          <CandidateDetail
            candidate={loop.selected}
            onEdit={handleEditCandidate}
            onRemove={handleRemoveCandidate}
            disabled={loop.busy !== null}
          />
          <ActivityFeed
            actions={selectedActions}
            revealOrder={loop.revealOrder}
          />
        </section>

        <div className="border-t border-border lg:col-span-2 xl:col-span-1 xl:min-h-0 xl:border-l xl:border-t-0 xl:overflow-y-auto">
          <DecisionQueue
            decisions={loop.decisions}
            candidates={loop.candidates}
            busy={loop.busy !== null}
            onResolve={handleResolve}
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
