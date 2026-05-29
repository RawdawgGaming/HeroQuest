/**
 * NORMALIZE ATTACK SHEET v3 — Matches idle body position
 *
 * Same as v2 (scale 1.546x, 1056×480 output) but positions the body to match
 * idle's horizontal offset from frame center. Idle body center is 56px left
 * of frame center. This script applies the same offset so idle↔attack
 * transitions don't cause a horizontal pop.
 *
 * Usage: node admin/normalize-attack-v3.mjs
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

    const SRC_FW = 672, SRC_FH = 448;
    const SRC_COLS = 8;
    const DST_FW = 1056, DST_FH = 480;
    const DST_COLS = 7, DST_ROWS = 9;

    const SCALE = 385 / 249; // match idle body height
    const TARGET_FEET_Y = DST_FH - 1; // y=479

    // Idle body center is at x=280 in 672px frame → 56px left of center.
    // Rendered offset = (280 - 336) * 86/448 = -10.75px left of anchor.
    // Attack must have the SAME rendered offset:
    //   (body_center - DST_FW/2) * 86/448 = -10.75
    //   body_center = DST_FW/2 - 56 = 528 - 56 = 472
    // So shift all content 56px left of where centering would place it.
    const BODY_SHIFT_X = -56;

    const logs = [];
    const out = document.createElement('canvas');
    out.width = DST_FW * DST_COLS;
    out.height = DST_FH * DST_ROWS;
    const outCtx = out.getContext('2d');
    outCtx.imageSmoothingEnabled = false;

    let frameCount = 0;
    let clippedCount = 0;

    for (let srcRow = 0; srcRow < 8; srcRow++) {
      for (let srcCol = 0; srcCol < SRC_COLS; srcCol++) {
        const srcC = document.createElement('canvas');
        srcC.width = SRC_FW; srcC.height = SRC_FH;
        const srcCtx = srcC.getContext('2d');
        srcCtx.imageSmoothingEnabled = false;
        srcCtx.drawImage(img, srcCol * SRC_FW, srcRow * SRC_FH, SRC_FW, SRC_FH, 0, 0, SRC_FW, SRC_FH);

        // Remove white background
        const srcData = srcCtx.getImageData(0, 0, SRC_FW, SRC_FH);
        const px = srcData.data;
        for (let j = 0; j < px.length; j += 4) {
          if (px[j] > 240 && px[j+1] > 240 && px[j+2] > 240) px[j+3] = 0;
        }
        srcCtx.putImageData(srcData, 0, 0);

        // Find bbox
        let minX = SRC_FW, maxX = 0, minY = SRC_FH, maxY = 0, has = false;
        for (let y = 0; y < SRC_FH; y++) for (let x = 0; x < SRC_FW; x++) {
          if (px[(y * SRC_FW + x) * 4 + 3] > 30) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            has = true;
          }
        }
        if (!has || (maxX - minX) < 10) continue;

        const srcW = maxX - minX + 1, srcH = maxY - minY + 1;
        const dstW = Math.round(srcW * SCALE);
        const dstH = Math.round(srcH * SCALE);

        // Position: feet at bottom, centered + body shift
        const dstTopY = TARGET_FEET_Y - dstH + 1;
        const dstLeftX = Math.round((DST_FW - dstW) / 2) + BODY_SHIFT_X;

        const clips = dstLeftX < 0 || (dstLeftX + dstW) > DST_FW || dstTopY < 0;
        if (clips) clippedCount++;

        const dstCol = frameCount % DST_COLS;
        const dstRow = Math.floor(frameCount / DST_COLS);
        const cellX = dstCol * DST_FW;
        const cellY = dstRow * DST_FH;

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

    // Verify body center alignment
    logs.push('Frames: ' + frameCount + ', clipped: ' + clippedCount);
    for (const fi of [0, 1, 30, 55, 62]) {
      if (fi >= frameCount) continue;
      const col = fi % DST_COLS, row = Math.floor(fi / DST_COLS);
      const vData = outCtx.getImageData(col*DST_FW, row*DST_FH, DST_FW, DST_FH);
      const vPx = vData.data;
      let vMinX=DST_FW, vMaxX=0, vMinY=DST_FH, vMaxY=0;
      for(let y=0;y<DST_FH;y++) for(let x=0;x<DST_FW;x++) {
        if(vPx[(y*DST_FW+x)*4+3]>30){vMinX=Math.min(vMinX,x);vMaxX=Math.max(vMaxX,x);vMinY=Math.min(vMinY,y);vMaxY=Math.max(vMaxY,y);}
      }
      const cx = Math.round((vMinX+vMaxX)/2);
      const bodyOff = (cx - DST_FW/2) * 86/448;
      const touchEdge = vMinX===0||vMaxX===DST_FW-1||vMinY===0;
      logs.push('  F'+fi+': ['+vMinX+'-'+vMaxX+'] cx='+cx+' bodyOffset='+bodyOff.toFixed(1)+'px' + (touchEdge?' CLIP':' ok'));
    }

    return { logs, png: out.toDataURL('image/png').split(',')[1], frameCount };
  }, atkB64);

  fs.writeFileSync('public/assets/paladin/paladin_attack_main_v1.png',
    Buffer.from(result.png, 'base64'));

  console.log('=== NORMALIZE v3 COMPLETE ===');
  for (const line of result.logs) console.log(line);

  await b.close();
})();
