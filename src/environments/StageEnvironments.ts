// ============================================================================
// PER-STAGE ENVIRONMENT BUILDERS
// ============================================================================
// Each stage gets its own handcrafted environment function.
// No two stages share the same layout, prop pattern, or silhouette composition.
//
// Constants:
//   STAGE_WIDTH = 8000     — world width
//   GROUND_MIN_Y = 420     — top of walking area (walkingAreaY)
//   GROUND_MAX_Y = 520     — bottom of walking area
//   Background: everything above GROUND_MIN_Y (visual only, parallax)
//   Foreground: below GROUND_MAX_Y (underground framing)
// ============================================================================

import Phaser from 'phaser';
import { GROUND_MIN_Y, GROUND_MAX_Y } from '../entities/Hero';
import { renderMapLayout, type ForestMapLayout } from './MapLoader';

const SW = 8000;
const WAY = GROUND_MIN_Y;   // walkingAreaY = 420
const GMY = GROUND_MAX_Y;   // 520

// ── Shared drawing helpers ──────────────────────────────────────────────

/** Fill sky with a vertical gradient in WORLD coordinates (not screen-fixed).
 *  Using scrollFactor(0,0) with opaque fills hides all world-coordinate elements. */
function drawSky(scene: Phaser.Scene, topColor: number, botColor: number, depth = -200) {
  const g = scene.add.graphics().setDepth(depth);
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r1 = (topColor >> 16) & 0xff, g1 = (topColor >> 8) & 0xff, b1 = topColor & 0xff;
    const r2 = (botColor >> 16) & 0xff, g2 = (botColor >> 8) & 0xff, b2 = botColor & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const gv = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    const col = (r << 16) | (gv << 8) | b;
    g.fillStyle(col, 1);
    // Fill across the entire stage width so sky is always visible
    g.fillRect(-200, (WAY / bands) * i, SW + 400, WAY / bands + 2);
  }
}

/** Draw an irregular polygon leaf mass (no circles). */
function drawLeafBlob(g: Phaser.GameObjects.Graphics, cx: number, cy: number,
  w: number, h: number, color: number, alpha = 1) {
  const pts = 8 + Phaser.Math.Between(0, 4);
  g.fillStyle(color, alpha);
  g.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rx = w * 0.5 * (0.65 + Math.random() * 0.35);
    const ry = h * 0.5 * (0.65 + Math.random() * 0.35);
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

/** Draw a wobbly trunk polygon. */
function drawTrunk(g: Phaser.GameObjects.Graphics, x: number, w: number,
  top: number, bot: number, fill: number, outline: number) {
  const steps = 10;
  const j = w * 0.05;
  const pts: { x: number; y: number }[] = [];
  for (let s = 0; s <= steps; s++) {
    const sy = top + (bot - top) * (s / steps);
    const flare = s === steps ? w * 0.12 : 0;
    pts.push({ x: x - w / 2 - flare + Phaser.Math.FloatBetween(-j, j), y: sy });
  }
  for (let s = steps; s >= 0; s--) {
    const sy = top + (bot - top) * (s / steps);
    const flare = s === steps ? w * 0.12 : 0;
    pts.push({ x: x + w / 2 + flare + Phaser.Math.FloatBetween(-j, j), y: sy });
  }
  g.fillStyle(fill, 1);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let p = 1; p < pts.length; p++) g.lineTo(pts[p].x, pts[p].y);
  g.closePath();
  g.fillPath();
  g.lineStyle(2, outline, 0.6);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let p = 1; p < pts.length; p++) g.lineTo(pts[p].x, pts[p].y);
  g.closePath();
  g.strokePath();
}

/** Draw ground fill from WAY to GMY with a color. */
function drawGround(scene: Phaser.Scene, color: number, depth = WAY - 10) {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(color, 1);
  g.fillRect(0, WAY, SW, GMY - WAY);
}

/** Draw underground below GMY. */
function drawUnderground(scene: Phaser.Scene, color: number, accent: number) {
  const g = scene.add.graphics().setDepth(750);
  g.fillStyle(color, 1);
  g.fillRect(0, GMY, SW, 200);
  // Accent line at top
  g.fillStyle(accent, 0.8);
  g.fillRect(0, GMY, SW, 6);
}

/** Draw a bumpy grass contour at the top of the walking area. */
function drawGrassContour(scene: Phaser.Scene, colors: number[], depth = WAY - 6) {
  const g = scene.add.graphics().setDepth(depth);
  const step = 30;
  const offsets: number[] = [];
  for (let px = 0; px <= SW; px += step) {
    offsets.push(Phaser.Math.FloatBetween(-5, 3));
  }
  // Smooth
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < offsets.length - 1; i++) {
      offsets[i] = (offsets[i - 1] + offsets[i] * 2 + offsets[i + 1]) / 4;
    }
  }
  for (let c = 0; c < colors.length; c++) {
    g.fillStyle(colors[c], 1);
    g.beginPath();
    g.moveTo(0, WAY + 4 + c * 2);
    for (let i = 0; i < offsets.length; i++) {
      g.lineTo(i * step, WAY + offsets[i] + c * 1.5 + Phaser.Math.FloatBetween(-1, 1));
    }
    g.lineTo(SW, WAY + 4 + c * 2);
    g.closePath();
    g.fillPath();
  }
}

/** Draw silhouette mountain range. */
function drawMountainSilhouette(g: Phaser.GameObjects.Graphics, color: number,
  baseY: number, minH: number, maxH: number, peakW: number, xEnd: number) {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(-100, baseY);
  let tx = -100;
  while (tx < xEnd) {
    const h = Phaser.Math.Between(minH, maxH);
    const w = Phaser.Math.Between(peakW * 0.7, peakW * 1.3);
    g.lineTo(tx, baseY - h);
    g.lineTo(tx + w * 0.5, baseY - h + Phaser.Math.Between(5, 20));
    tx += w;
  }
  g.lineTo(xEnd + 100, baseY);
  g.closePath();
  g.fillPath();
}

