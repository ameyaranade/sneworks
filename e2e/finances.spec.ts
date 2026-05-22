import { test, expect } from '@playwright/test';
import { setupTracker } from './helpers/auth';
import { clearFirestore, seedFinanceReminder } from './helpers/firestore';

test.beforeEach(async ({ page }) => {
  await clearFirestore(page);
  await setupTracker(page);
});

test('shows recurring bill in the Finances page', async ({ page }) => {
  await seedFinanceReminder(page, {
    name: 'Netflix',
    amount: 599,
    frequency: 'monthly',
    dueDay: 22,
  });

  // Navigate to Finances tab
  await page.getByRole('link', { name: /money/i }).click();
  await expect(page.getByText('Netflix')).toBeVisible({ timeout: 5000 });
});

test('marks a recurring bill as paid', async ({ page }) => {
  await seedFinanceReminder(page, {
    name: 'Spotify',
    amount: 199,
    frequency: 'monthly',
    dueDay: 22, // today
  });

  await page.getByRole('link', { name: /money/i }).click();
  await expect(page.getByText('Spotify')).toBeVisible({ timeout: 5000 });

  // Find and click the "Mark Paid" button for this reminder
  const markPaidBtn = page.getByRole('button', { name: /mark paid/i });
  await markPaidBtn.click();

  // The due indicator should now show "Paid"
  await expect(page.getByText(/paid/i).first()).toBeVisible({ timeout: 5000 });
});

test('skips a recurring bill', async ({ page }) => {
  await seedFinanceReminder(page, {
    name: 'Internet',
    amount: 999,
    frequency: 'monthly',
    dueDay: 22,
  });

  await page.getByRole('link', { name: /money/i }).click();
  await expect(page.getByText('Internet')).toBeVisible({ timeout: 5000 });

  // Click the "Skip" button
  const skipBtn = page.getByRole('button', { name: /skip/i });
  await skipBtn.click();

  // The indicator should update to "Skipped"
  await expect(page.getByText(/skipped/i).first()).toBeVisible({ timeout: 5000 });
});

test('deletes a recurring bill', async ({ page }) => {
  await seedFinanceReminder(page, {
    name: 'Old Subscription',
    amount: 100,
    frequency: 'monthly',
    dueDay: 22,
  });

  await page.getByRole('link', { name: /money/i }).click();
  await expect(page.getByText('Old Subscription')).toBeVisible({ timeout: 5000 });

  // The recurring bills section has a delete (×) button per row
  const deleteBtn = page.getByRole('button', { name: /delete|×|remove/i }).first();
  await deleteBtn.click();

  // Confirm deletion if a dialog appears
  const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click();
  }

  // Bill should be gone
  await expect(page.getByText('Old Subscription')).not.toBeVisible({ timeout: 5000 });
});
