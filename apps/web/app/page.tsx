'use client';

import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Command,
  Inbox,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Candidate = {
  id: string;
  name: string;
  initials: string;
  role: string;
  stage: string;
  stage_entered_at: string;
  status: string;
  days_in_stage: number;
  last_candidate_contact_at: string;
  next_interview_at: string | null;
  submitted_feedback_count: number;
  required_feedback_count: number;
  human_decision_status: string;
};

type AgentAction = {
  id: string;
  candidate_id: string;
  candidate_name: string;
  event_type: string;
  observed: string;
  reason: string;
  action: string;
  result: string;
  tool: string;
  created_at: string;
};

type Decision = {
  id: string;
  candidate_id: string;
  candidate_name: string;
  role: string;
  reason: string;
  evidence: string;
  status: string;
};

type RunSummary = {
  candidates_scanned: number;
  actions_taken: number;
  reminders_sent: number;
  candidate_updates_sent: number;
  human_decisions_created: number;
  no_action_needed: number;
};

type RunResponse = {
  summary: RunSummary;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const previewCandidates: Candidate[] = [
  {
    id: 'cand_sarah',
    name: 'Sarah Chen',
    initials: 'SC',
    role: 'Senior Software Engineer',
    stage: 'Technical Interview',
    stage_entered_at: '2026-09-06T09:00:00Z',
    status: 'active',
    days_in_stage: 2,
    last_candidate_contact_at: '2026-09-06T10:00:00Z',
    next_interview_at: null,
    submitted_feedback_count: 3,
    required_feedback_count: 4,
    human_decision_status: 'none',
  },
  {
    id: 'cand_david',
    name: 'David Park',
    initials: 'DP',
    role: 'Product Manager',
    stage: 'Recruiter Review',
    stage_entered_at: '2026-09-03T09:00:00Z',
    status: 'active',
    days_in_stage: 5,
    last_candidate_contact_at: '2026-09-03T11:30:00Z',
    next_interview_at: null,
    submitted_feedback_count: 0,
    required_feedback_count: 0,
    human_decision_status: 'none',
  },
  {
    id: 'cand_emily',
    name: 'Emily Jones',
    initials: 'EJ',
    role: 'Senior Software Engineer',
    stage: 'Interview Complete',
    stage_entered_at: '2026-09-07T16:00:00Z',
    status: 'active',
    days_in_stage: 1,
    last_candidate_contact_at: '2026-09-06T14:00:00Z',
    next_interview_at: null,
    submitted_feedback_count: 4,
    required_feedback_count: 4,
    human_decision_status: 'none',
  },
  {
    id: 'cand_marcus',
    name: 'Marcus Reed',
    initials: 'MR',
    role: 'Data Engineer',
    stage: 'Technical Interview',
    stage_entered_at: '2026-09-07T10:00:00Z',
    status: 'active',
    days_in_stage: 1,
    last_candidate_contact_at: '2026-09-07T15:00:00Z',
    next_interview_at: '2026-09-09T14:00:00Z',
    submitted_feedback_count: 0,
    required_feedback_count: 3,
    human_decision_status: 'none',
  },
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function stageTone(stage: string) {
  if (stage === 'Interview Complete') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (stage === 'Recruiter Review') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

export default function Home() {
  const [candidates, setCandidates] = useState(previewCandidates);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState('cand_sarah');
  const [busy, setBusy] = useState<'run' | 'reset' | 'decision' | null>(null);
  const [notice, setNotice] = useState('Ready to scan candidate workflows.');

  const refresh = useCallback(async () => {
    const [candidateResponse, actionResponse, decisionResponse] = await Promise.all([
      fetch(`${API_URL}/api/candidates`),
      fetch(`${API_URL}/api/actions`),
      fetch(`${API_URL}/api/decisions`),
    ]);
    if (!candidateResponse.ok || !actionResponse.ok || !decisionResponse.ok) {
      throw new Error('CandidateLoop API is unavailable.');
    }
    const [candidateData, actionData, decisionData] = await Promise.all([
      candidateResponse.json() as Promise<Candidate[]>,
      actionResponse.json() as Promise<AgentAction[]>,
      decisionResponse.json() as Promise<Decision[]>,
    ]);
    setCandidates(candidateData);
    setActions(actionData);
    setDecisions(decisionData);
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setNotice('Preview data loaded — start the local API to run the agent.');
    });
  }, [refresh]);

  const selected = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidate) ?? candidates[0],
    [candidates, selectedCandidate],
  );

  async function runAgent() {
    setBusy('run');
    setNotice('CandidateLoop is scanning active workflows…');
    try {
      const response = await fetch(`${API_URL}/api/agent/run`, { method: 'POST' });
      if (!response.ok) throw new Error('The agent run could not be started.');
      const data = (await response.json()) as RunResponse;
      setSummary(data.summary);
      await refresh();
      setNotice(`Run complete · ${data.summary.actions_taken} safe actions handled.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The agent run failed.');
    } finally {
      setBusy(null);
    }
  }

  async function resetDemo() {
    setBusy('reset');
    try {
      const response = await fetch(`${API_URL}/api/demo/reset`, { method: 'POST' });
      if (!response.ok) throw new Error('Demo state could not be reset.');
      setSummary(null);
      await refresh();
      setNotice('Demo restored to the four-candidate starting state.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Demo reset failed.');
    } finally {
      setBusy(null);
    }
  }

  async function resolveDecision(id: string, resolution: string) {
    setBusy('decision');
    try {
      const response = await fetch(`${API_URL}/api/decisions/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      if (!response.ok) throw new Error('The decision could not be recorded.');
      await refresh();
      setNotice(`${resolution[0]}${resolution.slice(1).toLowerCase()} recorded as a human decision.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Decision update failed.');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const options = { signal: lifecycle.signal };
    const emptyInput = {
      type: 'object',
      properties: {},
      additionalProperties: false,
    };

    const registrations = [
      context.registerTool(
        {
          name: 'candidateloop_run',
          title: 'Run CandidateLoop',
          description:
            'Scan all active candidate workflows and complete permitted recruiting coordination actions.',
          inputSchema: emptyInput,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute() {
            setBusy('run');
            try {
              const response = await fetch(`${API_URL}/api/agent/run`, {
                method: 'POST',
              });
              if (!response.ok) throw new Error('The agent run failed.');
              const data = (await response.json()) as RunResponse;
              setSummary(data.summary);
              await refresh();
              setNotice(
                `Run complete · ${data.summary.actions_taken} safe actions handled.`,
              );
              return { status: 'complete', summary: data.summary };
            } finally {
              setBusy(null);
            }
          },
        },
        options,
      ),
      context.registerTool(
        {
          name: 'candidateloop_reset_demo',
          title: 'Reset CandidateLoop demo',
          description:
            'Restore the exact four-candidate synthetic demo state and clear prior actions.',
          inputSchema: emptyInput,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute() {
            setBusy('reset');
            try {
              const response = await fetch(`${API_URL}/api/demo/reset`, {
                method: 'POST',
              });
              if (!response.ok) throw new Error('Demo reset failed.');
              setSummary(null);
              await refresh();
              setNotice('Demo restored to the four-candidate starting state.');
              return { status: 'reset', candidateCount: 4 };
            } finally {
              setBusy(null);
            }
          },
        },
        options,
      ),
      context.registerTool(
        {
          name: 'candidateloop_resolve_human_decision',
          title: 'Resolve human decision',
          description:
            'Record a recruiter decision for one pending decision request. This is a human-authorized action.',
          inputSchema: {
            type: 'object',
            properties: {
              decisionId: { type: 'string', minLength: 1 },
              resolution: {
                type: 'string',
                enum: ['ADVANCE', 'HOLD', 'REJECT'],
              },
            },
            required: ['decisionId', 'resolution'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            if (
              typeof input !== 'object' ||
              input === null ||
              !('decisionId' in input) ||
              !('resolution' in input)
            ) {
              throw new Error('decisionId and resolution are required.');
            }
            const decisionId = input.decisionId;
            const resolution = input.resolution;
            if (
              typeof decisionId !== 'string' ||
              !['ADVANCE', 'HOLD', 'REJECT'].includes(String(resolution))
            ) {
              throw new Error('Invalid decision request.');
            }
            const response = await fetch(
              `${API_URL}/api/decisions/${decisionId}/resolve`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution }),
              },
            );
            if (!response.ok) throw new Error('Decision resolution failed.');
            await refresh();
            setNotice(`${String(resolution)} recorded as a human decision.`);
            return { status: 'resolved', decisionId, resolution };
          },
        },
        options,
      ),
    ];

    void Promise.all(registrations.map((item) => Promise.resolve(item))).catch(
      () => undefined,
    );
    return () => lifecycle.abort();
  }, [refresh]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1540px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Command className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold tracking-[-0.03em]">CandidateLoop</p>
              <p className="text-xs text-muted-foreground">Recruiting operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={resetDemo} disabled={busy !== null}>
              <RefreshCw className={`size-4 ${busy === 'reset' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Reset demo</span>
            </Button>
            <Button size="sm" onClick={runAgent} disabled={busy !== null}>
              {busy === 'run' ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
              Run agent
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1540px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_21rem] lg:px-8">
        <aside className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)] lg:sticky lg:top-[5.75rem] lg:h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <div>
              <p className="text-sm font-semibold">Active candidates</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{candidates.length} workflows in motion</p>
            </div>
            <div className="grid size-8 place-items-center rounded-lg bg-secondary text-muted-foreground">
              <UsersRound className="size-4" />
            </div>
          </div>
          <div className="space-y-1.5 p-2">
            {candidates.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                onClick={() => setSelectedCandidate(candidate.id)}
                className={`group flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                  selected?.id === candidate.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-secondary'
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                    selected?.id === candidate.id ? 'bg-white/12 text-white' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {candidate.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{candidate.name}</span>
                  <span className={`mt-0.5 block truncate text-xs ${selected?.id === candidate.id ? 'text-white/60' : 'text-muted-foreground'}`}>
                    {candidate.role}
                  </span>
                  <span className={`mt-2 flex items-center gap-1.5 text-xs ${selected?.id === candidate.id ? 'text-white/75' : 'text-muted-foreground'}`}>
                    <Clock3 className="size-3" /> {candidate.days_in_stage}d in stage
                  </span>
                </span>
                <ArrowRight className={`mt-1 size-3.5 transition ${selected?.id === candidate.id ? 'opacity-80' : 'opacity-0 group-hover:opacity-50'}`} />
              </button>
            ))}
          </div>
          <div className="mx-4 mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
              <ShieldCheck className="size-4" /> Human-controlled
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-800">CandidateLoop coordinates work. Hiring decisions always stay with your team.</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={stageTone(selected?.stage ?? '')}>{selected?.stage}</Badge>
                    {selected?.human_decision_status === 'pending' && (
                      <Badge className="bg-violet-100 text-violet-800">Human decision required</Badge>
                    )}
                  </div>
                  <h1 className="font-heading text-2xl font-semibold tracking-[-0.035em]">{selected?.name}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{selected?.role} · {selected?.days_in_stage} days in current stage</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:min-w-52">
                  <div className="rounded-xl bg-secondary px-3 py-2.5">
                    <p className="text-xl font-semibold tracking-tight">{selected?.submitted_feedback_count}/{selected?.required_feedback_count}</p>
                    <p className="text-xs text-muted-foreground">Scorecards</p>
                  </div>
                  <div className="rounded-xl bg-secondary px-3 py-2.5">
                    <p className="text-xl font-semibold tracking-tight">{selected?.days_in_stage}d</p>
                    <p className="text-xs text-muted-foreground">Stage time</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Activity className="size-4 text-sky-600" /> Workflow signal</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selected?.required_feedback_count
                    ? `${selected.submitted_feedback_count} of ${selected.required_feedback_count} required scorecards received.`
                    : 'No interview scorecards are expected at this stage.'}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4 text-violet-600" /> Next event</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selected?.next_interview_at
                    ? `Interview scheduled ${new Intl.DateTimeFormat('en', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(selected.next_interview_at))}.`
                    : 'No interview is currently scheduled.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold">Agent activity</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Observed → reasoned → acted → verified</p>
              </div>
              <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-emerald-500" /> {notice}</span>
            </div>
            {actions.length === 0 ? (
              <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
                <div>
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-sky-50 text-sky-700"><Sparkles className="size-5" /></div>
                  <h3 className="mt-4 text-sm font-semibold">The operations queue is ready</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Run the agent to scan all four workflows and safely handle any routine coordination it finds.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {actions.map((item) => (
                  <article key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[2.25rem_1fr_auto] sm:px-6">
                    <div className={`grid size-9 place-items-center rounded-xl ${item.event_type === 'human_decision' ? 'bg-violet-100 text-violet-700' : item.event_type === 'no_action' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.event_type === 'human_decision' ? <CircleAlert className="size-4" /> : <Check className="size-4" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{item.action}</p><Badge variant="outline" className="font-normal">{item.candidate_name}</Badge></div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.observed} {item.reason}</p>
                      <p className="mt-1 text-sm font-medium text-foreground/80">{item.result}</p>
                    </div>
                    <time className="text-xs text-muted-foreground">{formatTime(item.created_at)}</time>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-[5.75rem] lg:h-[calc(100vh-7rem)]">
          <section className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div>
                <h2 className="text-sm font-semibold">Human decisions</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{decisions.filter((decision) => decision.status === 'pending').length} need attention</p>
              </div>
              <UserRoundCheck className="size-4 text-violet-600" />
            </div>
            <div className="p-3">
              {decisions.filter((decision) => decision.status === 'pending').length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-7 text-center">
                  <Inbox className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Queue is clear</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">The agent will surface evidence when judgment is required.</p>
                </div>
              ) : (
                decisions.filter((decision) => decision.status === 'pending').map((decision) => (
                  <div key={decision.id} className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <Badge className="bg-violet-700 text-white">Decision required</Badge>
                    <h3 className="mt-3 text-sm font-semibold">{decision.candidate_name}</h3>
                    <p className="text-xs text-violet-800">{decision.role}</p>
                    <p className="mt-3 text-sm leading-6 text-violet-950">{decision.reason}</p>
                    <p className="mt-2 rounded-lg bg-white/70 p-2.5 text-xs leading-5 text-violet-900">{decision.evidence}</p>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {['ADVANCE', 'HOLD', 'REJECT'].map((resolution) => (
                        <Button
                          key={resolution}
                          variant={resolution === 'ADVANCE' ? 'default' : 'outline'}
                          size="sm"
                          className="px-2 text-xs"
                          disabled={busy !== null}
                          onClick={() => resolveDecision(decision.id, resolution)}
                        >
                          {resolution[0]}{resolution.slice(1).toLowerCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-primary p-4 text-primary-foreground shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.09em] text-white/60"><Sparkles className="size-3.5" /> Run impact</div>
            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10">
              <div className="bg-primary p-3"><p className="text-2xl font-semibold">{summary?.candidates_scanned ?? '—'}</p><p className="mt-1 text-xs text-white/55">Scanned</p></div>
              <div className="bg-primary p-3"><p className="text-2xl font-semibold">{summary?.actions_taken ?? '—'}</p><p className="mt-1 text-xs text-white/55">Handled</p></div>
              <div className="bg-primary p-3"><p className="text-2xl font-semibold">{summary?.reminders_sent ?? '—'}</p><p className="mt-1 text-xs text-white/55">Reminders</p></div>
              <div className="bg-primary p-3"><p className="text-2xl font-semibold">{summary?.human_decisions_created ?? '—'}</p><p className="mt-1 text-xs text-white/55">Escalated</p></div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