// ============================================================================
// STAGE 2: MOSSY HOLLOW
// ============================================================================
// Dense undergrowth, moss-covered boulders, shallow creek crossing mid-stage,
// fallen logs as obstacles. Darker, damper feel than Stage 1.
// Key differences from Stage 1:
//   - Much denser undergrowth and fewer sky gaps
//   - Moss-green boulders scattered in the walking area background
//   - A visible creek crossing at ~3000-3500px with blue-green water
//   - Fallen log obstacles at ~1800, ~4500, ~6200
//   - Dimmer lighting with green fog overlay
// ============================================================================
export function buildStage2(scene: Phaser.Scene): void {
  // --- Full flat forest map (11410×830) at native 1:1 resolution ---
  // Tiled into 12 × 1024px-wide chunks (full 830px height each).
  // No scaling. No cropping. World bounds match image dimensions.

  const TILES = 12;
  const TILE_W = 1024;
  const IMG_W = 11410;
  const IMG_H = 830;

  // Load tiles via Phaser's post-create loader
  let needsLoad = false;
  for (let t = 0; t < TILES; t++) {
    const key = `forest-full-${t}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `assets/Maps/forest-level/full-${t}.png`);
      needsLoad = true;
    }
  }

  if (needsLoad) {
    scene.load.once('complete', () => placeMap());
    scene.load.start();
  } else {
    placeMap();
  }

  function placeMap() {
    // Place tiles at native 1:1 — no setScale, no setDisplaySize
    for (let t = 0; t < TILES; t++) {
      const key = `forest-full-${t}`;
      if (!scene.textures.exists(key)) continue;
      const tile = scene.add.image(t * TILE_W, 0, key)
        .setOrigin(0, 0)
        .setDepth(-100)
        .setScrollFactor(1, 1);
      tile.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    // Set world and camera bounds to the ACTUAL image dimensions
    scene.physics.world.setBounds(0, 0, IMG_W, IMG_H);
    scene.cameras.main.setBounds(0, 0, IMG_W, IMG_H);

    // Debug: outline the full image bounds
    const debug = scene.add.graphics().setDepth(9999);
    debug.lineStyle(2, 0xff0000, 1);
    debug.strokeRect(0, 0, IMG_W, IMG_H);

    // Debug text with all dimensions
    const cam = scene.cameras.main;
    const firstTile = scene.textures.exists('forest-full-0')
      ? scene.textures.get('forest-full-0').getSourceImage() : null;
    const debugLines = [
      `Image: ${IMG_W}x${IMG_H}`,
      `Tile 0: ${firstTile ? firstTile.width + 'x' + firstTile.height : 'N/A'}`,
      `Camera viewport: ${cam.width}x${cam.height}`,
      `Camera bounds: ${cam.getBounds().width}x${cam.getBounds().height}`,
      `World bounds: ${scene.physics.world.bounds.width}x${scene.physics.world.bounds.height}`,
      `Camera zoom: ${cam.zoom}`,
    ];
    const debugText = scene.add.text(10, 10, debugLines.join('\n'), {
      fontSize: '14px', color: '#ff0', backgroundColor: '#000a',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(10000);

    // Remove debug after 10 seconds
    scene.time.delayedCall(10000, () => { debug.destroy(); debugText.destroy(); });
  }
}

// ============================================================================
// STAGE 3: BRAMBLEWOOD PATH
// ============================================================================
// A narrow path through thorny brambles. Brighter than Stage 2 with
// warm afternoon light filtering through. Wooden barricades, thorn walls,
// wildflower patches. More open sky visible than Stages 1-2.
// Key differences:
//   - Warmer color palette (amber/gold tones in sky)
//   - Thorny bramble walls creating corridor feel
//   - Wildflower meadow sections at ~1000-1500 and ~5000-5500
//   - Wooden fence/barricade props
//   - Dirt path texture (not pure grass)
//   - More visible sky between canopy gaps
// ============================================================================
export function buildStage3(scene: Phaser.Scene): void {
  // --- Cursed Forest painted map (11924×828) ---
  const TILES = 12;
  const TILE_W = 1024;

  let needsLoad = false;
  for (let t = 0; t < TILES; t++) {
    const key = `stage3-full-${t}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `assets/Maps/stage3-cursed/full-${t}.png`);
      needsLoad = true;
    }
  }

  const place = () => {
    for (let t = 0; t < TILES; t++) {
      const key = `stage3-full-${t}`;
      if (!scene.textures.exists(key)) continue;
      scene.add.image(t * TILE_W, 0, key)
        .setOrigin(0, 0)
        .setDepth(-100)
        .setScrollFactor(1, 1)
        .texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    scene.cameras.main.setBounds(0, 0, 11924, 828);
  };

  if (needsLoad) {
    scene.load.once('complete', place);
    scene.load.start();
    return;
  }
  place();
  return;

  // Legacy procedural fallback (unreachable when tiles exist) ---
  // --- Sky: warm amber afternoon ---
  drawSky(scene, 0x2a3040, 0x4a5a48);

  // --- Background: thinner tree coverage with sky gaps ---
  const sil1 = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil1, 0x1a2818, WAY, 60, 150, 45, 2200);
  const sil2 = scene.add.graphics().setScrollFactor(0.18, 0).setDepth(-197);
  // Individual tree silhouettes instead of solid mass
  for (let i = 0; i < 15; i++) {
    const tx = Phaser.Math.Between(0, 2000);
    const th = Phaser.Math.Between(100, 200);
    drawTrunk(sil2, tx, Phaser.Math.Between(8, 14), WAY - th, WAY, 0x1e3020, 0x0e1a10);
    drawLeafBlob(sil2, tx, WAY - th - 15, 30, 22, 0x1e3020);
  }

  // --- Mid trunks: slender, widely spaced ---
  for (let i = 0; i < 10; i++) {
    const x = i * 230 + Phaser.Math.Between(-40, 40);
    const t = scene.add.graphics().setScrollFactor(0.5, 0).setDepth(-160);
    drawTrunk(t, x, Phaser.Math.Between(20, 35), 40, WAY, 0x3a2a14, 0x1a1408);
    // Small canopy on some
    if (Math.random() < 0.6) {
      drawLeafBlob(t, x, 30, 40, 28, 0x2a5a1a);
      drawLeafBlob(t, x + Phaser.Math.Between(-10, 10), 25, 30, 22, 0x3a7a2a);
    }
  }

  // --- Near trunks: scattered, not wall-to-wall ---
  for (let i = 0; i < 6; i++) {
    const x = Phaser.Math.Between(100, SW - 100);
    const t = scene.add.graphics().setDepth(WAY - 8);
    drawTrunk(t, x, Phaser.Math.Between(40, 60), -20, WAY, 0x4a3420, 0x1a1008);
  }

  // --- Ground: dirt path with grass edges ---
  const groundG = scene.add.graphics().setDepth(WAY - 10);
  // Grass base
  groundG.fillStyle(0x3a6a2a, 1);
  groundG.fillRect(0, WAY, SW, GMY - WAY);
  // Dirt path down the center
  groundG.fillStyle(0x6a5a3a, 0.8);
  groundG.beginPath();
  groundG.moveTo(0, WAY + 15);
  for (let px = 0; px <= SW; px += 40) {
    groundG.lineTo(px, WAY + 12 + Math.sin(px * 0.003) * 8);
  }
  groundG.lineTo(SW, WAY + (GMY - WAY) - 15);
  for (let px = SW; px >= 0; px -= 40) {
    groundG.lineTo(px, WAY + (GMY - WAY) - 12 + Math.sin(px * 0.004) * 6);
  }
  groundG.closePath();
  groundG.fillPath();
  // Path ruts/tracks
  for (let i = 0; i < 30; i++) {
    const rx = Phaser.Math.Between(0, SW);
    groundG.fillStyle(0x5a4a2a, 0.3);
    groundG.fillEllipse(rx, WAY + 30 + Math.sin(rx * 0.003) * 5,
      Phaser.Math.Between(10, 30), Phaser.Math.Between(3, 6));
  }
  drawGrassContour(scene, [0x3a7a2a, 0x4a9a3a, 0x5aaa4a]);

  // --- BRAMBLE/THORN WALLS (corridor feel) ---
  const brambles = scene.add.graphics().setDepth(WAY - 4);
  // Thorny masses along top and bottom of walking area
  for (let i = 0; i < 20; i++) {
    const bx = i * 400 + Phaser.Math.Between(-50, 50);
    // Skip flower meadow zones
    if ((bx > 900 && bx < 1600) || (bx > 4900 && bx < 5600)) continue;
    const side = i % 2 === 0 ? -1 : 1; // alternate sides
    const by = side < 0 ? WAY - Phaser.Math.Between(5, 15) : WAY + Phaser.Math.Between(60, 80);
    const bw = Phaser.Math.Between(40, 80);
    const bh = Phaser.Math.Between(15, 30);
    // Thorny mass
    brambles.fillStyle(0x2a4a18, 0.85);
    drawLeafBlob(brambles, bx, by, bw, bh, 0x2a4a18, 0.85);
    // Thorn spikes
    for (let s = 0; s < Phaser.Math.Between(3, 6); s++) {
      const sx = bx + Phaser.Math.FloatBetween(-bw * 0.4, bw * 0.4);
      const sy = by + Phaser.Math.FloatBetween(-bh * 0.3, bh * 0.3);
      const sLen = Phaser.Math.Between(4, 10);
      brambles.lineStyle(1.5, 0x6a4a20, 0.7);
      brambles.lineBetween(sx, sy, sx + Phaser.Math.FloatBetween(-sLen, sLen),
        sy - Phaser.Math.Between(2, sLen));
    }
  }

  // --- WILDFLOWER MEADOW SECTIONS ---
  const flowers = scene.add.graphics().setDepth(WAY + 2);
  for (const zone of [{ start: 1000, end: 1500 }, { start: 5000, end: 5500 }]) {
    for (let i = 0; i < 25; i++) {
      const fx = Phaser.Math.Between(zone.start, zone.end);
      const fh = Phaser.Math.Between(5, 12);
      // Stem
      flowers.lineStyle(0.8, 0x3a7a2a, 0.7);
      flowers.lineBetween(fx, WAY, fx, WAY - fh);
      // Petal
      const petalColor = [0xffaaaa, 0xaaaaff, 0xffffaa, 0xffaaff, 0xaaffff, 0xffdd88][Phaser.Math.Between(0, 5)];
      flowers.fillStyle(petalColor, 0.85);
      flowers.fillCircle(fx, WAY - fh, Phaser.Math.Between(2, 4));
      // Center
      flowers.fillStyle(0xffff88, 0.7);
      flowers.fillCircle(fx, WAY - fh, 1);
    }
    // Butterflies (tiny colored dots with slow drift — visual only)
    for (let b = 0; b < 3; b++) {
      const bx = Phaser.Math.Between(zone.start, zone.end);
      const by = WAY - Phaser.Math.Between(15, 40);
      const butterfly = scene.add.circle(bx, by, 2,
        [0xffaa44, 0xaa44ff, 0x44aaff][b % 3], 0.6)
        .setDepth(WAY + 3);
      scene.tweens.add({
        targets: butterfly, x: bx + Phaser.Math.Between(-30, 30),
        y: by + Phaser.Math.Between(-10, 10), duration: 3000 + b * 1000,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  // --- WOODEN BARRICADES/FENCES ---
  const fences = scene.add.graphics().setDepth(WAY - 2);
  for (const fx of [600, 2400, 3800, 6800]) {
    const fenceW = Phaser.Math.Between(60, 100);
    const fenceH = Phaser.Math.Between(18, 28);
    // Posts
    for (let p = 0; p < 3; p++) {
      const px = fx - fenceW / 2 + p * (fenceW / 2);
      fences.fillStyle(0x5a4020, 0.9);
      fences.fillRect(px - 2, WAY - fenceH, 4, fenceH);
      // Post cap
      fences.fillStyle(0x4a3018, 0.9);
      fences.fillTriangle(px - 3, WAY - fenceH, px, WAY - fenceH - 4, px + 3, WAY - fenceH);
    }
    // Rails
    fences.fillStyle(0x6a5030, 0.85);
    fences.fillRect(fx - fenceW / 2, WAY - fenceH * 0.7, fenceW, 3);
    fences.fillRect(fx - fenceW / 2, WAY - fenceH * 0.35, fenceW, 3);
  }

  // --- Underground: warm brown ---
  drawUnderground(scene, 0x2a1a0e, 0x3a2a18);

  // --- Warm light overlay ---
  const light = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  light.fillStyle(0x2a2010, 0.04);
  light.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGE 4: SPORECAP GLADE
// ============================================================================
// A mystical mushroom-filled clearing. Bioluminescent glow, giant mushrooms
// as props, spore clouds drifting through the air. Eerie but beautiful.
// Key differences from Stages 1-3:
//   - Bioluminescent blue-green ambient light
//   - Giant mushroom stalks as "tree" replacements in background
//   - Glowing spore particles floating in mid-air
//   - Rotting stumps and fallen logs covered in fungi
//   - Mycelium network visible on ground surface
//   - Purple/blue fog overlay instead of green
// ============================================================================
export function buildStage4(scene: Phaser.Scene): void {
  // --- Cursed Marsh Entrance painted map (11952×830) ---
  const TILES = 12;
  const TILE_W = 1024;
  let needsLoad = false;
  for (let t = 0; t < TILES; t++) {
    const key = `stage4-full-${t}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `assets/Maps/stage4-marsh/full-${t}.png`);
      needsLoad = true;
    }
  }
  const place = () => {
    for (let t = 0; t < TILES; t++) {
      const key = `stage4-full-${t}`;
      if (!scene.textures.exists(key)) continue;
      scene.add.image(t * TILE_W, 0, key)
        .setOrigin(0, 0).setDepth(-100).setScrollFactor(1, 1)
        .texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    scene.cameras.main.setBounds(0, 0, 11952, 830);
  };
  if (needsLoad) { scene.load.once('complete', place); scene.load.start(); return; }
  place(); return;

  // Legacy procedural fallback (unreachable when tiles exist)
  drawSky(scene, 0x0a0e1a, 0x1a2030);

  // --- Background: distant mushroom forest silhouettes ---
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  // Low tree mass
  drawMountainSilhouette(sil, 0x0e1418, WAY, 40, 90, 40, 2200);
  // Giant mushroom silhouettes poking up
  for (let i = 0; i < 12; i++) {
    const mx = Phaser.Math.Between(0, 2000);
    const mh = Phaser.Math.Between(80, 160);
    const capW = Phaser.Math.Between(30, 60);
    const capH = Phaser.Math.Between(15, 30);
    // Stalk
    sil.fillStyle(0x121820, 1);
    sil.fillRect(mx - 4, WAY - mh, 8, mh);
    // Cap
    sil.fillStyle(0x141a22, 1);
    sil.fillEllipse(mx, WAY - mh, capW, capH);
  }

  // --- Mid-layer: more defined mushroom trees ---
  const mid = scene.add.graphics().setScrollFactor(0.3, 0).setDepth(-180);
  for (let i = 0; i < 10; i++) {
    const mx = i * 240 + Phaser.Math.Between(-30, 30);
    const mh = Phaser.Math.Between(120, 220);
    const sw = Phaser.Math.Between(10, 18);
    const capW = Phaser.Math.Between(40, 70);
    const capH = Phaser.Math.Between(20, 35);
    // Stalk
    mid.fillStyle(0x2a2830, 1);
    mid.beginPath();
    mid.moveTo(mx - sw / 2, WAY);
    mid.lineTo(mx - sw * 0.35, WAY - mh);
    mid.lineTo(mx + sw * 0.35, WAY - mh);
    mid.lineTo(mx + sw / 2, WAY);
    mid.closePath();
    mid.fillPath();
    // Cap (dome shape)
    mid.fillStyle(0x3a2840, 0.9);
    mid.beginPath();
    for (let p = 0; p <= 10; p++) {
      const a = Math.PI + (p / 10) * Math.PI;
      mid.lineTo(mx + Math.cos(a) * capW * 0.5, WAY - mh + Math.sin(a) * capH);
    }
    mid.closePath();
    mid.fillPath();
    // Cap spots
    for (let s = 0; s < 3; s++) {
      mid.fillStyle(0x4a3a55, 0.5);
      mid.fillCircle(mx + Phaser.Math.Between(-capW * 0.3, capW * 0.3),
        WAY - mh - Phaser.Math.Between(2, capH * 0.6), Phaser.Math.Between(2, 5));
    }
    // Bioluminescent glow under cap
    mid.fillStyle(0x44aacc, 0.08);
    mid.fillEllipse(mx, WAY - mh + capH * 0.3, capW * 0.8, capH * 0.5);
  }

  // --- Near giant mushrooms (foreground-ish, scattered) ---
  const nearShrooms = scene.add.graphics().setDepth(WAY - 7);
  for (const mx of [500, 1800, 3200, 4800, 6000, 7200]) {
    const mh = Phaser.Math.Between(60, 100);
    const sw = Phaser.Math.Between(15, 25);
    const capW = Phaser.Math.Between(50, 90);
    const capH = Phaser.Math.Between(25, 40);
    // Stalk with texture
    nearShrooms.fillStyle(0x3a3440, 0.9);
    nearShrooms.beginPath();
    nearShrooms.moveTo(mx - sw / 2, WAY);
    nearShrooms.lineTo(mx - sw * 0.4 + Phaser.Math.FloatBetween(-2, 2), WAY - mh);
    nearShrooms.lineTo(mx + sw * 0.4 + Phaser.Math.FloatBetween(-2, 2), WAY - mh);
    nearShrooms.lineTo(mx + sw / 2, WAY);
    nearShrooms.closePath();
    nearShrooms.fillPath();
    // Stalk rings
    for (let r = 0; r < 3; r++) {
      const ry = WAY - mh * (0.2 + r * 0.25);
      nearShrooms.lineStyle(1, 0x2a2430, 0.4);
      nearShrooms.lineBetween(mx - sw * 0.45, ry, mx + sw * 0.45, ry);
    }
    // Cap
    nearShrooms.fillStyle(0x5a3060, 0.9);
    nearShrooms.beginPath();
    for (let p = 0; p <= 12; p++) {
      const a = Math.PI + (p / 12) * Math.PI;
      const noiseR = Phaser.Math.FloatBetween(-3, 3);
      nearShrooms.lineTo(mx + Math.cos(a) * (capW * 0.5 + noiseR),
        WAY - mh + Math.sin(a) * (capH + noiseR));
    }
    nearShrooms.closePath();
    nearShrooms.fillPath();
    // Cap spots (lighter)
    for (let s = 0; s < Phaser.Math.Between(3, 6); s++) {
      nearShrooms.fillStyle(0x7a5080, 0.4);
      nearShrooms.fillCircle(mx + Phaser.Math.Between(-capW * 0.35, capW * 0.35),
        WAY - mh - Phaser.Math.Between(3, capH * 0.7), Phaser.Math.Between(3, 7));
    }
    // Glow underneath
    nearShrooms.fillStyle(0x44ccaa, 0.06);
    nearShrooms.fillEllipse(mx, WAY - mh + capH * 0.4, capW * 0.9, capH * 0.6);
    // Cap outline
    nearShrooms.lineStyle(1.5, 0x2a1830, 0.5);
    nearShrooms.beginPath();
    for (let p = 0; p <= 12; p++) {
      const a = Math.PI + (p / 12) * Math.PI;
      nearShrooms.lineTo(mx + Math.cos(a) * capW * 0.5, WAY - mh + Math.sin(a) * capH);
    }
    nearShrooms.strokePath();
  }

  // --- Ground: dark earth with mycelium veins ---
  drawGround(scene, 0x1e2a1a);
  const mycelium = scene.add.graphics().setDepth(WAY - 9);
  // Mycelium network — branching white-ish lines
  for (let i = 0; i < 15; i++) {
    let mx = Phaser.Math.Between(0, SW);
    let my = WAY + Phaser.Math.Between(10, GMY - WAY - 10);
    mycelium.lineStyle(Phaser.Math.FloatBetween(0.5, 1.5), 0xccccaa, 0.12);
    mycelium.beginPath();
    mycelium.moveTo(mx, my);
    for (let s = 0; s < Phaser.Math.Between(5, 12); s++) {
      mx += Phaser.Math.Between(-30, 30);
      my += Phaser.Math.Between(-5, 8);
      mycelium.lineTo(mx, my);
      // Branch
      if (Math.random() < 0.3) {
        const bx = mx + Phaser.Math.Between(-15, 15);
        const by = my + Phaser.Math.Between(-8, 8);
        mycelium.lineTo(bx, by);
        mycelium.moveTo(mx, my);
      }
    }
    mycelium.strokePath();
  }
  drawGrassContour(scene, [0x1a3a18, 0x2a4a20, 0x2a5a20]);

  // --- ROTTING STUMPS with fungi ---
  const stumps = scene.add.graphics().setDepth(WAY - 3);
  for (const sx of [900, 2400, 3800, 5500, 7000]) {
    const sW = Phaser.Math.Between(25, 40);
    const sH = Phaser.Math.Between(12, 22);
    // Stump
    stumps.fillStyle(0x3a2a1a, 0.9);
    stumps.fillEllipse(sx, WAY - sH / 2, sW, sH);
    stumps.fillRect(sx - sW * 0.45, WAY - sH, sW * 0.9, sH);
    // Ring pattern on top
    stumps.lineStyle(0.8, 0x2a1a0e, 0.3);
    stumps.strokeEllipse(sx, WAY - sH, sW * 0.6, sH * 0.4);
    stumps.strokeEllipse(sx, WAY - sH, sW * 0.3, sH * 0.2);
    // Small mushrooms growing on stump
    for (let m = 0; m < Phaser.Math.Between(2, 5); m++) {
      const mmx = sx + Phaser.Math.Between(-sW * 0.4, sW * 0.4);
      const mmy = WAY - sH - Phaser.Math.Between(2, 8);
      stumps.fillStyle(0xddcc88, 0.8);
      stumps.fillRect(mmx - 0.5, mmy, 1, 4);
      stumps.fillStyle([0xeeaa44, 0xcc8833, 0xddbb55][Phaser.Math.Between(0, 2)], 0.85);
      stumps.fillEllipse(mmx, mmy, 4, 2.5);
    }
  }

  // --- GLOWING SPORE PARTICLES (animated) ---
  for (let i = 0; i < 20; i++) {
    const sx = Phaser.Math.Between(0, 1280);
    const sy = Phaser.Math.Between(80, WAY - 30);
    const spore = scene.add.circle(sx, sy, Phaser.Math.FloatBetween(1, 3),
      [0x44ccaa, 0x66ddbb, 0x88eedd][Phaser.Math.Between(0, 2)],
      Phaser.Math.FloatBetween(0.15, 0.4))
      .setScrollFactor(0.5 + Math.random() * 0.3, 0).setDepth(WAY - 1);
    scene.tweens.add({
      targets: spore,
      x: sx + Phaser.Math.Between(-40, 40),
      y: sy + Phaser.Math.Between(-20, 20),
      alpha: { from: spore.alpha, to: spore.alpha * 0.3 },
      duration: Phaser.Math.Between(4000, 8000),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // --- Underground: dark with fungal tones ---
  drawUnderground(scene, 0x12100e, 0x1a1814);

  // --- Bioluminescent fog overlay ---
  const fog = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  fog.fillStyle(0x0a1020, 0.07);
  fog.fillRect(0, 0, 1280, 720);
  fog.fillStyle(0x1a2a3a, 0.05);
  fog.fillRect(0, 300, 1280, 420);
}

// ── Stage router ─────────────────────────────────────────────────────────

// ============================================================================
// STAGE 5: THORN RIDGE
// ============================================================================
// Rocky elevated ridge cutting through the forest. Exposed tree roots cling
// to stone. Thorny thickets line the path edges. Bright, exposed sunlight
// contrasts with deep shadow pockets under overhangs.
// ============================================================================
export function buildStage5(scene: Phaser.Scene): void {
  // --- The Forgotten Village painted map (11848×822) ---
  const TILES = 12;
  const TILE_W = 1024;
  let needsLoad = false;
  for (let t = 0; t < TILES; t++) {
    const key = `stage5-full-${t}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `assets/Maps/stage5-village/full-${t}.png`);
      needsLoad = true;
    }
  }
  const place = () => {
    for (let t = 0; t < TILES; t++) {
      const key = `stage5-full-${t}`;
      if (!scene.textures.exists(key)) continue;
      scene.add.image(t * TILE_W, 0, key)
        .setOrigin(0, 0).setDepth(-100).setScrollFactor(1, 1)
        .texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    scene.cameras.main.setBounds(0, 0, 11848, 822);
  };
  if (needsLoad) { scene.load.once('complete', place); scene.load.start(); return; }
  place(); return;

  // Legacy procedural fallback (unreachable when tiles exist)
  drawSky(scene, 0x3a4a5a, 0x6a7a6a);

  // --- Rocky ridge silhouettes ---
  const sil1 = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil1, 0x1a2820, WAY, 100, 220, 60, 2400);
  const sil2 = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(-197);
  drawMountainSilhouette(sil2, 0x223020, WAY, 70, 160, 45, 2800);

  // --- Sparse trees on rocky ground ---
  for (let i = 0; i < 8; i++) {
    const x = i * 300 + Phaser.Math.Between(-40, 40);
    const t = scene.add.graphics().setScrollFactor(0.5, 0).setDepth(-165);
    const tw = Phaser.Math.Between(20, 35);
    drawTrunk(t, x, tw, Phaser.Math.Between(60, 140), WAY, 0x3a2a18, 0x1a1208);
    drawLeafBlob(t, x, Phaser.Math.Between(40, 120), 35, 25, 0x2a5a1a);
  }

  // --- Rocky elevated ridge terrain (raised sections) ---
  const ridge = scene.add.graphics().setDepth(WAY - 9);
  // Main ridge bumps — rocky mounds breaking the flat ground
  for (const rx of [800, 1600, 2800, 4200, 5600, 7000]) {
    const rw = Phaser.Math.Between(200, 400);
    const rh = Phaser.Math.Between(15, 30);
    ridge.fillStyle(0x5a5a48, 0.85);
    ridge.beginPath();
    ridge.moveTo(rx - rw / 2, WAY);
    for (let p = 0; p <= 8; p++) {
      const t = p / 8;
      const py = WAY - rh * Math.sin(t * Math.PI) * (0.7 + Math.random() * 0.3);
      ridge.lineTo(rx - rw / 2 + t * rw, py);
    }
    ridge.lineTo(rx + rw / 2, WAY);
    ridge.closePath();
    ridge.fillPath();
    // Rocky texture on ridge
    for (let s = 0; s < 5; s++) {
      ridge.lineStyle(0.8, 0x3a3a2e, 0.4);
      const sx = rx + Phaser.Math.Between(-rw * 0.3, rw * 0.3);
      ridge.lineBetween(sx, WAY - rh * 0.3, sx + Phaser.Math.Between(-10, 10), WAY - rh * 0.6);
    }
  }

  // --- Ground: mixed grass and exposed stone ---
  drawGround(scene, 0x3a5a2a);
  const groundTex = scene.add.graphics().setDepth(WAY - 8);
  // Stone patches exposed through grass
  for (let i = 0; i < 25; i++) {
    const gx = Phaser.Math.Between(0, SW);
    groundTex.fillStyle(0x6a6a58, 0.4);
    groundTex.fillEllipse(gx, WAY + Phaser.Math.Between(10, 70),
      Phaser.Math.Between(20, 50), Phaser.Math.Between(8, 20));
  }
  drawGrassContour(scene, [0x3a7a2a, 0x4a9a3a, 0x5aaa4a]);

  // --- Exposed tree roots clinging to stone ---
  const roots = scene.add.graphics().setDepth(WAY - 4);
  for (const rx of [500, 1400, 2500, 3800, 5200, 6500]) {
    for (let r = 0; r < Phaser.Math.Between(2, 4); r++) {
      const startX = rx + Phaser.Math.Between(-20, 20);
      const endX = startX + Phaser.Math.Between(20, 60) * (Math.random() < 0.5 ? 1 : -1);
      roots.lineStyle(Phaser.Math.FloatBetween(2, 4), 0x4a3420, 0.7);
      roots.beginPath();
      roots.moveTo(startX, WAY - 3);
      roots.lineTo((startX + endX) / 2, WAY - Phaser.Math.Between(5, 15));
      roots.lineTo(endX, WAY + 5);
      roots.strokePath();
    }
  }

  // --- Thorn thickets along edges ---
  const thorns = scene.add.graphics().setDepth(WAY - 3);
  for (let i = 0; i < 15; i++) {
    const tx = Phaser.Math.Between(100, SW - 100);
    const tw = Phaser.Math.Between(30, 60);
    const th = Phaser.Math.Between(12, 25);
    drawLeafBlob(thorns, tx, WAY - th * 0.3, tw, th, 0x2a4a18, 0.8);
    // Thorns
    for (let s = 0; s < 3; s++) {
      thorns.lineStyle(1.2, 0x6a5030, 0.6);
      const sx = tx + Phaser.Math.FloatBetween(-tw * 0.3, tw * 0.3);
      thorns.lineBetween(sx, WAY - th * 0.5, sx + Phaser.Math.Between(-5, 5), WAY - th - 5);
    }
  }

  drawUnderground(scene, 0x2a1a0e, 0x3a2a18);
}

// ============================================================================
// STAGE 6: WHISPERING CANOPY
// ============================================================================
// Thick overhead canopy with shafts of light. Hanging vines, ancient oaks.
// The most densely forested stage — canopy covers most of the sky.
// Key: massive tree trunks, vine curtains, filtered light shafts.
// ============================================================================
export function buildStage6(scene: Phaser.Scene): void {
  // --- Cathedral painted map (11848×822) ---
  const TILES = 12;
  const TILE_W = 1024;
  let needsLoad = false;
  for (let t = 0; t < TILES; t++) {
    const key = `stage6-full-${t}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `assets/Maps/stage6-cathedral/full-${t}.png`);
      needsLoad = true;
    }
  }
  const place = () => {
    for (let t = 0; t < TILES; t++) {
      const key = `stage6-full-${t}`;
      if (!scene.textures.exists(key)) continue;
      scene.add.image(t * TILE_W, 0, key)
        .setOrigin(0, 0).setDepth(-100).setScrollFactor(1, 1)
        .texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    scene.cameras.main.setBounds(0, 0, 11848, 822);
  };
  if (needsLoad) { scene.load.once('complete', place); scene.load.start(); return; }
  place(); return;

  // Legacy procedural fallback (unreachable when tiles exist)
  drawSky(scene, 0x0e1818, 0x182820);

  // --- Dense dark treeline backdrop ---
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  sil.fillStyle(0x0c1810, 1);
  sil.fillRect(-200, 0, 2600, WAY);
  sil.fillStyle(0x101e14, 1);
  let tx = -100;
  sil.beginPath(); sil.moveTo(-100, 60);
  while (tx < 2400) { sil.lineTo(tx, Phaser.Math.Between(15, 70)); tx += Phaser.Math.Between(20, 45); }
  sil.lineTo(2400, 60); sil.lineTo(2400, WAY); sil.lineTo(-100, WAY);
  sil.closePath(); sil.fillPath();

  // --- Background mushroom silhouettes (giant fungi in distance) ---
  const bgShrooms = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(-197);
  for (let i = 0; i < 8; i++) {
    const mx = Phaser.Math.Between(0, 2400);
    const mh = Phaser.Math.Between(80, 160);
    const capW = Phaser.Math.Between(30, 55);
    bgShrooms.fillStyle(0x1a2218, 1);
    bgShrooms.fillRect(mx - 4, WAY - mh, 8, mh);
    bgShrooms.fillEllipse(mx, WAY - mh, capW, capW * 0.45);
  }

  // --- Mid-distance trunks with fungal growths ---
  for (let i = 0; i < 8; i++) {
    const x = i * 300 + Phaser.Math.Between(-40, 40);
    const t = scene.add.graphics().setScrollFactor(0.4, 0).setDepth(-170);
    drawTrunk(t, x, Phaser.Math.Between(40, 65), -20, WAY, 0x2a1e10, 0x0e0a04);
    // Shelf fungi on trunks
    for (let f = 0; f < Phaser.Math.Between(1, 3); f++) {
      const fy = Phaser.Math.Between(100, WAY - 60);
      const side = Math.random() < 0.5 ? -1 : 1;
      t.fillStyle(0x6a5a30, 0.7);
      t.fillEllipse(x + side * 18, fy, 12, 5);
      t.fillStyle(0x7a6a40, 0.5);
      t.fillEllipse(x + side * 18, fy - 2, 8, 3);
    }
  }

  // --- Near trunks (fewer, with heavy fungal cover) ---
  for (let i = 0; i < 4; i++) {
    const x = Phaser.Math.Between(200, SW - 200);
    const t = scene.add.graphics().setDepth(WAY - 8);
    drawTrunk(t, x, Phaser.Math.Between(55, 80), -40, WAY, 0x3a2a18, 0x14100a);
  }

  // --- Dense canopy with fungal coloring ---
  const canopy = scene.add.graphics().setScrollFactor(0.05, 0).setDepth(WAY - 3);
  for (let cx = -50; cx < 1400; cx += Phaser.Math.Between(20, 45)) {
    drawLeafBlob(canopy, cx, Phaser.Math.Between(10, 90),
      Phaser.Math.Between(40, 75), Phaser.Math.Between(25, 40),
      [0x1a3214, 0x1e3818, 0x1a2e12][Phaser.Math.Between(0, 2)]);
  }

  // --- Ground: dark mossy earth with mycelium ---
  drawGround(scene, 0x222e1a);
  const groundTex = scene.add.graphics().setDepth(WAY - 9);
  // Mycelium threads
  for (let i = 0; i < 12; i++) {
    groundTex.lineStyle(Phaser.Math.FloatBetween(0.5, 1.2), 0xccccaa, 0.08);
    let mx = Phaser.Math.Between(0, SW);
    let my = WAY + Phaser.Math.Between(10, 80);
    groundTex.beginPath(); groundTex.moveTo(mx, my);
    for (let s = 0; s < 8; s++) {
      mx += Phaser.Math.Between(-25, 25); my += Phaser.Math.Between(-4, 6);
      groundTex.lineTo(mx, my);
    }
    groundTex.strokePath();
  }
  drawGrassContour(scene, [0x2a4a1a, 0x3a5a2a, 0x3a6a2a]);

  // --- MUSHROOM CLUSTERS at walkingAreaY (fungal territory markers) ---
  const shroomProps = scene.add.graphics().setDepth(WAY - 4);
  for (const clusterX of [400, 1200, 2400, 3600, 4800, 6000, 7200]) {
    const count = Phaser.Math.Between(3, 6);
    for (let m = 0; m < count; m++) {
      const mx = clusterX + Phaser.Math.Between(-40, 40);
      const mh = Phaser.Math.Between(8, 18);
      const capW = Phaser.Math.Between(8, 16);
      // Stalk
      shroomProps.fillStyle(0xddccaa, 0.8);
      shroomProps.fillRect(mx - 1.5, WAY - mh, 3, mh);
      // Cap (varied colors — some glowing)
      const capColor = [0x9966cc, 0xaa7744, 0x66aa44, 0xccaa33][Phaser.Math.Between(0, 3)];
      shroomProps.fillStyle(capColor, 0.85);
      shroomProps.fillEllipse(mx, WAY - mh, capW, capW * 0.5);
      // Spots on cap
      shroomProps.fillStyle(0xffffff, 0.3);
      shroomProps.fillCircle(mx + Phaser.Math.Between(-3, 3), WAY - mh - 1, 1.5);
    }
  }

  // --- GLOWCAP FOREGROUND ACCENTS (bioluminescent ground-level mushrooms) ---
  const glowcaps = scene.add.graphics().setDepth(WAY + 3);
  for (const gx of [300, 900, 1800, 2800, 3800, 5200, 6400, 7400]) {
    const gh = Phaser.Math.Between(5, 10);
    glowcaps.fillStyle(0xddcc88, 0.7);
    glowcaps.fillRect(gx - 0.5, WAY - gh, 1, gh);
    glowcaps.fillStyle(0x44ddaa, 0.7);
    glowcaps.fillEllipse(gx, WAY - gh, 6, 3);
    // Glow aura
    glowcaps.fillStyle(0x44ddaa, 0.06);
    glowcaps.fillCircle(gx, WAY - gh, 12);
  }

  // --- ROTTING LOGS (fallen, covered in fungi) ---
  const logs = scene.add.graphics().setDepth(WAY - 5);
  for (const lx of [700, 2000, 3400, 5500, 6800]) {
    const lw = Phaser.Math.Between(50, 80);
    const lh = Phaser.Math.Between(10, 14);
    logs.fillStyle(0x3a2a18, 0.85);
    logs.fillRect(lx - lw / 2, WAY - lh, lw, lh);
    // Bark lines
    for (let b = 0; b < 3; b++) {
      logs.lineStyle(0.6, 0x2a1a0e, 0.3);
      logs.lineBetween(lx - lw / 2 + b * lw / 3, WAY - lh + 1, lx - lw / 2 + b * lw / 3, WAY - 1);
    }
    // Fungi growing on log
    for (let f = 0; f < Phaser.Math.Between(2, 4); f++) {
      const fx = lx + Phaser.Math.Between(-lw * 0.35, lw * 0.35);
      logs.fillStyle([0x7a6a30, 0x6a8a3a, 0x9966cc][Phaser.Math.Between(0, 2)], 0.7);
      logs.fillEllipse(fx, WAY - lh - 2, 5, 3);
    }
    // Moss on log
    logs.fillStyle(0x3a7a2a, 0.35);
    logs.fillEllipse(lx, WAY - lh, lw * 0.5, 4);
  }

  // --- SPORE FOG POCKETS (semi-transparent green haze near mushroom clusters) ---
  for (const fogX of [1200, 3600, 6000]) {
    const fogW = Phaser.Math.Between(120, 200);
    const fog = scene.add.graphics().setDepth(WAY - 1);
    fog.fillStyle(0x44aa44, 0.04);
    fog.fillEllipse(fogX, WAY - 20, fogW, 50);
    fog.fillStyle(0x55cc55, 0.03);
    fog.fillEllipse(fogX + Phaser.Math.Between(-20, 20), WAY - 15, fogW * 0.6, 35);
  }

  // --- PERIODIC SPORE VENTS (animated hazard — green puffs every few seconds) ---
  for (const ventX of [1800, 4200, 6600]) {
    // Vent mound on ground
    const vent = scene.add.graphics().setDepth(WAY - 3);
    vent.fillStyle(0x4a3a20, 0.8);
    vent.fillEllipse(ventX, WAY - 3, 18, 8);
    vent.fillStyle(0x3a6a2a, 0.6);
    vent.fillEllipse(ventX, WAY - 5, 10, 5);
    // Periodic spore puff
    scene.time.addEvent({
      delay: 3000 + Phaser.Math.Between(0, 2000),
      repeat: -1,
      callback: () => {
        for (let p = 0; p < 6; p++) {
          const puff = scene.add.circle(
            ventX + Phaser.Math.Between(-8, 8),
            WAY - 8, Phaser.Math.Between(3, 7), 0x66cc44, 0.35,
          ).setDepth(WAY + 1);
          scene.tweens.add({
            targets: puff,
            y: WAY - Phaser.Math.Between(25, 55),
            x: ventX + Phaser.Math.Between(-20, 20),
            alpha: 0, scaleX: 2, scaleY: 2,
            duration: 800 + Math.random() * 400,
            onComplete: () => puff.destroy(),
          });
        }
      },
    });
  }

  drawUnderground(scene, 0x1a1208, 0x2a1a0e);

  // Dim green-tinted atmosphere
  const dim = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  dim.fillStyle(0x0a1808, 0.07);
  dim.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGE 7: BANDIT'S CROSSING
// ============================================================================
// A forest clearing turned into a bandit camp. Wooden barricades, campfire
// remnants, rope bridges, and stolen supplies scattered around. More open
// than previous forest stages. Warm firelit tones.
// ============================================================================
export function buildStage7(scene: Phaser.Scene): void {
  // --- Graveyard painted map (11848×822) ---
  const TILES = 12;
  const TILE_W = 1024;
  let needsLoad = false;
  for (let t = 0; t < TILES; t++) {
    const key = `stage7-full-${t}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `assets/Maps/stage7-graveyard/full-${t}.png`);
      needsLoad = true;
    }
  }
  const place = () => {
    for (let t = 0; t < TILES; t++) {
      const key = `stage7-full-${t}`;
      if (!scene.textures.exists(key)) continue;
      scene.add.image(t * TILE_W, 0, key)
        .setOrigin(0, 0).setDepth(-100).setScrollFactor(1, 1)
        .texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    scene.cameras.main.setBounds(0, 0, 11848, 822);
  };
  if (needsLoad) { scene.load.once('complete', place); scene.load.start(); return; }
  place(); return;

  // Legacy procedural fallback (unreachable when tiles exist)
  drawSky(scene, 0x2a3040, 0x4a4a3a);

  // --- Sparse background trees ---
  const sil = scene.add.graphics().setScrollFactor(0.12, 0).setDepth(-198);
  drawMountainSilhouette(sil, 0x182818, WAY, 50, 130, 40, 2400);
  for (let i = 0; i < 10; i++) {
    const x = Phaser.Math.Between(0, 2200);
    drawTrunk(sil, x, Phaser.Math.Between(10, 16), WAY - Phaser.Math.Between(100, 180), WAY, 0x182818, 0x0e1a10);
    drawLeafBlob(sil, x, WAY - Phaser.Math.Between(110, 190), 25, 18, 0x1e3218);
  }

  // --- Scattered mid-distance trees ---
  for (let i = 0; i < 6; i++) {
    const x = i * 380 + Phaser.Math.Between(-50, 50);
    const t = scene.add.graphics().setScrollFactor(0.55, 0).setDepth(-160);
    drawTrunk(t, x, Phaser.Math.Between(25, 40), 50, WAY, 0x3a2a14, 0x1a1008);
    drawLeafBlob(t, x, 40, 40, 30, 0x2a5a1a);
  }

  // --- Ground: trampled dirt with grass patches ---
  const groundG = scene.add.graphics().setDepth(WAY - 10);
  groundG.fillStyle(0x5a4a30, 1); // Trampled dirt base
  groundG.fillRect(0, WAY, SW, GMY - WAY);
  // Grass patches (not full coverage — trampled)
  for (let i = 0; i < 30; i++) {
    const gx = Phaser.Math.Between(0, SW);
    groundG.fillStyle(0x4a7a3a, 0.5);
    groundG.fillEllipse(gx, WAY + Phaser.Math.Between(10, 70),
      Phaser.Math.Between(30, 80), Phaser.Math.Between(10, 25));
  }
  drawGrassContour(scene, [0x4a7a3a, 0x5a8a4a, 0x6a9a5a]);

  // --- BANDIT CAMP PROPS ---
  const camp = scene.add.graphics().setDepth(WAY - 5);

  // Campfire remnants (at ~2000, ~4500)
  for (const fx of [2000, 4500]) {
    // Fire pit stones
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      camp.fillStyle(0x5a5a48, 0.8);
      camp.fillCircle(fx + Math.cos(a) * 12, WAY - 3 + Math.sin(a) * 5, 4);
    }
    // Ash pile center
    camp.fillStyle(0x3a3a30, 0.6);
    camp.fillEllipse(fx, WAY - 2, 16, 7);
    // Charred logs
    camp.fillStyle(0x2a1a0e, 0.8);
    camp.fillRect(fx - 10, WAY - 6, 8, 3);
    camp.fillRect(fx + 3, WAY - 5, 7, 3);
    // Smoke wisps (animated)
    for (let w = 0; w < 3; w++) {
      const smoke = scene.add.circle(fx + Phaser.Math.Between(-5, 5), WAY - 15,
        Phaser.Math.Between(2, 4), 0x888888, 0.15).setDepth(WAY - 4);
      scene.tweens.add({
        targets: smoke, y: WAY - 60 - w * 20, alpha: 0,
        duration: 3000 + w * 1000, repeat: -1, ease: 'Sine.easeOut',
      });
    }
  }

  // Wooden barricades/palisades
  for (const bx of [800, 1500, 3000, 5500, 6500]) {
    const bw = Phaser.Math.Between(80, 140);
    const bh = Phaser.Math.Between(25, 40);
    // Stakes
    for (let s = 0; s < Math.floor(bw / 12); s++) {
      const sx = bx - bw / 2 + s * 12 + Phaser.Math.Between(-2, 2);
      const sh = bh + Phaser.Math.Between(-5, 5);
      camp.fillStyle(0x5a4020, 0.9);
      camp.fillRect(sx - 2, WAY - sh, 4, sh);
      // Pointed top
      camp.fillStyle(0x4a3018, 0.9);
      camp.fillTriangle(sx - 3, WAY - sh, sx, WAY - sh - 5, sx + 3, WAY - sh);
    }
    // Horizontal rail
    camp.fillStyle(0x6a5030, 0.8);
    camp.fillRect(bx - bw / 2, WAY - bh * 0.6, bw, 3);
  }

  // Stolen supply crates
  for (const cx of [1200, 3500, 5800]) {
    const cw = Phaser.Math.Between(14, 22);
    const ch = Phaser.Math.Between(12, 18);
    camp.fillStyle(0x6a5030, 0.9);
    camp.fillRect(cx - cw / 2, WAY - ch, cw, ch);
    // Cross boards
    camp.lineStyle(1.5, 0x4a3018, 0.6);
    camp.lineBetween(cx - cw / 2, WAY - ch, cx + cw / 2, WAY);
    camp.lineBetween(cx + cw / 2, WAY - ch, cx - cw / 2, WAY);
    // Stack second crate sometimes
    if (Math.random() < 0.5) {
      camp.fillStyle(0x5a4520, 0.9);
      camp.fillRect(cx - cw * 0.4, WAY - ch - ch * 0.8, cw * 0.8, ch * 0.8);
    }
  }

  // Rope on ground
  for (const rx of [1800, 4000, 6200]) {
    camp.lineStyle(2, 0x8a7a5a, 0.5);
    camp.beginPath(); camp.moveTo(rx, WAY + 3);
    for (let s = 0; s < 5; s++) {
      camp.lineTo(rx + s * 15 + Phaser.Math.Between(-3, 3), WAY + 3 + Math.sin(s) * 3);
    }
    camp.strokePath();
  }

  // --- CUT TREE STUMPS (bandits clearing the forest) ---
  const stumps = scene.add.graphics().setDepth(WAY - 4);
  for (const sx of [500, 2200, 3800, 5000, 7000]) {
    const sw = Phaser.Math.Between(16, 24);
    const sh = Phaser.Math.Between(8, 14);
    stumps.fillStyle(0x5a4a30, 0.9);
    stumps.fillEllipse(sx, WAY - sh / 2, sw, sh);
    stumps.fillRect(sx - sw * 0.45, WAY - sh, sw * 0.9, sh);
    // Ring pattern
    stumps.lineStyle(0.6, 0x3a2a18, 0.3);
    stumps.strokeEllipse(sx, WAY - sh, sw * 0.6, sh * 0.3);
    // Axe marks on top
    stumps.lineStyle(1, 0x3a2a18, 0.5);
    stumps.lineBetween(sx - 4, WAY - sh, sx + 4, WAY - sh + 2);
  }

  // --- WOODEN SPIKE TRAPS (sharpened stakes angled forward) ---
  const spikes = scene.add.graphics().setDepth(WAY - 3);
  for (const spx of [1000, 2800, 4800, 6800]) {
    for (let s = 0; s < Phaser.Math.Between(3, 5); s++) {
      const stx = spx + s * 8;
      spikes.fillStyle(0x5a4020, 0.85);
      spikes.beginPath();
      spikes.moveTo(stx - 2, WAY);
      spikes.lineTo(stx + 5, WAY - 20 - Phaser.Math.Between(0, 8));
      spikes.lineTo(stx + 3, WAY);
      spikes.closePath(); spikes.fillPath();
    }
    // Base hole
    spikes.fillStyle(0x3a2a18, 0.5);
    spikes.fillEllipse(spx + 12, WAY + 2, 30, 5);
  }

  // --- WAGON WRECKAGE at ~3200 ---
  const wagon = scene.add.graphics().setDepth(WAY - 5);
  // Overturned wagon bed
  wagon.fillStyle(0x5a4020, 0.85);
  wagon.beginPath();
  wagon.moveTo(3150, WAY - 5); wagon.lineTo(3160, WAY - 22);
  wagon.lineTo(3250, WAY - 18); wagon.lineTo(3255, WAY - 3);
  wagon.closePath(); wagon.fillPath();
  // Broken wheel
  wagon.lineStyle(2.5, 0x4a3018, 0.7);
  wagon.strokeCircle(3170, WAY - 1, 10);
  wagon.lineBetween(3170 - 7, WAY - 1, 3170 + 7, WAY - 1);
  wagon.lineBetween(3170, WAY - 8, 3170, WAY + 6);
  // Detached wheel lying flat
  wagon.lineStyle(2, 0x4a3018, 0.5);
  wagon.strokeEllipse(3270, WAY - 2, 16, 5);
  // Spilled cargo
  wagon.fillStyle(0x6a5030, 0.7);
  wagon.fillRect(3260, WAY - 8, 10, 8);
  wagon.fillRect(3275, WAY - 6, 8, 6);
  wagon.fillStyle(0x8a7a5a, 0.5);
  wagon.fillCircle(3285, WAY - 2, 4); // barrel

  // --- HANGING BANDIT BANNERS (cloth strips on posts) ---
  const banners = scene.add.graphics().setDepth(WAY - 6);
  for (const bx of [600, 1600, 3600, 5200, 6600]) {
    // Post
    banners.fillStyle(0x5a4020, 0.9);
    banners.fillRect(bx - 2, WAY - 35, 4, 35);
    // Tattered cloth banner (dark red, torn edge)
    banners.fillStyle(0x8a2222, 0.75);
    banners.beginPath();
    banners.moveTo(bx + 3, WAY - 33);
    banners.lineTo(bx + 18, WAY - 31);
    banners.lineTo(bx + 15, WAY - 22);
    banners.lineTo(bx + 20, WAY - 18); // torn point
    banners.lineTo(bx + 12, WAY - 20);
    banners.lineTo(bx + 3, WAY - 22);
    banners.closePath(); banners.fillPath();
    // Skull mark on banner
    banners.fillStyle(0xccccaa, 0.4);
    banners.fillCircle(bx + 11, WAY - 27, 3);
  }

  // --- ROPE BARRICADE LINES (strung between posts) ---
  const ropes = scene.add.graphics().setDepth(WAY - 2);
  for (const rx of [900, 2500, 5800]) {
    const rw = Phaser.Math.Between(80, 120);
    // Left post
    ropes.fillStyle(0x5a4020, 0.8);
    ropes.fillRect(rx - 2, WAY - 20, 4, 20);
    // Right post
    ropes.fillRect(rx + rw - 2, WAY - 20, 4, 20);
    // Sagging rope between
    ropes.lineStyle(2, 0x8a7a5a, 0.6);
    ropes.beginPath(); ropes.moveTo(rx, WAY - 18);
    for (let p = 0; p <= 6; p++) {
      const t = p / 6;
      const sag = Math.sin(t * Math.PI) * 6;
      ropes.lineTo(rx + t * rw, WAY - 18 + sag);
    }
    ropes.strokePath();
    // Rags/warning strips hanging from rope
    for (let r = 0; r < 3; r++) {
      const ragX = rx + (r + 1) * rw / 4;
      ropes.fillStyle(0x8a6644, 0.5);
      ropes.fillRect(ragX - 1, WAY - 16 + Math.sin(r) * 3, 2, Phaser.Math.Between(5, 10));
    }
  }

  drawUnderground(scene, 0x2a1a0e, 0x3a2a14);

  // Warm firelight tint
  const warm = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  warm.fillStyle(0x201008, 0.04);
  warm.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGE 8: THE ELDER GROVE (Forest Boss)
// ============================================================================
// Ancient sacred grove — massive central tree, glowing roots, stone shrine.
// Boss arena feel. More open than other forest stages.
// ============================================================================
export function buildStage8(scene: Phaser.Scene): void {
  // FORTIFIED BANDIT STRONGHOLD — permanent camp concluding the forest arc
  drawSky(scene, 0x3a3830, 0x5a5040);

  // --- Forest edge backdrop (camp is in a cleared area) ---
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x1a2818, WAY, 50, 120, 45, 2400);
  // Remaining trees at edges
  for (let i = 0; i < 6; i++) {
    const x = Phaser.Math.Between(0, 2200);
    drawTrunk(sil, x, Phaser.Math.Between(10, 18), WAY - Phaser.Math.Between(80, 150), WAY, 0x1a2818, 0x0e1a10);
    drawLeafBlob(sil, x, WAY - Phaser.Math.Between(90, 160), 25, 18, 0x1e3218);
  }

  // --- Mid-distance: fortification wall silhouette ---
  const fort = scene.add.graphics().setScrollFactor(0.3, 0).setDepth(-180);
  // Log palisade wall stretching across background
  for (let i = 0; i < 30; i++) {
    const px = i * 80 + Phaser.Math.Between(-5, 5);
    const ph = Phaser.Math.Between(50, 70);
    fort.fillStyle(0x3a2a18, 0.9);
    fort.fillRect(px - 4, WAY - ph, 8, ph);
    fort.fillStyle(0x2a1a0e, 0.9);
    fort.fillTriangle(px - 5, WAY - ph, px, WAY - ph - 6, px + 5, WAY - ph);
  }
  // Horizontal support beams
  fort.fillStyle(0x4a3a20, 0.7);
  fort.fillRect(-200, WAY - 35, 2600, 4);
  fort.fillRect(-200, WAY - 55, 2600, 3);

  // --- Ground: hard-packed dirt camp ground ---
  const groundG = scene.add.graphics().setDepth(WAY - 10);
  groundG.fillStyle(0x5a4a30, 1);
  groundG.fillRect(0, WAY, SW, GMY - WAY);
  // Trampled paths
  for (let i = 0; i < 15; i++) {
    groundG.fillStyle(0x6a5a3a, 0.4);
    groundG.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(10, 70),
      Phaser.Math.Between(30, 80), Phaser.Math.Between(8, 18));
  }
  drawGrassContour(scene, [0x5a6a3a, 0x6a7a4a, 0x7a8a5a]);

  const props = scene.add.graphics().setDepth(WAY - 5);

  // --- FORTIFIED ENTRANCE (~500-700) ---
  // Gate posts
  props.fillStyle(0x5a4020, 0.95);
  props.fillRect(550, WAY - 50, 10, 50);
  props.fillRect(640, WAY - 50, 10, 50);
  // Gate lintel
  props.fillRect(548, WAY - 52, 104, 6);
  // Skull decoration on gate
  props.fillStyle(0xddddcc, 0.6);
  props.fillCircle(600, WAY - 48, 5);
  props.fillStyle(0x222222, 0.4);
  props.fillCircle(598, WAY - 49, 1.5);
  props.fillCircle(602, WAY - 49, 1.5);
  // Hanging chains
  props.lineStyle(1.5, 0x6a6a5a, 0.5);
  props.lineBetween(570, WAY - 50, 570, WAY - 35);
  props.lineBetween(630, WAY - 50, 630, WAY - 35);

  // --- BANDIT TENTS (peaked cloth roofs) ---
  for (const tx of [1500, 3200, 5500]) {
    const tw = Phaser.Math.Between(60, 90);
    const th = Phaser.Math.Between(30, 45);
    // Tent fabric
    props.fillStyle(0x7a6a4a, 0.85);
    props.fillTriangle(tx - tw / 2, WAY - 5, tx, WAY - th, tx + tw / 2, WAY - 5);
    // Tent opening (dark)
    props.fillStyle(0x2a1a0e, 0.7);
    props.fillTriangle(tx - 8, WAY - 5, tx, WAY - th * 0.6, tx + 8, WAY - 5);
    // Support pole
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(tx - 1.5, WAY - th - 3, 3, th + 3);
    // Flag on top
    props.fillStyle(0x8a2222, 0.7);
    props.fillRect(tx + 2, WAY - th - 3, 12, 7);
  }

  // --- CAMPFIRE CLUSTERS (larger than Stage 7) ---
  for (const fx of [1000, 2500, 4000, 6000]) {
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      props.fillStyle(0x5a5a48, 0.8);
      props.fillCircle(fx + Math.cos(a) * 14, WAY - 3 + Math.sin(a) * 6, 4);
    }
    props.fillStyle(0x3a2a18, 0.6);
    props.fillEllipse(fx, WAY - 1, 20, 8);
    // Active fire (orange glow)
    const fire = scene.add.circle(fx, WAY - 8, 5, 0xff6622, 0.45).setDepth(WAY - 4);
    scene.tweens.add({ targets: fire, alpha: { from: 0.45, to: 0.15 }, scaleY: { from: 1, to: 1.4 }, duration: 400, yoyo: true, repeat: -1 });
    // Smoke
    const smoke = scene.add.circle(fx, WAY - 15, 3, 0x888888, 0.15).setDepth(WAY - 3);
    scene.tweens.add({ targets: smoke, y: WAY - 60, alpha: 0, duration: 3000, repeat: -1 });
  }

  // --- WATCH POSTS (tall platforms at intervals) ---
  for (const wx of [800, 2800, 5000, 7000]) {
    // Platform posts
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(wx - 12, WAY - 55, 5, 55);
    props.fillRect(wx + 7, WAY - 55, 5, 55);
    // Platform floor
    props.fillRect(wx - 15, WAY - 57, 30, 4);
    // Railing
    props.fillRect(wx - 14, WAY - 65, 3, 8);
    props.fillRect(wx + 11, WAY - 65, 3, 8);
    props.fillRect(wx - 14, WAY - 65, 28, 2);
    // Lantern hanging from post
    props.fillStyle(0xddaa44, 0.6);
    props.fillCircle(wx, WAY - 68, 3);
    props.fillStyle(0xffcc44, 0.15);
    props.fillCircle(wx, WAY - 68, 8);
  }

  // --- WEAPON RACKS ---
  for (const rx of [1800, 4500]) {
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(rx - 18, WAY - 25, 36, 3);
    props.fillRect(rx - 15, WAY - 25, 2, 25);
    props.fillRect(rx + 13, WAY - 25, 2, 25);
    // Weapons leaning
    props.lineStyle(2, 0x7a7a6a, 0.7);
    props.lineBetween(rx - 8, WAY - 23, rx - 6, WAY - 38);
    props.lineBetween(rx, WAY - 23, rx + 2, WAY - 36);
    props.lineBetween(rx + 8, WAY - 23, rx + 7, WAY - 40);
  }

  // --- CUT-LOG FORTIFICATIONS (stacked log walls) ---
  for (const lx of [1200, 3600, 5800]) {
    for (let row = 0; row < 3; row++) {
      const ly = WAY - row * 7 - 3;
      props.fillStyle(0x5a4020, 0.85);
      props.fillEllipse(lx, ly, 35, 6);
      props.lineStyle(0.5, 0x3a2a10, 0.4);
      props.strokeEllipse(lx, ly, 35, 6);
    }
  }

  // --- SUPPLY CRATE PILES ---
  for (const cx of [700, 2200, 4800, 6500]) {
    for (let c = 0; c < Phaser.Math.Between(2, 4); c++) {
      const cw = Phaser.Math.Between(12, 18);
      const ch = Phaser.Math.Between(10, 15);
      const ox = cx + Phaser.Math.Between(-20, 20);
      const oy = c > 0 ? WAY - ch * c * 0.7 : 0;
      props.fillStyle(0x6a5030, 0.9);
      props.fillRect(ox - cw / 2, WAY - ch - oy, cw, ch);
      props.lineStyle(1, 0x4a3018, 0.5);
      props.strokeRect(ox - cw / 2, WAY - ch - oy, cw, ch);
    }
  }

  // --- BANDIT BANNERS (larger than Stage 7, more prominent) ---
  for (const bx of [400, 1600, 3000, 4400, 6200, 7400]) {
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(bx - 2, WAY - 40, 4, 40);
    // Larger banner cloth
    props.fillStyle(0x8a2222, 0.8);
    props.beginPath();
    props.moveTo(bx + 3, WAY - 38);
    props.lineTo(bx + 22, WAY - 36);
    props.lineTo(bx + 18, WAY - 24);
    props.lineTo(bx + 24, WAY - 18);
    props.lineTo(bx + 14, WAY - 22);
    props.lineTo(bx + 3, WAY - 24);
    props.closePath(); props.fillPath();
    // Crossed swords emblem
    props.lineStyle(1, 0xddddaa, 0.5);
    props.lineBetween(bx + 10, WAY - 34, bx + 18, WAY - 24);
    props.lineBetween(bx + 18, WAY - 34, bx + 10, WAY - 24);
  }

  drawUnderground(scene, 0x2a1a0e, 0x3a2a14);

  // Warm torchlit tint
  const warm = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  warm.fillStyle(0x201008, 0.05);
  warm.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGE 9: SCORCHED PERIMETER (Wildlands Arc begins)
