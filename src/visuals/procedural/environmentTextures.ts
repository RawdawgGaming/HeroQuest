// =============================================================================
// ENVIRONMENT TEXTURE GENERATORS
// =============================================================================
// All trees, rocks, ruins, grass, fences, ground patches, sky, and horizon
// silhouettes are rendered ONCE to Phaser CanvasTextures here, keyed under
// TextureKeys.ENV_*. The placement code in ForestStage just calls
// `scene.add.image(x, y, key)` and gets back a real bitmap that it can place
// into parallax layers.
//
// Every key in TextureKeys.ENV_* gets a procedural fallback below. When a
// real PNG is registered in textures.ts ASSET_FILES under that same key,
// Phaser's loader populates it first and these generators are skipped.

import Phaser from 'phaser';
import { TextureKeys } from '../textures';
import {
  paintEnvironmentTexture,
  canvasBlobPath,
  paintShape,
  paintTrunk,
  paintCanopy,
  paintRockBlob,
} from '../canvasParts';
import type { Pts } from '../paint';

// =============================================================================
// PALETTE — muted earthy tones for environment, saturation reserved for action
// =============================================================================
const TRUNK_BASE_NEAR = 0x4a3018;
const TRUNK_SH_NEAR   = 0x281408;
const TRUNK_HI_NEAR   = 0x6a4828;

const TRUNK_BASE_MID  = 0x3a2818;
const TRUNK_SH_MID    = 0x1e1208;
const TRUNK_HI_MID    = 0x553820;

const TRUNK_BASE_FAR  = 0x232838;
const TRUNK_SH_FAR    = 0x121622;
const TRUNK_HI_FAR    = 0x303848;

// Greens — desaturated for background, slightly more saturated as we get closer
const LEAF_NEAR_A = 0x355a35;
const LEAF_NEAR_B = 0x436834;
const LEAF_NEAR_SH = 0x1a3018;
const LEAF_NEAR_HI = 0x68904a;

const LEAF_MID_A = 0x2a4a2a;
const LEAF_MID_B = 0x35552c;
const LEAF_MID_SH = 0x142810;
const LEAF_MID_HI = 0x4a6a36;

const LEAF_FAR = 0x1a2a30;
const LEAF_FAR_SH = 0x0a181c;
const LEAF_FAR_HI = 0x2a3a44;

// Stone (rocks + ruins)
const STONE_BASE = 0x6c6a76;
const STONE_SH = 0x33333d;
const STONE_HI = 0x9a98a6;

const RUIN_BASE = 0x7a7484;
const RUIN_SH   = 0x3a3640;
const RUIN_HI   = 0xa6a0b0;

// Wood (logs / fences)
const WOOD_BASE = 0x6a4624;
const WOOD_SH   = 0x2c1808;
const WOOD_HI   = 0x946838;

// Earth ground patches
const EARTH_BASE = 0x6b5638;
const EARTH_SH   = 0x342414;
const EARTH_HI   = 0x8a7048;

// Vegetation small
const GRASS_BASE = 0x4a6630;
const GRASS_SH   = 0x1e2c10;
const GRASS_HI   = 0x6a8a40;
const GRASS_DEAD_BASE = 0x6a5a20;
const GRASS_DEAD_SH   = 0x342818;
const GRASS_DEAD_HI   = 0x8a7438;

// =============================================================================
// TREE GENERATORS
// =============================================================================
// Each tree is composed of (1) a tapered trunk + (2) several overlapping
// canopy blobs + optional cel-shade darker bottom. Texture sizes vary so
// foreground trees are bigger than far ones.

