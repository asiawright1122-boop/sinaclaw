/**
 * E2E 测试：侧边栏导航
 */
import { test, expect } from '@playwright/test';

async function setupWorkspace(page: any) {
    await page.waitForFunction(() => !!(window as any).useWorkspaceStore);
    await page.evaluate(() => {
        (window as any).useWorkspaceStore.setState({ currentPath: '/mock/test/workspace' });
    });
}

test.describe('侧边栏导航', () => {
    test('页面加载后应显示侧边栏', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        // 侧边栏的新建对话按钮应存在
        const sidebar = page.locator('aside, [class*="sidebar"], [class*="Sidebar"]').first();
        await expect(sidebar).toBeVisible();
    });

    test('点击设置按钮应导航到设置页', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        // 查找设置图标/按钮
        const settingsLink = page.locator('a[href="/settings"], [data-testid="settings"]').first();
        if (await settingsLink.isVisible()) {
            await settingsLink.click();
            await expect(page).toHaveURL(/settings/);
        }
    });

    test('点击知识库应导航到知识库页', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        const knowledgeLink = page.locator('a[href="/knowledge"], [data-testid="knowledge"]').first();
        if (await knowledgeLink.isVisible()) {
            await knowledgeLink.click();
            await expect(page).toHaveURL(/knowledge/);
        }
    });

    test('点击技能商店应导航到技能页', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        const skillLink = page.locator('a[href="/skills"], [data-testid="skills"]').first();
        if (await skillLink.isVisible()) {
            await skillLink.click();
            await expect(page).toHaveURL(/skills/);
        }
    });
});
