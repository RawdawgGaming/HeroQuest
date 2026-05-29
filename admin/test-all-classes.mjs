// Run the shop scene for every class and verify nothing crashes
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '..');

const TAB_STATS     = { x: 433, y: 105, name: 'STATS' };
const TAB_EQUIPS    = { x: 571, y: 105, name: 'EQUIPS' };
const TAB_SIDEKICKS = { x: 709, y: 105, name: 'SIDEKICKS' };
const TAB_SHOP      = { x: 847, y: 105, name: 'SHOP' };

const CLASSES = ['paladin', 'barbarian', 'templar_knight', 'mage', 'archer', 'necromancer'];

async function testClass(browser, classId) {
  console.log(`\n=== ${classId} ===`);
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('[ERR]')) {
      errors.push(msg.text());
      console.log('  [browser]', msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log('  [pageerror]', err.message);
  });

  await page.goto(`http://localhost:3003/HeroQuest/shop-test.html?class=${classId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();

  // Click each tab and screenshot
  for (const tab of [TAB_STATS, TAB_EQUIPS, TAB_SIDEKICKS, TAB_SHOP, TAB_STATS]) {
    await page.mouse.click(box.x + tab.x, box.y + tab.y);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `class-test-${classId}-${tab.name.toLowerCase()}.png`) });
  }

  await page.close();
  if (errors.length > 0) {
    console.log(`  FAILED with ${errors.length} errors`);
    return false;
  }
  console.log('  OK');
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let allPass = true;
  for (const classId of CLASSES) {
    const ok = await testClass(browser, classId);
    if (!ok) allPass = false;
  }
  await browser.close();
  console.log(allPass ? '\nALL CLASSES OK' : '\nSOME CLASSES FAILED');
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
