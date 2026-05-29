import Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Constants matching ForestStage
// ---------------------------------------------------------------------------
const STAGE_WIDTH = 8000;
const GROUND_MIN_Y = 420;
const GROUND_MAX_Y = 520;
const GROUND_H = GROUND_MAX_Y - GROUND_MIN_Y;

// Depth ranges
const SKY_DEPTH = -200;
const FAR_BG_DEPTH = -195;
const MID_BG_DEPTH = -170;
const NEAR_BG_DEPTH = -150;
const GROUND_DEPTH = 405; // WAY - 15
const UNDERGROUND_DEPTH = 750;

// ---------------------------------------------------------------------------
// Biome ID type & palette
// ---------------------------------------------------------------------------
export type BiomeId =
  | 'forest' | 'wildlands' | 'stone_march' | 'fortress'
  | 'deep_caverns' | 'mirelands' | 'highland' | 'ruins'
  | 'arcane' | 'dark_sovereign';

export interface BiomePalette {
  skyTop: number;
  skyBottom: number;
  groundFill: number;
  groundAccent: number;
  groundEdge: number;
  undergroundFill: number;
  undergroundAccent: number;
  fogColor: number;
  fogAlpha: number;
  silhouetteColor: number;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
const PALETTES: Record<BiomeId, BiomePalette> = {
  forest: {
    skyTop: 0x87ceeb, skyBottom: 0xd4eac8,
    groundFill: 0x4a7a2e, groundAccent: 0x3b5e22, groundEdge: 0x2e4a1a,
    undergroundFill: 0x5a3e1e, undergroundAccent: 0x3e2a12,
    fogColor: 0xffffff, fogAlpha: 0.08,
    silhouetteColor: 0x2a4a1a,
  },
  wildlands: {
    skyTop: 0x8a8a8a, skyBottom: 0xb0a090,
    groundFill: 0x8b6914, groundAccent: 0x6b4e10, groundEdge: 0x5a3e0e,
    undergroundFill: 0x4a3820, undergroundAccent: 0x3a2a14,
    fogColor: 0x9a9080, fogAlpha: 0.12,
    silhouetteColor: 0x4a3a2a,
  },
  stone_march: {
    skyTop: 0x9a9a9a, skyBottom: 0xc0b8a8,
    groundFill: 0x7a7060, groundAccent: 0x5a5248, groundEdge: 0x4a4238,
    undergroundFill: 0x4a4440, undergroundAccent: 0x3a3632,
    fogColor: 0xb0a890, fogAlpha: 0.15,
    silhouetteColor: 0x5a5248,
  },
  fortress: {
    skyTop: 0x2a2a3a, skyBottom: 0x4a4a5a,
    groundFill: 0x6a6a70, groundAccent: 0x5a5a60, groundEdge: 0x4a4a50,
    undergroundFill: 0x3a3a40, undergroundAccent: 0x2a2a30,
    fogColor: 0xff8830, fogAlpha: 0.06,
    silhouetteColor: 0x2a2a3a,
  },
  deep_caverns: {
    skyTop: 0x0a0a1a, skyBottom: 0x1a1a2a,
    groundFill: 0x2a2a3a, groundAccent: 0x1a1a28, groundEdge: 0x141420,
    undergroundFill: 0x0e0e1a, undergroundAccent: 0x0a0a14,
    fogColor: 0x20aaaa, fogAlpha: 0.08,
    silhouetteColor: 0x10101a,
  },
  mirelands: {
    skyTop: 0x4a5a30, skyBottom: 0x6a7a40,
    groundFill: 0x4a4a20, groundAccent: 0x3a3a18, groundEdge: 0x2a2a10,
    undergroundFill: 0x2a2a14, undergroundAccent: 0x1a1a0e,
    fogColor: 0x80aa40, fogAlpha: 0.18,
    silhouetteColor: 0x2a3a14,
  },
  highland: {
    skyTop: 0x6090c0, skyBottom: 0xa0c0e0,
    groundFill: 0xe0e8f0, groundAccent: 0xc0c8d0, groundEdge: 0xa0a8b0,
    undergroundFill: 0x6a6a70, undergroundAccent: 0x5a5a60,
    fogColor: 0xd0e0f0, fogAlpha: 0.12,
    silhouetteColor: 0x607080,
  },
  ruins: {
    skyTop: 0xc09040, skyBottom: 0xe0b060,
    groundFill: 0x8a8070, groundAccent: 0x6a6258, groundEdge: 0x5a5248,
    undergroundFill: 0x4a4438, undergroundAccent: 0x3a3428,
    fogColor: 0xd0b070, fogAlpha: 0.10,
    silhouetteColor: 0x5a5040,
  },
  arcane: {
    skyTop: 0x1a0a3a, skyBottom: 0x2a1a5a,
    groundFill: 0x1a1a2a, groundAccent: 0x14142a, groundEdge: 0x0e0e20,
    undergroundFill: 0x0a0a18, undergroundAccent: 0x060610,
    fogColor: 0x8040e0, fogAlpha: 0.10,
    silhouetteColor: 0x140a2a,
  },
  dark_sovereign: {
    skyTop: 0x3a0a0a, skyBottom: 0x5a1a0a,
    groundFill: 0x1a1a1a, groundAccent: 0x0e0e0e, groundEdge: 0x0a0a0a,
    undergroundFill: 0x0a0808, undergroundAccent: 0x060404,
    fogColor: 0xff2000, fogAlpha: 0.10,
    silhouetteColor: 0x1a0a0a,
  },
};

// ---------------------------------------------------------------------------
// Seeded RNG helper (deterministic per biome)
// ---------------------------------------------------------------------------
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashBiome(biomeId: BiomeId): number {
  let h = 0;
  for (let i = 0; i < biomeId.length; i++) {
    h = ((h << 5) - h + biomeId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

// ---------------------------------------------------------------------------
// Common drawing helpers
// ---------------------------------------------------------------------------

/** Draw a sky gradient from skyTop (top) to skyBottom (bottom). */
function drawSkyGradient(scene: Phaser.Scene, pal: BiomePalette): void {
  const g = scene.add.graphics().setScrollFactor(0, 0).setDepth(SKY_DEPTH);
  const steps = 24;
  const stepH = Math.ceil(GROUND_MIN_Y / steps) + 1;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(pal.skyTop),
      Phaser.Display.Color.IntegerToColor(pal.skyBottom),
      1, t
    );
    const hex = Phaser.Display.Color.GetColor(
      Math.round(color.r), Math.round(color.g), Math.round(color.b)
    );
    g.fillStyle(hex, 1);
    g.fillRect(0, i * stepH, 1280, stepH + 1);
  }
}

/** Draw a fog/haze overlay strip near the horizon. */
function drawFogStrip(scene: Phaser.Scene, pal: BiomePalette): void {
  scene.add.rectangle(640, GROUND_MIN_Y - 20, 1400, 60, pal.fogColor, pal.fogAlpha)
    .setScrollFactor(0.3, 0).setDepth(NEAR_BG_DEPTH + 5);
}

/** Draw a jagged mountain silhouette range. */
function drawMountainRange(
  scene: Phaser.Scene, baseY: number, peakMin: number, peakMax: number,
  color: number, alpha: number, count: number, scrollFactor: number, depth: number,
  rng: () => number
): void {
  const g = scene.add.graphics().setScrollFactor(scrollFactor, 0).setDepth(depth);
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(-100, baseY);
  const segW = (STAGE_WIDTH + 400) / count;
  for (let i = 0; i <= count; i++) {
    const px = -200 + i * segW + (rng() - 0.5) * segW * 0.4;
    const py = baseY - peakMin - rng() * (peakMax - peakMin);
    if (i === 0) g.lineTo(px, py);
    else g.lineTo(px, py);
  }
  g.lineTo(STAGE_WIDTH + 200, baseY);
  g.closePath();
  g.fillPath();
}

/** Draw triangular tree silhouettes for forest-like biomes. */
function drawTreeSilhouettes(
  scene: Phaser.Scene, count: number, baseY: number,
  minH: number, maxH: number, color: number, alpha: number,
  scrollFactor: number, depth: number, rng: () => number
): void {
  const g = scene.add.graphics().setScrollFactor(scrollFactor, 0).setDepth(depth);
  g.fillStyle(color, alpha);
  for (let i = 0; i < count; i++) {
    const x = rng() * (STAGE_WIDTH + 200) - 100;
    const h = minH + rng() * (maxH - minH);
    const w = h * (0.3 + rng() * 0.3);
    // Tree: triangle on a trunk
    g.fillRect(x - 3, baseY - h * 0.3, 6, h * 0.3);
    g.fillTriangle(x, baseY - h, x - w / 2, baseY - h * 0.25, x + w / 2, baseY - h * 0.25);
  }
}

/** Draw the ground surface fill. */
function drawGroundBase(scene: Phaser.Scene, pal: BiomePalette): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(GROUND_DEPTH);
  g.fillStyle(pal.groundFill, 1);
  g.fillRect(0, GROUND_MIN_Y, STAGE_WIDTH, GROUND_H + 14);
  return g;
}

/** Draw color drift patches on the ground. */
function drawGroundDrift(g: Phaser.GameObjects.Graphics, colors: number[], rng: () => number): void {
  for (let i = 0; i < 16; i++) {
    const dx = rng() * STAGE_WIDTH;
    const dw = 100 + rng() * 250;
    g.fillStyle(colors[Math.floor(rng() * colors.length)], 0.15 + rng() * 0.15);
    g.fillRect(dx, GROUND_MIN_Y, dw, GROUND_H);
  }
}

/** Draw ground edge lines at GROUND_MIN_Y and GROUND_MAX_Y. */
function drawGroundEdges(g: Phaser.GameObjects.Graphics, pal: BiomePalette): void {
  // Top edge - darker
  g.fillStyle(pal.groundEdge, 0.7);
  g.fillRect(0, GROUND_MIN_Y, STAGE_WIDTH, 4);
  // Grass-line jagged top
  g.beginPath();
  g.moveTo(0, GROUND_MIN_Y);
  for (let x = 0; x <= STAGE_WIDTH; x += 12) {
    g.lineTo(x, GROUND_MIN_Y - 1 - Math.random() * 4);
  }
  g.lineTo(STAGE_WIDTH, GROUND_MIN_Y + 3);
  g.lineTo(0, GROUND_MIN_Y + 3);
  g.closePath();
  g.fillPath();
  // Bottom edge
  g.fillStyle(pal.groundEdge, 0.5);
  g.fillRect(0, GROUND_MAX_Y - 5, STAGE_WIDTH, 5);
}

/** Draw the underground (foreground) fill below GROUND_MAX_Y. */
function drawUnderground(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  const g = scene.add.graphics().setDepth(UNDERGROUND_DEPTH);
  g.fillStyle(pal.undergroundFill, 1);
  g.fillRect(0, GROUND_MAX_Y - 4, STAGE_WIDTH, 260);
  // Accent stripes
  g.fillStyle(pal.undergroundAccent, 0.5);
  g.fillRect(0, GROUND_MAX_Y - 4, STAGE_WIDTH, 8);
  // Scattered pebbles
  for (let i = 0; i < 30; i++) {
    const px = rng() * STAGE_WIDTH;
    const py = GROUND_MAX_Y + 10 + rng() * 60;
    const r = 2 + rng() * 4;
    g.fillStyle(pal.undergroundAccent, 0.3 + rng() * 0.2);
    g.fillCircle(px, py, r);
  }
}

/** Draw terrain bumps on the ground surface. */
function drawBumps(g: Phaser.GameObjects.Graphics, count: number, color: number, rng: () => number): void {
  for (let i = 0; i < count; i++) {
    const bx = rng() * STAGE_WIDTH;
    const bw = 30 + rng() * 80;
    const bh = 3 + rng() * 6;
    g.fillStyle(color, 0.2 + rng() * 0.15);
    g.fillEllipse(bx, GROUND_MIN_Y + 2, bw, bh);
  }
}

/** Draw a stalactite hanging from a y position. */
function drawStalactite(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(color, 0.9);
  g.fillTriangle(x, y + h, x - w / 2, y, x + w / 2, y);
}

/** Draw a stalagmite growing up from a y position. */
function drawStalagmite(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(color, 0.9);
  g.fillTriangle(x, y - h, x - w / 2, y, x + w / 2, y);
}

/** Draw a pillar / column. */
function drawPillar(g: Phaser.GameObjects.Graphics, x: number, topY: number, botY: number, w: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.fillRect(x - w / 2, topY, w, botY - topY);
  // Capital
  g.fillRect(x - w / 2 - 4, topY, w + 8, 8);
  // Base
  g.fillRect(x - w / 2 - 3, botY - 6, w + 6, 6);
}

// ---------------------------------------------------------------------------
// Biome-specific renderers
// ---------------------------------------------------------------------------

function renderForest(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Far background: layered green hills
  drawMountainRange(scene, GROUND_MIN_Y, 60, 150, 0x2a5a1a, 0.4, 12, 0.2, FAR_BG_DEPTH, rng);
  drawMountainRange(scene, GROUND_MIN_Y, 40, 100, 0x3a6a2a, 0.5, 10, 0.4, MID_BG_DEPTH, rng);
  // Mid background: tree silhouettes
  drawTreeSilhouettes(scene, 30, GROUND_MIN_Y + 5, 60, 140, pal.silhouetteColor, 0.6, 0.6, NEAR_BG_DEPTH, rng);
  drawFogStrip(scene, pal);

  // Ground
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x5a8a38, 0x3a6a1e, 0x4a7a28, 0x6a9a48], rng);
  drawBumps(g, 20, 0x5a8a38, rng);
  drawGroundEdges(g, pal);

  // Props: mushrooms, flowers, bushes
  const props = scene.add.graphics().setDepth(GROUND_DEPTH + 2);
  for (let i = 0; i < 8; i++) {
    const mx = rng() * STAGE_WIDTH;
    const my = GROUND_MIN_Y + 5 + rng() * (GROUND_H - 15);
    // Mushroom
    props.fillStyle(0xc04040, 0.8);
    props.fillCircle(mx, my - 6, 5);
    props.fillStyle(0xe0d0a0, 0.8);
    props.fillRect(mx - 2, my - 4, 4, 8);
  }
  for (let i = 0; i < 10; i++) {
    const fx = rng() * STAGE_WIDTH;
    const fy = GROUND_MIN_Y + 3 + rng() * 10;
    // Small flower
    props.fillStyle(0xffee44, 0.7);
    props.fillCircle(fx, fy, 3);
    props.fillStyle(0x44aa22, 0.8);
    props.fillRect(fx - 1, fy, 2, 6);
  }

  drawUnderground(scene, pal, rng);
}

