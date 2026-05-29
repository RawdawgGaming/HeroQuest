/**
 * NORMALIZE ATTACK SHEET v2 — Single-step: scale + reframe into wide frames
 *
 * Reads the ORIGINAL 5376×3584 attack sheet (8×8, 672×448, 63 frames).
 * Scales each character to match idle proportions (1.546x) and places directly
 * into 1056×480 output frames — NO intermediate clipping.
 *
 * Usage: node admin/normalize-attack-v2.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  const atkB64 = fs.readFileSync('public/assets/paladin/paladin_attack_main_v1.png').toString('base64');

  const result = await p.evaluate(async (atkB64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + atkB64;
    await new Promise(r => { img.onload = r; });

    // Source layout
    const SRC_FW = 672, SRC_FH = 448;
    const SRC_COLS = 8, SRC_ROWS = 8;

    // Output layout — wide enough for full weapon/cape arc
    const DST_FW = 1056, DST_FH = 480;
    const DST_COLS = 7, DST_ROWS = 9; // 63 cells = exact fit

    // Scale: match idle character height (385px in 448px frame)
    // Idle: feet at y=447, height 385px → fills 86% of frame
    // Attack F0: height 249px → scale = 385/249 = 1.546x
    const SCALE = 385 / 249;
    const TARGET_FEET_Y = DST_FH - 1; // y=479

    const logs = [];
    logs.push('Source: ' + img.width + 'x' + img.height + ' (' + SRC_COLS + 'x' + SRC_ROWS + ', ' + SRC_FW + 'x' + SRC_FH + ')');
    logs.push('Output: ' + (DST_FW * DST_COLS) + 'x' + (DST_FH * DST_ROWS) + ' (' + DST_COLS + 'x' + DST_ROWS + ', ' + DST_FW + 'x' + DST_FH + ')');
    logs.push('Scale: ' + SCALE.toFixed(4) + 'x');

    // Output canvas
    const out = document.createElement('canvas');
    out.width = DST_FW * DST_COLS;   // 7392
    out.height = DST_FH * DST_ROWS;  // 4320
    const outCtx = out.getContext('2d');
    outCtx.imageSmoothingEnabled = false;

    let frameCount = 0;
    let clippedCount = 0;

    for (let srcRow = 0; srcRow < SRC_ROWS; srcRow++) {
      for (let srcCol = 0; srcCol < SRC_COLS; srcCol++) {
        // Extract source frame
        const srcC = document.createElement('canvas');
        srcC.width = SRC_FW; srcC.height = SRC_FH;
        const srcCtx = srcC.getContext('2d');
        srcCtx.imageSmoothingEnabled = false;
        srcCtx.drawImage(img, srcCol * SRC_FW, srcRow * SRC_FH, SRC_FW, SRC_FH, 0, 0, SRC_FW, SRC_FH);

        // Remove white/near-white background
        const srcData = srcCtx.getImageData(0, 0, SRC_FW, SRC_FH);
        const px = srcData.data;
        for (let j = 0; j < px.length; j += 4) {
          if (px[j] > 240 && px[j+1] > 240 && px[j+2] > 240) px[j+3] = 0;
        }
        srcCtx.putImageData(srcData, 0, 0);

        // Find content bbox
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
        if (!has || (maxX - minX) < 10) continue; // empty frame

        const srcW = maxX - minX + 1;
        const srcH = maxY - minY + 1;

        // Scale content
        const dstW = Math.round(srcW * SCALE);
        const dstH = Math.round(srcH * SCALE);

        // Position: feet at bottom, centered horizontally
        const dstTopY = TARGET_FEET_Y - dstH + 1;
        const dstLeftX = Math.round((DST_FW - dstW) / 2);

        // Check for clipping
        const clips = dstLeftX < 0 || (dstLeftX + dstW) > DST_FW || dstTopY < 0;
        if (clips) clippedCount++;

        // Destination cell position
        const dstCol = frameCount % DST_COLS;
        const dstRow = Math.floor(frameCount / DST_COLS);
        const cellX = dstCol * DST_FW;
        const cellY = dstRow * DST_FH;

        // Draw scaled content into output cell (clip to cell boundaries)
        outCtx.save();
        outCtx.beginPath();
        outCtx.rect(cellX, cellY, DST_FW, DST_FH);
        outCtx.clip();
        outCtx.drawImage(srcC, minX, minY, srcW, srcH,
          cellX + dstLeftX, cellY + dstTopY, dstW, dstH);
        outCtx.restore();

        if (frameCount < 3 || frameCount >= 60 || clips) {
          logs.push('  F' + frameCount + ': src=' + srcW + 'x' + srcH +
            ' → dst=' + dstW + 'x' + dstH +
            ' pos=(' + dstLeftX + ',' + dstTopY + ')' +
            (clips ? ' CLIPPED!' : ' ok'));
        }

        frameCount++;
      }
    }

    logs.push('');
    logs.push('Total frames: ' + frameCount);
    logs.push('Clipped frames: ' + clippedCount);

    // Verify: measure output frames for clipping
    logs.push('');
    logs.push('Output verification:');
    for (const fi of [0, 15, 30, 50, 55, 60, 62]) {
      if (fi >= frameCount) continue;
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
      const touchL = vMinX === 0, touchR = vMaxX === DST_FW - 1, touchT = vMinY === 0;
      logs.push('  F' + fi + ': [' + vMinX + '-' + vMaxX + ', ' + vMinY + '-' + vMaxY + '] ' +
        (vMaxX-vMinX+1) + 'x' + (vMaxY-vMinY+1) +
        (touchL||touchR||touchT ? ' CLIP' : ' ok') +
        ' margins=[L:' + vMinX + ' R:' + (DST_FW-1-vMaxX) + ' T:' + vMinY + ']');
    }

    return {
      logs,
      png: out.toDataURL('image/png').split(',')[1],
      frameCount,
    };
  }, atkB64);

  fs.writeFileSync('public/assets/paladin/paladin_attack_main_v1.png',
    Buffer.from(result.png, 'base64'));

  console.log('=== NORMALIZE v2 COMPLETE ===');
  for (const line of result.logs) console.log(line);
  console.log('\nWrote ' + result.frameCount + ' frames to paladin_attack_main_v1.png');

  await b.close();
})();
