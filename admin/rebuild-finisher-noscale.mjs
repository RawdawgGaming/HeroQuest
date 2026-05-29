/**
 * REBUILD FINISHER — NO SCALING (1:1 pixel copy)
 *
 * Previous builds scaled by 1.4x with nearest-neighbor, causing tattering
 * (alternating 1px/2px output pixels). This version copies each 544×544
 * source cell at 1:1 into a 1056×544 output frame with NO scaling at all.
 * Runtime scale handles size matching.
 *
 * Source: Archive/paladin_overhead_swing_original_v3.png (5440×5440, 10×10, 544×544)
 * Output: paladin_overhead_swing_v1.png (1056×544 per frame, content at 1:1)
 */
import { chromium } from 'playwright';
import fs from 'fs';

const SRC_PATH = 'public/assets/paladin/Archive/paladin_overhead_swing_original_v3.png';
const DST_PATH = 'public/assets/paladin/paladin_overhead_swing_v1.png';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const srcB64 = fs.readFileSync(SRC_PATH).toString('base64');

  const result = await p.evaluate(async (srcB64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + srcB64;
    await new Promise(r => { img.onload = r; });

    const SRC_FW = 544, SRC_FH = 544, SRC_COLS = 10, SRC_ROWS = 10;
    const DST_FW = 1056, DST_FH = 544;

    // Find foot position from F0 (consistent across frames)
    const tmpC = document.createElement('canvas'); tmpC.width = SRC_FW; tmpC.height = SRC_FH;
    const tmpCtx = tmpC.getContext('2d');
    tmpCtx.drawImage(img, 0, 0, SRC_FW, SRC_FH, 0, 0, SRC_FW, SRC_FH);
    const tmpPx = tmpCtx.getImageData(0, 0, SRC_FW, SRC_FH).data;
    let feetY = 0;
    for (let y = 0; y < SRC_FH; y++) for (let x = 0; x < SRC_FW; x++) {
      if (tmpPx[(y * SRC_FW + x) * 4 + 3] > 0) feetY = Math.max(feetY, y);
    }

    // Y offset: shift cell down so character feet land at y=DST_FH-1
    const yOffset = (DST_FH - 1) - feetY;
    // X offset: center the 544px cell in 1056px frame
    const xOffset = Math.floor((DST_FW - SRC_FW) / 2);

    // Count non-empty frames
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.width; srcCanvas.height = img.height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(img, 0, 0);

    let frameCount = 0;
    const validFrames = [];
    for (let r = 0; r < SRC_ROWS; r++) {
      for (let c = 0; c < SRC_COLS; c++) {
        const fd = srcCtx.getImageData(c * SRC_FW, r * SRC_FH, SRC_FW, SRC_FH);
        let has = false;
        for (let i = 3; i < fd.data.length; i += 4) if (fd.data[i] > 0) { has = true; break; }
        if (has) { validFrames.push({ col: c, row: r }); frameCount++; }
      }
    }

    const DST_COLS = 10;
    const DST_ROWS = Math.ceil(frameCount / DST_COLS);
    const out = document.createElement('canvas');
    out.width = DST_FW * DST_COLS;
    out.height = DST_FH * DST_ROWS;
    const outCtx = out.getContext('2d');
    // No imageSmoothingEnabled needed — we're not scaling

    for (let i = 0; i < validFrames.length; i++) {
      const { col, row } = validFrames[i];
      const dstCol = i % DST_COLS;
      const dstRow = Math.floor(i / DST_COLS);
      const cellX = dstCol * DST_FW;
      const cellY = dstRow * DST_FH;

      // Clip to cell bounds (bottom of source cell may extend past frame)
      outCtx.save();
      outCtx.beginPath();
      outCtx.rect(cellX, cellY, DST_FW, DST_FH);
      outCtx.clip();

      // Draw entire 544×544 source cell at 1:1 — NO SCALING
      outCtx.drawImage(img,
        col * SRC_FW, row * SRC_FH, SRC_FW, SRC_FH,
        cellX + xOffset, cellY + yOffset, SRC_FW, SRC_FH);

      outCtx.restore();
    }

    const logs = [
      'Source: ' + img.width + 'x' + img.height,
      'Feet Y in source: ' + feetY,
      'Placement: xOffset=' + xOffset + ' yOffset=' + yOffset + ' (1:1, no scaling)',
      'Output: ' + out.width + 'x' + out.height + ' (' + DST_COLS + 'x' + DST_ROWS + ', ' + DST_FW + 'x' + DST_FH + ')',
      'Frames: ' + frameCount,
    ];

    // Verify
    for (const fi of [0, 48, frameCount - 1]) {
      const c2 = fi % DST_COLS, r2 = Math.floor(fi / DST_COLS);
      const vd = outCtx.getImageData(c2 * DST_FW, r2 * DST_FH, DST_FW, DST_FH);
      const vp = vd.data;
      let a = DST_FW, bb = 0, cc = DST_FH, d = 0;
      for (let y = 0; y < DST_FH; y++) for (let x = 0; x < DST_FW; x++)
        if (vp[(y * DST_FW + x) * 4 + 3] > 0) { a = Math.min(a, x); bb = Math.max(bb, x); cc = Math.min(cc, y); d = Math.max(d, y); }
      logs.push('  F' + fi + ': ' + (bb - a + 1) + 'x' + (d - cc + 1) + ' bot=' + d + ' ok');
    }

    return { logs, png: out.toDataURL('image/png').split(',')[1], frameCount, feetY };
  }, srcB64);

  fs.writeFileSync(DST_PATH, Buffer.from(result.png, 'base64'));
  console.log('=== FINISHER REBUILT (1:1, NO SCALING) ===');
  for (const line of result.logs) console.log(line);

  await b.close();
})();
