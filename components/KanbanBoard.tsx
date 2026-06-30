'use client';
import { useState } from 'react';
import {
  DndContext, DragEndEvent, useDroppable, useDraggable,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { Task, Project, supabase } from '@/lib/supabase';
import TaskEditModal from './TaskEditModal';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];
const COL_COLOR: Record<string, string> = {
  'To Do': '#94a3b8',
  'In Progress': '#2563eb',
  'Review': '#a855f7',
  'Done': '#22c55e',
};
const PRIO_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

function Card({ task, projName, projects, onEdit, onSaved }: {
  task: Task;
  projName: string;
  projects: Project[];
  onEdit: (t: Task) => void;
  onSaved?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1, touchAction: 'none' as const }
    : { touchAction: 'none' as const };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onDoubleClick={() => onEdit(task)}
        className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing select-none hover:ring-1 hover:ring-blue-500/30 transition"
        title="Double-click to edit"
      >
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 truncate min-w-0">{projName}</span>
          <span className="text-[10px] font-bold shrink-0" style={{ color: PRIO_COLOR[task.priority] }}>{task.priority}</span>
        </div>
        <div className="text-sm font-medium break-words">{task.title}</div>
        <div className="text-xs text-slate-400 mt-1 break-words">{task.owner} · {task.zone}</div>
        {task.constraint_note && (
          <div className="text-[10px] text-amber-600 mt-1 break-words">⚠ {task.constraint_note}</div>
        )}
        <div className="mt-2 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full" style={{ width: `${task.progress_pct}%`, background: COL_COLOR[task.kanban_status] }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
          <span>Due: {task.due_date || '—'}</span>
          <span className="text-blue-500 opacity-0 group-hover:opacity-100">edit →</span>
        </div>
      </div>
      <EditOpener task={task} projects={projects} onEdit={onEdit} onSaved={onSaved} />
    </>
  );
}

// Separate component to manage modal state per card
function EditOpener({ task, projects, onEdit, onSaved }: {
  task: Task; projects: Project[]; onEdit: (t: Task) => void; onSaved?: () => void;
}) {
  return null; // modal rendered by parent
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
  return (
    <div className="flex-1 min-w-[72vw] sm:min-w-[280px] md:min-w-[240px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COL_COLOR[status] }} />
        <h3 className="font-semibold text-sm">{status}</h3>
        <span className="text-xs text-slate-400">({tasks.length})</span>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as string;
    if (!COLUMNS.includes(newStatus)) return;
    setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, kanban_status: newStatus } : t)));
    try {
      await supabase.from('tasks').update({ kanban_status: newStatus }).eq('id', active.id);
    } catch {}
  }

  function onSaved() {
    if (editing) {
      // refresh: simplest is to reload
      window.location.reload();
    }
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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