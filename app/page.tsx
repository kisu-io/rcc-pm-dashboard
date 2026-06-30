import { getProjects, getTasks } from '@/lib/data';
import KpiCard from '@/components/KpiCard';
import StatusChart from '@/components/StatusChart';
import ProgressChart from '@/components/ProgressChart';
import {
  FolderKanban, Loader, PauseCircle, CheckCircle2, TrendingUp, AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Complete', 'Pending', 'Upcoming'];
const PRIO_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const STATUS_BADGE: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  'Complete': 'bg-green-100 text-green-700',
  'Not Started': 'bg-slate-100 text-slate-600',
};

function daysFromNow(d: string | null) {
  if (!d) return Infinity;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default async function Dashboard() {
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);

  const total = projects.length;
  const inProgress = projects.filter((p) => p.status === 'In Progress').length;
  const onHold = projects.filter((p) => p.status === 'On Hold').length;
  const complete = projects.filter((p) => p.status === 'Complete').length;
  const siteProgress = total
    ? Math.round(projects.reduce((s, p) => s + p.progress_pct, 0) / total)
    : 0;

  const statusData = STATUSES.map((status) => ({
    status,
    count: projects.filter((p) => p.status === status).length,
  }));

  // 6-week look-ahead (≤ 42 ngày tới), chưa Done
  const lookAhead = tasks
    .filter((t) => t.kanban_status !== 'Done' && daysFromNow(t.due_date) <= 42)
    .sort((a, b) => daysFromNow(a.due_date) - daysFromNow(b.due_date));

  const constraints = tasks.filter((t) => t.constraint_note);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">Dashboard</h1>
          <p className="text-xs md:text-sm text-slate-500 truncate">RCC Construction Project Management</p>
        </div>
      </div>

      {/* Constraint / Domain status banner */}
      {constraints.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4 flex items-start gap-2 md:gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div className="text-xs md:text-sm min-w-0">
            <span className="font-semibold text-amber-700">{constraints.length} ràng buộc đang chặn tiến độ: </span>
            <span className="break-words">{constraints.map((c) => `${c.title} — ${c.constraint_note}`).join(' · ')}</span>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
        <KpiCard label="Total Projects" value={total} icon={FolderKanban} accent="#2563eb" />
        <KpiCard label="In Progress" value={inProgress} icon={Loader} accent="#06b6d4" />
        <KpiCard label="On Hold" value={onHold} icon={PauseCircle} accent="#f59e0b" />
        <KpiCard label="Complete" value={complete} icon={CheckCircle2} accent="#22c55e" />
        <KpiCard label="Site Progress" value={`${siteProgress}%`} icon={TrendingUp} accent="#a855f7" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProgressChart />
        <StatusChart data={statusData} />
      </div>

      {/* Tables — stacked on mobile, side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Projects */}
        <div className="bg-white rounded-xl p-4 shadow-sm overflow-x-auto">
          <h3 className="font-semibold mb-3 text-sm">Recent Projects</h3>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-slate-400 text-xs">
                <th className="pb-2">Project</th><th>Location</th><th>Status</th><th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="text-slate-500">{p.location}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status] || 'bg-slate-100'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2563eb]" style={{ width: `${p.progress_pct}%` }} />
                      </div>
                      <span className="text-xs">{p.progress_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6-Week Look-ahead */}
        <div className="bg-white rounded-xl p-4 shadow-sm overflow-x-auto">
          <h3 className="font-semibold mb-3 text-sm">6-Week Look-ahead</h3>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-slate-400 text-xs">
                <th className="pb-2">Task</th><th>Owner</th><th>Priority</th><th>Due</th>
              </tr>
            </thead>
            <tbody>
              {lookAhead.map((t) => {
                const d = daysFromNow(t.due_date);
                return (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{t.title}</td>
                    <td className="text-slate-500">{t.owner}</td>
                    <td>
                      <span className="text-xs font-medium" style={{ color: PRIO_COLOR[t.priority] }}>
                        {t.priority}
                      </span>
                    </td>
                    <td className={`text-xs ${d < 0 ? 'text-red-600 font-semibold' : d <= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {t.due_date} {d < 0 ? '(quá hạn)' : d <= 7 ? `(${d}d)` : ''}
                    </td>
                  </tr>
                );
              })}
              {lookAhead.length === 0 && (
                <tr><td colSpan={4} className="py-3 text-slate-400 text-center text-xs">Không có task trong 6 tuần tới</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
