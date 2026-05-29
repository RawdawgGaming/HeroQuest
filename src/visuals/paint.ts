// =============================================================================
// PAINT — hand-drawn cartoon rendering helpers
// =============================================================================
// The "outlined primitives" approach hits a hard ceiling because Phaser's
// Rectangle/Circle/Triangle are mathematically perfect vector shapes — there
// is no way to make them irregular. To get closer to a hand-drawn brawler
// look we have to abandon primitives and draw EVERY body part as a Graphics
// polygon path with controlled jitter and multi-pass strokes.
//
// This module provides:
//   - Pt / Pts                : tiny point types
//   - jitterPoints()          : add small random offsets to a polygon path
//   - shakyStroke()           : draw the same outline 2-3x at small offsets
//                               for a "boiling" hand-drawn line look
//   - filledShape()           : fill + outline a polygon in one call
//   - paintedBlob()           : organic ellipse-ish blob via fillPoints
//   - blobPath()              : returns Pts of an irregular blob (for FX)
//   - chunkyStroke()          : tapered organic stroke between two points
//   - getOrCreateNoise()      : generates a noise CanvasTexture once and caches
//
// Everything here works with Phaser.GameObjects.Graphics — caller adds the
// Graphics to a container.

import Phaser from 'phaser';

export interface Pt { x: number; y: number; }
export type Pts = Pt[];

// Standard ink color used for all outlines — re-exported by ink.ts
export const INK = 0x1a1a22;

// =============================================================================
// JITTER
// =============================================================================
// Add small random offsets to a polygon path so it stops looking mathematically
// perfect. Use a deterministic per-call seed offset so re-renders look the same.

export function jitterPoints(points: Pts, amount: number, seed: number = 0): Pts {
  // Mulberry32 mini PRNG so the same seed → same jitter
  let s = seed | 0;
  const rng = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return points.map((p) => ({
    x: p.x + (rng() - 0.5) * amount * 2,
    y: p.y + (rng() - 0.5) * amount * 2,
  }));
}

// =============================================================================
// SHAKY STROKE
// =============================================================================
// Draw an outline multiple times at slightly offset jitter values. Each pass
// uses a slightly different seed so the lines don't perfectly overlap — that's
// what gives the "boiling" hand-drawn ink line look.
//
// Recommended: 2 passes for body parts, 3 passes for hero outlines.

export function shakyStroke(
  g: Phaser.GameObjects.Graphics,
  points: Pts,
  weight: number,
  color: number,
  options: {
    passes?: number;
    jitter?: number;
    closed?: boolean;
    alpha?: number;
    seed?: number;
  } = {},
): void {
  const {
    passes = 2,
    jitter = 0.7,
    closed = true,
    alpha = 1,
    seed = 1,
  } = options;
  for (let i = 0; i < passes; i++) {
    const jp = jitterPoints(points, jitter, seed + i * 31);
    g.lineStyle(weight, color, alpha);
    g.strokePoints(jp, closed, closed);
  }
}

// =============================================================================
// FILLED SHAPE — organic polygon with fill + shaky outline in one call
// =============================================================================

export function filledShape(
  g: Phaser.GameObjects.Graphics,
  points: Pts,
  fill: number,
  options: {
    fillAlpha?: number;
    outline?: boolean;
    outlineColor?: number;
    outlineWeight?: number;
    outlineJitter?: number;
    outlinePasses?: number;
    seed?: number;
  } = {},
): void {
  const {
    fillAlpha = 1,
    outline = true,
    outlineColor = INK,
    outlineWeight = 1.6,
    outlineJitter = 0.6,
    outlinePasses = 2,
    seed = 1,
  } = options;
  g.fillStyle(fill, fillAlpha);
  g.fillPoints(points, true);
  if (outline) {
    shakyStroke(g, points, outlineWeight, outlineColor, {
      passes: outlinePasses,
      jitter: outlineJitter,
      seed,
    });
  }
}

// =============================================================================
// BLOB PATH — irregular organic ellipse-shape used for hits, dust, etc.
// =============================================================================
// Generates an N-sided polygon approximating an ellipse with each vertex
// pushed in/out by a small random amount.

