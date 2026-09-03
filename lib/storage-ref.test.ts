import { describe, test, expect } from 'vitest';
import { toStorageRef, parseStorageRef } from './documents';

describe('storage refs', () => {
  test('round-trips a bucket and path', () => {
    const ref = toStorageRef('site-photos', 'covers/1234-front.jpg');
    expect(ref).toBe('storage://site-photos/covers/1234-front.jpg');
    expect(parseStorageRef(ref)).toEqual({ bucket: 'site-photos', path: 'covers/1234-front.jpg' });
  });

  test('treats an external https URL as not a storage ref', () => {
    expect(parseStorageRef('https://images.unsplash.com/photo-1566073771259?w=1200')).toBeNull();
  });

  test('handles null and empty values', () => {
    expect(parseStorageRef(null)).toBeNull();
    expect(parseStorageRef('')).toBeNull();
  });

  test('rejects a malformed ref with no path', () => {
    expect(parseStorageRef('storage://documents')).toBeNull();
    expect(parseStorageRef('storage://documents/')).toBeNull();
  });
});
