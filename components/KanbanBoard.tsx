'use client';
import { useState } from 'react';
import {
  DndContext, DragEndEvent, useDroppable, useDraggable, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { Task, supabase } from '@/lib/supabase';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];
const COL_COLOR: Record<string, string> = {
  'To Do': '#94a3b8',
  'In Progress': '#2563eb',
  'Review': '#a855f7',
  'Done': '#22c55e',
};
const PRIO_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

function Card({ task, projName }: { task: Task; projName: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{projName}</span>
        <span className="text-[10px] font-bold" style={{ color: PRIO_COLOR[task.priority] }}>{task.priority}</span>
      </div>
      <div className="text-sm font-medium">{task.title}</div>
      <div className="text-xs text-slate-400 mt-1">{task.owner} · {task.zone}</div>
      {task.constraint_note && (
        <div className="text-[10px] text-amber-600 mt-1">⚠ {task.constraint_note}</div>
      )}
      <div className="mt-2 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${task.progress_pct}%`, background: COL_COLOR[task.kanban_status] }} />
      </div>
      <div className="text-[10px] text-slate-400 mt-1">Due: {task.due_date || '—'}</div>
    </div>
  );
}

function Column({ status, tasks, projMap }: { status: string; tasks: Task[]; projMap: Record<string, string> }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex-1 min-w-[240px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COL_COLOR[status] }} />
        <h3 className="font-semibold text-sm">{status}</h3>
        <span className="text-xs text-slate-400">({tasks.length})</span>
      </div>
      <div ref={setNodeRef} className={`space-y-3 min-h-[200px] rounded-xl p-2 transition ${isOver ? 'bg-blue-50' : 'bg-slate-100/50'}`}>
        {tasks.map((t) => <Card key={t.id} task={t} projName={projMap[t.project_id] || '—'} />)}
      </div>
    </div>
  );
}

export default function KanbanBoard({ initialTasks, projMap }: { initialTasks: Task[]; projMap: Record<string, string> }) {
  const [tasks, setTasks] = useState(initialTasks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as string;
    if (!COLUMNS.includes(newStatus)) return;
    setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, kanban_status: newStatus } : t)));
    // Persist to Supabase (no-op nếu chưa có key)
    try {
      await supabase.from('tasks').update({ kanban_status: newStatus }).eq('id', active.id);
    } catch {}
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.kanban_status === status)}
            projMap={projMap}
          />
        ))}
      </div>
    </DndContext>
  );
}
