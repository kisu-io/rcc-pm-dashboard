/**
 * The `tasks` table holds two structurally different kinds of record.
 *
 *   work — an action someone owns and schedules. `zone` is a workbook or
 *          department heading: 'ENGINEERING', 'EXECUTIVE HOUSEKEEPER',
 *          'OS&E', 'Final 60 days'. Nearly all carry a due date and an owner.
 *
 *   gate — an acceptance criterion for opening. The title is an end-state
 *          ('Security Systems Ready', 'Engineering Sign-off Completed') and
 *          `zone` is a numbered checklist heading ('8. Team Readiness') or
 *          null. Normally undated and unowned — correctly so.
 *
 * Mixing them is what made every completion ratio meaningless: the ratio was
 * dividing across two incompatible populations, and hundreds of undated
 * acceptance criteria were being counted as overdue work.
 *
 * supabase-phase8.sql adds an explicit `task_kind` column. Until (and in case)
 * it has been applied, we infer the same answer from `zone`, so the app and the
 * migration can deploy in either order.
 */

export type TaskKind = 'work' | 'gate';

/** A numbered checklist heading, e.g. '8. Team Readiness' or '10. Technology'. */
const NUMBERED_HEADING = /^\s*\d+\s*\./;

export type ClassifiableTask = {
  task_kind?: string | null;
  zone?: string | null;
};

/** Prefers the explicit column; falls back to the shape of `zone`. */
export function classifyTaskKind(task: ClassifiableTask): TaskKind {
  const explicit = task.task_kind;
  if (explicit === 'work' || explicit === 'gate') return explicit;

  const zone = task.zone;
  if (zone == null || zone.trim() === '') return 'gate';
  if (NUMBERED_HEADING.test(zone)) return 'gate';
  return 'work';
}

export function isGate(task: ClassifiableTask): boolean {
  return classifyTaskKind(task) === 'gate';
}

export function isWork(task: ClassifiableTask): boolean {
  return classifyTaskKind(task) === 'work';
}

/** Split once and reuse — classifying inside a render loop over 679 rows adds up. */
export function partitionByKind<T extends ClassifiableTask>(tasks: T[]): { work: T[]; gates: T[] } {
  const work: T[] = [];
  const gates: T[] = [];
  for (const t of tasks) {
    if (classifyTaskKind(t) === 'gate') gates.push(t);
    else work.push(t);
  }
  return { work, gates };
}

/**
 * True when the dataset carries real day-level dates rather than month buckets.
 *
 * On the Chateau De Saigon programme 319 of 366 dated rows fall on the 1st or
 * the 15th and only 30 distinct dates exist across the whole table — those are
 * months someone typed, not deadlines. Any UI that implies day precision
 * (a calendar, a day-by-day look-ahead) should check this first.
 */
export function hasDayPrecisionDates(
  tasks: { due_date?: string | null }[],
  threshold = 0.6,
): boolean {
  const dated = tasks.map((t) => t.due_date).filter((d): d is string => !!d);
  if (dated.length === 0) return false;
  const onBucketBoundary = dated.filter((d) => {
    const day = Number(d.slice(8, 10));
    return day === 1 || day === 15;
  }).length;
  return onBucketBoundary / dated.length < threshold;
}

/** First of the month, as stored in tasks.due_month. */
export function toDueMonth(due: string | null | undefined): string | null {
  if (!due) return null;
  return `${due.slice(0, 7)}-01`;
}
