// Equip various paladin weapons and capture the moulinet rotation
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', (e) => console.log('[err]', e.message));

  await page.goto('http://localhost:3003/HeroQuest/swing-test.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const weapons = ['oak_mace', 'morning_star', 'warhammer', 'consecrated_mace', 'sunfire_hammer'];

  for (const w of weapons) {
    // Equip the weapon
    await page.evaluate((wid) => {
      window.__hero.setEquippedWeapon(wid);
    }, w);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, '..', `equip-${w}-rest.png`) });

    // Trigger an attack and capture mid-rotation
    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 640, box.y + 380);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(__dirname, '..', `equip-${w}-swing.png`) });

    // End attack by waiting (or trigger idle by clicking again? just wait it out)
    await page.waitForTimeout(1500);
    console.log(`captured ${w}`);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
