// Capture the paladin running animation by directly setting leg angles
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

  // Step through the running cycle and capture frames
  const STRIDE_AMPLITUDE = 35;
  for (let i = 0; i < 8; i++) {
    const phase = (i / 8) * Math.PI * 2;
    const lAngle = Math.sin(phase) * STRIDE_AMPLITUDE;
    const rAngle = Math.sin(phase + Math.PI) * STRIDE_AMPLITUDE;
    await page.evaluate(([l, r]) => {
      const h = window.__hero;
      if (h.legLeftPivot) h.legLeftPivot.angle = l;
      if (h.legRightPivot) h.legRightPivot.angle = r;
    }, [lAngle, rAngle]);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(__dirname, '..', `run-${String(i).padStart(2, '0')}.png`) });
    console.log(`frame ${i}: L=${lAngle.toFixed(0)} R=${rAngle.toFixed(0)}`);
  }

  await browser.close();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
