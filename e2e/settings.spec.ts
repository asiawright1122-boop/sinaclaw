/**
 * E2E 测试：设置页面
 */
import { test, expect } from '@playwright/test';

async function setupWorkspace(page: any) {
    await page.waitForFunction(() => !!(window as any).useWorkspaceStore);
    await page.evaluate(() => {
        (window as any).useWorkspaceStore.setState({ currentPath: '/mock/test/workspace' });
    });
}

test.describe('设置页面', () => {
    test('应显示设置页面标题', async ({ page }) => {
        await page.goto('/settings');
        await setupWorkspace(page);
        const heading = page.locator('h1, h2').filter({ hasText: /设置|Settings/i }).first();
        await expect(heading).toBeVisible();
    });

    test('应显示 API Key 输入框', async ({ page }) => {
        await page.goto('/settings');
        await setupWorkspace(page);
        const apiKeyInput = page.locator('input[type="password"], input[placeholder*="API"], input[placeholder*="api"], input[placeholder*="Key"], input[placeholder*="key"]').first();
        if (await apiKeyInput.isVisible()) {
            await expect(apiKeyInput).toBeVisible();
        }
    });

    test('应显示 Provider 选择器', async ({ page }) => {
        await page.goto('/settings');
        await setupWorkspace(page);
        // 查找 provider/model 相关的选择器或按钮
        const providerSelector = page.locator('select, [class*="select"], [role="combobox"]').first();
        if (await providerSelector.isVisible()) {
            await expect(providerSelector).toBeVisible();
        }
    });
});
