// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { describe, it, expect } from 'vitest';

import {
  CRITICAL_SLIP_DAYS,
  affectedProjectCount,
  changeOrderBlockers,
  clashBlockers,
  rankBlockers,
  riskBlockers,
  scheduleBlockers,
} from './blockers';

const activity = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a1',
  name: 'Foundations',
  project_id: 'p1',
  project_name: 'Tower B',
  start_date: null,
  end_date: null,
  status: null,
  is_critical: true,
  total_float: -3,
  ...over,
});

describe('scheduleBlockers', () => {
  it('ignores activities with slack - having float is the normal state', () => {
    const payload = {
      total_schedules: 1,
      top: [activity({ total_float: 5 }), activity({ id: 'a2', total_float: 0 })],
    };
    expect(scheduleBlockers(payload as never)).toEqual([]);
  });

  it('ignores activities whose float is unknown rather than assuming zero', () => {
    const payload = { total_schedules: 1, top: [activity({ total_float: null })] };
    expect(scheduleBlockers(payload as never)).toEqual([]);
  });

  it('reports negative float as days behind, not as a negative number', () => {
    const payload = { total_schedules: 1, top: [activity({ total_float: -3 })] };
    const b = scheduleBlockers(payload as never)[0]!;
    expect(b.reasonValues.days).toBe(3);
    expect(b.magnitude).toBe(3);
  });

  it('escalates to critical only at the slip threshold', () => {
    const at = { total_schedules: 1, top: [activity({ total_float: -CRITICAL_SLIP_DAYS })] };
    const under = {
      total_schedules: 1,
      top: [activity({ total_float: -(CRITICAL_SLIP_DAYS - 1) })],
    };
    expect(scheduleBlockers(at as never)[0]!.tier).toBe('critical');
    expect(scheduleBlockers(under as never)[0]!.tier).toBe('high');
  });
});

describe('riskBlockers', () => {
  const risk = (over = {}) => ({
    id: 'r1',
    project_id: 'p1',
    project_name: 'Tower B',
    title: 'Ground conditions',
    score: 12,
    probability: 3,
    impact_severity: 'high',
    status: 'open',
    ...over,
  });

  it('excludes risks somebody already closed or mitigated', () => {
    const payload = {
      top: [risk({ status: 'closed' }), risk({ id: 'r2', status: 'Mitigated' })],
    };
    expect(riskBlockers(payload as never)).toEqual([]);
  });

  it('treats high impact as critical and anything else as high', () => {
    expect(riskBlockers({ top: [risk()] } as never)[0]!.tier).toBe('critical');
    expect(
      riskBlockers({ top: [risk({ impact_severity: 'medium' })] } as never)[0]!.tier,
    ).toBe('high');
  });
});

describe('changeOrderBlockers', () => {
  const co = (over = {}) => ({
    id: 'c1',
    project_id: 'p1',
    project_name: 'Tower B',
    code: 'CO-01',
    title: 'Facade revision',
    status: 'pending',
    cost_impact: '1000000',
    currency: 'VND',
    ...over,
  });

  it('never lets money influence the ranking - currencies are not comparable', () => {
    // 1,000,000 VND is worth far less than 900 EUR. If magnitude carried the
    // bare number, the VND row would outrank the EUR one purely on digits.
    const payload = {
      open_count: 2,
      total_impact: '0',
      currency: 'EUR',
      top_pending: [
        co(),
        co({ id: 'c2', cost_impact: '900', currency: 'EUR', project_name: 'Aoife House' }),
      ],
    };
    const out = changeOrderBlockers(payload as never);
    expect(out.every((b) => b.magnitude === 0)).toBe(true);
  });

  it('drops change orders that have already been settled', () => {
    const payload = {
      open_count: 0,
      total_impact: '0',
      currency: 'EUR',
      top_pending: [co({ status: 'approved' }), co({ id: 'c3', status: 'Rejected' })],
    };
    expect(changeOrderBlockers(payload as never)).toEqual([]);
  });
});

describe('clashBlockers', () => {
  const proj = (over = {}) => ({
    project_id: 'p1',
    project_name: 'Tower B',
    total: 40,
    open: 20,
    high: 3,
    medium: 10,
    low: 7,
    ...over,
  });

  it('ignores projects whose open clashes are all low or medium', () => {
    const payload = {
      total: 0, open: 0, high: 0, medium: 0, low: 0, pct_resolved: 0,
      by_project: [proj({ high: 0 })],
    };
    expect(clashBlockers(payload as never)).toEqual([]);
  });
});

describe('rankBlockers', () => {
  const empty = {
    schedule: null, risk: null, changeOrders: null, budget: null, clash: null,
  };

  it('returns nothing when the rollup carried nothing, without throwing', () => {
    expect(rankBlockers(empty)).toEqual([]);
  });

  it('puts tier ahead of magnitude - a big number cannot outrank a worse tier', () => {
    const out = rankBlockers({
      ...empty,
      // 40 days late => critical, magnitude 40
      schedule: { total_schedules: 1, top: [activity({ total_float: -40 })] } as never,
      // 3 high clashes => high tier, magnitude 3
      clash: {
        total: 0, open: 0, high: 0, medium: 0, low: 0, pct_resolved: 0,
        by_project: [
          { project_id: 'p9', project_name: 'Zed', total: 5, open: 5, high: 3, medium: 0, low: 0 },
        ],
      } as never,
    });
    expect(out[0]!.tier).toBe('critical');
    expect(out[1]!.tier).toBe('high');
  });

  it('orders by project name when tier and magnitude tie, so the list is stable', () => {
    const mk = (id: string, name: string) => ({
      project_id: id, project_name: name,
      total: 5, open: 5, high: 3, medium: 0, low: 0,
    });
    const out = rankBlockers({
      ...empty,
      clash: {
        total: 0, open: 0, high: 0, medium: 0, low: 0, pct_resolved: 0,
        by_project: [mk('p2', 'Zed'), mk('p1', 'Aoife')],
      } as never,
    });
    expect(out.map((b) => b.projectName)).toEqual(['Aoife', 'Zed']);
  });
});

describe('affectedProjectCount', () => {
  it('counts each project once even when it is stuck several ways', () => {
    const out = rankBlockers({
      schedule: {
        total_schedules: 1,
        top: [activity({ total_float: -20 }), activity({ id: 'a2', total_float: -5 })],
      } as never,
      risk: null, changeOrders: null, budget: null,
      clash: {
        total: 0, open: 0, high: 0, medium: 0, low: 0, pct_resolved: 0,
        by_project: [
          { project_id: 'p1', project_name: 'Tower B', total: 5, open: 5, high: 4, medium: 0, low: 0 },
        ],
      } as never,
    });
    expect(out.length).toBe(3);
    expect(affectedProjectCount(out)).toBe(1);
  });
});
