// Slice forest panorama into 3 parallax layers with gradient alpha edges.
//
// Each layer overlaps its neighbors and has soft transparency fades
// at top/bottom edges so they composite seamlessly — no visible seam.
//
// Layer 1 (bg):   y 0→430   — canopy, blue mist, distant trunks
//                             Bottom 80px fades to transparent
// Layer 2 (mid):  y 250→550 — stone arches, platforms, ruins, upper path
//                             Top 80px fades from transparent, bottom 80px fades to transparent
// Layer 3 (fg):   y 400→830 — ground path, water, near foliage, bushes
//                             Top 80px fades from transparent

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SRC = path.join(root, 'Environment/Forest Level/Final Forest Level Image.png');
const OUT = path.join(root, 'public/assets/Maps/forest-level');

const MAX_W = 1024;
const FADE = 80; // gradient fade zone in pixels

const LAYERS = [
  { name: 'bg',  yStart: 0,   yEnd: 430, fadeTop: 0,    fadeBot: FADE },
  { name: 'mid', yStart: 250, yEnd: 550, fadeTop: FADE,  fadeBot: FADE },
  { name: 'fg',  yStart: 400, yEnd: 830, fadeTop: FADE,  fadeBot: 0 },
];

function applyAlphaGradient(ctx, w, h, fadeTop, fadeBot) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    let alpha = 1.0;

    // Fade top edge: transparent → opaque
    if (fadeTop > 0 && y < fadeTop) {
      alpha = y / fadeTop;
    }
    // Fade bottom edge: opaque → transparent
    if (fadeBot > 0 && y > h - fadeBot) {
      alpha = (h - y) / fadeBot;
    }

    if (alpha < 1.0) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        data[idx + 3] = Math.round(data[idx + 3] * alpha);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

async function main() {
  const img = await loadImage(SRC);
  console.log(`Source: ${img.width}x${img.height}`);

  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const tilesPerLayer = Math.ceil(img.width / MAX_W);
  console.log(`Tiles per layer: ${tilesPerLayer}`);

  for (const layer of LAYERS) {
    const h = layer.yEnd - layer.yStart;
    console.log(`\n${layer.name}: y ${layer.yStart}→${layer.yEnd} (${h}px), fadeTop=${layer.fadeTop}, fadeBot=${layer.fadeBot}`);

    for (let t = 0; t < tilesPerLayer; t++) {
      const sx = t * MAX_W;
      const sw = Math.min(MAX_W, img.width - sx);

      const canvas = createCanvas(sw, h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, layer.yStart, sw, h, 0, 0, sw, h);

      // Apply gradient alpha fades
      if (layer.fadeTop > 0 || layer.fadeBot > 0) {
        applyAlphaGradient(ctx, sw, h, layer.fadeTop, layer.fadeBot);
      }

      const outPath = path.join(OUT, `${layer.name}-${t}.png`);
      fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
      const size = fs.statSync(outPath).size;
      console.log(`  ${layer.name}-${t}: ${sw}x${h} (${(size / 1024).toFixed(0)}KB)`);
    }
  }

  console.log(`\nTotal tiles: ${LAYERS.length * tilesPerLayer}`);
  console.log('Done! Now run PowerShell re-save for Phaser compatibility.');
}

main().catch(err => { console.error(err); process.exit(1); });
