'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CANDIDATE_MANAGEMENT_STAGES,
  DEMO_NOW,
} from '@/lib/candidateloop/format';
import type { Candidate, CandidateInput } from '@/lib/candidateloop/types';

type CandidateForm = {
  name: string;
  role: string;
  stage: string;
  stageEnteredAt: string;
  lastContactAt: string;
  interviewCompletedAt: string;
  requiredFeedback: string;
  submittedFeedback: string;
};

function utcInputValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `days` before the fixed demo clock, as a datetime-local input value (UTC). */
function demoClockMinusDays(days: number) {
  return new Date(new Date(DEMO_NOW).getTime() - days * DAY_MS)
    .toISOString()
    .slice(0, 16);
}

function initialForm(candidate: Candidate | null): CandidateForm {
  // Defaults sit a little behind the demo clock so a new candidate reads as
  // "in motion" without immediately tripping the overdue/stale policies.
  const defaultStageEntered = demoClockMinusDays(2);
  const defaultLastContact = demoClockMinusDays(1);
  return {
    name: candidate?.name ?? '',
    role: candidate?.role ?? '',
    stage: candidate?.stage ?? 'Recruiter Review',
    stageEnteredAt:
      utcInputValue(candidate?.stage_entered_at ?? null) || defaultStageEntered,
    lastContactAt:
      utcInputValue(candidate?.last_candidate_contact_at ?? null) ||
      defaultLastContact,
    interviewCompletedAt: utcInputValue(
      candidate?.interview_completed_at ?? null,
    ),
    requiredFeedback: String(candidate?.required_feedback_count ?? 0),
    submittedFeedback: String(candidate?.submitted_feedback_count ?? 0),
  };
}

function isoFromUtcInput(value: string) {
  return new Date(`${value}:00Z`).toISOString();
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function CandidateEditorDialog({
  open,
  candidate,
  busy,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  candidate: Candidate | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CandidateInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState(() => initialForm(candidate));
  const [error, setError] = useState<string | null>(null);
  const stageIsWorkflowControlled = !CANDIDATE_MANAGEMENT_STAGES.includes(
    form.stage as (typeof CANDIDATE_MANAGEMENT_STAGES)[number],
  );

  useEffect(() => {
    if (open) {
      setForm(initialForm(candidate));
      setError(null);
    }
  }, [candidate, open]);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const required = Number(form.requiredFeedback);
    const submitted = Number(form.submittedFeedback);
    if (
      !Number.isInteger(required) ||
      !Number.isInteger(submitted) ||
      required < 0 ||
      submitted < 0
    ) {
      setError('Feedback counts must be whole numbers of zero or more.');
      return;
    }
    if (submitted > required) {
      setError('Submitted feedback cannot exceed required feedback.');
      return;
    }
    try {
      await onSave({
        name: form.name.trim(),
        role: form.role.trim(),
        stage: form.stage,
        stage_entered_at: isoFromUtcInput(form.stageEnteredAt),
        last_candidate_contact_at: isoFromUtcInput(form.lastContactAt),
        interview_completed_at: form.interviewCompletedAt
          ? isoFromUtcInput(form.interviewCompletedAt)
          : null,
        required_feedback_count: required,
        submitted_feedback_count: submitted,
      });
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The candidate could not be saved.',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {candidate ? 'Edit candidate' : 'Add candidate'}
          </DialogTitle>
          <DialogDescription>
            Use synthetic candidate data only. CandidateLoop will inspect this
            operational state on its next run.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <Field id="candidate-name" label="Name">
            <Input
              id="candidate-name"
              required
              maxLength={120}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </Field>
          <Field id="candidate-role" label="Role">
            <Input
              id="candidate-role"
              required
              maxLength={120}
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value })
              }
            />
          </Field>
          <Field id="candidate-stage" label="Stage">
            <Select
              disabled={stageIsWorkflowControlled}
              value={form.stage}
              onValueChange={(value) =>
                value && setForm({ ...form, stage: value })
              }
            >
              <SelectTrigger id="candidate-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stageIsWorkflowControlled && (
                  <SelectItem value={form.stage} disabled>
                    {form.stage} · workflow controlled
                  </SelectItem>
                )}
                {CANDIDATE_MANAGEMENT_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="candidate-stage-entered" label="Stage entered (UTC)">
            <Input
              id="candidate-stage-entered"
              required
              type="datetime-local"
              value={form.stageEnteredAt}
              onChange={(event) =>
                setForm({ ...form, stageEnteredAt: event.target.value })
              }
            />
          </Field>
          <Field
            id="candidate-last-contact"
            label="Last candidate contact (UTC)"
          >
            <Input
              id="candidate-last-contact"
              required
              type="datetime-local"
              value={form.lastContactAt}
              onChange={(event) =>
                setForm({ ...form, lastContactAt: event.target.value })
              }
            />
          </Field>
          <Field
            id="candidate-interview-completed"
            label="Interview completed (optional, UTC)"
          >
            <Input
              id="candidate-interview-completed"
              type="datetime-local"
              value={form.interviewCompletedAt}
              onChange={(event) =>
                setForm({ ...form, interviewCompletedAt: event.target.value })
              }
            />
          </Field>
          <Field id="candidate-required-feedback" label="Required feedback">
            <Input
              id="candidate-required-feedback"
              required
              type="number"
              min="0"
              step="1"
              value={form.requiredFeedback}
              onChange={(event) =>
                setForm({ ...form, requiredFeedback: event.target.value })
              }
            />
          </Field>
          <Field id="candidate-submitted-feedback" label="Submitted feedback">
            <Input
              id="candidate-submitted-feedback"
              required
              type="number"
              min="0"
              step="1"
              value={form.submittedFeedback}
              onChange={(event) =>
                setForm({ ...form, submittedFeedback: event.target.value })
              }
            />
          </Field>
          {error && (
            <p className="sm:col-span-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : candidate ? 'Save changes' : 'Add candidate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveCandidateDialog({
  open,
  candidate,
  busy,
  onOpenChange,
  onRemove,
}: {
  open: boolean;
  candidate: Candidate | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function remove() {
    setError(null);
    try {
      await onRemove();
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The candidate could not be removed.',
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/15 text-destructive">
            <Trash2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Remove {candidate?.name ?? 'candidate'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This removes their feedback, communications, activity, and completed
            decisions. A candidate awaiting a human decision cannot be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={remove}
            disabled={busy}
          >
            {busy ? 'Removing…' : 'Remove candidate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
