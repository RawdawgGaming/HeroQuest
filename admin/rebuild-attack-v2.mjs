/**
 * REBUILD ATTACK SHEET v2 — from new 5440×5440 source (10×10, 544×544, 96 frames)
 * Scale: 385/275 = 1.4x (body matches idle torso height)
 * Output: 1056×480 frames, body centered, feet at bottom.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const SRC_PATH = 'public/assets/paladin/Archive/paladin_attack_original_v2.png';
const DST_PATH = 'public/assets/paladin/paladin_attack_main_v1.png';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const srcB64 = fs.readFileSync(SRC_PATH).toString('base64');

  const result = await p.evaluate(async (srcB64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + srcB64;
    await new Promise(r => { img.onload = r; });

    const SRC_FW = 544, SRC_FH = 544, SRC_COLS = 10, SRC_ROWS = 10;
    const DST_FW = 1056, DST_FH = 480;
    const SCALE = 385 / 275;
    const TARGET_FEET_Y = DST_FH - 1;
    const MAX_FRAMES = 96;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.width; srcCanvas.height = img.height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(img, 0, 0);

    let frameCount = 0;
    const frameBboxes = [];
    for (let r = 0; r < SRC_ROWS && frameBboxes.length < MAX_FRAMES; r++) {
      for (let c = 0; c < SRC_COLS && frameBboxes.length < MAX_FRAMES; c++) {
        const fd = srcCtx.getImageData(c * SRC_FW, r * SRC_FH, SRC_FW, SRC_FH);
        const px = fd.data;
        for (let j = 0; j < px.length; j += 4) {
          if (px[j] > 240 && px[j+1] > 240 && px[j+2] > 240) px[j+3] = 0;
        }
        let minX = SRC_FW, maxX = 0, minY = SRC_FH, maxY = 0, has = false;
        for (let y = 0; y < SRC_FH; y++) for (let x = 0; x < SRC_FW; x++) {
          if (px[(y * SRC_FW + x) * 4 + 3] > 30) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            has = true;
          }
        }
        if (has && (maxX - minX) > 10) {
          frameBboxes.push({ minX, maxX, minY, maxY,
            w: maxX-minX+1, h: maxY-minY+1, imageData: fd });
        }
      }
    }

    frameCount = frameBboxes.length;
    const DST_COLS = 10;
    const DST_ROWS = Math.ceil(frameCount / DST_COLS);

    const out = document.createElement('canvas');
    out.width = DST_FW * DST_COLS;
    out.height = DST_FH * DST_ROWS;
    const outCtx = out.getContext('2d');
    outCtx.imageSmoothingEnabled = false;

    let clipped = 0;
    for (let i = 0; i < frameBboxes.length; i++) {
      const fb = frameBboxes[i];
      const tmp = document.createElement('canvas');
      tmp.width = SRC_FW; tmp.height = SRC_FH;
      tmp.getContext('2d').putImageData(fb.imageData, 0, 0);

      const dstW = Math.round(fb.w * SCALE);
      const dstH = Math.round(fb.h * SCALE);
      const dstLeftX = Math.round((DST_FW - dstW) / 2);
      const dstTopY = TARGET_FEET_Y - dstH + 1;

      if (dstLeftX < 0 || (dstLeftX + dstW) > DST_FW || dstTopY < 0) clipped++;

      const dstCol = i % DST_COLS;
      const dstRow = Math.floor(i / DST_COLS);
      const cellX = dstCol * DST_FW;
      const cellY = dstRow * DST_FH;

      outCtx.save();
      outCtx.beginPath();
      outCtx.rect(cellX, cellY, DST_FW, DST_FH);
      outCtx.clip();
      outCtx.drawImage(tmp, fb.minX, fb.minY, fb.w, fb.h,
        cellX + dstLeftX, cellY + dstTopY, dstW, dstH);
      outCtx.restore();
    }

    const logs = [
      'Source: ' + img.width + 'x' + img.height + ' (' + SRC_COLS + 'x' + SRC_ROWS + ', ' + SRC_FW + 'x' + SRC_FH + ')',
      'Scale: ' + SCALE.toFixed(4) + 'x',
      'Output: ' + out.width + 'x' + out.height + ' (' + DST_COLS + 'x' + DST_ROWS + ', ' + DST_FW + 'x' + DST_FH + ')',
      'Frames: ' + frameCount + ', clipped: ' + clipped,
    ];
    for (const fi of [0, 1, 48, 90, frameCount-1]) {
      if (fi >= frameCount) continue;
      const col = fi % DST_COLS, row = Math.floor(fi / DST_COLS);
      const vd = outCtx.getImageData(col*DST_FW, row*DST_FH, DST_FW, DST_FH);
      const vp = vd.data;
      let vMinX=DST_FW,vMaxX=0,vMinY=DST_FH,vMaxY=0;
      for(let y=0;y<DST_FH;y++)for(let x=0;x<DST_FW;x++)if(vp[(y*DST_FW+x)*4+3]>30){vMinX=Math.min(vMinX,x);vMaxX=Math.max(vMaxX,x);vMinY=Math.min(vMinY,y);vMaxY=Math.max(vMaxY,y);}
      const touch=vMinX===0||vMaxX===DST_FW-1||vMinY===0;
      logs.push('  F'+fi+': '+(vMaxX-vMinX+1)+'x'+(vMaxY-vMinY+1)+' bot='+vMaxY+' '+(touch?'CLIP':'ok'));
    }
    return { logs, png: out.toDataURL('image/png').split(',')[1], frameCount };
  }, srcB64);

  fs.writeFileSync(DST_PATH, Buffer.from(result.png, 'base64'));
  console.log('=== ATTACK v2 REBUILT ===');
  for (const line of result.logs) console.log(line);
  await b.close();
})();
