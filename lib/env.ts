/**
 * Build-environment gates.
 *
 * `NEXT_PUBLIC_E2E_BYPASS_AUTH` switches off the login gate and swaps the real
 * programme for demo data. It exists so Playwright can drive the app without a
 * backend — but it is a public, build-time variable, and CI sets it in
 * .github/workflows/ci.yml. Anyone copying that env block into Vercel to debug a
 * preview would otherwise ship a production build with no authentication at all.
 *
 * A production build therefore ignores the flag entirely. The E2E suite runs
 * against `next dev`, so it is unaffected.
 */

/** Pure form, so the gate itself can be tested. */
export function resolveE2EBypass(nodeEnv: string | undefined, flag: string | undefined): boolean {
  if (nodeEnv === 'production') return false;
  return flag === '1';
}

// Referenced literally so Next can inline both values at build time.
export const E2E_BYPASS_AUTH = resolveE2EBypass(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH,
);
