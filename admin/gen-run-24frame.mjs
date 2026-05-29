import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const buf = fs.readFileSync('Character Pose Sheets/Paladin/Paladin_Idle_12Frame_Perfect.png');
  const b64 = buf.toString('base64');

  const result = await p.evaluate(async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await new Promise(r => { img.onload = r; });

    const srcSheet = document.createElement('canvas');
    srcSheet.width = img.width; srcSheet.height = img.height;
    const ssctx = srcSheet.getContext('2d');
    ssctx.imageSmoothingEnabled = false;
    ssctx.drawImage(img, 0, 0);

    // Extract frame 0 as the base model
    const base = document.createElement('canvas');
    base.width = 64; base.height = 64;
    const bctx = base.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(srcSheet, 0, 0, 64, 64, 0, 0, 64, 64);

    // Simple clean run: move the ENTIRE sprite as one unit with
    // only vertical bob and forward lean — no limb tearing.
    // This looks like a bouncing run rather than articulated legs,
    // but it stays cohesive and doesn't glitch.
    const NUM = 12;
    const cycle = [
      { dy: 0,  dx: 1 },   // F0  contact
      { dy: 1,  dx: 0 },   // F1  absorption
      { dy: 2,  dx: 0 },   // F2  low point
      { dy: 1,  dx: 1 },   // F3  push off
      { dy: -1, dx: 1 },   // F4  rising
      { dy: -3, dx: 2 },   // F5  flight peak
      { dy: -3, dx: 2 },   // F6  flight hold
      { dy: -2, dx: 1 },   // F7  falling
      { dy: -1, dx: 1 },   // F8  descending
      { dy: 0,  dx: 1 },   // F9  pre-contact
      { dy: 0,  dx: 1 },   // F10 contact prep
      { dy: 0,  dx: 1 },   // F11 transition
    ];

    // Full 24 frames: repeat the 12-frame half twice
    const out = document.createElement('canvas');
    out.width = 64 * 24; out.height = 64;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;

    for (let f = 0; f < 24; f++) {
      const c = cycle[f % 12];
      // Draw the entire base sprite shifted as one unit — no splitting
      octx.drawImage(base, 0, 0, 64, 64, f * 64 + c.dx, c.dy, 64, 64);
    }

    return { w: out.width, h: out.height, b64: out.toDataURL('image/png').split(',')[1] };
  }, b64);

  fs.writeFileSync('Character Pose Sheets/Paladin/Paladin_Run_24Frame_Perfect.png', Buffer.from(result.b64, 'base64'));
  fs.writeFileSync('public/assets/paladin/run.png', Buffer.from(result.b64, 'base64'));
  console.log('Output:', result.w + 'x' + result.h, '— clean bob-only run (no tearing)');
  await b.close();
})();
