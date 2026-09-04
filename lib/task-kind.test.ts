import { describe, test, expect } from 'vitest';
import {
  classifyTaskKind,
  isGate,
  isWork,
  partitionByKind,
  hasDayPrecisionDates,
  toDueMonth,
} from './task-kind';

describe('classifyTaskKind', () => {
  test('prefers the explicit task_kind column over the zone heuristic', () => {
    // Arrange — a zone that would otherwise infer 'gate'
    const task = { task_kind: 'work', zone: '8. Team Readiness' };

    // Act
    const kind = classifyTaskKind(task);

    // Assert
    expect(kind).toBe('work');
  });

  test('ignores an unrecognised task_kind value and falls back to zone', () => {
    expect(classifyTaskKind({ task_kind: 'banana', zone: 'ENGINEERING' })).toBe('work');
    expect(classifyTaskKind({ task_kind: '', zone: '3. Licences' })).toBe('gate');
  });

  test('treats a numbered checklist heading as a readiness gate', () => {
    expect(classifyTaskKind({ zone: '8. Team Readiness' })).toBe('gate');
    expect(classifyTaskKind({ zone: '10. Technology & Information Security' })).toBe('gate');
    expect(classifyTaskKind({ zone: '4. Fire, Life Safety & Emergency' })).toBe('gate');
  });

  test('treats a missing or blank zone as a readiness gate', () => {
    // The 15 Finance rows in production carry no zone at all and no owner.
    expect(classifyTaskKind({ zone: null })).toBe('gate');
    expect(classifyTaskKind({ zone: '   ' })).toBe('gate');
    expect(classifyTaskKind({})).toBe('gate');
  });

  test('treats a workbook or named-section zone as schedulable work', () => {
    expect(classifyTaskKind({ zone: 'ENGINEERING' })).toBe('work');
    expect(classifyTaskKind({ zone: 'EXECUTIVE HOUSEKEEPER' })).toBe('work');
    expect(classifyTaskKind({ zone: 'ACCOUNTING/PROCUREMENT' })).toBe('work');
    expect(classifyTaskKind({ zone: 'Final 60 days' })).toBe('work');
    expect(classifyTaskKind({ zone: 'OS&E' })).toBe('work');
    expect(classifyTaskKind({ zone: 'FF&E/Kitchen' })).toBe('work');
  });

  test('does not mistake a zone that merely contains digits for a heading', () => {
    // Only a leading "<n>." marks a checklist heading.
    expect(classifyTaskKind({ zone: 'Floor 12' })).toBe('work');
    expect(classifyTaskKind({ zone: 'Final 60 days' })).toBe('work');
  });

  test('isGate and isWork agree with classifyTaskKind', () => {
    const gate = { zone: '1. Governance' };
    const work = { zone: 'SECURITY' };
    expect(isGate(gate)).toBe(true);
    expect(isWork(gate)).toBe(false);
    expect(isGate(work)).toBe(false);
    expect(isWork(work)).toBe(true);
  });
});

describe('partitionByKind', () => {
  test('splits a mixed list and preserves order within each side', () => {
    // Arrange
    const tasks = [
      { id: 'w1', zone: 'ENGINEERING' },
      { id: 'g1', zone: '2. Landscape Handover' },
      { id: 'w2', zone: 'Training' },
      { id: 'g2', zone: null },
    ];

    // Act
    const { work, gates } = partitionByKind(tasks);

    // Assert
    expect(work.map((t) => t.id)).toEqual(['w1', 'w2']);
    expect(gates.map((t) => t.id)).toEqual(['g1', 'g2']);
  });

  test('returns empty sides for an empty input', () => {
    expect(partitionByKind([])).toEqual({ work: [], gates: [] });
  });
});

describe('hasDayPrecisionDates', () => {
  test('returns false when dates are month buckets', () => {
    // Arrange — mirrors production: 319 of 366 land on the 1st or the 15th.
    const tasks = [
      { due_date: '2026-08-01' },
      { due_date: '2026-08-01' },
      { due_date: '2026-07-01' },
      { due_date: '2026-08-15' },
      { due_date: '2026-09-20' },
    ];

    // Act / Assert — 4 of 5 on a boundary is 80%, above the 60% threshold
    expect(hasDayPrecisionDates(tasks)).toBe(false);
  });

  test('returns true when dates look like real deadlines', () => {
    const tasks = [
      { due_date: '2026-08-03' },
      { due_date: '2026-08-11' },
      { due_date: '2026-08-19' },
      { due_date: '2026-08-27' },
      { due_date: '2026-09-01' },
    ];
    expect(hasDayPrecisionDates(tasks)).toBe(true);
  });

  test('returns false when nothing is dated', () => {
    expect(hasDayPrecisionDates([{ due_date: null }, {}])).toBe(false);
    expect(hasDayPrecisionDates([])).toBe(false);
  });
});

describe('toDueMonth', () => {
  test('collapses a date to the first of its month', () => {
    expect(toDueMonth('2026-08-15')).toBe('2026-08-01');
    expect(toDueMonth('2026-08-01')).toBe('2026-08-01');
    expect(toDueMonth('2026-12-31')).toBe('2026-12-01');
  });

  test('passes null through', () => {
    expect(toDueMonth(null)).toBeNull();
    expect(toDueMonth(undefined)).toBeNull();
  });
});
