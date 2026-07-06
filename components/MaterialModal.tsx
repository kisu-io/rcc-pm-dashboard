'use client';
import { useState } from 'react';
import { supabase, Material, Project } from '@/lib/supabase';
import { X, Plus, Save, Trash2, Loader2 } from 'lucide-react';

const STATUSES = ['Pending', 'Ordered', 'Delivered', 'Delayed'];

type FormState = {
  project_id: string;
  name: string;
  category: string;
  supplier: string;
  quantity: string;
  unit: string;
  lead_time_days: string;
  order_date: string;
  expected_delivery: string;
  actual_delivery: string;
  status: string;
  notes: string;
};

function toForm(material: Material | undefined, projects: Project[]): FormState {
  return {
    project_id: material?.project_id || projects[0]?.id || '',
    name: material?.name || '',
    category: material?.category || '',
    supplier: material?.supplier || '',
    quantity: material?.quantity != null ? String(material.quantity) : '',
    unit: material?.unit || '',
    lead_time_days: material?.lead_time_days != null ? String(material.lead_time_days) : '',
    order_date: material?.order_date || '',
    expected_delivery: material?.expected_delivery || '',
    actual_delivery: material?.actual_delivery || '',
    status: material?.status || 'Pending',
    notes: material?.notes || '',
  };
}

/** Add/edit/delete a material. Pass `material` to edit; omit to create. Parent controls visibility. */
export default function MaterialModal({
  projects,
  material,
  onClose,
  onSaved,
}: {
  projects: Project[];
  material?: Material;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!material;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(material, projects));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id || !form.name.trim()) {
      setError('Cần chọn project + nhập tên vật tư');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      project_id: form.project_id,
      name: form.name.trim(),
      category: form.category || null,
      supplier: form.supplier || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      unit: form.unit || null,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      order_date: form.order_date || null,
      expected_delivery: form.expected_delivery || null,
      actual_delivery: form.actual_delivery || null,
      status: form.status,
      notes: form.notes || null,
    };
    const { error: err } = isEdit
      ? await supabase.from('materials').update(payload).eq('id', material!.id)
      : await supabase.from('materials').insert(payload);
    setSaving(false);
    if (err) {
      if (err.message.includes("row-level security") || err.message.includes("RLS")) { setError("Khong co quyen ghi. Can dang nhap voi role PM hoac Admin. Thu logout roi login lai."); } else { setError(err.message); }
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!isEdit || !window.confirm(`Xoá vật tư "${material!.name}"?`)) return;
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase.from('materials').delete().eq('id', material!.id);
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
          <h2 className="font-semibold text-sm">{isEdit ? 'Edit Material' : 'Add Material'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">⚠ {error}</div>}

          <div>
            <label className={labelCls}>Project *</label>
            <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={inputCls} required>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Material *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required placeholder="e.g. Ống đồng phi 22" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} placeholder="e.g. MEP" />
            </div>
            <div>
              <label className={labelCls}>Supplier</label>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className={inputCls} placeholder="e.g. Hòa Phát" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} placeholder="100" />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls} placeholder="m, cái, kg" />
            </div>
            <div>
              <label className={labelCls}>Lead time (d)</label>
              <input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} className={inputCls} placeholder="14" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Ordered</label>
              <input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expected</label>
              <input type="date" value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Delivered</label>
              <input type="date" value={form.actual_delivery} onChange={(e) => setForm({ ...form, actual_delivery: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} placeholder="Ghi chú" />
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
              {isEdit ? 'Save' : 'Add material'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