// ============================================================================
// Transition from forest to occupied wildlands. Burned grassland, charred
// stumps, military patrol markers. Overcast sky with smoke haze.
// ============================================================================
export function buildStage9(scene: Phaser.Scene): void {
  drawSky(scene, 0x4a4a4a, 0x6a6058);

  // --- Smoke-hazed horizon ---
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  sil.fillStyle(0x3a3830, 1);
  sil.fillRect(-200, WAY - 80, 2600, 80);
  // Charred tree stumps in distance
  for (let i = 0; i < 20; i++) {
    const x = Phaser.Math.Between(0, 2200);
    const h = Phaser.Math.Between(15, 40);
    sil.fillStyle(0x2a2420, 1);
    sil.fillRect(x - 3, WAY - h, 6, h);
    // Broken top
    sil.fillTriangle(x - 4, WAY - h, x, WAY - h - 3, x + 4, WAY - h);
  }

  // --- Scattered charred trees (mid-distance) ---
  for (let i = 0; i < 8; i++) {
    const x = i * 280 + Phaser.Math.Between(-30, 30);
    const t = scene.add.graphics().setScrollFactor(0.45, 0).setDepth(-165);
    const tw = Phaser.Math.Between(15, 25);
    const th = Phaser.Math.Between(80, 150);
    // Charred trunk
    drawTrunk(t, x, tw, WAY - th, WAY, 0x1a1410, 0x0a0808);
    // Broken branches (no leaves)
    for (let b = 0; b < Phaser.Math.Between(1, 3); b++) {
      const by = WAY - th * Phaser.Math.FloatBetween(0.3, 0.7);
      const side = Math.random() < 0.5 ? -1 : 1;
      t.lineStyle(2, 0x1a1410, 0.7);
      t.lineBetween(x + side * tw * 0.4, by, x + side * Phaser.Math.Between(15, 30), by - Phaser.Math.Between(5, 15));
    }
  }

  // --- Ground: scorched earth ---
  const groundG = scene.add.graphics().setDepth(WAY - 10);
  groundG.fillStyle(0x5a4a30, 1);
  groundG.fillRect(0, WAY, SW, GMY - WAY);
  // Burn patches
  for (let i = 0; i < 40; i++) {
    groundG.fillStyle(0x2a2018, 0.4);
    groundG.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(5, 80),
      Phaser.Math.Between(20, 60), Phaser.Math.Between(8, 20));
  }
  // Sparse surviving grass
  for (let i = 0; i < 15; i++) {
    groundG.fillStyle(0x5a7a3a, 0.4);
    groundG.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(10, 70),
      Phaser.Math.Between(15, 40), Phaser.Math.Between(5, 12));
  }
  drawGrassContour(scene, [0x6a5a3a, 0x7a6a4a, 0x8a7a5a]);

  // --- Patrol markers (flags, stakes) ---
  const markers = scene.add.graphics().setDepth(WAY - 4);
  for (const mx of [600, 1500, 2800, 4200, 5800, 7200]) {
    // Stake
    markers.fillStyle(0x5a4a30, 0.9);
    markers.fillRect(mx - 1.5, WAY - 25, 3, 25);
    // Flag/pennant
    markers.fillStyle(0xaa3333, 0.8);
    markers.fillTriangle(mx + 2, WAY - 25, mx + 15, WAY - 20, mx + 2, WAY - 15);
  }

  // --- Smoldering ground fires ---
  for (const fx of [1000, 3000, 5000, 6500]) {
    const fire = scene.add.graphics().setDepth(WAY + 1);
    fire.fillStyle(0x3a2010, 0.6);
    fire.fillEllipse(fx, WAY + 2, 20, 6);
    // Ember glow
    const ember = scene.add.circle(fx, WAY - 2, 3, 0xff6622, 0.3).setDepth(WAY + 2);
    scene.tweens.add({
      targets: ember, alpha: { from: 0.3, to: 0.05 },
      duration: 1500, yoyo: true, repeat: -1,
    });
  }

  drawUnderground(scene, 0x2a1a0e, 0x3a2818);

  // Smoke haze overlay
  const smoke = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  smoke.fillStyle(0x2a2820, 0.06);
  smoke.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGE 10: SUPPLY LINE (Wildlands)
