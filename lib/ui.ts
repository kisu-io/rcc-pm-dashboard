/**
 * Shared presentation vocabulary.
 *
 * Two problems this fixes:
 *
 *  1. The project-status badge map was defined verbatim in four files
 *     (app/page.tsx, app/projects/[id]/page.tsx, app/budget/page.tsx,
 *     components/ProjectCard.tsx), so a status added in one place quietly
 *     rendered grey in the other three.
 *
 *  2. Semantic state and identity were sharing colours. Red simultaneously
 *     meant "overdue", "EXPRESS" and "on the critical path"; department
 *     identity came from two unrelated palettes. Here, state has one scale and
 *     nothing else borrows it — department identity stays in
 *     lib/schedule-utils.ts::phaseColor.
 */

import type { ReadinessStatus } from './readiness';

/** projects.status → badge classes. The single definition. */
export const PROJECT_STATUS_BADGE: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  Complete: 'bg-green-100 text-green-700',
  'Not Started': 'bg-slate-100 text-slate-600',
  Pending: 'bg-purple-100 text-purple-700',
  Upcoming: 'bg-cyan-100 text-cyan-700',
};

export function projectStatusBadge(status: string | null | undefined): string {
  return (status && PROJECT_STATUS_BADGE[status]) || 'bg-slate-100 text-slate-600';
}

export type ReadinessPresentation = {
  /** English label — the programme runs bilingual copy. */
  label: string;
  /** Vietnamese label, shown as the secondary line. */
  labelVN: string;
  /** Chip classes. */
  chip: string;
  /** Colour for this department's work bar. */
  bar: string;
  /** One line explaining what the state means, used as the title attribute. */
  meaning: string;
};

/**
 * The five states a department can be in, and how each reads.
 *
 * These are derived from the data rather than invented: `not-mobilised` exists
 * because five departments carry readiness criteria with zero owners and zero
 * scheduled work, and `nothing-moved` exists because four more have every
 * single open item already past its date.
 */
export const READINESS_STATUS: Record<ReadinessStatus, ReadinessPresentation> = {
  'not-mobilised': {
    label: 'Not mobilised',
    labelVN: 'Chưa khởi động',
    chip: 'bg-slate-200 text-slate-700',
    bar: 'bg-slate-400',
    meaning: 'Readiness criteria defined, but nobody assigned and nothing scheduled.',
  },
  'nothing-moved': {
    label: 'Nothing moved',
    labelVN: 'Chưa triển khai',
    chip: 'bg-red-100 text-red-700',
    bar: 'bg-red-500',
    meaning: 'Every open item in this department is already past its date.',
  },
  behind: {
    label: 'Behind',
    labelVN: 'Chậm tiến độ',
    chip: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    meaning: 'Some work is past its date.',
  },
  'on-track': {
    label: 'On track',
    labelVN: 'Đúng tiến độ',
    chip: 'bg-blue-100 text-blue-700',
    bar: 'bg-blue-500',
    meaning: 'Open work, none of it late.',
  },
  clear: {
    label: 'Clear to open',
    labelVN: 'Sẵn sàng',
    chip: 'bg-green-100 text-green-700',
    bar: 'bg-green-500',
    meaning: 'Every gate met and no work outstanding.',
  },
};

/** Shared card shell. Only the block that needs emphasis should deviate. */
export const CARD = 'bg-white rounded-xl shadow-sm';
export const CARD_PAD = 'bg-white rounded-xl shadow-sm p-4';

/**
 * Minimum readable sizes for a screen used outdoors on a phone.
 *
 * The previous UI had ~320 uses of type at 12px or smaller, 142 of them at
 * 9–11px. These are the floors: labels 12px, data 14px, anything a decision
 * rests on 16px or larger.
 */
export const TYPE = {
  label: 'text-xs uppercase tracking-wide text-slate-500',
  data: 'text-sm',
  lead: 'text-base font-medium',
  figure: 'text-2xl md:text-3xl font-bold tabular-nums',
} as const;
