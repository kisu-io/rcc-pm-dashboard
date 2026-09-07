// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * blockers - turns the cross-project rollup into a ranked list of things
 * that are STUCK, for the owner / investor view.
 *
 * The five module blocks answer "how much"; this answers "what do I act on
 * first". A count cannot be acted on - "4 open change orders" tells an owner
 * nothing about which one, on which project, or how long it has been sitting.
 *
 * ── THE RULE THIS MODULE EXISTS TO ENFORCE ──────────────────────────────
 * Incomparable magnitudes are NEVER blended into one score. Days of negative
 * float, a risk probability×impact score, and a sum of money in seven
 * currencies do not share a scale, and averaging them produces a number that
 * moves when nothing real changed. (The previous dashboard shipped exactly
 * that bug: blending work with gates produced "6%" when the honest figures
 * were 10% and 2%.)
 *
 * Instead each source assigns an explicit TIER by its own rule, and rows sort
 * by tier first. `magnitude` orders rows only WITHIN one source, and is
 * documented as meaningless across sources.
 *
 * Money is never used for ranking. `cost_impact` carries a currency and this
 * portfolio spans seven; sorting by the bare number would rank 1M VND above
 * 900 EUR. Money is shown as context and nothing more.
 */
import type {
  BudgetVariancePayload,
  ChangeOrdersPayload,
  ClashHealthPayload,
  RiskTopPayload,
  ScheduleCriticalPayload,
} from './hooks/useDashboardRollup';

/** Worst first. Order matters - it is the sort key. */
export const TIER_ORDER = ['critical', 'high', 'watch'] as const;
export type BlockerTier = (typeof TIER_ORDER)[number];

export type BlockerModule = 'legal' | 'design' | 'procurement' | 'construction';

export interface Blocker {
  id: string;
  module: BlockerModule;
  projectId: string;
  projectName: string;
  /** The thing that is stuck. */
  title: string;
  /**
   * Why it is stuck, as an i18n-ready template key plus values. Kept as data
   * rather than a built sentence so the caller can translate it.
   */
  reasonKey: string;
  reasonDefault: string;
  reasonValues: Record<string, string | number>;
  tier: BlockerTier;
  /** Orders rows WITHIN one module only. Meaningless across modules. */
  magnitude: number;
  /** Route to the thing itself. */
  to: string;
}

/**
 * An activity this many days behind is escalated from `high` to `critical`.
 *
 * Two weeks is the point at which a construction activity's slip stops being
 * absorbable by resequencing and starts moving the completion date - the
 * threshold an owner is being asked to act before, not after.
 */
export const CRITICAL_SLIP_DAYS = 14;

/** Forecast overrun beyond this share of the planned budget is `critical`. */
export const CRITICAL_OVERRUN_PCT = 10;

/** Open high-severity clashes at or above this count block a design package. */
export const CRITICAL_HIGH_CLASHES = 10;

function num(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? NaN);
  return Number.isFinite(n) ? n : 0;
}

/* ── Per-source extractors ────────────────────────────────────────────── */

/**
 * Schedule slips. `total_float` is an integer count of DAYS (see
 * `schedule/models.py:155`; the existing critical-path widget renders it as
 * "{{n}}d slack"), so a negative value is days behind and needs no unit
 * guess. Activities with zero or positive float are not blockers - having
 * slack is the normal state - so only negatives are returned.
 */
export function scheduleBlockers(payload: ScheduleCriticalPayload | null): Blocker[] {
  return (payload?.top ?? [])
    .filter((a) => a.total_float !== null && a.total_float < 0)
    .map((a) => {
      const late = Math.abs(a.total_float as number);
      return {
        id: `schedule:${a.id}`,
        module: 'construction' as const,
        projectId: a.project_id,
        projectName: a.project_name,
        title: a.name,
        reasonKey: 'dashboard.blockers.schedule_late',
        reasonDefault: '{{days}}d behind on the critical path',
        reasonValues: { days: late },
        tier: (late >= CRITICAL_SLIP_DAYS ? 'critical' : 'high') as BlockerTier,
        magnitude: late,
        to: '/schedule',
      };
    });
}

/**
 * Live risks. `score` is the backend's probability × impact ranking, so it is
 * already the source's own scale and is used unchanged as the magnitude.
 * Closed and mitigated risks are excluded - a risk someone already handled is
 * not a decision waiting on the owner.
 */
export function riskBlockers(payload: RiskTopPayload | null): Blocker[] {
  const closed = new Set(['closed', 'mitigated', 'retired', 'accepted']);
  return (payload?.top ?? [])
    .filter((r) => !closed.has((r.status ?? '').toLowerCase()))
    .map((r) => ({
      id: `risk:${r.id}`,
      module: 'construction' as const,
      projectId: r.project_id,
      projectName: r.project_name,
      title: r.title,
      reasonKey: 'dashboard.blockers.risk_open',
      reasonDefault: '{{severity}} risk, unresolved',
      reasonValues: { severity: r.impact_severity },
      tier: ((r.impact_severity ?? '').toLowerCase() === 'high'
        ? 'critical'
        : 'high') as BlockerTier,
      magnitude: num(r.score),
      to: '/risk',
    }));
}

