import { test } from '@playwright/test';
test('log test', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  await page.goto('/');
  await page.waitForTimeout(5000);
});
