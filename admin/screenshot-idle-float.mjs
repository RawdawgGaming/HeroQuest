// Diagnostic: zoomed-in view of paladin feet vs ground, plus all-class view
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text()); });
  page.on('pageerror', e => console.log('[pageerr]', e.message));

  await page.goto('http://localhost:3003/HeroQuest/float-test.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Full view
  await page.screenshot({ path: path.join(__dirname, '..', 'idle-float-full.png') });

  // Zoomed clip of paladin (hero at x≈183, groundY=500, hero extends ~60px above)
  // Clip just the feet area: roughly x=160-220, y=480-520
  await page.screenshot({
    path: path.join(__dirname, '..', 'idle-float-paladin-feet.png'),
    clip: { x: 150, y: 460, width: 100, height: 70 }
  });

  // Also zoom in on barbarian (x≈366)
  await page.screenshot({
    path: path.join(__dirname, '..', 'idle-float-barbarian-feet.png'),
    clip: { x: 330, y: 460, width: 100, height: 70 }
  });

  // Mage (x≈732)
  await page.screenshot({
    path: path.join(__dirname, '..', 'idle-float-mage-feet.png'),
    clip: { x: 700, y: 450, width: 100, height: 80 }
  });

  // Capture 4 frames over a breath cycle to check for any remaining bob
  for (let i = 0; i < 4; i++) {
    const info = await page.evaluate(() => {
      const h = window.__hero;
      if (!h) return null;
      return {
        bodyGroupY: h.bodyGroup.y,
        jumpZ: h.jumpZ,
        upperBodyY: h.upperBodyPivot?.y ?? 'none',
      };
    });
    console.log(`frame ${i}:`, JSON.stringify(info));
    await page.waitForTimeout(550);
  }

  await browser.close();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
