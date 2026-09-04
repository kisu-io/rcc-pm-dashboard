import { AlertTriangle, CalendarClock } from 'lucide-react';
import type { ProgrammeReadiness } from '@/lib/readiness';

/**
 * The first thing on the screen: how long is left, and how much of "ready to
 * open" is actually signed off.
 *
 * What this replaces reported "Schedule Health 100%" beside "Avg Progress 6%".
 * The first came from the single project's target_end still being in the
 * future; the second from Done/total across a population that mixed scheduled
 * work with undated acceptance criteria. Neither told the PM anything.
 */

function Stat({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'critical' | 'warning';
  hint?: string;
}) {
  const toneClass =
    tone === 'critical' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export default function ReadinessSummary({
  programme,
  projectName,
}: {
  programme: ProgrammeReadiness;
  projectName: string;
}) {
  const {
    daysToOpening,
    openingDate,
    gatesTotal,
    gatesMet,
    workOverdue,
    workOpen,
    workWip,
    dueNextFortnight,
    blockers,
    notMobilised,
  } = programme;

  const gatePct = gatesTotal > 0 ? Math.round((gatesMet / gatesTotal) * 100) : null;
  const late = daysToOpening != null && daysToOpening < 0;

  return (
    <div className="space-y-4">
      {/* Countdown + the one headline number */}
      <section className="bg-brand-navy text-white rounded-xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/60">
              {projectName} · pre-opening
            </p>
            {gatesTotal > 0 ? (
              <>
                <p className="mt-2 text-4xl md:text-5xl font-bold tabular-nums leading-none">
                  {gatesMet}
                  <span className="text-white/50"> / {gatesTotal}</span>
                </p>
                <p className="mt-2 text-base text-white/85">
                  Opening gates signed off
                  {gatePct != null && <span className="text-white/60"> · {gatePct}%</span>}
                </p>
                <p className="text-xs text-white/50">Hạng mục sẵn sàng khai trương</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl md:text-3xl font-bold leading-tight">
                  No readiness gates defined
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Nothing in this programme is marked as an opening criterion yet.
                </p>
              </>
            )}
          </div>

          <div className="text-right shrink-0">
            {daysToOpening != null ? (
              <>
                <p className="text-4xl md:text-5xl font-bold tabular-nums leading-none text-brand-accent">
                  {Math.abs(daysToOpening)}
                </p>
                <p className="text-xs uppercase tracking-widest text-white/60 mt-2">
                  {late ? 'days past opening' : 'days to opening'}
                </p>
                {openingDate && <p className="text-xs text-white/50 mt-0.5">{openingDate}</p>}
              </>
            ) : (
              <p className="text-sm text-white/60 flex items-center gap-2">
                <CalendarClock size={16} /> No opening date set
              </p>
            )}
          </div>
        </div>
      </section>

      {/* The departments nobody has started. The old dashboard could not show this. */}
      {notMobilised.length > 0 && (
        <section className="bg-white border-l-4 border-slate-400 rounded-r-xl rounded-l-sm p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-slate-500 shrink-0 mt-0.5" size={18} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold">
                {notMobilised.length} department{notMobilised.length === 1 ? '' : 's'} never
                mobilised
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Readiness criteria written, but nobody assigned and nothing scheduled —{' '}
                <span className="tabular-nums font-medium">
                  {notMobilised.reduce((s, d) => s + d.gates, 0)} gates
                </span>{' '}
                with zero owners.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {notMobilised.map((d) => (
                  <li
                    key={d.department}
                    className="text-sm bg-slate-100 text-slate-700 rounded px-2 py-0.5"
                  >
                    {d.department} <span className="text-slate-500 tabular-nums">({d.gates})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Supporting counts. Each is a real, countable thing. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Stat
          label="Work overdue"
          value={workOverdue}
          tone={workOverdue > 0 ? 'critical' : 'neutral'}
          hint={`of ${workOpen} open`}
        />
        <Stat label="In progress" value={workWip} hint="đang thực hiện" />
        <Stat
          label="Due next 14 days"
          value={dueNextFortnight}
          tone={dueNextFortnight === 0 ? 'warning' : 'neutral'}
          hint={dueNextFortnight === 0 ? 'nothing scheduled' : 'committed work'}
        />
        <Stat
          label="Blockers"
          value={blockers}
          tone={blockers > 0 ? 'warning' : 'neutral'}
          hint="ràng buộc"
        />
      </div>
    </div>
  );
}
