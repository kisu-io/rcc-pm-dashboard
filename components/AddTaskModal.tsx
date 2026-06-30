'use client';
import { useState } from 'react';
import { supabase, Project } from '@/lib/supabase';
import { X, Plus, Loader2 } from 'lucide-react';

const PHASES = ['Design', 'Permit', 'Construction', 'Fit-out', 'Inspection', 'Handover'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

export default function AddTaskModal({
  projects, onCreated,
}: { projects: Project[]; onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    project_id: projects[0]?.id || '',
    title: '',
    phase: 'Construction',
    zone: '',
    owner: '',
    priority: 'Medium',
    kanban_status: 'To Do',
    planned_start: '',
    planned_end: '',
    due_date: '',
    constraint_note: '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id || !form.title.trim()) {
      setError('Cần chọn project + nhập title');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      project_id: form.project_id,
      title: form.title.trim(),
      phase: form.phase,
      zone: form.zone || null,
      owner: form.owner || null,
      priority: form.priority,
      kanban_status: form.kanban_status,
      planned_start: form.planned_start || null,
      planned_end: form.planned_end || null,
      due_date: form.due_date || null,
      constraint_note: form.constraint_note || null,
    };
    const { error: err } = await supabase.from('tasks').insert(payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Reset + close
    setForm({
      project_id: projects[0]?.id || '',
      title: '', phase: 'Construction', zone: '', owner: '',
      priority: 'Medium', kanban_status: 'To Do',
      planned_start: '', planned_end: '', due_date: '', constraint_note: '',
    });
    setOpen(false);
    onCreated?.();
  }

  const inputCls = 'w-full text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const labelCls = 'text-[10px] text-slate-400 uppercase font-medium';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shrink-0"
      >
        <Plus size={14} /> Add task
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <form
            onSubmit={submit}
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
              <h2 className="font-semibold text-sm">Add Task</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
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
                <label className={labelCls}>Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} required placeholder="e.g. MEP rough-in" />
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
                  <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className={inputCls} placeholder="e.g. Floor 2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Owner</label>
                  <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={inputCls} placeholder="e.g. Đội A" />
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <select value={form.kanban_status} onChange={(e) => setForm({ ...form, kanban_status: e.target.value })} className={inputCls}>
                  {COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
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

              <div>
                <label className={labelCls}>Constraint note</label>
                <input value={form.constraint_note} onChange={(e) => setForm({ ...form, constraint_note: e.target.value })} className={inputCls} placeholder="e.g. Chờ vật tư ống đồng" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create task
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}