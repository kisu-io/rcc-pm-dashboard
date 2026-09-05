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

/**
 * The tasks table holds two structurally different populations and every
 * ratio here has to respect that, so the fixtures name which one they are.
 * `zone` is what lib/task-kind.ts falls back to when task_kind is absent.
 */
const W = (over: Record<string, unknown> = {}) => ({
  module: null,
  task_kind: 'work',
  zone: 'ENGINEERING',
  kanban_status: 'To Do',
  due_date: null,
  ...over,
});

const G = (over: Record<string, unknown> = {}) => ({
  module: null,
  task_kind: 'gate',
  zone: '8. Team Readiness',
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
      [W({ kanban_status: 'Done' }), W({ kanban_status: 'Done' }), W(), W()],
      today,
      null,
    );
    expect(r.progressPct).toBe(50);
    expect(r.workDone).toBe(2);
    expect(r.pending).toBe(2);
  });

  it('counts open, dated, past-due rows as overdue and flags behind', () => {
    const r = moduleProgress(
      'operation',
      [W({ due_date: '2026-05-01' }), W({ due_date: '2026-07-01' })],
      today,
      null,
    );
    expect(r.overdue).toBe(1);
    expect(r.state).toBe('behind');
  });

  it('never counts a done row as overdue', () => {
    const r = moduleProgress(
      'operation',
      [W({ kanban_status: 'Done', due_date: '2026-05-01' })],
      today,
      null,
    );
    expect(r.overdue).toBe(0);
    expect(r.state).toBe('complete');
  });

  it('counts undated open rows as unscheduled, not overdue', () => {
    const r = moduleProgress('operation', [W(), W({ due_date: null })], today, null);
    expect(r.unscheduled).toBe(2);
    expect(r.overdue).toBe(0);
  });

  it('reads not-started when nothing is done and nothing is in progress', () => {
    const r = moduleProgress('legal', [W(), W()], today, null);
    expect(r.state).toBe('not-started');
  });

  it('reads on-track once work is moving and nothing is late', () => {
    const r = moduleProgress(
      'legal',
      [W({ kanban_status: 'In Progress' }), W({ due_date: '2026-07-01' })],
      today,
      null,
    );
    expect(r.wip).toBe(1);
    expect(r.state).toBe('on-track');
  });

  it('behind outranks not-started, because a late module is the louder signal', () => {
    const r = moduleProgress('legal', [W({ due_date: '2026-01-01' })], today, null);
    expect(r.state).toBe('behind');
  });

  it('uses the PM override when the project carries one', () => {
    const r = moduleProgress('legal', [W(), W()], today, 80);
    expect(r.progressPct).toBe(80);
    expect(r.isOverridden).toBe(true);
  });

  it('ignores an override of zero, which means "auto" in this schema', () => {
    const r = moduleProgress('legal', [W({ kanban_status: 'Done' })], today, 0);
    expect(r.progressPct).toBe(100);
    expect(r.isOverridden).toBe(false);
  });
});

