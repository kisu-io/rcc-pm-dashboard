import { describe, test, expect } from 'vitest';
import {
  dayDiff,
  todayISO,
  isOverdueOn,
  departmentReadiness,
  programmeReadiness,
  lookAhead,
  overdueWork,
  unscheduledByDepartment,
  monthGrid,
  portfolioReadiness,
  type ReadinessTask,
} from './readiness';

/** The real programme dates, so the fixtures read like the thing they model. */
const TODAY = '2026-09-03';
const OPENING = '2026-10-01';

let seq = 0;
function work(over: Partial<ReadinessTask> = {}): ReadinessTask {
  return {
    id: `w${seq++}`,
    title: 'Order critical parts and supplies',
    phase: 'Engineering',
    zone: 'ENGINEERING',
    owner: 'CE/MM',
    kanban_status: 'To Do',
    due_date: null,
    constraint_note: null,
    ...over,
  };
}

function gate(over: Partial<ReadinessTask> = {}): ReadinessTask {
  return {
    id: `g${seq++}`,
    title: 'Security Systems Ready',
    phase: 'Security',
    zone: '7. Operational Readiness',
    owner: null,
    kanban_status: 'To Do',
    due_date: null,
    constraint_note: null,
    ...over,
  };
}

describe('dayDiff', () => {
  test('counts forward as positive and backward as negative', () => {
    expect(dayDiff(TODAY, '2026-10-01')).toBe(28);
    expect(dayDiff(TODAY, TODAY)).toBe(0);
    expect(dayDiff(TODAY, '2026-01-31')).toBe(-215);
  });

  test('is timezone-stable because both sides parse as UTC midnight', () => {
    // The old helper compared a parsed date to Date.now(), so the answer moved
    // by a day either side of midnight depending on the viewer's offset.
    expect(dayDiff('2026-09-03', '2026-09-04')).toBe(1);
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
  });

  test('returns null for an unparseable date', () => {
    expect(dayDiff(TODAY, 'not-a-date')).toBeNull();
    expect(dayDiff('', TODAY)).toBeNull();
  });
});

