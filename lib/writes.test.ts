import { describe, test, expect } from 'vitest';
import { checkWrite, NO_PERMISSION_MESSAGE } from './writes';

describe('checkWrite', () => {
  test('accepts a write that returned the expected row', () => {
    expect(checkWrite(null, [{ id: '1' }], 1)).toEqual({ ok: true });
  });

  test('rejects an RLS-filtered write that reported no error and no rows', () => {
    // PostgREST reports success with zero rows when RLS filters the update out.
    const result = checkWrite(null, [], 1);
    expect(result).toEqual({ ok: false, message: NO_PERMISSION_MESSAGE });
  });

  test('rejects a null data payload', () => {
    expect(checkWrite(null, null)).toEqual({ ok: false, message: NO_PERMISSION_MESSAGE });
  });

  test('translates a row-level security error into the permission message', () => {
    const result = checkWrite({ message: 'new row violates row-level security policy' }, null);
    expect(result).toEqual({ ok: false, message: NO_PERMISSION_MESSAGE });
  });

  test('passes an unrelated database error through verbatim', () => {
    const result = checkWrite({ message: 'duplicate key value violates unique constraint' }, null);
    expect(result).toEqual({ ok: false, message: 'duplicate key value violates unique constraint' });
  });

  test('accepts any number of rows when no expectation is given', () => {
    expect(checkWrite(null, [{ id: '1' }, { id: '2' }])).toEqual({ ok: true });
  });

  test('rejects a row count that does not match the expectation', () => {
    expect(checkWrite(null, [{ id: '1' }, { id: '2' }], 1).ok).toBe(false);
  });
});