function renderWildlands(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Overcast rolling hills
  drawMountainRange(scene, GROUND_MIN_Y, 30, 80, 0x5a4a30, 0.4, 14, 0.2, FAR_BG_DEPTH, rng);
  drawMountainRange(scene, GROUND_MIN_Y, 20, 60, 0x6a5a40, 0.5, 12, 0.45, MID_BG_DEPTH, rng);
  drawFogStrip(scene, pal);

  // Background tents and fences
  const bg = scene.add.graphics().setScrollFactor(0.6, 0).setDepth(NEAR_BG_DEPTH);
  for (let i = 0; i < 6; i++) {
    const tx = 200 + rng() * (STAGE_WIDTH - 400);
    const ty = GROUND_MIN_Y - 20 - rng() * 30;
    // Tent: triangle
    bg.fillStyle(0x8a7a50, 0.5);
    bg.fillTriangle(tx, ty, tx - 20, ty + 25, tx + 20, ty + 25);
    // Fence posts nearby
    bg.fillStyle(0x6a5a3a, 0.4);
    for (let f = 0; f < 4; f++) {
      bg.fillRect(tx + 30 + f * 12, ty + 10, 3, 18);
    }
    bg.lineStyle(1, 0x6a5a3a, 0.3);
    bg.beginPath();
    bg.moveTo(tx + 30, ty + 16);
    bg.lineTo(tx + 30 + 4 * 12, ty + 16);
    bg.strokePath();
  }

  // Ground: trampled paths
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x9a7a30, 0x7a5a18, 0x6a4a10, 0x8a6a20], rng);
  // Trampled ruts
  for (let i = 0; i < 10; i++) {
    const rx = rng() * STAGE_WIDTH;
    const rw = 60 + rng() * 120;
    g.fillStyle(0x5a4418, 0.3);
    g.fillRect(rx, GROUND_MIN_Y + 30 + rng() * 40, rw, 4);
  }
  drawBumps(g, 15, 0x7a5a20, rng);
  drawGroundEdges(g, pal);

  drawUnderground(scene, pal, rng);
}

