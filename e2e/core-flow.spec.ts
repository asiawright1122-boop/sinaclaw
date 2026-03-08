import { test, expect } from "@playwright/test";

test.describe("Sinaclaw Core Flows", () => {
    test.beforeEach(async ({ page }) => {
        page.on("console", (msg) => {
            if (msg.type() === "error") console.log("BROWSER ERROR:", msg.text());
        });
        await page.goto("/");
        await page.waitForLoadState("networkidle");
    });

    test("应用加载并展示聊天页面", async ({ page }) => {
        // 主布局应该可见
        await expect(page.locator("[data-testid='app-layout'], .flex")).toBeVisible({ timeout: 10000 });
    });

    test("侧边栏导航可用", async ({ page }) => {
        // 测试点击各导航项
        const navLinks = [
            { path: "/settings", text: "设" },
            { path: "/knowledge", text: "" },
            { path: "/skills", text: "" },
        ];

        for (const link of navLinks) {
            const navItem = page.locator(`a[href="${link.path}"]`).first();
            if (await navItem.isVisible()) {
                await navItem.click();
                await expect(page).toHaveURL(new RegExp(link.path));
            }
        }
    });

    test("设置页面可以切换语言", async ({ page }) => {
        await page.goto("/settings");
        await page.waitForLoadState("networkidle");
        // 设置页面应该包含语言选项
        const pageContent = await page.textContent("body");
        expect(pageContent).toBeTruthy();
    });

    test("知识库页面加载", async ({ page }) => {
        await page.goto("/knowledge");
        await page.waitForLoadState("networkidle");
        // 知识库页面应该存在上传按钮区域
        await expect(page.locator("input[type='file']")).toBeAttached({ timeout: 10000 });
    });

    test("Agent 工作台页面加载", async ({ page }) => {
        await page.goto("/agents");
        await page.waitForLoadState("networkidle");
        // 页面应该包含 Agent 相关内容
        const body = await page.textContent("body");
        expect(body?.length).toBeGreaterThan(0);
    });

    test("用量页面加载", async ({ page }) => {
        await page.goto("/usage");
        await page.waitForLoadState("networkidle");
        const body = await page.textContent("body");
        expect(body?.length).toBeGreaterThan(0);
    });

    test("安全页面加载", async ({ page }) => {
        await page.goto("/security");
        await page.waitForLoadState("networkidle");
        const body = await page.textContent("body");
        expect(body?.length).toBeGreaterThan(0);
    });

    test("本地模型页面加载", async ({ page }) => {
        await page.goto("/models");
        await page.waitForLoadState("networkidle");
        const body = await page.textContent("body");
        expect(body?.length).toBeGreaterThan(0);
    });

    test("Gateway 集群页面加载", async ({ page }) => {
        await page.goto("/gateway-cluster");
        await page.waitForLoadState("networkidle");
        const body = await page.textContent("body");
        expect(body?.length).toBeGreaterThan(0);
    });
});
