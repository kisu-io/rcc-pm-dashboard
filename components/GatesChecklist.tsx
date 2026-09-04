'use client';
import { useState } from 'react';
import { CheckCircle2, Circle, CircleDot, ChevronDown } from 'lucide-react';
import type { Task } from '@/lib/supabase';

/**
 * Readiness gates, grouped by department.
 *
 * Gates are acceptance criteria, not scheduled work: 306 of 323 carry no date
 * and none carries an owner. Putting them on a Kanban board — which is what
 * used to happen — produced a single 600-card column of undated cards each
 * rendering "— → —", and made every column count meaningless. A checklist is
 * the right shape: the only question a gate answers is met or not met.
 */

const STATUS_ICON: Record<string, React.ReactNode> = {
  Done: <CheckCircle2 size={18} className="text-green-600 shrink-0" />,
  'In Progress': <CircleDot size={18} className="text-blue-600 shrink-0" />,
};

function groupByDepartment(gates: Task[]): { department: string; rows: Task[] }[] {
  const map = new Map<string, Task[]>();
  for (const g of gates) {
    const key = g.phase?.trim() || 'Unassigned';
    const bucket = map.get(key);
    if (bucket) bucket.push(g);
    else map.set(key, [g]);
  }
  return Array.from(map.entries())
    .map(([department, rows]) => ({ department, rows }))
    .sort((a, b) => {
      const metA = a.rows.filter((r) => r.kanban_status === 'Done').length / a.rows.length;
      const metB = b.rows.filter((r) => r.kanban_status === 'Done').length / b.rows.length;
      return metA - metB || b.rows.length - a.rows.length;
    });
}

/** Section headings inside a department, e.g. "8. Team Readiness". */
function sectionOf(gate: Task): string {
  return gate.zone?.trim() || 'General';
}

function DepartmentBlock({
  department,
  rows,
  onEdit,
  defaultOpen,
}: {
  department: string;
  rows: Task[];
  onEdit: (t: Task) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const met = rows.filter((r) => r.kanban_status === 'Done').length;

  const sections = new Map<string, Task[]>();
  for (const r of rows) {
    const key = sectionOf(r);
    const bucket = sections.get(key);
    if (bucket) bucket.push(r);
    else sections.set(key, [r]);
  }

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="text-base font-semibold block truncate">{department}</span>
          <span className="text-xs text-slate-500 tabular-nums">
            {met} / {rows.length} gates met
          </span>
        </span>
        <span className="flex items-center gap-3 shrink-0">
          <span className="w-24 h-2 rounded-sm bg-slate-100 overflow-hidden hidden sm:block">
            <span
              className="block h-full bg-green-500"
              style={{ width: `${(met / rows.length) * 100}%` }}
            />
          </span>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {Array.from(sections.entries()).map(([section, items]) => (
            <div key={section}>
              <p className="px-4 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-500">
                {section}
              </p>
              <ul className="divide-y divide-slate-100">
                {items.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => onEdit(g)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      title={g.notes || undefined}
                    >
                      {STATUS_ICON[g.kanban_status] ?? (
                        <Circle size={18} className="text-slate-300 shrink-0" />
                      )}
                      <span
                        className={`text-sm leading-snug break-words ${
                          g.kanban_status === 'Done' ? 'text-slate-400 line-through' : ''
                        }`}
                      >
                        {g.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function GatesChecklist({
  gates,
  onEdit,
}: {
  gates: Task[];
  onEdit: (t: Task) => void;
}) {
  const groups = groupByDepartment(gates);

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center text-sm text-slate-500">
        No readiness gates in this selection.
      </div>
    );
  }

  const total = gates.length;
  const met = gates.filter((g) => g.kanban_status === 'Done').length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        <span className="font-semibold tabular-nums">
          {met} / {total}
        </span>{' '}
        opening gates met across {groups.length} department{groups.length === 1 ? '' : 's'} · least
        ready first. Tap a gate to update it.
      </p>
      {groups.map((g, i) => (
        <DepartmentBlock
          key={g.department}
          department={g.department}
          rows={g.rows}
          onEdit={onEdit}
          defaultOpen={i < 2}
        />
      ))}
    </div>
  );
}
