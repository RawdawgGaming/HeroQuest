// Standalone Playwright test for the Shop scene
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '..');

// Tab x-coordinates from Shop.ts (4 tabs centered around x=640, spacing 138)
const TAB_STATS = { x: 433, y: 105, name: 'STATS' };
const TAB_EQUIPS = { x: 571, y: 105, name: 'EQUIPS' };
const TAB_SIDEKICKS = { x: 709, y: 105, name: 'SIDEKICKS' };
const TAB_SHOP = { x: 847, y: 105, name: 'SHOP' };

let canvasBox = null;

function fileHash(file) {
  return createHash('md5').update(readFileSync(file)).digest('hex');
}

async function shoot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `shop-test-${name}.png`);
  await page.screenshot({ path: file });
  return { file, hash: fileHash(file) };
}

async function clickAt(page, x, y) {
  await page.mouse.click(canvasBox.x + x, canvasBox.y + y);
  await page.waitForTimeout(250);
}

async function clickTab(page, tab) {
  console.log(`-> Click ${tab.name}`);
  await clickAt(page, tab.x, tab.y);
}

const failures = [];
function fail(msg) {
  console.log('  FAIL: ' + msg);
  failures.push(msg);
}

async function getActiveTab(page) {
  return await page.evaluate(() => {
    const shop = window.__game?.scene?.getScene('Shop');
    return shop?.activeTab ?? null;
  });
}

