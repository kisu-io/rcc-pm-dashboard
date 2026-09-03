import type { MonthGrid as MonthGridData } from '@/lib/readiness';

/**
 * Department × month load grid.
 *
 * This stands in for the Gantt on datasets that cannot support one. A Gantt
 * needs a start, an end and a dependency graph; on this programme
 * `planned_start` is null on every row and `depends_on` is empty on every row,
 * so GanttView's `filter(t => t.planned_start && t.planned_end)` removed all
 * 679 tasks and the route rendered nothing but its empty state.
 *
 * What the data does carry is a month bucket per department — 30 distinct
 * `due_date` values, 87% of them on the 1st or the 15th. That is what the
 * source workbook encoded, so that is what this draws.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

function Cell({ total, done, overdue }: { total: number; done: number; overdue: number }) {
  if (total === 0) {
    return <td className="px-2 py-2 text-center text-slate-200">·</td>;
  }
  // Colour by dominant state, not volume: a month that is fully closed reads
  // green however big it was.
  const tone =
    done === total
      ? 'bg-green-50 text-green-700'
      : overdue > 0
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-700';
  return (
    <td className="px-1.5 py-1.5 text-center">
      <span
        className={`inline-block min-w-[2.25rem] rounded px-1.5 py-1 text-sm font-medium tabular-nums ${tone}`}
        title={`${total} task${total === 1 ? '' : 's'} · ${done} done · ${overdue} overdue`}
      >
        {total}
      </span>
    </td>
  );
}

export default function MonthGrid({
  grid,
  currentMonth,
}: {
  grid: MonthGridData;
  currentMonth: string;
}) {
  if (grid.rows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center text-sm text-slate-500">
        No tasks to place.
      </div>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-base font-semibold">Load by department and month</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Khối lượng theo bộ phận · one cell per department-month, coloured by state
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="text-left font-medium px-4 py-2 sticky left-0 bg-white z-10 min-w-[160px]">
                Department
              </th>
              {grid.months.map((m) => (
                <th
                  key={m}
                  className={`font-medium px-2 py-2 text-center whitespace-nowrap ${
                    m === currentMonth ? 'text-blue-600' : ''
                  }`}
                >
                  {monthLabel(m)}
                  {m === currentMonth && <span className="block normal-case">now</span>}
                </th>
              ))}
              <th className="font-medium px-3 py-2 text-center whitespace-nowrap border-l border-slate-200">
                Undated
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.department} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium sticky left-0 bg-white z-10 whitespace-nowrap">
                  {row.department}
                </td>
                {row.cells.map((c) => (
                  <Cell key={c.month} total={c.total} done={c.done} overdue={c.overdue} />
                ))}
                <td className="px-3 py-2 text-center border-l border-slate-200">
                  {row.undated > 0 ? (
                    <span
                      className="inline-block min-w-[2.25rem] rounded px-1.5 py-1 text-sm font-medium tabular-nums bg-slate-100 text-slate-600"
                      title={`${row.undated} open row${row.undated === 1 ? '' : 's'} with no date`}
                    >
                      {row.undated}
                    </span>
                  ) : (
                    <span className="text-slate-200">·</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> all closed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> contains overdue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> open, not late
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> no date committed
        </span>
      </footer>
    </section>
  );
}
