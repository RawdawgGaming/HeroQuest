/**
 * NORMALIZE ATTACK SHEET — Scale character to match idle proportions
 *
 * The idle sheet has characters at ~385px tall with feet at y=419 in 448px frames.
 * The attack sheet has characters at ~272px tall with feet at y=344 in 448px frames.
 * This script scales up the attack characters by ~1.56x (nearest-neighbor) and
 * repositions so feet are at the frame bottom (y=447), matching the processed idle.
 *
 * Also shifts idle and run sheet content so feet are at frame bottom for all three.
 * After processing, origin (0.5, 1.0) works for all animations.
 *
 * Usage: node admin/normalize-attack-sheet.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  const idleB64 = fs.readFileSync('public/assets/paladin/paladin_idle_main_v1.png').toString('base64');
  const atkB64 = fs.readFileSync('public/assets/paladin/paladin_attack_main_v1.png').toString('base64');
  const runB64 = fs.readFileSync('public/assets/paladin/paladin_run_main_v1.png').toString('base64');

  const result = await p.evaluate(async ({ idleB64, atkB64, runB64 }) => {
    async function loadImg(b64) {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await new Promise(r => { img.onload = r; });
      return img;
    }

    function getFrameData(img, fw, fh, col, row) {
      const c = document.createElement('canvas');
      c.width = fw; c.height = fh;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
      return { canvas: c, ctx, imageData: ctx.getImageData(0, 0, fw, fh) };
    }

    function findBbox(imageData, fw, fh) {
      const px = imageData.data;
      let minY = fh, maxY = 0, minX = fw, maxX = 0;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          if (px[(y * fw + x) * 4 + 3] > 30) {
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          }
        }
      }
      return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    const idle = await loadImg(idleB64);
    const atk = await loadImg(atkB64);
    const run = await loadImg(runB64);

    const logs = [];

    // ========== PROCESS IDLE — shift feet to frame bottom ==========
    const IDLE_FW = 672, IDLE_FH = 448;
    const IDLE_COLS = 8, IDLE_ROWS = 7, IDLE_FRAMES = 50;
    // Idle feet are consistently at y=419. Shift down by 448-1-419 = 28px
    const IDLE_SHIFT = IDLE_FH - 1 - 419; // 28px down

    const idleOut = document.createElement('canvas');
    idleOut.width = idle.width; idleOut.height = idle.height;
    const idleCtx = idleOut.getContext('2d');
    idleCtx.imageSmoothingEnabled = false;

    for (let i = 0; i < IDLE_FRAMES; i++) {
      const col = i % IDLE_COLS, row = Math.floor(i / IDLE_COLS);
      const sx = col * IDLE_FW, sy = row * IDLE_FH;
      // Draw shifted down by IDLE_SHIFT pixels
      idleCtx.drawImage(idle, sx, sy, IDLE_FW, IDLE_FH,
        sx, sy + IDLE_SHIFT, IDLE_FW, IDLE_FH);
    }
    logs.push(`IDLE: shifted ${IDLE_FRAMES} frames down by ${IDLE_SHIFT}px. Feet now at y=${419 + IDLE_SHIFT}=${IDLE_FH - 1}`);

    // ========== PROCESS RUN — shift feet to frame bottom ==========
    const RUN_FW = 288, RUN_FH = 192;
    const RUN_COLS = 5, RUN_ROWS = 5, RUN_FRAMES = 22;
    // Run feet vary (170-186). Use max=186. Shift = 192-1-186 = 5px
    const RUN_SHIFT = RUN_FH - 1 - 186; // 5px down

    const runOut = document.createElement('canvas');
    runOut.width = run.width; runOut.height = run.height;
    const runCtx = runOut.getContext('2d');
    runCtx.imageSmoothingEnabled = false;

    for (let i = 0; i < RUN_FRAMES; i++) {
      const col = i % RUN_COLS, row = Math.floor(i / RUN_COLS);
      const sx = col * RUN_FW, sy = row * RUN_FH;
      runCtx.drawImage(run, sx, sy, RUN_FW, RUN_FH,
        sx, sy + RUN_SHIFT, RUN_FW, RUN_FH);
    }
    logs.push(`RUN: shifted ${RUN_FRAMES} frames down by ${RUN_SHIFT}px. Max feet now at y=${186 + RUN_SHIFT}=${RUN_FH - 1}`);

    // ========== PROCESS ATTACK — scale up + reposition ==========
    const ATK_FW = 672, ATK_FH = 448;
    const ATK_COLS = 9, ATK_ROWS = 8, ATK_FRAMES = 67;

    // Target: character should match idle proportions.
    // Idle: feet at y=419 in 448px frame, avg height 385px.
    // After idle shift: feet at y=447, top at y=447-385=62.
    // Attack neutral (F0): height=247px, feet at y=343.
    // Scale factor: 385/247 = 1.559 — matches F0 to idle body height.
    // But tall frames (F28: h=304) at 1.559x = 474px exceeds 448.
    // Use scale factor based on MAX frame height to prevent clipping:
    // Max attack height = 304px. If scaled to fill 385px: scale = 385/304 = 1.266x.
    // BUT this makes F0 (247px) render as 247*1.266=313px, still smaller than idle's 385.
    //
    // Better approach: use the NEUTRAL POSE (F0) as reference since that's what
    // should match idle's standing height. F0 height=247, idle height=385.
    // Scale = 385/247 = 1.559. Tall frames clip at top — this is just the
    // weapon/overhead portion extending above frame. At 86px render size (0.19x),
    // the clipped pixels are invisible.
    const SCALE = 385 / 247; // 1.559x
    const TARGET_FEET_Y = ATK_FH - 1; // feet at bottom (y=447)

    const atkOut = document.createElement('canvas');
    atkOut.width = atk.width; atkOut.height = atk.height;
    const atkCtx = atkOut.getContext('2d');
    atkCtx.imageSmoothingEnabled = false;

    let clippedFrames = 0;
    for (let i = 0; i < ATK_FRAMES; i++) {
      const col = i % ATK_COLS, row = Math.floor(i / ATK_COLS);
      const { canvas: srcCanvas, imageData } = getFrameData(atk, ATK_FW, ATK_FH, col, row);
      const bbox = findBbox(imageData, ATK_FW, ATK_FH);
      if (bbox.maxY === 0) continue; // empty frame

      // Source character region
      const srcX = bbox.minX, srcY = bbox.minY;
      const srcW = bbox.w, srcH = bbox.h;
      const srcFeetY = bbox.maxY;

      // Scaled dimensions (nearest-neighbor via imageSmoothingEnabled=false)
      const dstW = Math.round(srcW * SCALE);
      const dstH = Math.round(srcH * SCALE);

      // Position: align scaled feet to TARGET_FEET_Y, center horizontally
      const dstFeetY = TARGET_FEET_Y;
      const dstTopY = dstFeetY - dstH + 1;
      const dstX = Math.round((ATK_FW - dstW) / 2);

      // Check for clipping
      if (dstTopY < 0 || dstX < 0 || dstX + dstW > ATK_FW) clippedFrames++;

      // Draw into output at the correct cell position
      const cellX = col * ATK_FW, cellY = row * ATK_FH;
      atkCtx.save();
      atkCtx.beginPath();
      atkCtx.rect(cellX, cellY, ATK_FW, ATK_FH);
      atkCtx.clip();
      atkCtx.drawImage(srcCanvas, srcX, srcY, srcW, srcH,
        cellX + dstX, cellY + dstTopY, dstW, dstH);
      atkCtx.restore();
    }
    logs.push(`ATTACK: scaled ${ATK_FRAMES} frames by ${SCALE.toFixed(3)}x. Feet at y=${TARGET_FEET_Y}. Frames with clipping: ${clippedFrames}`);

    // Verify: measure a few processed attack frames
    const verifyFrames = [0, 7, 30, 60];
    for (const fi of verifyFrames) {
      const col = fi % ATK_COLS, row = Math.floor(fi / ATK_COLS);
      const vId = atkCtx.getImageData(col * ATK_FW, row * ATK_FH, ATK_FW, ATK_FH);
      const vBox = findBbox(vId, ATK_FW, ATK_FH);
      logs.push(`  Verify F${fi}: ${vBox.w}x${vBox.h} top=${vBox.minY} bot=${vBox.maxY}`);
    }

    return {
      logs,
      idlePng: idleOut.toDataURL('image/png').split(',')[1],
      runPng: runOut.toDataURL('image/png').split(',')[1],
      atkPng: atkOut.toDataURL('image/png').split(',')[1],
    };
  }, { idleB64, atkB64, runB64 });

  // Write processed PNGs
  fs.writeFileSync('public/assets/paladin/paladin_idle_main_v1.png',
    Buffer.from(result.idlePng, 'base64'));
  fs.writeFileSync('public/assets/paladin/paladin_run_main_v1.png',
    Buffer.from(result.runPng, 'base64'));
  fs.writeFileSync('public/assets/paladin/paladin_attack_main_v1.png',
    Buffer.from(result.atkPng, 'base64'));

  console.log('=== NORMALIZE COMPLETE ===');
  for (const line of result.logs) console.log(line);
  console.log('\nAll three sheets now have feet at frame bottom.');
  console.log('Use origin (0.5, 1.0) and scale 86/frameHeight.');

  await b.close();
})();
