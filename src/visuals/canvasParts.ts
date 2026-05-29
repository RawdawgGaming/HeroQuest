// =============================================================================
// CANVAS PARTS — bitmap body part renderer
// =============================================================================
// Bridges the gap between vector polygon rendering and real raster art:
// renders a body part polygon to a Phaser.Textures.CanvasTexture once with
// per-pixel noise, diagonal brush strokes, clipped cel shading, top highlight,
// and a shaky multi-pass ink outline. The output is a real bitmap that the
// caller uses as `scene.add.image(x, y, key)`.
//
// This is the upgrade that moves the look from "outlined polygons" to
// "painted illustration" without requiring external PNG assets.
//
// The same animation joints (Containers) still rotate the resulting Images
// just like they rotated the previous Graphics objects.
//
// To swap a part to a real raster sprite later: load a PNG under the same
// texture key in scene preload, and the builder code does not change.

import Phaser from 'phaser';
import type { Pts } from './paint';

export interface BodyPartRecipe {
  /** Polygon points in LOCAL coordinates relative to the texture's center.
   *  Will be auto-translated so the shape's bounding box fits the texture. */
  points: Pts;
  /** Base fill color (hex) */
  base: number;
  /** Cel-shadow tone (used on the lower half) */
  shadow: number;
  /** Highlight tone (used as a top band) */
  highlight: number;

  /** ±N per RGB channel of pixel noise. 0 = none, 30 = subtle, 60 = grainy */
  noise?: number;
  /** Number of darker brush streaks drawn inside the shape */
  brushCount?: number;
  /** Brush streak alpha 0..1 */
  brushAlpha?: number;
  /** Outline weight in px */
  outlineWeight?: number;
  /** Outline color */
  outlineColor?: number;
  /** Outline jitter amount in px */
  outlineJitter?: number;
  /** Outline passes (more = wobblier hand-drawn line) */
  outlinePasses?: number;

  /** Cel shadow alpha 0..1 (0 = no cel shading) */
  shadowAlpha?: number;
  /** What fraction of the texture is the lower-half cel shadow */
  shadowExtent?: number;
  /** Top highlight band alpha */
  highlightAlpha?: number;
  /** Top highlight band height fraction */
  highlightExtent?: number;
}

const colorHex = (c: number, a: number = 1): string =>
  `rgba(${(c >> 16) & 0xff}, ${(c >> 8) & 0xff}, ${c & 0xff}, ${a})`;

/**
 * Compute the bounding box of a polygon and a translation that centers it
 * inside an output texture of (width, height).
 */
function fitPolygonToTexture(points: Pts, width: number, height: number, padding: number): {
  pts: Pts; cx: number; cy: number;
} {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const tx = (width / 2) - (minX + maxX) / 2;
  const ty = (height / 2) - (minY + maxY) / 2;
  void padding;
  return {
    pts: points.map((p) => ({ x: p.x + tx, y: p.y + ty })),
    cx: width / 2,
    cy: height / 2,
  };
}

function pathPolygon(ctx: CanvasRenderingContext2D, points: Pts): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

function jitter(p: { x: number; y: number }, amount: number): { x: number; y: number } {
  return {
    x: p.x + (Math.random() - 0.5) * amount * 2,
    y: p.y + (Math.random() - 0.5) * amount * 2,
  };
}

/**
 * Render a painted body part to a CanvasTexture and return its key. If the
 * key already exists, returns it without re-rendering.
 */
