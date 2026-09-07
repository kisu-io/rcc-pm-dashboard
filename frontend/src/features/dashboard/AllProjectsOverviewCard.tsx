// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * AllProjectsOverviewCard - the owner / investor view: every project on one
 * row, then the five delivery modules as card blocks.
 *
 * WHY THIS EXISTS
 * The rest of the dashboard answers "how is THIS project doing" - a top-bar
 * selector picks one project and the widgets scope to it. An owner asking
 * "where do I intervene" cannot use that: the answer is spread across 13
 * project switches. This card answers the portfolio question instead.
 *
 * COST: ZERO extra HTTP calls. `DashboardPage` mounts `DashboardRollupProvider`
 * with no `projectIds`, so the shared `GET /v1/dashboard/rollup/` already
 * carries every accessible project (see the v4.6.2 "N+1 nuke" note there).
 * We read that same payload. Do NOT add a per-project fan-out here - the
 * comment at `dashboard/service.py:50-54` records that the pattern this
 * replaces used to cause 502 spikes on mount.
 *
 * THE BAR IS PRICED POSITIONS, NOT PHYSICAL PROGRESS - and it says so.
 * The rollup has no cross-project physical-progress figure: `progress`
 * exposes only `GET /cumulative/?project_id=` (single-project, no batch
 * variant), so a real percent-complete column would cost one call per
 * project. `boq_summary.by_project` is the only complete per-project series
 * in the rollup, so the bar reads estimate readiness and is labelled that
 * way. Mislabelling it "progress" would be the single most expensive error
 * this card could make.
 *
 * "NO RECORDS" IS NOT "0%". A project with no positions renders an em dash
 * and a hollow track, never a full-width red bar - they are two different
 * conversations. `pricedPositions()` also withholds the percentage below
 * MIN_POSITIONS_FOR_PCT, because "50%" over two lines is true and useless.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  DraftingCompass,
  ShoppingCart,
  HardHat,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/shared/ui';
import { getNumberLocale } from '@/stores/usePreferencesStore';
import { useDashboardRollupContext } from './context/DashboardRollupContext';
import { pricedPositions } from './pricedPositions';
import { rankBlockers, affectedProjectCount, type BlockerTier } from './blockers';

/* ── Formatting ───────────────────────────────────────────────────────── */

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toLocaleString(getNumberLocale(), { maximumFractionDigits: 0 });
}

/**
 * Money, per currency, never blended.
 *
 * The rollup ships `by_currency` subtotals precisely because the legacy
 * scalar (`total_impact`) sums across currencies. This portfolio spans
 * seven, so the scalar is arithmetically meaningless here - we render the
 * subtotals or nothing.
 */
function formatByCurrency(
  rows: { currency: string; total_impact?: string; total_value?: string }[] | undefined,
): string | null {
  if (!rows || rows.length === 0) return null;
  const parts = rows
    .map((r) => {
      const raw = r.total_impact ?? r.total_value ?? '0';
      const n = Number(raw);
      if (!Number.isFinite(n) || n === 0) return null;
      const compact = n.toLocaleString(getNumberLocale(), {
        notation: 'compact',
        maximumFractionDigits: 1,
      });
      return `${compact} ${r.currency}`.trim();
    })
    .filter((s): s is string => s !== null);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The board is a shortlist, not a register. Past roughly this many rows a
 * reader stops triaging and starts scrolling, so the remainder is reported as
 * a count - truncation must never be mistaken for "that is all of them".
 */
const MAX_BLOCKER_ROWS = 8;

const TIER_DOT: Record<BlockerTier, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  watch: 'bg-slate-400',
};

/* ── The five delivery modules ────────────────────────────────────────── */

/**
 * Colours carried over from the programme taxonomy the previous dashboard
 * shipped (`lib/modules.ts` at tag `legacy-nextjs-final`). Kept as literals
 * rather than Tailwind classes because Tailwind cannot resolve a class name
 * built at runtime, and these are data, not styling decisions.
 */
interface ModuleBlock {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  /** Headline figure, or null when the source module reported nothing. */
  value: string | null;
  /** Short qualifier under the headline. */
  detail: string | null;
  /** Why the block is empty, when it is. Never left to the reader to guess. */
  emptyReason: string | null;
  to: string | null;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function AllProjectsOverviewCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { byWidget, isLoading } = useDashboardRollupContext();

  const boq = byWidget('boq_summary');
  const clash = byWidget('clash_health');
  const validation = byWidget('validation_score');
  const schedule = byWidget('schedule_critical');
  const risk = byWidget('risk_top');
  const procurement = byWidget('procurement_pipeline');
  const budget = byWidget('budget_variance');
  const changeOrders = byWidget('change_orders');

