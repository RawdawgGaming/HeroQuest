/**
 * REFRAME ATTACK SHEET — Expand frame canvas to eliminate clipping
 *
 * The current attack PNG has 672×448 frames with content that clips at edges
 * (weapon extends beyond frame during overhead swing and wide follow-through).
 *
 * This script copies each frame's content into a LARGER frame (1056×480),
 * centered horizontally with feet at the new frame's bottom. This gives the
 * weapon arc room to display without clipping.
 *
 * Content that was previously clipped (by the normalize script) remains missing,
 * but at render scale (86/448 = 0.19x) this amounts to <6px at the top and the
 * weapon tips at frame edges — not visible during fast attack animation.
 *
 * Usage: node admin/reframe-attack-sheet.mjs
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

    // Current frame layout
    const OLD_FW = 672, OLD_FH = 448;
    const OLD_COLS = 9, OLD_ROWS = 8;
    const FRAMES = 67;

    // New frame size — large enough for weapon arc
    // Width: 672 content + 192px margin each side = 1056
    // Height: 448 content + 32px top margin = 480
    const NEW_FW = 1056, NEW_FH = 480;
    // Layout: 7 cols × 10 rows = 70 cells (≥ 67 frames)
    const NEW_COLS = 7, NEW_ROWS = 10;

    // Offset to place 672×448 content in 1056×480 frame
    // Centered horizontally: (1056-672)/2 = 192
    // Bottom-aligned (feet at y=447 → y=479): shift down by 480-448 = 32
    const OFFSET_X = Math.floor((NEW_FW - OLD_FW) / 2); // 192
    const OFFSET_Y = NEW_FH - OLD_FH; // 32

    const out = document.createElement('canvas');
    out.width = NEW_FW * NEW_COLS;   // 7392
    out.height = NEW_FH * NEW_ROWS;  // 4800
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < FRAMES; i++) {
      // Source position in old grid
      const oldCol = i % OLD_COLS, oldRow = Math.floor(i / OLD_COLS);
      const srcX = oldCol * OLD_FW, srcY = oldRow * OLD_FH;

      // Destination position in new grid
      const newCol = i % NEW_COLS, newRow = Math.floor(i / NEW_COLS);
      const dstX = newCol * NEW_FW + OFFSET_X;
      const dstY = newRow * NEW_FH + OFFSET_Y;

      ctx.drawImage(img, srcX, srcY, OLD_FW, OLD_FH, dstX, dstY, OLD_FW, OLD_FH);
    }

    // Verify: measure a few frames in the new layout
    const logs = [];
    logs.push(`New frame: ${NEW_FW}x${NEW_FH} (${NEW_COLS} cols × ${NEW_ROWS} rows)`);
    logs.push(`Sheet: ${out.width}x${out.height}`);
    logs.push(`Content offset: x=${OFFSET_X}, y=${OFFSET_Y}`);
    logs.push(`Feet position: y=${OFFSET_Y + OLD_FH - 1} = ${NEW_FH - 1}`);

    for (const fi of [0, 15, 30, 55, 66]) {
      const col = fi % NEW_COLS, row = Math.floor(fi / NEW_COLS);
      const fData = ctx.getImageData(col * NEW_FW, row * NEW_FH, NEW_FW, NEW_FH);
      const px = fData.data;
      let minX = NEW_FW, maxX = 0, minY = NEW_FH, maxY = 0;
      for (let y = 0; y < NEW_FH; y++) for (let x = 0; x < NEW_FW; x++) {
        if (px[(y * NEW_FW + x) * 4 + 3] > 30) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      const touchEdge = minX === 0 || maxX === NEW_FW-1 || minY === 0;
      logs.push(`  F${fi}: [${minX}-${maxX}, ${minY}-${maxY}] ${maxX-minX+1}x${maxY-minY+1} clip=${touchEdge}`);
    }

    return {
      logs,
      png: out.toDataURL('image/png').split(',')[1],
      width: out.width,
      height: out.height,
    };
  }, atkB64);

  fs.writeFileSync('public/assets/paladin/paladin_attack_main_v1.png',
    Buffer.from(result.png, 'base64'));

  console.log('=== REFRAME COMPLETE ===');
  for (const line of result.logs) console.log(line);
  console.log(`\nOutput: ${result.width}x${result.height} PNG`);

  await b.close();
})();
