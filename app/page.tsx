import { getProjects, getTasks, getMilestones, getCostEntries, getMaterials, getDocuments } from '@/lib/data-server';
import { formatVND, daysFromNow, isOverdue } from '@/lib/data';
import { phaseBreakdown, PHASE_ORDER, PHASE_COLORS, PHASE_LABELS_VN } from '@/lib/phase';
import KpiCard from '@/components/KpiCard';
import StatusChart from '@/components/StatusChart';
import ProgressChart from '@/components/ProgressChart';
import Link from 'next/link';
import {
  FolderKanban, Loader, PauseCircle, CheckCircle2, TrendingUp, AlertTriangle,
  Wallet, TrendingDown, Clock, Calendar, ShieldCheck, FileText, Users,
  HardHat, Bell, ChevronRight, MapPin, CircleCheck, CircleAlert, Timer,
} from 'lucide-react';

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

function daysFromNowFn(d: string | null) {
  if (!d) return Infinity;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default async function Dashboard() {
  const [projects, tasks, milestones, costEntries, materials, documents] = await Promise.all([
    getProjects(), getTasks(), getMilestones(), getCostEntries(), getMaterials(), getDocuments(),
  ]);

  // ===== Portfolio Overview =====
  const total = projects.length;
  const active = projects.filter((p) => p.status === 'In Progress').length;
  const onHold = projects.filter((p) => p.status === 'On Hold').length;
  const complete = projects.filter((p) => p.status === 'Complete').length;
  const notStarted = projects.filter((p) => p.status === 'Not Started').length;

  // Status health: on track / at risk / delayed
  const onTrack = projects.filter((p) => {
    if (p.status === 'Complete' || p.status === 'Not Started') return false;
    const budgetPct = p.budget ? (p.spent / p.budget) * 100 : 0;
    return p.progress_pct >= 30 && budgetPct < 80;
  }).length;
  const atRisk = projects.filter((p) => {
    if (p.status === 'Complete' || p.status === 'Not Started') return false;
    const budgetPct = p.budget ? (p.spent / p.budget) * 100 : 0;
    return budgetPct > 80 || (p.progress_pct < 30 && p.status === 'In Progress');
  }).length;
  const delayed = projects.filter((p) => {
    if (p.status === 'Complete') return false;
    return p.target_end && daysFromNowFn(p.target_end) < 0;
  }).length;

  // Financial
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const utilPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  // Schedule health
  const avgProgress = total ? Math.round(projects.reduce((s, p) => s + p.progress_pct, 0) / total) : 0;
  const overdueTasks = tasks.filter(isOverdue);
  const onTimeProjects = projects.filter((p) => {
    if (!p.target_end) return true;
    return daysFromNowFn(p.target_end) >= 0;
  });
  const scheduleHealthPct = total ? Math.round((onTimeProjects.length / total) * 100) : 100;

  // Upcoming milestones (next 30 days)
  const upcomingMilestones = milestones
    .filter((m) => m.status === 'Pending' && m.due_date && daysFromNowFn(m.due_date) <= 30 && daysFromNowFn(m.due_date) >= -7)
    .sort((a, b) => daysFromNowFn(a.due_date) - daysFromNowFn(b.due_date));

  // Look-ahead (2 weeks)
  const lookAhead = tasks
    .filter((t) => t.kanban_status !== 'Done' && t.due_date && daysFromNowFn(t.due_date) <= 14)
    .sort((a, b) => daysFromNowFn(a.due_date) - daysFromNowFn(b.due_date));

  // Constraints / blockers
  const constraints = tasks.filter((t) => t.constraint_note);

  // Materials delayed
  const delayedMaterials = materials.filter((m) => {
    if (!m.expected_delivery || m.actual_delivery || m.status === 'Delivered') return false;
    return new Date(m.expected_delivery) < new Date() && m.status !== 'Delivered';
  });

  // Recent documents
  const recentDocs = documents.slice(0, 5);

  // Team allocation
  const teamMap = new Map<string, { name: string; openTasks: number; overdue: number; projects: Set<string> }>();
  for (const t of tasks) {
    if (!t.owner) continue;
    const m = teamMap.get(t.owner) || { name: t.owner, openTasks: 0, overdue: 0, projects: new Set() };
    if (t.kanban_status !== 'Done') m.openTasks++;
    if (isOverdue(t)) m.overdue++;
    m.projects.add(t.project_id);
    teamMap.set(t.owner, m);
  }
  const team = Array.from(teamMap.values()).sort((a, b) => b.openTasks - a.openTasks).slice(0, 6);

  // Recent cost entries
  const recentCosts = costEntries.slice(0, 5);
  const totalCostThisPeriod = recentCosts.reduce((s, e) => s + e.amount, 0);

  // Project name lookup
  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  const statusData = ['Not Started', 'In Progress', 'On Hold', 'Complete', 'Pending', 'Upcoming'].map((status) => ({
    status,
    count: projects.filter((p) => p.status === status).length,
    projects: projects.filter((p) => p.status === status).map((p) => p.name),
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">Dashboard</h1>
          <p className="text-xs md:text-sm text-slate-500 truncate">RCC Construction · Portfolio Overview</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500">
          <span className="hidden md:inline">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      </div>

      {/* ===== ALERTS BANNER ===== */}
      {(constraints.length > 0 || delayedMaterials.length > 0 || overdueTasks.length > 0) && (
        <div className="space-y-2">
          {overdueTasks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-red-700">
                <span className="font-semibold">{overdueTasks.length} task quá hạn: </span>
                {overdueTasks.slice(0, 3).map((t) => t.title).join(' · ')}
                {overdueTasks.length > 3 && ` +${overdueTasks.length - 3} nữa`}
              </div>
            </div>
          )}
          {constraints.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-amber-700">
                <span className="font-semibold">{constraints.length} ràng buộc: </span>
                {constraints.slice(0, 2).map((c) => `${c.title} — ${c.constraint_note}`).join(' · ')}
                {constraints.length > 2 && ` +${constraints.length - 2} nữa`}
              </div>
            </div>
          )}
          {delayedMaterials.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-orange-700">
                <span className="font-semibold">{delayedMaterials.length} vật tư trễ giao: </span>
                {delayedMaterials.map((m) => m.name).join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== PORTFOLIO KPI ROW ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
        <KpiCard label="Active Projects" value={active} icon={FolderKanban} accent="#2563eb" />
        <KpiCard label="On Track" value={onTrack} icon={CircleCheck} accent="#22c55e" />
        <KpiCard label="At Risk" value={atRisk} icon={AlertTriangle} accent="#f59e0b" />
        <KpiCard label="Delayed" value={delayed} icon={Clock} accent="#ef4444" />
        <KpiCard label="Avg Progress" value={`${avgProgress}%`} icon={TrendingUp} accent="#a855f7" />
        <KpiCard label="Schedule Health" value={`${scheduleHealthPct}%`} icon={Timer} accent="#06b6d4" />
      </div>

      {/* ===== FINANCIAL KPI ROW ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <KpiCard label="Total Contract Value" value={formatVND(totalBudget)} icon={Wallet} accent="#2563eb" />
        <KpiCard label="Spent to Date" value={formatVND(totalSpent)} icon={TrendingDown} accent="#f59e0b" />
        <KpiCard label="Remaining" value={formatVND(totalRemaining)} icon={TrendingUp} accent="#22c55e" />
        <KpiCard label="Utilization" value={`${utilPct}%`} icon={Wallet} accent={utilPct > 80 ? '#ef4444' : '#06b6d4'} />
      </div>

      {/* ===== CHARTS ROW ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProgressChart projects={projects} tasks={tasks} />
        <StatusChart data={statusData} />
      </div>

      {/* ===== PROJECT CARDS + SCHEDULE ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Per-project summary cards */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><HardHat size={16} /> Project Summary</h3>
            <Link href="/projects" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {projects.map((p) => {
              const budgetPct = p.budget ? Math.round((p.spent / p.budget) * 100) : 0;
              const overBudget = p.budget != null && p.spent > p.budget;
              const daysLeft = p.target_end ? daysFromNowFn(p.target_end) : Infinity;
              const projectTasks = tasks.filter((t) => t.project_id === p.id);
              const projOverdue = projectTasks.filter(isOverdue).length;
              const projOpen = projectTasks.filter((t) => t.kanban_status !== 'Done').length;
              const healthColor = overBudget ? '#ef4444' : budgetPct > 80 ? '#f59e0b' : '#22c55e';
              const scheduleStatus = p.status === 'Complete' ? 'complete' : daysLeft < 0 ? 'delayed' : daysLeft <= 14 ? 'at risk' : 'on track';
              const scheduleColor = scheduleStatus === 'complete' ? 'text-green-600' : scheduleStatus === 'delayed' ? 'text-red-600' : scheduleStatus === 'at risk' ? 'text-amber-600' : 'text-slate-500';
              const phases = phaseBreakdown(p, projectTasks);

              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="block border border-slate-100 rounded-lg p-3 hover:border-blue-200 hover:bg-blue-50/30 transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin size={10} /> {p.location || '—'} · PM: {p.pm || '—'}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[p.status] || 'bg-slate-100'}`}>
                      {p.status}
                    </span>
                  </div>

                  {/* 7-field summary grid: Budget | 5 phases | Overall % */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {/* 1. Budget */}
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Ngân sách</div>
                      <div className="text-[10px] mt-0.5" style={{ color: healthColor }}>
                        {formatVND(p.spent)} / {formatVND(p.budget)}
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
                    {/* 7. Overall progress + schedule summary */}
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Tiến độ tổng</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#22c55e]" style={{ width: `${p.progress_pct}%` }} />
                        </div>
                        <span className="text-[10px] font-medium">{p.progress_pct}%</span>
                      </div>
                      <div className={`text-[9px] mt-0.5 ${scheduleColor}`}>
                        {p.status === 'Complete' ? 'Done' : daysLeft === Infinity ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`} · {projOpen} open · {projOverdue} overdue
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Schedule & Milestones */}
        <div className="space-y-4">
          {/* Upcoming milestones */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Calendar size={16} /> Upcoming Milestones</h3>
            {upcomingMilestones.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No milestones in next 30 days</p>
            ) : (
              <div className="space-y-2">
                {upcomingMilestones.slice(0, 6).map((m) => {
                  const d = daysFromNowFn(m.due_date);
                  const color = d < 0 ? 'text-red-600' : d <= 7 ? 'text-amber-600' : 'text-slate-500';
                  return (
                    <div key={m.id} className="flex items-start gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${d < 0 ? 'bg-red-500' : d <= 7 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{projName(m.project_id)} · {m.type || '—'}</div>
                        <div className={`text-[10px] ${color}`}>{m.due_date} · {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2-Week Look-ahead */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock size={16} /> 2-Week Look-ahead</h3>
            {lookAhead.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No tasks due in 2 weeks</p>
            ) : (
              <div className="space-y-2">
                {lookAhead.slice(0, 6).map((t) => {
                  const d = daysFromNowFn(t.due_date);
                  return (
                    <div key={t.id} className="flex items-start gap-2 text-xs">
                      <span className="text-[10px] font-medium" style={{ color: PRIO_COLOR[t.priority] || '#94a3b8' }}>●</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-[10px] text-slate-400">{projName(t.project_id)} · {t.owner || '—'}</div>
                        <div className={`text-[10px] ${d < 0 ? 'text-red-600 font-medium' : d <= 7 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {t.due_date} {d < 0 ? `(quá hạn ${Math.abs(d)}d)` : `(${d}d)`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== FINANCIAL + TEAM ROW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent cost entries */}
        <div className="bg-white rounded-xl p-4 shadow-sm overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Wallet size={16} /> Recent Cost Entries</h3>
            <Link href="/budget" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Full budget <ChevronRight size={12} />
            </Link>
          </div>
          {recentCosts.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No cost entries yet</p>
          ) : (
            <table className="w-full text-xs min-w-[400px]">
              <thead>
                <tr className="text-left text-slate-400 text-[10px]">
                  <th className="pb-2">Date</th><th>Project</th><th>Description</th><th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentCosts.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-500 whitespace-nowrap">{e.date}</td>
                    <td className="text-slate-600 truncate max-w-[120px]">{projName(e.project_id)}</td>
                    <td className="truncate max-w-[150px]">{e.description}</td>
                    <td className="text-right font-medium whitespace-nowrap">{formatVND(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              {recentCosts.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={3} className="py-2 text-[10px] text-slate-400 font-medium uppercase">Recent total</td>
                    <td className="py-2 text-right font-bold text-sm">{formatVND(totalCostThisPeriod)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Team allocation */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Users size={16} /> Team & Resources</h3>
            <Link href="/team" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View team <ChevronRight size={12} />
            </Link>
          </div>
          {team.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No team data</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 text-[10px]">
                  <th className="pb-2">Member</th><th>Open</th><th>Overdue</th><th>Projects</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.name} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{m.name}</td>
                    <td className="text-slate-600">{m.openTasks}</td>
                    <td className={m.overdue > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>{m.overdue}</td>
                    <td className="text-slate-500">{m.projects.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ===== SAFETY + DOCS ROW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Safety & compliance */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ShieldCheck size={16} /> Safety & Compliance</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Days since incident</span>
              <span className="font-bold text-green-600">—</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Open inspections</span>
              <span className="font-medium">{milestones.filter((m) => m.type === 'Inspection' && m.status === 'Pending').length}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Permit expiry (30d)</span>
              <span className="font-medium">{milestones.filter((m) => m.type === 'Permit' && m.status === 'Pending' && m.due_date && daysFromNowFn(m.due_date) <= 30).length}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-500">PCCC pending</span>
              <span className="font-medium">{tasks.filter((t) => t.title.toLowerCase().includes('pccc') && t.kanban_status !== 'Done').length}</span>
            </div>
          </div>
        </div>

        {/* Recent documents */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><FileText size={16} /> Recent Documents</h3>
            <Link href="/documents" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              All docs <ChevronRight size={12} />
            </Link>
          </div>
          {recentDocs.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No documents yet</p>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((d) => (
                <div key={d.id} className="flex items-start gap-2 text-xs">
                  <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-[10px] text-slate-400">{projName(d.project_id)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Materials status */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Bell size={16} /> Materials Status</h3>
            <Link href="/materials" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-600">{materials.filter((m) => m.status === 'Pending').length}</div>
              <div className="text-[9px] text-slate-500 uppercase">Pending</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">{materials.filter((m) => m.status === 'Ordered').length}</div>
              <div className="text-[9px] text-slate-500 uppercase">Ordered</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-600">{materials.filter((m) => m.status === 'Delivered').length}</div>
              <div className="text-[9px] text-slate-500 uppercase">Delivered</div>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-600">{delayedMaterials.length}</div>
              <div className="text-[9px] text-slate-500 uppercase">Delayed</div>
            </div>
          </div>
          {delayedMaterials.length > 0 && (
            <div className="text-[10px] text-red-600">
              {delayedMaterials.slice(0, 2).map((m) => `• ${m.name}`).join('\n')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}