// ============================================================================
// Military supply route. Dirt road with wagon tracks, supply crates,
// broken wagons. More structured/artificial than natural terrain.
// ============================================================================
export function buildStage10(scene: Phaser.Scene): void {
  drawSky(scene, 0x5a5a5a, 0x7a7068);

  // --- Rolling hills background ---
  const hills = scene.add.graphics().setScrollFactor(0.12, 0).setDepth(-198);
  drawMountainSilhouette(hills, 0x4a4a38, WAY, 30, 80, 60, 2600);
  const hills2 = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(-196);
  drawMountainSilhouette(hills2, 0x5a5a44, WAY, 20, 50, 50, 3000);

  // --- Occasional surviving trees ---
  for (let i = 0; i < 5; i++) {
    const x = i * 500 + Phaser.Math.Between(-40, 40);
    const t = scene.add.graphics().setScrollFactor(0.4, 0).setDepth(-175);
    drawTrunk(t, x, Phaser.Math.Between(12, 20), Phaser.Math.Between(100, 180), WAY, 0x3a2a18, 0x1a1408);
    drawLeafBlob(t, x, Phaser.Math.Between(80, 160), 30, 22, 0x3a6a2a);
  }

  // --- Ground: dirt road ---
  const groundG = scene.add.graphics().setDepth(WAY - 10);
  groundG.fillStyle(0x6a5a3a, 1);
  groundG.fillRect(0, WAY, SW, GMY - WAY);
  // Road surface (lighter center strip)
  groundG.fillStyle(0x7a6a4a, 0.6);
  groundG.fillRect(0, WAY + 15, SW, GMY - WAY - 30);
  // Wagon rut tracks
  for (let track = 0; track < 2; track++) {
    const ty = WAY + 25 + track * 40;
    groundG.lineStyle(2, 0x5a4a2a, 0.4);
    groundG.beginPath(); groundG.moveTo(0, ty);
    for (let px = 0; px <= SW; px += 30) {
      groundG.lineTo(px, ty + Math.sin(px * 0.005) * 2);
    }
    groundG.strokePath();
  }
  drawGrassContour(scene, [0x5a7a3a, 0x6a8a4a, 0x7a9a5a]);

  // --- Supply crates and barrels ---
  const supplies = scene.add.graphics().setDepth(WAY - 4);
  for (const sx of [500, 1400, 2600, 3800, 5200, 6600]) {
    const count = Phaser.Math.Between(2, 4);
    for (let c = 0; c < count; c++) {
      const cx = sx + Phaser.Math.Between(-30, 30);
      if (Math.random() < 0.6) {
        // Crate
        const cw = Phaser.Math.Between(12, 20);
        const ch = Phaser.Math.Between(10, 16);
        supplies.fillStyle(0x6a5030, 0.9);
        supplies.fillRect(cx - cw / 2, WAY - ch, cw, ch);
        supplies.lineStyle(1, 0x4a3018, 0.5);
        supplies.strokeRect(cx - cw / 2, WAY - ch, cw, ch);
      } else {
        // Barrel
        supplies.fillStyle(0x5a4020, 0.9);
        supplies.fillEllipse(cx, WAY - 8, 10, 14);
        supplies.lineStyle(1, 0x3a2010, 0.5);
        supplies.strokeEllipse(cx, WAY - 8, 10, 14);
        // Metal bands
        supplies.lineStyle(1, 0x6a6a5a, 0.4);
        supplies.lineBetween(cx - 5, WAY - 12, cx + 5, WAY - 12);
        supplies.lineBetween(cx - 5, WAY - 4, cx + 5, WAY - 4);
      }
    }
  }

  // --- Broken wagon at ~3200 ---
  const wagon = scene.add.graphics().setDepth(WAY - 3);
  wagon.fillStyle(0x5a4020, 0.9);
  wagon.fillRect(3150, WAY - 25, 100, 20); // wagon bed
  // Wheel (broken)
  wagon.lineStyle(2, 0x4a3018, 0.7);
  wagon.strokeCircle(3170, WAY - 2, 12);
  wagon.lineStyle(2, 0x4a3018, 0.7);
  wagon.strokeCircle(3230, WAY - 2, 12);
  // Axle
  wagon.fillStyle(0x3a2010, 0.8);
  wagon.fillRect(3160, WAY - 8, 80, 3);
  // Scattered cargo near wagon
  wagon.fillStyle(0x6a5030, 0.8);
  wagon.fillRect(3260, WAY - 10, 14, 10);
  wagon.fillRect(3280, WAY - 8, 12, 8);

  drawUnderground(scene, 0x3a2a18, 0x4a3a28);
}

// ============================================================================
// STAGE 11: FIELDWORKS (Wildlands)
// ============================================================================
// Trenches and fortified positions. Sandbag walls, wooden stakes,
// earthen embankments creating cover zones. Very flat with dug-in terrain.
// ============================================================================
export function buildStage11(scene: Phaser.Scene): void {
  drawSky(scene, 0x5a5a58, 0x6a6860);

  // --- Flat horizon with distant smoke columns ---
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  sil.fillStyle(0x4a4838, 1);
  sil.fillRect(-200, WAY - 30, 2600, 30);
  // Smoke columns in distance
  for (const sx of [400, 1200, 1800]) {
    sil.fillStyle(0x5a5a50, 0.4);
    sil.beginPath();
    sil.moveTo(sx - 3, WAY - 30);
    sil.lineTo(sx + 3, WAY - 30);
    sil.lineTo(sx + 8, WAY - 100);
    sil.lineTo(sx - 8, WAY - 100);
    sil.closePath();
    sil.fillPath();
  }

  // --- Ground: muddy brown with trench lines ---
  const groundG = scene.add.graphics().setDepth(WAY - 10);
  groundG.fillStyle(0x5a4a30, 1);
  groundG.fillRect(0, WAY, SW, GMY - WAY);
  drawGrassContour(scene, [0x5a6a3a, 0x6a7a4a, 0x7a8a5a]);

  // --- TRENCHES (dug lines across the walking area) ---
  const trenches = scene.add.graphics().setDepth(WAY - 8);
  for (const tx of [1200, 2800, 4400, 6000]) {
    const tw = Phaser.Math.Between(60, 100);
    // Trench shadow (darker depression)
    trenches.fillStyle(0x3a2a18, 0.6);
    trenches.fillRect(tx - tw / 2, WAY + 10, tw, 50);
    // Trench edges (raised dirt)
    trenches.fillStyle(0x6a5a3a, 0.7);
    trenches.beginPath();
    trenches.moveTo(tx - tw / 2 - 10, WAY + 8);
    for (let p = 0; p <= 6; p++) {
      trenches.lineTo(tx - tw / 2 - 10 + p * ((tw + 20) / 6),
        WAY + 5 + Math.sin(p * 1.2) * 4);
    }
    trenches.lineTo(tx + tw / 2 + 10, WAY + 12);
    trenches.lineTo(tx - tw / 2 - 10, WAY + 12);
    trenches.closePath();
    trenches.fillPath();
  }

  // --- Sandbag walls ---
  const sandbags = scene.add.graphics().setDepth(WAY - 4);
  for (const sx of [800, 2000, 3600, 5200, 6800]) {
    const sw = Phaser.Math.Between(50, 80);
    const sh = Phaser.Math.Between(12, 20);
    // Stacked bags
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < Math.floor(sw / 14); col++) {
        const bx = sx - sw / 2 + col * 14 + (row % 2) * 7;
        const by = WAY - sh + row * 8;
        sandbags.fillStyle(0x7a6a4a, 0.85);
        sandbags.fillEllipse(bx + 7, by + 4, 13, 7);
        sandbags.lineStyle(0.5, 0x5a4a2a, 0.3);
        sandbags.strokeEllipse(bx + 7, by + 4, 13, 7);
      }
    }
  }

  // --- Wooden stakes (anti-cavalry) ---
  const stakes = scene.add.graphics().setDepth(WAY - 3);
  for (const sx of [500, 1600, 3200, 4800, 6400]) {
    for (let s = 0; s < Phaser.Math.Between(3, 6); s++) {
      const stx = sx + s * 12;
      const sth = Phaser.Math.Between(15, 25);
      const lean = Phaser.Math.FloatBetween(-0.15, 0.15);
      stakes.fillStyle(0x5a4020, 0.9);
      stakes.beginPath();
      stakes.moveTo(stx - 2, WAY);
      stakes.lineTo(stx - 1 + lean * sth, WAY - sth);
      stakes.lineTo(stx + 1 + lean * sth, WAY - sth - 2);
      stakes.lineTo(stx + 2, WAY);
      stakes.closePath();
      stakes.fillPath();
    }
  }

  drawUnderground(scene, 0x3a2a18, 0x4a3a28);
}

