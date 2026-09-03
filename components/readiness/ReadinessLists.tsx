import Link from 'next/link';
import { AlertTriangle, CalendarDays, ClipboardList } from 'lucide-react';
import { dayDiff, type ReadinessTask, type UnscheduledGroup } from '@/lib/readiness';

/** Titles run up to 280 characters, so every list clamps rather than truncates. */
const CLAMP = 'line-clamp-2 break-words';

function Panel({
  title,
  subtitle,
  icon,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl shadow-sm flex flex-col">
      <header className="px-4 py-3 border-b border-slate-100 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-sm text-blue-600 hover:underline shrink-0">
            {hrefLabel ?? 'View all'} →
          </Link>
        )}
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500 py-4 text-center">{children}</p>;
}

/**
 * Work committed to the next fortnight.
 *
 * The old widget had no lower date bound, so ascending sort put the six most
 * overdue rows on the dashboard — items 125 to 215 days late — and hid every
 * task actually due. lib/readiness.ts::lookAhead bounds both ends.
 */
export function LookAheadList({
  tasks,
  today,
  horizonDays = 14,
  limit = 8,
}: {
  tasks: ReadinessTask[];
  today: string;
  horizonDays?: number;
  limit?: number;
}) {
  return (
    <Panel
      title="Next 14 days"
      subtitle="Công việc đã cam kết · committed work only"
      icon={<CalendarDays size={16} className="text-slate-400" />}
      href="/tasks"
      hrefLabel="Task board"
    >
      {tasks.length === 0 ? (
        <Empty>
          Nothing is scheduled in the next {horizonDays} days. With an opening date this close, that
          is the finding — not an empty list.
        </Empty>
      ) : (
        <>
          <ul className="space-y-3">
            {tasks.slice(0, limit).map((t) => {
              const d = t.due_date ? dayDiff(today, t.due_date) : null;
              return (
                <li key={t.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      d != null && d <= 3 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${CLAMP}`}>{t.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.phase || '—'} · {t.owner || 'unassigned'}
                    </p>
                    <p className="text-xs text-slate-600 tabular-nums mt-0.5">
                      {t.due_date}
                      {d != null && (
                        <span className="text-slate-400"> · {d === 0 ? 'today' : `in ${d}d`}</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {tasks.length > limit && (
            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
              +{tasks.length - limit} more due in this window
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

/**
 * Undated open rows, by department.
 *
 * Gates appear here as a queue to commit dates to, not as a backlog of
 * failures: an acceptance criterion is meant to be undated until someone
 * commits. Undated *work* is the genuine data gap, so it is called out
 * separately.
 */
export function UnscheduledQueue({
  groups,
  limit = 8,
}: {
  groups: UnscheduledGroup[];
  limit?: number;
}) {
  const totalGates = groups.reduce((s, g) => s + g.gates, 0);
  const totalWork = groups.reduce((s, g) => s + g.work, 0);

  return (
    <Panel
      title="Needs a date"
      subtitle="Chưa có mốc thời gian"
      icon={<ClipboardList size={16} className="text-slate-400" />}
    >
      {groups.length === 0 ? (
        <Empty>Everything open carries a date.</Empty>
      ) : (
        <>
          <p className="text-sm text-slate-600 mb-3">
            <span className="tabular-nums font-medium">{totalGates}</span> readiness gates and{' '}
            <span className="tabular-nums font-medium">{totalWork}</span> work items have no date.
          </p>
          <ul className="space-y-2">
            {groups.slice(0, limit).map((g) => (
              <li
                key={g.department}
                className="flex items-baseline justify-between gap-3 text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0"
              >
                <span className="min-w-0 truncate">{g.department}</span>
                <span className="text-xs text-slate-500 tabular-nums shrink-0">
                  {g.gates > 0 && <>{g.gates} gates</>}
                  {g.gates > 0 && g.work > 0 && ' · '}
                  {g.work > 0 && <span className="text-amber-600">{g.work} work</span>}
                </span>
              </li>
            ))}
          </ul>
          {groups.length > limit && (
            <p className="text-xs text-slate-500 mt-3">+{groups.length - limit} more departments</p>
          )}
        </>
      )}
    </Panel>
  );
}

/** Declared constraints — few enough to list in full, which is why this works. */
export function BlockerList({ tasks }: { tasks: ReadinessTask[] }) {
  return (
    <Panel
      title="Blockers"
      subtitle="Ràng buộc đã ghi nhận"
      icon={<AlertTriangle size={16} className="text-amber-500" />}
    >
      {tasks.length === 0 ? (
        <Empty>No constraints recorded.</Empty>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id} className="border-l-2 border-amber-400 pl-3">
              <p className={`text-sm font-medium ${CLAMP}`}>{t.title}</p>
              <p className="text-sm text-amber-700 mt-0.5 break-words">{t.constraint_note}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.phase || '—'} · {t.owner || 'unassigned'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