function renderStoneMarch(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Cliff faces in background
  drawMountainRange(scene, GROUND_MIN_Y, 80, 200, 0x6a6258, 0.5, 8, 0.2, FAR_BG_DEPTH, rng);
  drawMountainRange(scene, GROUND_MIN_Y, 50, 130, 0x7a7268, 0.55, 10, 0.4, MID_BG_DEPTH, rng);

  // Boulders in near background
  const bg = scene.add.graphics().setScrollFactor(0.65, 0).setDepth(NEAR_BG_DEPTH);
  for (let i = 0; i < 8; i++) {
    const bx = rng() * STAGE_WIDTH;
    const by = GROUND_MIN_Y - 10 + rng() * 20;
    const bw = 20 + rng() * 40;
    const bh = 15 + rng() * 25;
    bg.fillStyle(0x7a7060, 0.6);
    bg.fillEllipse(bx, by, bw, bh);
    bg.fillStyle(0x6a6050, 0.4);
    bg.fillEllipse(bx + 3, by - 2, bw * 0.8, bh * 0.7);
  }
  drawFogStrip(scene, pal);

  // Ground: grey-brown stone
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x8a8070, 0x6a6258, 0x5a5248, 0x9a9080], rng);
  // Stone cracks
  g.lineStyle(1, 0x4a4238, 0.4);
  for (let i = 0; i < 20; i++) {
    const cx = rng() * STAGE_WIDTH;
    const cy = GROUND_MIN_Y + 10 + rng() * (GROUND_H - 20);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + 10 + rng() * 30, cy + rng() * 10 - 5);
    g.strokePath();
  }
  drawBumps(g, 12, 0x8a8070, rng);
  drawGroundEdges(g, pal);

  // Dust particles
  const dust = scene.add.graphics().setScrollFactor(0.8, 0).setDepth(NEAR_BG_DEPTH + 10);
  for (let i = 0; i < 30; i++) {
    dust.fillStyle(0xc0b8a0, 0.15 + rng() * 0.1);
    dust.fillCircle(rng() * 1400, 200 + rng() * 200, 1 + rng() * 2);
  }

  drawUnderground(scene, pal, rng);
}