// ============================================================================
// STAGE 12: RALLY POINT (Wildlands)
// ============================================================================
export function buildStage12(scene: Phaser.Scene): void {
  drawSky(scene, 0x5a5050, 0x7a6a58);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x3a3830, WAY, 30, 70, 50, 2400);

  drawGround(scene, 0x5a4a30);
  drawGrassContour(scene, [0x5a6a3a, 0x6a7a4a, 0x6a8a4a]);

  // Command tents
  const props = scene.add.graphics().setDepth(WAY - 5);
  for (const tx of [1200, 3500, 5800]) {
    const tw = Phaser.Math.Between(60, 90);
    const th = Phaser.Math.Between(30, 45);
    props.fillStyle(0x7a6a4a, 0.9);
    props.fillTriangle(tx - tw / 2, WAY - 5, tx, WAY - th, tx + tw / 2, WAY - 5);
    props.lineStyle(1.5, 0x4a3a20, 0.6);
    props.strokeTriangle(tx - tw / 2, WAY - 5, tx, WAY - th, tx + tw / 2, WAY - 5);
    // Tent pole
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(tx - 1.5, WAY - th - 5, 3, th + 5);
  }
  // War banners
  for (const bx of [800, 2400, 4200, 6500]) {
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(bx - 1.5, WAY - 40, 3, 40);
    props.fillStyle(0xaa2222, 0.85);
    props.fillRect(bx + 2, WAY - 40, 18, 12);
    props.fillStyle(0x881818, 0.7);
    props.fillRect(bx + 2, WAY - 28, 14, 8);
  }
  // Weapon racks
  for (const wx of [2000, 4800]) {
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(wx - 15, WAY - 22, 30, 3);
    props.fillRect(wx - 12, WAY - 22, 2, 22);
    props.fillRect(wx + 10, WAY - 22, 2, 22);
    // Spears leaning
    for (let s = 0; s < 3; s++) {
      props.lineStyle(1.5, 0x6a6a5a, 0.7);
      props.lineBetween(wx - 8 + s * 8, WAY - 20, wx - 8 + s * 8 + 3, WAY - 35);
    }
  }
  drawUnderground(scene, 0x3a2a18, 0x4a3a28);
}

// ============================================================================
// STAGE 13: SIEGE ENCAMPMENT (Wildlands)
// ============================================================================
export function buildStage13(scene: Phaser.Scene): void {
  drawSky(scene, 0x4a4848, 0x6a5a50);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x3a3828, WAY, 40, 90, 50, 2400);

  drawGround(scene, 0x5a4a2a);
  drawGrassContour(scene, [0x5a5a3a, 0x6a6a4a, 0x7a7a5a]);

  const props = scene.add.graphics().setDepth(WAY - 5);
  // Palisade walls
  for (const px of [600, 2000, 3500, 5500]) {
    const pw = Phaser.Math.Between(100, 160);
    for (let s = 0; s < Math.floor(pw / 10); s++) {
      const sx = px - pw / 2 + s * 10;
      const sh = Phaser.Math.Between(28, 38);
      props.fillStyle(0x5a4020, 0.9);
      props.fillRect(sx - 2, WAY - sh, 4, sh);
      props.fillTriangle(sx - 3, WAY - sh, sx, WAY - sh - 4, sx + 3, WAY - sh);
    }
  }
  // Siege catapult at ~4200
  props.fillStyle(0x5a4020, 0.9);
  props.fillRect(4170, WAY - 15, 60, 12); // base
  props.fillRect(4195, WAY - 35, 6, 20); // arm support
  props.lineStyle(3, 0x5a4020, 0.8);
  props.lineBetween(4198, WAY - 35, 4230, WAY - 50); // throwing arm
  // Fire pits
  for (const fx of [1200, 3000, 6200]) {
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2;
      props.fillStyle(0x5a5a48, 0.7);
      props.fillCircle(fx + Math.cos(a) * 10, WAY - 2 + Math.sin(a) * 4, 3);
    }
    props.fillStyle(0x3a1a08, 0.5);
    props.fillEllipse(fx, WAY - 1, 14, 6);
    const flicker = scene.add.circle(fx, WAY - 6, 4, 0xff6622, 0.35).setDepth(WAY - 4);
    scene.tweens.add({ targets: flicker, alpha: { from: 0.35, to: 0.1 }, scaleX: { from: 1, to: 0.6 }, duration: 800, yoyo: true, repeat: -1 });
  }
  drawUnderground(scene, 0x3a2a18, 0x4a3a28);
}

// ============================================================================
// STAGE 14: THE WARLORD'S STAND (Wildlands Boss)
// ============================================================================
export function buildStage14(scene: Phaser.Scene): void {
  drawSky(scene, 0x4a3a3a, 0x6a5048);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x3a2828, WAY, 40, 100, 50, 2400);

  drawGround(scene, 0x5a4830);
  drawGrassContour(scene, [0x5a5a3a, 0x6a6a4a, 0x7a7a5a]);

  const props = scene.add.graphics().setDepth(WAY - 5);
  // Raised platform (boss arena ~3800-4200)
  props.fillStyle(0x5a4a30, 0.9);
  props.fillRect(3700, WAY - 20, 500, 20);
  props.fillStyle(0x6a5a3a, 0.8);
  props.fillRect(3720, WAY - 22, 460, 4);
  // Steps
  props.fillRect(3700, WAY - 10, 30, 10);
  props.fillRect(4170, WAY - 10, 30, 10);
  // Trophy poles
  for (const tx of [3800, 3950, 4100]) {
    props.fillStyle(0x5a4020, 0.9);
    props.fillRect(tx - 2, WAY - 50, 4, 30);
    // Skull on top
    props.fillStyle(0xddddcc, 0.7);
    props.fillCircle(tx, WAY - 52, 5);
    props.fillStyle(0x222222, 0.5);
    props.fillCircle(tx - 2, WAY - 53, 1);
    props.fillCircle(tx + 2, WAY - 53, 1);
  }
  // Iron cage at 6000
  props.lineStyle(2, 0x5a5a5a, 0.7);
  for (let b = 0; b < 5; b++) {
    props.lineBetween(5980 + b * 8, WAY - 35, 5980 + b * 8, WAY);
  }
  props.lineBetween(5980, WAY - 35, 6012, WAY - 35);
  props.lineBetween(5980, WAY - 18, 6012, WAY - 18);

  drawUnderground(scene, 0x3a2818, 0x4a3828);
  const tint = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  tint.fillStyle(0x1a0808, 0.05);
  tint.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGE 15: THE BROKEN ROAD (Stone March begins)
// ============================================================================
export function buildStage15(scene: Phaser.Scene): void {
  drawSky(scene, 0x6a6a6a, 0x8a8878);

  const sil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x4a4a40, WAY, 100, 250, 70, 2400);
  const sil2 = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(-197);
  drawMountainSilhouette(sil2, 0x5a5a4a, WAY, 60, 150, 55, 2800);

  // Cliff face with rock layers
  const cliff = scene.add.graphics().setScrollFactor(0.3, 0).setDepth(-185);
  cliff.fillStyle(0x5a5a4a, 1);
  cliff.fillRect(-200, 80, 2800, WAY - 80);
  // Rock strata lines
  for (let l = 0; l < 8; l++) {
    cliff.lineStyle(1.5, 0x4a4a3a, 0.3);
    const ly = 80 + (WAY - 80) * (l / 8);
    cliff.lineBetween(-200, ly + Phaser.Math.Between(-5, 5), 2600, ly + Phaser.Math.Between(-5, 5));
  }

  // Ground: grey-brown stone road
  const groundG = scene.add.graphics().setDepth(WAY - 10);
  groundG.fillStyle(0x6a6a58, 1);
  groundG.fillRect(0, WAY, SW, GMY - WAY);
  // Cobblestone pattern
  for (let i = 0; i < 80; i++) {
    groundG.lineStyle(0.5, 0x5a5a48, 0.3);
    const cx = Phaser.Math.Between(0, SW);
    const cy = WAY + Phaser.Math.Between(5, 90);
    groundG.strokeEllipse(cx, cy, Phaser.Math.Between(8, 18), Phaser.Math.Between(6, 12));
  }
  drawGrassContour(scene, [0x6a7a5a, 0x7a8a6a, 0x8a9a7a]);

  // Rockslide debris
  const debris = scene.add.graphics().setDepth(WAY - 4);
  for (const dx of [800, 2200, 4000, 5500, 7000]) {
    for (let r = 0; r < Phaser.Math.Between(3, 7); r++) {
      const rx = dx + Phaser.Math.Between(-40, 40);
      debris.fillStyle([0x6a6a58, 0x5a5a48, 0x7a7a68][Phaser.Math.Between(0, 2)], 0.85);
      const rw = Phaser.Math.Between(8, 20);
      const rh = Phaser.Math.Between(6, 14);
      debris.beginPath();
      for (let p = 0; p <= 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        debris.lineTo(rx + Math.cos(a) * rw * (0.6 + Math.random() * 0.4),
          WAY - 3 + Math.sin(a) * rh * (0.6 + Math.random() * 0.4));
      }
      debris.closePath();
      debris.fillPath();
    }
  }
  drawUnderground(scene, 0x3a3a30, 0x4a4a3a);
}

// ============================================================================
// STAGE 16: DUST CANYON (Stone March)
// ============================================================================
export function buildStage16(scene: Phaser.Scene): void {
  drawSky(scene, 0x7a7060, 0x9a8a70);

  // Canyon walls on both sides
  const walls = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(-190);
  // Left wall
  walls.fillStyle(0x6a5a48, 1);
  walls.beginPath(); walls.moveTo(-200, 0);
  let wx = -200;
  while (wx < 2600) {
    walls.lineTo(wx, Phaser.Math.Between(60, 150));
    wx += Phaser.Math.Between(30, 60);
  }
  walls.lineTo(2600, WAY); walls.lineTo(-200, WAY); walls.closePath(); walls.fillPath();

  // Wind-carved pillars
  const pillars = scene.add.graphics().setScrollFactor(0.35, 0).setDepth(-180);
  for (let i = 0; i < 8; i++) {
    const px = i * 300 + Phaser.Math.Between(-30, 30);
    const pw = Phaser.Math.Between(20, 35);
    const ph = Phaser.Math.Between(100, 200);
    pillars.fillStyle(0x7a6a50, 0.9);
    pillars.beginPath();
    pillars.moveTo(px - pw / 2, WAY);
    pillars.lineTo(px - pw * 0.35, WAY - ph);
    pillars.lineTo(px + pw * 0.35, WAY - ph);
    pillars.lineTo(px + pw / 2, WAY);
    pillars.closePath();
    pillars.fillPath();
    // Wind erosion bands
    for (let b = 0; b < 3; b++) {
      pillars.fillStyle(0x6a5a40, 0.4);
      const by = WAY - ph * (0.2 + b * 0.25);
      pillars.fillEllipse(px, by, pw * 0.6, 4);
    }
  }

  // Ground: sandy stone
  drawGround(scene, 0x7a6a50);
  // Sand drifts
  const sand = scene.add.graphics().setDepth(WAY - 9);
  for (let i = 0; i < 20; i++) {
    sand.fillStyle(0x8a7a60, 0.4);
    sand.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(10, 70),
      Phaser.Math.Between(30, 80), Phaser.Math.Between(8, 20));
  }
  drawGrassContour(scene, [0x7a6a50, 0x8a7a60, 0x9a8a70]);

  drawUnderground(scene, 0x4a3a28, 0x5a4a38);

  // Dust haze
  const dust = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  dust.fillStyle(0x2a2018, 0.05);
  dust.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGE 17: BOULDER CHOKE (Stone March)
// ============================================================================
export function buildStage17(scene: Phaser.Scene): void {
  drawSky(scene, 0x6a6a68, 0x8a8878);

  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x4a4a3a, WAY, 120, 280, 70, 2400);

  // Steep incline background
  const incline = scene.add.graphics().setScrollFactor(0.25, 0).setDepth(-185);
  incline.fillStyle(0x5a5a48, 1);
  incline.beginPath(); incline.moveTo(-200, WAY);
  incline.lineTo(200, 80); incline.lineTo(2200, 80); incline.lineTo(2600, WAY);
  incline.closePath(); incline.fillPath();

  drawGround(scene, 0x6a6a58);
  drawGrassContour(scene, [0x6a7a5a, 0x7a8a6a, 0x7a9a6a]);

  // Large boulders as obstacles
  const boulders = scene.add.graphics().setDepth(WAY - 5);
  for (const bx of [1000, 2200, 3500, 4800, 6200]) {
    const bw = Phaser.Math.Between(40, 70);
    const bh = Phaser.Math.Between(25, 45);
    boulders.fillStyle(0x6a6a58, 0.9);
    boulders.beginPath();
    for (let p = 0; p <= 7; p++) {
      const a = (p / 7) * Math.PI * 2;
      boulders.lineTo(bx + Math.cos(a) * bw * (0.5 + Math.random() * 0.5),
        WAY - bh * 0.3 + Math.sin(a) * bh * (0.5 + Math.random() * 0.5));
    }
    boulders.closePath();
    boulders.fillPath();
    boulders.lineStyle(1.5, 0x4a4a3a, 0.5);
    boulders.strokePath();
    // Crack lines
    boulders.lineStyle(0.8, 0x3a3a2a, 0.4);
    boulders.lineBetween(bx - bw * 0.2, WAY - bh * 0.3, bx + bw * 0.1, WAY - bh * 0.6);
  }

  // Rock alcoves (indentations in cliff wall) — visual safe zones
  const alcoves = scene.add.graphics().setDepth(WAY - 6);
  for (const ax of [1600, 3000, 5400]) {
    alcoves.fillStyle(0x4a4a3a, 0.6);
    alcoves.fillEllipse(ax, WAY - 20, 50, 25);
    alcoves.lineStyle(1.5, 0x3a3a2a, 0.4);
    alcoves.beginPath();
    for (let p = 0; p <= 8; p++) {
      const a = Math.PI + (p / 8) * Math.PI;
      alcoves.lineTo(ax + Math.cos(a) * 25, WAY - 20 + Math.sin(a) * 12);
    }
    alcoves.strokePath();
  }

  drawUnderground(scene, 0x3a3a30, 0x4a4a3a);
}

// ============================================================================
// STAGE 18: DRUMFIRE PASS (Stone March)
// ============================================================================
export function buildStage18(scene: Phaser.Scene): void {
  drawSky(scene, 0x5a5a58, 0x7a7a68);

  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x4a4a3a, WAY, 100, 250, 65, 2400);

  // Stone watchtowers in background
  const towers = scene.add.graphics().setScrollFactor(0.3, 0).setDepth(-180);
  for (const tx of [400, 1200, 2000]) {
    towers.fillStyle(0x5a5a4a, 0.9);
    towers.fillRect(tx - 15, WAY - 120, 30, 120);
    towers.fillStyle(0x6a6a5a, 0.8);
    towers.fillRect(tx - 20, WAY - 130, 40, 12);
    // Battlements
    for (let b = 0; b < 3; b++) {
      towers.fillRect(tx - 18 + b * 14, WAY - 140, 8, 10);
    }
  }

  drawGround(scene, 0x6a6a58);
  drawGrassContour(scene, [0x6a7a58, 0x7a8a68, 0x8a9a78]);

  // Drum platforms
  const drums = scene.add.graphics().setDepth(WAY - 4);
  for (const dx of [1500, 3500, 5500]) {
    // Platform
    drums.fillStyle(0x5a5a48, 0.9);
    drums.fillRect(dx - 20, WAY - 12, 40, 12);
    // Drum
    drums.fillStyle(0x6a4020, 0.9);
    drums.fillEllipse(dx, WAY - 18, 18, 12);
    drums.lineStyle(1.5, 0x4a2a10, 0.5);
    drums.strokeEllipse(dx, WAY - 18, 18, 12);
    // Drum sticks
    drums.lineStyle(1.5, 0x6a5030, 0.7);
    drums.lineBetween(dx - 12, WAY - 25, dx - 6, WAY - 15);
    drums.lineBetween(dx + 12, WAY - 25, dx + 6, WAY - 15);
  }

  drawUnderground(scene, 0x3a3a30, 0x4a4a3a);
}

// ============================================================================
// STAGE 19: THE GRANITE THRONE (Stone March Boss)
// ============================================================================
export function buildStage19(scene: Phaser.Scene): void {
  drawSky(scene, 0x5a5a5a, 0x7a7a6a);

  const sil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x3a3a30, WAY, 140, 300, 80, 2400);

  // Massive cliff backdrop
  const cliff = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(-190);
  cliff.fillStyle(0x5a5a48, 1);
  cliff.fillRect(-200, 40, 2800, WAY - 40);
  // Carved face in cliff (boss arena ~4000)
  cliff.fillStyle(0x4a4a3a, 0.6);
  cliff.fillEllipse(1200, 180, 80, 60);
  cliff.fillStyle(0x3a3a2a, 0.5);
  cliff.fillCircle(1185, 170, 8);
  cliff.fillCircle(1215, 170, 8);

  drawGround(scene, 0x6a6a58);
  drawGrassContour(scene, [0x6a7a58, 0x7a8a68, 0x8a9a78]);

  // Granite throne at ~4000
  const throne = scene.add.graphics().setDepth(WAY - 5);
  throne.fillStyle(0x6a6a5a, 0.95);
  throne.fillRect(3950, WAY - 50, 100, 50); // seat
  throne.fillRect(3960, WAY - 80, 15, 30); // left armrest back
  throne.fillRect(4025, WAY - 80, 15, 30); // right armrest
  throne.fillRect(3975, WAY - 100, 50, 20); // back
  // Crown detail
  throne.fillStyle(0x7a7a6a, 0.8);
  for (let c = 0; c < 3; c++) {
    throne.fillTriangle(3980 + c * 16, WAY - 100, 3988 + c * 16, WAY - 112, 3996 + c * 16, WAY - 100);
  }

  drawUnderground(scene, 0x3a3a30, 0x4a4a3a);
  const tint = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  tint.fillStyle(0x0a0a08, 0.04);
  tint.fillRect(0, 0, 1280, 720);
}

const STAGE_BUILDERS: Record<number, (scene: Phaser.Scene) => void> = {
  2: buildStage2, 3: buildStage3, 4: buildStage4,
  5: buildStage5, 6: buildStage6, 7: buildStage7, 8: buildStage8,
  9: buildStage9, 10: buildStage10, 11: buildStage11,
  12: buildStage12, 13: buildStage13, 14: buildStage14,
  15: buildStage15, 16: buildStage16, 17: buildStage17, 18: buildStage18, 19: buildStage19,
  20: buildStage20, 21: buildStage21, 22: buildStage22, 23: buildStage23,
  24: buildStage24, 25: buildStage25, 26: buildStage26, 27: buildStage27, 28: buildStage28,
  29: buildStage29, 30: buildStage30, 31: buildStage31, 32: buildStage32, 33: buildStage33,
  34: buildStage34, 35: buildStage35, 36: buildStage36, 37: buildStage37, 38: buildStage38,
  39: buildStage39, 40: buildStage40, 41: buildStage41, 42: buildStage42,
  43: buildStage43, 44: buildStage44, 45: buildStage45, 46: buildStage46,
  47: buildStage47, 48: buildStage48, 49: buildStage49, 50: buildStage50,
};

// ============================================================================
// STAGES 39-42: RUINED CIVILIZATION
// ============================================================================

export function buildStage39(scene: Phaser.Scene): void {
  // The Silent Archive — crumbling ancient library, overgrown pillars.
  drawSky(scene, 0x5a5040, 0x7a6a50);
  // Ruined buildings silhouette
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  for (let i = 0; i < 12; i++) {
    const bx = Phaser.Math.Between(0, 2200);
    const bw = Phaser.Math.Between(40, 80);
    const bh = Phaser.Math.Between(80, 200);
    sil.fillStyle(0x3a3428, 1); sil.fillRect(bx - bw / 2, WAY - bh, bw, bh);
    // Broken top edge
    for (let t = 0; t < 3; t++) {
      sil.fillRect(bx - bw / 2 + t * (bw / 3), WAY - bh - Phaser.Math.Between(5, 20), bw / 3 - 3, Phaser.Math.Between(5, 20));
    }
  }
  // Overgrown pillars
  const pillars = scene.add.graphics().setDepth(WAY - 6);
  for (const px of [600, 1800, 3200, 4800, 6200]) {
    pillars.fillStyle(0x7a7a68, 0.9);
    pillars.fillRect(px - 8, WAY - Phaser.Math.Between(50, 80), 16, Phaser.Math.Between(50, 80));
    pillars.fillStyle(0x8a8a78, 0.8); pillars.fillRect(px - 12, WAY - Phaser.Math.Between(52, 82), 24, 6);
    // Moss overgrowth
    pillars.fillStyle(0x4a8a3a, 0.4);
    drawLeafBlob(pillars, px, WAY - Phaser.Math.Between(30, 50), 15, 10, 0x4a8a3a, 0.4);
  }
  // Fallen statue chunk at ~3500
  pillars.fillStyle(0x8a8a78, 0.7); pillars.fillEllipse(3500, WAY - 5, 40, 15);
  pillars.fillStyle(0x7a7a68, 0.6); pillars.fillCircle(3510, WAY - 18, 12); // head fragment

  drawGround(scene, 0x5a5a48);
  // Cracked stone with moss
  const cracks = scene.add.graphics().setDepth(WAY - 9);
  for (let i = 0; i < 20; i++) {
    cracks.lineStyle(0.8, 0x3a3a2a, 0.3);
    const cx = Phaser.Math.Between(0, SW);
    const cy = WAY + Phaser.Math.Between(5, 80);
    cracks.lineBetween(cx, cy, cx + Phaser.Math.Between(-20, 20), cy + Phaser.Math.Between(-10, 10));
  }
  for (let i = 0; i < 12; i++) {
    cracks.fillStyle(0x4a8a3a, 0.2);
    cracks.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(10, 70), Phaser.Math.Between(10, 25), Phaser.Math.Between(4, 8));
  }
  drawGrassContour(scene, [0x6a6a50, 0x7a7a60, 0x8a8a70]);
  drawUnderground(scene, 0x3a3a28, 0x4a4a38);
  // Amber dusk tint
  const amber = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  amber.fillStyle(0x201808, 0.04); amber.fillRect(0, 0, 1280, 720);
}

