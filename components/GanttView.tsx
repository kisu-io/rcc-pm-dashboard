'use client';
import { useState, useMemo } from 'react';
import { Task, Project } from '@/lib/supabase';
import {
  ScheduleTask, barColor, isExpress, isMilestone, parseDate, formatDateShort,
  formatDate, monthColumns, computeCriticalSet, uniquePhases, phaseColor,
  MILESTONE_COLOR, EXPRESS_COLOR, CRITICAL_COLOR, TODAY_COLOR,
} from '@/lib/schedule-utils';
import { Calendar, Search, Flag, Zap, AlertTriangle } from 'lucide-react';

export default function GanttView({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const [projFilter, setProjFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showMilestones, setShowMilestones] = useState(true);
  const [showExpress, setShowExpress] = useState(true);

  // Step 1: filter by project
  const projectFiltered = useMemo(() => {
    let arr = tasks.slice();
    if (projFilter !== 'all') arr = arr.filter((t) => t.project_id === projFilter);
    return arr.filter((t) => t.planned_start && t.planned_end);
  }, [tasks, projFilter]);

  const phases = useMemo(() => uniquePhases(projectFiltered), [projectFiltered]);

  // Step 2: filter by phase + search + critical
  const filtered = useMemo(() => {
    let arr = projectFiltered.slice();
    if (phaseFilter !== 'all') arr = arr.filter((t) => t.phase === phaseFilter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.owner || '').toLowerCase().includes(q) ||
        (t.zone || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [projectFiltered, phaseFilter, search]);

  // Critical path computed on the filtered set
  const criticalSet = useMemo(() => computeCriticalSet(filtered as ScheduleTask[]), [filtered]);
  const visibleTasks = useMemo(() => {
    if (!showCriticalOnly) return filtered;
    return filtered.filter((t) => criticalSet.has(t.id));
  }, [filtered, criticalSet, showCriticalOnly]);

  // Timeline range
  const range = useMemo(() => {
    const starts = visibleTasks.map((t) => parseDate(t.planned_start)).filter((v): v is number => v != null);
    const ends = visibleTasks.map((t) => parseDate(t.planned_end)).filter((v): v is number => v != null);
    if (starts.length === 0 || ends.length === 0) return null;
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    return { min, max, span: Math.max(max - min, 86400000) };
  }, [visibleTasks]);

  const months = useMemo(() => (range ? monthColumns(range.min, range.max) : []), [range]);

  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  // Stats
  const stats = useMemo(() => {
    if (!range) return null;
    const totalDays = Math.round((range.max - range.min) / 86400000) + 1;
    return {
      start: formatDate(new Date(range.min).toISOString().split('T')[0]),
      finish: formatDate(new Date(range.max).toISOString().split('T')[0]),
      totalDays,
      taskCount: visibleTasks.length,
      phaseCount: new Set(visibleTasks.map((t) => t.phase).filter(Boolean)).size,
      criticalCount: criticalSet.size,
      milestoneCount: visibleTasks.filter(isMilestone).length,
      expressCount: visibleTasks.filter(isExpress).length,
    };
  }, [range, visibleTasks, criticalSet]);

  if (projectFiltered.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-slate-400 shadow-sm">
        <Calendar size={36} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs">No tasks with planned dates. Set start/end on tasks to see Gantt.</p>
      </div>
    );
  }

  if (!range) {
    return <div className="bg-white rounded-xl p-8 text-center text-slate-400">No date range.</div>;
  }

  const today = Date.now();
  const todayPct = ((today - range.min) / range.span) * 100;
  const showTodayLine = today >= range.min && today <= range.max;

  // Group by phase preserving insertion order of phase appearance
  const phaseOrder: string[] = [];
  visibleTasks.forEach((t) => {
    const p = t.phase || '—';
    if (!phaseOrder.includes(p)) phaseOrder.push(p);
  });

  const selectCls = 'text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="space-y-3">
      {/* Toolbar: filters + search */}
      <div className="bg-white rounded-xl p-3 shadow-sm flex flex-wrap gap-2 items-center">
        <select value={projFilter} onChange={(e) => setProjFilter(e.target.value)} className={selectCls}>
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className={selectCls}>
          <option value="all">All phases</option>
          {phases.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="relative flex-1 min-w-[140px] max-w-[260px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task, owner, zone…"
            className="w-full text-xs bg-white border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <button
          onClick={() => setShowCriticalOnly((v) => !v)}
          className={`text-[10px] px-2 py-1.5 rounded-lg border ${showCriticalOnly ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}
          title="Toggle critical path only"
        >⚡ Critical only</button>
        <button
          onClick={() => setShowMilestones((v) => !v)}
          className={`text-[10px] px-2 py-1.5 rounded-lg border ${showMilestones ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-400'}`}
          title="Toggle milestone bars"
        >⭐ Milestones</button>
        <button
          onClick={() => setShowExpress((v) => !v)}
          className={`text-[10px] px-2 py-1.5 rounded-lg border ${showExpress ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-slate-200 text-slate-400'}`}
          title="Toggle EXPRESS / high-risk bars"
        >⚡ EXPRESS</button>
        <span className="text-[10px] text-slate-400 ml-auto">{visibleTasks.length} tasks</span>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="bg-white rounded-xl p-3 shadow-sm grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <Stat label="Start" value={stats.start} />
          <Stat label="Finish" value={stats.finish} />
          <Stat label="Duration" value={`${stats.totalDays}d`} />
          <Stat label="Tasks" value={String(stats.taskCount)} />
          <Stat label="Phases" value={String(stats.phaseCount)} />
          <Stat label="Critical" value={String(stats.criticalCount)} accent={CRITICAL_COLOR} />
          <Stat label="Milestones" value={String(stats.milestoneCount)} accent={MILESTONE_COLOR} />
        </div>
      )}

      {/* Gantt chart */}
      <div className="bg-white rounded-xl p-3 shadow-sm overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header: task | timeline */}
          <div className="grid grid-cols-[240px_1fr] gap-2 mb-2 border-b border-slate-100 pb-2 sticky top-0 bg-white z-10">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Task / Assignee</div>
            <div className="relative h-5">
              {/* Month columns */}
              <div className="absolute inset-0 flex">
                {months.map((m, i) => (
                  <div
                    key={m.key}
                    className="flex-1 text-[9px] text-slate-400 border-l border-slate-100 first:border-l-0 px-1"
                    style={{ minWidth: 0 }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {showTodayLine && (
                <div className="absolute top-0 bottom-0 w-px" style={{ left: `${todayPct}%`, background: TODAY_COLOR }} />
              )}
            </div>
          </div>

          {/* Rows grouped by phase */}
          <div className="space-y-0">
            {phaseOrder.map((phase) => {
              const phaseTasks = visibleTasks
                .filter((t) => (t.phase || '—') === phase)
                .sort((a, b) => (parseDate(a.planned_start) || 0) - (parseDate(b.planned_start) || 0));
              const color = phaseColor(phase);
              return (
                <div key={phase}>
                  {/* Phase header */}
                  <div className="flex items-center gap-2 py-1.5 px-1 bg-slate-50/70 rounded mt-2 first:mt-0">
                    <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
                    <span className="text-[11px] font-semibold text-slate-700">📌 {phase}</span>
                    <span className="text-[10px] text-slate-400">({phaseTasks.length})</span>
                  </div>
                  {/* Tasks in phase */}
                  {phaseTasks.map((t) => {
                    const start = parseDate(t.planned_start);
                    const end = parseDate(t.planned_end);
                    if (!start || !end) return null;
                    const left = ((start - range.min) / range.span) * 100;
                    const width = Math.max(((end - start) / range.span) * 100, 0.8);
                    const critical = criticalSet.has(t.id);
                    const ms = isMilestone(t);
                    const ex = isExpress(t);
                    const color = barColor(t, critical);
                    const days = Math.round((end - start) / 86400000) + 1;
                    // Hide milestones/express if toggled off
                    if (ms && !showMilestones) return null;
                    if (ex && !ms && !showExpress) return null;
                    return (
                      <div key={t.id} className="grid grid-cols-[240px_1fr] gap-2 items-center hover:bg-slate-50 rounded">
                        <div className="text-xs truncate px-1 py-0.5" title={`${t.title}\n${t.owner || '—'} · ${t.zone || '—'}\n${formatDate(t.planned_start)} → ${formatDate(t.planned_end)}\nProgress: ${t.progress_pct}%`}>
                          <div className="font-medium truncate flex items-center gap-1">
                            {ms && <Flag size={10} style={{ color: MILESTONE_COLOR }} />}
                            {ex && !ms && <Zap size={10} style={{ color: EXPRESS_COLOR }} />}
                            {critical && !ms && !ex && <AlertTriangle size={10} style={{ color: CRITICAL_COLOR }} />}
                            <span className="truncate">{t.title}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {t.owner || '—'} · {t.zone || '—'} · {projName(t.project_id)}
                          </div>
                        </div>
                        <div className="relative h-6 bg-slate-50 rounded">
                          {/* Month gridlines */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {months.map((m) => (
                              <div key={m.key} className="flex-1 border-l border-slate-100 first:border-l-0" />
                            ))}
                          </div>
                          {showTodayLine && (
                            <div className="absolute top-0 bottom-0 w-px opacity-50" style={{ left: `${todayPct}%`, background: TODAY_COLOR }} />
                          )}
                          {/* Bar */}
                          <div
                            className="absolute h-4 top-1 rounded shadow-sm flex items-center px-1.5 overflow-hidden group"
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              background: color + '30',
                              borderLeft: `3px solid ${color}`,
                            }}
                            title={`${t.title}\n${formatDate(t.planned_start)} → ${formatDate(t.planned_end)}\n${days}d · ${t.progress_pct}%\n${t.notes || ''}`}
                          >
                            <div className="text-[9px] font-medium truncate" style={{ color: color }}>
                              {days}d{t.progress_pct > 0 ? ` · ${t.progress_pct}%` : ''}
                            </div>
                            {/* Progress fill */}
                            {t.progress_pct > 0 && (
                              <div
                                className="absolute top-0 left-0 bottom-0 opacity-30"
                                style={{ width: `${t.progress_pct}%`, background: color }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl p-3 shadow-sm text-xs">
        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Legend</div>
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded" style={{ background: MILESTONE_COLOR }} /> Milestone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded" style={{ background: EXPRESS_COLOR }} /> EXPRESS / Rủi ro cao
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded" style={{ background: CRITICAL_COLOR }} /> Critical path
          </span>
          {phases.map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded" style={{ background: phaseColor(p) }} /> {p}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-px h-3" style={{ background: TODAY_COLOR }} /> Today
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-slate-400 uppercase font-semibold">{label}</span>
      <span className="font-semibold text-slate-800 truncate" style={{ color: accent }}>{value}</span>
    </div>
  );
}