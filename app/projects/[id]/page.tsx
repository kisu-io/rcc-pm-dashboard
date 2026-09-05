import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProject, getTasks, getMilestones, getDocuments } from '@/lib/data-server';
import { formatVND, daysFromNow, isOverdue } from '@/lib/data';
import { effectiveProgress } from '@/lib/modules';
import { projectStatusBadge } from '@/lib/ui';
import { departmentReadiness, programmeReadiness, todayISO } from '@/lib/readiness';
import DepartmentLedger from '@/components/readiness/DepartmentLedger';
import ReadinessSummary from '@/components/readiness/ReadinessSummary';
import EditProjectButton from '@/components/EditProjectButton';
import EditGuard from '@/components/EditGuard';
import MilestonesList from '@/components/MilestonesList';
import ProjectDocuments from '@/components/ProjectDocuments';
import { ArrowLeft, MapPin, Calendar, Wallet, User, FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * How many task rows to render inline.
 *
 * This page used to print every row of the project's task table — 679 of them
 * — plus a red banner containing all 297 overdue titles joined by " · ", which
 * came to 19,441 characters, about 205 lines of unbroken text. The board is
 * where you work through them; here you get the count and the worst few.
 */
const TASK_ROW_LIMIT = 50;
const BANNER_SAMPLE = 3;

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const [tasks, milestones, documents] = await Promise.all([
    getTasks(project.id),
    getMilestones(project.id),
    getDocuments(project.id),
  ]);

  const budgetUtil = project.budget ? Math.round((project.spent / project.budget) * 100) : 0;
  const remaining = (project.budget || 0) - project.spent;
  const overdue = tasks.filter(isOverdue);
  const constraints = tasks.filter((t) => t.constraint_note);
  const done = tasks.filter((t) => t.kanban_status === 'Done').length;

  const effPct = effectiveProgress(project, tasks);
  const today = todayISO();
  const departments = departmentReadiness(tasks, today);
  /* Scoped to this project's own tasks and its own target date, so the figures
     mean the same thing here as on the portfolio screen — just for one
     programme. */
  const programme = programmeReadiness(tasks, today, project.target_end ?? null);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft size={14} /> Back to Projects
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{project.name}</h1>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1"><MapPin size={12} /> {project.location || '—'}</span>
              <span className="flex items-center gap-1"><User size={12} /> {project.pm || '—'}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {project.start_date || '—'} → {project.target_end || '—'}</span>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${projectStatusBadge(project.status)}`}>
            {project.status}
          </span>
          <EditGuard><EditProjectButton project={project} /></EditGuard>
        </div>
      </div>

      {/* Alerts */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div className="min-w-0 text-sm text-red-800">
            <p className="font-semibold">
              {overdue.length} task quá hạn · overdue
            </p>
            <ul className="mt-1.5 space-y-1 text-red-700">
              {overdue.slice(0, BANNER_SAMPLE).map((t) => (
                <li key={t.id} className="line-clamp-1 break-words">
                  <span className="tabular-nums text-red-600">{t.due_date}</span> — {t.title}
                </li>
              ))}
            </ul>
            {overdue.length > BANNER_SAMPLE && (
              <Link href="/tasks" className="inline-block mt-1.5 font-medium underline">
                See all {overdue.length} on the board →
              </Link>
            )}
          </div>
        </div>
      )}
      {constraints.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div className="min-w-0 text-sm text-amber-800">
            <p className="font-semibold">{constraints.length} ràng buộc · blocked</p>
            <ul className="mt-1.5 space-y-1 text-amber-700">
              {constraints.slice(0, BANNER_SAMPLE).map((t) => (
                <li key={t.id} className="line-clamp-2 break-words">
                  {t.title} — {t.constraint_note}
                </li>
              ))}
            </ul>
            {constraints.length > BANNER_SAMPLE && (
              <p className="mt-1.5 text-amber-600">
                +{constraints.length - BANNER_SAMPLE} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase">Progress</div>
          <div className="text-xl md:text-2xl font-bold">{effPct}%</div>
          <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#2563eb]" style={{ width: `${effPct}%` }} />
          </div>
          <div className="text-[9px] text-slate-400 mt-1">
            {project.progress_pct != null && project.progress_pct > 0 ? 'PM override' : `${done}/${tasks.length} tasks done`}
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase">Tasks</div>
          <div className="text-xl md:text-2xl font-bold">{tasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">{done} done</div>
        </div>
        {/* Only shown when a budget exists. With `budget` null these read
            "Budget used 0%" and "Remaining 0" — which is the arithmetic
            falling back to zero, not a measurement, and says "we have spent
            nothing" when the truth is "no budget has been set". */}
        {project.budget != null && (
          <>
            <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Budget used</div>
              <div className="text-xl md:text-2xl font-bold tabular-nums">{budgetUtil}%</div>
              <div className="text-xs text-slate-500 mt-1">
                {formatVND(project.spent)} / {formatVND(project.budget)}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Remaining</div>
              <div className="text-xl md:text-2xl font-bold tabular-nums">
                {formatVND(remaining)}
              </div>
              <div className="text-xs text-slate-500 mt-1">of {formatVND(project.budget)}</div>
            </div>
          </>
        )}
      </div>

      {/* Budget bar */}
      {project.budget != null && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Wallet size={14} /> Budget vs Actual</h3>
            <span className="text-xs text-slate-500">{formatVND(project.spent)} / {formatVND(project.budget)}</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500" style={{ width: `${Math.min(100, budgetUtil)}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
            <span>{budgetUtil}% used</span>
            <span>{100 - budgetUtil}% remaining</span>
          </div>
        </div>
      )}

      {/*
        Module bars live on the home page, where they can be compared across
        projects. What this page adds is the level below them: `tasks.module`
        says which of the six teams owns a row, `tasks.phase` says which
        department inside that team does — Engineering, Culinary, Housekeeping
        — and the department is the unit a PM actually chases. So this stays
        the readiness ledger, scoped to one project.
      */}
      <ReadinessSummary programme={programme} projectName={project.name} />

      <DepartmentLedger rows={departments} />

      {/* Tasks + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tasks */}
        <div className="bg-white rounded-xl p-4 shadow-sm lg:col-span-2 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Tasks ({tasks.length})</h3>
            <Link href="/tasks" className="text-xs text-blue-600 hover:underline">Open Kanban →</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No tasks yet.</p>
          ) : (
            <>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="font-medium pb-2">Task</th>
                    <th className="font-medium pb-2">Department</th>
                    <th className="font-medium pb-2">Owner</th>
                    <th className="font-medium pb-2">Due</th>
                    <th className="font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, TASK_ROW_LIMIT).map((t) => {
                    const d = daysFromNow(t.due_date);
                    const late = d < 0 && t.kanban_status !== 'Done';
                    return (
                      <tr key={t.id} className="border-t border-slate-100 align-top">
                        <td className="py-2 pr-3 font-medium max-w-[380px]">
                          <span className="line-clamp-2 break-words">{t.title}</span>
                          {t.constraint_note && (
                            <span className="text-amber-600 ml-1" title={t.constraint_note}>
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="text-slate-500 pr-3">{t.phase || '—'}</td>
                        <td className="text-slate-500 pr-3">{t.owner || '—'}</td>
                        <td
                          className={`pr-3 tabular-nums whitespace-nowrap ${
                            late ? 'text-red-600 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {t.due_date || '—'}
                          {late && <span className="block text-xs">quá hạn {Math.abs(d)}d</span>}
                        </td>
                        <td className="text-slate-600 whitespace-nowrap">{t.kanban_status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tasks.length > TASK_ROW_LIMIT && (
                <p className="text-sm text-slate-500 mt-3 pt-3 border-t border-slate-100">
                  Showing {TASK_ROW_LIMIT} of {tasks.length}.{' '}
                  <Link href="/tasks" className="text-blue-600 hover:underline">
                    Open the board to filter and search all {tasks.length} →
                  </Link>
                </p>
              )}
            </>
          )}
        </div>

        {/* Milestones — client list with add/edit/delete */}
        <MilestonesList projectId={project.id} milestones={milestones} />
      </div>

      {/* Documents — project-scoped drive */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><FileText size={14} /> Documents & Photos</h3>
          <Link href="/documents" className="text-xs text-blue-600 hover:underline">Open full drive →</Link>
        </div>
        <ProjectDocuments project={project} />
      </div>
    </div>
  );
}