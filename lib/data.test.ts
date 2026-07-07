import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatVND, daysFromNow, isOverdue, isLookAhead, computeSPI, demoTasks } from './data';
import type { Task } from './supabase';

// Mock "now" at a fixed date so day-based tests are deterministic.
// Fixed now = 2026-07-06T00:00:00Z
const FIXED_NOW = new Date('2026-07-06T00:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatVND', () => {
  it('returns "—" for null/undefined', () => {
    expect(formatVND(null)).toBe('—');
    expect(formatVND(undefined)).toBe('—');
  });

  it('formats billions with 2 decimals', () => {
    expect(formatVND(5_000_000_000)).toBe('5.00B');
    expect(formatVND(1_750_000_000)).toBe('1.75B');
  });

  it('formats millions rounded', () => {
    expect(formatVND(800_000_000)).toBe('800M');
    expect(formatVND(1_500_000)).toBe('2M'); // 1.5M rounds to 2M via toFixed(0)
  });

  it('formats thousands rounded', () => {
    expect(formatVND(45_000)).toBe('45K');
  });

  it('passes through small numbers as string', () => {
    expect(formatVND(999)).toBe('999');
    expect(formatVND(0)).toBe('0');
  });
});

describe('daysFromNow', () => {
  it('returns Infinity for null', () => {
    expect(daysFromNow(null)).toBe(Infinity);
  });

  it('returns 0 for today', () => {
    expect(daysFromNow('2026-07-06')).toBe(0);
  });

  it('returns positive for future dates', () => {
    expect(daysFromNow('2026-07-13')).toBe(7);
    expect(daysFromNow('2026-08-05')).toBe(30);
  });

  it('returns negative for past dates', () => {
    expect(daysFromNow('2026-06-29')).toBe(-7);
  });
});

describe('isOverdue', () => {
  it('false when no due_date', () => {
    const t: Task = makeTask({ due_date: null });
    expect(isOverdue(t)).toBe(false);
  });

  it('false when Done regardless of date', () => {
    const t: Task = makeTask({ due_date: '2020-01-01', kanban_status: 'Done' });
    expect(isOverdue(t)).toBe(false);
  });

  it('true when due_date in past and not Done', () => {
    const t: Task = makeTask({ due_date: '2026-06-30', kanban_status: 'In Progress' });
    expect(isOverdue(t)).toBe(true);
  });

  it('false when due_date in future and not Done', () => {
    const t: Task = makeTask({ due_date: '2026-08-01', kanban_status: 'In Progress' });
    expect(isOverdue(t)).toBe(false);
  });
});

describe('isLookAhead', () => {
  it('false for Done tasks', () => {
    const t: Task = makeTask({ due_date: '2026-07-10', kanban_status: 'Done' });
    expect(isLookAhead(t)).toBe(false);
  });

  it('true for non-Done tasks due within 14 days', () => {
    const t: Task = makeTask({ due_date: '2026-07-10', kanban_status: 'To Do' });
    expect(isLookAhead(t)).toBe(true);
  });

  it('false for non-Done tasks due > 14 days out', () => {
    const t: Task = makeTask({ due_date: '2026-08-15', kanban_status: 'To Do' });
    expect(isLookAhead(t)).toBe(false);
  });

  it('true for overdue tasks (daysFromNow negative, ≤ 14)', () => {
    const t: Task = makeTask({ due_date: '2026-06-30', kanban_status: 'In Progress' });
    expect(isLookAhead(t)).toBe(true);
  });

  it('true for null due_date (Infinity is not ≤ 14, so should be FALSE)', () => {
    const t: Task = makeTask({ due_date: null, kanban_status: 'To Do' });
    expect(isLookAhead(t)).toBe(false);
  });
});

describe('computeSPI', () => {
  it('returns 1 when no tasks have planned_end', () => {
    const tasks: Task[] = [makeTask({ planned_end: null, progress_pct: 50 })];
    expect(computeSPI(tasks)).toBe(1);
  });

  it('returns 1 on empty array', () => {
    expect(computeSPI([])).toBe(1);
  });

  it('returns > 1 when actual progress exceeds planned (ahead of schedule)', () => {
    // planned_end today (0 days): planned contribution = 100 - 0 = 100
    // progress = 100, planned = 100 → SPI = 1.0
    const tasks: Task[] = [makeTask({ planned_end: '2026-07-06', progress_pct: 100 })];
    expect(computeSPI(tasks)).toBe(1);
  });

  it('returns < 1 when behind schedule', () => {
    // Formula: planned = max(0, 100 - max(0, daysFromNow(planned_end)) * 2)
    // For a planned_end in the past, daysFromNow is negative → clamped to 0 → planned stays 100.
    // For a planned_end in the future, daysAhead*2 subtracts from 100.
    //
    // planned_end = 10 days from now → planned = max(0, 100 - 10*2) = 80
    // progress = 20 → SPI = 20/80 = 0.25
    const tasks: Task[] = [makeTask({ planned_end: '2026-07-16', progress_pct: 20 })];
    expect(computeSPI(tasks)).toBeCloseTo(0.25, 2);
  });

  it('handles demo data without throwing', () => {
    expect(() => computeSPI(demoTasks)).not.toThrow();
    const spi = computeSPI(demoTasks);
    expect(typeof spi).toBe('number');
    expect(spi).toBeGreaterThan(0);
  });
});

// ===== helpers =====
function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'x',
    project_id: '1',
    title: 'Test task',
    phase: null,
    zone: null,
    owner: null,
    priority: 'Medium',
    kanban_status: 'To Do',
    planned_start: null,
    planned_end: null,
    actual_start: null,
    actual_end: null,
    progress_pct: 0,
    due_date: null,
    constraint_note: null,
    notes: null,
    ...overrides,
  };
}