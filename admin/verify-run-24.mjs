import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const buf = fs.readFileSync('public/assets/paladin/run.png');
  const b64 = buf.toString('base64');

  const result = await p.evaluate(async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await new Promise(r => { img.onload = r; });
    const c = document.createElement('canvas');
    c.width = 1536; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, 1536, 64);
    const px = id.data;

    // Per-frame stats
    const stats = [];
    for (let f = 0; f < 24; f++) {
      let minX = 64, maxX = 0, minY = 64, maxY = 0;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          if (px[(y * 1536 + f * 64 + x) * 4 + 3] > 30) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
      }
      stats.push({ f, feetY: maxY, topY: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }

    // Save key frames for visual inspection
    const keyFrames = [0, 3, 6, 9, 12, 15, 18, 21];
    const imgs = [];
    for (const f of keyFrames) {
      const out = document.createElement('canvas');
      out.width = 256; out.height = 256;
      const octx = out.getContext('2d');
      octx.imageSmoothingEnabled = false;
      octx.drawImage(c, f * 64, 0, 64, 64, 0, 0, 256, 256);
      imgs.push({ f, b64: out.toDataURL('image/png').split(',')[1] });
    }

    return { stats, imgs };
  }, b64);

  for (const img of result.imgs) {
    fs.writeFileSync(`run24-f${img.f}.png`, Buffer.from(img.b64, 'base64'));
  }
  console.log('Per-frame geometry (first 12):');
  for (let i = 0; i < 12; i++) {
    const s = result.stats[i];
    console.log(`  F${s.f.toString().padStart(2)}: feetY=${s.feetY} topY=${s.topY} size=${s.w}x${s.h}`);
  }
  const feetYs = result.stats.map(s => s.feetY);
  console.log('FeetY range:', Math.min(...feetYs), '-', Math.max(...feetYs));
  await b.close();
})();