function paintNearTree(
  scene: Phaser.Scene, key: string, seed: number,
  variant: 'A' | 'B' | 'C' | 'D' | 'E',
): string {
  // 140 wide × 200 tall — trunk vertical center, canopy at top
  return paintEnvironmentTexture(scene, key, 140, 200, (ctx, w, h) => {
    // Seed the RNG path so this variant is stable per call
    void seed;
    const trunkH = 90 + Math.random() * 20;
    const trunkBaseY = h - 8;
    const trunkBaseW = 16 + Math.random() * 4;
    const trunkTopW = 10 + Math.random() * 2;
    const cx = w / 2 + (Math.random() - 0.5) * 6;

    // Trunk
    paintTrunk(ctx, cx, trunkBaseY, trunkH, trunkBaseW, trunkTopW,
      TRUNK_BASE_NEAR, TRUNK_SH_NEAR, TRUNK_HI_NEAR);

    // Trunk knot detail (small organic blob with darker fill)
    if (variant === 'B' || variant === 'D') {
      const knotG = canvasBlobPath(cx + 2, trunkBaseY - trunkH * 0.45, 2.5, 1.8, 6, 0.4);
      paintShape(ctx, knotG, TRUNK_SH_NEAR, TRUNK_SH_NEAR, TRUNK_HI_NEAR, {
        noise: 16, brushCount: 0, outlineWeight: 1.0, outlineJitter: 0.4,
        outlinePasses: 1, shadowAlpha: 0.2, highlightAlpha: 0.2,
      });
    }

    // Canopy — 3-5 overlapping blobs with varied tone
    const canopyCenterY = trunkBaseY - trunkH - 18;
    const blobs = variant === 'A' ? 4 : variant === 'B' ? 5 : 4;
    for (let i = 0; i < blobs; i++) {
      const offX = (i - blobs / 2) * 14 + (Math.random() - 0.5) * 8;
      const offY = (i % 2 === 0 ? -8 : 4) + (Math.random() - 0.5) * 6;
      const rx = 22 + Math.random() * 12;
      const ry = 20 + Math.random() * 8;
      const tone = i % 2 === 0 ? LEAF_NEAR_A : LEAF_NEAR_B;
      paintCanopy(ctx, cx + offX, canopyCenterY + offY, rx, ry,
        tone, LEAF_NEAR_SH, LEAF_NEAR_HI,
        { sides: 12 + Math.floor(Math.random() * 4), jitter: 0.32 });
    }

    // Optional cel-shade darker bottom of canopy
    paintCanopy(ctx, cx, canopyCenterY + 10, 30, 12,
      LEAF_NEAR_SH, LEAF_NEAR_SH, LEAF_NEAR_A,
      { sides: 11, jitter: 0.4 });
  });
}

function paintMidTree(
  scene: Phaser.Scene, key: string, seed: number,
  variant: 'A' | 'B' | 'C' | 'D',
): string {
  return paintEnvironmentTexture(scene, key, 110, 160, (ctx, w, h) => {
    void seed;
    const trunkH = 70 + Math.random() * 20;
    const trunkBaseY = h - 6;
    const cx = w / 2 + (Math.random() - 0.5) * 4;

    paintTrunk(ctx, cx, trunkBaseY, trunkH, 12, 8,
      TRUNK_BASE_MID, TRUNK_SH_MID, TRUNK_HI_MID);

    const canopyCenterY = trunkBaseY - trunkH - 14;
    const blobs = variant === 'A' || variant === 'C' ? 3 : 4;
    for (let i = 0; i < blobs; i++) {
      const offX = (i - blobs / 2) * 12 + (Math.random() - 0.5) * 6;
      const offY = (i % 2 === 0 ? -6 : 2) + (Math.random() - 0.5) * 4;
      const rx = 18 + Math.random() * 8;
      const ry = 16 + Math.random() * 6;
      const tone = i % 2 === 0 ? LEAF_MID_A : LEAF_MID_B;
      paintCanopy(ctx, cx + offX, canopyCenterY + offY, rx, ry,
        tone, LEAF_MID_SH, LEAF_MID_HI,
        { sides: 11, jitter: 0.32 });
    }
  });
}

