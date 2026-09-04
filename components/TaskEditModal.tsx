'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { supabase, Task, Project } from '@/lib/supabase';
import { checkWrite } from '@/lib/writes';
import { statusColor } from '@/lib/schedule-utils';
import { MODULE_ORDER, MODULE_LABELS } from '@/lib/modules';
import { X, Loader2, Check, Trash2, ChevronDown, AlertCircle } from 'lucide-react';

/*
 * See the note in AddTaskModal: `module` is the owning team, `phase` is the
 * department inside it. The fixed phase list that used to sit here collided by
 * name with the module taxonomy and matched none of the 16 department values
 * the live programme actually uses.
 */
const PRIORITIES = ['High', 'Medium', 'Low'];
const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;
const NOTES_ROWS = 4;

/**
 * Spelled out rather than interpolated: Tailwind scans source text, so
 * `bg-${color}-50` would be purged from the build.
 */
const PRIORITY_ACTIVE_CLS: Record<string, string> = {
  High: 'bg-red-50 text-red-700 ring-red-200',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  Low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

// Width is deliberately not baked in: Tailwind emits `w-full` after `w-20`, so a
// `w-full` here would win over any narrower width a caller appends.
const CONTROL_BASE =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition ' +
  'placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10';
const CONTROL_CLS = `w-full ${CONTROL_BASE}`;
const SELECT_CLS = `${CONTROL_CLS} cursor-pointer appearance-none pr-9`;

/** A titled group of fields, separated from its neighbours by a hairline. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4 first:border-t-0 sm:px-6">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Label + control pair. `min-w-0` keeps date inputs from blowing out the grid. */
function Field({ label, htmlFor, children, hint }: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Wraps a native select so every browser shows the same chevron. */
function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export default function TaskEditModal({
  task, projects, onClose, onSaved,
}: {
  task: Task;
  projects: Project[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const panelRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: task.project_id,
    title: task.title,
    module: task.module || 'operation',
    phase: task.phase || '',
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

  // Held in a ref so the effect below can keep empty deps: call sites pass an
  // inline arrow, which would otherwise re-run this on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes, the page behind stops scrolling, and focus moves into the
  // dialog so keyboard users are not left tabbing through the page underneath.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
      module: form.module,
      phase: form.phase.trim() || null,
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
    // `.select()` is load-bearing: an RLS-filtered UPDATE returns no error and
    // zero rows, so without the returned row this reports a successful save for
    // an edit the database discarded.
    const { data, error: err } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', task.id)
      .select('id');
    setSaving(false);
    const result = checkWrite(err, data, 1);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved?.();
    onClose();
  }

  async function deleteTask() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)
      .select('id');
    setSaving(false);
    const result = checkWrite(err, data, 1);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved?.();
    onClose();
  }

  function setProgress(value: number) {
    const clamped = Math.min(PROGRESS_MAX, Math.max(PROGRESS_MIN, value));
    setForm({ ...form, progress_pct: clamped });
  }

  const projectName = projects.find((p) => p.id === form.project_id)?.name || '';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />

      <form
        ref={panelRef}
        tabIndex={-1}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={fid('heading')}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 focus:outline-none sm:rounded-2xl"
      >
        {/* Grab handle: this is a bottom sheet on phones. */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />

        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor(form.kanban_status) }}
                aria-hidden
              />
              <h2 id={fid('heading')} className="text-base font-semibold text-slate-900">Edit Task</h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {projectName ? `${projectName} · ` : ''}{form.kanban_status}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:mx-6">
              <AlertCircle size={15} className="mt-px shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Section title="Task">
            <Field label="Title" htmlFor={fid('title')}>
              <input
                id={fid('title')}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`${CONTROL_CLS} text-[15px] font-medium`}
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Project" htmlFor={fid('project')}>
                <SelectShell>
                  <select
                    id={fid('project')}
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className={SELECT_CLS}
                  >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </SelectShell>
              </Field>
              <Field label="Module" htmlFor={fid('module')}>
                <SelectShell>
                  <select
                    id={fid('module')}
                    value={form.module}
                    onChange={(e) => setForm({ ...form, module: e.target.value })}
                    className={SELECT_CLS}
                  >
                    {MODULE_ORDER.map((m) => (
                      <option key={m} value={m}>
                        {MODULE_LABELS[m].en} — {MODULE_LABELS[m].vn}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              </Field>
              <Field label="Department" htmlFor={fid('phase')}>
                <input
                  id={fid('phase')}
                  value={form.phase}
                  onChange={(e) => setForm({ ...form, phase: e.target.value })}
                  className={CONTROL_CLS}
                  placeholder="e.g. Engineering"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Owner" htmlFor={fid('owner')}>
                <input
                  id={fid('owner')}
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  className={CONTROL_CLS}
                  placeholder="Unassigned"
                />
              </Field>
              <Field label="Zone" htmlFor={fid('zone')}>
                <input
                  id={fid('zone')}
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  className={CONTROL_CLS}
                  placeholder="e.g. Lobby"
                />
              </Field>
            </div>
          </Section>

          <Section title="Status">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Column" htmlFor={fid('status')}>
                <SelectShell>
                  <select
                    id={fid('status')}
                    value={form.kanban_status}
                    onChange={(e) => setForm({ ...form, kanban_status: e.target.value })}
                    className={SELECT_CLS}
                  >
                    {COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </SelectShell>
              </Field>

              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600" id={fid('priority-label')}>
                  Priority
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby={fid('priority-label')}
                  className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
                >
                  {PRIORITIES.map((p) => {
                    const active = form.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setForm({ ...form, priority: p })}
                        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                          active
                            ? `${PRIORITY_ACTIVE_CLS[p]} shadow-sm ring-1`
                            : 'text-slate-500 hover:bg-white hover:text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <Field label={`Progress — ${form.progress_pct}%`} htmlFor={fid('progress')}>
              <div className="flex items-center gap-3">
                <input
                  id={fid('progress')}
                  type="range"
                  min={PROGRESS_MIN}
                  max={PROGRESS_MAX}
                  step={5}
                  value={form.progress_pct}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="flex-1 cursor-pointer accent-blue-600"
                />
                <input
                  type="number"
                  min={PROGRESS_MIN}
                  max={PROGRESS_MAX}
                  value={form.progress_pct}
                  onChange={(e) => setProgress(Number(e.target.value) || 0)}
                  aria-label="Progress percent"
                  className={`${CONTROL_BASE} w-20 shrink-0 text-center tabular-nums`}
                />
              </div>
            </Field>
          </Section>

          <Section title="Schedule">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Planned start" htmlFor={fid('ps')}>
                <input id={fid('ps')} type="date" value={form.planned_start} onChange={(e) => setForm({ ...form, planned_start: e.target.value })} className={CONTROL_CLS} />
              </Field>
              <Field label="Planned end" htmlFor={fid('pe')}>
                <input id={fid('pe')} type="date" value={form.planned_end} onChange={(e) => setForm({ ...form, planned_end: e.target.value })} className={CONTROL_CLS} />
              </Field>
              <Field label="Due date" htmlFor={fid('due')}>
                <input id={fid('due')} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={CONTROL_CLS} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Actual start" htmlFor={fid('as')}>
                <input id={fid('as')} type="date" value={form.actual_start} onChange={(e) => setForm({ ...form, actual_start: e.target.value })} className={CONTROL_CLS} />
              </Field>
              <Field label="Actual end" htmlFor={fid('ae')}>
                <input id={fid('ae')} type="date" value={form.actual_end} onChange={(e) => setForm({ ...form, actual_end: e.target.value })} className={CONTROL_CLS} />
              </Field>
            </div>
          </Section>

          <Section title="Notes">
            <Field label="Constraint note" htmlFor={fid('constraint')} hint="What is blocking this task, if anything.">
              <input
                id={fid('constraint')}
                value={form.constraint_note}
                onChange={(e) => setForm({ ...form, constraint_note: e.target.value })}
                className={CONTROL_CLS}
                placeholder="e.g. Chờ vật tư"
              />
            </Field>
            <Field label="Notes" htmlFor={fid('notes')}>
              <textarea
                id={fid('notes')}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={`${CONTROL_CLS} resize-y leading-relaxed`}
                rows={NOTES_ROWS}
              />
            </Field>
          </Section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={deleteTask}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={15} /> Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Save changes
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