export function blobPath(
  cx: number, cy: number,
  rx: number, ry: number,
  options: { sides?: number; jitter?: number; seed?: number } = {},
): Pts {
  const { sides = 12, jitter = 0.18, seed = 1 } = options;
  let s = seed | 0;
  const rng = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pts: Pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const wobble = 1 + (rng() - 0.5) * jitter * 2;
    pts.push({
      x: cx + Math.cos(angle) * rx * wobble,
      y: cy + Math.sin(angle) * ry * wobble,
    });
  }
  return pts;
}

// =============================================================================
// PAINTED BLOB — fills an organic ellipse-ish blob
// =============================================================================

export function paintedBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  fill: number,
  options: {
    fillAlpha?: number;
    sides?: number;
    jitter?: number;
    seed?: number;
    outline?: boolean;
    outlineWeight?: number;
    outlineColor?: number;
  } = {},
): void {
  const {
    fillAlpha = 1,
    sides = 12,
    jitter = 0.18,
    seed = 1,
    outline = true,
    outlineWeight = 1.4,
    outlineColor = INK,
  } = options;
  const pts = blobPath(cx, cy, rx, ry, { sides, jitter, seed });
  g.fillStyle(fill, fillAlpha);
  g.fillPoints(pts, true);
  if (outline) {
    shakyStroke(g, pts, outlineWeight, outlineColor, {
      passes: 2,
      jitter: 0.4,
      seed: seed + 7,
    });
  }
}

// =============================================================================
// CHUNKY STROKE — organic tapered line between two points (used for limbs)
// =============================================================================
// Builds a tapered quad polygon between A and B. Width can taper from start
// to end. Used for arms, legs, capes, etc. so they don't look like rectangles.

export function chunkyLimb(
  g: Phaser.GameObjects.Graphics,
  ax: number, ay: number,
  bx: number, by: number,
  startWidth: number,
  endWidth: number,
  fill: number,
  options: {
    outline?: boolean;
    outlineWeight?: number;
    outlineColor?: number;
    seed?: number;
  } = {},
): Pts {
  const { outline = true, outlineWeight = 1.5, outlineColor = INK, seed = 1 } = options;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // perpendicular
  const ny = dx / len;
  const pts: Pts = [
    { x: ax + nx * startWidth / 2, y: ay + ny * startWidth / 2 },
    { x: bx + nx * endWidth   / 2, y: by + ny * endWidth   / 2 },
    { x: bx - nx * endWidth   / 2, y: by - ny * endWidth   / 2 },
    { x: ax - nx * startWidth / 2, y: ay - ny * startWidth / 2 },
  ];
  // Slight jitter on the side points so the limb edges aren't perfectly straight
  const jp = jitterPoints(pts, 0.5, seed);
  g.fillStyle(fill, 1);
  g.fillPoints(jp, true);
  if (outline) {
    shakyStroke(g, jp, outlineWeight, outlineColor, {
      passes: 2,
      jitter: 0.3,
      seed: seed + 11,
    });
  }
  return jp;
}

// =============================================================================
// PROCEDURAL NOISE TEXTURE
// =============================================================================
// Generates a small grayscale noise CanvasTexture once and caches it under a
// scene texture key so callers can use it as a tileSprite or mask. This is
// the cheapest way to fake "painted" surface variation without external art.

export function getOrCreateNoise(
  scene: Phaser.Scene,
  key: string = 'paint-noise',
  size: number = 96,
  baseValue: number = 230,
  range: number = 30,
  alpha: number = 28,
): Phaser.Textures.CanvasTexture {
  const tex = scene.textures.exists(key)
    ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture)
    : scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = baseValue + Math.floor(Math.random() * range);
    img.data[i]     = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return tex;
}

// =============================================================================
// HALFTONE / DOT-PATTERN TEXTURE
// =============================================================================
// Generates a sparse-dot pattern texture. Used as a subtle stipple shading
// overlay on torso/cape pieces to imply hand-drawn hatching.

