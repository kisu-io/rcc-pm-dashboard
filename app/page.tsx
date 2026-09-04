import Link from 'next/link';
import { getProjects, getTasks } from '@/lib/data-server';
import {
  todayISO,
  dayDiff,
  lookAhead,
  unscheduledByDepartment,
  isOpen,
} from '@/lib/readiness';
import { partitionByKind } from '@/lib/task-kind';
import {
  MODULE_ORDER,
  projectModules,
  portfolioModules,
  effectiveProgress,
} from '@/lib/modules';
import ModuleCard from '@/components/modules/ModuleCard';
import ProjectModuleGrid from '@/components/modules/ProjectModuleGrid';
import {
  LookAheadList,
  UnscheduledQueue,
  BlockerList,
} from '@/components/readiness/ReadinessLists';

export const dynamic = 'force-dynamic';

/**
 * Programme progress — the home screen agreed at the 2026-09-04 review.
 *
 * Three questions, in the order they were asked: how are the projects doing,
 * how is each of the six modules doing inside them, and what is pending.
 *
 * It restores the per-project bucket bars of the original homepage. What it
 * does not restore is that page's habit of showing a number where there was no
 * data: five of the six modules currently have no records, and this page says
 * so rather than drawing them at 0% beside modules genuinely stuck at 0%.
 */

const LOOK_AHEAD_DAYS = 14;
const OPENING_SOON_DAYS = 60;

interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'warning' | 'critical';
}

function Stat({ label, value, hint, tone = 'neutral' }: StatProps) {
  const emphasised = Number(value) > 0;
  const colour =
    tone === 'critical' && emphasised
      ? 'text-red-600'
      : tone === 'warning' && emphasised
        ? 'text-amber-700'
        : 'text-slate-900';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-slate-900/5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl md:text-3xl font-bold tabular-nums mt-1 ${colour}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export default async function ProgrammeProgressPage() {
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);
  const today = todayISO();

  const byProject = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.project_id) continue;
    const bucket = byProject.get(task.project_id);
    if (bucket) bucket.push(task);
    else byProject.set(task.project_id, [task]);
  }

  const portfolio = portfolioModules(projects, tasks, today);
  const rows = projects.map((project) => {
    const own = byProject.get(project.id) ?? [];
    return {
      project,
      modules: projectModules(project, own, today),
      overallPct: effectiveProgress(project, own),
      daysToTarget: project.target_end ? dayDiff(today, project.target_end) : null,
    };
  });

  // Worst first: late projects, then the nearest target, then undated ones.
  const ordered = [...rows].sort((a, b) => {
    const da = a.daysToTarget ?? Number.POSITIVE_INFINITY;
    const db = b.daysToTarget ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.project.name.localeCompare(b.project.name);
  });

  const pending = portfolio.reduce((sum, m) => sum + m.pending, 0);
  const overdue = portfolio.reduce((sum, m) => sum + m.overdue, 0);
  const liveModules = portfolio.filter((m) => m.total > 0).length;
  const openingSoon = rows.filter(
    (r) => r.daysToTarget != null && r.daysToTarget >= 0 && r.daysToTarget <= OPENING_SOON_DAYS,
  ).length;

  const { work } = partitionByKind(tasks);
  const upcoming = lookAhead(work, today, LOOK_AHEAD_DAYS);
  const unscheduled = unscheduledByDepartment(tasks);
  const blockers = tasks.filter((t) => isOpen(t) && !!t.constraint_note);

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Programme Progress</h1>
          <p className="text-sm text-slate-500">
            Tiến độ chương trình · {projects.length}{' '}
            {projects.length === 1 ? 'project' : 'projects'} · {MODULE_ORDER.length} modules ·{' '}
            {tasks.length} records
          </p>
        </div>
        <Link href="/projects" className="text-sm text-blue-600 hover:underline shrink-0">
          All projects →
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Stat
          label="Projects"
          value={projects.length}
          hint={`${openingSoon} within ${OPENING_SOON_DAYS} days`}
        />
        <Stat
          label="Modules live"
          value={`${liveModules} / ${MODULE_ORDER.length}`}
          hint="teams with records loaded"
        />
        <Stat label="Pending" value={pending} tone="warning" hint="open across all modules" />
        <Stat label="Overdue" value={overdue} tone="critical" hint="open and past its date" />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">Progress by module</h2>
            <p className="text-xs text-slate-500">
              Tiến độ theo hạng mục · rolled up across every project
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {portfolio.map((row) => (
            <ModuleCard key={row.module} row={row} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Projects by module</h2>
          <p className="text-xs text-slate-500">
            Tiến độ từng dự án theo hạng mục · nearest target date first
          </p>
        </div>
        {ordered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-sm text-slate-500">
            No projects yet.
          </div>
        ) : (
          <div className="space-y-4">
            {ordered.map((row) => (
              <ProjectModuleGrid
                key={row.project.id}
                project={row.project}
                modules={row.modules}
                overallPct={row.overallPct}
                daysToTarget={row.daysToTarget}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Pending attention</h2>
          <p className="text-xs text-slate-500">Cần xử lý · what is due, undated or blocked</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <LookAheadList tasks={upcoming} today={today} horizonDays={LOOK_AHEAD_DAYS} />
          <UnscheduledQueue groups={unscheduled} />
          <BlockerList tasks={blockers} />
        </div>
      </section>
    </div>
  );
}
