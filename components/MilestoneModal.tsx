'use client';
import { useState } from 'react';
import { supabase, Milestone } from '@/lib/supabase';
import { X, Plus, Save, Trash2, Loader2 } from 'lucide-react';

const MS_STATUSES = ['Pending', 'Reached', 'Missed'];
const MS_TYPES = ['Payment', 'Inspection', 'Handover', 'Permit', 'Other'];

type FormState = {
  name: string;
  due_date: string;
  status: string;
  type: string;
};

function toForm(milestone: Milestone | undefined): FormState {
  return {
    name: milestone?.name || '',
    due_date: milestone?.due_date || '',
    status: milestone?.status || 'Pending',
    type: milestone?.type || 'Inspection',
  };
}

/** Add/edit/delete a milestone. Pass `milestone` to edit; omit to create. Parent controls visibility. */
export default function MilestoneModal({
  projectId,
  milestone,
  onClose,
  onSaved,
}: {
  projectId: string;
  milestone?: Milestone;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!milestone;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(milestone));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Cần nhập tên milestone');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      project_id: projectId,
      name: form.name.trim(),
      due_date: form.due_date || null,
      status: form.status,
      type: form.type === 'Other' ? null : form.type,
    };
    const { error: err } = isEdit
      ? await supabase.from('milestones').update(payload).eq('id', milestone!.id)
      : await supabase.from('milestones').insert(payload);
    setSaving(false);
    if (err) {
      if (err.message.includes("row-level security") || err.message.includes("RLS")) { setError("Khong co quyen ghi. Can dang nhap voi role PM hoac Admin. Thu logout roi login lai."); } else { setError(err.message); }
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!isEdit || !window.confirm(`Xoá milestone "${milestone!.name}"?`)) return;
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase.from('milestones').delete().eq('id', milestone!.id);
    setDeleting(false);
    if (err) {
      if (err.message.includes("row-level security") || err.message.includes("RLS")) { setError("Khong co quyen ghi. Can dang nhap voi role PM hoac Admin. Thu logout roi login lai."); } else { setError(err.message); }
      return;
    }
    onSaved();
  }

  const inputCls = 'w-full text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const labelCls = 'text-[10px] text-slate-400 uppercase font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="font-semibold text-sm">{isEdit ? 'Edit Milestone' : 'Add Milestone'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">⚠ {error}</div>}

          <div>
            <label className={labelCls}>Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required placeholder="e.g. Topping-out roof slab" />
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
                {MS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-3 flex items-center justify-between gap-2">
          {isEdit ? (
            <button type="button" onClick={remove} disabled={deleting} className="inline-flex items-center gap-1.5 text-xs text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : isEdit ? <Save size={14} /> : <Plus size={14} />}
              {isEdit ? 'Save' : 'Add milestone'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}