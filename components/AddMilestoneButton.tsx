'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Plus, Loader2 } from 'lucide-react';

const MS_STATUSES = ['Pending', 'Reached', 'Missed'];
const MS_TYPES = ['Payment', 'Inspection', 'Handover', 'Permit', 'Other'];

export default function AddMilestoneButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    due_date: '',
    status: 'Pending',
    type: 'Inspection',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Cần nhập tên milestone');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('milestones').insert({
      project_id: projectId,
      name: form.name.trim(),
      due_date: form.due_date || null,
      status: form.status,
      type: form.type === 'Other' ? null : form.type,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForm({ name: '', due_date: '', status: 'Pending', type: 'Inspection' });
    setOpen(false);
    // Force a refresh — server component will re-fetch
    window.location.reload();
  }

  const inputCls = 'w-full text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const labelCls = 'text-[10px] text-slate-400 uppercase font-medium';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
      >
        <Plus size={12} /> Add
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <form
            onSubmit={submit}
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md"
          >
            <div className="border-b border-slate-100 p-4 flex items-center justify-between">
              <h2 className="font-semibold text-sm">Add Milestone</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">⚠ {error}</div>}
              <div>
                <label className={labelCls}>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required placeholder="e.g. PCCC acceptance" />
              </div>
              <div>
                <label className={labelCls}>Due date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    {MS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                    {MS_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add milestone
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}