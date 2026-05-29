// Set specific angles on the paladin's swing nodes and capture each pose
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test poses: [shoulder, sword, label]
const poses = [
  [0, 0, 'rest'],
  // Computed candidate windup/slash poses
  [-112, 82,  'windup-A'],   // arm up-right at head, sword cocked back over head
  [-32,  140, 'slash-A'],    // arm forward-down, sword horizontal right
  // Variations
  [-100, 60,  'windup-B'],
  [-130, 100, 'windup-C'],
  [-50,  110, 'slash-B'],
  [-20,  150, 'slash-C'],
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', (e) => console.log('[err]', e.message));

  await page.goto('http://localhost:3003/HeroQuest/swing-test.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  for (const [shoulder, sword, label] of poses) {
    await page.evaluate(([s, w]) => {
      const h = window.__hero;
      // Cancel any active tweens
      h.scene.tweens.killTweensOf(h.shoulderNode);
      h.scene.tweens.killTweensOf(h.swordNode);
      h.shoulderNode.angle = s;
      h.swordNode.angle = w;
    }, [shoulder, sword]);
    await page.waitForTimeout(80);
    const file = path.join(__dirname, '..', `pose-${label}.png`);
    await page.screenshot({ path: file });
    console.log(`${label}: shoulder=${shoulder} sword=${sword}`);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
