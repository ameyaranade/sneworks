import { test, expect } from '@playwright/test';
import { setupTracker } from './helpers/auth';
import { clearFirestore, seedSettings } from './helpers/firestore';

test.beforeEach(async ({ page }) => {
  await clearFirestore(page);
  await setupTracker(page);
});

test('shows empty today log on a fresh account', async ({ page }) => {
  await expect(page.getByText("TODAY'S LOG")).toBeVisible();
  // With no activities, the log section should be empty (no entry rows)
  const entries = page.locator('.activity-entry, .log-entry');
  await expect(entries).toHaveCount(0);
});

test('range toggle switches between Today and This Month', async ({ page }) => {
  // "Today" tab is active by default
  const todayBtn = page.getByRole('button', { name: /today/i });
  const monthBtn = page.getByRole('button', { name: /this month/i });

  await expect(todayBtn).toBeVisible();
  await expect(monthBtn).toBeVisible();

  // Clicking "This Month" changes the view
  await monthBtn.click();
  // The date header or period label should reflect the month view
  await expect(page.getByText(/this month/i)).toBeVisible();

  // Clicking back to Today restores the single-day view
  await todayBtn.click();
  await expect(page.getByText("TODAY'S LOG")).toBeVisible();
});

test('opens add-entry drawer when + button is clicked', async ({ page }) => {
  const addBtn = page.locator('.dashboard-add-btn');
  await addBtn.click();

  // The drawer sheet should slide up and show the type picker
  await expect(page.locator('.drawer-sheet')).toBeVisible();
  await expect(page.getByText('Money')).toBeVisible();
  await expect(page.getByText('Health')).toBeVisible();
  await expect(page.getByText('Shopping')).toBeVisible();
});

test('adds a finance expense and it appears in the log', async ({ page }) => {
  // Open drawer
  await page.locator('.dashboard-add-btn').click();
  await page.locator('.drawer-sheet').waitFor();

  // Select "Money" type
  await page.getByText('Money').click();

  // Fill in the finance form
  await page.getByPlaceholder(/amount/i).fill('500');

  // Submit
  await page.getByRole('button', { name: /save|add|submit/i }).click();

  // Drawer should close and entry appear in log
  await expect(page.locator('.drawer-sheet')).not.toBeVisible();

  // The activity should now appear in today's log
  await expect(page.getByText('500')).toBeVisible({ timeout: 5000 });
});