export function paintBodyPart(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  recipe: BodyPartRecipe,
): string {
  if (scene.textures.exists(key)) return key;

  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return key;
  const ctx = tex.getContext();

  const {
    base,
    shadow,
    highlight,
    noise = 28,
    brushCount = 6,
    brushAlpha = 0.18,
    outlineWeight = 2.0,
    outlineColor = 0x1a1a22,
    outlineJitter = 0.7,
    outlinePasses = 1,
    shadowAlpha = 0.42,
    shadowExtent = 0.5,
    highlightAlpha = 0.45,
    highlightExtent = 0.20,
  } = recipe;

  // Center the polygon in the texture
  const { pts } = fitPolygonToTexture(recipe.points, width, height, 4);

  // ----- 1. BASE FILL -----
  ctx.fillStyle = colorHex(base, 1);
  pathPolygon(ctx, pts);
  ctx.fill();

  // ----- 2. PER-PIXEL NOISE inside the filled area -----
  if (noise > 0) {
    const img = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 0) continue; // skip outside the polygon
      const n = (Math.random() - 0.5) * noise;
      img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
  }

  // ----- 3. CEL SHADOW (lower fraction of the form, clipped to shape) -----
  if (shadowAlpha > 0 && shadowExtent > 0) {
    ctx.save();
    pathPolygon(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = colorHex(shadow, 1);
    ctx.fillRect(0, height * (1 - shadowExtent), width, height * shadowExtent);
    ctx.restore();
  }

  // ----- 4. TOP HIGHLIGHT BAND (clipped to shape) -----
  if (highlightAlpha > 0 && highlightExtent > 0) {
    ctx.save();
    pathPolygon(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = highlightAlpha;
    ctx.fillStyle = colorHex(highlight, 1);
    ctx.fillRect(0, 0, width, height * highlightExtent);
    ctx.restore();
  }

  // ----- 5. DIAGONAL BRUSH STREAKS (darker, alpha-blended, inside shape) -----
  if (brushCount > 0) {
    ctx.save();
    pathPolygon(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = brushAlpha;
    ctx.strokeStyle = colorHex(shadow, 1);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < brushCount; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const len = 4 + Math.random() * 8;
      const ang = (Math.random() - 0.5) * 0.6 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ----- 6. SHAKY MULTI-PASS INK OUTLINE -----
  ctx.strokeStyle = colorHex(outlineColor, 1);
  ctx.lineWidth = outlineWeight;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let pass = 0; pass < outlinePasses; pass++) {
    const jp = pts.map((p) => jitter(p, outlineJitter));
    ctx.beginPath();
    ctx.moveTo(jp[0].x, jp[0].y);
    for (let i = 1; i < jp.length; i++) {
      ctx.lineTo(jp[i].x, jp[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  tex.refresh();
  return key;
}

// =============================================================================
// SIMPLER BLOB TEXTURE — for cloth, capes, plumes, decorative blobs
// =============================================================================
// Renders an organic blob (irregular ellipse) with the same painted treatment.

export function paintBlobPart(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  recipe: Omit<BodyPartRecipe, 'points'> & { jitterAmount?: number; sides?: number },
): string {
  const { jitterAmount = 0.18, sides = 12 } = recipe;
  const cx = width / 2;
  const cy = height / 2;
  const rx = (width / 2) - 4;
  const ry = (height / 2) - 4;
  const points: Pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const wobble = 1 + (Math.random() - 0.5) * jitterAmount * 2;
    points.push({
      x: cx + Math.cos(angle) * rx * wobble,
      y: cy + Math.sin(angle) * ry * wobble,
    });
  }
  return paintBodyPart(scene, key, width, height, {
    ...recipe,
    points,
  });
}

// =============================================================================
// FREEFORM CANVAS TEXTURE
// =============================================================================
// For environment props that need to compose multiple shapes onto one texture
// (e.g. a tree = trunk + canopy + branches + brush detail). The caller is
// handed an HTML5 canvas context and full freedom — they call helpers below
// or paint anything they want, then we refresh and return the key.

export function paintEnvironmentTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return key;
  draw(tex.getContext(), width, height);
  tex.refresh();
  return key;
}

// =============================================================================
// CANVAS PRIMITIVE HELPERS — for environment composition
// =============================================================================
// Each helper draws a painted blob/polygon onto an HTML5 canvas context with
// the same hand-drawn treatment as paintBodyPart: noise, brush streaks, cel
// shading, ink outline. Used by environmentTextures.ts to compose trees etc.

const colorRGB = (c: number): [number, number, number] => [
  (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff,
];

const colorRgba = (c: number, a: number = 1): string => {
  const [r, g, b] = colorRGB(c);
  return `rgba(${r},${g},${b},${a})`;
};

/** Path a polygon onto a canvas context (does NOT fill or stroke). */
export function pathPoly(ctx: CanvasRenderingContext2D, pts: Pts): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Build an irregular blob polygon centered at (cx, cy) with rx/ry radii. */
export function canvasBlobPath(
  cx: number, cy: number, rx: number, ry: number,
  sides: number = 12, jitter: number = 0.2,
): Pts {
  const pts: Pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const w = 1 + (Math.random() - 0.5) * jitter * 2;
    pts.push({ x: cx + Math.cos(a) * rx * w, y: cy + Math.sin(a) * ry * w });
  }
  return pts;
}

/** Apply per-pixel noise to a rectangular region of the canvas. */
export function noiseRegion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  amount: number,
): void {
  const xi = Math.max(0, Math.floor(x));
  const yi = Math.max(0, Math.floor(y));
  const wi = Math.max(0, Math.floor(w));
  const hi = Math.max(0, Math.floor(h));
  if (wi === 0 || hi === 0) return;
  const img = ctx.getImageData(xi, yi, wi, hi);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    const n = (Math.random() - 0.5) * amount;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, xi, yi);
}

/** Fill a polygon shape, apply per-pixel noise inside, add brush streaks,
 *  cel shadow, and a shaky ink outline. Used by environment helpers below. */
export function paintShape(
  ctx: CanvasRenderingContext2D,
  pts: Pts,
  base: number,
  shadow: number,
  highlight: number,
  options: {
    noise?: number;
    brushCount?: number;
    brushAlpha?: number;
    outlineWeight?: number;
    outlineColor?: number;
    outlineJitter?: number;
    outlinePasses?: number;
    shadowAlpha?: number;
    shadowExtent?: number;
    highlightAlpha?: number;
    highlightExtent?: number;
  } = {},
): void {
  const {
    noise = 22,
    brushCount = 4,
    brushAlpha = 0.18,
    outlineWeight = 1.6,
    outlineColor = 0x1a1a22,
    outlineJitter = 0.4,
    outlinePasses = 1,
    shadowAlpha = 0.36,
    shadowExtent = 0.5,
    highlightAlpha = 0.36,
    highlightExtent = 0.20,
  } = options;

  // Bounds for noise/shadow/highlight regions
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;

  // 1. Base fill
  ctx.fillStyle = colorRgba(base, 1);
  pathPoly(ctx, pts);
  ctx.fill();

  // 2. Per-pixel noise
  if (noise > 0 && w > 0 && h > 0) {
    noiseRegion(ctx, minX - 1, minY - 1, w + 2, h + 2, noise);
  }

  // 3. Cel shadow (lower portion, clipped)
  if (shadowAlpha > 0 && shadowExtent > 0) {
    ctx.save();
    pathPoly(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = colorRgba(shadow, 1);
    ctx.fillRect(minX - 2, minY + h * (1 - shadowExtent), w + 4, h * shadowExtent + 2);
    ctx.restore();
  }

  // 4. Top highlight band (clipped)
  if (highlightAlpha > 0 && highlightExtent > 0) {
    ctx.save();
    pathPoly(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = highlightAlpha;
    ctx.fillStyle = colorRgba(highlight, 1);
    ctx.fillRect(minX - 2, minY - 2, w + 4, h * highlightExtent + 2);
    ctx.restore();
  }

  // 5. Brush streaks (clipped)
  if (brushCount > 0) {
    ctx.save();
    pathPoly(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = brushAlpha;
    ctx.strokeStyle = colorRgba(shadow, 1);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < brushCount; i++) {
      const sx = minX + Math.random() * w;
      const sy = minY + Math.random() * h;
      const len = 3 + Math.random() * 8;
      const ang = (Math.random() - 0.5) * 0.6 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 6. Multi-pass shaky ink outline
  ctx.strokeStyle = colorRgba(outlineColor, 1);
  ctx.lineWidth = outlineWeight;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let pass = 0; pass < outlinePasses; pass++) {
    const jp = pts.map((p) => ({
      x: p.x + (Math.random() - 0.5) * outlineJitter * 2,
      y: p.y + (Math.random() - 0.5) * outlineJitter * 2,
    }));
    ctx.beginPath();
    ctx.moveTo(jp[0].x, jp[0].y);
    for (let i = 1; i < jp.length; i++) ctx.lineTo(jp[i].x, jp[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Paint a tapered trunk shape (4-vertex polygon) at the given canvas coords. */
export function paintTrunk(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number,
  height: number,
  baseWidth: number,
  topWidth: number,
  base: number, shadow: number, highlight: number,
): void {
  const pts: Pts = [
    { x: cx - baseWidth / 2, y: baseY },
    { x: cx + baseWidth / 2, y: baseY },
    { x: cx + topWidth / 2,  y: baseY - height },
    { x: cx - topWidth / 2,  y: baseY - height },
  ];
  // Slight jitter on the vertices so the trunk isn't a perfect quad
  const jp = pts.map((p) => ({
    x: p.x + (Math.random() - 0.5) * 1.2,
    y: p.y + (Math.random() - 0.5) * 1.2,
  }));
  paintShape(ctx, jp, base, shadow, highlight, {
    noise: 26,
    brushCount: 0,  // NO brush strokes on bark — bark grain is handled separately
    outlineWeight: 1.8,
    outlineJitter: 0.7,
    outlinePasses: 2,
    shadowAlpha: 0.42,
    shadowExtent: 0.55,
    highlightAlpha: 0.32,
    highlightExtent: 0.18,
  });
}

/** Paint a single canopy blob at the given canvas coords. */
export function paintCanopy(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  base: number, shadow: number, highlight: number,
  options: { sides?: number; jitter?: number } = {},
): void {
  const { sides = 13, jitter = 0.32 } = options;
  const pts = canvasBlobPath(cx, cy, rx, ry, sides, jitter);
  paintShape(ctx, pts, base, shadow, highlight, {
    noise: 26,
    brushCount: 0,  // NO brush strokes on foliage — leaf mass shading handles texture
    outlineWeight: 1.8,
    outlineJitter: 0.7,
    outlinePasses: 2,
    shadowAlpha: 0.40,
    shadowExtent: 0.58,
    highlightAlpha: 0.42,
    highlightExtent: 0.22,
  });
}

/** Paint an organic rock/blob with chunky outline. */
export function paintRockBlob(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  base: number, shadow: number, highlight: number,
  options: { sides?: number; jitter?: number; outlineWeight?: number } = {},
): void {
  const { sides = 9, jitter = 0.4, outlineWeight = 1.8 } = options;
  const pts = canvasBlobPath(cx, cy, rx, ry, sides, jitter);
  paintShape(ctx, pts, base, shadow, highlight, {
    noise: 28,
    brushCount: 0,  // NO brush strokes on rock — facets + cracks handle texture
    outlineWeight,
    outlineJitter: 0.6,
    outlinePasses: 2,
    shadowAlpha: 0.50,
    shadowExtent: 0.55,
    highlightAlpha: 0.40,
    highlightExtent: 0.22,
  });
}
