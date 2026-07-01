import { getTasks, getProjects } from '@/lib/data-server';
import GanttView from '@/components/GanttView';

export const dynamic = 'force-dynamic';

export default async function GanttPage() {
  const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Gantt</h1>
        <p className="text-xs md:text-sm text-slate-500">Phase timeline with dependencies + critical path highlight</p>
      </div>
      <GanttView tasks={tasks} projects={projects} />
    </div>
  );
}