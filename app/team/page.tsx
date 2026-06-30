import { getProjects, getTasks } from '@/lib/data';
import { Users, Mail, Phone, Briefcase } from 'lucide-react';

export const dynamic = 'force-dynamic';

const AVATAR_COLORS = ['#2563eb', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#ef4444'];

export default async function TeamPage() {
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);

  // Build members from task owners + PMs
  const members = new Map<string, { name: string; role: string; taskCount: number; openTasks: number; overdue: number; projects: Set<string> }>();
  for (const t of tasks) {
    if (!t.owner) continue;
    const m = members.get(t.owner) || { name: t.owner, role: 'Crew', taskCount: 0, openTasks: 0, overdue: 0, projects: new Set<string>() };
    m.taskCount++;
    if (t.kanban_status !== 'Done') m.openTasks++;
    if (t.due_date && t.kanban_status !== 'Done' && new Date(t.due_date) < new Date()) m.overdue++;
    if (t.project_id) m.projects.add(t.project_id);
    members.set(t.owner, m);
  }
  // PMs
  for (const p of projects) {
    if (!p.pm) continue;
    const m = members.get(p.pm) || { name: p.pm, role: 'PM', taskCount: 0, openTasks: 0, overdue: 0, projects: new Set<string>() };
    m.role = 'PM';
    if (p.id) m.projects.add(p.id);
    members.set(p.pm, m);
  }

  const list = Array.from(members.values()).sort((a, b) => b.openTasks - a.openTasks);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Team</h1>
        <p className="text-xs md:text-sm text-slate-500">{list.length} members · workload overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {list.map((m, i) => {
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div key={m.name} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: color }}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{m.name}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Briefcase size={10} /> {m.role}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
                <div>
                  <div className="text-base font-bold">{m.taskCount}</div>
                  <div className="text-[9px] text-slate-400 uppercase">Tasks</div>
                </div>
                <div>
                  <div className="text-base font-bold text-blue-600">{m.openTasks}</div>
                  <div className="text-[9px] text-slate-400 uppercase">Open</div>
                </div>
                <div>
                  <div className={`text-base font-bold ${m.overdue > 0 ? 'text-red-600' : ''}`}>{m.overdue}</div>
                  <div className="text-[9px] text-slate-400 uppercase">Overdue</div>
                </div>
              </div>

              {m.projects.size > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400 mb-1">Projects ({m.projects.size})</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(m.projects).slice(0, 4).map((id) => (
                      <span key={id} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[100px]" title={projName(id)}>
                        {projName(id)}
                      </span>
                    ))}
                    {m.projects.size > 4 && <span className="text-[10px] text-slate-400 self-center">+{m.projects.size - 4}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="bg-white rounded-xl p-10 text-center text-slate-400 shadow-sm">
          <Users size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No team members yet.</p>
        </div>
      )}
    </div>
  );
}