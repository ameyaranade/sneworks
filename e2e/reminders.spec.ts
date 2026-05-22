import { test, expect } from '@playwright/test';
import { setupTracker } from './helpers/auth';
import { clearFirestore, seedGenericReminder } from './helpers/firestore';

test.beforeEach(async ({ page }) => {
  await clearFirestore(page);
  await setupTracker(page);
});

test('shows reminders in the reminders page', async ({ page }) => {
  await seedGenericReminder(page, { name: 'Call dentist', dueDate: '2026-05-25' });

  // Navigate to Reminder tab
  await page.getByRole('link', { name: /reminder/i }).click();

  await expect(page.getByText('Call dentist')).toBeVisible({ timeout: 5000 });
});

test('adds a new reminder via the form', async ({ page }) => {
  await page.getByRole('link', { name: /reminder/i }).click();

  // Open the add-reminder form
  const addBtn = page.getByRole('button', { name: /add|\+/i }).first();
  await addBtn.click();

  // Fill in name
  await page.getByPlaceholder(/name|reminder/i).fill('Buy gift');

  // Submit
  await page.getByRole('button', { name: /save|add|create/i }).click();

  await expect(page.getByText('Buy gift')).toBeVisible({ timeout: 5000 });
});

test('completes a reminder and it moves to archived', async ({ page }) => {
  await seedGenericReminder(page, { name: 'Book flight' });

  await page.getByRole('link', { name: /reminder/i }).click();
  await expect(page.getByText('Book flight')).toBeVisible({ timeout: 5000 });

  // Click the complete (circle/check) button
  const completeBtn = page.getByRole('button', { name: /complete|done|✓/i }).first();
  await completeBtn.click();

  // Reminder should leave the active list
  await expect(page.getByText('Book flight')).not.toBeVisible({ timeout: 5000 });

  // Expand "Archived" and confirm it appears there
  const archivedToggle = page.getByText(/archived/i);
  await archivedToggle.click();
  await expect(page.getByText('Book flight')).toBeVisible({ timeout: 5000 });
});

test('deletes a reminder', async ({ page }) => {
  await seedGenericReminder(page, { name: 'Old task' });

  await page.getByRole('link', { name: /reminder/i }).click();
  await expect(page.getByText('Old task')).toBeVisible({ timeout: 5000 });

  // Click the delete button
  const deleteBtn = page.getByRole('button', { name: /delete|×|remove/i }).first();
  await deleteBtn.click();

  await expect(page.getByText('Old task')).not.toBeVisible({ timeout: 5000 });
});

test('dark mode persists on page reload via localStorage', async ({ page }) => {
  // Go to settings and enable dark mode
  await page.getByRole('link', { name: /settings|gear/i }).click().catch(() =>
    page.locator('.btn-nav-settings').click(),
  );

  // Find the dark mode toggle and enable it
  const darkToggle = page.getByRole('checkbox', { name: /dark mode/i });
  if (!(await darkToggle.isChecked())) {
    await darkToggle.click();
  }

  // Reload the page
  await page.reload();
  await page.waitForSelector('.bottom-tab-bar', { timeout: 10_000 });

  // Before React hydrates the theme from Firestore, localStorage should have
  // already applied data-theme="dark" via the blocking script in index.html
  const theme = await page.evaluate(() => document.body.dataset.theme);
  expect(theme).toBe('dark');
});