function renderFortress(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Far: dark wall silhouettes
  const far = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(FAR_BG_DEPTH);
  far.fillStyle(0x1a1a2a, 0.7);
  far.fillRect(-100, 100, STAGE_WIDTH + 400, GROUND_MIN_Y - 80);
  // Battlements
  for (let i = 0; i < 40; i++) {
    const bx = -100 + i * 50;
    far.fillStyle(0x2a2a3a, 0.6);
    far.fillRect(bx, 80, 30, 30);
  }

  // Mid: stone corridors, arches
  const mid = scene.add.graphics().setScrollFactor(0.5, 0).setDepth(MID_BG_DEPTH);
  for (let i = 0; i < 5; i++) {
    const ax = 200 + rng() * (STAGE_WIDTH - 400);
    const aw = 50 + rng() * 30;
    // Arch: two pillars + arc on top
    drawPillar(mid, ax - aw / 2, 200, GROUND_MIN_Y, 12, 0x4a4a50, 0.5);
    drawPillar(mid, ax + aw / 2, 200, GROUND_MIN_Y, 12, 0x4a4a50, 0.5);
    mid.fillStyle(0x4a4a50, 0.5);
    mid.fillRect(ax - aw / 2 - 6, 195, aw + 12, 10);
  }

  // Torch brackets
  const torches = scene.add.graphics().setScrollFactor(0.55, 0).setDepth(NEAR_BG_DEPTH);
  for (let i = 0; i < 8; i++) {
    const tx = 150 + rng() * (STAGE_WIDTH - 300);
    const ty = GROUND_MIN_Y - 60 - rng() * 80;
    torches.fillStyle(0x5a4a3a, 0.7);
    torches.fillRect(tx - 2, ty, 4, 15);
    // Flame glow
    torches.fillStyle(0xff8830, 0.4);
    torches.fillCircle(tx, ty - 4, 8);
    torches.fillStyle(0xffcc44, 0.3);
    torches.fillCircle(tx, ty - 6, 5);
  }

  // Ground: cobblestone
  const g = drawGroundBase(scene, pal);
  // Cobblestone pattern
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 100; col++) {
      const cx = col * 80 + (row % 2) * 40 + rng() * 10 - 5;
      const cy = GROUND_MIN_Y + 5 + row * 16 + rng() * 4;
      const cw = 35 + rng() * 10;
      const ch = 10 + rng() * 4;
      g.fillStyle(row % 2 === 0 ? 0x6a6a70 : 0x5a5a60, 0.4);
      g.fillRect(cx, cy, cw, ch);
      g.lineStyle(1, 0x4a4a50, 0.3);
      g.strokeRect(cx, cy, cw, ch);
    }
  }
  drawGroundEdges(g, pal);

  // Iron gates in background
  const gates = scene.add.graphics().setScrollFactor(0.7, 0).setDepth(NEAR_BG_DEPTH + 2);
  for (let i = 0; i < 3; i++) {
    const gx = 400 + rng() * (STAGE_WIDTH - 800);
    gates.fillStyle(0x3a3a40, 0.6);
    // Vertical bars
    for (let b = 0; b < 6; b++) {
      gates.fillRect(gx + b * 8, GROUND_MIN_Y - 80, 3, 80);
    }
    gates.fillRect(gx - 2, GROUND_MIN_Y - 80, 6 * 8 + 4, 4);
    gates.fillRect(gx - 2, GROUND_MIN_Y - 40, 6 * 8 + 4, 3);
  }

  drawUnderground(scene, pal, rng);
}

