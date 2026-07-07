import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProject, getTasks, getMilestones, getDocuments } from '@/lib/data-server';
import { formatVND, daysFromNow, isOverdue } from '@/lib/data';
import { phaseBreakdown, PHASE_ORDER, PHASE_COLORS, PHASE_LABELS_VN, effectiveProgress } from '@/lib/phase';
import EditProjectButton from '@/components/EditProjectButton';
import EditGuard from '@/components/EditGuard';
import MilestonesList from '@/components/MilestonesList';
import ProjectDocuments from '@/components/ProjectDocuments';
import { ArrowLeft, MapPin, Calendar, Wallet, User, FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  'Complete': 'bg-green-100 text-green-700',
  'Not Started': 'bg-slate-100 text-slate-600',
  'Pending': 'bg-purple-100 text-purple-700',
  'Upcoming': 'bg-cyan-100 text-cyan-700',
};

const PRIO_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

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

  // Phase breakdown (7-field summary: Budget + 5 phases + Overall %)
  const phases = phaseBreakdown(project, tasks);
  const budgetPct = project.budget ? Math.round((project.spent / project.budget) * 100) : 0;
  const overBudget = project.budget != null && project.spent > project.budget;
  const healthColor = overBudget ? '#ef4444' : budgetPct > 80 ? '#f59e0b' : '#22c55e';
  const effPct = effectiveProgress(project, tasks);

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
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[project.status] || 'bg-slate-100'}`}>
            {project.status}
          </span>
          <EditGuard><EditProjectButton project={project} /></EditGuard>
        </div>
      </div>

      {/* Alerts */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-red-700">
            <span className="font-semibold">{overdue.length} task quá hạn: </span>
            {overdue.map((t) => t.title).join(' · ')}
          </div>
        </div>
      )}
      {constraints.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">{constraints.length} ràng buộc: </span>
            {constraints.map((t) => `${t.title} — ${t.constraint_note}`).join(' · ')}
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
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase">Budget used</div>
          <div className="text-xl md:text-2xl font-bold">{budgetUtil}%</div>
          <div className="text-[10px] text-slate-500 mt-1">{formatVND(project.spent)} / {formatVND(project.budget)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase">Remaining</div>
          <div className="text-xl md:text-2xl font-bold">{formatVND(remaining)}</div>
          <div className="text-[10px] text-slate-500 mt-1">of {formatVND(project.budget)}</div>
        </div>
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

      {/* 7-field Project Summary: Budget | 5 phases | Overall % */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-3">Project Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* 1. Budget */}
          <div>
            <div className="text-[9px] text-slate-400 uppercase">Ngân sách</div>
            <div className="text-[11px] mt-0.5" style={{ color: healthColor }}>
              {formatVND(project.spent)} / {formatVND(project.budget)}
            </div>
            <div className="text-[9px] text-slate-400">{budgetPct}% used</div>
          </div>
          {/* 2–6. Phase buckets */}
          {PHASE_ORDER.map((b) => (
            <div key={b}>
              <div className="text-[9px] text-slate-400 uppercase">{PHASE_LABELS_VN[b]}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${phases[b]}%`, background: PHASE_COLORS[b] }} />
                </div>
                <span className="text-[10px] font-medium">{phases[b]}%</span>
              </div>
            </div>
          ))}
          {/* 7. Overall progress */}
          <div>
            <div className="text-[9px] text-slate-400 uppercase">Tiến độ tổng</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#22c55e]" style={{ width: `${effPct}%` }} />
              </div>
              <span className="text-[10px] font-medium">{effPct}%</span>
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">
              {project.progress_pct != null && project.progress_pct > 0 ? 'PM override' : `Auto: ${done}/${tasks.length} tasks`}
            </div>
          </div>
        </div>
      </div>

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
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="text-left text-slate-400 text-[10px]">
                  <th className="pb-2">Task</th><th>Phase</th><th>Owner</th><th>Prio</th><th>Due</th><th>%</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const d = daysFromNow(t.due_date);
                  return (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="py-2 font-medium">{t.title}{t.constraint_note && <span className="text-amber-600 ml-1">⚠</span>}</td>
                      <td className="text-slate-500">{t.phase || '—'}</td>
                      <td className="text-slate-500">{t.owner || '—'}</td>
                      <td><span className="font-medium" style={{ color: PRIO_COLOR[t.priority] }}>{t.priority}</span></td>
                      <td className={d < 0 && t.kanban_status !== 'Done' ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                        {t.due_date || '—'}{d < 0 && t.kanban_status !== 'Done' ? ' (quá hạn)' : ''}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#2563eb]" style={{ width: `${t.progress_pct}%` }} />
                          </div>
                          <span>{t.progress_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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