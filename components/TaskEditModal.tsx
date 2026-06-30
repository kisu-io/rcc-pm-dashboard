'use client';
import { useState } from 'react';
import { supabase, Task, Project } from '@/lib/supabase';
import { X, Loader2, Pencil, Trash2 } from 'lucide-react';

const PHASES = ['Design', 'Permit', 'Construction', 'Fit-out', 'Inspection', 'Handover'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

export default function TaskEditModal({
  task, projects, onClose, onSaved,
}: {
  task: Task;
  projects: Project[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: task.project_id,
    title: task.title,
    phase: task.phase || 'Construction',
    zone: task.zone || '',
    owner: task.owner || '',
    priority: task.priority,
    kanban_status: task.kanban_status,
    planned_start: task.planned_start || '',
    planned_end: task.planned_end || '',
    actual_start: task.actual_start || '',
    actual_end: task.actual_end || '',
    progress_pct: task.progress_pct,
    due_date: task.due_date || '',
    constraint_note: task.constraint_note || '',
    notes: task.notes || '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Cần nhập title');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      project_id: form.project_id,
      title: form.title.trim(),
      phase: form.phase || null,
      zone: form.zone || null,
      owner: form.owner || null,
      priority: form.priority,
      kanban_status: form.kanban_status,
      planned_start: form.planned_start || null,
      planned_end: form.planned_end || null,
      actual_start: form.actual_start || null,
      actual_end: form.actual_end || null,
      progress_pct: Number(form.progress_pct) || 0,
      due_date: form.due_date || null,
      constraint_note: form.constraint_note || null,
      notes: form.notes || null,
    };
    const { error: err } = await supabase.from('tasks').update(payload).eq('id', task.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved?.();
    onClose();
  }

  async function deleteTask() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setSaving(true);
    const { error: err } = await supabase.from('tasks').delete().eq('id', task.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved?.();
    onClose();
  }

  const inputCls = 'w-full text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const labelCls = 'text-[10px] text-slate-400 uppercase font-medium';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Edit Task</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">⚠ {error}</div>}

          <div>
            <label className={labelCls}>Project</label>
            <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={inputCls}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Phase</label>
              <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} className={inputCls}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Zone</label>
              <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Owner</label>
              <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.kanban_status} onChange={(e) => setForm({ ...form, kanban_status: e.target.value })} className={inputCls}>
                {COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Progress %</label>
              <input type="number" min={0} max={100} value={form.progress_pct} onChange={(e) => setForm({ ...form, progress_pct: Number(e.target.value) || 0 })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Planned start</label>
              <input type="date" value={form.planned_start} onChange={(e) => setForm({ ...form, planned_start: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Planned end</label>
              <input type="date" value={form.planned_end} onChange={(e) => setForm({ ...form, planned_end: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Actual start</label>
              <input type="date" value={form.actual_start} onChange={(e) => setForm({ ...form, actual_start: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Actual end</label>
              <input type="date" value={form.actual_end} onChange={(e) => setForm({ ...form, actual_end: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Constraint note</label>
            <input value={form.constraint_note} onChange={(e) => setForm({ ...form, constraint_note: e.target.value })} className={inputCls} placeholder="e.g. Chờ vật tư" />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} rows={2} />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={deleteTask}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}