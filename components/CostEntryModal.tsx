'use client';
import { useState } from 'react';
import { supabase, CostEntry, Project, Task } from '@/lib/supabase';
import { X, Plus, Save, Trash2, Loader2 } from 'lucide-react';

const CATEGORIES = ['Materials', 'Labor', 'Subcontractor', 'Equipment', 'Permits', 'Other'];

type FormState = {
  project_id: string;
  task_id: string;
  date: string;
  category: string;
  vendor: string;
  description: string;
  amount: string;
  invoice_ref: string;
};

function toForm(entry: CostEntry | undefined, projects: Project[]): FormState {
  return {
    project_id: entry?.project_id || projects[0]?.id || '',
    task_id: entry?.task_id || '',
    date: entry?.date || new Date().toISOString().slice(0, 10),
    category: entry?.category || 'Materials',
    vendor: entry?.vendor || '',
    description: entry?.description || '',
    amount: entry?.amount != null ? String(entry.amount) : '',
    invoice_ref: entry?.invoice_ref || '',
  };
}

/** Add/edit/delete a cost entry. Pass `entry` to edit; omit to create. Parent controls visibility. */
export default function CostEntryModal({
  projects,
  tasks,
  entry,
  onClose,
  onSaved,
}: {
  projects: Project[];
  tasks: Task[];
  entry?: CostEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!entry;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(entry, projects));

  const filteredTasks = form.project_id ? tasks.filter((t) => t.project_id === form.project_id) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id || !form.description.trim() || !form.amount) {
      setError('Cần chọn project + nhập mô tả + số tiền');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      project_id: form.project_id,
      task_id: form.task_id || null,
      date: form.date || null,
      category: form.category || null,
      vendor: form.vendor || null,
      description: form.description.trim(),
      amount: Number(form.amount),
      invoice_ref: form.invoice_ref || null,
    };
    const { error: err } = isEdit
      ? await supabase.from('cost_entries').update(payload).eq('id', entry!.id)
      : await supabase.from('cost_entries').insert(payload);
    setSaving(false);
    if (err) {
      if (err.message.includes("row-level security") || err.message.includes("RLS")) { setError("Khong co quyen ghi. Can dang nhap voi role PM hoac Admin. Thu logout roi login lai."); } else { setError(err.message); }
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!isEdit || !window.confirm(`Xoá chi phí "${entry!.description}"?`)) return;
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase.from('cost_entries').delete().eq('id', entry!.id);
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
      <form onSubmit={submit} className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="font-semibold text-sm">{isEdit ? 'Edit Cost Entry' : 'Add Cost Entry'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">⚠ {error}</div>}

          <div>
            <label className={labelCls}>Project *</label>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value, task_id: '' })}
              className={inputCls}
              required
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description *</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} required placeholder="e.g. Concrete pour — slab L3" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Amount (VND) *</label>
              <input type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} required placeholder="45000000" />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vendor</label>
              <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputCls} placeholder="e.g. Coteccons" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Invoice ref</label>
              <input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} className={inputCls} placeholder="INV-2026-001" />
            </div>
            <div>
              <label className={labelCls}>Task (optional)</label>
              <select value={form.task_id} onChange={(e) => setForm({ ...form, task_id: e.target.value })} className={inputCls}>
                <option value="">— none —</option>
                {filteredTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
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
              {isEdit ? 'Save' : 'Add cost'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}