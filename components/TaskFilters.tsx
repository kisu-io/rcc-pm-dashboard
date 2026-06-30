'use client';
import { useState, useMemo } from 'react';
import { Task, Project } from '@/lib/supabase';
import KanbanBoard from './KanbanBoard';

const PRIORITIES = ['All', 'High', 'Medium', 'Low'];

export default function TaskFilters({
  initialTasks, projects, projMap,
}: {
  initialTasks: Task[];
  projects: Project[];
  projMap: Record<string, string>;
}) {
  const [projFilter, setProjFilter] = useState('all');
  const [prioFilter, setPrioFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('all');

  const owners = useMemo(() => Array.from(new Set(initialTasks.map((t) => t.owner).filter(Boolean))) as string[], [initialTasks]);

  const filtered = useMemo(() => {
    let arr = initialTasks.slice();
    if (projFilter !== 'all') arr = arr.filter((t) => t.project_id === projFilter);
    if (prioFilter !== 'All') arr = arr.filter((t) => t.priority === prioFilter);
    if (ownerFilter !== 'all') arr = arr.filter((t) => t.owner === ownerFilter);
    return arr;
  }, [initialTasks, projFilter, prioFilter, ownerFilter]);

  const selectCls = 'text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-3 shadow-sm flex flex-wrap gap-2 items-center">
        <select value={projFilter} onChange={(e) => setProjFilter(e.target.value)} className={selectCls}>
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)} className={selectCls}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p === 'All' ? 'All priorities' : p}</option>)}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={selectCls}>
          <option value="all">All owners</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} tasks</span>
      </div>
      <KanbanBoard initialTasks={filtered} projMap={projMap} projects={projects} />
    </div>
  );
}