function paintFarTree(
  scene: Phaser.Scene, key: string, seed: number,
): string {
  return paintEnvironmentTexture(scene, key, 80, 120, (ctx, w, h) => {
    void seed;
    const trunkH = 50 + Math.random() * 16;
    const trunkBaseY = h - 4;
    const cx = w / 2;

    paintTrunk(ctx, cx, trunkBaseY, trunkH, 8, 6,
      TRUNK_BASE_FAR, TRUNK_SH_FAR, TRUNK_HI_FAR);

    const canopyCenterY = trunkBaseY - trunkH - 10;
    for (let i = 0; i < 3; i++) {
      const offX = (i - 1) * 9 + (Math.random() - 0.5) * 4;
      const offY = (i % 2 === 0 ? -4 : 1) + (Math.random() - 0.5) * 3;
      paintCanopy(ctx, cx + offX, canopyCenterY + offY,
        14 + Math.random() * 6, 13 + Math.random() * 5,
        LEAF_FAR, LEAF_FAR_SH, LEAF_FAR_HI,
        { sides: 10, jitter: 0.28 });
    }
  });
}

// =============================================================================
// ROCK GENERATORS
// =============================================================================

function paintRock(
  scene: Phaser.Scene, key: string,
  width: number, height: number,
  base: number, shadow: number, highlight: number,
): string {
  return paintEnvironmentTexture(scene, key, width, height, (ctx, w, h) => {
    paintRockBlob(ctx, w / 2, h / 2 + 2, w / 2 - 4, h / 2 - 4,
      base, shadow, highlight,
      { sides: 9, jitter: 0.42, outlineWeight: 2.0 });
    // Smaller rock chip leaning against the main rock
    if (Math.random() > 0.4) {
      paintRockBlob(ctx, w * 0.7, h - 4, w * 0.18, h * 0.2,
        base, shadow, highlight,
        { sides: 7, jitter: 0.35, outlineWeight: 1.5 });
    }
  });
}

// =============================================================================
// LOG / WOOD DEBRIS GENERATORS
// =============================================================================