  /**
   * One row per project.
   *
   * `boq_summary.by_project` is the spine because it is the only widget that
   * returns a row for every accessible project rather than a top-N slice.
   * Everything else is joined in by id; a project absent from those maps
   * genuinely has nothing there, which is why the lookups default to
   * undefined and the cells render an em dash rather than a zero.
   */
  const rows = useMemo(() => {
    const projects = boq?.by_project ?? [];
    const clashById = new Map((clash?.by_project ?? []).map((c) => [c.project_id, c]));
    const validationById = new Map(
      (validation?.by_project ?? []).map((v) => [v.project_id, v]),
    );
    const budgetById = new Map((budget?.top_over ?? []).map((b) => [b.project_id, b]));

    return projects
      .map((p) => ({
        id: p.project_id,
        name: p.project_name,
        priced: pricedPositions(p),
        openClashes: clashById.get(p.project_id)?.open,
        errors: validationById.get(p.project_id)?.errors,
        // `top_over` only carries projects that are OVER budget, so absence
        // here means "not over budget", not "no budget data".
        overBudgetPct: budgetById.get(p.project_id)?.pct,
      }))
      .sort((a, b) => {
        // Worst-first: a reader scanning for where to intervene should not
        // have to read to the bottom. Projects with no percentage sort last
        // because "unknown" is not "fine".
        const ap = a.priced?.pct;
        const bp = b.priced?.pct;
        if (ap === null || ap === undefined) return 1;
        if (bp === null || bp === undefined) return -1;
        return ap - bp;
      });
  }, [boq, clash, validation, budget]);

  /**
   * What is actually stuck, worst first. Derived from the SAME rollup slices
   * the blocks below summarise - the blocks say how much, this says what to
   * act on. Ranking rules live in `blockers.ts`, which is pure and tested.
   */
  const blockers = useMemo(
    () => rankBlockers({ schedule, risk, changeOrders, budget, clash }),
    [schedule, risk, changeOrders, budget, clash],
  );

  const blocks = useMemo<ModuleBlock[]>(() => {
    const criticalCount = (schedule?.top ?? []).filter((a) => a.is_critical).length;
    const coMoney =
      formatByCurrency(changeOrders?.by_currency) ??
      (changeOrders && !changeOrders.multi_currency && Number(changeOrders.total_impact) > 0
        ? `${Number(changeOrders.total_impact).toLocaleString(getNumberLocale(), {
            notation: 'compact',
            maximumFractionDigits: 1,
          })} ${changeOrders.currency}`
        : null);

    return [
      {
        key: 'legal',
        label: t('dashboard.modules.legal', { defaultValue: 'Legal' }),
        icon: Scale,
        accent: '#a855f7',
        value: changeOrders ? fmt(changeOrders.open_count) : null,
        detail: changeOrders
          ? coMoney
            ? t('dashboard.modules.legal_detail', {
                defaultValue: 'Open change orders · {{money}} at stake',
                money: coMoney,
              })
            : t('dashboard.modules.legal_detail_plain', {
                defaultValue: 'Open change orders',
              })
          : null,
        emptyReason: changeOrders
          ? null
          : t('dashboard.modules.no_data', { defaultValue: 'No records yet' }),
        to: '/changeorders',
      },
      {
        key: 'design',
        label: t('dashboard.modules.design', { defaultValue: 'Design' }),
        icon: DraftingCompass,
        accent: '#06b6d4',
        value: clash ? fmt(clash.open) : null,
        detail: clash
          ? t('dashboard.modules.design_detail', {
              defaultValue: 'Open clashes · {{high}} high · {{pct}}% resolved',
              high: fmt(clash.high),
              pct: fmt(clash.pct_resolved),
            })
          : null,
        emptyReason: clash
          ? null
          : t('dashboard.modules.no_data', { defaultValue: 'No records yet' }),
        to: '/clash',
      },
      {
        key: 'procurement',
        label: t('dashboard.modules.procurement', {
          defaultValue: 'Procurement & Purchasing',
        }),
        icon: ShoppingCart,
        accent: '#f59e0b',
        value: procurement ? fmt(procurement.pos_issued) : null,
        detail: procurement
          ? t('dashboard.modules.procurement_detail', {
              defaultValue: 'POs issued · {{rfq}} RFQs pending · {{recv}} received',
              rfq: fmt(procurement.rfqs_pending),
              recv: fmt(procurement.pos_received),
            })
          : null,
        emptyReason: procurement
          ? null
          : t('dashboard.modules.no_data', { defaultValue: 'No records yet' }),
        to: '/procurement',
      },
      {
        key: 'construction',
        label: t('dashboard.modules.construction', { defaultValue: 'Construction' }),
        icon: HardHat,
        accent: '#2563eb',
        value: schedule ? fmt(schedule.total_schedules) : null,
        detail: schedule
          ? t('dashboard.modules.construction_detail', {
              defaultValue: 'Schedules · {{crit}} critical · {{risk}} top risks',
              crit: fmt(criticalCount),
              risk: fmt((risk?.top ?? []).length),
            })
          : null,
        emptyReason: schedule
          ? null
          : t('dashboard.modules.no_data', { defaultValue: 'No records yet' }),
        to: '/schedule',
      },
      {
        // Deliberately last and deliberately empty. OCE has no marketing
        // module at all, and `crm`'s dashboard takes no project_id, so there
        // is no portfolio-scoped sales figure to show. An honest blank beats
        // a tenant-wide number sitting in a row of project-scoped ones.
        key: 'sales',
        label: t('dashboard.modules.sales', { defaultValue: 'Sales & Marketing' }),
        icon: Megaphone,
        accent: '#ec4899',
        value: null,
        detail: null,
        emptyReason: t('dashboard.modules.sales_empty', {
          defaultValue: 'Not connected - no portfolio-wide sales source',
        }),
        to: '/crm',
      },
    ];
  }, [t, changeOrders, clash, procurement, schedule, risk]);

