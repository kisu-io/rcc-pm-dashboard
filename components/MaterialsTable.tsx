'use client';
import { useState } from 'react';
import { Material, Project } from '@/lib/supabase';
import { useCanEdit } from '@/lib/useRole';
import { Boxes, Plus, Pencil } from 'lucide-react';
import MaterialModal from './MaterialModal';

const STATUS_BG: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Ordered: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-green-100 text-green-700',
  Delayed: 'bg-red-100 text-red-700',
};

function daysFromNow(d: string | null): number {
  if (!d) return Infinity;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function MaterialsTable({ materials, projects }: { materials: Material[]; projects: Project[] }) {
  const canEdit = useCanEdit();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  return (
    <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">All materials ({materials.length})</h3>
        {canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shrink-0"
          >
            <Plus size={14} /> Add material
          </button>
        )}
      </div>

      {materials.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <Boxes size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">{canEdit ? 'Chưa có vật tư. Bấm “Add material” để thêm.' : 'No materials yet.'}</p>
        </div>
      ) : (
        <table className="w-full text-xs md:text-sm min-w-[740px]">
          <thead>
            <tr className="text-left text-slate-400 text-[10px]">
              <th className="pb-2">Material</th>
              <th>Project</th>
              <th>Supplier</th>
              <th>Qty</th>
              <th>Lead time</th>
              <th>Ordered</th>
              <th>Expected</th>
              <th>Status</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => {
              const d = daysFromNow(m.expected_delivery);
              const isDelayed = !m.actual_delivery && m.expected_delivery && new Date(m.expected_delivery) < new Date() && m.status !== 'Delivered';
              return (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2 font-medium">
                    {m.name}
                    {m.notes && <div className="text-[9px] text-slate-400 truncate max-w-[150px]" title={m.notes}>{m.notes}</div>}
                  </td>
                  <td className="text-slate-500 truncate max-w-[120px]">{projName(m.project_id)}</td>
                  <td className="text-slate-500">{m.supplier || '—'}</td>
                  <td className="text-slate-500">{m.quantity ? `${m.quantity} ${m.unit || ''}` : '—'}</td>
                  <td className="text-slate-500">{m.lead_time_days ? `${m.lead_time_days}d` : '—'}</td>
                  <td className="text-slate-500">{m.order_date || '—'}</td>
                  <td className={isDelayed ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                    {m.expected_delivery || '—'}
                    {isDelayed ? ' (delayed)' : d !== Infinity && m.status !== 'Delivered' ? ` (${d}d)` : ''}
                  </td>
                  <td>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BG[m.status] || 'bg-slate-100'}`}>{m.status}</span>
                  </td>
                  {canEdit && (
                    <td className="text-right">
                      <button onClick={() => setEditing(m)} className="p-1 rounded hover:bg-slate-200 text-slate-500" title="Edit">
                        <Pencil size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {adding && (
        <MaterialModal
          projects={projects}
          onClose={() => setAdding(false)}
          onSaved={() => window.location.reload()}
        />
      )}
      {editing && (
        <MaterialModal
          projects={projects}
          material={editing}
          onClose={() => setEditing(null)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
