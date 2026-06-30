'use client';
import { useState, useMemo } from 'react';
import { Task, Project } from '@/lib/supabase';
import { AlertTriangle, ArrowRight, Clock, Calendar } from 'lucide-react';

const PHASES = ['Design', 'Permit', 'Construction', 'Fit-out', 'Inspection', 'Handover'];

const PHASE_COLORS: Record<string, string> = {
  'Design': '#06b6d4',
  'Permit': '#a855f7',
  'Construction': '#2563eb',
  'Fit-out': '#f59e0b',
  'Inspection': '#ec4899',
  'Handover': '#22c55e',
};

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86400000);
}

function parseDate(s: string | null): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return isNaN(t) ? null : t;
}

export default function GanttView({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const [projFilter, setProjFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let arr = tasks.slice();
    if (projFilter !== 'all') arr = arr.filter((t) => t.project_id === projFilter);
    return arr.filter((t) => t.planned_start && t.planned_end);
  }, [tasks, projFilter]);

  // Timeline range
  const range = useMemo(() => {
    const starts = filtered.map((t) => parseDate(t.planned_start)).filter((v): v is number => v != null);
    const ends = filtered.map((t) => parseDate(t.planned_end)).filter((v): v is number => v != null);
    if (starts.length === 0 || ends.length === 0) return null;
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    return { min, max, span: max - min };
  }, [filtered]);

  // Critical path: longest chain through dependencies
  const criticalPath = useMemo(() => {
    const set = new Set<string>();
    // Simple heuristic: tasks with no slack (earliest start = max of predecessors' end)
    // For now: find tasks with depends_on and mark them + predecessors
    const byId = new Map(filtered.map((t) => [t.id, t]));
    function visit(t: Task) {
      if (set.has(t.id)) return;
      set.add(t.id);
      (t.depends_on || []).forEach((dep) => {
        const p = byId.get(dep);
        if (p) visit(p);
      });
    }
    filtered.forEach(visit);
    return set;
  }, [filtered]);

  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  if (filtered.length === 0) {
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

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={projFilter}
          onChange={(e) => setProjFilter(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5"
        >
          <option value="all">All projects ({filtered.length} tasks)</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="text-[10px] text-slate-400 flex flex-wrap gap-2 ml-auto">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} /> Critical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#2563eb' }} /> Normal</span>
          <span className="flex items-center gap-1"><span className="w-px h-3 bg-slate-400" /> Today</span>
        </div>
      </div>

      {/* Gantt chart */}
      <div className="bg-white rounded-xl p-3 shadow-sm overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header: timeline */}
          <div className="grid grid-cols-[200px_1fr] gap-2 mb-2 border-b border-slate-100 pb-2">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Task</div>
            <div className="relative h-5">
              {/* Month markers */}
              {Array.from({ length: 5 }).map((_, i) => {
                const t = range.min + (range.span * i) / 4;
                const d = new Date(t);
                return (
                  <div key={i} className="absolute text-[9px] text-slate-400" style={{ left: `${(i / 4) * 100}%`, transform: 'translateX(-50%)' }}>
                    {d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </div>
                );
              })}
              {today >= range.min && today <= range.max && (
                <div className="absolute top-0 bottom-0 w-px bg-slate-400" style={{ left: `${todayPct}%` }} />
              )}
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-1">
            {filtered
              .sort((a, b) => (parseDate(a.planned_start) || 0) - (parseDate(b.planned_start) || 0))
              .map((t) => {
                const start = parseDate(t.planned_start);
                const end = parseDate(t.planned_end);
                if (!start || !end) return null;
                const left = ((start - range.min) / range.span) * 100;
                const width = Math.max(((end - start) / range.span) * 100, 1);
                const isCritical = criticalPath.has(t.id);
                const color = isCritical ? '#ef4444' : (PHASE_COLORS[t.phase || ''] || '#2563eb');
                return (
                  <div key={t.id} className="grid grid-cols-[200px_1fr] gap-2 items-center hover:bg-slate-50 rounded">
                    <div className="text-xs truncate px-1" title={t.title}>
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-[9px] text-slate-400 truncate">{projName(t.project_id)}</div>
                    </div>
                    <div className="relative h-6 bg-slate-50 rounded">
                      {today >= range.min && today <= range.max && (
                        <div className="absolute top-0 bottom-0 w-px bg-slate-400 opacity-50" style={{ left: `${todayPct}%` }} />
                      )}
                      <div
                        className="absolute h-4 top-1 rounded shadow-sm flex items-center px-1.5 overflow-hidden group"
                        style={{ left: `${left}%`, width: `${width}%`, background: color + '30', borderLeft: `3px solid ${color}` }}
                        title={`${t.title}\n${t.planned_start} → ${t.planned_end}\nProgress: ${t.progress_pct}%`}
                      >
                        <div className="text-[9px] font-medium truncate text-slate-700" style={{ color: isCritical ? '#ef4444' : undefined }}>
                          {t.progress_pct > 0 && `${t.progress_pct}%`}
                        </div>
                        {/* Progress fill */}
                        {t.progress_pct > 0 && (
                          <div
                            className="absolute top-0 left-0 bottom-0 opacity-30"
                            style={{ width: `${t.progress_pct}%`, background: color }}
                          />
                        )}
                        {/* Dependency arrow */}
                        {(t.depends_on || []).length > 0 && (
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 text-slate-400" title={`Depends on ${t.depends_on!.length} task(s)`}>
                            <ArrowRight size={10} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl p-3 shadow-sm text-xs">
        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Phases</div>
        <div className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded" style={{ background: PHASE_COLORS[p] }} /> {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}