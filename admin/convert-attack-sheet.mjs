// Convert 544x544 attack sheet → 1056x544 canvas per frame
// Places each 544x544 cell into 1056x544 at 1:1 (no scaling needed —
// body is already ~275px, matching the old attack system expectations).
// Centered horizontally so body center aligns with frame center.
//
// Input:  public/assets/paladin/paladin_attack_main_v1.png (7072x6528, 13x12 grid, 146 frames)
// Output: public/assets/paladin/paladin_attack_main_v1_converted.png

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SRC_PATH = path.join(root, 'public/assets/paladin/paladin_attack_main_v1.png');
const OUT_PATH = path.join(root, 'public/assets/paladin/paladin_attack_main_v1_converted.png');

const SRC_FW = 544, SRC_FH = 544;
const SRC_COLS = 9;
const TOTAL_FRAMES = 65;

const DST_FW = 1056, DST_FH = 544;
const DST_COLS = 7;
const DST_ROWS = Math.ceil(TOTAL_FRAMES / DST_COLS); // 21

// Body measurements: feet at y=415, center X ~236
// Shift down so feet land at frame bottom (y=543): 543 - 415 = 128
// Center body in 1056 wide frame: body center at 528
// Body center in source is ~236, so shift = 528 - 236 = 292
const PLACE_X = 528 - 236;  // 292
const PLACE_Y = 543 - 415;  // 128 — feet at frame bottom

async function main() {
  const img = await loadImage(SRC_PATH);
  console.log(`Source: ${img.width}x${img.height}`);
  console.log(`Frames: ${SRC_FW}x${SRC_FH}, ${TOTAL_FRAMES} total`);

  const outW = DST_COLS * DST_FW;
  const outH = DST_ROWS * DST_FH;
  console.log(`Output: ${outW}x${outH} (${DST_COLS}x${DST_ROWS} grid)`);
  console.log(`Placement: x=${PLACE_X}, y=${PLACE_Y}`);

  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const srcCol = i % SRC_COLS;
    const srcRow = Math.floor(i / SRC_COLS);
    const dstCol = i % DST_COLS;
    const dstRow = Math.floor(i / DST_COLS);

    const sx = srcCol * SRC_FW;
    const sy = srcRow * SRC_FH;
    const dx = dstCol * DST_FW + PLACE_X;
    const dy = dstRow * DST_FH + PLACE_Y;

    // 1:1 placement, no scaling
    ctx.drawImage(img, sx, sy, SRC_FW, SRC_FH, dx, dy, SRC_FW, SRC_FH);
  }

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(OUT_PATH, buf);
  console.log(`Written: ${OUT_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
