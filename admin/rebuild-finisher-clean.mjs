/**
 * REBUILD FINISHER — CLEAN (no pixel modification)
 *
 * Previous builds removed near-white pixels, tattering the sprites.
 * This version does NOT touch any source pixels — just scales and places.
 * The source PNG already has a transparent background.
 *
 * Source: Archive/paladin_overhead_swing_original_v3.png (5440×5440, 10×10, 544×544, 96 frames)
 * Output: paladin_overhead_swing_v1.png (1056×544 frames)
 * Scale: 385/275 = 1.4x
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
    const SCALE = 385 / 275;
    const TARGET_FEET_Y = DST_FH - 1;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.width; srcCanvas.height = img.height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(img, 0, 0);

    // First pass: find bounding boxes using alpha ONLY — no pixel modification
    const frameBboxes = [];
    for (let r = 0; r < SRC_ROWS; r++) {
      for (let c = 0; c < SRC_COLS; c++) {
        const fd = srcCtx.getImageData(c * SRC_FW, r * SRC_FH, SRC_FW, SRC_FH);
        const px = fd.data;
        // NO white removal — source is already transparent-background
        let minX = SRC_FW, maxX = 0, minY = SRC_FH, maxY = 0, has = false;
        for (let y = 0; y < SRC_FH; y++) for (let x = 0; x < SRC_FW; x++) {
          if (px[(y * SRC_FW + x) * 4 + 3] > 30) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y); has = true;
          }
        }
        if (has && (maxX - minX) > 10)
          frameBboxes.push({ col: c, row: r, minX, maxX, minY, maxY,
            w: maxX-minX+1, h: maxY-minY+1 });
      }
    }

    const frameCount = frameBboxes.length;
    const DST_COLS = 10;
    const DST_ROWS = Math.ceil(frameCount / DST_COLS);
    const out = document.createElement('canvas');
    out.width = DST_FW * DST_COLS; out.height = DST_FH * DST_ROWS;
    const outCtx = out.getContext('2d');
    outCtx.imageSmoothingEnabled = false;

    let clipped = 0;
    for (let i = 0; i < frameBboxes.length; i++) {
      const fb = frameBboxes[i];
      // Scale content dimensions
      const dstW = Math.round(fb.w * SCALE), dstH = Math.round(fb.h * SCALE);
      const dstLeftX = Math.round((DST_FW - dstW) / 2);
      const dstTopY = TARGET_FEET_Y - dstH + 1;
      if (dstLeftX < 0 || (dstLeftX + dstW) > DST_FW || dstTopY < 0) clipped++;

      const cellX = (i % DST_COLS) * DST_FW, cellY = Math.floor(i / DST_COLS) * DST_FH;
      outCtx.save();
      outCtx.beginPath(); outCtx.rect(cellX, cellY, DST_FW, DST_FH); outCtx.clip();
      // Draw directly from the SOURCE IMAGE — not from getImageData/putImageData.
      // This preserves every pixel exactly as the source PNG encodes it.
      outCtx.drawImage(img,
        fb.col * SRC_FW + fb.minX, fb.row * SRC_FH + fb.minY, fb.w, fb.h,
        cellX + dstLeftX, cellY + dstTopY, dstW, dstH);
      outCtx.restore();
    }

    const logs = [
      'Frames: ' + frameCount + ', clipped: ' + clipped,
      'Output: ' + out.width + 'x' + out.height + ' (' + DST_COLS + 'x' + DST_ROWS + ', ' + DST_FW + 'x' + DST_FH + ')',
    ];
    for (const fi of [0, 48, frameCount-1]) {
      const col=fi%DST_COLS, row=Math.floor(fi/DST_COLS);
      const vd=outCtx.getImageData(col*DST_FW,row*DST_FH,DST_FW,DST_FH);
      const vp=vd.data;
      let a=DST_FW,bb=0,cc=DST_FH,d=0;
      for(let y=0;y<DST_FH;y++)for(let x=0;x<DST_FW;x++)if(vp[(y*DST_FW+x)*4+3]>30){a=Math.min(a,x);bb=Math.max(bb,x);cc=Math.min(cc,y);d=Math.max(d,y);}
      logs.push('  F'+fi+': '+(bb-a+1)+'x'+(d-cc+1)+' bot='+d+' '+(a===0||bb===DST_FW-1||cc===0?'CLIP':'ok'));
    }
    return { logs, png: out.toDataURL('image/png').split(',')[1], frameCount };
  }, srcB64);

  fs.writeFileSync(DST_PATH, Buffer.from(result.png, 'base64'));
  console.log('=== FINISHER REBUILT (CLEAN) ===');
  for (const line of result.logs) console.log(line);
  await b.close();
})();
