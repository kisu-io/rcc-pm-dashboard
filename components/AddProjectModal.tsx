'use client';
import { useState } from 'react';
import { supabase, Project } from '@/lib/supabase';
import { X, Plus, Loader2, Pencil, Trash2 } from 'lucide-react';

const STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Complete', 'Pending', 'Upcoming'];

type Props = {
  project?: Project | null;
  onSaved?: () => void;
  trigger?: 'add' | 'edit';
};

export default function AddProjectModal({ project, onSaved, trigger = 'add' }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = trigger === 'edit' || !!project;
  const [form, setForm] = useState({
    name: project?.name || '',
    location: project?.location || '',
    status: project?.status || 'Not Started',
    progress_pct: project?.progress_pct ?? 0,
    budget: project?.budget ?? '',
    spent: project?.spent ?? 0,
    start_date: project?.start_date || '',
    target_end: project?.target_end || '',
    pm: project?.pm || '',
    cover_url: project?.cover_url || '',
  });

  function openModal() {
    if (project) {
      setForm({
        name: project.name,
        location: project.location || '',
        status: project.status,
        progress_pct: project.progress_pct,
        budget: project.budget ?? '',
        spent: project.spent,
        start_date: project.start_date || '',
        target_end: project.target_end || '',
        pm: project.pm || '',
        cover_url: project.cover_url || '',
      });
    }
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Cần nhập tên project');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      location: form.location || null,
      status: form.status,
      progress_pct: Number(form.progress_pct) || 0,
      budget: form.budget === '' ? null : Number(form.budget),
      spent: Number(form.spent) || 0,
      start_date: form.start_date || null,
      target_end: form.target_end || null,
      pm: form.pm || null,
      cover_url: form.cover_url || null,
    };
    let err;
    if (isEdit && project) {
      ({ error: err } = await supabase.from('projects').update(payload).eq('id', project.id));
    } else {
      ({ error: err } = await supabase.from('projects').insert(payload));
    }
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    onSaved?.();
  }

  async function deleteProject() {
    if (!project) return;
    if (!confirm(`Delete "${project.name}"? This also deletes all its tasks, milestones, and documents.`)) return;
    setSaving(true);
    const { error: err } = await supabase.from('projects').delete().eq('id', project.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    onSaved?.();
  }

  const inputCls = 'w-full text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const labelCls = 'text-[10px] text-slate-400 uppercase font-medium';

  return (
    <>
      {isEdit ? (
        <button
          onClick={openModal}
          className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
        >
          <Pencil size={14} /> Edit
        </button>
      ) : (
        <button
          onClick={openModal}
          className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shrink-0"
        >
          <Plus size={14} /> Add project
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <form
            onSubmit={submit}
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
              <h2 className="font-semibold text-sm">{isEdit ? 'Edit Project' : 'Add Project'}</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">⚠ {error}</div>}

              <div>
                <label className={labelCls}>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required placeholder="e.g. Le Meridien Fit-out" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="e.g. HCMC" />
                </div>
                <div>
                  <label className={labelCls}>PM</label>
                  <input value={form.pm} onChange={(e) => setForm({ ...form, pm: e.target.value })} className={inputCls} placeholder="e.g. Mr Phán" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Progress %</label>
                  <input type="number" min={0} max={100} value={form.progress_pct} onChange={(e) => setForm({ ...form, progress_pct: Number(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Budget (VND)</label>
                  <input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className={inputCls} placeholder="e.g. 5000000000" />
                </div>
                <div>
                  <label className={labelCls}>Spent (VND)</label>
                  <input type="number" min={0} value={form.spent} onChange={(e) => setForm({ ...form, spent: Number(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Start date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Target end</label>
                  <input type="date" value={form.target_end} onChange={(e) => setForm({ ...form, target_end: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Cover URL</label>
                <input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} className={inputCls} placeholder="https://…" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-3 flex items-center justify-between gap-2">
              {isEdit ? (
                <button
                  type="button"
                  onClick={deleteProject}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : isEdit ? <Pencil size={14} /> : <Plus size={14} />}
                  {isEdit ? 'Save changes' : 'Create project'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}