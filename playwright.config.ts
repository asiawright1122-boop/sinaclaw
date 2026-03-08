import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:1420',
        headless: true,
        viewport: { width: 1280, height: 720 },
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:1420',
        reuseExistingServer: !process.env.CI,
        timeout: 20_000,
        env: {
            VITE_TEST_MOCK_TAURI: 'true'
        }
    },
});
