import { describe, it, expect } from 'vitest';
import {
  MODULE_ORDER,
  classifyModule,
  moduleProgress,
  projectModules,
  portfolioModules,
  effectiveProgress,
  type ModuleKey,
} from './modules';

const T = (over: Partial<Parameters<typeof classifyModule>[0]> & Record<string, unknown> = {}) => ({
  module: null,
  kanban_status: 'To Do',
  due_date: null,
  ...over,
});

describe('MODULE_ORDER', () => {
  it('carries the six modules agreed at the meeting, in reading order', () => {
    expect(MODULE_ORDER).toEqual([
      'legal',
      'design',
      'procurement',
      'construction',
      'sales',
      'operation',
    ]);
  });
});

describe('classifyModule', () => {
  it('prefers the explicit module column', () => {
    expect(classifyModule({ module: 'construction' })).toBe('construction');
  });

  it('trims and lowercases a hand-typed value', () => {
    expect(classifyModule({ module: '  Legal ' })).toBe('legal');
  });

  it('falls back to operation when the column is absent', () => {
    // The 679-row Chateau dataset is the operation team's checklist, and the
    // app must read correctly before supabase-phase10.sql is applied.
    expect(classifyModule({})).toBe('operation');
    expect(classifyModule({ module: null })).toBe('operation');
  });

  it('falls back to operation for a value outside the six', () => {
    expect(classifyModule({ module: 'facilities' })).toBe('operation');
  });
});

describe('moduleProgress', () => {
  const today = '2026-06-01';

  it('reports no-data for a module with no records', () => {
    const r = moduleProgress('design', [], today, null);
    expect(r.total).toBe(0);
    expect(r.state).toBe('no-data');
    expect(r.progressPct).toBe(0);
    expect(r.pending).toBe(0);
  });

  it('derives progress from done / total', () => {
    const r = moduleProgress(
      'operation',
      [T({ kanban_status: 'Done' }), T({ kanban_status: 'Done' }), T(), T()],
      today,
      null,
    );
    expect(r.progressPct).toBe(50);
    expect(r.done).toBe(2);
    expect(r.pending).toBe(2);
  });

  it('counts open, dated, past-due rows as overdue and flags behind', () => {
    const r = moduleProgress(
      'operation',
      [T({ due_date: '2026-05-01' }), T({ due_date: '2026-07-01' })],
      today,
      null,
    );
    expect(r.overdue).toBe(1);
    expect(r.state).toBe('behind');
  });

  it('never counts a done row as overdue', () => {
    const r = moduleProgress(
      'operation',
      [T({ kanban_status: 'Done', due_date: '2026-05-01' })],
      today,
      null,
    );
    expect(r.overdue).toBe(0);
    expect(r.state).toBe('complete');
  });

  it('counts undated open rows as unscheduled, not overdue', () => {
    const r = moduleProgress('operation', [T(), T({ due_date: null })], today, null);
    expect(r.unscheduled).toBe(2);
    expect(r.overdue).toBe(0);
  });

  it('reads not-started when nothing is done and nothing is in progress', () => {
    const r = moduleProgress('legal', [T(), T()], today, null);
    expect(r.state).toBe('not-started');
  });

  it('reads on-track once work is moving and nothing is late', () => {
    const r = moduleProgress(
      'legal',
      [T({ kanban_status: 'In Progress' }), T({ due_date: '2026-07-01' })],
      today,
      null,
    );
    expect(r.wip).toBe(1);
    expect(r.state).toBe('on-track');
  });

  it('behind outranks not-started, because a late module is the louder signal', () => {
    const r = moduleProgress('legal', [T({ due_date: '2026-01-01' })], today, null);
    expect(r.state).toBe('behind');
  });

  it('uses the PM override when the project carries one', () => {
    const r = moduleProgress('legal', [T(), T()], today, 80);
    expect(r.progressPct).toBe(80);
    expect(r.isOverridden).toBe(true);
  });

  it('ignores an override of zero, which means "auto" in this schema', () => {
    const r = moduleProgress('legal', [T({ kanban_status: 'Done' })], today, 0);
    expect(r.progressPct).toBe(100);
    expect(r.isOverridden).toBe(false);
  });
});

describe('projectModules', () => {
  const today = '2026-06-01';

  it('returns all six modules even when only one carries records', () => {
    const rows = projectModules({}, [T({ module: 'operation' })], today);
    expect(rows.map((r) => r.module)).toEqual(MODULE_ORDER);
    expect(rows.filter((r) => r.state === 'no-data')).toHaveLength(5);
  });

  it('routes each task to its module and reads the matching pct override', () => {
    const rows = projectModules(
      { pct_legal: 40 },
      [T({ module: 'legal' }), T({ module: 'construction', kanban_status: 'Done' })],
      today,
    );
    const by = Object.fromEntries(rows.map((r) => [r.module, r])) as Record<
      ModuleKey,
      (typeof rows)[number]
    >;
    expect(by.legal.progressPct).toBe(40);
    expect(by.construction.progressPct).toBe(100);
    expect(by.operation.total).toBe(0);
  });
});

describe('portfolioModules', () => {
  const today = '2026-06-01';

  it('sums each module across projects, ignoring per-project overrides', () => {
    const projects = [
      { id: 'a', pct_legal: 90 },
      { id: 'b' },
    ];
    const tasks = [
      { ...T({ module: 'legal', kanban_status: 'Done' }), project_id: 'a' },
      { ...T({ module: 'legal' }), project_id: 'b' },
      { ...T({ module: 'operation', due_date: '2026-01-01' }), project_id: 'b' },
    ];
    const rows = portfolioModules(projects, tasks, today);
    const by = Object.fromEntries(rows.map((r) => [r.module, r]));
    expect(by.legal.total).toBe(2);
    expect(by.legal.progressPct).toBe(50);
    expect(by.operation.overdue).toBe(1);
  });

  it('ignores tasks whose project is not in the list', () => {
    const rows = portfolioModules(
      [{ id: 'a' }],
      [{ ...T({ module: 'legal' }), project_id: 'ghost' }],
      today,
    );
    expect(rows.every((r) => r.total === 0)).toBe(true);
  });
});

describe('effectiveProgress', () => {
  it('prefers a non-zero stored percentage', () => {
    expect(effectiveProgress({ progress_pct: 42 }, [])).toBe(42);
  });

  it('derives from done / total when the stored value is 0 or absent', () => {
    expect(
      effectiveProgress({ progress_pct: 0 }, [{ kanban_status: 'Done' }, { kanban_status: 'To Do' }]),
    ).toBe(50);
    expect(effectiveProgress({}, [{ kanban_status: 'Done' }])).toBe(100);
  });

  it('returns 0 rather than NaN for a project with no tasks', () => {
    expect(effectiveProgress({}, [])).toBe(0);
  });
});
