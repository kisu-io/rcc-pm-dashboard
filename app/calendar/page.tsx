import { getTasks, getMilestones } from '@/lib/data';
import CalendarView from '@/components/CalendarView';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const [tasks, milestones] = await Promise.all([getTasks(), getMilestones()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Calendar</h1>
        <p className="text-xs md:text-sm text-slate-500">Tasks & milestones by due date</p>
      </div>
      <CalendarView tasks={tasks} milestones={milestones} />
    </div>
  );
}