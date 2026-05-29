/**
 * REBUILD ATTACK SHEET — from archived original, single-step, no intermediate files
 *
 * Reads: Archive/paladin_attack_original.png (5376×3584, 8×8, 672×448, 63 frames)
 * Writes: paladin_attack_main_v1.png (7392×4320, 7×9, 1056×480, 63 frames)
 *
 * Scale factor: 385/249 = 1.546x (matches idle body height)
 * Body centered horizontally, feet at frame bottom (y=479).
 *
 * Usage: node admin/rebuild-attack-sheet.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const SRC_PATH = 'public/assets/paladin/Archive/paladin_attack_original.png';
const DST_PATH = 'public/assets/paladin/paladin_attack_main_v1.png';

(async () => {
  if (!fs.existsSync(SRC_PATH)) { console.error('Source not found:', SRC_PATH); process.exit(1); }
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const srcB64 = fs.readFileSync(SRC_PATH).toString('base64');

  const result = await p.evaluate(async (srcB64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + srcB64;
    await new Promise(r => { img.onload = r; });

    // Source grid
    const SRC_FW = 672, SRC_FH = 448, SRC_COLS = 8, SRC_ROWS = 8;
    // Output grid
    const DST_FW = 1056, DST_FH = 480, DST_COLS = 7, DST_ROWS = 9;
    const MAX_FRAMES = 63;
    // Scale: idle body is 385px in 448px frame. Attack F0 body is 249px.
    const SCALE = 385 / 249; // 1.5462
    const TARGET_FEET_Y = DST_FH - 1; // y=479

    const logs = [];
    logs.push('Source: ' + img.width + 'x' + img.height +
      ' (' + SRC_COLS + 'x' + SRC_ROWS + ', ' + SRC_FW + 'x' + SRC_FH + ')');

    // Output canvas
    const out = document.createElement('canvas');
    out.width = DST_FW * DST_COLS;
    out.height = DST_FH * DST_ROWS;
    const outCtx = out.getContext('2d');
    outCtx.imageSmoothingEnabled = false;

    let frameCount = 0;
    let clippedCount = 0;

    for (let srcRow = 0; srcRow < SRC_ROWS && frameCount < MAX_FRAMES; srcRow++) {
      for (let srcCol = 0; srcCol < SRC_COLS && frameCount < MAX_FRAMES; srcCol++) {
        // Extract source frame
        const srcC = document.createElement('canvas');
        srcC.width = SRC_FW; srcC.height = SRC_FH;
        const srcCtx = srcC.getContext('2d');
        srcCtx.imageSmoothingEnabled = false;
        srcCtx.drawImage(img, srcCol * SRC_FW, srcRow * SRC_FH, SRC_FW, SRC_FH, 0, 0, SRC_FW, SRC_FH);

        // Remove white/near-white background → transparent
        const srcData = srcCtx.getImageData(0, 0, SRC_FW, SRC_FH);
        const px = srcData.data;
        for (let j = 0; j < px.length; j += 4) {
          if (px[j] > 240 && px[j + 1] > 240 && px[j + 2] > 240) px[j + 3] = 0;
        }
        srcCtx.putImageData(srcData, 0, 0);

        // Find content bounding box
        let minX = SRC_FW, maxX = 0, minY = SRC_FH, maxY = 0, has = false;
        for (let y = 0; y < SRC_FH; y++) {
          for (let x = 0; x < SRC_FW; x++) {
            if (px[(y * SRC_FW + x) * 4 + 3] > 30) {
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
              has = true;
            }
          }
        }
        if (!has || (maxX - minX) < 10) continue; // skip empty cells

        const srcW = maxX - minX + 1, srcH = maxY - minY + 1;

        // Scale
        const dstW = Math.round(srcW * SCALE);
        const dstH = Math.round(srcH * SCALE);

        // Position: center horizontally, feet at bottom
        const dstLeftX = Math.round((DST_FW - dstW) / 2);
        const dstTopY = TARGET_FEET_Y - dstH + 1;

        // Clip check
        const clipL = dstLeftX < 0;
        const clipR = (dstLeftX + dstW) > DST_FW;
        const clipT = dstTopY < 0;
        if (clipL || clipR || clipT) clippedCount++;

        // Destination cell
        const dstCol = frameCount % DST_COLS;
        const dstRow = Math.floor(frameCount / DST_COLS);
        const cellX = dstCol * DST_FW;
        const cellY = dstRow * DST_FH;

        // Draw into output (clip to cell bounds)
        outCtx.save();
        outCtx.beginPath();
        outCtx.rect(cellX, cellY, DST_FW, DST_FH);
        outCtx.clip();
        outCtx.drawImage(srcC, minX, minY, srcW, srcH,
          cellX + dstLeftX, cellY + dstTopY, dstW, dstH);
        outCtx.restore();

        frameCount++;
      }
    }

    // Verification pass
    logs.push('Output: ' + out.width + 'x' + out.height +
      ' (' + DST_COLS + 'x' + DST_ROWS + ', ' + DST_FW + 'x' + DST_FH + ')');
    logs.push('Frames: ' + frameCount + ', clipped: ' + clippedCount);
    logs.push('');

    for (let fi = 0; fi < frameCount; fi++) {
      const col = fi % DST_COLS, row = Math.floor(fi / DST_COLS);
      const vData = outCtx.getImageData(col * DST_FW, row * DST_FH, DST_FW, DST_FH);
      const vPx = vData.data;
      let vMinX = DST_FW, vMaxX = 0, vMinY = DST_FH, vMaxY = 0;
      for (let y = 0; y < DST_FH; y++) for (let x = 0; x < DST_FW; x++) {
        if (vPx[(y * DST_FW + x) * 4 + 3] > 30) {
          vMinX = Math.min(vMinX, x); vMaxX = Math.max(vMaxX, x);
          vMinY = Math.min(vMinY, y); vMaxY = Math.max(vMaxY, y);
        }
      }
      const w = vMaxX - vMinX + 1, h = vMaxY - vMinY + 1;
      const touchL = vMinX === 0, touchR = vMaxX === DST_FW - 1, touchT = vMinY === 0;
      const clip = touchL || touchR || touchT;
      if (fi < 3 || fi >= frameCount - 3 || clip) {
        logs.push('F' + fi + ': [' + vMinX + '-' + vMaxX + ', ' + vMinY + '-' + vMaxY + '] ' +
          w + 'x' + h + ' margins=[L:' + vMinX + ' R:' + (DST_FW - 1 - vMaxX) + ' T:' + vMinY + ']' +
          (clip ? ' CLIP!' : ' ok'));
      }
    }

    return { logs, png: out.toDataURL('image/png').split(',')[1], frameCount };
  }, srcB64);

  // Write output to the game asset path (NOT the archive)
  fs.writeFileSync(DST_PATH, Buffer.from(result.png, 'base64'));

  // Clean up the double-extension upload
  const uploadPath = 'public/assets/paladin/paladin_attack_main_v1.png.png';
  if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);

  console.log('=== REBUILD COMPLETE ===');
  for (const line of result.logs) console.log(line);
  console.log('\nSource: ' + SRC_PATH);
  console.log('Output: ' + DST_PATH + ' (' + result.frameCount + ' frames)');
  console.log('Backup preserved at: ' + SRC_PATH);

  await b.close();
})();