function renderDeepCaverns(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  // Dark cave sky
  drawSkyGradient(scene, pal);

  // Cave ceiling
  const ceiling = scene.add.graphics().setScrollFactor(0.3, 0).setDepth(FAR_BG_DEPTH);
  ceiling.fillStyle(0x141420, 0.9);
  ceiling.fillRect(-100, 0, STAGE_WIDTH + 400, 180);
  // Jagged ceiling edge
  ceiling.fillStyle(0x1a1a28, 0.8);
  ceiling.beginPath();
  ceiling.moveTo(-100, 170);
  for (let x = -100; x <= STAGE_WIDTH + 200; x += 20) {
    ceiling.lineTo(x, 170 + rng() * 30);
  }
  ceiling.lineTo(STAGE_WIDTH + 200, 0);
  ceiling.lineTo(-100, 0);
  ceiling.closePath();
  ceiling.fillPath();

  // Stalactites
  const stalG = scene.add.graphics().setScrollFactor(0.35, 0).setDepth(MID_BG_DEPTH);
  for (let i = 0; i < 20; i++) {
    const sx = rng() * (STAGE_WIDTH + 200) - 100;
    drawStalactite(stalG, sx, 180, 8 + rng() * 12, 30 + rng() * 50, 0x2a2a3a);
  }

  // Cave walls (sides feel)
  const walls = scene.add.graphics().setScrollFactor(0.5, 0).setDepth(NEAR_BG_DEPTH);
  walls.fillStyle(0x1a1a28, 0.6);
  walls.fillRect(-100, 0, 120, GROUND_MIN_Y + 20);
  walls.fillRect(STAGE_WIDTH - 20, 0, 120, GROUND_MIN_Y + 20);

  // Crystal formations
  const crystals = scene.add.graphics().setScrollFactor(0.55, 0).setDepth(NEAR_BG_DEPTH + 5);
  for (let i = 0; i < 10; i++) {
    const cx = rng() * STAGE_WIDTH;
    const cy = GROUND_MIN_Y - 30 - rng() * 100;
    const ch = 15 + rng() * 25;
    const cw = 4 + rng() * 6;
    const angle = -0.3 + rng() * 0.6;
    // Crystal shard
    crystals.fillStyle(0x40cccc, 0.5);
    crystals.save();
    crystals.fillTriangle(cx, cy - ch, cx - cw, cy, cx + cw, cy);
    // Inner glow
    crystals.fillStyle(0x80ffff, 0.3);
    crystals.fillTriangle(cx, cy - ch + 4, cx - cw * 0.5, cy, cx + cw * 0.5, cy);
  }

  drawFogStrip(scene, pal);

  // Ground: dark stone with crystal accents
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x2a2a38, 0x1e1e2c, 0x242434, 0x30303e], rng);
  // Glowing crystal seams in ground
  for (let i = 0; i < 8; i++) {
    const sx = rng() * STAGE_WIDTH;
    const sw = 20 + rng() * 60;
    g.fillStyle(0x30aaaa, 0.25);
    g.fillRect(sx, GROUND_MIN_Y + 20 + rng() * 60, sw, 2);
  }
  drawBumps(g, 10, 0x2a2a3a, rng);
  drawGroundEdges(g, pal);

  // Stalagmites on ground
  const stagG = scene.add.graphics().setDepth(GROUND_DEPTH + 3);
  for (let i = 0; i < 6; i++) {
    const sx = rng() * STAGE_WIDTH;
    drawStalagmite(stagG, sx, GROUND_MIN_Y + 4, 8 + rng() * 10, 12 + rng() * 18, 0x3a3a48);
  }

  drawUnderground(scene, pal, rng);
}

