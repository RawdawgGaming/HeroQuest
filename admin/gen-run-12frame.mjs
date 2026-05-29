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
    srcSheet.getContext('2d').drawImage(img, 0, 0);
    const base = document.createElement('canvas');
    base.width = 64; base.height = 64;
    const bctx = base.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(srcSheet, 0, 0, 64, 64, 0, 0, 64, 64);

    // Clean bob-only 12-frame run — entire sprite moves as one cohesive unit
    const cycle = [
      { dy: 0,  dx: 1 },  // contact
      { dy: 1,  dx: 0 },  // down
      { dy: 2,  dx: 0 },  // compression
      { dy: 1,  dx: 1 },  // recovery
      { dy: 0,  dx: 1 },  // passing
      { dy: -2, dx: 2 },  // lift
      { dy: -3, dx: 2 },  // airborne
      { dy: -2, dx: 1 },  // reach
      { dy: -1, dx: 1 },  // extend
      { dy: 0,  dx: 1 },  // prepare
      { dy: 0,  dx: 1 },  // pre-impact
      { dy: 0,  dx: 1 },  // rear extension
    ];

    // 12 frames with 8px spacing, 16px L/R padding
    const FRAME = 64, SPACING = 8, PAD = 16, NUM = 12;
    const totalW = PAD + NUM * FRAME + (NUM - 1) * SPACING + PAD;
    const out = document.createElement('canvas');
    out.width = totalW; out.height = FRAME;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;

    for (let f = 0; f < NUM; f++) {
      const c = cycle[f];
      const fx = PAD + f * (FRAME + SPACING);
      octx.drawImage(base, 0, 0, 64, 64, fx + c.dx, c.dy, 64, 64);
    }

    return { w: out.width, h: out.height, b64: out.toDataURL('image/png').split(',')[1] };
  }, b64);

  fs.writeFileSync('Character Pose Sheets/Paladin/Paladin_Run_12Frame.png', Buffer.from(result.b64, 'base64'));
  console.log('Saved Paladin_Run_12Frame.png:', result.w + 'x' + result.h);
  await b.close();
})();
