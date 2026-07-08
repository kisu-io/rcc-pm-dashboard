'use client';
import { useState, useMemo } from 'react';
import { Task, Project } from '@/lib/supabase';
import KanbanBoard from './KanbanBoard';
import { uniquePhases, uniqueOwners, uniqueZones, isMilestone, isExpress } from '@/lib/schedule-utils';
import { Search, Flag, Zap } from 'lucide-react';

const PRIORITIES = ['All', 'High', 'Medium', 'Low'];

export default function TaskFilters({
  initialTasks, projects, projMap,
}: {
  initialTasks: Task[];
  projects: Project[];
  projMap: Record<string, string>;
}) {
  const [projFilter, setProjFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [prioFilter, setPrioFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyMilestones, setOnlyMilestones] = useState(false);
  const [onlyExpress, setOnlyExpress] = useState(false);

  const phases = useMemo(() => uniquePhases(initialTasks as any), [initialTasks]);
  const owners = useMemo(() => uniqueOwners(initialTasks as any), [initialTasks]);
  const zones = useMemo(() => uniqueZones(initialTasks as any), [initialTasks]);

  const filtered = useMemo(() => {
    let arr = initialTasks.slice();
    if (projFilter !== 'all') arr = arr.filter((t) => t.project_id === projFilter);
    if (phaseFilter !== 'all') arr = arr.filter((t) => t.phase === phaseFilter);
    if (prioFilter !== 'All') arr = arr.filter((t) => t.priority === prioFilter);
    if (ownerFilter !== 'all') arr = arr.filter((t) => t.owner === ownerFilter);
    if (zoneFilter !== 'all') arr = arr.filter((t) => t.zone === zoneFilter);
    if (onlyMilestones) arr = arr.filter((t) => isMilestone(t as any));
    if (onlyExpress) arr = arr.filter((t) => isExpress(t as any) && !isMilestone(t as any));
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.owner || '').toLowerCase().includes(q) ||
        (t.zone || '').toLowerCase().includes(q) ||
        (t.phase || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [initialTasks, projFilter, phaseFilter, prioFilter, ownerFilter, zoneFilter, search, onlyMilestones, onlyExpress]);

  const selectCls = 'text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

  const msCount = initialTasks.filter((t) => isMilestone(t as any)).length;
  const exCount = initialTasks.filter((t) => isExpress(t as any) && !isMilestone(t as any)).length;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-3 shadow-sm space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={projFilter} onChange={(e) => setProjFilter(e.target.value)} className={selectCls}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className={selectCls}>
            <option value="all">All phases</option>
            {phases.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)} className={selectCls}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p === 'All' ? 'All priorities' : p}</option>)}
          </select>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={selectCls}>
            <option value="all">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className={selectCls}>
            <option value="all">All zones</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <div className="relative flex-1 min-w-[140px] max-w-[260px]">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task, owner, zone, notes…"
              className="w-full text-xs bg-white border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setOnlyMilestones((v) => !v)}
            className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1 ${onlyMilestones ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}
            title="Show only milestones"
          ><Flag size={10} /> Milestones {msCount > 0 && `(${msCount})`}</button>
          <button
            onClick={() => setOnlyExpress((v) => !v)}
            className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1 ${onlyExpress ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-slate-200 text-slate-500'}`}
            title="Show only EXPRESS / high-risk"
          ><Zap size={10} /> EXPRESS {exCount > 0 && `(${exCount})`}</button>
          <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} / {initialTasks.length} tasks</span>
        </div>
      </div>
      <KanbanBoard initialTasks={filtered} projMap={projMap} projects={projects} />
    </div>
  );
}