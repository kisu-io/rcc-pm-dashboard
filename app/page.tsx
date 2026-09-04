import Link from 'next/link';
import { getProjects, getTasks, getMilestones } from '@/lib/data-server';
import {
  todayISO,
  programmeReadiness,
  departmentReadiness,
  lookAhead,
  unscheduledByDepartment,
  portfolioReadiness,
  isOpen,
} from '@/lib/readiness';
import { partitionByKind } from '@/lib/task-kind';
import { projectStatusBadge } from '@/lib/ui';
import ReadinessSummary from '@/components/readiness/ReadinessSummary';
import DepartmentLedger from '@/components/readiness/DepartmentLedger';
import PortfolioLedger from '@/components/readiness/PortfolioLedger';
import {
  LookAheadList,
  UnscheduledQueue,
  BlockerList,
} from '@/components/readiness/ReadinessLists';

export const dynamic = 'force-dynamic';

/**
 * Opening readiness — the programme's first screen.
 *
 * The previous dashboard was a portfolio overview: six KPI cards, four money
 * cards, an S-curve, a project-by-status bar chart and five phase bars. Against
 * this dataset that produced "Schedule Health 100%" beside "Avg Progress 6%",
 * four cards reading 0 (budget is null, cost_entries is empty), a flat S-curve
 * (planned_start is null on every row) and three phase bars pinned at 0%
 * forever — the taxonomy was residential development, while the programme's
 * axis is its operating departments.
 *
 * What a pre-opening PM needs is: how much of "ready to open" is signed off,
 * which department will stop us, and who to call. In that order.
 */

function PortfolioStat({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'critical';
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`text-2xl font-bold tabular-nums mt-1 ${
          tone === 'critical' && Number(value) > 0 ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

/** The date the programme is working towards. */
function resolveOpeningDate(
  projects: { target_end: string | null; status: string }[],
  milestones: { due_date: string | null; type: string | null }[],
): string | null {
  const targets = projects
    .filter((p) => p.status !== 'Complete')
    .map((p) => p.target_end)
    .filter((d): d is string => !!d)
    .sort();
  if (targets.length > 0) return targets[0];

  const opening = milestones
    .filter((m) => m.type === 'Opening' && !!m.due_date)
    .map((m) => m.due_date as string)
    .sort();
  return opening[0] ?? null;
}

export default async function OpeningReadinessPage() {
  const [projects, tasks, milestones] = await Promise.all([
    getProjects(),
    getTasks(),
    getMilestones(),
  ]);

  const today = todayISO();

  /**
   * With more than one programme, readiness has to stop at the project
   * boundary. Each project opens on its own date, so a single "5 / 323 gates"
   * would add up unrelated estates, and one department ledger would fold every
   * project's "Engineering" into a single row. The portfolio view ranks
   * projects by risk; the department detail lives on each project's page.
   */
  if (projects.length > 1) {
    const portfolio = portfolioReadiness(projects, tasks, today);
    const atRisk = portfolio.filter(
      (p) => p.risk === 'not-mobilised' || p.risk === 'nothing-moved',
    ).length;
    const opening60 = portfolio.filter(
      (p) => p.daysToOpening != null && p.daysToOpening >= 0 && p.daysToOpening <= 60,
    ).length;

    return (
      <div className="space-y-5 md:space-y-6">
        <header>
          <h1 className="text-xl md:text-2xl font-bold">Opening Readiness</h1>
          <p className="text-sm text-slate-500">
            Mức độ sẵn sàng khai trương · {projects.length} programmes · {tasks.length} records
          </p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <PortfolioStat label="Programmes" value={projects.length} />
          <PortfolioStat
            label="At risk"
            value={atRisk}
            tone={atRisk > 0 ? 'critical' : 'neutral'}
            hint="unmobilised or stalled"
          />
          <PortfolioStat label="Opening in 60 days" value={opening60} hint="sắp khai trương" />
          <PortfolioStat
            label="Work overdue"
            value={portfolio.reduce((s, p) => s + p.workOverdue, 0)}
            tone="critical"
            hint={`of ${portfolio.reduce((s, p) => s + p.workOpen, 0)} open`}
          />
        </div>

        <PortfolioLedger rows={portfolio} />
      </div>
    );
  }

  const openingDate = resolveOpeningDate(projects, milestones);
  const programme = programmeReadiness(tasks, today, openingDate);
  const departments = departmentReadiness(tasks, today);
  const { work } = partitionByKind(tasks);
  const upcoming = lookAhead(work, today, 14);
  const unscheduled = unscheduledByDepartment(tasks);
  const blockers = tasks.filter((t) => isOpen(t) && !!t.constraint_note);

  const programmeName = projects.length === 1 ? projects[0].name : 'Portfolio';

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Opening Readiness</h1>
          <p className="text-sm text-slate-500">
            Mức độ sẵn sàng khai trương · {programme.departmentCount} departments · {tasks.length}{' '}
            records
          </p>
        </div>
        {projects.length === 1 && (
          <Link
            href={`/projects/${projects[0].id}`}
            className="text-sm text-blue-600 hover:underline shrink-0"
          >
            Project detail →
          </Link>
        )}
      </header>

      <ReadinessSummary programme={programme} projectName={programmeName} />

      <DepartmentLedger rows={departments} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <LookAheadList tasks={upcoming} today={today} horizonDays={14} />
        <UnscheduledQueue groups={unscheduled} />
        <BlockerList tasks={blockers} />
      </div>

      {/* Only meaningful with more than one programme in the workspace. */}
      {projects.length > 1 && (
        <section className="bg-white rounded-xl shadow-sm">
          <header className="px-4 py-3 border-b border-slate-100 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Projects</h2>
            <Link href="/projects" className="text-sm text-blue-600 hover:underline">
              View all →
            </Link>
          </header>
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${projectStatusBadge(
                      p.status,
                    )}`}
                  >
                    {p.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
