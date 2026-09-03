'use client';
import { useState, useEffect } from 'react';
import {
  DndContext, DragEndEvent, useDroppable, useDraggable,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { Task, Project, supabase } from '@/lib/supabase';
import TaskEditModal from './TaskEditModal';
import {
  ScheduleTask, phaseColor, priorityColor, isMilestone, isExpress,
  formatDate, daysBetween, barColor,
  MILESTONE_COLOR, EXPRESS_COLOR,
} from '@/lib/schedule-utils';
import { Flag, Zap, AlertTriangle, Clock, User, MapPin } from 'lucide-react';
import { checkWrite } from '@/lib/writes';
import { useCanEdit } from '@/lib/useRole';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];
const COL_COLOR: Record<string, string> = {
  'To Do': '#94a3b8',
  'In Progress': '#2563eb',
  'Review': '#a855f7',
  'Done': '#22c55e',
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

  const ms = isMilestone(task as ScheduleTask);
  const ex = isExpress(task as ScheduleTask);
  const phColor = phaseColor(task.phase);
  const dur = daysBetween(task.planned_start, task.planned_end);
  const colColor = COL_COLOR[task.kanban_status] || '#94a3b8';
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
              className="text-[9px] px-1.5 py-0.5 rounded-full truncate text-white font-medium"
              style={{ background: phColor }}
            >
              {task.phase || '—'}
            </span>
            {ms && (
              <span className="text-[9px] px-1 py-0.5 rounded-full text-white font-bold flex items-center gap-0.5" style={{ background: MILESTONE_COLOR }}>
                <Flag size={8} /> MS
              </span>
            )}
            {ex && !ms && (
              <span className="text-[9px] px-1 py-0.5 rounded-full text-white font-bold flex items-center gap-0.5" style={{ background: EXPRESS_COLOR }}>
                <Zap size={8} /> EX
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold shrink-0" style={{ color: pColor }}>{task.priority}</span>
        </div>

        {/* Title */}
        <div className="text-sm font-medium break-words leading-snug">{task.title}</div>

        {/* Owner + zone */}
        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
          <span className="flex items-center gap-0.5">
            <User size={10} className="text-slate-400" /> {task.owner || '—'}
          </span>
          {task.zone && (
            <span className="flex items-center gap-0.5">
              <MapPin size={10} className="text-slate-400" /> {task.zone}
            </span>
          )}
        </div>

        {/* Dates + duration */}
        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 flex-wrap">
          <Clock size={10} className="text-slate-400" />
          <span>{formatDate(task.planned_start)} → {formatDate(task.planned_end)}</span>
          {dur && <span className="text-slate-500 font-medium">· {dur}d</span>}
        </div>

        {/* Constraint / predecessors */}
        {task.constraint_note && (
          <div className="text-[10px] text-amber-600 mt-1 break-words flex items-center gap-0.5">
            <AlertTriangle size={9} /> Pred: {task.constraint_note}
          </div>
        )}

        {/* Notes (truncated) */}
        {task.notes && (
          <div className="text-[10px] text-slate-500 mt-1 break-words italic line-clamp-2">
            {task.notes}
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${task.progress_pct}%`, background: colColor }} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
          <span className="truncate">{projName}</span>
          <span className={task.due_date ? 'font-medium text-slate-500' : ''}>
            Due: {formatDate(task.due_date)}
          </span>
        </div>
      </div>
      <EditOpener task={task} projects={projects} onEdit={onEdit} onSaved={onSaved} />
    </>
  );
}

function EditOpener({ task, projects, onEdit, onSaved }: {
  task: Task; projects: Project[]; onEdit: (t: Task) => void; onSaved?: () => void;
}) {
  return null;
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
  const colColor = COL_COLOR[status] || '#94a3b8';
  // Column stats
  const msCount = tasks.filter((t) => isMilestone(t as ScheduleTask)).length;
  const exCount = tasks.filter((t) => isExpress(t as ScheduleTask) && !isMilestone(t as ScheduleTask)).length;
  const avgProgress = tasks.length > 0
    ? Math.round(tasks.reduce((s, t) => s + (t.progress_pct || 0), 0) / tasks.length)
    : 0;
  return (
    <div className="flex-1 min-w-[72vw] sm:min-w-[280px] md:min-w-[240px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: colColor }} />
        <h3 className="font-semibold text-sm">{status}</h3>
        <span className="text-xs text-slate-400">({tasks.length})</span>
        {msCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium flex items-center gap-0.5" style={{ background: MILESTONE_COLOR }}>
            <Flag size={8} /> {msCount}
          </span>
        )}
        {exCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium flex items-center gap-0.5" style={{ background: EXPRESS_COLOR }}>
            <Zap size={8} /> {exCount}
          </span>
        )}
        {tasks.length > 0 && (
          <span className="text-[9px] text-slate-400 ml-auto">avg {avgProgress}%</span>
        )}
      </div>
      <div ref={setNodeRef} className={`space-y-3 min-h-[200px] rounded-xl p-2 transition ${isOver ? 'bg-blue-50' : 'bg-slate-100/50'}`}>
        {tasks.map((t) => (
          <Card
            key={t.id}
            task={t}
            projName={projMap[t.project_id] || '—'}
            projects={projects}
            onEdit={onEdit}
            onSaved={onSaved}
          />
        ))}
      </div>
    </div>
  );
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as string;
    if (!COLUMNS.includes(newStatus)) return;

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
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
          {COLUMNS.map((status) => (
            <div key={status} className="snap-start shrink-0">
              <Column
                status={status}
                tasks={tasks.filter((t) => t.kanban_status === status)}
                projMap={projMap}
                projects={projects}
                onEdit={setEditing}
                onSaved={onSaved}
              />
            </div>
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