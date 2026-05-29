import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Usage: node admin/screenshot-stage.mjs [stageNumber]
// Default: stage 2
const stageNum = parseInt(process.argv[2] || '2', 10);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:3003/HeroQuest/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Login
  await page.fill('#auth-form input[type="email"]', 'mwoodsmarketing@gmail.com');
  await page.fill('#auth-form input[type="password"]', 'Tkpab9epp2r');
  await page.evaluate(() => document.querySelector('#auth-form').dispatchEvent(new Event('submit', { bubbles: true })));
  await page.waitForTimeout(5000);

  // Click "Start" on title screen
  await page.mouse.click(640, 330);
  await page.waitForTimeout(2000);

  // Select first hero (Paladin) — bottom-left area
  await page.mouse.click(120, 560);
  await page.waitForTimeout(3000);

  // Now on StageSelect — screenshot the map first
  await page.screenshot({ path: path.join(__dirname, '..', `stage-select-map.png`) });

  // Stage positions on the map (generated from the winding path algorithm)
  // Row 0 (bottom): stages 1-10, left to right, y~620
  // Row 1: stages 11-20, right to left, y~490
  // etc.
  // For simplicity, we use JavaScript evaluation to find and click the stage
  // Stages are clickable containers. We'll click on specific coordinates.
  // The StageSelect generates positions procedurally. Let's calculate them.

  const marginX = 100, marginY = 100;
  const usableW = 1280 - marginX * 2;
  const usableH = 720 - marginY * 2;
  const rows = 5, perRow = 10;
  const rowH = usableH / (rows - 1);

  const stageIdx = stageNum - 1; // 0-based
  const row = Math.floor(stageIdx / perRow);
  const col = stageIdx % perRow;
  const y = 720 - marginY - row * rowH;
  const leftToRight = row % 2 === 0;
  const t = col / (perRow - 1);
  const x = leftToRight ? marginX + t * usableW : marginX + (1 - t) * usableW;
  const wobble = Math.sin((row * perRow + col) * 0.7) * 15;

  console.log(`Clicking stage ${stageNum} at (${Math.round(x)}, ${Math.round(y + wobble)})`);
  await page.mouse.click(Math.round(x), Math.round(y + wobble));
  await page.waitForTimeout(6000);

  // Screenshot gameplay
  await page.screenshot({ path: path.join(__dirname, '..', `stage-${stageNum}-start.png`) });

  // Move right and take another screenshot
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: path.join(__dirname, '..', `stage-${stageNum}-mid.png`) });

  await browser.close();
  console.log(`Stage ${stageNum} screenshots done`);
}

main().catch(e => { console.error(e); process.exit(1); });
