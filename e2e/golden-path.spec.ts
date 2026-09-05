import { test, expect } from '@playwright/test';

/**
 * Golden-path E2E — runs with NEXT_PUBLIC_E2E_BYPASS_AUTH=1 which skips the
 * LoginGate entirely. Data falls back to demo data (dummy Supabase key).
 *
 * Tests the UI rendering layer without needing a real backend or auth.
 */

test('home reports progress by the six delivery modules', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toContainText(/programme progress/i);
  await expect(page.getByRole('heading', { name: /progress by module/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('heading', { name: /projects by module/i })).toBeVisible();
  // Gate completion stays on the entry screen; it is the load-bearing number
  // before opening, and percentages alone would bury it.
  await expect(page.getByText(/opening gates/i).first()).toBeVisible();
});

test('a module with no records shows no progress bar', async ({ page }) => {
  // moduleProgress once took progressPct from the project's pct_<module>
  // override while stateFor still reported 'no-data', so the card printed "—"
  // and "no records" above a bar filled to the override. The demo fixture sets
  // pct_legal 80 / pct_design 95, so this is the exact reproduction.
  await page.goto('/');
  const section = page.locator('section').filter({ hasText: 'Projects by module' }).first();
  await expect(section).toBeVisible({ timeout: 15_000 });
  for (const bar of await section.locator('[aria-hidden="true"] > div').all()) {
    const width = await bar.evaluate((el) => (el as HTMLElement).style.width);
    expect(width).not.toBe('');
  }
  // Every tile that says "no records" must sit above an empty bar.
  const empties = section.locator('div', { hasText: /^no records$/ });
  for (let i = 0; i < (await empties.count()); i++) {
    const tile = empties.nth(i).locator('xpath=..');
    const fill = tile.locator('[aria-hidden="true"] > div').first();
    if (await fill.count()) {
      expect(await fill.evaluate((el) => (el as HTMLElement).style.width)).toBe('0%');
    }
  }
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
  await expect(nav.getByRole('link', { name: /programme progress/i })).toBeVisible({
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
  // These two assertions used to live on the home page; the module rewrite
  // moved the readiness ledger here, and it must not go unasserted.
  await expect(page.getByText(/opening gates signed off|no readiness gates/i)).toBeVisible();
  await expect(page.getByText(/departments not clear to open/i)).toBeVisible();
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