function renderMirelands(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Distant dead trees
  drawMountainRange(scene, GROUND_MIN_Y, 10, 30, 0x3a4a20, 0.4, 16, 0.2, FAR_BG_DEPTH, rng);

  // Dead tree silhouettes
  const trees = scene.add.graphics().setScrollFactor(0.45, 0).setDepth(MID_BG_DEPTH);
  for (let i = 0; i < 12; i++) {
    const tx = rng() * (STAGE_WIDTH + 200) - 100;
    const th = 60 + rng() * 80;
    const ty = GROUND_MIN_Y + 5;
    trees.fillStyle(0x3a2a1a, 0.6);
    // Bare trunk
    trees.fillRect(tx - 3, ty - th, 6, th);
    // Branches
    for (let b = 0; b < 3; b++) {
      const by = ty - th * 0.4 - b * (th * 0.2);
      const dir = b % 2 === 0 ? 1 : -1;
      trees.lineStyle(2, 0x3a2a1a, 0.5);
      trees.beginPath();
      trees.moveTo(tx, by);
      trees.lineTo(tx + dir * (15 + rng() * 15), by - 10 - rng() * 10);
      trees.strokePath();
    }
  }

  drawFogStrip(scene, { ...pal, fogAlpha: 0.22 });

  // Ground: muddy with water patches
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x4a4a1e, 0x3a3a14, 0x5a5a28, 0x2a2a10], rng);
  // Water puddles
  for (let i = 0; i < 8; i++) {
    const px = rng() * STAGE_WIDTH;
    const pw = 30 + rng() * 60;
    const py = GROUND_MIN_Y + 15 + rng() * (GROUND_H - 30);
    g.fillStyle(0x304830, 0.4);
    g.fillEllipse(px, py, pw, 8 + rng() * 6);
    // Reflection highlight
    g.fillStyle(0x508050, 0.2);
    g.fillEllipse(px, py - 1, pw * 0.6, 3);
  }
  drawBumps(g, 8, 0x3a3a18, rng);
  drawGroundEdges(g, pal);

  // Fog overlay
  const fog = scene.add.graphics().setScrollFactor(0.1, 0).setDepth(NEAR_BG_DEPTH + 20);
  fog.fillStyle(0x80aa40, 0.08);
  fog.fillRect(0, 200, 1280, 250);

  drawUnderground(scene, pal, rng);
}

function renderHighland(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Snow-capped mountains - far
  drawMountainRange(scene, GROUND_MIN_Y, 100, 250, 0x607080, 0.5, 8, 0.15, FAR_BG_DEPTH, rng);
  // Snow caps
  const snowCaps = scene.add.graphics().setScrollFactor(0.15, 0).setDepth(FAR_BG_DEPTH + 1);
  for (let i = 0; i < 8; i++) {
    const px = -100 + i * (STAGE_WIDTH + 200) / 8 + rng() * 100;
    const peakY = GROUND_MIN_Y - 150 - rng() * 100;
    snowCaps.fillStyle(0xf0f4f8, 0.6);
    snowCaps.fillTriangle(px, peakY, px - 30, peakY + 35, px + 30, peakY + 35);
  }

  // Mid mountains
  drawMountainRange(scene, GROUND_MIN_Y, 60, 140, 0x7a8a9a, 0.5, 10, 0.35, MID_BG_DEPTH, rng);

  // Wind streaks
  const wind = scene.add.graphics().setScrollFactor(0.4, 0).setDepth(NEAR_BG_DEPTH);
  for (let i = 0; i < 15; i++) {
    const wx = rng() * 1400;
    const wy = 100 + rng() * 300;
    const wl = 40 + rng() * 80;
    wind.lineStyle(1, 0xd0e0f0, 0.2 + rng() * 0.15);
    wind.beginPath();
    wind.moveTo(wx, wy);
    wind.lineTo(wx + wl, wy + rng() * 6 - 3);
    wind.strokePath();
  }

  drawFogStrip(scene, pal);

  // Ground: snowy white over grey rock
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0xd0d8e0, 0xc0c8d0, 0xe0e8f0, 0xb0b8c0], rng);
  // Exposed rock patches
  for (let i = 0; i < 6; i++) {
    const rx = rng() * STAGE_WIDTH;
    const rw = 40 + rng() * 80;
    g.fillStyle(0x7a7a80, 0.3);
    g.fillEllipse(rx, GROUND_MIN_Y + 20 + rng() * 50, rw, 10 + rng() * 8);
  }
  // Ice patches
  for (let i = 0; i < 5; i++) {
    const ix = rng() * STAGE_WIDTH;
    const iw = 30 + rng() * 50;
    g.fillStyle(0xb0d0f0, 0.2);
    g.fillEllipse(ix, GROUND_MIN_Y + 10 + rng() * 60, iw, 6);
  }
  drawGroundEdges(g, pal);

  // Snow drifts / piles as props
  const props = scene.add.graphics().setDepth(GROUND_DEPTH + 2);
  for (let i = 0; i < 7; i++) {
    const sx = rng() * STAGE_WIDTH;
    const sw = 20 + rng() * 40;
    const sh = 6 + rng() * 10;
    props.fillStyle(0xf0f4f8, 0.5);
    props.fillEllipse(sx, GROUND_MIN_Y + 3, sw, sh);
  }

  drawUnderground(scene, pal, rng);
}

