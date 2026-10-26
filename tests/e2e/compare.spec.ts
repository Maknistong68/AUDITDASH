import { test, expect } from '@playwright/test';

const compare = (name: string) => ({ name: `Compare ${name}`, exact: true });

test('selecting two cards opens the tray with two columns', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.goto('/');
  await expect(page.getByTestId('compare-tray')).toHaveCount(0);
  await expect(page.getByTestId('scoreboard')).toHaveAttribute('data-hydrated', '');
  await page.getByRole('button', compare('JV-ECH (Port T1)')).click();
  await expect(page.getByTestId('compare-tray')).toHaveCount(0);
  await page.getByRole('button', compare('PPCO')).click();
  const tray = page.getByTestId('compare-tray');
  await expect(tray).toBeVisible();
  await expect(tray.getByTestId('compare-column')).toHaveCount(2);
  await expect(tray.getByTestId('compare-column').first().getByTestId('compare-gap')).toHaveCount(10);
  await expect(page).toHaveURL(/c=4800001131%2C4800001322|c=4800001131,4800001322/);
  // toggling does not navigate to the contractor page
  await expect(page).not.toHaveURL(/contractor\//);
});

test('a fourth toggle is disabled after three are selected', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.goto('/?c=4800001131,4800001322,4800000838');
  await expect(page.getByTestId('compare-tray').getByTestId('compare-column')).toHaveCount(3);
  await expect(page.getByRole('button', compare('TDP'))).toBeDisabled();
  await expect(page.getByRole('button', compare('PPCO'))).toBeEnabled();
});

test('deep link opens the tray and survives refresh', async ({ page }) => {
  await page.goto('/?c=4800001131,4800001322');
  await expect(page.getByTestId('compare-tray').getByTestId('compare-column')).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId('compare-tray').getByTestId('compare-column')).toHaveCount(2);
});

test('Esc closes the tray and removes c', async ({ page }) => {
  await page.goto('/?c=4800001131,4800001322');
  await expect(page.getByTestId('compare-tray')).toHaveAttribute('data-keys', 'ready');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('compare-tray')).toHaveCount(0);
  await expect(page).not.toHaveURL(/c=/);
});

test('close button closes the tray and removes c', async ({ page }) => {
  await page.goto('/?q=all&r=SR1,SR2&c=4800001131,4800001322');
  await expect(page.getByTestId('compare-tray')).toHaveAttribute('data-keys', 'ready');
  await page.getByRole('button', { name: 'Close compare' }).click();
  await expect(page.getByTestId('compare-tray')).toHaveCount(0);
  await expect(page).not.toHaveURL(/c=/);
  await expect(page).toHaveURL(/q=all/);
});
