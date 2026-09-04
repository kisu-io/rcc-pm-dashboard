import Link from 'next/link';
import type { ProjectReadiness } from '@/lib/readiness';
import { READINESS_STATUS, projectStatusBadge } from '@/lib/ui';

/**
 * One row per programme, worst risk first.
 *
 * Opening readiness only means something per project, because each one opens
 * on its own date. Pooling them would add gate counts from unrelated estates
 * into a single ratio and fold every project's "Engineering" into one shared
 * department row — so the portfolio view stops at the project boundary and the
 * department ledger lives on each project's own page.
 */

function Countdown({ days, date }: { days: number | null; date: string | null }) {
  if (days == null) {
    return <span className="text-sm text-slate-400">No date</span>;
  }
  const late = days < 0;
  const tone = late ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-900';
  return (
    <div>
      <span className={`text-lg font-bold tabular-nums ${tone}`}>{Math.abs(days)}</span>
      <span className="text-xs text-slate-500"> {late ? 'days late' : 'days'}</span>
      {date && <div className="text-xs text-slate-400 tabular-nums">{date}</div>}
    </div>
  );
}

function GateRatio({ met, total }: { met: number; total: number }) {
  if (total === 0) return <span className="text-xs text-slate-400">No gates defined</span>;
  return (
    <div>
      <div className="h-2 w-full rounded-sm bg-slate-100 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-green-500" style={{ width: `${(met / total) * 100}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums mt-1 block">
        {met} / {total} met
      </span>
    </div>
  );
}

function WorkRatio({ overdue, open }: { overdue: number; open: number }) {
  if (open === 0) return <span className="text-xs text-slate-400">No open work</span>;
  return (
    <div>
      <div className="h-2 w-full flex rounded-sm bg-slate-100 overflow-hidden" aria-hidden="true">
        <div className="bg-red-500" style={{ width: `${(overdue / open) * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${((open - overdue) / open) * 100}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums mt-1 block">
        {overdue > 0 ? (
          <>
            <span className="text-red-600 font-medium">{overdue} overdue</span> / {open}
          </>
        ) : (
          <>{open} open</>
        )}
      </span>
    </div>
  );
}

function RiskChip({ row }: { row: ProjectReadiness }) {
  const s = READINESS_STATUS[row.risk];
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${s.chip}`}
      title={s.meaning}
    >
      {s.label}
    </span>
  );
}

export default function PortfolioLedger({ rows }: { rows: ProjectReadiness[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center text-sm text-slate-500">
        No projects yet.
      </div>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Programmes by readiness</h2>
          <p className="text-xs text-slate-500">
            Các dự án theo mức độ sẵn sàng · worst risk first
          </p>
        </div>
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">
          All projects →
        </Link>
      </header>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="font-medium px-4 py-2">Project</th>
              <th className="font-medium px-4 py-2">Risk</th>
              <th className="font-medium px-4 py-2">To opening</th>
              <th className="font-medium px-4 py-2 w-[150px]">Opening gates</th>
              <th className="font-medium px-4 py-2 w-[180px]">Open work</th>
              <th className="font-medium px-4 py-2 text-right">Depts</th>
              <th className="font-medium px-4 py-2 text-right">Unmobilised</th>
              <th className="font-medium px-4 py-2 text-right">Blockers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.projectId} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/projects/${r.projectId}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.status && (
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${projectStatusBadge(
                        r.status,
                      )}`}
                    >
                      {r.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RiskChip row={r} />
                </td>
                <td className="px-4 py-3">
                  <Countdown days={r.daysToOpening} date={r.openingDate} />
                </td>
                <td className="px-4 py-3">
                  <GateRatio met={r.gatesMet} total={r.gatesTotal} />
                </td>
                <td className="px-4 py-3">
                  <WorkRatio overdue={r.workOverdue} open={r.workOpen} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {r.departmentCount || '—'}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    r.notMobilised.length > 0 ? 'text-red-600 font-medium' : 'text-slate-600'
                  }`}
                  title={
                    r.notMobilised.length
                      ? r.notMobilised.map((d) => d.department).join(' · ')
                      : undefined
                  }
                >
                  {r.notMobilised.length || '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {r.blockers || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="md:hidden divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.projectId} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/projects/${r.projectId}`}
                className="text-base font-semibold text-blue-700 leading-snug"
              >
                {r.name}
              </Link>
              <RiskChip row={r} />
            </div>
            <Countdown days={r.daysToOpening} date={r.openingDate} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">
                  Gates
                </span>
                <GateRatio met={r.gatesMet} total={r.gatesTotal} />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">
                  Work
                </span>
                <WorkRatio overdue={r.workOverdue} open={r.workOpen} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 tabular-nums">
              <span>{r.departmentCount} departments</span>
              <span className={r.notMobilised.length > 0 ? 'text-red-600 font-medium' : undefined}>
                {r.notMobilised.length} unmobilised
              </span>
              <span>{r.blockers} blockers</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
