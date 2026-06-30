import { getProjects, getTasks } from '@/lib/data';
import ProjectCard from '@/components/ProjectCard';
import ProjectsFilters from '@/components/ProjectsFilters';
import AddProjectButton from '@/components/AddProjectButton';
import { FolderKanban } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);

  // Stats summary
  const total = projects.length;
  const inProgress = projects.filter((p) => p.status === 'In Progress').length;
  const onHold = projects.filter((p) => p.status === 'On Hold').length;
  const complete = projects.filter((p) => p.status === 'Complete').length;

  // Build task count map
  const taskCount: Record<string, number> = {};
  for (const t of tasks) {
    taskCount[t.project_id] = (taskCount[t.project_id] || 0) + 1;
  }

  // Pass serializable data to client filter component
  const projectsWithTasks = projects.map((p) => ({
    ...p,
    task_count: taskCount[p.id] || 0,
  }));

  const statuses = Array.from(new Set(projects.map((p) => p.status)));
  const pms = Array.from(new Set(projects.map((p) => p.pm).filter(Boolean))) as string[];
  const locations = Array.from(new Set(projects.map((p) => p.location).filter(Boolean))) as string[];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Projects</h1>
          <p className="text-xs md:text-sm text-slate-500">
            {total} projects · {inProgress} in progress · {onHold} on hold · {complete} complete
          </p>
        </div>
        <AddProjectButton />
      </div>

      <ProjectsFilters
        projects={projectsWithTasks}
        statuses={statuses}
        pms={pms}
        locations={locations}
      />

      {total === 0 && (
        <div className="bg-white rounded-xl p-10 text-center text-slate-400 shadow-sm">
          <FolderKanban size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Chưa có project nào. Thêm qua Supabase hoặc CSV import.</p>
        </div>
      )}
    </div>
  );
}