function paintLog(
  scene: Phaser.Scene, key: string,
  width: number, height: number,
): string {
  return paintEnvironmentTexture(scene, key, width, height, (ctx, w, h) => {
    // Horizontal log: rounded rectangle made from a polygon
    const cy = h / 2;
    const leftX = 6;
    const rightX = w - 6;
    const halfH = h / 2 - 4;
    const pts: Pts = [
      { x: leftX, y: cy - halfH },
      { x: rightX - 4, y: cy - halfH - 1 },
      { x: rightX, y: cy - 2 },
      { x: rightX - 4, y: cy + halfH + 1 },
      { x: leftX, y: cy + halfH },
      { x: leftX - 4, y: cy + 2 },
    ];
    paintShape(ctx, pts, WOOD_BASE, WOOD_SH, WOOD_HI, {
      noise: 28, brushCount: 8, brushAlpha: 0.22,
      outlineWeight: 1.8, outlineJitter: 0.6, outlinePasses: 2,
      shadowAlpha: 0.42, shadowExtent: 0.55,
      highlightAlpha: 0.32, highlightExtent: 0.18,
    });
    // End cap (circular cross-section on left side)
    paintRockBlob(ctx, leftX, cy, 6, 6, WOOD_BASE, WOOD_SH, WOOD_HI,
      { sides: 10, jitter: 0.18, outlineWeight: 1.5 });
    // Inner ring on cap
    ctx.strokeStyle = `rgba(${(WOOD_SH >> 16) & 0xff},${(WOOD_SH >> 8) & 0xff},${WOOD_SH & 0xff},0.7)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(leftX, cy, 3, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function paintPlank(scene: Phaser.Scene, key: string): string {
  return paintEnvironmentTexture(scene, key, 70, 16, (ctx, w, h) => {
    const pts: Pts = [
      { x: 4, y: 3 },
      { x: w - 6, y: 4 },
      { x: w - 4, y: h - 5 },
      { x: 6, y: h - 4 },
    ];
    paintShape(ctx, pts, WOOD_BASE, WOOD_SH, WOOD_HI, {
      noise: 24, brushCount: 6,
      outlineWeight: 1.6, outlineJitter: 0.5,
      shadowAlpha: 0.42, highlightAlpha: 0.32,
    });
  });
}

// =============================================================================
// FENCE GENERATORS — broken / leaning fence posts
// =============================================================================

function paintFencePost(scene: Phaser.Scene, key: string, lean: number = 0): string {
  return paintEnvironmentTexture(scene, key, 30, 60, (ctx, w, h) => {
    const cx = w / 2 + lean * 4;
    const topX = w / 2 - lean * 4;
    const pts: Pts = [
      { x: cx - 5, y: h - 4 },
      { x: cx + 5, y: h - 4 },
      { x: topX + 4, y: 6 },
      { x: topX - 4, y: 6 },
    ];
    paintShape(ctx, pts, WOOD_BASE, WOOD_SH, WOOD_HI, {
      noise: 26, brushCount: 6,
      outlineWeight: 1.8, outlineJitter: 0.6,
      shadowAlpha: 0.45, highlightAlpha: 0.32,
    });
    // Top cap
    const capPts = canvasBlobPath(topX, 6, 5, 2.5, 8, 0.2);
    paintShape(ctx, capPts, WOOD_BASE, WOOD_SH, WOOD_HI, {
      noise: 18, brushCount: 0, outlineWeight: 1.4,
      shadowAlpha: 0.32, highlightAlpha: 0.42,
    });
  });
}

function paintFenceBroken(scene: Phaser.Scene, key: string): string {
  return paintEnvironmentTexture(scene, key, 30, 36, (ctx, w, h) => {
    const cx = w / 2 - 2;
    // Jagged broken top
    const pts: Pts = [
      { x: cx - 5, y: h - 4 },
      { x: cx + 5, y: h - 4 },
      { x: cx + 5, y: 18 },
      { x: cx + 3, y: 12 },
      { x: cx + 1, y: 16 },
      { x: cx - 2, y: 10 },
      { x: cx - 5, y: 14 },
    ];
    paintShape(ctx, pts, WOOD_BASE, WOOD_SH, WOOD_HI, {
      noise: 26, brushCount: 5,
      outlineWeight: 1.8, outlineJitter: 0.6,
      shadowAlpha: 0.45, highlightAlpha: 0.32,
    });
  });
}

// =============================================================================
// RUIN GENERATORS — pillars, broken arches, fallen blocks, walls
// =============================================================================

function paintRuinPillar(scene: Phaser.Scene, key: string): string {
  return paintEnvironmentTexture(scene, key, 60, 140, (ctx, w, h) => {
    const cx = w / 2;
    // Shaft
    const shaftPts: Pts = [
      { x: cx - 12, y: h - 4 },
      { x: cx + 12, y: h - 4 },
      { x: cx + 11, y: 30 },
      { x: cx - 11, y: 30 },
    ];
    paintShape(ctx, shaftPts, RUIN_BASE, RUIN_SH, RUIN_HI, {
      noise: 28, brushCount: 8, brushAlpha: 0.22,
      outlineWeight: 2.0, outlineJitter: 0.7, outlinePasses: 2,
      shadowAlpha: 0.45, shadowExtent: 0.55,
      highlightAlpha: 0.36, highlightExtent: 0.18,
    });
    // Capital (top wider block)
    const capPts: Pts = [
      { x: cx - 16, y: 30 },
      { x: cx + 16, y: 30 },
      { x: cx + 18, y: 22 },
      { x: cx + 14, y: 14 },
      { x: cx - 14, y: 14 },
      { x: cx - 18, y: 22 },
    ];
    paintShape(ctx, capPts, RUIN_BASE, RUIN_SH, RUIN_HI, {
      noise: 24, brushCount: 6,
      outlineWeight: 2.0, outlineJitter: 0.6, outlinePasses: 2,
      shadowAlpha: 0.45, shadowExtent: 0.5,
      highlightAlpha: 0.42, highlightExtent: 0.30,
    });
    // Crack in the shaft
    ctx.strokeStyle = `rgba(${(RUIN_SH >> 16) & 0xff},${(RUIN_SH >> 8) & 0xff},${RUIN_SH & 0xff},0.7)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 50);
    ctx.lineTo(cx + 2, 70);
    ctx.lineTo(cx - 3, 90);
    ctx.lineTo(cx + 4, 110);
    ctx.stroke();
  });
}

