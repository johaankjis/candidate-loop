import type { Candidate } from './types';

/**
 * The backend pins demo time to a fixed UTC instant so reset and replay stay
 * reproducible. Rendering in UTC keeps the demo identical on every machine.
 */
const LOCALE = 'en-US';
const UTC = 'UTC';

/**
 * The fixed instant the backend treats as "now" (see `DEMO_NOW` in
 * `candidateloop/config.py`). Candidate dates entered in the cockpit should be
 * relative to this clock, not the browser's wall clock, or overdue/stale
 * policies will not fire the way the demo expects.
 */
export const DEMO_NOW = '2026-09-08T16:00:00Z';

const DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: UTC,
});

const TIME_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h12',
  timeZone: UTC,
});

function dateTimePart(
  formatter: Intl.DateTimeFormat,
  date: Date,
  type: Intl.DateTimeFormatPartTypes,
) {
  // ICU literals vary by runtime, so use only semantic parts and add separators ourselves.
  const value = formatter
    .formatToParts(date)
    .find((part) => part.type === type)?.value;

  if (value === undefined) {
    throw new RangeError(`Date formatter did not produce a ${type} part`);
  }

  return value;
}

function formatTimeParts(date: Date) {
  const hour = dateTimePart(TIME_FORMATTER, date, 'hour');
  const minute = dateTimePart(TIME_FORMATTER, date, 'minute');
  const dayPeriod = dateTimePart(TIME_FORMATTER, date, 'dayPeriod');

  return `${hour}:${minute} ${dayPeriod}`;
}

export function formatTime(value: string) {
  return formatTimeParts(new Date(value));
}

export function formatDayTime(value: string) {
  const date = new Date(value);
  const weekday = dateTimePart(DATE_FORMATTER, date, 'weekday');
  const month = dateTimePart(DATE_FORMATTER, date, 'month');
  const day = dateTimePart(DATE_FORMATTER, date, 'day');

  return `${weekday}, ${month} ${day} · ${formatTimeParts(date)}`;
}

/** ISO-8601 instants the backend embeds in operational text, e.g. a scheduled slot. */
const ISO_INSTANT =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g;

/**
 * Rewrites machine timestamps inside API-authored copy into the same readable
 * form the rest of the cockpit uses. Presentation only — the wording is the
 * backend's own.
 */
export function humanizeTimestamps(text: string) {
  return text.replace(ISO_INSTANT, (match) => {
    const parsed = new Date(match);
    return Number.isNaN(parsed.getTime())
      ? match
      : `${formatDayTime(match)} UTC`;
  });
}

/** Opaque backend identifiers the API embeds in audit copy, e.g. `decision_<hex>`. */
const INTERNAL_ID = /\s?\b(?:decision|action|run|cand)_[0-9a-f]{8,}\b/g;

/**
 * Drops internal record ids from API-authored copy so "Decision decision_ab12…
 * created." reads as "Decision created." Presentation only — the backend audit
 * record keeps the id.
 */
export function redactInternalIds(text: string) {
  return text.replace(INTERNAL_ID, '');
}

/** Full presentation pass for operational text: readable timestamps, no internal ids. */
export function presentOperationalText(text: string) {
  return redactInternalIds(humanizeTimestamps(text));
}

/** Stages generic candidate management may set without a workflow authorization. */
export const CANDIDATE_MANAGEMENT_STAGES = [
  'Recruiter Review',
  'Technical Interview',
  'Interview Complete',
] as const;

/** Ordered coordination pipeline. `On Hold` and `Closed` are terminal, not steps. */
export const STAGE_PIPELINE = [
  ...CANDIDATE_MANAGEMENT_STAGES,
  'Panel Scheduling',
  'Panel Interview',
] as const;

export function stageIndex(stage: string) {
  return STAGE_PIPELINE.indexOf(stage as (typeof STAGE_PIPELINE)[number]);
}

export function stageTone(stage: string) {
  switch (stage) {
    case 'Interview Complete':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'Recruiter Review':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'Panel Scheduling':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'Panel Interview':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'On Hold':
    case 'Closed':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700';
  }
}

export type SignalKey =
  | 'decision'
  | 'scheduling'
  | 'feedback'
  | 'scheduled'
  | 'hold'
  | 'closed'
  | 'ontrack';

export type CandidateSignal = {
  key: SignalKey;
  /** Sorts the rail so anything needing a human floats to the top. */
  priority: number;
  label: string;
  detail: string;
  dot: string;
  chip: string;
};

/**
 * Derives the single most important thing happening to a candidate from the
 * fields the API already returns, with no inference beyond that state.
 */
export function candidateSignal(candidate: Candidate): CandidateSignal {
  const missingFeedback =
    candidate.required_feedback_count - candidate.submitted_feedback_count;

  if (candidate.human_decision_status === 'pending') {
    return {
      key: 'decision',
      priority: 0,
      label: 'Needs your decision',
      detail: 'Evidence complete — waiting on a recruiter',
      dot: 'bg-violet-500',
      chip: 'border-violet-200 bg-violet-50 text-violet-700',
    };
  }
  if (candidate.status === 'closed') {
    return {
      key: 'closed',
      priority: 5,
      label: 'Closed',
      detail: 'Closed by a recruiter decision',
      dot: 'bg-slate-400',
      chip: 'border-slate-200 bg-slate-100 text-slate-600',
    };
  }
  if (candidate.stage === 'On Hold') {
    return {
      key: 'hold',
      priority: 4,
      label: 'On hold',
      detail: 'Held by a recruiter decision',
      dot: 'bg-slate-400',
      chip: 'border-slate-200 bg-slate-100 text-slate-600',
    };
  }
  if (candidate.stage === 'Panel Scheduling') {
    return {
      key: 'scheduling',
      priority: 1,
      label: 'Ready to schedule',
      detail: 'Advanced by a recruiter — panel scheduling is unlocked',
      dot: 'bg-indigo-500',
      chip: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    };
  }
  if (candidate.interview_completed_at && missingFeedback > 0) {
    return {
      key: 'feedback',
      priority: 2,
      label: `Waiting on ${missingFeedback} scorecard${missingFeedback === 1 ? '' : 's'}`,
      detail: 'Blocked until required interview feedback arrives',
      dot: 'bg-amber-500',
      chip: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  if (candidate.next_interview_at) {
    return {
      key: 'scheduled',
      priority: 3,
      label: 'Interview scheduled',
      detail: `Next interview ${formatDayTime(candidate.next_interview_at)} UTC`,
      dot: 'bg-emerald-500',
      chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  return {
    key: 'ontrack',
    priority: 3,
    label: 'On track',
    detail: 'No coordination is currently due',
    dot: 'bg-slate-300',
    chip: 'border-slate-200 bg-slate-100 text-slate-600',
  };
}

/** Waiting time escalates visually so a stalled candidate is obvious at a glance. */
export function waitTone(days: number) {
  if (days >= 5) return 'font-medium text-amber-700';
  if (days >= 3) return 'text-amber-600';
  return 'text-muted-foreground';
}

export function titleCase(value: string) {
  return `${value[0]}${value.slice(1).toLowerCase()}`;
}