describe('todayISO', () => {
  test('formats a Date as a zero-padded ISO calendar day', () => {
    expect(todayISO(new Date(2026, 8, 3))).toBe('2026-09-03');
    expect(todayISO(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('isOverdueOn', () => {
  test('an undated row is never overdue', () => {
    // 306 of 323 readiness gates carry no date — they are not late, they are
    // acceptance criteria awaiting a commitment.
    expect(isOverdueOn(gate({ due_date: null }), TODAY)).toBe(false);
  });

  test('a done row is never overdue even with a past date', () => {
    expect(isOverdueOn(work({ due_date: '2026-01-31', kanban_status: 'Done' }), TODAY)).toBe(false);
  });

  test('an open row with a past date is overdue', () => {
    expect(isOverdueOn(work({ due_date: '2026-08-01' }), TODAY)).toBe(true);
  });

  test('a row due today is not yet overdue', () => {
    expect(isOverdueOn(work({ due_date: TODAY }), TODAY)).toBe(false);
  });
});

describe('departmentReadiness', () => {
  test('counts gates and work separately rather than as one population', () => {
    // Arrange — 2 gates (1 met) and 3 work items (2 overdue, 1 in progress)
    const tasks = [
      gate({ phase: 'Engineering', kanban_status: 'Done' }),
      gate({ phase: 'Engineering' }),
      work({ phase: 'Engineering', due_date: '2026-08-01' }),
      work({ phase: 'Engineering', due_date: '2026-07-01' }),
      work({ phase: 'Engineering', due_date: '2026-09-10', kanban_status: 'In Progress' }),
    ];

    // Act
    const [row] = departmentReadiness(tasks, TODAY);

    // Assert
    expect(row.department).toBe('Engineering');
    expect(row.gates).toBe(2);
    expect(row.gatesMet).toBe(1);
    expect(row.workOpen).toBe(3);
    expect(row.workOverdue).toBe(2);
    expect(row.workWip).toBe(1);
  });

  test('flags a department with gates but no owner and no schedule as not-mobilised', () => {
    // Arrange — Legal, Landscape, Admin & HR, Services and Finance are all in
    // this state in production: 141 gates between them, zero owners.
    const tasks = [
      gate({ phase: 'Legal', zone: '4. Contracts', owner: null }),
      gate({ phase: 'Legal', zone: '5. Policies', owner: null }),
    ];

    // Act
    const [row] = departmentReadiness(tasks, TODAY);

    // Assert
    expect(row.status).toBe('not-mobilised');
    expect(row.owners).toEqual([]);
    expect(row.workOpen).toBe(0);
  });

  test('flags a department whose every open item is late as nothing-moved', () => {
    const tasks = [
      work({ phase: 'Events', zone: 'EVENTS', due_date: '2026-07-01' }),
      work({ phase: 'Events', zone: 'EVENTS', due_date: '2026-08-01' }),
    ];
    expect(departmentReadiness(tasks, TODAY)[0].status).toBe('nothing-moved');
  });

  test('distinguishes behind from on-track', () => {
    const behind = [
      work({ phase: 'Culinary', due_date: '2026-08-01' }),
      work({ phase: 'Culinary', due_date: '2026-09-15' }),
    ];
    expect(departmentReadiness(behind, TODAY)[0].status).toBe('behind');

    const onTrack = [
      work({ phase: 'Culinary', due_date: '2026-09-15' }),
      work({ phase: 'Culinary', due_date: '2026-09-20' }),
    ];
    expect(departmentReadiness(onTrack, TODAY)[0].status).toBe('on-track');
  });

  test('marks a department clear only when every gate is met and no work is open', () => {
    const tasks = [
      gate({ phase: 'IT & Comms', kanban_status: 'Done' }),
      work({ phase: 'IT & Comms', kanban_status: 'Done', due_date: '2026-06-01' }),
    ];
    expect(departmentReadiness(tasks, TODAY)[0].status).toBe('clear');
  });

  test('sorts not-mobilised above merely-behind departments', () => {
    // A department with nobody assigned is a worse position at T-28 than one
    // that is late but staffed, so it must surface first.
    const tasks = [
      work({ phase: 'Engineering', due_date: '2026-08-01' }),
      work({ phase: 'Engineering', due_date: '2026-09-20' }),
      gate({ phase: 'Legal', owner: null }),
    ];
    expect(departmentReadiness(tasks, TODAY).map((r) => r.department)).toEqual([
      'Legal',
      'Engineering',
    ]);
  });

  test('groups rows with a missing phase under Unassigned', () => {
    expect(departmentReadiness([work({ phase: null })], TODAY)[0].department).toBe('Unassigned');
  });
});

describe('programmeReadiness', () => {
  test('reports gate completion, not a blended progress percentage', () => {
    // Arrange
    const tasks = [
      gate({ kanban_status: 'Done' }),
      gate(),
      gate(),
      work({ due_date: '2026-08-01' }),
      work({ due_date: '2026-09-10' }),
    ];

    // Act
    const p = programmeReadiness(tasks, TODAY, OPENING);

    // Assert
    expect(p.gatesTotal).toBe(3);
    expect(p.gatesMet).toBe(1);
    expect(p.workOpen).toBe(2);
    expect(p.workOverdue).toBe(1);
    expect(p.daysToOpening).toBe(28);
  });

  test('the fortnight count excludes overdue work', () => {
    // This is the defect the old look-ahead had: no lower bound.
    const tasks = [
      work({ due_date: '2026-01-31' }),
      work({ due_date: '2026-08-01' }),
      work({ due_date: '2026-09-10' }),
      work({ due_date: '2026-09-17' }),
      work({ due_date: '2026-09-30' }),
    ];
    const p = programmeReadiness(tasks, TODAY, OPENING);
    expect(p.dueNextFortnight).toBe(2);
    expect(p.dueBeforeOpening).toBe(3);
  });

  test('counts undated open rows without calling them overdue', () => {
    const tasks = [gate(), gate(), work({ due_date: null })];
    const p = programmeReadiness(tasks, TODAY, OPENING);
    expect(p.undatedOpen).toBe(3);
    expect(p.workOverdue).toBe(0);
  });

  test('collects the not-mobilised and nothing-moved departments', () => {
    const tasks = [
      gate({ phase: 'Legal', owner: null }),
      work({ phase: 'Events', due_date: '2026-07-01' }),
      work({ phase: 'Culinary', due_date: '2026-09-20' }),
    ];
    const p = programmeReadiness(tasks, TODAY, OPENING);
    expect(p.notMobilised.map((d) => d.department)).toEqual(['Legal']);
    expect(p.nothingMoved.map((d) => d.department)).toEqual(['Events']);
    expect(p.departmentCount).toBe(3);
  });

  test('tolerates a project with no target date', () => {
    const p = programmeReadiness([work()], TODAY, null);
    expect(p.daysToOpening).toBeNull();
    expect(p.dueBeforeOpening).toBe(0);
  });
});

describe('lookAhead', () => {
  test('excludes overdue work and includes only the coming fortnight', () => {
    // Arrange — the old widget sorted these ascending with no lower bound and
    // showed the January row first.
    const tasks = [
      work({ id: 'jan', due_date: '2026-01-31' }),
      work({ id: 'soon', due_date: '2026-09-07' }),
      work({ id: 'edge', due_date: '2026-09-17' }),
      work({ id: 'later', due_date: '2026-09-30' }),
      work({ id: 'today', due_date: TODAY }),
    ];

    // Act
    const rows = lookAhead(tasks, TODAY, 14);

    // Assert — today included, horizon edge included, past and beyond excluded
    expect(rows.map((t) => t.id)).toEqual(['today', 'soon', 'edge']);
  });

  test('excludes done work', () => {
    const tasks = [work({ due_date: '2026-09-07', kanban_status: 'Done' })];
    expect(lookAhead(tasks, TODAY, 14)).toHaveLength(0);
  });

  test('returns an empty list rather than throwing when nothing is dated', () => {
    expect(lookAhead([gate(), gate()], TODAY)).toEqual([]);
  });
});

describe('overdueWork', () => {
  test('returns only work items, most overdue first', () => {
    const tasks = [
      work({ id: 'aug', due_date: '2026-08-01' }),
      gate({ id: 'g', due_date: '2026-07-01' }),
      work({ id: 'jan', due_date: '2026-01-31' }),
    ];
    expect(overdueWork(tasks, TODAY).map((t) => t.id)).toEqual(['jan', 'aug']);
  });
});

describe('unscheduledByDepartment', () => {
  test('splits undated gates from undated work per department', () => {
    // Arrange
    const tasks = [
      gate({ phase: 'Services' }),
      gate({ phase: 'Services' }),
      work({ phase: 'Services', due_date: null }),
      work({ phase: 'Engineering', due_date: null }),
      work({ phase: 'Engineering', due_date: '2026-08-01' }),
    ];

    // Act
    const rows = unscheduledByDepartment(tasks);

    // Assert — biggest group first, dated rows ignored
    expect(rows).toEqual([
      { department: 'Services', gates: 2, work: 1 },
      { department: 'Engineering', gates: 0, work: 1 },
    ]);
  });

  test('ignores completed rows', () => {
    expect(unscheduledByDepartment([gate({ kanban_status: 'Done' })])).toEqual([]);
  });
});

describe('portfolioReadiness', () => {
  const PROJECTS = [
    { id: 'p1', name: 'Chateau De Saigon', status: 'In Progress', target_end: '2026-10-01' },
    { id: 'p2', name: 'Villa Da Lat', status: 'In Progress', target_end: '2026-12-01' },
  ];

  test('keeps each project gates and work separate rather than pooling them', () => {
    // Arrange — the same department name in both projects, which the flat
    // aggregation would have merged into a single row.
    const tasks = [
      gate({ project_id: 'p1', phase: 'Engineering', kanban_status: 'Done' }),
      gate({ project_id: 'p1', phase: 'Engineering' }),
      work({ project_id: 'p1', phase: 'Engineering', due_date: '2026-08-01' }),
      gate({ project_id: 'p2', phase: 'Engineering' }),
      work({ project_id: 'p2', phase: 'Engineering', due_date: '2026-11-01' }),
    ];

    // Act
    const rows = portfolioReadiness(PROJECTS, tasks, TODAY);

    // Assert
    const p1 = rows.find((r) => r.projectId === 'p1')!;
    const p2 = rows.find((r) => r.projectId === 'p2')!;
    expect(p1.gatesTotal).toBe(2);
    expect(p1.gatesMet).toBe(1);
    expect(p1.workOverdue).toBe(1);
    expect(p2.gatesTotal).toBe(1);
    expect(p2.gatesMet).toBe(0);
    expect(p2.workOverdue).toBe(0);
  });

  test('counts days to opening from each project own target date', () => {
    const rows = portfolioReadiness(PROJECTS, [], TODAY);
    expect(rows.find((r) => r.projectId === 'p1')!.daysToOpening).toBe(28);
    expect(rows.find((r) => r.projectId === 'p2')!.daysToOpening).toBe(89);
  });

  test('sorts worst risk first, then by nearest opening', () => {
    // p2 has an unmobilised department; p1 is merely behind.
    const tasks = [
      work({ project_id: 'p1', phase: 'Culinary', due_date: '2026-08-01' }),
      work({ project_id: 'p1', phase: 'Culinary', due_date: '2026-09-20' }),
      gate({ project_id: 'p2', phase: 'Legal', owner: null }),
    ];
    expect(portfolioReadiness(PROJECTS, tasks, TODAY).map((r) => r.projectId)).toEqual([
      'p2',
      'p1',
    ]);
  });

  test('ignores tasks belonging to no known project instead of misattributing them', () => {
    const tasks = [
      work({ project_id: 'ghost', phase: 'Engineering', due_date: '2026-08-01' }),
      work({ project_id: 'p1', phase: 'Engineering', due_date: '2026-08-01' }),
    ];
    const rows = portfolioReadiness(PROJECTS, tasks, TODAY);
    expect(rows.find((r) => r.projectId === 'p1')!.workOpen).toBe(1);
    expect(rows.reduce((s, r) => s + r.workOpen, 0)).toBe(1);
  });

  test('returns a row per project even when a project has no tasks', () => {
    const rows = portfolioReadiness(PROJECTS, [], TODAY);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.gatesTotal === 0 && r.workOpen === 0)).toBe(true);
    expect(rows.every((r) => r.risk === 'clear')).toBe(true);
  });
});

describe('monthGrid', () => {
  test('builds sorted month columns and one aligned cell per department', () => {
    // Arrange
    const tasks = [
      work({ phase: 'Engineering', due_date: '2026-08-01' }),
      work({ phase: 'Engineering', due_date: '2026-08-15', kanban_status: 'Done' }),
      work({ phase: 'Culinary', due_date: '2026-07-01' }),
      work({ phase: 'Culinary', due_date: null }),
    ];

    // Act
    const grid = monthGrid(tasks, TODAY);

    // Assert
    expect(grid.months).toEqual(['2026-07', '2026-08']);
    const eng = grid.rows.find((r) => r.department === 'Engineering')!;
    expect(eng.cells.map((c) => c.total)).toEqual([0, 2]);
    expect(eng.cells[1].done).toBe(1);
    expect(eng.cells[1].overdue).toBe(1);
    const cul = grid.rows.find((r) => r.department === 'Culinary')!;
    expect(cul.undated).toBe(1);
    expect(cul.cells.map((c) => c.total)).toEqual([1, 0]);
  });

  test('returns no columns when nothing is dated', () => {
    const grid = monthGrid([gate(), gate()], TODAY);
    expect(grid.months).toEqual([]);
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0].undated).toBe(2);
  });
});