function renderRuins(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Distant ruined cityscape
  const far = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(FAR_BG_DEPTH);
  for (let i = 0; i < 12; i++) {
    const bx = rng() * (STAGE_WIDTH + 200) - 100;
    const bh = 40 + rng() * 120;
    far.fillStyle(0x5a5040, 0.4);
    far.fillRect(bx, GROUND_MIN_Y - bh, 20 + rng() * 30, bh);
    // Broken top
    far.fillStyle(0x5a5040, 0.3);
    far.fillTriangle(bx, GROUND_MIN_Y - bh, bx + 15, GROUND_MIN_Y - bh - 10, bx + 25, GROUND_MIN_Y - bh);
  }

  // Mid: overgrown pillars
  const mid = scene.add.graphics().setScrollFactor(0.5, 0).setDepth(MID_BG_DEPTH);
  for (let i = 0; i < 6; i++) {
    const px = 100 + rng() * (STAGE_WIDTH - 200);
    const ph = 80 + rng() * 60;
    drawPillar(mid, px, GROUND_MIN_Y - ph, GROUND_MIN_Y + 5, 14, 0x8a8070, 0.5);
    // Moss/vine overgrowth
    mid.fillStyle(0x4a7a30, 0.3);
    for (let v = 0; v < 4; v++) {
      mid.fillRect(px - 7 + rng() * 14, GROUND_MIN_Y - ph + rng() * ph, 4, 8 + rng() * 15);
    }
  }

  // Near: fallen statue chunks
  const near = scene.add.graphics().setScrollFactor(0.7, 0).setDepth(NEAR_BG_DEPTH);
  for (let i = 0; i < 4; i++) {
    const sx = rng() * STAGE_WIDTH;
    const sy = GROUND_MIN_Y - 5 + rng() * 10;
    near.fillStyle(0x9a9080, 0.5);
    near.fillEllipse(sx, sy, 25 + rng() * 20, 12 + rng() * 8);
    // Crack line
    near.lineStyle(1, 0x6a6258, 0.4);
    near.beginPath();
    near.moveTo(sx - 10, sy);
    near.lineTo(sx + 10, sy + 3);
    near.strokePath();
  }

  drawFogStrip(scene, pal);

  // Ground: cracked stone with moss
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x8a8070, 0x7a7060, 0x9a9080, 0x6a6258], rng);
  // Cracks
  g.lineStyle(1, 0x5a5248, 0.5);
  for (let i = 0; i < 25; i++) {
    const cx = rng() * STAGE_WIDTH;
    const cy = GROUND_MIN_Y + 5 + rng() * (GROUND_H - 10);
    g.beginPath();
    g.moveTo(cx, cy);
    let px = cx; let py = cy;
    for (let s = 0; s < 3; s++) {
      px += 5 + rng() * 15;
      py += rng() * 8 - 4;
      g.lineTo(px, py);
    }
    g.strokePath();
  }
  // Moss patches
  for (let i = 0; i < 10; i++) {
    const mx = rng() * STAGE_WIDTH;
    const my = GROUND_MIN_Y + 5 + rng() * (GROUND_H - 10);
    g.fillStyle(0x5a8a40, 0.2);
    g.fillEllipse(mx, my, 15 + rng() * 25, 5 + rng() * 6);
  }
  drawGroundEdges(g, pal);

  drawUnderground(scene, pal, rng);
}

function renderArcane(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Energy streams in background
  const streams = scene.add.graphics().setScrollFactor(0.25, 0).setDepth(FAR_BG_DEPTH);
  for (let i = 0; i < 6; i++) {
    const sx = rng() * 1400;
    const sy = 50 + rng() * 300;
    streams.lineStyle(2, 0x8040e0, 0.3);
    streams.beginPath();
    streams.moveTo(sx, sy);
    let px = sx; let py = sy;
    for (let s = 0; s < 8; s++) {
      px += 15 + rng() * 20;
      py += rng() * 30 - 15;
      streams.lineTo(px, py);
    }
    streams.strokePath();
  }

  // Floating rune circles
  const runes = scene.add.graphics().setScrollFactor(0.4, 0).setDepth(MID_BG_DEPTH);
  for (let i = 0; i < 5; i++) {
    const rx = rng() * (STAGE_WIDTH + 100);
    const ry = 150 + rng() * 200;
    const rr = 15 + rng() * 25;
    runes.lineStyle(2, 0xa060ff, 0.35);
    runes.strokeCircle(rx, ry, rr);
    runes.lineStyle(1, 0xc080ff, 0.25);
    runes.strokeCircle(rx, ry, rr * 0.6);
    // Inner glyph lines
    for (let l = 0; l < 4; l++) {
      const angle = (l / 4) * Math.PI * 2 + rng() * 0.5;
      runes.beginPath();
      runes.moveTo(rx, ry);
      runes.lineTo(rx + Math.cos(angle) * rr * 0.5, ry + Math.sin(angle) * rr * 0.5);
      runes.strokePath();
    }
  }

  // Crystalline structures
  const crystals = scene.add.graphics().setScrollFactor(0.6, 0).setDepth(NEAR_BG_DEPTH);
  for (let i = 0; i < 6; i++) {
    const cx = rng() * STAGE_WIDTH;
    const cy = GROUND_MIN_Y - 20 - rng() * 60;
    const ch = 20 + rng() * 40;
    const cw = 5 + rng() * 8;
    crystals.fillStyle(0x6030a0, 0.4);
    crystals.fillTriangle(cx, cy - ch, cx - cw, cy, cx + cw, cy);
    crystals.fillStyle(0x9060d0, 0.25);
    crystals.fillTriangle(cx + 1, cy - ch + 5, cx - cw * 0.4, cy, cx + cw * 0.4, cy);
  }

  drawFogStrip(scene, pal);

  // Ground: polished dark stone with glowing rune lines
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x1e1e30, 0x161628, 0x222238, 0x1a1a2e], rng);
  // Glowing rune lines
  g.lineStyle(2, 0x8040e0, 0.3);
  for (let i = 0; i < 12; i++) {
    const lx = rng() * STAGE_WIDTH;
    const ly = GROUND_MIN_Y + 10 + rng() * (GROUND_H - 20);
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(lx + 20 + rng() * 60, ly + rng() * 10 - 5);
    g.strokePath();
  }
  // Rune circles on ground
  g.lineStyle(1, 0xa060ff, 0.2);
  for (let i = 0; i < 5; i++) {
    const cx = rng() * STAGE_WIDTH;
    const cy = GROUND_MIN_Y + 20 + rng() * 50;
    g.strokeCircle(cx, cy, 8 + rng() * 12);
  }
  drawGroundEdges(g, pal);

  drawUnderground(scene, pal, rng);
}

