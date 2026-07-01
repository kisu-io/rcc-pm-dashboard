import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProject, getTasks, getMilestones, getDocuments } from '@/lib/data-server';
import { formatVND, daysFromNow, isOverdue } from '@/lib/data';
import EditProjectButton from '@/components/EditProjectButton';
import AddMilestoneButton from '@/components/AddMilestoneButton';
import ProjectDocuments from '@/components/ProjectDocuments';
import EditGuard from '@/components/EditGuard';
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

const PHASES = ['Design', 'Permit', 'Construction', 'Fit-out', 'Inspection', 'Handover'];
const PRIO_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const MS_STATUS_COLOR: Record<string, string> = {
  'Reached': '#22c55e',
  'Pending': '#f59e0b',
  'Missed': '#ef4444',
};

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

  // Phase breakdown
  const phaseStats = PHASES.map((phase) => {
    const phaseTasks = tasks.filter((t) => t.phase === phase);
    if (phaseTasks.length === 0) return null;
    const avg = phaseTasks.reduce((s, t) => s + t.progress_pct, 0) / phaseTasks.length;
    return { phase, avg: Math.round(avg), count: phaseTasks.length };
  }).filter(Boolean) as { phase: string; avg: number; count: number }[];

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
          <div className="text-xl md:text-2xl font-bold">{project.progress_pct}%</div>
          <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#2563eb]" style={{ width: `${project.progress_pct}%` }} />
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

      {/* Phase breakdown */}
      {phaseStats.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">Phase breakdown</h3>
          <div className="space-y-2">
            {phaseStats.map((p) => (
              <div key={p.phase}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{p.phase}</span>
                  <span className="text-slate-500">{p.avg}% · {p.count} tasks</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2563eb]" style={{ width: `${p.avg}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

        {/* Milestones */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Milestones</h3>
            <EditGuard><AddMilestoneButton projectId={project.id} /></EditGuard>
          </div>
          {milestones.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No milestones.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {m.status === 'Reached' ? <CheckCircle2 size={16} className="text-green-500" />
                      : m.status === 'Missed' ? <AlertTriangle size={16} className="text-red-500" />
                      : <Clock size={16} className="text-amber-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{m.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {m.due_date || '—'} · <span style={{ color: MS_STATUS_COLOR[m.status] || '#94a3b8' }}>{m.status}</span>
                      {m.type && <span> · {m.type}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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