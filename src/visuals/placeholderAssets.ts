// =============================================================================
// ILLUSTRATED PLACEHOLDER ASSETS
// =============================================================================
// High-fidelity CanvasTexture generators that simulate what real PNG art would
// look like. Each goes beyond the standard procedural fallback by working at
// the PIXEL level — stamping leaf clusters, drawing directional bark grain,
// compositing alpha layers, and applying brush-like shading.
//
// These claim their texture keys BEFORE the standard fallback runs, so the
// scene renders with these instead. When real PNG art is added to ASSET_FILES,
// the PNG loads first and these are skipped.
//
// DELETE this entire file once real art covers all the keys below.

import Phaser from 'phaser';
import { TextureKeys } from './textures';

// =============================================================================
// HELPERS — pixel-level drawing primitives
// =============================================================================

/** Mulberry32 deterministic RNG for stable textures across reloads. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgb = (c: number): [number, number, number] =>
  [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];

const rgba = (c: number, a: number = 1): string => {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
};

/** Stamp a small irregular leaf cluster at (cx, cy) on the canvas. Each cluster
 *  is 4-7 overlapping mini-ellipses at slightly random offsets + rotations. */
function stampLeafCluster(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  baseColor: number,
  shadowColor: number,
  highlightColor: number,
  rng: () => number,
): void {
  const count = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const offX = (rng() - 0.5) * size * 1.2;
    const offY = (rng() - 0.5) * size * 1.0;
    const rx = size * (0.3 + rng() * 0.4);
    const ry = rx * (0.5 + rng() * 0.4);
    const rot = rng() * Math.PI;

    // Shadow layer (slightly offset down-right)
    ctx.save();
    ctx.translate(cx + offX + 1, cy + offY + 1.5);
    ctx.rotate(rot);
    ctx.fillStyle = rgba(shadowColor, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Base leaf
    ctx.save();
    ctx.translate(cx + offX, cy + offY);
    ctx.rotate(rot);
    // Pick a slightly varied tone
    const [br, bg, bb] = rgb(baseColor);
    const vary = Math.floor((rng() - 0.5) * 30);
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, br + vary))},${Math.max(0, Math.min(255, bg + vary))},${Math.max(0, Math.min(255, bb + vary))})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Highlight dot on upper-left of leaf (1 in 3)
    if (rng() > 0.65) {
      ctx.fillStyle = rgba(highlightColor, 0.6);
      ctx.beginPath();
      ctx.arc(cx + offX - rx * 0.3, cy + offY - ry * 0.3, rx * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draw vertical bark grain streaks inside a clipped region. */
function drawBarkGrain(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  baseColor: number, darkColor: number, lightColor: number,
  rng: () => number,
): void {
  // Vertical dark streaks (bark ridges)
  const ridgeCount = 6 + Math.floor(rng() * 6);
  for (let i = 0; i < ridgeCount; i++) {
    const rx = x + rng() * w;
    const rw = 0.6 + rng() * 1.2;
    ctx.strokeStyle = rgba(darkColor, 0.3 + rng() * 0.3);
    ctx.lineWidth = rw;
    ctx.beginPath();
    ctx.moveTo(rx + (rng() - 0.5) * 2, y);
    // Wavy vertical line
    for (let sy = y; sy < y + h; sy += 6 + rng() * 4) {
      ctx.lineTo(rx + (rng() - 0.5) * 2.5, sy);
    }
    ctx.stroke();
  }

  // Subtle darker bark patches (irregular, NOT horizontal lines)
  for (let i = 0; i < 4 + Math.floor(rng() * 3); i++) {
    const px = x + rng() * w;
    const py = y + rng() * h;
    const pw = 2 + rng() * 4;
    const ph = 4 + rng() * 10;
    ctx.fillStyle = rgba(darkColor, 0.14 + rng() * 0.10);
    ctx.beginPath();
    ctx.ellipse(px, py, pw, ph, (rng() - 0.5) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Knot holes (1-3)
  const knotCount = Math.floor(rng() * 3);
  for (let i = 0; i < knotCount; i++) {
    const kx = x + w * 0.2 + rng() * w * 0.6;
    const ky = y + h * 0.2 + rng() * h * 0.6;
    const kr = 1.5 + rng() * 2;
    ctx.fillStyle = rgba(darkColor, 0.7);
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr, kr * 0.7, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // Ring around knot
    ctx.strokeStyle = rgba(lightColor, 0.3);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr + 1.5, kr * 0.7 + 1.5, rng() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Draw irregular small stones scattered in a region. */
function drawStones(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  count: number,
  rng: () => number,
): void {
  for (let i = 0; i < count; i++) {
    const sx = x + rng() * w;
    const sy = y + rng() * h;
    const sr = 1 + rng() * 2.5;
    const sides = 5 + Math.floor(rng() * 4);
    // Draw irregular polygon
    ctx.fillStyle = rgba(0x888890, 0.6 + rng() * 0.3);
    ctx.beginPath();
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const r = sr * (0.7 + rng() * 0.6);
      const px = sx + Math.cos(a) * r;
      const py = sy + Math.sin(a) * r;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Shadow on bottom
    ctx.fillStyle = rgba(0x333340, 0.4);
    ctx.beginPath();
    ctx.ellipse(sx, sy + sr * 0.4, sr * 0.7, sr * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw a brush-stroke-like cloud wisp. Multiple overlapping offset ellipses
 *  with ragged alpha edges. NOT a single smooth ellipse. */
function drawCloudWisp(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  width: number, height: number,
  alpha: number,
  rng: () => number,
): void {
  const puffs = 6 + Math.floor(rng() * 6);
  for (let i = 0; i < puffs; i++) {
    const px = cx + (rng() - 0.5) * width * 0.9;
    const py = cy + (rng() - 0.5) * height * 1.2;
    const rx = width * (0.08 + rng() * 0.15);
    const ry = height * (0.3 + rng() * 0.6);
    const a = alpha * (0.5 + rng() * 0.5);

    // Main puff body
    ctx.fillStyle = rgba(0xfff0d4, a);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, rng() * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Brighter inner core
    ctx.fillStyle = rgba(0xffffff, a * 0.5);
    ctx.beginPath();
    ctx.ellipse(px, py - ry * 0.15, rx * 0.5, ry * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Edge breakup: semi-transparent darker fringe on bottom
    ctx.fillStyle = rgba(0xd0c0a0, a * 0.3);
    ctx.beginPath();
    ctx.ellipse(px + 1, py + ry * 0.4, rx * 0.8, ry * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rim light along the top edge of the wisp
  ctx.strokeStyle = rgba(0xffffff, alpha * 0.35);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx, cy - height * 0.3, width * 0.4, height * 0.2, 0, Math.PI, 0);
  ctx.stroke();
}

// =============================================================================
// PUBLIC ENTRY POINT
// =============================================================================

export function generatePlaceholderAssets(scene: Phaser.Scene): void {
  generateIllustratedTrees(scene);
  generateIllustratedGround(scene);
  generateIllustratedRocks(scene);
  generateIllustratedSky(scene);
  generateStagingProps(scene);
}

// =============================================================================
// 1. ILLUSTRATED NEAR TREES — leaf-mass canopies + bark-textured trunks
// =============================================================================
// Each canopy is built from 4-7 overlapping LEAF MASS silhouettes. Each mass
// is an irregular polygon (10-14 vertices, NOT an ellipse) with its own:
//   - base fill color (varied greens)
//   - cel-shadow overlay on the lower portion
//   - highlight overlay on the upper-left
//   - interior leaf detail marks (small sub-clusters for texture)
//   - shaky ink outline that follows the mass contour
//
// The COMBINED contour of the overlapping masses IS the canopy edge. There
// is NO bounding ellipse drawn around the canopy. The irregularity of each
// mass polygon and the gaps between overlapping edges create the organic
// "illustrated foliage" look instead of a smooth blob.
//
// Masses are placed in 3 tiers:
//   1. Shadow masses (biased lower-right, darkest greens)
//   2. Base masses (spread across the canopy center, mid greens)
//   3. Highlight masses (biased upper-left, brightest greens)
//
// The trunk uses an 8-vertex polygon (not 4) for irregular bark edges, with
// a wide shadow band on the right side and a highlight band on the left.

/** Build a single leaf-mass polygon. Returns the vertices. */
function buildLeafMassPolygon(
  cx: number, cy: number,
  rx: number, ry: number,
  vertexCount: number,
  rng: () => number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const a = (i / vertexCount) * Math.PI * 2;
    // Each vertex has a different radius wobble — this is what makes the
    // contour irregular instead of elliptical.
    const wobble = 0.65 + rng() * 0.7;
    pts.push({
      x: cx + Math.cos(a) * rx * wobble,
      y: cy + Math.sin(a) * ry * wobble,
    });
  }
  return pts;
}

/** Draw a single leaf mass with fill, shadow, highlight, interior detail, and ink outline. */
function drawLeafMass(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  baseColor: number,
  shadowColor: number,
  highlightColor: number,
  rng: () => number,
  options: {
    vertexCount?: number;
    innerDetail?: boolean;
    outlineWeight?: number;
    outlineAlpha?: number;
  } = {},
): void {
  const {
    vertexCount = 10 + Math.floor(rng() * 4),
    innerDetail = true,
    outlineWeight = 1.6,
    outlineAlpha = 0.85,
  } = options;

  const pts = buildLeafMassPolygon(cx, cy, rx, ry, vertexCount, rng);
  const pathFn = () => {
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
  };

  // 1. Base fill
  ctx.fillStyle = rgba(baseColor, 1);
  pathFn();
  ctx.fill();

  // 2. Cel-shadow on lower 55% — filled with LEAF-CLUSTER shapes, not a flat rect.
  // Several overlapping small irregular leaf-mass polygons (4-6 vertices each)
  // tinted in the shadow color, clipped to the parent mass.
  ctx.save();
  pathFn();
  ctx.clip();
  const shadowClumps = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < shadowClumps; i++) {
    const bx = cx + (rng() - 0.5) * rx * 1.2;
    const by = cy + rng() * ry * 0.7;
    const brx = 4 + rng() * 6;
    const bry = 3 + rng() * 4;
    const bVerts = 5 + Math.floor(rng() * 3);
    ctx.fillStyle = rgba(shadowColor, 0.38 + rng() * 0.18);
    ctx.beginPath();
    for (let j = 0; j < bVerts; j++) {
      const a = (j / bVerts) * Math.PI * 2;
      const w = 0.6 + rng() * 0.8;
      const px = bx + Math.cos(a) * brx * w;
      const py = by + Math.sin(a) * bry * w;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Highlight on upper-left — filled with LEAF-CLUSTER shapes, not a flat rect.
  ctx.save();
  pathFn();
  ctx.clip();
  const highlightClumps = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < highlightClumps; i++) {
    const bx = cx - rx * 0.2 + (rng() - 0.5) * rx * 0.7;
    const by = cy - ry * 0.3 + rng() * ry * 0.35;
    const brx = 3 + rng() * 5;
    const bry = 2.5 + rng() * 3;
    const bVerts = 5 + Math.floor(rng() * 3);
    ctx.fillStyle = rgba(highlightColor, 0.42 + rng() * 0.18);
    ctx.beginPath();
    for (let j = 0; j < bVerts; j++) {
      const a = (j / bVerts) * Math.PI * 2;
      const w = 0.6 + rng() * 0.8;
      const px = bx + Math.cos(a) * brx * w;
      const py = by + Math.sin(a) * bry * w;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 4. Interior leaf detail marks — small irregular leaf shapes for texture
  if (innerDetail) {
    const detailCount = 6 + Math.floor(rng() * 6);
    for (let i = 0; i < detailCount; i++) {
      const a = rng() * Math.PI * 2;
      const d = rng() * 0.7;
      const dx = cx + Math.cos(a) * rx * d;
      const dy = cy + Math.sin(a) * ry * d;
      const lr = 1.5 + rng() * 2.5;

      // Pick a slightly varied tone from the base
      const [br, bg, bb] = rgb(baseColor);
      const v = Math.floor((rng() - 0.5) * 35);
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, br + v))},${Math.max(0, Math.min(255, bg + v))},${Math.max(0, Math.min(255, bb + v))})`;
      // Leaf shape = tiny 5-vertex irregular polygon (not an ellipse)
      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const la = (j / 5) * Math.PI * 2;
        const lw = 0.6 + rng() * 0.8;
        const lx = dx + Math.cos(la + rng() * 0.3) * lr * lw;
        const ly = dy + Math.sin(la + rng() * 0.3) * (lr * 0.6) * lw;
        j === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // 5. EDGE BITES — small concave notches punched into the polygon edge so
  // the silhouette reads as irregular foliage rather than a smooth polygon.
  // Drawn as small background-colored blobs over the filled mass's edge.
  const biteCount = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < biteCount; i++) {
    // Pick a random edge vertex and place the bite just outside
    const vi = Math.floor(rng() * pts.length);
    const vp = pts[vi];
    const dirX = vp.x - cx;
    const dirY = vp.y - cy;
    const dirLen = Math.hypot(dirX, dirY) || 1;
    const biteR = 1.5 + rng() * 2.5;
    // Position the bite slightly inward from the edge
    const bx = vp.x - (dirX / dirLen) * biteR * 0.3;
    const by = vp.y - (dirY / dirLen) * biteR * 0.3;
    // Erase by drawing a background-colored blob
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    const bVerts = 5;
    for (let j = 0; j < bVerts; j++) {
      const a = (j / bVerts) * Math.PI * 2;
      const w = 0.5 + rng() * 1.0;
      ctx.lineTo(bx + Math.cos(a) * biteR * w, by + Math.sin(a) * biteR * w);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 6. Per-mass ink outline — single pass at reduced alpha so overlapping
  // masses don't stack into scribble-like dark contour lines.
  ctx.strokeStyle = rgba(0x1a1a22, outlineAlpha * 0.55);
  ctx.lineWidth = outlineWeight;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => {
    const jx = p.x + (rng() - 0.5) * 0.6;
    const jy = p.y + (rng() - 0.5) * 0.6;
    i === 0 ? ctx.moveTo(jx, jy) : ctx.lineTo(jx, jy);
  });
  ctx.closePath();
  ctx.stroke();
}

function generateIllustratedTrees(scene: Phaser.Scene): void {
  const variants: { key: string; seed: number }[] = [
    { key: TextureKeys.ENV_TREE_NEAR_A, seed: 101 },
    { key: TextureKeys.ENV_TREE_NEAR_B, seed: 202 },
    { key: TextureKeys.ENV_TREE_NEAR_C, seed: 303 },
    { key: TextureKeys.ENV_TREE_NEAR_D, seed: 404 },
    { key: TextureKeys.ENV_TREE_NEAR_E, seed: 505 },
  ];

  const GREENS_BASE    = [0x355a35, 0x3a6830, 0x436834, 0x4a7a3a, 0x3c6e2c, 0x2e5228];
  const GREENS_SHADOW  = [0x1a3018, 0x162810, 0x1e3818, 0x0a1808];
  const GREENS_HIGHLIGHT = [0x68904a, 0x72a050, 0x90b868, 0x5a8042];

  for (const { key, seed } of variants) {
    if (scene.textures.exists(key)) continue;
    const W = 160, H = 220;
    const tex = scene.textures.createCanvas(key, W, H);
    if (!tex) continue;
    const ctx = tex.getContext();
    const rng = mulberry32(seed);

    const trunkBaseY = H - 8;
    const trunkH = 85 + Math.floor(rng() * 25);
    const trunkTopY = trunkBaseY - trunkH;
    const cx = W / 2 + (rng() - 0.5) * 8;
    const trunkBaseW = 15 + rng() * 5;
    const trunkTopW = 8 + rng() * 3;

    // ===== TRUNK (8-vertex irregular polygon, NOT a 4-vertex quad) =====
    // Build the trunk shape with midpoint vertices on each side so the
    // edges have slight wobble instead of being perfectly straight.
    const tl = { x: cx - trunkTopW / 2, y: trunkTopY };
    const tr = { x: cx + trunkTopW / 2, y: trunkTopY };
    const bl = { x: cx - trunkBaseW / 2, y: trunkBaseY };
    const br = { x: cx + trunkBaseW / 2, y: trunkBaseY };
    const midH = trunkTopY + trunkH * 0.5;
    const trunkPts = [
      bl,
      { x: bl.x - rng() * 1.5 + 0.5, y: midH + (rng() - 0.5) * 6 }, // left mid
      tl,
      { x: tl.x + (rng() - 0.5) * 2, y: tl.y - 2 - rng() * 3 },     // top-left bump
      { x: tr.x + (rng() - 0.5) * 2, y: tr.y - 2 - rng() * 3 },     // top-right bump
      tr,
      { x: br.x + rng() * 1.5 - 0.5, y: midH + (rng() - 0.5) * 6 }, // right mid
      br,
    ];

    // Base fill
    ctx.fillStyle = rgba(0x4a3018, 1);
    ctx.beginPath();
    trunkPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();

    // Clip for trunk interior detail
    ctx.save();
    ctx.beginPath();
    trunkPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.clip();

    // Shadow band — right 45% of the trunk, wide and organic
    ctx.fillStyle = rgba(0x1e1008, 0.60);
    ctx.fillRect(cx - 1, trunkTopY - 4, trunkBaseW, trunkH + 16);

    // Highlight band — left 30% of the trunk
    ctx.fillStyle = rgba(0x6a4828, 0.40);
    ctx.fillRect(cx - trunkBaseW / 2, trunkTopY - 4, trunkBaseW * 0.32, trunkH + 16);

    // Bark grain (vertical + horizontal + knots)
    drawBarkGrain(ctx,
      cx - trunkBaseW / 2, trunkTopY, trunkBaseW, trunkH,
      0x4a3018, 0x1e1008, 0x6a4828, rng);

    // Per-pixel noise on trunk
    {
      const txMin = Math.floor(cx - trunkBaseW / 2 - 2);
      const tyMin = Math.floor(trunkTopY - 2);
      const tw = Math.ceil(trunkBaseW + 4);
      const th = Math.ceil(trunkH + 10);
      if (tw > 0 && th > 0) {
        const img = ctx.getImageData(txMin, tyMin, tw, th);
        for (let i = 0; i < img.data.length; i += 4) {
          if (img.data[i + 3] === 0) continue;
          const n = (rng() - 0.5) * 22;
          img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
          img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
          img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
        }
        ctx.putImageData(img, txMin, tyMin);
      }
    }

    ctx.restore();

    // Trunk ink outline — single pass, moderate weight, minimal jitter
    ctx.strokeStyle = rgba(0x1a1a22, 0.80);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    trunkPts.forEach((p, i) => {
      const jx = p.x + (rng() - 0.5) * 0.5;
      const jy = p.y + (rng() - 0.5) * 0.5;
      i === 0 ? ctx.moveTo(jx, jy) : ctx.lineTo(jx, jy);
    });
    ctx.closePath();
    ctx.stroke();

    // Root nubs — chunky irregular blobs (not ellipses)
    for (let i = 0; i < 3 + Math.floor(rng() * 2); i++) {
      const rootX = cx + (i - 1.5) * (trunkBaseW * 0.4) + (rng() - 0.5) * 4;
      const rootPts = buildLeafMassPolygon(rootX, trunkBaseY, 4 + rng() * 3, 2 + rng(), 6, rng);
      ctx.fillStyle = rgba(0x3a2410, 0.92);
      ctx.beginPath();
      rootPts.forEach((p, j) => j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
    }

    // ===== CANOPY — hierarchical leaf-mass silhouettes =====
    // Three size tiers drawn back-to-front. NOT evenly fanned — positions
    // are authored per-tier with deliberate asymmetry so the canopy reads
    // as an illustrated tree, not a procedural ring of blobs.
    //
    //   BACK:   1 large shadow mass (lower-right, darkest green)
    //   LAYER1: 1 LARGE CENTRAL MASS — the dominant shape of the canopy
    //   LAYER2: 2-4 MEDIUM SATELLITE MASSES — irregularly placed around
    //           the central mass, overlapping its edges
    //   LAYER3: 2-5 SMALL EDGE CLUMPS — stick out beyond the satellites
    //           to break the outer contour into an asymmetric silhouette
    //   TOP:    1 highlight mass (upper-left, brightest)

    const canopyCY = trunkTopY - 22;
    const canopySpreadX = 40 + rng() * 16;
    const canopySpreadY = 36 + rng() * 14;

    // ----- BACK: shadow mass (lower-right, darkest) -----
    {
      const offX = canopySpreadX * (0.05 + rng() * 0.2);
      const offY = canopySpreadY * (0.2 + rng() * 0.25);
      const mrx = canopySpreadX * (0.7 + rng() * 0.2);
      const mry = canopySpreadY * (0.5 + rng() * 0.15);
      drawLeafMass(ctx,
        cx + offX, canopyCY + offY, mrx, mry,
        GREENS_SHADOW[Math.floor(rng() * GREENS_SHADOW.length)],
        0x0a1808, 0x1a3018, rng,
        { innerDetail: false, outlineWeight: 1.2, outlineAlpha: 0.55 });
    }

    // ----- LAYER 1: LARGE CENTRAL MASS -----
    // This is the dominant shape — biggest, centered, mid-green.
    // Everything else overlaps and extends from this.
    {
      const centralOffX = (rng() - 0.5) * canopySpreadX * 0.15;
      const centralOffY = (rng() - 0.5) * canopySpreadY * 0.1;
      const centralRX = canopySpreadX * (0.75 + rng() * 0.15);
      const centralRY = canopySpreadY * (0.65 + rng() * 0.12);
      drawLeafMass(ctx,
        cx + centralOffX, canopyCY + centralOffY, centralRX, centralRY,
        GREENS_BASE[Math.floor(rng() * GREENS_BASE.length)],
        GREENS_SHADOW[Math.floor(rng() * GREENS_SHADOW.length)],
        GREENS_HIGHLIGHT[Math.floor(rng() * GREENS_HIGHLIGHT.length)],
        rng,
        { outlineWeight: 1.8, outlineAlpha: 0.85 });
    }

    // ----- LAYER 2: MEDIUM SATELLITE MASSES (2-4) -----
    // Placed at IRREGULAR positions around the central mass. NOT evenly
    // fanned — some overlap, some extend outward asymmetrically.
    const satCount = 2 + Math.floor(rng() * 3);
    // Pre-authored direction biases so satellites don't cluster on one side
    const satDirs = [
      { ax: -0.8, ay: -0.3 },  // upper-left
      { ax:  0.7, ay: -0.5 },  // upper-right
      { ax:  0.9, ay:  0.3 },  // right
      { ax: -0.6, ay:  0.5 },  // lower-left
    ];
    for (let i = 0; i < satCount; i++) {
      const dir = satDirs[i % satDirs.length];
      // Offset from center along the biased direction + random jitter
      const offX = dir.ax * canopySpreadX * (0.4 + rng() * 0.3)
                 + (rng() - 0.5) * canopySpreadX * 0.2;
      const offY = dir.ay * canopySpreadY * (0.35 + rng() * 0.25)
                 + (rng() - 0.5) * canopySpreadY * 0.15;
      const mrx = canopySpreadX * (0.35 + rng() * 0.2);
      const mry = canopySpreadY * (0.3 + rng() * 0.15);
      drawLeafMass(ctx,
        cx + offX, canopyCY + offY, mrx, mry,
        GREENS_BASE[Math.floor(rng() * GREENS_BASE.length)],
        GREENS_SHADOW[Math.floor(rng() * GREENS_SHADOW.length)],
        GREENS_HIGHLIGHT[Math.floor(rng() * GREENS_HIGHLIGHT.length)],
        rng,
        { outlineWeight: 1.5, outlineAlpha: 0.78 });
    }

    // ----- LAYER 3: SMALL EDGE CLUMPS (2-5) -----
    // These stick out BEYOND the satellites to break the outer contour
    // into an asymmetric, spiky silhouette. Each clump is small and placed
    // far from center. They overlap the edge of the nearest satellite so
    // the combined outline has natural notches and bumps.
    const edgeCount = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < edgeCount; i++) {
      // Random angle, but pushed to the OUTER EDGE of the canopy
      const angle = rng() * Math.PI * 2;
      const dist = 0.7 + rng() * 0.35;
      const offX = Math.cos(angle) * canopySpreadX * dist
                 + (rng() - 0.5) * 6;
      const offY = Math.sin(angle) * canopySpreadY * dist
                 + (rng() - 0.5) * 5;
      const mrx = canopySpreadX * (0.16 + rng() * 0.14);
      const mry = canopySpreadY * (0.14 + rng() * 0.10);
      // Alternate between base green and slightly different tones
      const green = i % 2 === 0
        ? GREENS_BASE[Math.floor(rng() * GREENS_BASE.length)]
        : GREENS_HIGHLIGHT[Math.floor(rng() * GREENS_HIGHLIGHT.length)];
      drawLeafMass(ctx,
        cx + offX, canopyCY + offY, mrx, mry,
        green,
        GREENS_SHADOW[Math.floor(rng() * GREENS_SHADOW.length)],
        GREENS_HIGHLIGHT[Math.floor(rng() * GREENS_HIGHLIGHT.length)],
        rng,
        { vertexCount: 7 + Math.floor(rng() * 3),
          innerDetail: false,
          outlineWeight: 1.3, outlineAlpha: 0.72 });
    }

    // ----- TOP: highlight mass (upper-left, brightest) -----
    {
      const offX = -canopySpreadX * (0.2 + rng() * 0.2);
      const offY = -canopySpreadY * (0.25 + rng() * 0.2);
      const mrx = canopySpreadX * (0.32 + rng() * 0.15);
      const mry = canopySpreadY * (0.26 + rng() * 0.12);
      drawLeafMass(ctx,
        cx + offX, canopyCY + offY, mrx, mry,
        GREENS_HIGHLIGHT[Math.floor(rng() * GREENS_HIGHLIGHT.length)],
        GREENS_BASE[Math.floor(rng() * GREENS_BASE.length)],
        0x90b868, rng,
        { outlineWeight: 1.3, outlineAlpha: 0.70 });
    }

    // ----- Small branch stubs where trunk meets the canopy -----
    for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
      const bx = cx + (rng() - 0.5) * trunkTopW * 1.5;
      const by = trunkTopY + rng() * 10;
      const bend = (rng() - 0.5) * 16;
      ctx.strokeStyle = rgba(0x3a2410, 0.85);
      ctx.lineWidth = 2 + rng() * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bend, by - 8 - rng() * 12);
      ctx.stroke();
    }

    tex.refresh();
  }
}

// =============================================================================
// 2. ILLUSTRATED GROUND PATCHES — dirt grain + stones + roots
// =============================================================================

function generateIllustratedGround(scene: Phaser.Scene): void {
  const variants: { key: string; seed: number }[] = [
    { key: TextureKeys.ENV_GROUND_PATCH_A, seed: 611 },
    { key: TextureKeys.ENV_GROUND_PATCH_B, seed: 622 },
    { key: TextureKeys.ENV_GROUND_PATCH_C, seed: 633 },
  ];

  for (const { key, seed } of variants) {
    if (scene.textures.exists(key)) continue;
    const W = 120, H = 36;
    const tex = scene.textures.createCanvas(key, W, H);
    if (!tex) continue;
    const ctx = tex.getContext();
    const rng = mulberry32(seed);

    // Organic patch shape (irregular blob)
    const sides = 12;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const rx = (W / 2 - 6) * (0.8 + rng() * 0.4);
      const ry = (H / 2 - 4) * (0.7 + rng() * 0.6);
      pts.push({ x: W / 2 + Math.cos(a) * rx, y: H / 2 + 2 + Math.sin(a) * ry });
    }

    // Base fill
    ctx.fillStyle = rgba(0x6b5638, 1);
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();

    // Clip to the patch shape for all interior detail
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.clip();

    // ----- IRREGULAR SOIL PATCHES (darker/lighter zones, NOT stroke lines) -----
    // These are small irregular polygon blobs that vary the ground color so
    // it reads as "soil texture" rather than "painted scribble."
    for (let i = 0; i < 7 + Math.floor(rng() * 4); i++) {
      const zx = 8 + rng() * (W - 16);
      const zy = 4 + rng() * (H - 8);
      const zr = 4 + rng() * 10;
      const zh = zr * (0.4 + rng() * 0.5);
      const dark = rng() > 0.5;
      ctx.fillStyle = rgba(dark ? 0x4a3a22 : 0x7a6048, 0.22 + rng() * 0.12);
      ctx.beginPath();
      const zVerts = 6 + Math.floor(rng() * 3);
      for (let j = 0; j < zVerts; j++) {
        const a = (j / zVerts) * Math.PI * 2;
        const w = 0.5 + rng() * 1.0;
        const px = zx + Math.cos(a) * zr * w;
        const py = zy + Math.sin(a) * zh * w;
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    // ----- SHADOW UNDERSIDE BAND -----
    ctx.fillStyle = rgba(0x342414, 0.45);
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    // ----- HIGHLIGHT TOP BAND -----
    ctx.fillStyle = rgba(0x8a7048, 0.35);
    ctx.fillRect(0, 0, W, H * 0.22);

    // ----- CRACK-LIKE SHAPES (NOT straight stroke lines) -----
    // Short jagged multi-segment paths that read as dried soil cracks.
    for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
      ctx.strokeStyle = rgba(0x3a2812, 0.40 + rng() * 0.20);
      ctx.lineWidth = 0.5 + rng() * 0.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let px = 10 + rng() * (W - 20);
      let py = 6 + rng() * (H - 12);
      ctx.moveTo(px, py);
      const segs = 3 + Math.floor(rng() * 3);
      for (let j = 0; j < segs; j++) {
        px += (rng() - 0.5) * 8;
        py += (rng() - 0.5) * 4;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // ----- EMBEDDED STONES -----
    drawStones(ctx, 4, 4, W - 8, H - 8, 6 + Math.floor(rng() * 5), rng);

    // ----- SMALL DIRT GRAIN NOISE (tiny irregular specks, NOT strokes) -----
    for (let i = 0; i < 20 + Math.floor(rng() * 15); i++) {
      const sx = rng() * W;
      const sy = rng() * H;
      const sr = 0.3 + rng() * 0.8;
      ctx.fillStyle = rgba(rng() > 0.5 ? 0x4a3a22 : 0x685840, 0.30 + rng() * 0.20);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Per-pixel noise
    const img = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 0) continue;
      const n = (rng() - 0.5) * 28;
      img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);

    ctx.restore();
    tex.refresh();
  }
}

// =============================================================================
// 3. ILLUSTRATED ROCKS — faceted surface + crack lines + moss
// =============================================================================

function generateIllustratedRocks(scene: Phaser.Scene): void {
  const variants: { key: string; seed: number; w: number; h: number }[] = [
    { key: TextureKeys.ENV_ROCK_A, seed: 711, w: 60, h: 36 },
    { key: TextureKeys.ENV_ROCK_B, seed: 722, w: 80, h: 44 },
    { key: TextureKeys.ENV_ROCK_C, seed: 733, w: 50, h: 30 },
    { key: TextureKeys.ENV_ROCK_D, seed: 744, w: 70, h: 40 },
  ];

  for (const { key, seed, w, h } of variants) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) continue;
    const ctx = tex.getContext();
    const rng = mulberry32(seed);

    // Organic rock outline
    const cx = w / 2;
    const cy = h / 2 + 2;
    const sides = 9;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const rx = (w / 2 - 4) * (0.75 + rng() * 0.5);
      const ry = (h / 2 - 4) * (0.70 + rng() * 0.6);
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }

    // Base fill
    ctx.fillStyle = rgba(0x6c6a76, 1);
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();

    // Clip for interior detail
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.clip();

    // Facet planes — 3-4 angular irregular polygons (NOT rotated rectangles)
    // that represent different flat faces on the rock catching light differently
    for (let i = 0; i < 3 + Math.floor(rng() * 2); i++) {
      const fx = cx + (rng() - 0.5) * w * 0.5;
      const fy = cy + (rng() - 0.5) * h * 0.4;
      const fr = 6 + rng() * 10;
      const facetColor = rng() > 0.5 ? 0x7a7888 : 0x5a5866;
      ctx.fillStyle = rgba(facetColor, 0.40 + rng() * 0.12);
      ctx.beginPath();
      const fVerts = 4 + Math.floor(rng() * 3);
      for (let j = 0; j < fVerts; j++) {
        const a = (j / fVerts) * Math.PI * 2 + rng() * 0.4;
        const fw = 0.5 + rng() * 1.0;
        const fpx = fx + Math.cos(a) * fr * fw;
        const fpy = fy + Math.sin(a) * fr * (0.5 + rng() * 0.5) * fw;
        j === 0 ? ctx.moveTo(fpx, fpy) : ctx.lineTo(fpx, fpy);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Small stone specks on the surface (dirt and grit, NOT stroke lines)
    for (let i = 0; i < 8 + Math.floor(rng() * 6); i++) {
      const sx = cx + (rng() - 0.5) * w * 0.7;
      const sy = cy + (rng() - 0.5) * h * 0.6;
      const sr = 0.3 + rng() * 0.7;
      ctx.fillStyle = rgba(rng() > 0.5 ? 0x88889a : 0x4a4a56, 0.35 + rng() * 0.25);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Directional highlight (upper-left — simulated light source)
    ctx.fillStyle = rgba(0x9a98a6, 0.42);
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.15, cy - h * 0.18, w * 0.28, h * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Shadow (lower-right)
    ctx.fillStyle = rgba(0x33333d, 0.50);
    ctx.fillRect(cx - 2, cy, w / 2 + 4, h / 2);

    // Crack lines (2-3 dark jagged lines)
    for (let i = 0; i < 2 + Math.floor(rng()); i++) {
      ctx.strokeStyle = rgba(0x33333d, 0.65);
      ctx.lineWidth = 0.8 + rng() * 0.6;
      ctx.beginPath();
      let px = cx + (rng() - 0.5) * w * 0.4;
      let py = cy + (rng() - 0.5) * h * 0.3;
      ctx.moveTo(px, py);
      for (let j = 0; j < 4; j++) {
        px += (rng() - 0.5) * 10;
        py += (rng() - 0.5) * 8;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Moss accent (small green patches)
    if (rng() > 0.4) {
      for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
        const mx = cx + (rng() - 0.5) * w * 0.5;
        const my = cy + rng() * h * 0.2;
        ctx.fillStyle = rgba(0x4a6630, 0.5 + rng() * 0.3);
        ctx.beginPath();
        ctx.ellipse(mx, my, 3 + rng() * 4, 2 + rng() * 2, rng(), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Per-pixel noise
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 0) continue;
      const n = (rng() - 0.5) * 24;
      img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);

    ctx.restore();

    // Ink outline — single pass, reduced alpha to avoid harsh look
    ctx.strokeStyle = rgba(0x1a1a22, 0.70);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const jx = p.x + (rng() - 0.5) * 0.4;
        const jy = p.y + (rng() - 0.5) * 0.4;
        i === 0 ? ctx.moveTo(jx, jy) : ctx.lineTo(jx, jy);
      });
      ctx.closePath();
      ctx.stroke();
    }

    // Contact shadow under the rock
    ctx.fillStyle = rgba(0x1a1a22, 0.35);
    ctx.beginPath();
    ctx.ellipse(cx, h - 4, w * 0.38, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }
}

// =============================================================================
// 4. ILLUSTRATED SKY — layered cloud wisps with brush breakup
// =============================================================================

// =============================================================================
// 4. ILLUSTRATED SKY — layered cloud masses + horizon haze + paint breakup
// =============================================================================
// The sky is built in layers from back to front:
//   1. Base gradient (warm horizon → cool zenith)
//   2. Vertical color variation bands (horizontal streaks that break up the
//      smooth gradient into painted-looking zones)
//   3. Horizon haze band (wide warm wash near the bottom, fades upward)
//   4. Cloud MASSES — each is a multi-blob irregular polygon shape, NOT a
//      smooth ellipse. Masses have:
//        - irregular polygon contour (10-16 vertices with heavy jitter)
//        - base fill
//        - darker underside shadow (clipped)
//        - brighter top rim highlight (clipped)
//        - interior breakup shapes (smaller sub-blobs at varied alpha)
//        - soft outer fringe (semi-transparent larger polygon behind the main)
//   5. Sun glow with radial gradient
//   6. Per-pixel noise across everything

/** Draw a single cloud mass — an irregular polygon shape with interior
 *  shading, edge breakup, and overlapping sub-blobs. NOT a smooth ellipse. */
function drawCloudMass(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  alpha: number,
  rng: () => number,
): void {
  // Build the main mass as an irregular polygon (12-16 vertices)
  const verts = 12 + Math.floor(rng() * 5);
  const mainPts: { x: number; y: number }[] = [];
  for (let i = 0; i < verts; i++) {
    const a = (i / verts) * Math.PI * 2;
    // Heavy jitter so the contour is clearly NOT an ellipse
    const wobble = 0.5 + rng() * 1.0;
    mainPts.push({
      x: cx + Math.cos(a) * rx * wobble,
      y: cy + Math.sin(a) * ry * wobble,
    });
  }

  const pathFn = (pts: { x: number; y: number }[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
  };

  // Soft outer fringe — a larger, more transparent version behind the main mass
  {
    const fringePts = mainPts.map((p) => ({
      x: cx + (p.x - cx) * (1.25 + rng() * 0.15),
      y: cy + (p.y - cy) * (1.3 + rng() * 0.15),
    }));
    ctx.fillStyle = rgba(0xfff4e0, alpha * 0.3);
    pathFn(fringePts);
    ctx.fill();
  }

  // Main mass base fill
  ctx.fillStyle = rgba(0xfff0d4, alpha);
  pathFn(mainPts);
  ctx.fill();

  // Clipped interior detail
  ctx.save();
  pathFn(mainPts);
  ctx.clip();

  // Shadow underside (lower 50%, darker warm tone)
  ctx.fillStyle = rgba(0xc8a880, alpha * 0.55);
  ctx.fillRect(cx - rx * 1.5, cy, rx * 3, ry * 1.5);

  // Top rim highlight (upper 30%, brighter)
  ctx.fillStyle = rgba(0xffffff, alpha * 0.50);
  ctx.fillRect(cx - rx * 1.5, cy - ry * 1.5, rx * 3, ry * 0.7);

  // Interior breakup sub-blobs — smaller irregular shapes at varied alpha
  // that prevent the mass from reading as a flat filled polygon.
  const subCount = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < subCount; i++) {
    const sx = cx + (rng() - 0.5) * rx * 1.4;
    const sy = cy + (rng() - 0.5) * ry * 1.4;
    const srx = rx * (0.15 + rng() * 0.25);
    const sry = ry * (0.3 + rng() * 0.6);
    const sa = alpha * (0.3 + rng() * 0.4);
    // Pick either brighter (top) or darker (bottom) depending on position
    const isUpper = sy < cy;
    const col = isUpper ? 0xffffff : 0xd8c4a0;
    ctx.fillStyle = rgba(col, sa);
    // Sub-blob as an irregular small polygon
    ctx.beginPath();
    const sVerts = 6 + Math.floor(rng() * 4);
    for (let j = 0; j < sVerts; j++) {
      const a = (j / sVerts) * Math.PI * 2;
      const w = 0.6 + rng() * 0.8;
      const px = sx + Math.cos(a) * srx * w;
      const py = sy + Math.sin(a) * sry * w;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Horizontal paint-stroke breakup lines inside the mass
  for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
    const sy = cy + (rng() - 0.5) * ry;
    ctx.strokeStyle = rgba(0xd0c0a0, alpha * (0.15 + rng() * 0.15));
    ctx.lineWidth = 0.6 + rng() * 1.0;
    ctx.beginPath();
    ctx.moveTo(cx - rx * (0.4 + rng() * 0.4), sy);
    ctx.lineTo(cx + rx * (0.4 + rng() * 0.4), sy + (rng() - 0.5) * 3);
    ctx.stroke();
  }

  ctx.restore();

  // Rim light along the top edge — drawn OUTSIDE the clip so it sits on the contour
  ctx.strokeStyle = rgba(0xffffff, alpha * 0.40);
  ctx.lineWidth = 1.0 + rng() * 0.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // Only stroke the top half of the polygon (approximately)
  const topPts = mainPts.filter((p) => p.y < cy);
  if (topPts.length > 1) {
    topPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
}

function generateIllustratedSky(scene: Phaser.Scene): void {
  const key = TextureKeys.ENV_SKY_GRADIENT;
  if (scene.textures.exists(key)) return;

  const W = 512, H = 720;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  const rng = mulberry32(777);

  // ===== 1. BASE GRADIENT (warm horizon → cool zenith) =====
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, '#2a3a64');
  grad.addColorStop(0.10, '#344a78');
  grad.addColorStop(0.22, '#4a5680');
  grad.addColorStop(0.36, '#6a6884');
  grad.addColorStop(0.50, '#8a7882');
  grad.addColorStop(0.62, '#a88a78');
  grad.addColorStop(0.72, '#c49a6c');
  grad.addColorStop(0.82, '#d8a864');
  grad.addColorStop(0.90, '#e4b46a');
  grad.addColorStop(0.96, '#e8c07a');
  grad.addColorStop(1.00, '#e8c87a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ===== 2. VERTICAL COLOR VARIATION BANDS =====
  // Horizontal brush-like streaks that break up the smooth gradient into
  // painted-looking zones. Each is a wide semi-transparent wash.
  for (let i = 0; i < 20; i++) {
    const y = rng() * H;
    const bandH = 4 + rng() * 16;
    // Pick a color from the gradient's neighborhood (warmer below, cooler above)
    const warmth = y / H;
    const c = warmth > 0.6 ? 0xe0c898 : warmth > 0.3 ? 0xa09088 : 0x506080;
    ctx.fillStyle = rgba(c, 0.04 + rng() * 0.06);
    ctx.fillRect(0, y, W, bandH);
    // Irregular edge — a couple of offset rects to avoid a clean band
    ctx.fillStyle = rgba(c, 0.02 + rng() * 0.03);
    ctx.fillRect(rng() * W * 0.2, y + (rng() - 0.5) * 4, W * 0.8, bandH * 0.5);
  }

  // ===== 3. HORIZON HAZE BAND =====
  // Wide warm atmospheric wash near the bottom that fades upward, simulating
  // dust/moisture in the air near the ground plane.
  {
    const hazeGrad = ctx.createLinearGradient(0, H * 0.70, 0, H * 0.92);
    hazeGrad.addColorStop(0.0, 'rgba(210,180,140,0.00)');
    hazeGrad.addColorStop(0.3, 'rgba(210,180,140,0.12)');
    hazeGrad.addColorStop(0.6, 'rgba(220,190,150,0.18)');
    hazeGrad.addColorStop(1.0, 'rgba(230,200,160,0.14)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, H * 0.70, W, H * 0.22);
    // Irregular haze breakup blobs within the band
    for (let i = 0; i < 6; i++) {
      const hx = rng() * W;
      const hy = H * 0.76 + rng() * H * 0.12;
      ctx.fillStyle = rgba(0xd8c8a8, 0.06 + rng() * 0.06);
      ctx.beginPath();
      ctx.ellipse(hx, hy, 40 + rng() * 60, 8 + rng() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== 4. CLOUD MASSES (layered from back to front) =====
  // 3 tiers of clouds at different altitudes, each with increasing alpha and
  // detail. Back clouds are more transparent and desaturated; front clouds
  // are brighter and more defined.

  // Tier 1: HIGH THIN WISPS (upper sky, very transparent)
  for (let i = 0; i < 5; i++) {
    const cx = 40 + rng() * (W - 80);
    const cy = 60 + rng() * 160;
    drawCloudMass(ctx, cx, cy,
      50 + rng() * 60,     // wide but thin
      6 + rng() * 8,
      0.06 + rng() * 0.06, // very low alpha
      rng);
  }

  // Tier 2: MID-ALTITUDE CLOUD BANKS (thicker, more visible)
  for (let i = 0; i < 6; i++) {
    const cx = 30 + rng() * (W - 60);
    const cy = 220 + rng() * 180;
    drawCloudMass(ctx, cx, cy,
      60 + rng() * 80,
      12 + rng() * 18,
      0.10 + rng() * 0.08,
      rng);
  }

  // Tier 3: LOW CLOUDS near the horizon (denser, warmer, more overlap depth)
  for (let i = 0; i < 8; i++) {
    const cx = 20 + rng() * (W - 40);
    const cy = 420 + rng() * 160;
    drawCloudMass(ctx, cx, cy,
      70 + rng() * 90,
      14 + rng() * 22,
      0.12 + rng() * 0.10,
      rng);
  }

  // ===== 5. SUN GLOW =====
  {
    const sunX = 380;
    const sunY = H * 0.82;
    // Multi-layer radial glow (outer → inner)
    for (const [r, a] of [[160, 0.06], [110, 0.12], [70, 0.22], [40, 0.38]] as [number, number][]) {
      const g = ctx.createRadialGradient(sunX, sunY, r * 0.1, sunX, sunY, r);
      g.addColorStop(0.0, rgba(0xfff4dc, a));
      g.addColorStop(1.0, rgba(0xffd890, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sun disc (irregular — 12-vertex polygon, not a circle)
    const sunPts: { x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const w = 0.85 + rng() * 0.3;
      sunPts.push({ x: sunX + Math.cos(a) * 22 * w, y: sunY + Math.sin(a) * 22 * w });
    }
    ctx.fillStyle = rgba(0xfff8e4, 0.75);
    ctx.beginPath();
    sunPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    // Sun rim (shaky stroke, not a circle)
    ctx.strokeStyle = rgba(0xffe0b4, 0.35);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const rimPts = sunPts.map((p) => ({
      x: sunX + (p.x - sunX) * 1.35 + (rng() - 0.5) * 1.5,
      y: sunY + (p.y - sunY) * 1.35 + (rng() - 0.5) * 1.5,
    }));
    rimPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
  }

  // ===== 6. PER-PIXEL NOISE =====
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * 7;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  tex.refresh();
}

// =============================================================================
// 5. STAGING PROPS — branches, debris, fence rails, shadow patches, mounds
// =============================================================================

function generateStagingProps(scene: Phaser.Scene): void {
  // generateBranches removed — branch silhouettes caused scribble artifacts.
  // If re-added, use bold solid masses, not line-art limbs.
  generateDebris(scene);
  generateFenceRail(scene);
  generateShadowPatch(scene);
  generateMound(scene);
}

// ----- FOREGROUND BRANCH SILHOUETTES -----
// Dark overhanging tree limbs that frame the action from above. Drawn as
// irregular branching paths with small leaf cluster silhouettes at the tips.

function generateBranches(scene: Phaser.Scene): void {
  const variants: { key: string; seed: number; w: number; h: number }[] = [
    { key: TextureKeys.ENV_BRANCH_A, seed: 811, w: 180, h: 90 },
    { key: TextureKeys.ENV_BRANCH_B, seed: 822, w: 150, h: 70 },
    { key: TextureKeys.ENV_BRANCH_C, seed: 833, w: 200, h: 100 },
  ];
  for (const { key, seed, w, h } of variants) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) continue;
    const ctx = tex.getContext();
    const rng = mulberry32(seed);

    // Main branch — thick at left side (trunk exit), tapering right
    const mainY = h * 0.35 + rng() * h * 0.3;
    ctx.strokeStyle = rgba(0x2a1a08, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw 2-3 main limb paths
    const limbs = 2 + Math.floor(rng() * 2);
    for (let li = 0; li < limbs; li++) {
      const startX = 2 + rng() * 10;
      const startY = mainY + (li - 1) * (h * 0.2) + (rng() - 0.5) * 10;
      const endX = w * (0.5 + rng() * 0.45);
      const endY = startY + (rng() - 0.5) * h * 0.3;
      const segments = 5 + Math.floor(rng() * 4);
      const startW = 5 + rng() * 3;

      // Single-pass tapered limb (no double-stroking that creates scribble lines)
      ctx.lineWidth = startW;
      ctx.strokeStyle = rgba(0x2a1a08, 1);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      let px = startX, py = startY;
      for (let s = 0; s < segments; s++) {
        px += (endX - startX) / segments + (rng() - 0.5) * 5;
        py += (endY - startY) / segments + (rng() - 0.5) * 3;
        const t = (s + 1) / segments;
        ctx.lineWidth = startW * (1 - t * 0.65);
        ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Small sub-branches splitting off
      const subs = 2 + Math.floor(rng() * 3);
      for (let si = 0; si < subs; si++) {
        const splitT = 0.3 + rng() * 0.5;
        const sx = startX + (endX - startX) * splitT + (rng() - 0.5) * 8;
        const sy = startY + (endY - startY) * splitT + (rng() - 0.5) * 6;
        const sbLen = 12 + rng() * 20;
        const sbAngle = (rng() - 0.5) * 1.2 + (rng() > 0.5 ? 0.5 : -0.5);
        ctx.lineWidth = 1.5 + rng() * 1.5;
        ctx.strokeStyle = rgba(0x2a1a08, 0.9);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(sbAngle) * sbLen, sy + Math.sin(sbAngle) * sbLen);
        ctx.stroke();

        // Leaf cluster silhouettes at sub-branch tips
        const tipX = sx + Math.cos(sbAngle) * sbLen;
        const tipY = sy + Math.sin(sbAngle) * sbLen;
        const leafCount = 3 + Math.floor(rng() * 4);
        for (let j = 0; j < leafCount; j++) {
          const lx = tipX + (rng() - 0.5) * 10;
          const ly = tipY + (rng() - 0.5) * 8;
          const lr = 2 + rng() * 3;
          ctx.fillStyle = rgba(0x1a2a10, 0.7 + rng() * 0.3);
          ctx.beginPath();
          ctx.ellipse(lx, ly, lr, lr * (0.5 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // (Bark streaks removed — they read as scribble when the branch
    // texture is tinted dark and placed as a silhouette.)

    tex.refresh();
  }
}

// ----- ANGLED DEBRIS — fallen beams, splintered wood -----
// Drawn at an angle so they read as "fallen structure" not "placed prop."

function generateDebris(scene: Phaser.Scene): void {
  const variants: { key: string; seed: number }[] = [
    { key: TextureKeys.ENV_DEBRIS_A, seed: 911 },
    { key: TextureKeys.ENV_DEBRIS_B, seed: 922 },
  ];
  for (const { key, seed } of variants) {
    if (scene.textures.exists(key)) continue;
    const W = 80, H = 24;
    const tex = scene.textures.createCanvas(key, W, H);
    if (!tex) continue;
    const ctx = tex.getContext();
    const rng = mulberry32(seed);

    // Main beam (angled slightly)
    const lean = (rng() - 0.5) * 0.15;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(lean);

    // Beam body
    const halfW = W * 0.44;
    const halfH = 4 + rng() * 2;
    const pts = [
      { x: -halfW, y: -halfH },
      { x: halfW - 2, y: -halfH + 1 },
      // Splintered right end
      { x: halfW, y: -halfH + 2 }, { x: halfW + 3, y: -1 },
      { x: halfW, y: halfH - 2 },
      { x: halfW - 2, y: halfH - 1 },
      { x: -halfW, y: halfH },
    ];
    ctx.fillStyle = rgba(0x5a3a1a, 1);
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();

    // Wood grain
    ctx.clip();
    for (let i = 0; i < 10; i++) {
      ctx.strokeStyle = rgba(0x3a2210, 0.25 + rng() * 0.15);
      ctx.lineWidth = 0.4 + rng() * 0.5;
      const gy = -halfH + rng() * halfH * 2;
      ctx.beginPath();
      ctx.moveTo(-halfW, gy);
      ctx.lineTo(halfW, gy + (rng() - 0.5) * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Shadow underneath
    ctx.fillStyle = rgba(0x1a1008, 0.35);
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 4, halfW * 0.8, 2.5, lean, 0, Math.PI * 2);
    ctx.fill();

    // Ink outline
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(lean);
    ctx.strokeStyle = rgba(0x1a1a22, 0.9);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => {
      const jx = p.x + (rng() - 0.5) * 0.6;
      const jy = p.y + (rng() - 0.5) * 0.6;
      i === 0 ? ctx.moveTo(jx, jy) : ctx.lineTo(jx, jy);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Splinter fragments near the broken end
    for (let i = 0; i < 3; i++) {
      const sx = W * 0.7 + rng() * W * 0.2;
      const sy = H * 0.3 + rng() * H * 0.4;
      ctx.fillStyle = rgba(0x5a3a1a, 0.8);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((rng() - 0.5) * 0.8);
      ctx.fillRect(-3, -0.5, 6, 1);
      ctx.restore();
    }

    tex.refresh();
  }
}

// ----- FENCE RAIL — horizontal rail segment crossing the play lane -----

function generateFenceRail(scene: Phaser.Scene): void {
  const key = TextureKeys.ENV_FENCE_RAIL;
  if (scene.textures.exists(key)) return;
  const W = 100, H = 14;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  const rng = mulberry32(941);

  // Two horizontal rails with a slight sag
  for (let rail = 0; rail < 2; rail++) {
    const ry = 3 + rail * 7;
    const railH = 2.5;
    ctx.fillStyle = rgba(0x5a3a1a, 1);
    ctx.beginPath();
    ctx.moveTo(2, ry - railH);
    // Sagging curve
    ctx.quadraticCurveTo(W / 2, ry - railH + 2 + rng(), W - 2, ry - railH + (rng() - 0.5) * 1.5);
    ctx.lineTo(W - 2, ry + railH + (rng() - 0.5));
    ctx.quadraticCurveTo(W / 2, ry + railH + 1.5 + rng(), 2, ry + railH);
    ctx.closePath();
    ctx.fill();
    // Grain
    ctx.strokeStyle = rgba(0x3a2210, 0.30);
    ctx.lineWidth = 0.4;
    for (let i = 0; i < 5; i++) {
      const gy = ry - railH + rng() * railH * 2;
      ctx.beginPath();
      ctx.moveTo(4, gy);
      ctx.lineTo(W - 4, gy + (rng() - 0.5));
      ctx.stroke();
    }
    // Ink outline
    ctx.strokeStyle = rgba(0x1a1a22, 0.85);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(2 + (rng() - 0.5), ry - railH + (rng() - 0.5) * 0.6);
    ctx.quadraticCurveTo(W / 2, ry - railH + 2 + rng(), W - 2 + (rng() - 0.5), ry - railH + (rng() - 0.5));
    ctx.lineTo(W - 2 + (rng() - 0.5), ry + railH + (rng() - 0.5));
    ctx.quadraticCurveTo(W / 2, ry + railH + 1.5 + rng(), 2 + (rng() - 0.5), ry + railH + (rng() - 0.5) * 0.6);
    ctx.closePath();
    ctx.stroke();
  }

  // Broken ends (splintered left/right)
  for (const ex of [1, W - 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = rgba(0x5a3a1a, 0.7);
      ctx.save();
      ctx.translate(ex, 3 + rng() * 8);
      ctx.rotate((rng() - 0.5) * 0.4);
      ctx.fillRect(0, 0, 3 + rng() * 3, 0.8);
      ctx.restore();
    }
  }

  tex.refresh();
}

// ----- GROUND SHADOW PATCH — dark irregular zones under trees/structures -----

function generateShadowPatch(scene: Phaser.Scene): void {
  const key = TextureKeys.ENV_SHADOW_PATCH;
  if (scene.textures.exists(key)) return;
  const W = 100, H = 32;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  const rng = mulberry32(951);

  // Organic blob — very low alpha, dark, NO outline (blends into ground)
  const sides = 11;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const rx = (W / 2 - 6) * (0.7 + rng() * 0.6);
    const ry = (H / 2 - 4) * (0.6 + rng() * 0.8);
    pts.push({ x: W / 2 + Math.cos(a) * rx, y: H / 2 + Math.sin(a) * ry });
  }
  ctx.fillStyle = rgba(0x1a1208, 0.50);
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();

  // Softer inner core (darker)
  ctx.fillStyle = rgba(0x0a0804, 0.30);
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2 + 1, W * 0.25, H * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  tex.refresh();
}

// ----- TERRAIN MOUND — slight earth ridge / elevation hint -----

function generateMound(scene: Phaser.Scene): void {
  const key = TextureKeys.ENV_MOUND;
  if (scene.textures.exists(key)) return;
  const W = 120, H = 18;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  const rng = mulberry32(961);

  // Slightly raised earth bump — darker at the base, brighter top ridge
  const pts: { x: number; y: number }[] = [
    { x: 4, y: H - 2 },
  ];
  // Top curve (irregular)
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = 4 + t * (W - 8);
    const bump = Math.sin(t * Math.PI) * (H * 0.5) * (0.6 + rng() * 0.8);
    pts.push({ x, y: H - 2 - bump });
  }
  pts.push({ x: W - 4, y: H - 2 });

  ctx.fillStyle = rgba(0x6b5638, 1);
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();

  // Clip for interior detail
  ctx.save();
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.clip();

  // Highlight ridge along the top
  ctx.strokeStyle = rgba(0x9a8050, 0.65);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.slice(1, -1).forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Shadow at the base
  ctx.fillStyle = rgba(0x342414, 0.50);
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // Dirt grain
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = rgba(0x4a3a22, 0.20 + rng() * 0.10);
    ctx.lineWidth = 0.4 + rng() * 0.5;
    const gx = rng() * W;
    const gy = H * 0.3 + rng() * H * 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 6 + rng() * 10, gy + (rng() - 0.5) * 2);
    ctx.stroke();
  }

  // A few small stones
  drawStones(ctx, 6, H * 0.4, W - 12, H * 0.3, 3, rng);

  ctx.restore();

  // Per-pixel noise
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    const n = (rng() - 0.5) * 22;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  tex.refresh();
}
