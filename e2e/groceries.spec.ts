import { test, expect } from '@playwright/test';
import { setupTracker } from './helpers/auth';
import { clearFirestore, seedGroceryItem } from './helpers/firestore';

test.beforeEach(async ({ page }) => {
  await clearFirestore(page);
  await setupTracker(page);
});

test('shows grocery items in the shop list', async ({ page }) => {
  await seedGroceryItem(page, { name: 'Milk', sortOrder: 0 });
  await seedGroceryItem(page, { name: 'Bread', sortOrder: 1 });

  // Navigate to Shop tab
  await page.getByRole('link', { name: /shop/i }).click();

  await expect(page.getByText('Milk')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Bread')).toBeVisible({ timeout: 5000 });
});

test('checks a grocery item and it shows as checked', async ({ page }) => {
  await seedGroceryItem(page, { name: 'Eggs' });

  await page.getByRole('link', { name: /shop/i }).click();
  await expect(page.getByText('Eggs')).toBeVisible({ timeout: 5000 });

  // Click the checkbox next to the item
  const checkbox = page.getByRole('checkbox').first();
  await checkbox.click();

  // The checkbox should now be checked
  await expect(checkbox).toBeChecked({ timeout: 5000 });
});

test('archives a grocery trip', async ({ page }) => {
  await seedGroceryItem(page, { name: 'Butter' });

  await page.getByRole('link', { name: /shop/i }).click();
  await expect(page.getByText('Butter')).toBeVisible({ timeout: 5000 });

  // Check the item first (archive button appears when items are checked)
  await page.getByRole('checkbox').first().click();

  // Click the "Done (1)" / archive button
  const archiveBtn = page.getByRole('button', { name: /done|archive/i });
  await archiveBtn.click();

  // Confirm the trip if a modal/form appears
  const confirmBtn = page.getByRole('button', { name: /save|confirm|archive/i });
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click();
  }

  // Active list should be empty; Past Trips section should appear
  await expect(page.getByText('Butter')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/past trips/i)).toBeVisible({ timeout: 5000 });
});

test('adds a new grocery item via the add form', async ({ page }) => {
  await page.getByRole('link', { name: /shop/i }).click();

  // Open the add-item form
  const addBtn = page.getByRole('button', { name: /add|new item|\+/i }).first();
  await addBtn.click();

  // Fill in the item name
  const input = page.getByPlaceholder(/item|name/i);
  await input.fill('Orange Juice');
  await page.getByRole('button', { name: /add|save/i }).click();

  await expect(page.getByText('Orange Juice')).toBeVisible({ timeout: 5000 });
});
