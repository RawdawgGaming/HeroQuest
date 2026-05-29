// Standalone Playwright screenshot script for testing weapon rendering
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_PATH = path.join(__dirname, '..', 'weapon-test-screenshot.png');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });

  // Forward console messages
  page.on('console', (msg) => console.log('[browser]', msg.text()));
  page.on('pageerror', (err) => console.log('[browser ERROR]', err.message));

  // The dev server runs at /HeroQuest/ base
  const url = 'http://localhost:3003/HeroQuest/weapon-test.html';
  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait a moment for Phaser to render
  await page.waitForTimeout(800);

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log('Saved screenshot to:', SCREENSHOT_PATH);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
