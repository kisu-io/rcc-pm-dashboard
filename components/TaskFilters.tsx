'use client';
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Task, Project } from '@/lib/supabase';
import KanbanBoard from './KanbanBoard';
import GatesChecklist from './GatesChecklist';
import TaskEditModal from './TaskEditModal';
import { uniquePhases, uniqueOwners, uniqueZones, type ScheduleTask } from '@/lib/schedule-utils';
import { partitionByKind } from '@/lib/task-kind';

/**
 * Filters, and the choice of which board to show.
 *
 * The board used to render all 679 rows as one population: 602 draggable cards
 * in a single "To Do" column, most of them readiness gates with no date and no
 * owner. Splitting the two kinds means each gets the view that suits it — a
 * Kanban for work you schedule, a checklist for criteria you sign off.
 *
 * Two filters were removed rather than fixed. "EXPRESS" matched 0 of 679 rows
 * (it greps notes and titles for 'express' / 'fast-track' / 'compressed'), and
 * "Milestones" matched 17 rows purely by keyword accident — "…& Handover
 * Complete" is not a milestone. A control that cannot change the result, or
 * changes it wrongly, is worse than no control.
 */

type View = 'work' | 'gates';

export default function TaskFilters({
  initialTasks,
  projects,
  projMap,
}: {
  initialTasks: Task[];
  projects: Project[];
  projMap: Record<string, string>;
}) {
  const [view, setView] = useState<View>('work');
  const [projFilter, setProjFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [prioFilter, setPrioFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingGate, setEditingGate] = useState<Task | null>(null);

  const split = useMemo(() => partitionByKind(initialTasks), [initialTasks]);
  const pool = view === 'gates' ? split.gates : split.work;

  const phases = useMemo(() => uniquePhases(pool as ScheduleTask[]).sort(), [pool]);
  const owners = useMemo(() => uniqueOwners(pool as ScheduleTask[]).sort(), [pool]);
  const zones = useMemo(() => uniqueZones(pool as ScheduleTask[]).sort(), [pool]);

  /** Only offer a priority filter when priority actually varies. On this
   *  programme every one of 679 rows is "Medium", so three of the four options
   *  returned nothing. */
  const priorities = useMemo(
    () => Array.from(new Set(pool.map((t) => t.priority).filter(Boolean))).sort(),
    [pool],
  );
  const showPriority = priorities.length > 1;

  const filtered = useMemo(() => {
    let arr = pool.slice();
    if (projFilter !== 'all') arr = arr.filter((t) => t.project_id === projFilter);
    if (phaseFilter !== 'all') arr = arr.filter((t) => t.phase === phaseFilter);
    if (showPriority && prioFilter !== 'All') arr = arr.filter((t) => t.priority === prioFilter);
    if (ownerFilter !== 'all') arr = arr.filter((t) => t.owner === ownerFilter);
    if (zoneFilter !== 'all') arr = arr.filter((t) => t.zone === zoneFilter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          (t.owner || '').toLowerCase().includes(q) ||
          (t.zone || '').toLowerCase().includes(q) ||
          (t.phase || '').toLowerCase().includes(q),
      );
    }
    return arr;
  }, [pool, projFilter, phaseFilter, prioFilter, showPriority, ownerFilter, zoneFilter, search]);

  const selectCls =
    'text-sm bg-white border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

  function tab(v: View, label: string, count: number) {
    const active = view === v;
    return (
      <button
        type="button"
        onClick={() => setView(v)}
        aria-pressed={active}
        className={`px-3 py-2 text-sm font-medium rounded-lg border transition ${
          active
            ? 'bg-brand-blue text-white border-brand-blue'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        {label} <span className="tabular-nums opacity-80">({count})</span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tab('work', 'Work', split.work.length)}
        {tab('gates', 'Readiness gates', split.gates.length)}
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          {projects.length > 1 && (
            <select
              value={projFilter}
              onChange={(e) => setProjFilter(e.target.value)}
              className={selectCls}
              aria-label="Filter by project"
            >
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className={selectCls}
            aria-label="Filter by department"
          >
            <option value="all">All departments ({phases.length})</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {showPriority && (
            <select
              value={prioFilter}
              onChange={(e) => setPrioFilter(e.target.value)}
              className={selectCls}
              aria-label="Filter by priority"
            >
              <option value="All">All priorities</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {owners.length > 0 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className={selectCls}
              aria-label="Filter by owner"
            >
              <option value="all">All owners ({owners.length})</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className={selectCls}
            aria-label="Filter by section"
          >
            <option value="all">All sections ({zones.length})</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[160px] max-w-[280px]">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, owner, notes…"
              aria-label="Search tasks"
              className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <span className="text-sm text-slate-500 tabular-nums ml-auto">
            {filtered.length} / {pool.length}
          </span>
        </div>
      </div>

      {view === 'gates' ? (
        <GatesChecklist gates={filtered} onEdit={setEditingGate} />
      ) : (
        <KanbanBoard initialTasks={filtered} projMap={projMap} projects={projects} />
      )}

      {editingGate && (
        <TaskEditModal
          task={editingGate}
          projects={projects}
          onClose={() => setEditingGate(null)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
