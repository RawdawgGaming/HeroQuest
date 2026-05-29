// Test: HeroSelect → Paladin → CharacterName → type → Cancel → click Back
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[browser]', m.text()); });
  page.on('pageerror', (e) => console.log('[err]', e.message));

  await page.goto('http://localhost:3003/HeroQuest/hero-select-test.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, '..', 'flow-01-heroselect.png') });

  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();

  // Click "NAME YOUR HERO" — at canvas (640, 620)
  console.log('Click NAME YOUR HERO');
  await page.mouse.click(box.x + 640, box.y + 620);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '..', 'flow-02-name.png') });

  // Type a name into the HTML input
  console.log('Type name');
  await page.waitForSelector('#char-name', { timeout: 3000 });
  await page.fill('#char-name', 'TestHero');
  await page.waitForTimeout(300);

  // Click the CANCEL button
  console.log('Click CANCEL');
  await page.click('#name-cancel');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '..', 'flow-03-after-cancel.png') });

  // Verify overlay is gone
  const overlayGone = await page.$('#name-overlay') === null;
  console.log('Overlay removed:', overlayGone);

  // Try to click the Back button on HeroSelect (canvas (80, 685))
  console.log('Click < BACK');
  await page.mouse.click(box.x + 80, box.y + 685);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '..', 'flow-04-after-back.png') });

  // Check the active scene via the game instance
  const activeScene = await page.evaluate(() => {
    const game = window.__game;
    if (!game) return 'no-game';
    return game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',');
  });
  console.log('Active scene after Back:', activeScene);

  await browser.close();
  if (overlayGone) {
    console.log('OK overlay was cleared');
  } else {
    console.log('FAIL overlay still in DOM');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
