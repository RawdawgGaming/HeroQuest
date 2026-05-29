// Captures the paladin swing animation as a series of keyframes
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[browser]', m.text()); });
  page.on('pageerror', (e) => console.log('[err]', e.message));

  await page.goto('http://localhost:3003/HeroQuest/swing-test.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Initial rest pose
  await page.screenshot({ path: path.join(__dirname, '..', `swing-00-rest.png`) });

  // Trigger attack via click in the middle of the canvas
  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + 640, box.y + 380);

  // Capture frames every 30ms for the figure-8 motion
  const frames = [];
  for (let i = 1; i <= 24; i++) {
    await page.waitForTimeout(30);
    const t = i * 30;
    const file = path.join(__dirname, '..', `swing-${String(t).padStart(4, '0')}ms.png`);
    await page.screenshot({ path: file });
    frames.push(file);
    const angles = await page.evaluate(() => {
      const h = window.__hero;
      if (!h) return null;
      return {
        shoulder: h.shoulderNode?.angle ?? null,
        sword: h.swordNode?.angle ?? null,
      };
    });
    console.log(`t=${t}ms shoulder=${angles?.shoulder?.toFixed(1) ?? '?'} sword=${angles?.sword?.toFixed(1) ?? '?'}`);
  }

  await browser.close();
  console.log('Captured', frames.length, 'frames');
}

main().catch((e) => { console.error(e); process.exit(1); });