function paintRuinArch(scene: Phaser.Scene, key: string): string {
  return paintEnvironmentTexture(scene, key, 90, 100, (ctx, w, h) => {
    // Left half of a broken arch — vertical column with curved top fragment
    const pts: Pts = [
      { x: 8, y: h - 6 },
      { x: 24, y: h - 6 },
      { x: 26, y: 46 },
      { x: 36, y: 28 },
      { x: 50, y: 18 },
      { x: 56, y: 24 },
      { x: 44, y: 36 },
      { x: 32, y: 52 },
      { x: 28, y: h - 6 },
    ];
    paintShape(ctx, pts, RUIN_BASE, RUIN_SH, RUIN_HI, {
      noise: 30, brushCount: 8,
      outlineWeight: 2.2, outlineJitter: 0.7, outlinePasses: 2,
      shadowAlpha: 0.45, shadowExtent: 0.55,
      highlightAlpha: 0.36, highlightExtent: 0.20,
    });
  });
}

function paintRuinBlock(scene: Phaser.Scene, key: string): string {
  return paintEnvironmentTexture(scene, key, 56, 36, (ctx, w, h) => {
    const pts: Pts = [
      { x: 4, y: h - 4 },
      { x: w - 6, y: h - 6 },
      { x: w - 4, y: 8 },
      { x: 8, y: 6 },
    ];
    paintShape(ctx, pts, RUIN_BASE, RUIN_SH, RUIN_HI, {
      noise: 28, brushCount: 6,
      outlineWeight: 1.8, outlineJitter: 0.6,
      shadowAlpha: 0.45, shadowExtent: 0.55,
      highlightAlpha: 0.42, highlightExtent: 0.25,
    });
  });
}

function paintRuinWall(scene: Phaser.Scene, key: string): string {
  return paintEnvironmentTexture(scene, key, 130, 80, (ctx, w, h) => {
    // Crumbling wall with uneven top
    const pts: Pts = [
      { x: 6, y: h - 4 },
      { x: w - 6, y: h - 4 },
      { x: w - 8, y: 40 },
      { x: w - 18, y: 28 },
      { x: w - 36, y: 36 },
      { x: w - 56, y: 22 },
      { x: w - 76, y: 30 },
      { x: w - 96, y: 18 },
      { x: 18, y: 32 },
      { x: 8, y: 26 },
    ];
    paintShape(ctx, pts, RUIN_BASE, RUIN_SH, RUIN_HI, {
      noise: 30, brushCount: 12,
      outlineWeight: 2.0, outlineJitter: 0.7, outlinePasses: 2,
      shadowAlpha: 0.45, shadowExtent: 0.50,
      highlightAlpha: 0.32, highlightExtent: 0.22,
    });
  });
}

// =============================================================================
// VEGETATION
// =============================================================================

