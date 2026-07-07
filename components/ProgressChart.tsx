'use client';
import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export type ProgressProject = {
  id: string;
  name: string;
  progress_pct: number;
  start_date: string | null;
  target_end: string | null;
}

export type ProgressTask = {
  id: string;
  project_id: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  progress_pct: number;
}

type Props = {
  projects: ProgressProject[];
  tasks: ProgressTask[];
};

const WEEK_MS = 7 * 86400000;

function weekLabel(d: Date) {
  return `W${Math.floor((d.getTime() - Date.UTC(d.getFullYear(), 0, 1)) / WEEK_MS) + 1}`;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function cumulativeSeries(
  project: ProgressProject | null,
  tasks: ProgressTask[],
  kind: 'planned' | 'actual',
  buckets: { label: string; date: Date }[],
) {
  // For each bucket, compute cumulative completion percentage.
  // Strategy: weigh each task by its share of the project's total effort.
  //   - Planned: task contributes 0→100% ramp across planned_start→planned_end,
  //              then 100% after planned_end (planned to finish 100% by that date).
  //   - Actual: task contributes 0→progress_pct ramp across actual_start→actual_end
  //              (or planned dates if actual missing), then holds at progress_pct.
  const projTasks = project
    ? tasks.filter((t) => t.project_id === project.id)
    : tasks;
  if (!projTasks.length) return buckets.map(() => 0);

  // Compute total effort (duration in ms) across all tasks for weighting
  const taskDurs = projTasks.map((t) => {
    const s = kind === 'planned' ? parseDate(t.planned_start) : (parseDate(t.actual_start) || parseDate(t.planned_start));
    const e = kind === 'planned' ? parseDate(t.planned_end) : (parseDate(t.actual_end) || parseDate(t.planned_end));
    if (!s || !e) return WEEK_MS;
    return Math.max(e.getTime() - s.getTime(), WEEK_MS);
  });
  const totalEffort = taskDurs.reduce((s, d) => s + d, 0) || projTasks.length * WEEK_MS;

  return buckets.map((b) => {
    let cumWeighted = 0;
    projTasks.forEach((t, idx) => {
      const start = kind === 'planned' ? parseDate(t.planned_start) : (parseDate(t.actual_start) || parseDate(t.planned_start));
      const end = kind === 'planned' ? parseDate(t.planned_end) : (parseDate(t.actual_end) || parseDate(t.planned_end));
      if (!start || !end) return;
      const dur = Math.max(end.getTime() - start.getTime(), WEEK_MS);
      const weight = taskDurs[idx] / totalEffort;
      if (b.date.getTime() >= end.getTime()) {
        // Task complete by this week
        cumWeighted += weight * (kind === 'planned' ? 100 : t.progress_pct);
      } else if (b.date.getTime() >= start.getTime()) {
        // Task in progress — linear interpolation
        const frac = (b.date.getTime() - start.getTime()) / dur;
        const target = kind === 'planned' ? 100 : t.progress_pct;
        cumWeighted += weight * Math.min(frac * 100, target);
      }
    });
    return cumWeighted;
  });
}

export default function ProgressChart({ projects, tasks }: Props) {
  const [selected, setSelected] = useState<string>('all');

  const { data, chartTitle } = useMemo(() => {
    const project = selected === 'all' ? null : projects.find((p) => p.id === selected) || null;

    // Determine time range
    const projTasks = project ? tasks.filter((t) => t.project_id === project.id) : tasks;
    const startDates: Date[] = [];
    const endDates: Date[] = [];
    if (project) {
      if (project.start_date) startDates.push(new Date(project.start_date));
      if (project.target_end) endDates.push(new Date(project.target_end));
    }
    for (const t of projTasks) {
      const ps = parseDate(t.planned_start);
      const pe = parseDate(t.planned_end);
      if (ps) startDates.push(ps);
      if (pe) endDates.push(pe);
    }
    const minDate = startDates.length ? new Date(Math.min(...startDates.map((d) => d.getTime()))) : new Date();
    const maxDate = endDates.length ? new Date(Math.max(...endDates.map((d) => d.getTime()))) : new Date(minDate.getTime() + 6 * WEEK_MS);
    const totalWeeks = Math.max(Math.ceil((maxDate.getTime() - minDate.getTime()) / WEEK_MS), 1);
    const weekCount = Math.min(Math.max(totalWeeks, 4), 30);

    const buckets: { label: string; date: Date }[] = [];
    for (let i = 0; i < weekCount; i++) {
      const d = new Date(minDate.getTime() + i * WEEK_MS);
      buckets.push({ label: weekLabel(d), date: d });
    }

    const planned = cumulativeSeries(project, projTasks, 'planned', buckets);
    const actual = cumulativeSeries(project, projTasks, 'actual', buckets);
    const merged = buckets.map((b, i) => ({
      week: b.label,
      planned: Math.round(planned[i]),
      actual: Math.round(actual[i]),
    }));

    return {
      data: merged,
      chartTitle: project ? `Project Progress — ${project.name}` : 'Project Progress (S-curve) — All Projects',
    };
  }, [selected, projects, tasks]);

  const options = [{ id: 'all', name: 'All Projects' }, ...projects];

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-semibold text-sm truncate">{chartTitle}</h3>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="week" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={20} />
          <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="planned" stroke="#2563eb" fill="url(#p)" name="Planned" />
          <Area type="monotone" dataKey="actual" stroke="#22c55e" fill="url(#a)" name="Actual" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}