'use client';
import { useState } from 'react';
import { CostEntry, Project, Task } from '@/lib/supabase';
import { useCanEdit } from '@/lib/useRole';
import { Plus, Pencil } from 'lucide-react';
import CostEntryModal from './CostEntryModal';
import { formatVND } from '@/lib/data';

/** Client-rendered cost entries table with add/edit/delete (edit gated to pm/admin). */
export default function CostEntriesTable({
  entries,
  projects,
  tasks,
}: {
  entries: CostEntry[];
  projects: Project[];
  tasks: Task[];
}) {
  const canEdit = useCanEdit();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CostEntry | null>(null);

  function reload() {
    window.location.reload();
  }

  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';
  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Cost entries ({entries.length}) · {formatVND(total)}</h3>
        {canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shrink-0"
          >
            <Plus size={14} /> Add cost
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No cost entries yet.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Project</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2">Category</th>
              <th className="py-2 pr-2">Vendor</th>
              <th className="py-2 pr-2 text-right">Amount</th>
              {canEdit && <th className="py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="group border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-2 pr-2 whitespace-nowrap text-slate-500">{e.date}</td>
                <td className="py-2 pr-2">{projName(e.project_id)}</td>
                <td className="py-2 pr-2">{e.description}{e.invoice_ref && <span className="block text-[10px] text-slate-400">{e.invoice_ref}</span>}</td>
                <td className="py-2 pr-2 text-slate-500">{e.category || '—'}</td>
                <td className="py-2 pr-2 text-slate-500">{e.vendor || '—'}</td>
                <td className="py-2 pr-2 text-right font-medium whitespace-nowrap">{formatVND(e.amount)}</td>
                {canEdit && (
                  <td className="py-2">
                    <button
                      onClick={() => setEditing(e)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                      aria-label="Edit cost entry"
                    >
                      <Pencil size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <CostEntryModal
          projects={projects}
          tasks={tasks}
          onClose={() => setAdding(false)}
          onSaved={reload}
        />
      )}
      {editing && (
        <CostEntryModal
          projects={projects}
          tasks={tasks}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}