/**
 * Pending change orders - contractual decisions waiting on someone.
 *
 * Every pending change order is `high`, never `critical`, and magnitude is
 * always 0: the only field that could rank them is `cost_impact`, which
 * carries a per-row currency. Ranking a seven-currency portfolio by the bare
 * number would put 1M VND above 900 EUR. The money is passed through for
 * display WITH its currency and takes no part in the ordering.
 */
export function changeOrderBlockers(payload: ChangeOrdersPayload | null): Blocker[] {
  const settled = new Set(['approved', 'rejected', 'closed', 'cancelled']);
  return (payload?.top_pending ?? [])
    .filter((c) => !settled.has((c.status ?? '').toLowerCase()))
    .map((c) => ({
      id: `co:${c.id}`,
      module: 'legal' as const,
      projectId: c.project_id,
      projectName: c.project_name,
      title: c.title || c.code || '-',
      reasonKey: 'dashboard.blockers.co_pending',
      reasonDefault: 'Awaiting decision · {{amount}} {{currency}}',
      reasonValues: { amount: c.cost_impact, currency: c.currency },
      tier: 'high' as BlockerTier,
      magnitude: 0,
      to: '/changeorders',
    }));
}

/**
 * Projects forecast to finish over budget. `pct` is the backend's own
 * overrun share, so it is comparable across rows here (it is a ratio, not a
 * currency amount) and serves as the magnitude.
 */
export function budgetBlockers(payload: BudgetVariancePayload | null): Blocker[] {
  return (payload?.top_over ?? []).map((b) => ({
    id: `budget:${b.project_id}`,
    module: 'procurement' as const,
    projectId: b.project_id,
    projectName: b.project_name,
    title: b.project_name,
    reasonKey: 'dashboard.blockers.over_budget',
    reasonDefault: 'Forecast {{pct}}% over budget',
    reasonValues: { pct: Math.round(num(b.pct)) },
    tier: (num(b.pct) >= CRITICAL_OVERRUN_PCT ? 'critical' : 'high') as BlockerTier,
    magnitude: num(b.pct),
    to: '/finance',
  }));
}

/**
 * Design coordination. `clash_health` reports per-project COUNTS rather than
 * individual clashes, so these rows are project-level: "this project's model
 * is not coordinated", not "this clash is stuck". Projects with no open
 * high-severity clashes are omitted - open low-severity clashes are routine
 * coordination work, not something an owner intervenes in.
 */
export function clashBlockers(payload: ClashHealthPayload | null): Blocker[] {
  return (payload?.by_project ?? [])
    .filter((c) => c.high > 0)
    .map((c) => ({
      id: `clash:${c.project_id}`,
      module: 'design' as const,
      projectId: c.project_id,
      projectName: c.project_name,
      title: c.project_name,
      reasonKey: 'dashboard.blockers.clash_high',
      reasonDefault: '{{high}} high-severity clashes open',
      reasonValues: { high: c.high },
      tier: (c.high >= CRITICAL_HIGH_CLASHES ? 'critical' : 'high') as BlockerTier,
      magnitude: c.high,
      to: '/clash',
    }));
}

/* ── Ranking ──────────────────────────────────────────────────────────── */

export interface RollupSlices {
  schedule: ScheduleCriticalPayload | null;
  risk: RiskTopPayload | null;
  changeOrders: ChangeOrdersPayload | null;
  budget: BudgetVariancePayload | null;
  clash: ClashHealthPayload | null;
}

/**
 * All blockers, worst first.
 *
 * Sort is tier → magnitude → project name. Magnitude only ever breaks ties
 * inside a tier, and rows from different modules with the same tier are
 * ordered by a number that means something different in each - which is why
 * the final key is the project name, so the order is at least STABLE and
 * reproducible rather than arbitrary.
 */
export function rankBlockers(slices: RollupSlices): Blocker[] {
  const all = [
    ...scheduleBlockers(slices.schedule),
    ...riskBlockers(slices.risk),
    ...changeOrderBlockers(slices.changeOrders),
    ...budgetBlockers(slices.budget),
    ...clashBlockers(slices.clash),
  ];

  const tierRank = (t: BlockerTier) => TIER_ORDER.indexOf(t);

  return all.sort((a, b) => {
    const byTier = tierRank(a.tier) - tierRank(b.tier);
    if (byTier !== 0) return byTier;
    const byMagnitude = b.magnitude - a.magnitude;
    if (byMagnitude !== 0) return byMagnitude;
    return a.projectName.localeCompare(b.projectName);
  });
}

/** How many projects have at least one blocker. */
export function affectedProjectCount(blockers: Blocker[]): number {
  return new Set(blockers.map((b) => b.projectId)).size;
}