export function getOrCreateStipple(
  scene: Phaser.Scene,
  key: string = 'paint-stipple',
  size: number = 64,
  density: number = 0.06,
  alpha: number = 80,
): Phaser.Textures.CanvasTexture {
  const tex = scene.textures.exists(key)
    ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture)
    : scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = `rgba(0,0,0,${alpha / 255})`;
  for (let i = 0; i < size * size * density; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    ctx.fillRect(x, y, 1, 1);
  }
  tex.refresh();
  return tex;
}

// =============================================================================
// HAND-AUTHORED ORGANIC SHAPES
// =============================================================================
// Pre-built point sets for shapes that come up across the game. These are
// shaped to LOOK organic — irregular, tapered, asymmetric.

/** A rounded shield-shape kite (asymmetric kite) */
export function kiteShieldPath(scale: number = 1): Pts {
  return [
    { x: -8 * scale,  y: -1 * scale },
    { x: -4 * scale,  y: -3 * scale },
    { x:  3 * scale,  y: -3 * scale },
    { x:  7 * scale,  y:  0 * scale },
    { x:  6 * scale,  y:  10 * scale },
    { x:  3 * scale,  y:  20 * scale },
    { x: -2 * scale,  y:  26 * scale },
    { x: -6 * scale,  y:  20 * scale },
    { x: -8 * scale,  y:  10 * scale },
  ];
}

/** Hand-shaped pauldron — asymmetric chunky cap */
export function pauldronPath(side: number = 1, scale: number = 1): Pts {
  // side: -1 = left, 1 = right
  return [
    { x: -7 * scale * side, y: -2 * scale },
    { x: -5 * scale * side, y: -7 * scale },
    { x:  0 * scale,        y: -8 * scale },
    { x:  6 * scale * side, y: -6 * scale },
    { x:  7 * scale * side, y:  2 * scale },
    { x:  5 * scale * side, y:  6 * scale },
    { x: -2 * scale * side, y:  6 * scale },
    { x: -7 * scale * side, y:  3 * scale },
  ];
}

/** Organic helm/skull shape — chunky bucket with a slight asymmetry */
export function helmPath(scale: number = 1): Pts {
  return [
    { x: -13 * scale, y: -10 * scale },
    { x: -11 * scale, y: -12 * scale },
    { x:  10 * scale, y: -12 * scale },
    { x:  13 * scale, y: -9 * scale },
    { x:  14 * scale, y: -3 * scale },
    { x:  13 * scale, y:  6 * scale },
    { x:  11 * scale, y:  10 * scale },
    { x:  6 * scale,  y:  12 * scale },
    { x: -8 * scale,  y:  12 * scale },
    { x: -12 * scale, y:  10 * scale },
    { x: -14 * scale, y:  4 * scale },
    { x: -14 * scale, y: -4 * scale },
  ];
}

/** Organic torso / breastplate shape with shoulder slope and waist taper */
export function torsoPath(scale: number = 1): Pts {
  return [
    { x: -15 * scale, y: -14 * scale },  // top-left shoulder
    { x: -10 * scale, y: -16 * scale },
    { x:   0 * scale, y: -17 * scale },  // top center
    { x:  10 * scale, y: -16 * scale },
    { x:  16 * scale, y: -13 * scale },  // top-right shoulder
    { x:  17 * scale, y:  -4 * scale },
    { x:  15 * scale, y:   6 * scale },
    { x:  12 * scale, y:  10 * scale },  // waist right
    { x:   0 * scale, y:  12 * scale },  // waist center
    { x: -12 * scale, y:  10 * scale },
    { x: -15 * scale, y:   6 * scale },
    { x: -17 * scale, y:  -3 * scale },
  ];
}

/** Sword blade silhouette — chunky leaf shape with point */
export function swordBladePath(scale: number = 1): Pts {
  return [
    { x: -2.6 * scale, y: -2 * scale },
    { x:  2.6 * scale, y: -2 * scale },
    { x:  3.0 * scale, y: -10 * scale },
    { x:  2.6 * scale, y: -22 * scale },
    { x:  1.8 * scale, y: -32 * scale },
    { x:  0   * scale, y: -38 * scale },
    { x: -1.8 * scale, y: -32 * scale },
    { x: -2.6 * scale, y: -22 * scale },
    { x: -3.0 * scale, y: -10 * scale },
  ];
}