function paintGrassClump(scene: Phaser.Scene, key: string, dead: boolean = false): string {
  return paintEnvironmentTexture(scene, key, 24, 18, (ctx, w, h) => {
    const base = dead ? GRASS_DEAD_BASE : GRASS_BASE;
    const shadow = dead ? GRASS_DEAD_SH : GRASS_SH;
    const highlight = dead ? GRASS_DEAD_HI : GRASS_HI;
    // 5-7 small triangle blades
    const blades = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < blades; i++) {
      const bx = 4 + (i / blades) * (w - 8) + (Math.random() - 0.5) * 2;
      const tipY = 4 + Math.random() * 4;
      const baseY = h - 3;
      const pts: Pts = [
        { x: bx - 1.4, y: baseY },
        { x: bx + 1.4, y: baseY },
        { x: bx + (Math.random() - 0.5) * 1.5, y: tipY },
      ];
      paintShape(ctx, pts, base, shadow, highlight, {
        noise: 14, brushCount: 0,
        outlineWeight: 1.0, outlineJitter: 0.3, outlinePasses: 1,
        shadowAlpha: 0.30, highlightAlpha: 0.30,
      });
    }
  });
}

function paintBush(scene: Phaser.Scene, key: string): string {
  return paintEnvironmentTexture(scene, key, 50, 32, (ctx, w, h) => {
    const cy = h - 8;
    // 3 overlapping foliage blobs
    paintCanopy(ctx, w * 0.3, cy, 14, 10, LEAF_NEAR_A, LEAF_NEAR_SH, LEAF_NEAR_HI,
      { sides: 10, jitter: 0.35 });
    paintCanopy(ctx, w * 0.6, cy - 2, 16, 12, LEAF_NEAR_B, LEAF_NEAR_SH, LEAF_NEAR_HI,
      { sides: 11, jitter: 0.32 });
    paintCanopy(ctx, w * 0.4, cy - 4, 12, 10, LEAF_NEAR_A, LEAF_NEAR_SH, LEAF_NEAR_HI,
      { sides: 10, jitter: 0.32 });
  });
}

// =============================================================================
// GROUND PATCHES
// =============================================================================
// Painted dirt patches with darker shadow underside, top highlight, and small
// debris silhouettes baked into the texture.

