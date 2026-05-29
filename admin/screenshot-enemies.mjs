import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const stageNum = parseInt(process.argv[2] || '9', 10);

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
  await page.waitForTimeout(3000);

  // Force-start the target stage
  await page.evaluate((targetStage) => {
    const game = window.__PHASER_GAME__;
    if (game) {
      const ss = game.scene.getScene('StageSelect');
      game.scene.start('ForestStage', {
        heroClass: ss?.stageData?.heroClass,
        user: ss?.stageData?.user,
        characterId: ss?.stageData?.characterId,
        gold: ss?.stageData?.gold || 10000,
        level: ss?.stageData?.level || 25,
        currentXp: ss?.stageData?.currentXp || 0,
        stageIndex: targetStage - 1,
        progression: ss?.stageData?.progression,
      });
    }
  }, stageNum);
  await page.waitForTimeout(4000);

  // Move RIGHT until past the first trigger (x=600)
  // Hold D key for 4 seconds to walk ~440px (speed ~110px/s)
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(5000);
  await page.keyboard.up('KeyD');

  // Wait for enemies to walk in
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(__dirname, '..', `enemies-stage-${stageNum}.png`) });

  // Move a bit more and screenshot again
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(__dirname, '..', `enemies-stage-${stageNum}-b.png`) });

  await browser.close();
  console.log(`Stage ${stageNum} enemy screenshots done`);
}

main().catch(e => { console.error(e); process.exit(1); });
