import { getTasks, getProjects } from '@/lib/data-server';
import KanbanBoard from '@/components/KanbanBoard';
import AddTaskModal from '@/components/AddTaskModal';
import EditGuard from '@/components/EditGuard';
import TaskFilters from '@/components/TaskFilters';
import { Task, Project } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);
  const projMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Tasks — Kanban</h1>
          <p className="text-xs md:text-sm text-slate-500">Kéo-thả task giữa các cột để cập nhật trạng thái</p>
        </div>
        <EditGuard><AddTaskModal projects={projects} /></EditGuard>
      </div>
      <TaskFiltersServer tasks={tasks} projects={projects} projMap={projMap} />
    </div>
  );
}

function TaskFiltersServer({
  tasks, projects, projMap,
}: { tasks: Task[]; projects: Project[]; projMap: Record<string, string> }) {
  return <TaskFilters initialTasks={tasks} projects={projects} projMap={projMap} />;
}