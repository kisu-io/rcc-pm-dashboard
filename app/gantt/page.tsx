import { getTasks, getProjects } from '@/lib/data-server';
import { monthGrid, todayISO } from '@/lib/readiness';
import GanttView from '@/components/GanttView';
import MonthGrid from '@/components/MonthGrid';

export const dynamic = 'force-dynamic';

/**
 * Schedule view, chosen by what the data can actually support.
 *
 * A Gantt needs a start date per task. On this programme `planned_start` is
 * null on all 679 rows, so GanttView filtered every one of them out and the
 * route rendered only its "No tasks with planned dates" card — the toolbar,
 * the seven stat tiles and the critical-path toggle never appeared at all.
 * (`depends_on` is also empty on every row, so there is no critical path to
 * compute even if start dates arrived.)
 *
 * So: draw the Gantt when there are real start dates, and otherwise draw the
 * department × month grid, which is the shape this dataset genuinely has. When
 * someone backfills `planned_start`, the Gantt returns on its own.
 */
export default async function SchedulePage() {
  const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);

  const canDrawGantt = tasks.some((t) => t.planned_start && t.planned_end);
  const today = todayISO();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Schedule</h1>
        <p className="text-sm text-slate-500">
          {canDrawGantt
            ? 'Gantt timeline · phase bars with critical-path highlight'
            : 'Tiến độ theo tháng · month buckets, because no task carries a start date'}
        </p>
      </div>

      {canDrawGantt ? (
        <GanttView tasks={tasks} projects={projects} />
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-medium">Showing month buckets, not a Gantt.</p>
            <p className="mt-1 text-amber-700">
              No task in this programme has a{' '}
              <code className="px-1 bg-amber-100 rounded">planned_start</code>, and none declares a
              dependency — so there are no bars to draw and no critical path to compute. Backfill
              start dates and the Gantt appears here automatically.
            </p>
          </div>
          {/* One grid per programme. Pooling them would fold every project's
              "Engineering" into a single row against a shared month axis, and
              those months only line up by accident — each project runs to its
              own opening date. */}
          {projects.length > 1 ? (
            projects.map((p) => (
              <section key={p.id} className="space-y-2">
                <h2 className="text-base font-semibold">{p.name}</h2>
                <MonthGrid
                  grid={monthGrid(
                    tasks.filter((t) => t.project_id === p.id),
                    today,
                  )}
                  currentMonth={today.slice(0, 7)}
                />
              </section>
            ))
          ) : (
            <MonthGrid grid={monthGrid(tasks, today)} currentMonth={today.slice(0, 7)} />
          )}
        </>
      )}
    </div>
  );
}