function paintGroundPatch(scene: Phaser.Scene, key: string, variant: 'A' | 'B' | 'C'): string {
  const w = 120;
  const h = 36;
  return paintEnvironmentTexture(scene, key, w, h, (ctx, _w, _h) => {
    // Main organic patch
    const pts = canvasBlobPath(w / 2, h / 2 + 3, w / 2 - 6, h / 2 - 4, 11, 0.28);
    paintShape(ctx, pts, EARTH_BASE, EARTH_SH, EARTH_HI, {
      noise: 32, brushCount: 12, brushAlpha: 0.20,
      outlineWeight: 0,  // patches blend into the ground
      shadowAlpha: 0.50, shadowExtent: 0.60,
      highlightAlpha: 0.42, highlightExtent: 0.18,
    });

    // Bake in 4-7 small debris specks (pebbles, twigs)
    const debris = variant === 'C' ? 7 : variant === 'B' ? 5 : 4;
    for (let i = 0; i < debris; i++) {
      const dx = 10 + Math.random() * (w - 20);
      const dy = 6 + Math.random() * (h - 12);
      const dr = 1 + Math.random() * 2;
      const dpts = canvasBlobPath(dx, dy, dr, dr * 0.7, 6, 0.4);
      paintShape(ctx, dpts, STONE_BASE, STONE_SH, STONE_HI, {
        noise: 12, brushCount: 0,
        outlineWeight: 0.8, outlineJitter: 0.3, outlinePasses: 1,
        shadowAlpha: 0.4, highlightAlpha: 0.3,
      });
    }
    // Twig
    if (variant === 'A' || variant === 'C') {
      ctx.strokeStyle = `rgba(${(WOOD_SH >> 16) & 0xff},${(WOOD_SH >> 8) & 0xff},${WOOD_SH & 0xff},0.85)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(20 + Math.random() * (w - 40), 8 + Math.random() * (h - 16));
      ctx.lineTo(30 + Math.random() * (w - 40), 14 + Math.random() * (h - 16));
      ctx.stroke();
    }
  });
}

// =============================================================================
// HORIZON SILHOUETTE BAND — distant mountain/structure layer
// =============================================================================

function paintHorizonBand(scene: Phaser.Scene, key: string): string {
  // 1280 wide band roughly camera-width that tiles for the far parallax layer
  const w = 1280;
  const h = 200;
  return paintEnvironmentTexture(scene, key, w, h, (ctx, w2, h2) => {
    // Build a jagged silhouette polygon spanning the band
    const pts: Pts = [{ x: -10, y: h2 + 10 }];
    const peakCount = 16;
    const stepX = (w2 + 20) / peakCount;
    for (let i = 0; i <= peakCount; i++) {
      const x = -10 + i * stepX;
      const y = h2 - 60 - Math.random() * 100 - (i % 4 === 0 ? 30 : 0);
      pts.push({ x, y });
    }
    pts.push({ x: w2 + 10, y: h2 + 10 });

    // Fill (no outline so it reads as a silhouette)
    ctx.fillStyle = `rgba(${(0x3a4458 >> 16) & 0xff},${(0x3a4458 >> 8) & 0xff},${0x3a4458 & 0xff},0.9)`;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();

    // Subtle highlight band along the silhouette top (rim light)
    ctx.strokeStyle = `rgba(180,190,210,0.35)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    for (let i = 2; i < pts.length - 1; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // Distant scattered structural shapes (broken towers / huts) on top of mountains
    for (let i = 0; i < 5; i++) {
      const sx = 100 + Math.random() * (w2 - 200);
      const sy = h2 - 80 - Math.random() * 40;
      const sw = 8 + Math.random() * 14;
      const sh = 18 + Math.random() * 30;
      ctx.fillStyle = `rgba(40,46,60,0.85)`;
      ctx.beginPath();
      ctx.moveTo(sx - sw / 2, sy + sh);
      ctx.lineTo(sx - sw / 2, sy);
      ctx.lineTo(sx, sy - sh * 0.2);
      ctx.lineTo(sx + sw / 2, sy);
      ctx.lineTo(sx + sw / 2, sy + sh);
      ctx.closePath();
      ctx.fill();
    }

    // Per-pixel noise across the silhouette
    const img = ctx.getImageData(0, 0, w2, h2);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 0) continue;
      const n = (Math.random() - 0.5) * 16;
      img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
  });
}

// =============================================================================
// SKY GRADIENT TEXTURE
// =============================================================================
// Painted sky with warm horizon → cool zenith gradient + sun glow + cloud
// streaks. Used as a single tileable backdrop instead of multi-band rectangles.

function paintSkyGradient(scene: Phaser.Scene, key: string): string {
  const w = 256;
  const h = 720;
  return paintEnvironmentTexture(scene, key, w, h, (ctx, w2, h2) => {
    // Vertical gradient via Canvas API
    const grad = ctx.createLinearGradient(0, 0, 0, h2);
    grad.addColorStop(0.00, '#344a78'); // upper sky cool
    grad.addColorStop(0.30, '#4c5a82');
    grad.addColorStop(0.55, '#947a82');
    grad.addColorStop(0.75, '#c89674');
    grad.addColorStop(0.95, '#e8b070');
    grad.addColorStop(1.00, '#e8c478'); // dawn warm horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w2, h2);

    // Soft cloud streaks
    for (let i = 0; i < 6; i++) {
      const cx = Math.random() * w2;
      const cy = 80 + Math.random() * 280;
      const cw = 60 + Math.random() * 80;
      const ch = 6 + Math.random() * 10;
      ctx.fillStyle = `rgba(255,240,210,${0.10 + Math.random() * 0.10})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Apply subtle per-pixel noise
    const img = ctx.getImageData(0, 0, w2, h2);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
  });
}

// =============================================================================
// PUBLIC: ensure all environment textures exist
// =============================================================================

export function ensureEnvironmentTextures(scene: Phaser.Scene): void {
  // Trees
  paintNearTree(scene, TextureKeys.ENV_TREE_NEAR_A, 1, 'A');
  paintNearTree(scene, TextureKeys.ENV_TREE_NEAR_B, 2, 'B');
  paintNearTree(scene, TextureKeys.ENV_TREE_NEAR_C, 3, 'C');
  paintNearTree(scene, TextureKeys.ENV_TREE_NEAR_D, 4, 'D');
  paintNearTree(scene, TextureKeys.ENV_TREE_NEAR_E, 5, 'E');
  paintMidTree(scene, TextureKeys.ENV_TREE_MID_A, 11, 'A');
  paintMidTree(scene, TextureKeys.ENV_TREE_MID_B, 12, 'B');
  paintMidTree(scene, TextureKeys.ENV_TREE_MID_C, 13, 'C');
  paintMidTree(scene, TextureKeys.ENV_TREE_MID_D, 14, 'D');
  paintFarTree(scene, TextureKeys.ENV_TREE_FAR_A, 21);
  paintFarTree(scene, TextureKeys.ENV_TREE_FAR_B, 22);
  paintFarTree(scene, TextureKeys.ENV_TREE_FAR_C, 23);

  // Rocks
  paintRock(scene, TextureKeys.ENV_ROCK_A, 60, 36, STONE_BASE, STONE_SH, STONE_HI);
  paintRock(scene, TextureKeys.ENV_ROCK_B, 80, 44, STONE_BASE, STONE_SH, STONE_HI);
  paintRock(scene, TextureKeys.ENV_ROCK_C, 50, 30, 0x6a5e44, 0x2a2418, 0x9a8a68);
  paintRock(scene, TextureKeys.ENV_ROCK_D, 70, 40, STONE_BASE, STONE_SH, STONE_HI);
  paintRock(scene, TextureKeys.ENV_ROCK_SMALL, 28, 18, STONE_BASE, STONE_SH, STONE_HI);

  // Logs / planks
  paintLog(scene, TextureKeys.ENV_LOG_A, 90, 28);
  paintLog(scene, TextureKeys.ENV_LOG_B, 70, 22);
  paintPlank(scene, TextureKeys.ENV_PLANK);

  // Fences
  paintFencePost(scene, TextureKeys.ENV_FENCE_POST, 0);
  paintFencePost(scene, TextureKeys.ENV_FENCE_LEAN, 0.25);
  paintFenceBroken(scene, TextureKeys.ENV_FENCE_BROKEN);

  // Ruins
  paintRuinPillar(scene, TextureKeys.ENV_RUIN_PILLAR);
  paintRuinArch(scene, TextureKeys.ENV_RUIN_ARCH);
  paintRuinBlock(scene, TextureKeys.ENV_RUIN_BLOCK);
  paintRuinWall(scene, TextureKeys.ENV_RUIN_WALL);

  // Vegetation
  paintGrassClump(scene, TextureKeys.ENV_GRASS_A, false);
  paintGrassClump(scene, TextureKeys.ENV_GRASS_B, false);
  paintGrassClump(scene, TextureKeys.ENV_GRASS_DEAD, true);
  paintBush(scene, TextureKeys.ENV_BUSH);

  // Ground patches
  paintGroundPatch(scene, TextureKeys.ENV_GROUND_PATCH_A, 'A');
  paintGroundPatch(scene, TextureKeys.ENV_GROUND_PATCH_B, 'B');
  paintGroundPatch(scene, TextureKeys.ENV_GROUND_PATCH_C, 'C');

  // Horizon silhouette band + sky
  paintHorizonBand(scene, TextureKeys.ENV_BG_HORIZON);
  paintSkyGradient(scene, TextureKeys.ENV_SKY_GRADIENT);
}
