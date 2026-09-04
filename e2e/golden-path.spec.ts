import { test, expect } from '@playwright/test';

/**
 * Golden-path E2E — runs with NEXT_PUBLIC_E2E_BYPASS_AUTH=1 which skips the
 * LoginGate entirely. Data falls back to demo data (dummy Supabase key).
 *
 * Tests the UI rendering layer without needing a real backend or auth.
 */

test('home loads the opening-readiness screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toContainText(/opening readiness/i);
  // The headline is gate completion, not a blended progress percentage.
  await expect(page.getByText(/opening gates signed off|no readiness gates/i)).toBeVisible({
    timeout: 15_000,
  });
  // The department ledger replaces the old KPI strip and S-curve.
  await expect(page.getByText(/departments not clear to open/i)).toBeVisible();
});

test('the look-ahead never lists work that is already overdue', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('section').filter({ hasText: 'Next 14 days' }).first();
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // The old widget had no lower date bound, so it surfaced the most overdue
  // rows in the table. Nothing in this panel may read as past due.
  await expect(panel.getByText(/quá hạn|overdue/i)).toHaveCount(0);
});

test('projects page lists demo projects', async ({ page }) => {
  await page.goto('/projects');
  // The demo dataset was reduced to a single sample project in fae6d62.
  await expect(page.getByText('Le Meridien Fit-out')).toBeVisible({ timeout: 15_000 });
});

test('tasks kanban shows columns', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page.getByText(/to do/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/in progress/i).first()).toBeVisible();
  await expect(page.getByText(/done/i).first()).toBeVisible();
});

test('tasks page separates schedulable work from readiness gates', async ({ page }) => {
  await page.goto('/tasks');
  // Work is the default view; gates get a checklist rather than a Kanban column.
  const work = page.getByRole('button', { name: /^Work \(/ });
  const gates = page.getByRole('button', { name: /^Readiness gates \(/ });
  await expect(work).toBeVisible({ timeout: 15_000 });
  await expect(gates).toBeVisible();
  await expect(work).toHaveAttribute('aria-pressed', 'true');
});

test('budget page says no budget is set rather than showing zeros', async ({ page }) => {
  // The fixture now matches production: budget null, no cost entries. Four
  // counters reading 0 would claim "we have spent nothing"; the truth is that
  // no budget exists.
  await page.goto('/budget');
  await expect(page.getByText(/no budget set for this programme/i)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/total committed/i)).toBeHidden();
});

test('budget and materials are kept out of the nav while they are empty', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('aside');
  await expect(nav.getByRole('link', { name: /opening readiness/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(nav.getByRole('link', { name: /budget/i })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /materials/i })).toHaveCount(0);
  // Still reachable directly — hidden from the nav, not removed.
  await page.goto('/budget');
  await expect(page.locator('h1')).toContainText(/budget/i);
});

test('materials page shows heading', async ({ page }) => {
  await page.goto('/materials');
  await expect(page.locator('h1')).toContainText(/materials/i);
});

test('schedule page renders a Gantt when tasks carry start dates', async ({ page }) => {
  await page.goto('/gantt');
  await expect(page.locator('h1')).toContainText(/schedule/i);
  // The demo fixtures do populate planned_start, so the Gantt path is the one
  // under test here. Against the real programme (planned_start null on every
  // row) the route falls back to the month grid instead.
  await expect(page.getByText(/gantt timeline/i)).toBeVisible({ timeout: 15_000 });
});

test('calendar page renders', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
});

test('roles page renders', async ({ page }) => {
  await page.goto('/team');
  // Named "Roles" because tasks.owner holds role codes, not people.
  await expect(page.locator('h1')).toContainText(/roles/i);
});

test('documents page renders', async ({ page }) => {
  await page.goto('/documents');
  await expect(page.locator('h1')).toContainText(/documents/i);
});

test('project detail loads with milestones', async ({ page }) => {
  // Demo project id '1' = Le Meridien Fit-out
  await page.goto('/projects/1');
  // Match the heading, not any text node: the readiness summary also prints the
  // project name in its "<name> · pre-opening" eyebrow, so a bare getByText is
  // ambiguous under strict mode.
  await expect(
    page.getByRole('heading', { name: 'Le Meridien Fit-out', level: 1 }),
  ).toBeVisible({ timeout: 15_000 });
  // Per-project readiness, scoped to this project rather than the portfolio.
  await expect(page.getByText(/opening gates signed off|no readiness gates/i)).toBeVisible();
  // Milestones section (client component — wait for hydration)
  await expect(page.getByText(/milestones/i).first()).toBeVisible({ timeout: 15_000 });
  // Demo milestone "Design sign-off"
  await expect(page.getByText('Design sign-off')).toBeVisible({ timeout: 15_000 });
});

test('admin/users gates to non-admin (no role in demo mode)', async ({ page }) => {
  await page.goto('/admin/users');
  // In demo mode, getServerRole() returns 'anonymous' → should show "Admin only"
  await expect(page.getByText(/admin only/i)).toBeVisible({ timeout: 15_000 });
});