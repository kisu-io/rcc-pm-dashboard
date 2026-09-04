import Link from 'next/link';
import type { DepartmentReadiness } from '@/lib/readiness';
import { READINESS_STATUS } from '@/lib/ui';

/**
 * The chase list: every department, worst position first.
 *
 * This replaces the KPI strip, the S-curve and the five phase bars. Those
 * answered "how complete is the portfolio" for a portfolio of one, using a
 * residential-development phase taxonomy that routed 629 of 679 tasks into a
 * single bucket. The programme's real axis is the operating department.
 */

function Bar({
  segments,
  total,
}: {
  segments: { width: number; className: string; label: string }[];
  total: number;
}) {
  if (total <= 0) return null;
  return (
    <div className="h-2 w-full flex rounded-sm bg-slate-100 overflow-hidden" aria-hidden="true">
      {segments.map((s) =>
        s.width > 0 ? (
          <div
            key={s.label}
            className={s.className}
            style={{ width: `${(s.width / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

function GatesCell({ row }: { row: DepartmentReadiness }) {
  if (row.gates === 0) {
    return <span className="text-xs text-slate-400">No gates defined</span>;
  }
  return (
    <div>
      <Bar
        total={row.gates}
        segments={[{ width: row.gatesMet, className: 'bg-green-500', label: 'met' }]}
      />
      <span className="text-xs text-slate-500 tabular-nums mt-1 block">
        {row.gatesMet} / {row.gates} met
      </span>
    </div>
  );
}

function WorkCell({ row }: { row: DepartmentReadiness }) {
  if (row.workOpen === 0) {
    return (
      <span className="text-xs text-slate-400">
        {row.workTotal === 0 ? 'No work scheduled' : 'All work closed'}
      </span>
    );
  }
  const onTime = row.workOpen - row.workOverdue;
  return (
    <div>
      <Bar
        total={row.workOpen}
        segments={[
          { width: row.workOverdue, className: 'bg-red-500', label: 'overdue' },
          { width: onTime, className: 'bg-amber-400', label: 'open' },
        ]}
      />
      <span className="text-xs text-slate-500 tabular-nums mt-1 block">
        {row.workOverdue > 0 ? (
          <>
            <span className="text-red-600 font-medium">{row.workOverdue} overdue</span> /{' '}
            {row.workOpen}
          </>
        ) : (
          <>{row.workOpen} open</>
        )}
      </span>
    </div>
  );
}

function StatusChip({ row }: { row: DepartmentReadiness }) {
  const s = READINESS_STATUS[row.status];
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${s.chip}`}
      title={s.meaning}
    >
      {s.label}
    </span>
  );
}

export default function DepartmentLedger({ rows }: { rows: DepartmentReadiness[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center text-sm text-slate-500">
        No departments found. Tasks need a <code className="px-1 bg-slate-100 rounded">phase</code>{' '}
        value to group by.
      </div>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Departments not clear to open</h2>
          <p className="text-xs text-slate-500">
            Các bộ phận chưa sẵn sàng · worst position first
          </p>
        </div>
        <Link href="/tasks" className="text-sm text-blue-600 hover:underline">
          Open task board →
        </Link>
      </header>

      {/* Desktop: aligned table, scrolling inside its own container. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[840px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="font-medium px-4 py-2">Department</th>
              <th className="font-medium px-4 py-2">Status</th>
              <th className="font-medium px-4 py-2 w-[150px]">Opening gates</th>
              <th className="font-medium px-4 py-2 w-[190px]">Open work</th>
              <th className="font-medium px-4 py-2 text-right">In progress</th>
              <th className="font-medium px-4 py-2 text-right">Owners</th>
              <th className="font-medium px-4 py-2 text-right">Undated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.department} className="border-t border-slate-100 align-middle">
                <td className="px-4 py-3 font-medium">{row.department}</td>
                <td className="px-4 py-3">
                  <StatusChip row={row} />
                </td>
                <td className="px-4 py-3">
                  <GatesCell row={row} />
                </td>
                <td className="px-4 py-3">
                  <WorkCell row={row} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {row.workWip || '—'}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    row.owners.length === 0 ? 'text-red-600 font-medium' : 'text-slate-600'
                  }`}
                  title={row.owners.length ? row.owners.join(' · ') : 'Nobody assigned'}
                >
                  {row.owners.length}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {row.gatesUndated + row.workUndated || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one block per department, same data, no sideways scrolling. */}
      <ul className="md:hidden divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.department} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-base font-semibold leading-snug">{row.department}</span>
              <StatusChip row={row} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">
                  Gates
                </span>
                <GatesCell row={row} />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">
                  Work
                </span>
                <WorkCell row={row} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 tabular-nums">
              <span>{row.workWip} in progress</span>
              <span className={row.owners.length === 0 ? 'text-red-600 font-medium' : undefined}>
                {row.owners.length} owner{row.owners.length === 1 ? '' : 's'}
              </span>
              <span>{row.gatesUndated + row.workUndated} undated</span>
            </div>
          </li>
        ))}
      </ul>

      <footer className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> gates met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> work overdue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> work open, not yet late
        </span>
        <span className="text-slate-400">
          Each bar is scaled to that department&rsquo;s own total.
        </span>
      </footer>
    </section>
  );
}
