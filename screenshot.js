import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const saveDir = path.resolve('/Users/kaka/.gemini/antigravity/brain/87b325ff-0f6e-46d8-b7e8-d762359e9667/screenshots/');

  try {
    await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });

    // Screenshot Welcome State
    await page.screenshot({ path: path.join(saveDir, 'chat_welcome.png') });

    // Type something
    await page.fill('textarea', 'Help me fix my code');
    await page.click('button:has-text("Send")');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(saveDir, 'chat_active.png') });

    // Click Knowledge Base
    await page.click('text=Knowledge');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(saveDir, 'knowledge.png') });

    // Click Settings
    await page.click('text=Settings');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(saveDir, 'settings.png') });

    console.log("Screenshots saved to " + saveDir);
  } catch (e) {
    console.error("Test failed:", e);
  } finally {
    await browser.close();
  }
})();
