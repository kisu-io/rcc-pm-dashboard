'use client';
import { useState, useEffect } from 'react';
import {
  DndContext, DragEndEvent, useDroppable, useDraggable,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { Task, Project, supabase } from '@/lib/supabase';
import TaskEditModal from './TaskEditModal';
import { phaseColor, priorityColor, formatDate, statusColor } from '@/lib/schedule-utils';
import { AlertTriangle, Clock, User, MapPin } from 'lucide-react';
import { checkWrite } from '@/lib/writes';
import { useCanEdit } from '@/lib/useRole';

/** Every column the board can show, in order. */
const ALL_COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

/** Columns that always appear, because you must be able to drag into them. */
const REQUIRED_COLUMNS = new Set(['To Do', 'In Progress', 'Done']);

/**
 * Cards rendered per column before a "show more" button.
 *
 * Every card registers a dnd-kit draggable, so an unbounded column of 602 of
 * them meant 602 hook registrations and 602 card subtrees on first paint — on
 * a phone, on site. Dragging needs a visible target, not the whole backlog, so
 * the column renders a window and grows on request.
 */
const CARDS_PER_PAGE = 40;

/**
 * Column count → grid class, spelled out because Tailwind scans source text and
 * would purge an interpolated `md:grid-cols-${n}`.
 *
 * The board is a grid rather than a scrolling flex track: every column shares
 * the width and shrinks to fit, so the whole board is visible at once. It used
 * to be `flex overflow-x-auto` with `shrink-0` wrappers over a
 * `min-w-[80vw]/300px/260px` floor, which guaranteed it was wider than the
 * viewport and had to be scrolled sideways — on a phone *and* on a 1440px
 * desktop. Below `md` the columns stack vertically, since four readable
 * columns do not fit on a 390px screen and sideways swiping is what we are
 * removing.
 */
const COLUMN_GRID: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

function Card({ task, projName, projects, onEdit, onSaved }: {
  task: Task;
  projName: string;
  projects: Project[];
  onEdit: (t: Task) => void;
  onSaved?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1, touchAction: 'none' as const, borderLeft: `4px solid ${phaseColor(task.phase)}` }
    : { touchAction: 'none' as const, borderLeft: `4px solid ${phaseColor(task.phase)}` };

  const phColor = phaseColor(task.phase);
  const colColor = statusColor(task.kanban_status);
  const pColor = priorityColor(task.priority);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onDoubleClick={() => onEdit(task)}
        className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing select-none hover:shadow-md transition group"
        title="Double-click to edit"
      >
        {/* Top row: phase + priority + badges */}
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="text-xs px-2 py-0.5 rounded-full truncate text-white font-medium"
              style={{ background: phColor }}
            >
              {task.phase || '—'}
            </span>
          </div>
          <span className="text-xs font-semibold shrink-0" style={{ color: pColor }}>
            {task.priority}
          </span>
        </div>

        {/* Title */}
        <div className="text-sm font-medium break-words leading-snug">{task.title}</div>

        {/* Owner + section */}
        <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="flex items-center gap-1">
            <User size={12} className="text-slate-400" /> {task.owner || 'unassigned'}
          </span>
          {task.zone && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{task.zone}</span>
            </span>
          )}
        </div>

        {/* Due date. Leads with the date that exists: planned_start is null on
            every row in this programme, so the old "start → end" line rendered
            as "— → 01 Aug 2026" on all 679 cards. */}
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
          <Clock size={12} className="text-slate-400" />
          {task.due_date ? (
            <span className="tabular-nums">Due {formatDate(task.due_date)}</span>
          ) : (
            <span className="text-slate-400">No date</span>
          )}
          {task.planned_start && task.planned_end && (
            <span className="text-slate-400 tabular-nums">
              · {formatDate(task.planned_start)} → {formatDate(task.planned_end)}
            </span>
          )}
        </div>

        {/* Constraint */}
        {task.constraint_note && (
          <div className="text-xs text-amber-700 mt-1.5 break-words flex items-start gap-1">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {task.constraint_note}
          </div>
        )}

        {/* Notes */}
        {task.notes && (
          <div className="text-xs text-slate-500 mt-1.5 break-words line-clamp-2">
            {task.notes}
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${task.progress_pct}%`, background: colColor }} />
        </div>

      </div>
    </>
  );
}

function Column({ status, tasks, projMap, projects, onEdit, onSaved }: {
  status: string;
  tasks: Task[];
  projMap: Record<string, string>;
  projects: Project[];
  onEdit: (t: Task) => void;
  onSaved?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [shown, setShown] = useState(CARDS_PER_PAGE);
  const colColor = statusColor(status);

  // Reset the window when the filtered set changes, so a narrow filter does not
  // leave a stale "show more" count behind.
  useEffect(() => { setShown(CARDS_PER_PAGE); }, [tasks.length]);

  // Overdue is the number worth showing here. The old header showed
  // "avg {n}%", but progress_pct is an exact copy of kanban_status on every
  // row, so it read 0% / 50% / 100% by definition — a restatement of the
  // column's own name.
  const overdue = tasks.filter(
    (t) => t.kanban_status !== 'Done' && !!t.due_date && t.due_date < todayStr(),
  ).length;

  const visible = tasks.slice(0, shown);

  return (
    /* min-w-0 is load-bearing: a grid child defaults to min-width:auto, so it
       refuses to shrink below its content and pushes the board past the
       viewport. That, plus the old shrink-0 wrapper and a min-w floor, is what
       forced the whole board to scroll sideways. */
    <div className="min-w-0">
      <div className="flex items-center gap-x-2 gap-y-1 mb-3 flex-wrap">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: colColor }}
        />
        <h3 className="font-semibold text-sm truncate">{status}</h3>
        <span className="text-sm text-slate-500 tabular-nums">{tasks.length}</span>
        {overdue > 0 && (
          <span className="text-xs font-medium text-red-700 bg-red-50 rounded px-1.5 py-0.5 ml-auto tabular-nums">
            {overdue} overdue
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-3 min-h-[200px] rounded-xl p-2 transition ${
          isOver ? 'bg-blue-50' : 'bg-slate-100/50'
        }`}
      >
        {visible.map((t) => (
          <Card
            key={t.id}
            task={t}
            projName={projMap[t.project_id] || '—'}
            projects={projects}
            onEdit={onEdit}
            onSaved={onSaved}
          />
        ))}
        {tasks.length > shown && (
          <button
            type="button"
            onClick={() => setShown((n) => n + CARDS_PER_PAGE)}
            className="w-full text-sm font-medium text-blue-700 bg-white border border-slate-200 rounded-lg py-2.5 hover:bg-blue-50"
          >
            Show {Math.min(CARDS_PER_PAGE, tasks.length - shown)} more
            <span className="text-slate-500 font-normal"> · {tasks.length - shown} left</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Local ISO day, for comparing against a date-only `due_date` string. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function KanbanBoard({ initialTasks, projMap, projects = [] }: {
  initialTasks: Task[];
  projMap: Record<string, string>;
  projects?: Project[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const canEdit = useCanEdit();

  // Sync when parent passes new filtered tasks (filters changed)
  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  /**
   * Show a column only if it is one you can drag into, or something is in it.
   *
   * "Review" is a status no row in this programme uses, so it rendered as a
   * permanently empty fourth column — a quarter of the board's width, and a
   * quarter of the horizontal swipe on a phone, spent on nothing.
   */
  const columns = ALL_COLUMNS.filter(
    (c) => REQUIRED_COLUMNS.has(c) || tasks.some((t) => t.kanban_status === c),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as string;
    if (!ALL_COLUMNS.includes(newStatus)) return;

    const moved = tasks.find((t) => t.id === active.id);
    if (!moved || moved.kanban_status === newStatus) return;
    const previousStatus = moved.kanban_status;

    setDragError(null);
    setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, kanban_status: newStatus } : t)));

    // An RLS-filtered UPDATE returns no error and zero rows, so ask for the row
    // back: without this a read-only user sees the card move and never learns
    // the change was discarded.
    let result;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ kanban_status: newStatus })
        .eq('id', active.id)
        .select('id');
      result = checkWrite(error, data, 1);
    } catch (err) {
      result = { ok: false as const, message: err instanceof Error ? err.message : 'Không lưu được thay đổi.' };
    }

    if (!result.ok) {
      setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, kanban_status: previousStatus } : t)));
      setDragError(`"${moved.title}" — ${result.message}`);
    }
  }

  function onSaved() {
    if (editing) {
      window.location.reload();
    }
  }

  return (
    <>
      {dragError && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{dragError}</span>
          <button type="button" onClick={() => setDragError(null)} className="font-medium underline">Đóng</button>
        </div>
      )}
      <DndContext sensors={canEdit ? sensors : undefined} onDragEnd={onDragEnd}>
        <div className={`grid gap-3 md:gap-4 pb-4 grid-cols-1 ${COLUMN_GRID[columns.length] ?? 'md:grid-cols-4'}`}>
          {columns.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.kanban_status === status)}
              projMap={projMap}
              projects={projects}
              onEdit={setEditing}
              onSaved={onSaved}
            />
          ))}
        </div>
      </DndContext>

      {editing && (
        <TaskEditModal
          task={editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}