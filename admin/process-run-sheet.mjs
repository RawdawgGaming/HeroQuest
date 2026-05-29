import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const buf = fs.readFileSync('Character Pose Sheets/Paladin/Run/Character-running.png');
  const b64 = buf.toString('base64');

  const result = await p.evaluate(async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await new Promise(r => { img.onload = r; });

    const W = img.width, H = img.height;
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sctx = src.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(img, 0, 0);
    const id = sctx.getImageData(0, 0, W, H);
    const px = id.data;

    // Remove grey background — any pixel where R/G/B are all within 30 of 128
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i+1], b = px[i+2];
      const isGrey = Math.abs(r - 128) < 35 && Math.abs(g - 128) < 35 && Math.abs(b - 128) < 35;
      if (isGrey) px[i+3] = 0;
    }
    sctx.putImageData(id, 0, 0);

    // Find character blobs
    const colHas = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        if (px[(y * W + x) * 4 + 3] > 30) { colHas[x] = 1; break; }
      }
    }
    const blobs = [];
    let inBlob = false, bStart = 0;
    for (let x = 0; x <= W; x++) {
      if (x < W && colHas[x] && !inBlob) { bStart = x; inBlob = true; }
      if ((x >= W || !colHas[x]) && inBlob) {
        blobs.push({ x: bStart, w: x - bStart });
        inBlob = false;
      }
    }

    // For each blob, find tight vertical bounds
    const chars = blobs.map(blob => {
      let minY = H, maxY = 0;
      for (let y = 0; y < H; y++) {
        for (let x = blob.x; x < blob.x + blob.w; x++) {
          if (px[(y * W + x) * 4 + 3] > 30) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      return { ...blob, minY, maxY, h: maxY - minY + 1 };
    });

    const NUM = chars.length;
    const maxW = Math.max(...chars.map(c => c.w));
    const maxH = Math.max(...chars.map(c => c.h));
    const globalBot = Math.max(...chars.map(c => c.maxY));

    // Scale to fit 64x64 with 2px margin
    const usable = 60;
    const scale = Math.min(usable / maxW, usable / maxH);

    // Output: NUM frames, 64x64 each, 7px spacing
    const FRAME = 64;
    const SPACING = 7;
    const outW = NUM * FRAME + (NUM - 1) * SPACING;
    const out = document.createElement('canvas');
    out.width = outW; out.height = FRAME;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;

    const frameInfo = [];
    for (let i = 0; i < NUM; i++) {
      const ch = chars[i];
      const sw = Math.round(ch.w * scale);
      const sh = Math.round(ch.h * scale);
      const fx = i * (FRAME + SPACING);
      // Center horizontally
      const destX = fx + Math.round((FRAME - sw) / 2);
      // Align feet to y=62 (2px bottom margin)
      const destY = 62 - sh;

      octx.drawImage(src, ch.x, ch.minY, ch.w, ch.h, destX, destY, sw, sh);
      frameInfo.push({ i, srcX: ch.x, srcW: ch.w, srcH: ch.h, destX, destY, sw, sh });
    }

    return {
      NUM, outW, outH: FRAME, scale: scale.toFixed(4),
      maxCharSize: maxW + 'x' + maxH,
      frameInfo,
      b64: out.toDataURL('image/png').split(',')[1]
    };
  }, b64);

  // Save
  fs.writeFileSync('public/assets/paladin/run.png', Buffer.from(result.b64, 'base64'));
  fs.writeFileSync('Character Pose Sheets/Paladin/Run/Paladin_Run_Processed.png', Buffer.from(result.b64, 'base64'));

  console.log('Frames:', result.NUM);
  console.log('Max char size:', result.maxCharSize);
  console.log('Scale:', result.scale);
  console.log('Output:', result.outW + 'x' + result.outH);
  console.log('Frame size: 64x64, spacing: 7px');
  await b.close();
})();
