import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  // Read source from public/assets directly
  const buf = fs.readFileSync('public/assets/paladin/run.png');
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

    // Remove white/near-white background
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 240 && px[i+1] > 240 && px[i+2] > 240) px[i+3] = 0;
    }
    sctx.putImageData(id, 0, 0);

    // Grid: 5 cols, rows auto-detected from height
    const COLS = 5;
    const CELL_W = W / COLS;
    const CELL_H = CELL_W * (2240 / 3360); // maintain aspect from known ratio
    const ROWS = Math.round(H / CELL_H);

    // Extract frames in reading order, skip empty cells
    const chars = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = col * CELL_W, cy = row * CELL_H;
        let minX = CELL_W, maxX = 0, minY = CELL_H, maxY = 0, has = false;
        for (let y = 0; y < CELL_H; y++) {
          for (let x = 0; x < CELL_W; x++) {
            const gi = (Math.round(cy + y) * W + Math.round(cx + x)) * 4;
            if (px[gi + 3] > 30) {
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
              has = true;
            }
          }
        }
        if (has && (maxX - minX) > 10) {
          chars.push({
            absX: Math.round(cx + minX), absY: Math.round(cy + minY),
            bw: maxX - minX + 1, bh: maxY - minY + 1
          });
        }
      }
    }

    const NUM = chars.length;
    const maxW = Math.max(...chars.map(c => c.bw));
    const maxH = Math.max(...chars.map(c => c.bh));
    const scale = Math.min(60 / maxW, 60 / maxH);

    // Build strip: 64x64 frames, no spacing (clean strip for Phaser)
    const FRAME = 64;
    const out = document.createElement('canvas');
    out.width = FRAME * NUM; out.height = FRAME;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;

    for (let i = 0; i < NUM; i++) {
      const ch = chars[i];
      const sw = Math.round(ch.bw * scale), sh = Math.round(ch.bh * scale);
      const destX = i * FRAME + Math.round((FRAME - sw) / 2);
      const destY = 62 - sh;
      octx.drawImage(src, ch.absX, ch.absY, ch.bw, ch.bh, destX, destY, sw, sh);
    }

    // Check loop: F0 vs last
    const outId = octx.getImageData(0, 0, out.width, FRAME);
    const op = outId.data;
    let loopDiff = 0;
    const lastFx = (NUM - 1) * FRAME;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i0 = (y * out.width + x) * 4;
      const iL = (y * out.width + lastFx + x) * 4;
      if (op[i0] !== op[iL] || op[i0+1] !== op[iL+1] || op[i0+2] !== op[iL+2] || op[i0+3] !== op[iL+3]) loopDiff++;
    }

    return {
      NUM, outW: out.width, scale: scale.toFixed(4),
      loopDiff, loopPct: (loopDiff/(64*64)*100).toFixed(1),
      b64: out.toDataURL('image/png').split(',')[1]
    };
  }, b64);

  // Overwrite the source with the processed strip
  fs.writeFileSync('public/assets/paladin/run.png', Buffer.from(result.b64, 'base64'));
  console.log('Frames:', result.NUM, '| Output:', result.outW + 'x64 | Scale:', result.scale);
  console.log('Loop (F0 vs F' + (result.NUM-1) + '):', result.loopDiff, 'px (' + result.loopPct + '%)');
  await b.close();
})();