describe('projectModules', () => {
  const today = '2026-06-01';

  it('returns all six modules even when only one carries records', () => {
    const rows = projectModules({}, [W({ module: 'operation' })], today);
    expect(rows.map((r) => r.module)).toEqual(MODULE_ORDER);
    expect(rows.filter((r) => r.state === 'no-data')).toHaveLength(5);
  });

  it('routes each task to its module and reads the matching pct override', () => {
    const rows = projectModules(
      { pct_legal: 40 },
      [W({ module: 'legal' }), W({ module: 'construction', kanban_status: 'Done' })],
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
      { ...W({ module: 'legal', kanban_status: 'Done' }), project_id: 'a' },
      { ...W({ module: 'legal' }), project_id: 'b' },
      { ...W({ module: 'operation', due_date: '2026-01-01' }), project_id: 'b' },
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
      [{ ...W({ module: 'legal' }), project_id: 'ghost' }],
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

// ---------------------------------------------------------------------------
// Regressions found in pre-merge review. Each of these shipped green because
// the suite never asked the question.
// ---------------------------------------------------------------------------

describe('work and gates are separate populations', () => {
  const today = '2026-06-01';

  /**
   * lib/readiness.ts and lib/task-kind.ts exist because dividing Done by a
   * mixed population produced the "Avg Progress 6%" this codebase already
   * diagnosed and removed. moduleProgress must not reinstate it: on the live
   * programme the honest figures are work 37/356 = 10% and gates 5/323 = 2%.
   * 6% is neither, and it moves when a gate is added and no work changes.
   */
  it('derives progressPct from work only, never from gates', () => {
    const r = moduleProgress(
      'operation',
      [W({ kanban_status: 'Done' }), W(), G(), G(), G(), G()],
      today,
      null,
    );
    expect(r.progressPct).toBe(50); // 1 of 2 work items, not 1 of 6 rows
    expect(r.workTotal).toBe(2);
    expect(r.gatesTotal).toBe(4);
  });

  it('does not move the percentage when a gate is added', () => {
    const work = [W({ kanban_status: 'Done' }), W()];
    const before = moduleProgress('operation', work, today, null).progressPct;
    const after = moduleProgress('operation', [...work, G(), G()], today, null).progressPct;
    expect(after).toBe(before);
  });

  it('reports gates met as their own ratio', () => {
    const r = moduleProgress('operation', [W(), G({ kanban_status: 'Done' }), G()], today, null);
    expect(r.gatesMet).toBe(1);
    expect(r.gatesTotal).toBe(2);
  });

  /**
   * 306 of the live programme's 313 undated open rows are gates, which are
   * SUPPOSED to be undated until someone commits to a date. Counting them as
   * a data gap reported 313 where the real gap is 7.
   */
  it('counts only undated work as unscheduled, never undated gates', () => {
    const r = moduleProgress('operation', [W({ due_date: null }), G(), G(), G()], today, null);
    expect(r.unscheduled).toBe(1);
  });

  it('counts only work as pending and overdue', () => {
    const r = moduleProgress(
      'operation',
      [W({ due_date: '2026-01-01' }), G({ due_date: '2026-01-01' })],
      today,
      null,
    );
    expect(r.pending).toBe(1);
    expect(r.overdue).toBe(1);
  });

  it('is complete only when the work is done AND the gates are met', () => {
    const done = { kanban_status: 'Done' };
    expect(moduleProgress('operation', [W(done), G()], today, null).state).not.toBe('complete');
    expect(moduleProgress('operation', [W(done), G(done)], today, null).state).toBe('complete');
  });

  it('still reads no-data when the module holds neither work nor gates', () => {
    expect(moduleProgress('design', [], today, null).state).toBe('no-data');
  });

  it('reads no-data for a module holding gates but no work, without dividing by zero', () => {
    const r = moduleProgress('legal', [G(), G()], today, null);
    expect(r.progressPct).toBe(0);
    expect(Number.isNaN(r.progressPct)).toBe(false);
    expect(r.gatesTotal).toBe(2);
    expect(r.state).not.toBe('no-data'); // it does hold records
  });
});

describe('a PM override on a module with no records', () => {
  const today = '2026-06-01';

  /**
   * The override exists precisely so a team that has not loaded a workbook can
   * still report progress. Previously progressPct took the override while
   * stateFor short-circuited to 'no-data' on total === 0, so the card printed
   * "—" and "no records" above a bar filled to the override. Both halves have
   * to agree.
   */
  it('is never labelled no-data', () => {
    const r = moduleProgress('legal', [], today, 80);
    expect(r.state).not.toBe('no-data');
    expect(r.progressPct).toBe(80);
    expect(r.isOverridden).toBe(true);
  });

  it('reads complete at 100 and on-track below it', () => {
    expect(moduleProgress('legal', [], today, 100).state).toBe('complete');
    expect(moduleProgress('legal', [], today, 80).state).toBe('on-track');
  });

  it('lets the data decide lateness even when a percentage is overridden', () => {
    // The PM says 100%; a real row is late. Both facts are shown, not merged.
    const r = moduleProgress('legal', [W({ due_date: '2026-01-01' })], today, 100);
    expect(r.progressPct).toBe(100);
    expect(r.isOverridden).toBe(true);
    expect(r.state).toBe('behind');
  });

  it('clamps a nonsensical override into range rather than drawing past the bar', () => {
    expect(moduleProgress('legal', [], today, 140).progressPct).toBe(100);
    expect(moduleProgress('legal', [], today, -20).progressPct).toBe(0);
  });
});
