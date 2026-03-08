/**
 * E2E 测试：聊天功能
 */
import { test, expect } from '@playwright/test';

async function setupWorkspace(page: any) {
    await page.waitForFunction(() => !!(window as any).useWorkspaceStore);
    await page.evaluate(() => {
        (window as any).useWorkspaceStore.setState({ currentPath: '/mock/test/workspace' });
    });
}

test.describe('聊天界面', () => {
    test('应显示聊天输入框', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        const textarea = page.locator('textarea').first();
        await expect(textarea).toBeVisible();
    });

    test('输入框应可输入文字', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        const textarea = page.locator('textarea').first();
        await textarea.fill('你好，这是一条测试消息');
        await expect(textarea).toHaveValue('你好，这是一条测试消息');
    });

    test('空输入时发送按钮应禁用', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        const sendButton = page.locator('button').filter({ hasText: /发送|Send/i }).first();
        if (await sendButton.isVisible()) {
            await expect(sendButton).toBeDisabled();
        }
    });

    test('输入文字后发送按钮应启用', async ({ page }) => {
        await page.goto('/');
        await setupWorkspace(page);
        const textarea = page.locator('textarea').first();
        await textarea.fill('测试消息');
        const sendButton = page.locator('button').filter({ hasText: /发送|Send/i }).first();
        if (await sendButton.isVisible()) {
            await expect(sendButton).toBeEnabled();
        }
    });

    test('应显示欢迎页面的建议卡片', async ({ page }) => {
        await page.goto('/');
        // 不注入 workspace，期望看到欢迎页或其对应组件
        // 获取欢迎屏卡片或打开项目相关按钮
        const openFolderButton = page.locator('button').filter({ hasText: /打开项目|打开文件夹|Open Folder/i }).first();
        await expect(openFolderButton).toBeVisible();
    });
});
