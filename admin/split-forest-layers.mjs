// FOREST LEVEL LAYER SEPARATION — v6 (clone-based background reconstruction)
//
// Key improvement: Instead of interpolating/averaging colors (which looked warped),
// CLONE actual pixel columns from clean haze gaps between tree trunks.
// This uses real painted pixel data, so the result looks natural.
//
// Algorithm:
//   1. Score every X column by how much clean haze it contains (y 230-365)
//   2. Mark columns with >60% haze as "clean source columns"
//   3. For the background: each pixel comes from the nearest clean source column
//      at the same Y position — real painted pixels, not averages
//   4. Alpha fades at zone edges for smooth blending
//   5. Foreground: full image minus deeply-interior eroded haze pixels

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SRC = path.join(root, 'Environment/Forest Level/Final Forest Level Image.png');
const OUT_DIR = path.join(root, 'public/assets/Maps/forest-level');

const ZONE_TOP = 230;
const ZONE_BOT = 365;
const FADE_TOP = 40;    // fade zone above ZONE_TOP
const FADE_BOT = 30;    // fade zone below ZONE_BOT
const ERODE_RADIUS = 5;
const MIN_REGION = 400;
const CLEAN_COL_THRESHOLD = 0.55; // 55% haze pixels = "clean gap column"

function isHaze(r, g, b) {
  return (
    b >= 50 && r < 30 && b > r * 2.5 &&
    b >= g * 0.75 && g <= b * 1.2 &&
    (r + g + b) >= 60 && (r + g + b) <= 280
  );
}

