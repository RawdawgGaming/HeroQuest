import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:3003/HeroQuest/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.fill('#auth-form input[type="email"]', 'mwoodsmarketing@gmail.com');
  await page.fill('#auth-form input[type="password"]', 'Tkpab9epp2r');
  await page.evaluate(() => document.querySelector('#auth-form').dispatchEvent(new Event('submit', { bubbles: true })));
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 330);
  await page.waitForTimeout(2000);
  await page.mouse.click(120, 560);
  await page.waitForTimeout(6000);

  await page.screenshot({ path: path.join(__dirname, '..', 'terrain-test.png') });

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: path.join(__dirname, '..', 'terrain-test2.png') });

  await browser.close();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
