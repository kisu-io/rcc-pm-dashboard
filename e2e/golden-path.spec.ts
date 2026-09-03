import { test, expect } from '@playwright/test';

/**
 * Golden-path E2E — runs with NEXT_PUBLIC_E2E_BYPASS_AUTH=1 which skips the
 * LoginGate entirely. Data falls back to demo data (dummy Supabase key).
 *
 * Tests the UI rendering layer without needing a real backend or auth.
 */

test('home loads with dashboard heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toContainText(/dashboard/i);
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

test('budget page renders with total committed', async ({ page }) => {
  await page.goto('/budget');
  await expect(page.getByText(/total committed/i)).toBeVisible({ timeout: 15_000 });
  // Demo data total budget = the single sample project's 5e9.
  await expect(page.getByText(/5\.00B/).first()).toBeVisible();
});

test('materials page shows heading', async ({ page }) => {
  await page.goto('/materials');
  await expect(page.locator('h1')).toContainText(/materials/i);
});

test('gantt page renders', async ({ page }) => {
  await page.goto('/gantt');
  await expect(page.locator('h1')).toContainText(/gantt/i);
});

test('calendar page renders', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
});

test('team page renders', async ({ page }) => {
  await page.goto('/team');
  await expect(page.locator('h1')).toContainText(/team/i);
});

test('documents page renders', async ({ page }) => {
  await page.goto('/documents');
  await expect(page.locator('h1')).toContainText(/documents/i);
});

test('project detail loads with milestones', async ({ page }) => {
  // Demo project id '1' = Le Meridien Fit-out
  await page.goto('/projects/1');
  await expect(page.getByText('Le Meridien Fit-out')).toBeVisible({ timeout: 15_000 });
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