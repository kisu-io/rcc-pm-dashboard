'use client';
import { useState, useMemo } from 'react';
import { Task, Milestone } from '@/lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PRIO_DOT: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const MS_DOT = '#a855f7';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarView({ tasks, milestones }: { tasks: Task[]; milestones: Milestone[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(ymd(today));

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build task/milestone map by due_date
  const taskMap = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.due_date) (m[t.due_date] ||= []).push(t);
    }
    return m;
  }, [tasks]);
  const msMap = useMemo(() => {
    const m: Record<string, Milestone[]> = {};
    for (const ms of milestones) {
      if (ms.due_date) (m[ms.due_date] ||= []).push(ms);
    }
    return m;
  }, [milestones]);

  // Build calendar grid (6 weeks)
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startDay = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startDay);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const selectedTasks = selected ? (taskMap[selected] || []) : [];
  const selectedMs = selected ? (msMap[selected] || []) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 md:p-4 shadow-sm">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="p-2 rounded-lg hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-sm md:text-lg font-semibold">{monthLabel}</h2>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="p-2 rounded-lg hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar grid */}
        <div className="bg-white rounded-xl p-2 md:p-4 shadow-sm lg:col-span-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WD.map((w) => (
              <div key={w} className="text-[10px] md:text-xs text-slate-400 text-center font-medium py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = key === ymd(today);
              const isSelected = key === selected;
              const dayTasks = taskMap[key] || [];
              const dayMs = msMap[key] || [];
              const hasEvents = dayTasks.length + dayMs.length > 0;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={`aspect-square rounded-lg text-[10px] md:text-xs flex flex-col items-center justify-start p-1 md:p-1.5 border transition
                    ${inMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'}
                    ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-slate-100'}
                    ${isToday ? 'bg-blue-50' : ''}`}
                >
                  <span className={`font-medium ${isToday ? 'text-blue-700' : ''}`}>{d.getDate()}</span>
                  {hasEvents && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                      {dayTasks.slice(0, 4).map((t) => (
                        <span key={t.id} className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO_DOT[t.priority] || '#94a3b8' }} />
                      ))}
                      {dayMs.slice(0, 2).map((m) => (
                        <span key={m.id} className="w-1.5 h-1.5 rounded-full" style={{ background: MS_DOT }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day panel */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">
            {selected ? new Date(selected).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Select a day'}
          </h3>
          {selectedTasks.length === 0 && selectedMs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No events this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedMs.map((m) => (
                <div key={m.id} className="border-l-2 pl-2 py-1" style={{ borderColor: MS_DOT }}>
                  <div className="text-xs font-medium">{m.name}</div>
                  <div className="text-[10px] text-slate-500">Milestone · {m.status} · {m.type || '—'}</div>
                </div>
              ))}
              {selectedTasks.map((t) => (
                <div key={t.id} className="border-l-2 pl-2 py-1" style={{ borderColor: PRIO_DOT[t.priority] || '#94a3b8' }}>
                  <div className="text-xs font-medium">{t.title}</div>
                  <div className="text-[10px] text-slate-500">
                    {t.owner || '—'} · {t.kanban_status} · {t.priority}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex flex-wrap gap-3">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO_DOT.High }} /> High</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO_DOT.Medium }} /> Med</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO_DOT.Low }} /> Low</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: MS_DOT }} /> Milestone</span>
          </div>
        </div>
      </div>
    </div>
  );
}