export function buildStage40(scene: Phaser.Scene): void {
  // Crumbling Colonnade — grand avenue of broken columns.
  drawSky(scene, 0x5a5040, 0x7a6848);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  for (let i = 0; i < 8; i++) {
    const bx = i * 300 + Phaser.Math.Between(-30, 30);
    sil.fillStyle(0x3a3428, 1);
    sil.fillRect(bx - 15, WAY - Phaser.Math.Between(100, 220), 30, Phaser.Math.Between(100, 220));
  }
  // Grand colonnade (alternating intact and broken)
  const cols = scene.add.graphics().setDepth(WAY - 6);
  for (let i = 0; i < 15; i++) {
    const cx = i * 520 + 200;
    const intact = Math.random() < 0.4;
    const ch = intact ? Phaser.Math.Between(70, 100) : Phaser.Math.Between(20, 50);
    cols.fillStyle(0x8a8a78, 0.9); cols.fillRect(cx - 10, WAY - ch, 20, ch);
    cols.fillStyle(0x9a9a88, 0.8); cols.fillRect(cx - 14, WAY - ch - 5, 28, 7);
    if (intact) { cols.fillRect(cx - 14, WAY - 3, 28, 5); }
    // Rubble near broken ones
    if (!intact) {
      for (let r = 0; r < 3; r++) {
        cols.fillStyle(0x7a7a68, 0.6);
        cols.fillEllipse(cx + Phaser.Math.Between(-20, 20), WAY - 3, Phaser.Math.Between(5, 12), Phaser.Math.Between(3, 7));
      }
    }
  }
  drawGround(scene, 0x6a6a58);
  drawGrassContour(scene, [0x7a7a60, 0x8a8a70, 0x9a9a80]);
  drawUnderground(scene, 0x3a3a2a, 0x4a4a3a);
}

export function buildStage41(scene: Phaser.Scene): void {
  // The Colossus Gate — massive broken statue guarding ruins entrance.
  drawSky(scene, 0x5a4a3a, 0x7a6a50);
  const sil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x3a3020, WAY, 50, 120, 55, 2400);
  // Giant broken colossus statue at ~4000
  const colossus = scene.add.graphics().setDepth(WAY - 7);
  // Legs (standing)
  colossus.fillStyle(0x7a7a68, 0.9);
  colossus.fillRect(3950, WAY - 100, 25, 100); // left leg
  colossus.fillRect(4025, WAY - 100, 25, 100); // right leg
  // Torso fragment (broken at waist, leaning)
  colossus.fillRect(3940, WAY - 120, 120, 25);
  // Fallen arm on ground
  colossus.fillStyle(0x6a6a58, 0.7);
  colossus.beginPath();
  colossus.moveTo(4100, WAY - 5); colossus.lineTo(4180, WAY - 15);
  colossus.lineTo(4185, WAY - 8); colossus.lineTo(4105, WAY + 2);
  colossus.closePath(); colossus.fillPath();
  // Fallen head
  colossus.fillStyle(0x7a7a68, 0.8); colossus.fillCircle(3880, WAY - 12, 20);
  colossus.fillStyle(0x2a2a22, 0.4); colossus.fillCircle(3875, WAY - 16, 3); colossus.fillCircle(3885, WAY - 16, 3);

  drawGround(scene, 0x5a5a48);
  drawGrassContour(scene, [0x6a6a50, 0x7a7a60, 0x8a8a70]);
  drawUnderground(scene, 0x3a3a28, 0x4a4a38);
}

export function buildStage42(scene: Phaser.Scene): void {
  // Glyph Labyrinth — ruins boss. Glowing glyphs, ancient machinery.
  drawSky(scene, 0x4a4030, 0x6a5a44);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  for (let i = 0; i < 10; i++) {
    sil.fillStyle(0x2a2820, 1);
    sil.fillRect(Phaser.Math.Between(0, 2200) - 20, WAY - Phaser.Math.Between(80, 180), 40, Phaser.Math.Between(80, 180));
  }
  // Glowing glyphs on ground
  const glyphs = scene.add.graphics().setDepth(WAY - 5);
  for (const gx of [800, 1600, 2800, 4000, 5200, 6400]) {
    // Rune circle
    glyphs.lineStyle(1.5, 0x88aa44, 0.3); glyphs.strokeCircle(gx, WAY + 25, 20);
    glyphs.lineStyle(1, 0x88aa44, 0.2); glyphs.strokeCircle(gx, WAY + 25, 12);
    // Inner glyph marks
    for (let m = 0; m < 4; m++) {
      const a = (m / 4) * Math.PI * 2;
      glyphs.lineBetween(gx + Math.cos(a) * 8, WAY + 25 + Math.sin(a) * 8, gx + Math.cos(a) * 18, WAY + 25 + Math.sin(a) * 18);
    }
    // Glow
    glyphs.fillStyle(0x88aa44, 0.05); glyphs.fillCircle(gx, WAY + 25, 25);
  }
  // Ancient machinery at boss arena
  const machine = scene.add.graphics().setDepth(WAY - 6);
  machine.fillStyle(0x5a5a48, 0.9); machine.fillRect(3900, WAY - 60, 200, 60);
  machine.fillStyle(0x6a6a5a, 0.8); machine.fillRect(3920, WAY - 75, 160, 18);
  // Gears (circles)
  machine.lineStyle(2, 0x7a7a6a, 0.6); machine.strokeCircle(3960, WAY - 40, 15);
  machine.strokeCircle(4040, WAY - 40, 12);

  drawGround(scene, 0x4a4a38);
  drawGrassContour(scene, [0x5a5a48, 0x6a6a58, 0x7a7a68]);
  drawUnderground(scene, 0x2a2a20, 0x3a3a30);
  const glow = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  glow.fillStyle(0x181808, 0.04); glow.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGES 43-46: ARCANE EXPANSE
// ============================================================================

export function buildStage43(scene: Phaser.Scene): void {
  // Mana Flats — open arcane plains, floating rune circles, crystal structures.
  drawSky(scene, 0x1a1a3a, 0x2a2a5a);
  // Energy streams in background
  const streams = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-198);
  for (let i = 0; i < 8; i++) {
    streams.lineStyle(2, [0x6644aa, 0x4466aa, 0x8866cc][i % 3], 0.15);
    streams.beginPath();
    const sy = Phaser.Math.Between(80, 300);
    streams.moveTo(0, sy);
    for (let px = 0; px <= 2200; px += 30) { streams.lineTo(px, sy + Math.sin(px * 0.008 + i) * 20); }
    streams.strokePath();
  }
  // Crystal structures
  const crystals = scene.add.graphics().setDepth(WAY - 6);
  for (const cx of [700, 2200, 3800, 5400, 7000]) {
    const ch = Phaser.Math.Between(30, 60);
    crystals.fillStyle(0x6644aa, 0.6);
    crystals.fillTriangle(cx - 8, WAY, cx, WAY - ch, cx + 8, WAY);
    crystals.fillStyle(0x8866cc, 0.3);
    crystals.fillTriangle(cx - 4, WAY, cx + 2, WAY - ch * 0.7, cx + 6, WAY);
    // Glow
    crystals.fillStyle(0x8866cc, 0.06); crystals.fillCircle(cx, WAY - ch * 0.4, ch * 0.6);
  }
  // Floating rune circles (animated rotation)
  for (const rx of [1200, 3200, 5200]) {
    const rune = scene.add.graphics().setDepth(WAY - 3);
    rune.lineStyle(1.5, 0x8866cc, 0.3); rune.strokeCircle(rx, WAY - 40, 18);
    rune.lineStyle(1, 0x8866cc, 0.2); rune.strokeCircle(rx, WAY - 40, 10);
    const runeGlow = scene.add.circle(rx, WAY - 40, 20, 0x8866cc, 0.04).setDepth(WAY - 2);
    scene.tweens.add({ targets: runeGlow, alpha: { from: 0.04, to: 0.12 }, duration: 2000, yoyo: true, repeat: -1 });
  }
  // Ground: dark polished stone with glowing rune lines
  drawGround(scene, 0x1a1a2a);
  const runeLines = scene.add.graphics().setDepth(WAY - 9);
  for (let i = 0; i < 10; i++) {
    runeLines.lineStyle(1, 0x6644aa, 0.12);
    const ry = WAY + Phaser.Math.Between(10, 80);
    runeLines.lineBetween(Phaser.Math.Between(0, SW), ry, Phaser.Math.Between(0, SW), ry + Phaser.Math.Between(-5, 5));
  }
  drawGrassContour(scene, [0x2a2a3a, 0x3a3a4a, 0x3a3a5a]);
  drawUnderground(scene, 0x10101a, 0x1a1a2a);
  const tint = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  tint.fillStyle(0x0a0a1a, 0.05); tint.fillRect(0, 0, 1280, 720);
}

export function buildStage44(scene: Phaser.Scene): void {
  // Rift Corridor — reality tears, floating debris, unstable ground.
  drawSky(scene, 0x1a1a38, 0x2a2050);
  // Reality rift tears
  const rifts = scene.add.graphics().setDepth(WAY - 7);
  for (const rx of [1000, 2500, 4000, 5500, 7000]) {
    rifts.lineStyle(3, 0xaa44ff, 0.2);
    rifts.beginPath(); rifts.moveTo(rx, 50);
    for (let py = 50; py < WAY - 20; py += 20) {
      rifts.lineTo(rx + Phaser.Math.Between(-8, 8), py);
    }
    rifts.strokePath();
    rifts.fillStyle(0xaa44ff, 0.04); rifts.fillEllipse(rx, (WAY) / 2, 20, WAY * 0.4);
  }
  // Floating rock debris
  for (let i = 0; i < 8; i++) {
    const dx = Phaser.Math.Between(200, 1100);
    const dy = Phaser.Math.Between(100, 300);
    const rock = scene.add.rectangle(dx, dy, Phaser.Math.Between(8, 18), Phaser.Math.Between(6, 12), 0x4a4a5a, 0.5)
      .setScrollFactor(0.3, 0).setDepth(-180);
    scene.tweens.add({ targets: rock, y: dy + Phaser.Math.Between(-10, 10), duration: 3000 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  drawGround(scene, 0x1e1e30);
  drawGrassContour(scene, [0x2a2a3e, 0x3a3a4e, 0x3a3a5a]);
  drawUnderground(scene, 0x101020, 0x1a1a2a);
}

export function buildStage45(scene: Phaser.Scene): void {
  // Gravity Nexus — warped gravity zones, floating platforms hint.
  drawSky(scene, 0x181830, 0x282848);
  const sil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  // Floating island silhouettes
  for (let i = 0; i < 6; i++) {
    const ix = Phaser.Math.Between(0, 2000);
    const iy = Phaser.Math.Between(60, 200);
    sil.fillStyle(0x2a2a3a, 0.7);
    sil.beginPath();
    for (let p = 0; p <= 8; p++) {
      const a = (p / 8) * Math.PI * 2;
      sil.lineTo(ix + Math.cos(a) * Phaser.Math.Between(20, 40), iy + Math.sin(a) * Phaser.Math.Between(8, 15));
    }
    sil.closePath(); sil.fillPath();
  }
  // Gravity distortion fields
  const grav = scene.add.graphics().setDepth(WAY - 4);
  for (const gx of [1500, 3500, 5500]) {
    grav.lineStyle(1, 0x6644aa, 0.15);
    for (let r = 10; r < 40; r += 8) { grav.strokeCircle(gx, WAY + 20, r); }
    grav.fillStyle(0x6644aa, 0.04); grav.fillCircle(gx, WAY + 20, 40);
  }
  drawGround(scene, 0x1a1a2e);
  drawGrassContour(scene, [0x2a2a3a, 0x3a3a4a, 0x3a3a4a]);
  drawUnderground(scene, 0x10101e, 0x1a1a28);
}

export function buildStage46(scene: Phaser.Scene): void {
  // The Leyline Convergence — arcane boss. Massive energy vortex.
  drawSky(scene, 0x141430, 0x222248);
  // Energy vortex at boss arena
  const vortex = scene.add.graphics().setDepth(WAY - 7);
  for (let r = 0; r < 6; r++) {
    vortex.lineStyle(2, [0x6644aa, 0x8866cc, 0x4466aa][r % 3], 0.1 + r * 0.02);
    vortex.strokeCircle(4000, WAY - 50, 30 + r * 20);
  }
  vortex.fillStyle(0x8866cc, 0.06); vortex.fillCircle(4000, WAY - 50, 60);
  // Energy pillars
  for (const px of [3800, 3900, 4100, 4200]) {
    vortex.fillStyle(0x6644aa, 0.4);
    vortex.fillRect(px - 4, WAY - 80, 8, 80);
    vortex.fillStyle(0x8866cc, 0.08); vortex.fillCircle(px, WAY - 80, 12);
  }
  // Scattered crystal formations
  for (const cx of [600, 1800, 3000, 5200, 6600]) {
    vortex.fillStyle(0x6644aa, 0.5);
    vortex.fillTriangle(cx - 5, WAY, cx, WAY - Phaser.Math.Between(20, 40), cx + 5, WAY);
  }
  drawGround(scene, 0x181828);
  drawGrassContour(scene, [0x2a2a3a, 0x3a3a4a, 0x3a3a5a]);
  drawUnderground(scene, 0x0e0e1a, 0x1a1a28);
  const glow = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  glow.fillStyle(0x0a0a1a, 0.06); glow.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGES 47-50: DARK SOVEREIGN DOMAIN
// ============================================================================

export function buildStage47(scene: Phaser.Scene): void {
  // Obsidian Threshold — dark fortress entrance, red sky, chains.
  drawSky(scene, 0x1a0808, 0x2a1414);
  // Obsidian fortress silhouette
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  for (let i = 0; i < 8; i++) {
    const fx = i * 280 + Phaser.Math.Between(-20, 20);
    const fh = Phaser.Math.Between(120, 250);
    sil.fillStyle(0x0a0808, 1); sil.fillRect(fx - 20, WAY - fh, 40, fh);
    // Pointed top
    sil.fillTriangle(fx - 25, WAY - fh, fx, WAY - fh - 20, fx + 25, WAY - fh);
  }
  // Hanging chains
  const chains = scene.add.graphics().setDepth(WAY - 6);
  for (const cx of [400, 1200, 2400, 3800, 5400, 6800]) {
    for (let link = 0; link < Phaser.Math.Between(6, 12); link++) {
      chains.lineStyle(1.5, 0x4a4a4a, 0.4);
      chains.strokeEllipse(cx + Math.sin(link * 0.7) * 3, link * 12 + 80, 4, 6);
    }
  }
  // Lava crack seams in ground
  const lava = scene.add.graphics().setDepth(WAY - 8);
  for (let i = 0; i < 15; i++) {
    lava.lineStyle(Phaser.Math.FloatBetween(1, 2.5), 0xcc4422, 0.25);
    const lx = Phaser.Math.Between(0, SW);
    const ly = WAY + Phaser.Math.Between(5, 80);
    lava.beginPath(); lava.moveTo(lx, ly);
    for (let s = 0; s < 4; s++) { lava.lineTo(lx + Phaser.Math.Between(-15, 15), ly + s * 8); }
    lava.strokePath();
  }
  drawGround(scene, 0x1a1214);
  drawGrassContour(scene, [0x2a1a1a, 0x3a2222, 0x3a2a2a]);
  drawUnderground(scene, 0x0e0808, 0x1a1010);
  const red = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  red.fillStyle(0x1a0404, 0.06); red.fillRect(0, 0, 1280, 720);
}

export function buildStage48(scene: Phaser.Scene): void {
  // The Blood Corridor — red-lit halls, blood pools, dark magic.
  drawSky(scene, 0x180808, 0x281212);
  const walls = scene.add.graphics().setScrollFactor(0.12, 0).setDepth(-196);
  walls.fillStyle(0x1a1012, 1); walls.fillRect(-200, 0, 2800, WAY);
  // Blood-red torches
  const torches = scene.add.graphics().setDepth(WAY - 5);
  for (const tx of [500, 1500, 2500, 3500, 4500, 5500, 6500]) {
    torches.fillStyle(0x3a3030, 0.9); torches.fillRect(tx - 2, WAY - 45, 4, 20);
    const flame = scene.add.circle(tx, WAY - 50, 4, 0xcc2222, 0.45).setDepth(WAY - 4);
    scene.tweens.add({ targets: flame, alpha: { from: 0.45, to: 0.15 }, duration: 500, yoyo: true, repeat: -1 });
  }
  // Blood pools on ground
  const blood = scene.add.graphics().setDepth(WAY - 8);
  for (const bx of [800, 2200, 4000, 5800]) {
    blood.fillStyle(0x6a1818, 0.35);
    blood.fillEllipse(bx, WAY + Phaser.Math.Between(15, 40), Phaser.Math.Between(40, 80), Phaser.Math.Between(10, 20));
  }
  drawGround(scene, 0x1a1014);
  drawGrassContour(scene, [0x2a1818, 0x3a2020, 0x3a2828]);
  drawUnderground(scene, 0x0e0808, 0x181010);
}

export function buildStage49(scene: Phaser.Scene): void {
  // Chain Sanctum — penultimate stage, chains everywhere, dark altars.
  drawSky(scene, 0x140808, 0x221010);
  const walls = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-197);
  walls.fillStyle(0x140e10, 1); walls.fillRect(-200, 0, 2800, WAY);
  // Massive chains X-crossing the background
  const chains = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(-195);
  for (let i = 0; i < 4; i++) {
    chains.lineStyle(4, 0x3a3a3a, 0.3);
    chains.lineBetween(i * 600, 0, i * 600 + 400, WAY);
    chains.lineBetween(i * 600 + 400, 0, i * 600, WAY);
  }
  // Dark altars
  const altars = scene.add.graphics().setDepth(WAY - 5);
  for (const ax of [1500, 4000, 6500]) {
    altars.fillStyle(0x2a1a1a, 0.9); altars.fillRect(ax - 25, WAY - 25, 50, 25);
    altars.fillStyle(0x3a2020, 0.8); altars.fillRect(ax - 30, WAY - 28, 60, 5);
    // Dark flame
    const darkFlame = scene.add.circle(ax, WAY - 35, 6, 0x8822aa, 0.35).setDepth(WAY - 4);
    scene.tweens.add({ targets: darkFlame, alpha: { from: 0.35, to: 0.1 }, scaleY: { from: 1, to: 1.5 }, duration: 600, yoyo: true, repeat: -1 });
  }
  drawGround(scene, 0x161010);
  drawGrassContour(scene, [0x2a1818, 0x3a2020, 0x3a2020]);
  drawUnderground(scene, 0x0a0606, 0x140e0e);
}

export function buildStage50(scene: Phaser.Scene): void {
  // The Dark Sovereign's Throne — FINAL BOSS. Grand dark throne room.
  drawSky(scene, 0x0e0404, 0x1a0a0a);
  // Grand dark hall
  const walls = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-197);
  walls.fillStyle(0x100a0c, 1); walls.fillRect(-200, 0, 2800, WAY);
  // Massive pillars
  for (let i = 0; i < 6; i++) {
    const px = i * 400 + 200;
    walls.fillStyle(0x1a1418, 0.9); walls.fillRect(px - 15, 20, 30, WAY - 20);
    walls.fillStyle(0x221a20, 0.8); walls.fillRect(px - 20, 10, 40, 12);
  }
  // THE THRONE at ~4000
  const throne = scene.add.graphics().setDepth(WAY - 6);
  // Grand steps
  throne.fillStyle(0x1a1218, 0.95);
  throne.fillRect(3850, WAY - 15, 300, 15);
  throne.fillRect(3870, WAY - 30, 260, 15);
  throne.fillRect(3890, WAY - 45, 220, 15);
  // Throne seat
  throne.fillStyle(0x221820, 0.95); throne.fillRect(3930, WAY - 80, 140, 35);
  // Throne back (tall, imposing)
  throne.fillRect(3950, WAY - 140, 100, 60);
  // Crown spires
  for (let c = 0; c < 5; c++) {
    throne.fillTriangle(3955 + c * 20, WAY - 140, 3965 + c * 20, WAY - 160, 3975 + c * 20, WAY - 140);
  }
  // Red accents
  throne.fillStyle(0x8a1818, 0.5); throne.fillRect(3935, WAY - 75, 130, 5);
  throne.fillStyle(0x6a1414, 0.4); throne.fillRect(3960, WAY - 130, 80, 3);

  // Hellfire braziers flanking throne
  for (const bx of [3800, 4200]) {
    throne.fillStyle(0x1a1218, 0.9); throne.fillRect(bx - 8, WAY - 50, 16, 50);
    throne.fillStyle(0x221820, 0.8); throne.fillRect(bx - 12, WAY - 55, 24, 8);
    const fire = scene.add.circle(bx, WAY - 60, 8, 0xcc2222, 0.5).setDepth(WAY - 5);
    scene.tweens.add({ targets: fire, alpha: { from: 0.5, to: 0.15 }, scaleY: { from: 1, to: 1.5 }, duration: 400, yoyo: true, repeat: -1 });
  }

  // Lava cracks across the floor
  const lava = scene.add.graphics().setDepth(WAY - 9);
  for (let i = 0; i < 20; i++) {
    lava.lineStyle(Phaser.Math.FloatBetween(1, 3), 0xcc4422, 0.2);
    const lx = Phaser.Math.Between(0, SW);
    lava.beginPath(); lava.moveTo(lx, WAY + 5);
    for (let s = 0; s < 5; s++) { lava.lineTo(lx + Phaser.Math.Between(-20, 20), WAY + 5 + s * 15); }
    lava.strokePath();
  }

  drawGround(scene, 0x120a0e);
  drawGrassContour(scene, [0x1a1014, 0x2a181c, 0x2a181c]);
  drawUnderground(scene, 0x080404, 0x100a0a);

  // Hellish red glow overlay
  const hell = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  hell.fillStyle(0x1a0404, 0.07); hell.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGES 29-33: MIRELANDS
// ============================================================================

export function buildStage29(scene: Phaser.Scene): void {
  // Fetid Shallows — swamp edge, murky water, dead trees.
  drawSky(scene, 0x2a3028, 0x3a4a34);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x1a2a1e, WAY, 30, 70, 45, 2400);
  // Dead tree silhouettes
  for (let i = 0; i < 15; i++) {
    const x = Phaser.Math.Between(0, 2200);
    sil.fillStyle(0x1a2018, 1);
    sil.fillRect(x - 3, WAY - Phaser.Math.Between(60, 120), 6, Phaser.Math.Between(60, 120));
    // Dead branches
    for (let b = 0; b < 2; b++) {
      sil.lineStyle(2, 0x1a2018, 0.8);
      const by = WAY - Phaser.Math.Between(40, 100);
      sil.lineBetween(x, by, x + Phaser.Math.Between(-20, 20), by - Phaser.Math.Between(10, 25));
    }
  }
  // Murky water patches
  const water = scene.add.graphics().setDepth(WAY - 8);
  for (const wx of [800, 2200, 3600, 5200, 6800]) {
    water.fillStyle(0x2a4a3a, 0.5);
    water.fillEllipse(wx, WAY + 30, Phaser.Math.Between(80, 160), Phaser.Math.Between(15, 30));
    // Ripples
    water.lineStyle(0.5, 0x4a6a5a, 0.3);
    water.strokeEllipse(wx, WAY + 30, Phaser.Math.Between(30, 60), Phaser.Math.Between(5, 10));
  }
  drawGround(scene, 0x3a4a2a);
  drawGrassContour(scene, [0x3a5a2a, 0x4a6a3a, 0x4a7a3a]);
  drawUnderground(scene, 0x1a2a18, 0x2a3a24);
  // Green fog
  const fog = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  fog.fillStyle(0x1a2a18, 0.06); fog.fillRect(0, 0, 1280, 720);
}

export function buildStage30(scene: Phaser.Scene): void {
  // Bogwater Crossing — bridge over swamp, lily pads, thick fog.
  drawSky(scene, 0x283028, 0x384838);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x1e281e, WAY, 20, 50, 40, 2400);
  // Bridge structure at ~3000-3500
  const bridge = scene.add.graphics().setDepth(WAY - 7);
  bridge.fillStyle(0x5a4020, 0.9);
  bridge.fillRect(2900, WAY - 8, 600, 8);
  // Bridge posts
  for (const px of [2920, 3100, 3300, 3480]) {
    bridge.fillRect(px - 3, WAY - 8, 6, 20);
  }
  // Rope railings
  bridge.lineStyle(2, 0x7a6a4a, 0.5);
  bridge.beginPath(); bridge.moveTo(2920, WAY - 20);
  for (let px = 2920; px <= 3480; px += 40) {
    bridge.lineTo(px, WAY - 18 + Math.sin(px * 0.02) * 3);
  }
  bridge.strokePath();
  // Lily pads
  for (let i = 0; i < 15; i++) {
    const lx = Phaser.Math.Between(0, SW);
    if (lx > 2850 && lx < 3550) continue;
    bridge.fillStyle(0x3a7a3a, 0.6);
    bridge.fillEllipse(lx, WAY + Phaser.Math.Between(15, 45), Phaser.Math.Between(8, 16), Phaser.Math.Between(4, 8));
  }
  drawGround(scene, 0x3a4a2a);
  drawGrassContour(scene, [0x3a5a2a, 0x4a6a3a, 0x4a7a3a]);
  drawUnderground(scene, 0x1a2a18, 0x2a3a24);
  const fog = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  fog.fillStyle(0x1a2a18, 0.07); fog.fillRect(0, 200, 1280, 520);
}

export function buildStage31(scene: Phaser.Scene): void {
  // Rot Hollow — deep swamp, rotting vegetation, vine tangles.
  drawSky(scene, 0x1e2820, 0x2a3a28);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  sil.fillStyle(0x142018, 1); sil.fillRect(-200, 60, 2600, WAY - 60);
  // Gnarled dead trees mid-distance
  for (let i = 0; i < 10; i++) {
    const x = i * 250 + Phaser.Math.Between(-30, 30);
    const t = scene.add.graphics().setScrollFactor(0.35, 0).setDepth(-180);
    drawTrunk(t, x, Phaser.Math.Between(12, 22), Phaser.Math.Between(80, 160), WAY, 0x2a2418, 0x14120a);
    // Twisted dead branches
    for (let b = 0; b < 3; b++) {
      t.lineStyle(1.5, 0x2a2418, 0.6);
      const by = WAY - Phaser.Math.Between(50, 130);
      t.lineBetween(x, by, x + Phaser.Math.Between(-25, 25), by - Phaser.Math.Between(10, 30));
    }
  }
  // Vine tangles
  const vines = scene.add.graphics().setDepth(WAY - 4);
  for (const vx of [500, 1500, 3000, 4500, 6000]) {
    for (let v = 0; v < 3; v++) {
      vines.lineStyle(1.5, 0x2a4a1a, 0.4);
      vines.beginPath(); vines.moveTo(vx + v * 8, WAY - 5);
      for (let s = 0; s < 4; s++) {
        vines.lineTo(vx + v * 8 + Math.sin(s * 1.5) * 10, WAY - 5 - s * 15);
      }
      vines.strokePath();
    }
  }
  drawGround(scene, 0x2a3a20);
  drawGrassContour(scene, [0x2a4a1a, 0x3a5a2a, 0x3a6a2a]);
  drawUnderground(scene, 0x1a2214, 0x2a3220);
}

export function buildStage32(scene: Phaser.Scene): void {
  // The Sunken Altar — submerged ruins in swamp, ancient stone.
  drawSky(scene, 0x202a22, 0x2a3a2a);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x1a2418, WAY, 25, 55, 40, 2400);
  // Submerged stone pillars
  const stones = scene.add.graphics().setDepth(WAY - 6);
  for (const sx of [800, 1600, 2800, 4200, 5600, 6800]) {
    const sw = Phaser.Math.Between(12, 20);
    const sh = Phaser.Math.Between(25, 50);
    stones.fillStyle(0x5a5a4a, 0.7); stones.fillRect(sx - sw / 2, WAY - sh, sw, sh);
    // Moss on stone
    stones.fillStyle(0x3a6a2a, 0.4); stones.fillEllipse(sx, WAY - sh, sw * 0.8, 6);
    // Partially submerged
    stones.fillStyle(0x2a4a3a, 0.3); stones.fillRect(sx - sw / 2 - 2, WAY - 5, sw + 4, 8);
  }
  // Altar at ~4000
  stones.fillStyle(0x5a5a48, 0.9); stones.fillRect(3960, WAY - 20, 80, 20);
  stones.fillRect(3975, WAY - 35, 50, 15);
  // Rune glow on altar
  stones.fillStyle(0x44aa66, 0.2); stones.fillEllipse(4000, WAY - 25, 40, 8);
  drawGround(scene, 0x2a3a22);
  drawGrassContour(scene, [0x2a4a1a, 0x3a5a2a, 0x3a6a2a]);
  drawUnderground(scene, 0x1a2416, 0x2a3422);
}

