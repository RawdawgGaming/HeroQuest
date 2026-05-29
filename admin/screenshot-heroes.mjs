import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_PATH = path.join(__dirname, '..', 'hero-visuals.png');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 700 } });
  page.on('console', (m) => console.log('[browser]', m.text()));
  page.on('pageerror', (e) => console.log('[err]', e.message));

  await page.goto('http://localhost:3003/HeroQuest/hero-test.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SCREENSHOT_PATH });
  console.log('Saved', SCREENSHOT_PATH);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
