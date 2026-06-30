import { getTasks, getProjects } from '@/lib/data';
import KanbanBoard from '@/components/KanbanBoard';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);
  const projMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Tasks — Kanban</h1>
        <p className="text-xs md:text-sm text-slate-500">Kéo-thả task giữa các cột để cập nhật trạng thái</p>
      </div>
      <KanbanBoard initialTasks={tasks} projMap={projMap} />
    </div>
  );
}