export function buildStage33(scene: Phaser.Scene): void {
  // The Stranglemarsh — swamp boss. Dense, oppressive, massive gnarled tree.
  drawSky(scene, 0x182218, 0x243024);
  const sil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  sil.fillStyle(0x101a10, 1); sil.fillRect(-200, 40, 2600, WAY - 40);
  // Massive gnarled boss tree at ~4000
  const bossTree = scene.add.graphics().setDepth(WAY - 7);
  drawTrunk(bossTree, 4000, 100, -30, WAY, 0x2a2014, 0x141008);
  // Gnarled roots everywhere
  for (let r = 0; r < 10; r++) {
    const side = r % 2 === 0 ? -1 : 1;
    bossTree.lineStyle(Phaser.Math.Between(3, 6), 0x2a2014, 0.7);
    bossTree.beginPath(); bossTree.moveTo(4000 + side * 40, WAY);
    bossTree.lineTo(4000 + side * Phaser.Math.Between(80, 200), WAY + Phaser.Math.Between(-5, 10));
    bossTree.strokePath();
  }
  // Toxic mist
  for (let i = 0; i < 8; i++) {
    const mx = Phaser.Math.Between(0, 1280);
    const mist = scene.add.circle(mx, Phaser.Math.Between(250, WAY - 20), Phaser.Math.Between(20, 50), 0x4a8a3a, 0.06)
      .setScrollFactor(0.3 + Math.random() * 0.4, 0).setDepth(WAY - 2);
    scene.tweens.add({ targets: mist, x: mx + Phaser.Math.Between(-40, 40), alpha: { from: 0.06, to: 0.02 }, duration: 5000 + i * 1000, yoyo: true, repeat: -1 });
  }
  drawGround(scene, 0x223018);
  drawGrassContour(scene, [0x2a4a1a, 0x3a5a2a, 0x3a5a2a]);
  drawUnderground(scene, 0x141e10, 0x1e2a18);
  const fog = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  fog.fillStyle(0x1a2a14, 0.07); fog.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGES 34-38: HIGHLAND WILDS
// ============================================================================

export function buildStage34(scene: Phaser.Scene): void {
  // Frostbite Ridge — snow begins, rocky terrain, cold blue light.
  drawSky(scene, 0x6a7a8a, 0x8a9aaa);
  const sil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x5a6a7a, WAY, 100, 250, 70, 2400);
  const sil2 = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(-197);
  drawMountainSilhouette(sil2, 0x6a7a8a, WAY, 60, 150, 55, 2800);
  // Snow-capped peaks
  const snow = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-198);
  for (let i = 0; i < 10; i++) {
    const px = Phaser.Math.Between(0, 2200);
    const ph = Phaser.Math.Between(120, 200);
    snow.fillStyle(0xddddee, 0.5);
    snow.fillTriangle(px - 15, WAY - ph + 20, px, WAY - ph, px + 15, WAY - ph + 20);
  }
  // Ground: snow over rock
  drawGround(scene, 0x8a8a80);
  const snowG = scene.add.graphics().setDepth(WAY - 9);
  for (let i = 0; i < 30; i++) {
    snowG.fillStyle(0xccccdd, 0.3);
    snowG.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(5, 70),
      Phaser.Math.Between(20, 60), Phaser.Math.Between(8, 18));
  }
  drawGrassContour(scene, [0x8a9a8a, 0x9aaa9a, 0xaabbaa]);
  // Wind streaks
  const wind = scene.add.graphics().setDepth(WAY - 3);
  for (let i = 0; i < 10; i++) {
    wind.lineStyle(0.5, 0xccccdd, 0.2);
    const wy = Phaser.Math.Between(100, WAY - 30);
    wind.lineBetween(Phaser.Math.Between(0, SW), wy, Phaser.Math.Between(0, SW) + 80, wy + Phaser.Math.Between(-3, 3));
  }
  drawUnderground(scene, 0x4a4a44, 0x5a5a50);
  const blue = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  blue.fillStyle(0x0a1020, 0.04); blue.fillRect(0, 0, 1280, 720);
}

export function buildStage35(scene: Phaser.Scene): void {
  // Windswept Plateau — open high ground, strong winds, sparse vegetation.
  drawSky(scene, 0x7a8a9a, 0x9aaabc);
  const sil = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x6a7888, WAY, 80, 180, 65, 2400);
  // Windswept dead bushes
  const bushes = scene.add.graphics().setDepth(WAY - 4);
  for (const bx of [500, 1400, 2600, 3800, 5200, 6400]) {
    for (let b = 0; b < 3; b++) {
      bushes.lineStyle(1, 0x5a4a30, 0.6);
      bushes.lineBetween(bx + b * 5, WAY - 3, bx + b * 5 + Phaser.Math.Between(-10, 10), WAY - Phaser.Math.Between(8, 18));
    }
  }
  drawGround(scene, 0x7a7a70);
  // Snow patches
  const snowP = scene.add.graphics().setDepth(WAY - 9);
  for (let i = 0; i < 20; i++) {
    snowP.fillStyle(0xbbbbcc, 0.35);
    snowP.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(10, 60),
      Phaser.Math.Between(30, 70), Phaser.Math.Between(8, 18));
  }
  drawGrassContour(scene, [0x7a8a7a, 0x8a9a8a, 0x9aaa9a]);
  drawUnderground(scene, 0x4a4a40, 0x5a5a4a);
}

export function buildStage36(scene: Phaser.Scene): void {
  // Avalanche Run — narrow mountain pass, ice walls, danger of rockfall.
  drawSky(scene, 0x6a7a8a, 0x8a98a8);
  // Tight canyon walls
  const walls = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(-195);
  walls.fillStyle(0x6a7080, 1);
  walls.beginPath(); walls.moveTo(-200, 0);
  let wx = -200;
  while (wx < 2800) { walls.lineTo(wx, Phaser.Math.Between(80, 180)); wx += Phaser.Math.Between(25, 50); }
  walls.lineTo(2800, WAY); walls.lineTo(-200, WAY); walls.closePath(); walls.fillPath();
  // Ice sheets on walls
  walls.fillStyle(0x8aaacc, 0.3);
  for (let i = 0; i < 8; i++) {
    walls.fillEllipse(Phaser.Math.Between(0, 2400), Phaser.Math.Between(100, 300), 30, 50);
  }
  // Icicles
  const icicles = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(-194);
  for (let i = 0; i < 15; i++) {
    const ix = Phaser.Math.Between(0, 2400);
    icicles.fillStyle(0xaaccee, 0.5);
    icicles.fillTriangle(ix - 2, Phaser.Math.Between(70, 120), ix, Phaser.Math.Between(100, 170), ix + 2, Phaser.Math.Between(70, 120));
  }
  drawGround(scene, 0x7a7a70);
  drawGrassContour(scene, [0x8a8a80, 0x9a9a90, 0xaaaaaa]);
  drawUnderground(scene, 0x4a4a44, 0x5a5a50);
}

export function buildStage37(scene: Phaser.Scene): void {
  // Gale Summit — highest point, aurora hints in sky, storm totems.
  drawSky(scene, 0x3a4a6a, 0x5a6a8a);
  // Aurora streaks
  const aurora = scene.add.graphics().setScrollFactor(0, 0).setDepth(-199);
  for (let i = 0; i < 5; i++) {
    aurora.lineStyle(3, [0x44aa88, 0x88aadd, 0x66ccaa][i % 3], 0.08);
    aurora.beginPath();
    const ay = 40 + i * 30;
    aurora.moveTo(0, ay);
    for (let px = 0; px <= 1280; px += 20) {
      aurora.lineTo(px, ay + Math.sin(px * 0.01 + i) * 20);
    }
    aurora.strokePath();
  }
  const sil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-198);
  drawMountainSilhouette(sil, 0x4a5a6a, WAY, 120, 280, 75, 2400);
  // Storm totems
  const totems = scene.add.graphics().setDepth(WAY - 5);
  for (const tx of [1000, 2800, 4600, 6500]) {
    totems.fillStyle(0x5a5a50, 0.9); totems.fillRect(tx - 6, WAY - 40, 12, 40);
    // Rune face
    totems.fillStyle(0x4488aa, 0.4); totems.fillCircle(tx, WAY - 30, 4);
    totems.lineStyle(1, 0x4488aa, 0.3);
    totems.lineBetween(tx - 4, WAY - 22, tx + 4, WAY - 22);
    // Lightning spark (animated)
    const spark = scene.add.circle(tx, WAY - 45, 3, 0x88ccff, 0.4).setDepth(WAY - 4);
    scene.tweens.add({ targets: spark, alpha: { from: 0.4, to: 0 }, scaleX: 2, duration: 1000, yoyo: true, repeat: -1 });
  }
  drawGround(scene, 0x6a6a60);
  drawGrassContour(scene, [0x7a8a7a, 0x8a9a8a, 0x9aaa9a]);
  drawUnderground(scene, 0x3a3a34, 0x4a4a40);
}

export function buildStage38(scene: Phaser.Scene): void {
  // The Stormcrown Peak — highland boss. Summit arena, lightning, ice.
  drawSky(scene, 0x2a3a5a, 0x4a5a7a);
  const sil = scene.add.graphics().setScrollFactor(0.06, 0).setDepth(-199);
  drawMountainSilhouette(sil, 0x3a4a5a, WAY, 150, 320, 80, 2400);
  // Summit platform at ~4000
  const summit = scene.add.graphics().setDepth(WAY - 6);
  summit.fillStyle(0x6a6a60, 0.9);
  summit.beginPath(); summit.moveTo(3700, WAY);
  for (let p = 0; p <= 8; p++) {
    summit.lineTo(3700 + p * 75, WAY - 15 * Math.sin(p / 8 * Math.PI));
  }
  summit.lineTo(4300, WAY); summit.closePath(); summit.fillPath();
  // Ice formations
  for (const ix of [3800, 3950, 4100, 4250]) {
    summit.fillStyle(0x8aaccc, 0.6);
    summit.fillTriangle(ix - 5, WAY - 15, ix, WAY - 15 - Phaser.Math.Between(15, 30), ix + 5, WAY - 15);
  }
  // Lightning strike zones (animated flash circles)
  for (const lx of [1500, 3000, 5500, 7000]) {
    const strike = scene.add.circle(lx, WAY + 20, 30, 0x88ccff, 0).setDepth(WAY - 3);
    scene.tweens.add({ targets: strike, alpha: { from: 0, to: 0.15 }, duration: 200, yoyo: true, repeat: -1, delay: Phaser.Math.Between(2000, 8000), repeatDelay: Phaser.Math.Between(3000, 8000) });
  }
  drawGround(scene, 0x5a5a50);
  drawGrassContour(scene, [0x6a7a6a, 0x7a8a7a, 0x8a9a8a]);
  drawUnderground(scene, 0x3a3a34, 0x4a4a40);
  const cold = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  cold.fillStyle(0x0a1020, 0.05); cold.fillRect(0, 0, 1280, 720);
}