async function main() {
  const img = await loadImage(SRC);
  const W = img.width, H = img.height;
  console.log(`Source: ${W}x${H}`);

  const srcCanvas = createCanvas(W, H);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, W, H).data;

  const zoneH = ZONE_BOT - ZONE_TOP;

  // ============================================================
  // STEP 1: Score columns — find clean haze gaps between trees
  // ============================================================
  console.log('Step 1: Scoring columns for clean haze gaps...');

  const colScore = new Float32Array(W); // fraction of haze pixels per column
  for (let x = 0; x < W; x++) {
    let hazeCount = 0;
    for (let y = ZONE_TOP; y < ZONE_BOT; y++) {
      const idx = (y * W + x) * 4;
      if (isHaze(srcData[idx], srcData[idx + 1], srcData[idx + 2])) hazeCount++;
    }
    colScore[x] = hazeCount / zoneH;
  }

  const cleanCols = [];
  for (let x = 0; x < W; x++) {
    if (colScore[x] >= CLEAN_COL_THRESHOLD) cleanCols.push(x);
  }
  console.log(`  Clean source columns: ${cleanCols.length} / ${W} (${(cleanCols.length / W * 100).toFixed(1)}%)`);

  // For each X, find nearest clean column
  const nearestClean = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let best = -1, bestDist = Infinity;
    for (const cx of cleanCols) {
      const d = Math.abs(x - cx);
      if (d < bestDist) { bestDist = d; best = cx; }
    }
    nearestClean[x] = best >= 0 ? best : x;
  }

  // ============================================================
  // STEP 2: Build background by cloning from clean source columns
  // ============================================================
  console.log('Step 2: Building background from cloned source columns...');

  const bgCanvas = createCanvas(W, H);
  const bgCtx = bgCanvas.getContext('2d');
  const bgData = bgCtx.createImageData(W, H);

  const renderTop = ZONE_TOP - FADE_TOP;
  const renderBot = ZONE_BOT + FADE_BOT;

  for (let y = renderTop; y < renderBot; y++) {
    if (y < 0 || y >= H) continue;

    // Alpha fade at edges
    let alpha = 255;
    if (y < ZONE_TOP) {
      alpha = Math.round(255 * (y - renderTop) / FADE_TOP);
    } else if (y > ZONE_BOT) {
      alpha = Math.round(255 * (renderBot - y) / FADE_BOT);
    }
    if (alpha <= 0) continue;

    for (let x = 0; x < W; x++) {
      // Clone pixel from the nearest clean source column at the same Y
      const srcX = nearestClean[x];
      const srcIdx = (y * W + srcX) * 4;
      const dstIdx = (y * W + x) * 4;

      bgData.data[dstIdx]     = srcData[srcIdx];
      bgData.data[dstIdx + 1] = srcData[srcIdx + 1];
      bgData.data[dstIdx + 2] = srcData[srcIdx + 2];
      bgData.data[dstIdx + 3] = alpha;
    }
  }

  bgCtx.putImageData(bgData, 0, 0);

  // Verify no black voids
  let blackCount = 0;
  for (let y = ZONE_TOP; y < ZONE_BOT; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (bgData.data[idx + 3] > 200 &&
          bgData.data[idx] === 0 && bgData.data[idx + 1] === 0 && bgData.data[idx + 2] === 0) {
        blackCount++;
      }
    }
  }
  console.log(`  Background black pixels: ${blackCount} (should be 0)`);

  // ============================================================
  // STEP 3: Build foreground (conservative eroded extraction)
  // ============================================================
  console.log('Step 3: Building foreground...');

  const fgCanvas = createCanvas(W, H);
  const fgCtx = fgCanvas.getContext('2d');
  fgCtx.drawImage(img, 0, 0);
  const fgImgData = fgCtx.getImageData(0, 0, W, H);

  // Build + erode + filter mask (same as v4)
  const mask = new Uint8Array(W * zoneH);
  for (let zy = 0; zy < zoneH; zy++) {
    const y = ZONE_TOP + zy;
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (isHaze(srcData[idx], srcData[idx + 1], srcData[idx + 2])) {
        mask[zy * W + x] = 1;
      }
    }
  }

  const eroded = new Uint8Array(W * zoneH);
  for (let zy = 0; zy < zoneH; zy++) {
    for (let x = 0; x < W; x++) {
      if (mask[zy * W + x] === 0) continue;
      let safe = true;
      for (let dy = -ERODE_RADIUS; dy <= ERODE_RADIUS && safe; dy++) {
        for (let dx = -ERODE_RADIUS; dx <= ERODE_RADIUS && safe; dx++) {
          const ny = zy + dy, nx = x + dx;
          if (ny < 0 || ny >= zoneH || nx < 0 || nx >= W) safe = false;
          else if (mask[ny * W + nx] === 0) safe = false;
        }
      }
      if (safe) eroded[zy * W + x] = 1;
    }
  }

  // Flood-fill region filtering
  const rid = new Int32Array(W * zoneH);
  let nextR = 1;
  const rSizes = new Map();
  for (let i = 0; i < eroded.length; i++) {
    if (eroded[i] === 0 || rid[i] !== 0) continue;
    const id = nextR++;
    const q = [i]; rid[i] = id; let sz = 0;
    while (q.length > 0) {
      const ci = q.pop(); sz++;
      const cy = Math.floor(ci / W), cx = ci % W;
      for (const [dy, dx] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const ny = cy + dy, nx = cx + dx;
        if (ny < 0 || ny >= zoneH || nx < 0 || nx >= W) continue;
        const ni = ny * W + nx;
        if (eroded[ni] === 1 && rid[ni] === 0) { rid[ni] = id; q.push(ni); }
      }
    }
    rSizes.set(id, sz);
  }

  let removed = 0;
  for (let zy = 0; zy < zoneH; zy++) {
    const y = ZONE_TOP + zy;
    for (let x = 0; x < W; x++) {
      const mi = zy * W + x;
      if (eroded[mi] === 1 && rSizes.get(rid[mi]) >= MIN_REGION) {
        const idx = (y * W + x) * 4;
        fgImgData.data[idx] = 0;
        fgImgData.data[idx + 1] = 0;
        fgImgData.data[idx + 2] = 0;
        fgImgData.data[idx + 3] = 0;
        removed++;
      }
    }
  }
  fgCtx.putImageData(fgImgData, 0, 0);
  console.log(`  Foreground: removed ${removed} pixels (${(removed / (W * H) * 100).toFixed(2)}%)`);

  // ============================================================
  // STEP 4: Verify
  // ============================================================
  console.log('\nVerification:');
  console.log(`  Original:   ${W}x${H}`);
  console.log(`  Background: ${bgCanvas.width}x${bgCanvas.height}`);
  console.log(`  Foreground: ${fgCanvas.width}x${fgCanvas.height}`);

  const fgBot = fgCtx.getImageData(0, H - 10, W, 10);
  let botVis = 0;
  for (let i = 3; i < fgBot.data.length; i += 4) if (fgBot.data[i] > 0) botVis++;
  console.log(`  Foreground bottom 10 rows: ${botVis} visible pixels`);
  if (botVis === 0) { console.error('ERROR: Bottom empty!'); process.exit(1); }

  // ============================================================
  // STEP 5: Export
  // ============================================================
  console.log('\nExporting...');
  const bgPath = path.join(OUT_DIR, 'forest_background_far.png');
  const fgPath = path.join(OUT_DIR, 'forest_foreground_near.png');
  fs.writeFileSync(bgPath, bgCanvas.toBuffer('image/png'));
  fs.writeFileSync(fgPath, fgCanvas.toBuffer('image/png'));
  console.log(`  BG: ${(fs.statSync(bgPath).size / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  FG: ${(fs.statSync(fgPath).size / 1024 / 1024).toFixed(1)}MB`);

  // Tile
  const TW = 1024;
  const tiles = Math.ceil(W / TW);
  for (const [label, canvas] of [['bg_far', bgCanvas], ['fg_near', fgCanvas]]) {
    for (let t = 0; t < tiles; t++) {
      const sx = t * TW, sw = Math.min(TW, W - sx);
      const tc = createCanvas(sw, H);
      tc.getContext('2d').drawImage(canvas, sx, 0, sw, H, 0, 0, sw, H);
      fs.writeFileSync(path.join(OUT_DIR, `${label}-${t}.png`), tc.toBuffer('image/png'));
    }
    console.log(`  ${label}: ${tiles} tiles, ${H}px tall`);
  }

  console.log('\n=== DONE ===');
  console.log('Background: cloned from real haze-gap columns (no warping/interpolation)');
  console.log('Foreground: full image with conservative eroded haze removal');
  console.log(`Dimensions: ${W}x${H} — both layers match original`);
}

main().catch(err => { console.error(err); process.exit(1); });
