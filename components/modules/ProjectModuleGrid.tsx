import Link from 'next/link';
import { MapPin, User, Calendar } from 'lucide-react';
import type { ModuleProgress } from '@/lib/modules';
import { MODULE_LABELS, MODULE_COLORS } from '@/lib/modules';
import { projectStatusBadge } from '@/lib/ui';

/**
 * One project, broken down by module — the block the meeting asked for.
 *
 * This restores the shape of the old "Project Summary" card (a row per
 * project, a small bar per bucket) with three corrections. The buckets are the
 * six agreed modules rather than five inferred phases; a module with no
 * records reads "no records" instead of a misleading 0%; and pending work is
 * given its own line per module, because "60% done" and "14 overdue" are the
 * two halves of the same sentence and the old card only showed the first.
 */

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  location: string | null;
  pm: string | null;
  target_end: string | null;
}

export interface ProjectModuleGridProps {
  project: ProjectSummary;
  modules: ModuleProgress[];
  /** Headline percentage for the project as a whole. */
  overallPct: number;
  /** Whole days until target_end; negative is overdue, null when undated. */
  daysToTarget: number | null;
}

function ModuleTile({ row }: { row: ModuleProgress }) {
  const label = MODULE_LABELS[row.module];
  const empty = row.state === 'no-data';

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-xs font-medium text-slate-700 truncate" title={label.vn}>
          {label.en}
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-900 shrink-0">
          {empty ? '—' : `${row.progressPct}%`}
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-1" aria-hidden="true">
        <div
          className="h-full rounded-full"
          style={{ width: `${row.progressPct}%`, background: MODULE_COLORS[row.module] }}
        />
      </div>

      <div className="mt-1 text-xs tabular-nums leading-tight">
        {empty ? (
          <span className="text-slate-400">no records</span>
        ) : row.overdue > 0 ? (
          <span className="text-red-600 font-semibold">{row.overdue} overdue</span>
        ) : row.pending > 0 ? (
          <span className="text-amber-700">{row.pending} pending</span>
        ) : (
          <span className="text-green-600">clear</span>
        )}
      </div>
    </div>
  );
}

export default function ProjectModuleGrid({
  project,
  modules,
  overallPct,
  daysToTarget,
}: ProjectModuleGridProps) {
  const pending = modules.reduce((sum, m) => sum + m.pending, 0);
  const overdue = modules.reduce((sum, m) => sum + m.overdue, 0);
  const complete = project.status === 'Complete';

  const schedule = complete
    ? { text: 'Delivered', tone: 'text-green-600' }
    : daysToTarget == null
      ? { text: 'No target date', tone: 'text-slate-400' }
      : daysToTarget < 0
        ? { text: `${Math.abs(daysToTarget)} days late`, tone: 'text-red-600 font-semibold' }
        : daysToTarget <= 60
          ? { text: `${daysToTarget} days to target`, tone: 'text-amber-700 font-medium' }
          : { text: `${daysToTarget} days to target`, tone: 'text-slate-500' };

  return (
    <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="text-base font-semibold text-blue-700 hover:underline"
          >
            {project.name}
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden="true" /> {project.location || '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <User size={12} aria-hidden="true" /> {project.pm || '—'}
            </span>
            <span className={`inline-flex items-center gap-1 ${schedule.tone}`}>
              <Calendar size={12} aria-hidden="true" /> {schedule.text}
            </span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${projectStatusBadge(
            project.status,
          )}`}
        >
          {project.status}
        </span>
      </header>

      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Overall progress</span>
          <span className="text-sm font-bold tabular-nums">{overallPct}%</span>
        </div>
        <div className="h-2 w-full rounded-sm bg-slate-100 overflow-hidden mt-1.5" aria-hidden="true">
          <div className="h-full bg-slate-900/80 rounded-sm" style={{ width: `${overallPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums mt-1.5">
          <span className={pending > 0 ? 'text-amber-700 font-medium' : 'text-slate-400'}>
            {pending} pending
          </span>
          {overdue > 0 && <span className="text-red-600 font-semibold">{overdue} overdue</span>}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-4">
        {modules.map((row) => (
          <ModuleTile key={row.module} row={row} />
        ))}
      </div>
    </section>
  );
}