function renderDarkSovereign(scene: Phaser.Scene, pal: BiomePalette, rng: () => number): void {
  drawSkyGradient(scene, pal);

  // Obsidian fortress backdrop
  const far = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(FAR_BG_DEPTH);
  // Dark fortress towers
  for (let i = 0; i < 6; i++) {
    const tx = rng() * (STAGE_WIDTH + 200) - 100;
    const th = 100 + rng() * 160;
    const tw = 30 + rng() * 40;
    far.fillStyle(0x1a0a0a, 0.7);
    far.fillRect(tx - tw / 2, GROUND_MIN_Y - th, tw, th);
    // Spire top
    far.fillTriangle(tx, GROUND_MIN_Y - th - 30, tx - tw / 2, GROUND_MIN_Y - th, tx + tw / 2, GROUND_MIN_Y - th);
    // Red glow windows
    far.fillStyle(0xff3010, 0.4);
    for (let w = 0; w < 3; w++) {
      far.fillRect(tx - 4, GROUND_MIN_Y - th + 20 + w * 30, 8, 6);
    }
  }

  // Chains hanging
  const chains = scene.add.graphics().setScrollFactor(0.45, 0).setDepth(MID_BG_DEPTH);
  for (let i = 0; i < 10; i++) {
    const cx = rng() * (STAGE_WIDTH + 200);
    const cy = 50 + rng() * 100;
    const cl = 80 + rng() * 100;
    chains.lineStyle(2, 0x4a4a4a, 0.4);
    chains.beginPath();
    chains.moveTo(cx, cy);
    // Catenary-like curve
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      const px = cx + t * 30 - 15;
      const py = cy + cl * (t - 0.5) * (t - 0.5) * 4 + cl * 0.2;
      chains.lineTo(px, py < cy + cl ? py : cy + cl);
    }
    chains.strokePath();
  }

  // Near: red glow from below
  const glow = scene.add.graphics().setScrollFactor(0.6, 0).setDepth(NEAR_BG_DEPTH);
  glow.fillStyle(0xff2000, 0.06);
  glow.fillRect(0, GROUND_MIN_Y - 60, 1400, 80);

  drawFogStrip(scene, { ...pal, fogColor: 0x3a0a0a, fogAlpha: 0.15 });

  // Ground: black stone with lava cracks
  const g = drawGroundBase(scene, pal);
  drawGroundDrift(g, [0x1e1a1a, 0x141010, 0x201818, 0x0e0a0a], rng);
  // Lava crack seams
  g.lineStyle(2, 0xff4010, 0.4);
  for (let i = 0; i < 15; i++) {
    const lx = rng() * STAGE_WIDTH;
    const ly = GROUND_MIN_Y + 5 + rng() * (GROUND_H - 10);
    g.beginPath();
    g.moveTo(lx, ly);
    let px = lx; let py = ly;
    for (let s = 0; s < 4; s++) {
      px += 5 + rng() * 20;
      py += rng() * 6 - 3;
      g.lineTo(px, py);
    }
    g.strokePath();
  }
  // Glow seams (wider, dimmer)
  for (let i = 0; i < 8; i++) {
    const sx = rng() * STAGE_WIDTH;
    const sy = GROUND_MIN_Y + 10 + rng() * (GROUND_H - 20);
    g.fillStyle(0xff2000, 0.12);
    g.fillEllipse(sx, sy, 30 + rng() * 50, 4);
  }
  drawGroundEdges(g, pal);

  // Underground with lava glow
  const ug = scene.add.graphics().setDepth(UNDERGROUND_DEPTH);
  ug.fillStyle(pal.undergroundFill, 1);
  ug.fillRect(0, GROUND_MAX_Y - 4, STAGE_WIDTH, 260);
  ug.fillStyle(0xff2000, 0.08);
  ug.fillRect(0, GROUND_MAX_Y - 4, STAGE_WIDTH, 40);
  // Lava pools
  for (let i = 0; i < 5; i++) {
    const lx = rng() * STAGE_WIDTH;
    const ly = GROUND_MAX_Y + 20 + rng() * 40;
    ug.fillStyle(0xff3010, 0.2);
    ug.fillEllipse(lx, ly, 40 + rng() * 60, 8 + rng() * 6);
    ug.fillStyle(0xff8020, 0.15);
    ug.fillEllipse(lx, ly, 20 + rng() * 30, 4);
  }
}

// ---------------------------------------------------------------------------
// Biome renderer dispatch
// ---------------------------------------------------------------------------
const RENDERERS: Record<BiomeId, (scene: Phaser.Scene, pal: BiomePalette, rng: () => number) => void> = {
  forest: renderForest,
  wildlands: renderWildlands,
  stone_march: renderStoneMarch,
  fortress: renderFortress,
  deep_caverns: renderDeepCaverns,
  mirelands: renderMirelands,
  highland: renderHighland,
  ruins: renderRuins,
  arcane: renderArcane,
  dark_sovereign: renderDarkSovereign,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class BiomeBuilder {
  buildBiome(scene: Phaser.Scene, biomeId: BiomeId): void {
    buildBiomeEnvironment(scene, biomeId);
  }
}

export function buildBiomeEnvironment(scene: Phaser.Scene, biomeId: BiomeId): void {
  const pal = PALETTES[biomeId];
  const rng = seededRandom(hashBiome(biomeId));
  const renderer = RENDERERS[biomeId];
  renderer(scene, pal, rng);
}

export function getBiomePalette(biomeId: BiomeId): BiomePalette {
  return PALETTES[biomeId];
}
