import { describe, test, expect } from 'vitest';
import { resolveE2EBypass } from './env';

describe('resolveE2EBypass', () => {
  test('enables the bypass for a development build that asks for it', () => {
    expect(resolveE2EBypass('development', '1')).toBe(true);
  });

  test('enables the bypass for a test build that asks for it', () => {
    expect(resolveE2EBypass('test', '1')).toBe(true);
  });

  test('IGNORES the flag in a production build', () => {
    // The whole point: someone copying the CI env block into Vercel must not be
    // able to ship a build with the login gate switched off.
    expect(resolveE2EBypass('production', '1')).toBe(false);
  });

  test('stays off when the flag is absent or not exactly "1"', () => {
    expect(resolveE2EBypass('development', undefined)).toBe(false);
    expect(resolveE2EBypass('development', 'true')).toBe(false);
    expect(resolveE2EBypass('development', '0')).toBe(false);
  });
});