/** Click a tab, take a screenshot, and verify activeTab actually changed in the scene. */
async function clickTabAndVerifyChange(page, tab, prevHash, label) {
  await clickTab(page, tab);
  const shot = await shoot(page, label);
  const expected = tab.name.toLowerCase();
  const actual = await getActiveTab(page);
  if (actual !== expected) {
    fail(`Clicking ${tab.name} (${label}): activeTab is "${actual}", expected "${expected}"`);
  } else if (shot.hash === prevHash) {
    fail(`Clicking ${tab.name} (${label}) did NOT change the screen — UI may be frozen!`);
  } else {
    console.log(`  OK activeTab=${actual} -> ${label}.png`);
  }
  return shot.hash;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('[ERR]')) {
      errors.push(msg.text());
      console.log('[browser]', msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log('[pageerror]', err.message);
  });

  console.log('Loading shop test...');
  await page.goto('http://localhost:3003/HeroQuest/shop-test.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const canvas = await page.$('canvas');
  canvasBox = await canvas.boundingBox();

  let h = (await shoot(page, '01-initial')).hash;
  console.log(`Initial hash: ${h.slice(0, 8)}`);

  // === SCENARIO 1: cycle every tab pair, verify each transition changes screen ===
  console.log('\n=== Scenario 1: tab cycle ===');
  h = await clickTabAndVerifyChange(page, TAB_EQUIPS,    h, '02-equips');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '03-sidekicks');
  h = await clickTabAndVerifyChange(page, TAB_STATS,     h, '04-stats-from-sidekicks'); // The bug case
  h = await clickTabAndVerifyChange(page, TAB_EQUIPS,    h, '05-equips-after-stats');
  h = await clickTabAndVerifyChange(page, TAB_SHOP,      h, '06-shop');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '07-sidekicks');
  h = await clickTabAndVerifyChange(page, TAB_STATS,     h, '08-stats');

  // === SCENARIO 2: manage flow ===
  console.log('\n=== Scenario 2: sidekick manage ===');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '09-sidekicks');

  // Click MANAGE on the EQUIPPED sidekick (Mending Pixie, index 0).
  // Sidekick row 0 center y = 220. Manage button at (rightX-30=980, y+2=222).
  console.log('-> Click MANAGE on first sidekick');
  await clickAt(page, 980, 222);
  let manageShot = await shoot(page, '10-manage-pixie');
  if (manageShot.hash === h) {
    fail('Clicking MANAGE did not change the screen');
  } else {
    console.log('  OK manage view shown');
  }
  h = manageShot.hash;

  // Click STATS from inside manage view — bug case
  h = await clickTabAndVerifyChange(page, TAB_STATS, h, '11-stats-from-manage');
  // Clickability after manage→stats: try clicking EQUIPS
  h = await clickTabAndVerifyChange(page, TAB_EQUIPS, h, '12-equips-after-manage-to-stats');

  // === SCENARIO 3: rapid back-and-forth between sidekicks and stats ===
  console.log('\n=== Scenario 3: rapid sidekicks <-> stats ===');
  for (let i = 0; i < 4; i++) {
    h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, `13-rapid-${i}-side`);
    h = await clickTabAndVerifyChange(page, TAB_STATS,     h, `13-rapid-${i}-stats`);
  }

  // === SCENARIO 4: invest a stats skill point, then go to sidekicks ===
  console.log('\n=== Scenario 4: spend skill points then nav ===');
  // From stats tab — click first attribute "+" button (Attack Power) at (870, 181)
  console.log('-> Click + on Attack Power');
  await clickAt(page, 870, 181);
  h = (await shoot(page, '14-after-attr-plus')).hash;
  // Now go to sidekicks
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '15-sidekicks');
  // Then back to stats
  h = await clickTabAndVerifyChange(page, TAB_STATS, h, '16-stats');

  // === SCENARIO 5: buy a sidekick then nav ===
  console.log('\n=== Scenario 5: buy sidekick then nav ===');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '17-sidekicks');
  // Click the BUY button on the 4th sidekick (Battle Wisp, index 3) - which we don't own
  // Row y = 220 + 3 * 76 = 448. Buy button at (rightX-30=980, y=448)
  console.log('-> Click BUY on Battle Wisp');
  await clickAt(page, 980, 448);
  h = (await shoot(page, '18-bought-wisp')).hash;
  // Then nav to stats
  h = await clickTabAndVerifyChange(page, TAB_STATS, h, '19-stats');

  // === SCENARIO 6.5: manage view BACK button then tab nav ===
  console.log('\n=== Scenario 6.5: manage BACK then tab nav ===');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '23-sidekicks');
  console.log('-> Click MANAGE on first sidekick');
  await clickAt(page, 980, 222);
  h = (await shoot(page, '24-manage')).hash;
  console.log('-> Click BACK in manage');
  await clickAt(page, 180, 145);
  const backShot = await shoot(page, '25-after-back');
  if (backShot.hash === h) fail('BACK button did not navigate from manage');
  h = backShot.hash;
  h = await clickTabAndVerifyChange(page, TAB_STATS, h, '26-stats-after-back');
  h = await clickTabAndVerifyChange(page, TAB_EQUIPS, h, '27-equips');

  // === SCENARIO 6.7: invest a SIDEKICK skill point in manage view ===
  console.log('\n=== Scenario 6.7: invest sidekick SP in manage ===');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '28-sidekicks');
  console.log('-> Click MANAGE on first sidekick');
  await clickAt(page, 980, 222);
  h = (await shoot(page, '29-manage')).hash;
  // First skill card + button at approx (418, 416)
  console.log('-> Click + on first sidekick skill');
  await clickAt(page, 418, 416);
  h = (await shoot(page, '30-after-sk-plus')).hash;
  h = await clickTabAndVerifyChange(page, TAB_STATS, h, '31-stats-after-sk-spend');
  h = await clickTabAndVerifyChange(page, TAB_EQUIPS, h, '32-equips');

  // === SCENARIO 6: equipping a different sidekick then nav ===
  console.log('\n=== Scenario 6: equip then nav ===');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '20-sidekicks');
  // Click EQUIP on the 2nd sidekick (Frost Sprite, index 1) which we own but don't have equipped
  // Row y = 220 + 76 = 296. Equip button at (rightX-30=980, y+24=320)
  console.log('-> Click EQUIP on Frost Sprite');
  await clickAt(page, 980, 320);
  h = (await shoot(page, '21-equipped-frost')).hash;
  h = await clickTabAndVerifyChange(page, TAB_STATS, h, '22-stats-after-equip');

  // === SCENARIO 7: stress test with rapid clicking ===
  console.log('\n=== Scenario 7: 30 rapid clicks across all tabs ===');
  const tabs = [TAB_STATS, TAB_EQUIPS, TAB_SIDEKICKS, TAB_SHOP];
  for (let i = 0; i < 30; i++) {
    const t = tabs[i % 4];
    await page.mouse.click(canvasBox.x + t.x, canvasBox.y + t.y);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
  const stressShot = await shoot(page, '33-after-stress');
  const finalActive = await getActiveTab(page);
  console.log(`  Final activeTab after stress: ${finalActive}`);
  h = await clickTabAndVerifyChange(page, TAB_STATS, stressShot.hash, '34-stats-post-stress');
  h = await clickTabAndVerifyChange(page, TAB_SIDEKICKS, h, '35-sidekicks-post-stress');

  console.log('\n=== Summary ===');
  if (errors.length === 0 && failures.length === 0) {
    console.log('ALL OK — no errors and every transition worked');
  } else {
    console.log(`${errors.length} runtime errors, ${failures.length} interaction failures`);
    errors.forEach(e => console.log('  RUNTIME: ' + e));
    failures.forEach(f => console.log('  CLICK: ' + f));
  }

  await browser.close();
  process.exit(errors.length + failures.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
