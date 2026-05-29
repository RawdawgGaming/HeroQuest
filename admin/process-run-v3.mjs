import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const buf = fs.readFileSync('Character Pose Sheets/Paladin/Run/Run_v3_672x448_sheet.png');
  const b64 = buf.toString('base64');

  const result = await p.evaluate(async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await new Promise(r => { img.onload = r; });

    const W = img.width, H = img.height; // 3360x2240
    const COLS = 5, CELL_W = W / COLS, CELL_H = H / COLS; // 672x448

    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sctx = src.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(img, 0, 0);
    const id = sctx.getImageData(0, 0, W, H);
    const px = id.data;

    // Remove white/near-white background
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i+1], b = px[i+2];
      if (r > 240 && g > 240 && b > 240) px[i+3] = 0;
    }
    sctx.putImageData(id, 0, 0);

    // Extract frames in reading order (left→right, top→bottom)
    // 5 rows of 5, last row has 2 = 22 total
    const ROWS = 5;
    const chars = [];
    for (let row = 0; row < ROWS; row++) {
      const colsInRow = (row === ROWS - 1) ? 2 : COLS;
      for (let col = 0; col < colsInRow; col++) {
        const cx = col * CELL_W, cy = row * CELL_H;
        // Find tight bbox within this cell
        let minX = CELL_W, maxX = 0, minY = CELL_H, maxY = 0, has = false;
        for (let y = 0; y < CELL_H; y++) {
          for (let x = 0; x < CELL_W; x++) {
            if (px[((cy + y) * W + (cx + x)) * 4 + 3] > 30) {
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
              has = true;
            }
          }
        }
        if (has) {
          chars.push({
            cellX: cx, cellY: cy,
            bx: minX, by: minY, bw: maxX - minX + 1, bh: maxY - minY + 1,
            absX: cx + minX, absY: cy + minY
          });
        }
      }
    }

    const NUM = chars.length;
    const maxW = Math.max(...chars.map(c => c.bw));
    const maxH = Math.max(...chars.map(c => c.bh));
    const scale = Math.min(60 / maxW, 60 / maxH);
    const globalMaxBotRel = Math.max(...chars.map(c => c.by + c.bh)); // relative to cell

    // Build strip: NUM frames × 64×64, 7px spacing
    const FRAME = 64, SPACING = 7;
    const outW = NUM * FRAME + (NUM - 1) * SPACING;
    const out = document.createElement('canvas');
    out.width = outW; out.height = FRAME;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;

    for (let i = 0; i < NUM; i++) {
      const ch = chars[i];
      const sw = Math.round(ch.bw * scale), sh = Math.round(ch.bh * scale);
      const fx = i * (FRAME + SPACING);
      const destX = fx + Math.round((FRAME - sw) / 2);
      const destY = 62 - sh; // feet at y=62
      octx.drawImage(src, ch.absX, ch.absY, ch.bw, ch.bh, destX, destY, sw, sh);
    }

    // Check loop: compare frame 0 vs last frame
    const outId = octx.getImageData(0, 0, outW, FRAME);
    const op = outId.data;
    let loopDiff = 0;
    const lastFx = (NUM - 1) * (FRAME + SPACING);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i0 = (y * outW + x) * 4;
      const iL = (y * outW + lastFx + x) * 4;
      if (op[i0] !== op[iL] || op[i0+1] !== op[iL+1] || op[i0+2] !== op[iL+2] || op[i0+3] !== op[iL+3]) loopDiff++;
    }

    // Also check frame 0 vs all others to find best loop partner
    const bestLoop = [];
    for (let f = 1; f < NUM; f++) {
      let d = 0;
      const ffx = f * (FRAME + SPACING);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const i0 = (y * outW + x) * 4;
        const iF = (y * outW + ffx + x) * 4;
        if (op[i0] !== op[iF] || op[i0+1] !== op[iF+1] || op[i0+2] !== op[iF+2] || op[i0+3] !== op[iF+3]) d++;
      }
      bestLoop.push({ f, d, pct: (d/(64*64)*100).toFixed(1) });
    }
    bestLoop.sort((a, b) => a.d - b.d);

    return {
      NUM, outW, scale: scale.toFixed(4), maxW, maxH,
      loopDiff, loopPct: (loopDiff/(64*64)*100).toFixed(1),
      bestLoop: bestLoop.slice(0, 5),
      b64: out.toDataURL('image/png').split(',')[1]
    };
  }, b64);

  fs.writeFileSync('public/assets/paladin/run.png', Buffer.from(result.b64, 'base64'));
  console.log('Frames:', result.NUM, '| Sheet:', result.outW + 'x64 | Scale:', result.scale);
  console.log('Max char:', result.maxW + 'x' + result.maxH);
  console.log('');
  console.log('Loop check (F0 vs F' + (result.NUM-1) + '):', result.loopDiff, 'px (' + result.loopPct + '%)');
  console.log('Best loop partners for F0:', result.bestLoop.map(l => 'F'+l.f+'('+l.pct+'%)').join(', '));
  await b.close();
})();
