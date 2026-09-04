import type { ModuleProgress } from '@/lib/modules';
import { MODULE_LABELS, MODULE_COLORS } from '@/lib/modules';
import { MODULE_STATE } from '@/lib/ui';

/**
 * One module, rolled up across the portfolio.
 *
 * Pending is the number this card exists to show, so it is given the same
 * weight as the percentage: a module can read 0% because nobody has started it
 * or because nobody has loaded it, and those need different phone calls.
 */
export default function ModuleCard({ row }: { row: ModuleProgress }) {
  const label = MODULE_LABELS[row.module];
  const state = MODULE_STATE[row.state];
  const empty = row.state === 'no-data';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-slate-900/5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{label.en}</div>
          <div className="text-xs text-slate-500 truncate">{label.vn}</div>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${state.chip}`}
          title={state.meaning}
        >
          {state.label}
        </span>
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl font-bold tabular-nums text-slate-900">
          {empty ? '—' : `${row.progressPct}%`}
        </span>
        {!empty && (
          <span className="text-xs text-slate-500 tabular-nums">
            {row.isOverridden
              ? 'entered by PM'
              : `${row.workDone} / ${row.workTotal} work done`}
          </span>
        )}
      </div>

      {/*
        Width is gated on the same flag as the text above it. Previously the
        label read "—" while this bar was sized from an override, so the card
        showed "no records" over a 95%-filled bar.
      */}
      <div className="h-2 w-full rounded-sm bg-slate-100 overflow-hidden" aria-hidden="true">
        <div
          className="h-full rounded-sm transition-[width]"
          style={{
            width: empty ? '0%' : `${row.progressPct}%`,
            background: MODULE_COLORS[row.module],
          }}
        />
      </div>

      {empty ? (
        <p className="text-xs text-slate-400">Awaiting this team&rsquo;s workbook.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
          <span className={row.pending > 0 ? 'text-amber-700 font-medium' : 'text-slate-400'}>
            {row.pending} pending
          </span>
          {row.overdue > 0 && (
            <span className="text-red-600 font-semibold">{row.overdue} overdue</span>
          )}
          {row.unscheduled > 0 && (
            <span className="text-slate-500" title="Open work with no date set">
              {row.unscheduled} undated
            </span>
          )}
          {row.gatesTotal > 0 && (
            <span
              className="text-slate-500"
              title="Opening-acceptance criteria. Normally undated until someone commits to a date."
            >
              {row.gatesMet} / {row.gatesTotal} gates
            </span>
          )}
        </div>
      )}
    </div>
  );
}
