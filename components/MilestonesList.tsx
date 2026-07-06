'use client';
import { useState } from 'react';
import { Milestone } from '@/lib/supabase';
import { useCanEdit } from '@/lib/useRole';
import { CheckCircle2, AlertTriangle, Clock, Pencil, Plus } from 'lucide-react';
import MilestoneModal from './MilestoneModal';

const MS_STATUS_COLOR: Record<string, string> = {
  Pending: '#f59e0b',
  Reached: '#22c55e',
  Missed: '#ef4444',
};

/** Client-rendered milestones list with add/edit/delete (edit gated to pm/admin). */
export default function MilestonesList({ projectId, milestones }: { projectId: string; milestones: Milestone[] }) {
  const canEdit = useCanEdit();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);

  function reload() {
    // Force server component re-fetch
    window.location.reload();
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Milestones</h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {milestones.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No milestones.</p>
      ) : (
        <div className="space-y-3">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-start gap-3 group">
              <div className="mt-0.5">
                {m.status === 'Reached' ? <CheckCircle2 size={16} className="text-green-500" />
                  : m.status === 'Missed' ? <AlertTriangle size={16} className="text-red-500" />
                  : <Clock size={16} className="text-amber-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{m.name}</div>
                <div className="text-[10px] text-slate-500">
                  {m.due_date || '—'} · <span style={{ color: MS_STATUS_COLOR[m.status] || '#94a3b8' }}>{m.status}</span>
                  {m.type && <span> · {m.type}</span>}
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(m)}
                  className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                  aria-label="Edit milestone"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <MilestoneModal
          projectId={projectId}
          onClose={() => setAdding(false)}
          onSaved={reload}
        />
      )}
      {editing && (
        <MilestoneModal
          projectId={projectId}
          milestone={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}