import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  // Load all 22 frames
  const frameDir = 'public/assets/paladin/Run Frames';
  const frameFiles = [];
  for (let i = 0; i < 22; i++) {
    const name = `run_v3_672x448_sheet_${i.toString().padStart(2, '0')}.png`;
    frameFiles.push(fs.readFileSync(`${frameDir}/${name}`).toString('base64'));
  }

  const result = await p.evaluate(async (frames) => {
    // Load all frame images
    const imgs = [];
    for (const d of frames) {
      const img = new Image();
      img.src = 'data:image/png;base64,' + d;
      await new Promise(r => { img.onload = r; });
      imgs.push(img);
    }

    const FW = imgs[0].width, FH = imgs[0].height; // 672x448

    // For each frame: draw to canvas, remove white bg, find tight bbox
    const charData = [];
    const canvases = [];
    for (let i = 0; i < imgs.length; i++) {
      const c = document.createElement('canvas');
      c.width = FW; c.height = FH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(imgs[i], 0, 0);
      const id = ctx.getImageData(0, 0, FW, FH);
      const px = id.data;

      // Remove white background
      for (let j = 0; j < px.length; j += 4) {
        if (px[j] > 240 && px[j+1] > 240 && px[j+2] > 240) px[j+3] = 0;
      }
      ctx.putImageData(id, 0, 0);
      canvases.push(c);

      // Find tight bbox
      let minX = FW, maxX = 0, minY = FH, maxY = 0;
      for (let y = 0; y < FH; y++) {
        for (let x = 0; x < FW; x++) {
          if (px[(y * FW + x) * 4 + 3] > 30) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
      }
      charData.push({ minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }

    // Use the LARGEST character dimensions for uniform scaling
    const maxW = Math.max(...charData.map(c => c.w));
    const maxH = Math.max(...charData.map(c => c.h));
    // Scale to fit within 64x64 with 2px margin on each side
    const scale = Math.min(60 / maxW, 60 / maxH);

    // Find the global bottom Y to align all feet consistently
    const globalMaxBot = Math.max(...charData.map(c => c.maxY));

    const NUM = imgs.length;
    const FRAME = 64;
    const out = document.createElement('canvas');
    out.width = FRAME * NUM;
    out.height = FRAME;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;

    const feetYs = [];
    for (let i = 0; i < NUM; i++) {
      const ch = charData[i];
      const sw = Math.round(ch.w * scale);
      const sh = Math.round(ch.h * scale);
      // Center horizontally in 64px frame
      const destX = i * FRAME + Math.round((FRAME - sw) / 2);
      // Align feet: all characters' bottom edges map to the same Y
      // Distance from this char's bottom to global bottom
      const botOffset = globalMaxBot - ch.maxY;
      const scaledBotOffset = Math.round(botOffset * scale);
      const destY = 62 - sh - scaledBotOffset;
      octx.drawImage(canvases[i], ch.minX, ch.minY, ch.w, ch.h, destX, destY, sw, sh);

      // Measure actual feetY in output
      let actualMaxY = 0;
      const checkData = octx.getImageData(i * FRAME, 0, FRAME, FRAME);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        if (checkData.data[(y * 64 + x) * 4 + 3] > 30) actualMaxY = Math.max(actualMaxY, y);
      }
      feetYs.push(actualMaxY);
    }

    return {
      NUM, outW: out.width, scale: scale.toFixed(4),
      maxW, maxH, feetYs,
      feetRange: Math.max(...feetYs) - Math.min(...feetYs),
      b64: out.toDataURL('image/png').split(',')[1]
    };
  }, frameFiles);

  fs.writeFileSync('public/assets/paladin/run.png', Buffer.from(result.b64, 'base64'));
  console.log('Frames:', result.NUM, '| Output:', result.outW + 'x64');
  console.log('Max char:', result.maxW + 'x' + result.maxH, '| Scale:', result.scale);
  console.log('FeetY per frame:', result.feetYs.join(','));
  console.log('FeetY variance:', result.feetRange, 'px');
  await b.close();
})();