// ============================================================================
// STAGES 20-23: FORTRESS INTERIOR
// ============================================================================

export function buildStage20(scene: Phaser.Scene): void {
  // Gatehouse Breach — first fortress stage. Stone walls, iron portcullis, torchlight.
  drawSky(scene, 0x2a2a2a, 0x3a3838);
  const walls = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(-195);
  walls.fillStyle(0x4a4a42, 1); walls.fillRect(-200, 0, 2800, WAY);
  // Stone block lines
  for (let y = 20; y < WAY; y += 30) {
    walls.lineStyle(0.8, 0x3a3a34, 0.4);
    walls.lineBetween(-200, y, 2600, y + Phaser.Math.Between(-2, 2));
    for (let x = 0; x < 2600; x += 60) {
      walls.lineBetween(x + Phaser.Math.Between(-5, 5), y, x + Phaser.Math.Between(-5, 5), y + 30);
    }
  }
  // Arched doorways
  for (const ax of [600, 1400, 2000]) {
    walls.fillStyle(0x1a1a18, 0.8);
    walls.beginPath();
    for (let p = 0; p <= 10; p++) {
      const a = Math.PI + (p / 10) * Math.PI;
      walls.lineTo(ax + Math.cos(a) * 30, 200 + Math.sin(a) * 40);
    }
    walls.lineTo(ax + 30, WAY); walls.lineTo(ax - 30, WAY); walls.closePath(); walls.fillPath();
  }
  // Torch brackets
  const torches = scene.add.graphics().setDepth(WAY - 6);
  for (const tx of [400, 1200, 2400, 3600, 5000, 6400]) {
    torches.fillStyle(0x5a5a4a, 0.9); torches.fillRect(tx - 2, WAY - 45, 4, 20);
    torches.fillStyle(0x3a3020, 0.9); torches.fillRect(tx - 4, WAY - 48, 8, 5);
    const flame = scene.add.circle(tx, WAY - 52, 4, 0xff8822, 0.5).setDepth(WAY - 5);
    scene.tweens.add({ targets: flame, alpha: { from: 0.5, to: 0.2 }, scaleY: { from: 1, to: 1.3 }, duration: 600, yoyo: true, repeat: -1 });
  }
  // Cobblestone floor
  drawGround(scene, 0x4a4a3a);
  drawGrassContour(scene, [0x5a5a4a, 0x6a6a5a, 0x7a7a6a]);
  drawUnderground(scene, 0x2a2a22, 0x3a3a32);
}

export function buildStage21(scene: Phaser.Scene): void {
  // The Iron Sanctum — deeper fortress. Iron gates, chains, darker.
  drawSky(scene, 0x1a1a1a, 0x2a2a28);
  const walls = scene.add.graphics().setScrollFactor(0.12, 0).setDepth(-196);
  walls.fillStyle(0x3a3a34, 1); walls.fillRect(-200, 0, 2800, WAY);
  for (let y = 15; y < WAY; y += 25) {
    walls.lineStyle(0.6, 0x2a2a26, 0.3);
    walls.lineBetween(-200, y, 2600, y);
  }
  // Hanging chains
  const chains = scene.add.graphics().setDepth(WAY - 7);
  for (const cx of [300, 900, 1800, 3000, 4500, 5800, 7000]) {
    const chainLen = Phaser.Math.Between(60, 150);
    for (let link = 0; link < Math.floor(chainLen / 10); link++) {
      chains.lineStyle(1.5, 0x6a6a5a, 0.5);
      chains.strokeEllipse(cx + Math.sin(link * 0.8) * 3, link * 10, 4, 6);
    }
  }
  // Iron gate at ~3500
  const gate = scene.add.graphics().setDepth(WAY - 5);
  for (let b = 0; b < 8; b++) {
    gate.fillStyle(0x4a4a4a, 0.8); gate.fillRect(3470 + b * 8, WAY - 60, 3, 60);
  }
  gate.fillStyle(0x5a5a5a, 0.7); gate.fillRect(3468, WAY - 62, 66, 4);
  gate.fillRect(3468, WAY - 40, 66, 3);

  drawGround(scene, 0x3a3a32);
  drawGrassContour(scene, [0x4a4a3a, 0x5a5a4a, 0x5a5a4a]);
  drawUnderground(scene, 0x1a1a18, 0x2a2a24);
  const dim = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  dim.fillStyle(0x080808, 0.06); dim.fillRect(0, 0, 1280, 720);
}

export function buildStage22(scene: Phaser.Scene): void {
  // Dungeon Block — prison cells, dripping water, dim torchlight.
  drawSky(scene, 0x141414, 0x222220);
  const walls = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-197);
  walls.fillStyle(0x2a2a26, 1); walls.fillRect(-200, 0, 2800, WAY);
  // Cell bars
  for (let cell = 0; cell < 6; cell++) {
    const cx = 200 + cell * 400;
    for (let b = 0; b < 5; b++) {
      walls.fillStyle(0x4a4a4a, 0.6); walls.fillRect(cx + b * 10, 120, 2, 200);
    }
    walls.fillStyle(0x4a4a4a, 0.5); walls.fillRect(cx, 120, 42, 3);
    walls.fillRect(cx, 220, 42, 3);
  }
  // Dripping water particles
  for (let i = 0; i < 6; i++) {
    const dx = Phaser.Math.Between(100, 1200);
    const drop = scene.add.circle(dx, 80, 1.5, 0x4488aa, 0.4).setScrollFactor(0.1, 0).setDepth(-196);
    scene.tweens.add({ targets: drop, y: WAY - 20, alpha: 0, duration: 2000 + i * 500, repeat: -1, delay: i * 800 });
  }
  // Sparse torches
  const torches = scene.add.graphics().setDepth(WAY - 5);
  for (const tx of [800, 2500, 4500, 6500]) {
    torches.fillStyle(0x5a4a30, 0.9); torches.fillRect(tx - 2, WAY - 40, 4, 15);
    const flame = scene.add.circle(tx, WAY - 44, 3, 0xff7711, 0.4).setDepth(WAY - 4);
    scene.tweens.add({ targets: flame, alpha: { from: 0.4, to: 0.15 }, duration: 700, yoyo: true, repeat: -1 });
  }
  drawGround(scene, 0x2a2a24);
  drawGrassContour(scene, [0x3a3a30, 0x4a4a3a, 0x4a4a3a]);
  drawUnderground(scene, 0x141414, 0x1e1e1a);
  const dim = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  dim.fillStyle(0x000000, 0.08); dim.fillRect(0, 0, 1280, 720);
}

export function buildStage23(scene: Phaser.Scene): void {
  // The Gauntlet Halls — fortress boss. Grand hall, pillars, throne.
  drawSky(scene, 0x1a1818, 0x2a2826);
  const walls = scene.add.graphics().setScrollFactor(0.12, 0).setDepth(-196);
  walls.fillStyle(0x3a3834, 1); walls.fillRect(-200, 0, 2800, WAY);
  // Grand pillars
  for (let i = 0; i < 8; i++) {
    const px = i * 320 + 100;
    walls.fillStyle(0x5a5a4a, 0.9); walls.fillRect(px - 12, 40, 24, WAY - 40);
    walls.fillStyle(0x6a6a5a, 0.8);
    walls.fillRect(px - 16, 30, 32, 12);
    walls.fillRect(px - 16, WAY - 8, 32, 10);
  }
  // Fortress throne at ~4000
  const th = scene.add.graphics().setDepth(WAY - 5);
  th.fillStyle(0x5a5a4a, 0.95); th.fillRect(3960, WAY - 55, 80, 55);
  th.fillRect(3970, WAY - 90, 60, 35);
  th.fillStyle(0x8a2222, 0.6); th.fillRect(3975, WAY - 50, 50, 8); // red cushion
  // Banners flanking throne
  for (const bx of [3900, 4100]) {
    th.fillStyle(0x5a4a30, 0.9); th.fillRect(bx - 2, WAY - 70, 4, 70);
    th.fillStyle(0x8a2222, 0.8); th.fillRect(bx - 8, WAY - 68, 16, 25);
  }
  // Grand torches
  for (const tx of [500, 1500, 2500, 3500, 5000, 6000, 7000]) {
    th.fillStyle(0x5a5a4a, 0.9); th.fillRect(tx - 3, WAY - 50, 6, 25);
    const flame = scene.add.circle(tx, WAY - 55, 5, 0xff9933, 0.45).setDepth(WAY - 4);
    scene.tweens.add({ targets: flame, alpha: { from: 0.45, to: 0.15 }, scaleY: { from: 1, to: 1.4 }, duration: 500, yoyo: true, repeat: -1 });
  }
  drawGround(scene, 0x3a3a30);
  drawGrassContour(scene, [0x4a4a3a, 0x5a5a4a, 0x6a6a5a]);
  drawUnderground(scene, 0x1a1a18, 0x2a2a24);
}

// ============================================================================
// STAGES 24-28: DEEP CAVERNS
// ============================================================================

export function buildStage24(scene: Phaser.Scene): void {
  // Glowtunnel Descent — cave entrance. Stalactites, crystal hints.
  drawSky(scene, 0x0a0e14, 0x141a20);
  // Cave ceiling
  const ceil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  ceil.fillStyle(0x1a1a1e, 1); ceil.fillRect(-200, 0, 2800, 120);
  // Stalactites
  for (let i = 0; i < 25; i++) {
    const sx = Phaser.Math.Between(0, 2400);
    const sh = Phaser.Math.Between(20, 60);
    ceil.fillStyle(0x2a2a30, 0.9);
    ceil.fillTriangle(sx - 5, 120, sx, 120 + sh, sx + 5, 120);
  }
  // Cave walls
  const walls = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(-195);
  walls.fillStyle(0x1e1e24, 1);
  walls.beginPath(); walls.moveTo(-200, 0);
  let wx = -200;
  while (wx < 2800) { walls.lineTo(wx, Phaser.Math.Between(130, 200)); wx += Phaser.Math.Between(30, 60); }
  walls.lineTo(2800, WAY); walls.lineTo(-200, WAY); walls.closePath(); walls.fillPath();

  // Crystal formations (blue-green glow)
  const crystals = scene.add.graphics().setDepth(WAY - 6);
  for (const cx of [600, 1800, 3200, 4800, 6400]) {
    for (let c = 0; c < Phaser.Math.Between(2, 4); c++) {
      const crx = cx + Phaser.Math.Between(-20, 20);
      const crh = Phaser.Math.Between(12, 25);
      const lean = Phaser.Math.FloatBetween(-0.2, 0.2);
      crystals.fillStyle(0x2288aa, 0.6);
      crystals.fillTriangle(crx - 3, WAY, crx + lean * crh, WAY - crh, crx + 3, WAY);
      crystals.fillStyle(0x44aacc, 0.15);
      crystals.fillCircle(crx + lean * crh * 0.5, WAY - crh * 0.6, crh * 0.6);
    }
  }

  drawGround(scene, 0x1e1e24);
  drawGrassContour(scene, [0x2a2a34, 0x3a3a44, 0x3a3a44]);
  drawUnderground(scene, 0x0e0e14, 0x1a1a22);

  // Bioluminescent glow overlay
  const glow = scene.add.graphics().setScrollFactor(0, 0).setDepth(690);
  glow.fillStyle(0x0a1a2a, 0.05); glow.fillRect(0, 0, 1280, 720);
}

export function buildStage25(scene: Phaser.Scene): void {
  // Crystal Vein — deep crystal-lined tunnels.
  drawSky(scene, 0x080e18, 0x101820);
  const ceil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  ceil.fillStyle(0x141420, 1); ceil.fillRect(-200, 0, 2800, 100);
  for (let i = 0; i < 30; i++) {
    ceil.fillStyle(0x1e1e28, 0.9);
    ceil.fillTriangle(Phaser.Math.Between(0, 2400) - 4, 100, Phaser.Math.Between(0, 2400), 100 + Phaser.Math.Between(15, 45), Phaser.Math.Between(0, 2400) + 4, 100);
  }
  // Crystal veins in walls
  const walls = scene.add.graphics().setScrollFactor(0.18, 0).setDepth(-194);
  walls.fillStyle(0x181824, 1);
  walls.fillRect(-200, 90, 2800, WAY - 90);
  // Glowing crystal seams
  for (let i = 0; i < 15; i++) {
    walls.lineStyle(2, 0x3388bb, 0.2);
    const sx = Phaser.Math.Between(0, 2400);
    const sy = Phaser.Math.Between(120, WAY - 20);
    walls.beginPath(); walls.moveTo(sx, sy);
    walls.lineTo(sx + Phaser.Math.Between(-30, 30), sy + Phaser.Math.Between(-20, 20));
    walls.strokePath();
  }
  // Large crystal clusters
  const crystals = scene.add.graphics().setDepth(WAY - 5);
  for (const cx of [500, 1500, 2800, 4200, 5600, 7000]) {
    for (let c = 0; c < 4; c++) {
      const crx = cx + Phaser.Math.Between(-25, 25);
      const crh = Phaser.Math.Between(15, 35);
      crystals.fillStyle([0x2288aa, 0x3399bb, 0x44aacc][Phaser.Math.Between(0, 2)], 0.7);
      crystals.fillTriangle(crx - 4, WAY, crx + Phaser.Math.FloatBetween(-3, 3), WAY - crh, crx + 4, WAY);
    }
    // Glow
    crystals.fillStyle(0x44aacc, 0.08);
    crystals.fillCircle(cx, WAY - 10, 30);
  }
  drawGround(scene, 0x141420);
  drawGrassContour(scene, [0x1e1e2a, 0x2a2a38, 0x2a2a38]);
  drawUnderground(scene, 0x0a0a12, 0x14141e);
}

export function buildStage26(scene: Phaser.Scene): void {
  // Echo Chamber — vast open cavern, distant echoing shapes.
  drawSky(scene, 0x0a0e16, 0x141a22);
  const ceil = scene.add.graphics().setScrollFactor(0.06, 0).setDepth(-199);
  ceil.fillStyle(0x12121a, 1); ceil.fillRect(-200, 0, 2800, 70);
  // Distant cave features (stalagmites far away)
  const far = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(-198);
  for (let i = 0; i < 15; i++) {
    const fx = Phaser.Math.Between(0, 2200);
    far.fillStyle(0x1a1a24, 0.8);
    far.fillTriangle(fx - 8, WAY, fx, WAY - Phaser.Math.Between(40, 100), fx + 8, WAY);
  }
  // Mid cave pillars (stalactite meets stalagmite)
  const pillars = scene.add.graphics().setScrollFactor(0.25, 0).setDepth(-185);
  for (let i = 0; i < 6; i++) {
    const px = i * 400 + Phaser.Math.Between(-40, 40);
    pillars.fillStyle(0x2a2a34, 0.9);
    pillars.fillRect(px - 8, 60, 16, WAY - 60);
    pillars.fillStyle(0x22222e, 0.8);
    pillars.fillTriangle(px - 12, 60, px, 40, px + 12, 60);
  }
  drawGround(scene, 0x181820);
  // Puddles
  const puddles = scene.add.graphics().setDepth(WAY - 8);
  for (let i = 0; i < 10; i++) {
    puddles.fillStyle(0x2244aa, 0.15);
    puddles.fillEllipse(Phaser.Math.Between(0, SW), WAY + Phaser.Math.Between(15, 60),
      Phaser.Math.Between(20, 50), Phaser.Math.Between(5, 12));
  }
  drawGrassContour(scene, [0x1e1e28, 0x2a2a36, 0x2a2a36]);
  drawUnderground(scene, 0x0c0c14, 0x16161e);
}

export function buildStage27(scene: Phaser.Scene): void {
  // The Fungal Spread — cavern mushroom colony, poisonous.
  drawSky(scene, 0x0e1218, 0x182020);
  const ceil = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
  ceil.fillStyle(0x14181e, 1); ceil.fillRect(-200, 0, 2800, 90);
  // Fungal ceiling growths
  for (let i = 0; i < 20; i++) {
    const fx = Phaser.Math.Between(0, 2400);
    ceil.fillStyle(0x2a3028, 0.7);
    ceil.fillEllipse(fx, 90, Phaser.Math.Between(15, 35), Phaser.Math.Between(8, 18));
  }
  // Cave mushroom clusters
  const shrooms = scene.add.graphics().setDepth(WAY - 5);
  for (const mx of [400, 1200, 2200, 3400, 4600, 5800, 7000]) {
    for (let m = 0; m < Phaser.Math.Between(2, 4); m++) {
      const mmx = mx + Phaser.Math.Between(-20, 20);
      const mh = Phaser.Math.Between(10, 25);
      shrooms.fillStyle(0x3a3830, 0.9); shrooms.fillRect(mmx - 1, WAY - mh, 2, mh);
      shrooms.fillStyle([0x6a5a30, 0x7a6a40, 0x5a8a3a][Phaser.Math.Between(0, 2)], 0.8);
      shrooms.fillEllipse(mmx, WAY - mh, 8, 4);
    }
    // Toxic cloud hint
    shrooms.fillStyle(0x4a6a2a, 0.06);
    shrooms.fillCircle(mx, WAY - 15, 25);
  }
  drawGround(scene, 0x1a2018);
  drawGrassContour(scene, [0x2a3020, 0x3a4030, 0x3a4030]);
  drawUnderground(scene, 0x0e1210, 0x181e16);
}

export function buildStage28(scene: Phaser.Scene): void {
  // The Crystalline Maw — cavern boss. Massive crystal formations.
  drawSky(scene, 0x060a14, 0x101822);
  const ceil = scene.add.graphics().setScrollFactor(0.06, 0).setDepth(-199);
  ceil.fillStyle(0x101018, 1); ceil.fillRect(-200, 0, 2800, 80);
  for (let i = 0; i < 20; i++) {
    ceil.fillStyle(0x181822, 0.9);
    ceil.fillTriangle(Phaser.Math.Between(0, 2400) - 6, 80, Phaser.Math.Between(0, 2400), 80 + Phaser.Math.Between(20, 50), Phaser.Math.Between(0, 2400) + 6, 80);
  }
  // Massive crystal arch at boss arena
  const crystalArch = scene.add.graphics().setDepth(WAY - 6);
  for (const side of [-1, 1]) {
    const ax = 4000 + side * 120;
    for (let c = 0; c < 5; c++) {
      const ch = Phaser.Math.Between(40, 80);
      crystalArch.fillStyle([0x2288aa, 0x3399bb, 0x2277aa][Phaser.Math.Between(0, 2)], 0.7);
      crystalArch.fillTriangle(ax - 6 + c * 3, WAY, ax + Phaser.Math.FloatBetween(-5, 5), WAY - ch, ax + 6 + c * 3, WAY);
    }
    crystalArch.fillStyle(0x44aacc, 0.1);
    crystalArch.fillCircle(ax, WAY - 30, 40);
  }
  // Central crystal
  crystalArch.fillStyle(0x55ccee, 0.5);
  crystalArch.fillTriangle(3990, WAY, 4000, WAY - 100, 4010, WAY);
  crystalArch.fillStyle(0x66ddff, 0.08);
  crystalArch.fillCircle(4000, WAY - 50, 50);

  drawGround(scene, 0x12121e);
  drawGrassContour(scene, [0x1e1e2e, 0x2a2a3e, 0x2a2a3e]);
  drawUnderground(scene, 0x0a0a12, 0x14141e);
}

/**
 * Build the environment for a given stage number.
 * Returns true if a custom builder exists, false otherwise.
 */
export function buildStageEnvironment(scene: Phaser.Scene, stageNumber: number): boolean {
  const builder = STAGE_BUILDERS[stageNumber];
  if (builder) {
    builder(scene);
    return true;
  }
  return false;
}
