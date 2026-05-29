import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const videoPath = path.resolve(__dirname, '..', 'Environment', 'Stage 1', 'Examples', 'screen-capture.webm');
  const videoUrl = 'file:///' + videoPath.replace(/\\/g, '/');

  await page.setContent(`
    <html><body style="margin:0;background:#000">
      <video id="v" src="${videoUrl}" style="width:1280px;height:720px;object-fit:contain" autoplay muted></video>
    </body></html>
  `);

  // Wait for video to load and play
  await page.waitForTimeout(3000);

  // Capture at several points
  for (const t of [1, 3, 6, 10, 15]) {
    await page.evaluate((seekTo) => {
      const v = document.getElementById('v');
      v.currentTime = seekTo;
    }, t);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(__dirname, '..', `vidframe-${t}s.png`) });
    console.log(`Captured frame at ${t}s`);
  }

  await browser.close();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
