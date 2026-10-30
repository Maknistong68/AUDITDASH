import { expect, test } from '@playwright/test';

test('the Contractors page lists the register with each quarter\'s sub-region', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('main-nav').getByRole('link', { name: 'Contractors' }).click();
  await expect(page).toHaveURL(/\/contractors/);
  await expect(page.getByTestId('register-row')).toHaveCount(12);
  const jv = page.getByTestId('register-row').filter({ hasText: 'JV-ECH' });
  await expect(jv.getByTestId('register-region')).toHaveText(['SR2', 'SR2']);
  // nobody moved between Q4 2025 and Q1 2026 in the current workbook
  await expect(page.locator('[data-testid="register-region"][data-moved]')).toHaveCount(0);
  await jv.getByRole('link').click();
  await expect(page).toHaveURL(/\/contractor\/4800001131/);
});
