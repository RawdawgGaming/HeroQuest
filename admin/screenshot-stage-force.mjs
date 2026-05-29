import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Force-load any stage by injecting stageIndex directly into ForestStage
const stageNum = parseInt(process.argv[2] || '6', 10);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:3003/HeroQuest/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.fill('#auth-form input[type="email"]', 'mwoodsmarketing@gmail.com');
  await page.fill('#auth-form input[type="password"]', 'Tkpab9epp2r');
  await page.evaluate(() => document.querySelector('#auth-form').dispatchEvent(new Event('submit', { bubbles: true })));
  await page.waitForTimeout(5000);

  // Click Start
  await page.mouse.click(640, 330);
  await page.waitForTimeout(2000);
  // Select Paladin
  await page.mouse.click(120, 560);
  await page.waitForTimeout(3000);

  // On stage select — override currentStage to unlock all, then click target
  await page.evaluate((targetStage) => {
    // Access the Phaser game and force-start the stage
    const game = window.__PHASER_GAME__;
    if (game) {
      const stageSelect = game.scene.getScene('StageSelect');
      if (stageSelect && stageSelect.stageData) {
        stageSelect.stageData.currentStage = 49; // unlock all
      }
      // Start ForestStage directly with the target stageIndex
      game.scene.start('ForestStage', {
        heroClass: stageSelect?.stageData?.heroClass,
        user: stageSelect?.stageData?.user,
        characterId: stageSelect?.stageData?.characterId,
        gold: stageSelect?.stageData?.gold || 10000,
        level: stageSelect?.stageData?.level || 25,
        currentXp: stageSelect?.stageData?.currentXp || 0,
        stageIndex: targetStage - 1, // 0-based
        progression: stageSelect?.stageData?.progression,
      });
    }
  }, stageNum);
  await page.waitForTimeout(6000);

  await page.screenshot({ path: path.join(__dirname, '..', `stage-${stageNum}-start.png`) });

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: path.join(__dirname, '..', `stage-${stageNum}-mid.png`) });

  await browser.close();
  console.log(`Stage ${stageNum} force-loaded`);
}

main().catch(e => { console.error(e); process.exit(1); });
