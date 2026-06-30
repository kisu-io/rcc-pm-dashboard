'use client';
import { useState, useMemo } from 'react';
import { Project } from '@/lib/supabase';
import ProjectCard from './ProjectCard';

type ProjectWithTasks = Project & { task_count: number };

type SortKey = 'progress' | 'deadline' | 'name' | 'budget';

export default function ProjectsFilters({
  projects, statuses, pms, locations,
}: {
  projects: ProjectWithTasks[];
  statuses: string[];
  pms: string[];
  locations: string[];
}) {
  const [status, setStatus] = useState('All');
  const [pm, setPm] = useState('All');
  const [loc, setLoc] = useState('All');
  const [sort, setSort] = useState<SortKey>('deadline');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    let arr = projects.slice();
    if (status !== 'All') arr = arr.filter((p) => p.status === status);
    if (pm !== 'All') arr = arr.filter((p) => p.pm === pm);
    if (loc !== 'All') arr = arr.filter((p) => p.location === loc);
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter((p) => p.name.toLowerCase().includes(s) || (p.location || '').toLowerCase().includes(s));
    }
    arr.sort((a, b) => {
      if (sort === 'progress') return b.progress_pct - a.progress_pct;
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'budget') return (b.budget || 0) - (a.budget || 0);
      // deadline asc (nulls last)
      const ad = a.target_end ? new Date(a.target_end).getTime() : Infinity;
      const bd = b.target_end ? new Date(b.target_end).getTime() : Infinity;
      return ad - bd;
    });
    return arr;
  }, [projects, status, pm, loc, sort, q]);

  const selectCls = 'text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm flex flex-wrap gap-2 md:gap-3 items-center">
        <input
          type="search"
          placeholder="Search name / location…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="text-xs md:text-sm flex-1 min-w-[140px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option>All</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={pm} onChange={(e) => setPm(e.target.value)} className={selectCls}>
          <option>All</option>
          {pms.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className={selectCls}>
          <option>All</option>
          {locations.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
          <option value="deadline">Sort: Deadline</option>
          <option value="progress">Sort: Progress</option>
          <option value="budget">Sort: Budget</option>
          <option value="name">Sort: Name</option>
        </select>
        <span className="text-[10px] md:text-xs text-slate-400 ml-auto">{filtered.length} shown</span>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-10 text-center text-slate-400 shadow-sm">
          <p className="text-sm">No projects match filter.</p>
        </div>
      )}
    </div>
  );
}