  // Self-hide while the shared rollup is still in flight, and when it came
  // back with no projects at all - matching every other card on the page.
  if (isLoading) return null;
  if (!boq && !clash && !procurement && !schedule && !changeOrders) return null;

  return (
    <Card>
      <CardHeader
        title={t('dashboard.all_projects_title', { defaultValue: 'All projects' })}
        subtitle={t('dashboard.all_projects_subtitle', {
          defaultValue:
            'Every project and the five delivery modules, across the whole portfolio',
        })}
      />
      <CardContent>
        {/* ── Per-project bars ──────────────────────────────────────── */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {t('dashboard.all_projects_bar_heading', {
                defaultValue: 'Estimate readiness by project',
              })}
            </h4>
            <span className="text-xs text-text-tertiary">
              {t('dashboard.all_projects_bar_note', {
                defaultValue: 'Priced BOQ positions - not physical progress',
              })}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="py-3 text-sm text-text-tertiary">
              {t('dashboard.all_projects_empty', {
                defaultValue: 'No projects with a bill of quantities yet.',
              })}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const pct = r.priced?.pct ?? null;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${r.id}`)}
                      className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-normal ease-oe hover:bg-oe-blue-subtle/30 focus:outline-none focus:ring-2 focus:ring-oe-blue/30"
                    >
                      <span className="w-40 shrink-0 truncate text-sm text-text-primary group-hover:text-oe-blue">
                        {r.name}
                      </span>

                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-border-light dark:bg-white/10">
                        {pct !== null && (
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-oe-blue transition-[width] duration-normal ease-oe"
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        )}
                      </span>

                      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-text-secondary">
                        {pct !== null
                          ? `${pct}%`
                          : r.priced
                            ? t('dashboard.all_projects_counts', {
                                defaultValue: '{{priced}} of {{total}}',
                                priced: fmt(r.priced.priced),
                                total: fmt(r.priced.total),
                              })
                            : '-'}
                      </span>

                      <span className="hidden w-28 shrink-0 justify-end gap-2 text-xs tabular-nums sm:flex">
                        {r.openClashes ? (
                          <span className="text-cyan-600 dark:text-cyan-400">
                            {fmt(r.openClashes)}c
                          </span>
                        ) : null}
                        {r.errors ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {fmt(r.errors)}e
                          </span>
                        ) : null}
                        {r.overBudgetPct !== undefined ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {fmt(r.overBudgetPct)}%
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── What needs a decision ─────────────────────────────────── */}
        {blockers.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {t('dashboard.blockers.heading', { defaultValue: 'Needs a decision' })}
              </h4>
              <span className="text-xs text-text-tertiary">
                {t('dashboard.blockers.count', {
                  defaultValue: '{{items}} across {{projects}} projects',
                  items: fmt(blockers.length),
                  projects: fmt(affectedProjectCount(blockers)),
                })}
              </span>
            </div>

            <ul className="divide-y divide-border-light rounded-lg border border-border-light">
              {blockers.slice(0, MAX_BLOCKER_ROWS).map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => navigate(b.to)}
                    className="group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-normal ease-oe hover:bg-oe-blue-subtle/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-oe-blue/30"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${TIER_DOT[b.tier]}`}
                      aria-hidden
                    />
                    <span className="w-36 shrink-0 truncate text-xs text-text-tertiary">
                      {b.projectName}
                    </span>
                    <span className="flex-1 truncate text-sm text-text-primary group-hover:text-oe-blue">
                      {b.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                      {t(b.reasonKey, { defaultValue: b.reasonDefault, ...b.reasonValues })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {blockers.length > MAX_BLOCKER_ROWS && (
              <p className="mt-1.5 text-xs text-text-tertiary">
                {t('dashboard.blockers.more', {
                  defaultValue: '+{{n}} more not shown',
                  n: fmt(blockers.length - MAX_BLOCKER_ROWS),
                })}
              </p>
            )}
          </div>
        )}

        {/* ── The five delivery modules ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {blocks.map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => b.to && navigate(b.to)}
                disabled={!b.to}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-border-light bg-surface-primary p-3 text-left transition-all duration-normal ease-oe hover:border-oe-blue/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30 disabled:cursor-default"
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" style={{ color: b.accent }} aria-hidden />
                  <span className="text-xs font-medium text-text-secondary">{b.label}</span>
                </span>

                {b.value !== null ? (
                  <>
                    <span className="text-xl font-semibold tabular-nums text-text-primary">
                      {b.value}
                    </span>
                    {b.detail && (
                      <span className="text-[11px] leading-tight text-text-tertiary">
                        {b.detail}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] leading-tight text-text-tertiary">
                    {b.emptyReason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
