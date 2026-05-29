// =============================================================================
// SKILL VFX SYSTEM — layered, dimensional visual effects for hero abilities
// =============================================================================
// Every skill effect follows a 4-phase structure:
//   1. ANTICIPATION — brief telegraph/charge-up (glow gather, ground mark)
//   2. ACTIVE        — the main effect (arcs, blasts, trails)
//   3. IMPACT         — burst at the moment of contact (flash, sparks, shake)
//   4. AFTER-EFFECT   — lingering residue (fading glow, dust, embers)
//
// Effects use LAYERED TRANSPARENCY — brighter core + softer outer glow —
// to create dimensional, glowing visuals instead of flat filled circles.
//
// All helpers auto-destroy and require no caller cleanup.

import Phaser from 'phaser';
import { blobPath } from './paint';

// =============================================================================
// CONFIGURATION — intensity knobs for global VFX tuning
// =============================================================================

export const SKILL_FX_TUNE = {
  /** Global intensity scale (0..1). Reduce to tone down all skill FX at once. */
  globalIntensity: 1.0,
  /** Camera shake multiplier applied to all skill shakes. */
  shakeScale: 1.0,
} as const;

// =============================================================================
// LAYERED GLOW — brighter core + softer outer halo
// =============================================================================
// The foundation of every skill effect. Replaces the old "single filled circle"
// with 3 concentric layers at decreasing alpha: outer halo → mid glow → hot core.

export function spawnGlow(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    color?: number;
    coreColor?: number;
    radius?: number;
    duration?: number;
    depth?: number;
    scale?: number;
  } = {},
): void {
  const {
    color = 0xffeebb,
    coreColor = 0xffffff,
    radius = 30,
    duration = 400,
    depth = y + 100,
    scale = 1.0,
  } = options;

  // Outer halo (softest, widest)
  const outer = scene.add.graphics().setDepth(depth);
  const outerPts = blobPath(0, 0, radius * 1.4, radius * 1.2, { sides: 14, jitter: 0.15, seed: Math.random() * 9999 | 0 });
  outer.fillStyle(color, 0.15 * SKILL_FX_TUNE.globalIntensity);
  outer.fillPoints(outerPts, true);
  outer.x = x; outer.y = y; outer.setScale(scale);
  scene.tweens.add({
    targets: outer, scale: scale * 1.6, alpha: 0,
    duration, ease: 'Quad.easeOut', onComplete: () => outer.destroy(),
  });

  // Mid glow
  const mid = scene.add.graphics().setDepth(depth + 1);
  const midPts = blobPath(0, 0, radius * 0.8, radius * 0.7, { sides: 12, jitter: 0.18, seed: (Math.random() * 9999 | 0) + 1 });
  mid.fillStyle(color, 0.35 * SKILL_FX_TUNE.globalIntensity);
  mid.fillPoints(midPts, true);
  mid.x = x; mid.y = y; mid.setScale(scale);
  scene.tweens.add({
    targets: mid, scale: scale * 1.3, alpha: 0,
    duration: duration * 0.8, ease: 'Quad.easeOut', onComplete: () => mid.destroy(),
  });

  // Hot core
  const core = scene.add.graphics().setDepth(depth + 2);
  const corePts = blobPath(0, 0, radius * 0.35, radius * 0.3, { sides: 10, jitter: 0.2, seed: (Math.random() * 9999 | 0) + 2 });
  core.fillStyle(coreColor, 0.85 * SKILL_FX_TUNE.globalIntensity);
  core.fillPoints(corePts, true);
  core.x = x; core.y = y; core.setScale(scale);
  scene.tweens.add({
    targets: core, scale: scale * 0.8, alpha: 0,
    duration: duration * 0.5, ease: 'Quad.easeOut', onComplete: () => core.destroy(),
  });
}

// =============================================================================
// ENERGY ARC — curved slash trail with glow
// =============================================================================
// A wide sweeping arc that fades and stretches. Used for melee skills,
// slashes, smites, and directional attacks.

export function spawnEnergyArc(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    color?: number;
    coreColor?: number;
    width?: number;
    height?: number;
    angle?: number;
    duration?: number;
    depth?: number;
    flipX?: boolean;
  } = {},
): void {
  const {
    color = 0xffeebb,
    coreColor = 0xffffff,
    width = 80,
    height = 20,
    angle = 0,
    duration = 300,
    depth = y + 101,
    flipX = false,
  } = options;
  const dir = flipX ? -1 : 1;

  // Outer glow arc (wider, softer)
  const outerG = scene.add.graphics().setDepth(depth);
  outerG.fillStyle(color, 0.30 * SKILL_FX_TUNE.globalIntensity);
  outerG.beginPath();
  outerG.arc(0, 0, width * 0.55, -0.5, 0.5, false);
  outerG.lineTo(0, 0);
  outerG.closePath();
  outerG.fillPath();
  outerG.x = x; outerG.y = y;
  outerG.rotation = angle;
  outerG.scaleX = dir;
  scene.tweens.add({
    targets: outerG, scaleX: dir * 1.5, scaleY: 1.3, alpha: 0,
    duration, ease: 'Quad.easeOut', onComplete: () => outerG.destroy(),
  });

  // Core arc (brighter, narrower)
  const coreG = scene.add.graphics().setDepth(depth + 1);
  coreG.fillStyle(coreColor, 0.70 * SKILL_FX_TUNE.globalIntensity);
  coreG.beginPath();
  coreG.arc(0, 0, width * 0.35, -0.3, 0.3, false);
  coreG.lineTo(0, 0);
  coreG.closePath();
  coreG.fillPath();
  coreG.x = x; coreG.y = y;
  coreG.rotation = angle;
  coreG.scaleX = dir;
  void height;
  scene.tweens.add({
    targets: coreG, scaleX: dir * 1.3, alpha: 0,
    duration: duration * 0.65, ease: 'Quad.easeOut', onComplete: () => coreG.destroy(),
  });
}

// =============================================================================
// GROUND IMPACT DECAL — dark mark left on the ground after a heavy skill
// =============================================================================

export function spawnGroundDecal(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    color?: number;
    radius?: number;
    duration?: number;
  } = {},
): void {
  const { color = 0x1a1a22, radius = 24, duration = 800 } = options;
  const decalG = scene.add.graphics().setDepth(y - 1);
  const pts = blobPath(0, 0, radius, radius * 0.35, { sides: 10, jitter: 0.35, seed: Math.random() * 9999 | 0 });
  decalG.fillStyle(color, 0.35 * SKILL_FX_TUNE.globalIntensity);
  decalG.fillPoints(pts, true);
  decalG.x = x; decalG.y = y;
  scene.tweens.add({
    targets: decalG, alpha: 0, scale: 1.15,
    duration, ease: 'Sine.easeOut', onComplete: () => decalG.destroy(),
  });
}

// =============================================================================
// RADIAL BURST — expanding ring + particle spray for AoE impacts
// =============================================================================

export function spawnRadialBurst(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    color?: number;
    coreColor?: number;
    radius?: number;
    particleCount?: number;
    duration?: number;
    depth?: number;
    shake?: boolean;
    shakeIntensity?: number;
    shakeDuration?: number;
  } = {},
): void {
  const {
    color = 0xffeebb,
    coreColor = 0xffffff,
    radius = 50,
    particleCount = 10,
    duration = 400,
    depth = y + 100,
    shake = false,
    shakeIntensity = 0.006,
    shakeDuration = 150,
  } = options;

  // Expanding ring (organic, not a perfect circle)
  const ringG = scene.add.graphics().setDepth(depth);
  const ringPts = blobPath(0, 0, 10, 6, { sides: 16, jitter: 0.18, seed: Math.random() * 9999 | 0 });
  ringG.lineStyle(3.5, color, 0.80 * SKILL_FX_TUNE.globalIntensity);
  ringG.strokePoints(ringPts, true, true);
  ringG.lineStyle(1.8, coreColor, 0.60 * SKILL_FX_TUNE.globalIntensity);
  ringG.strokePoints(ringPts, true, true);
  ringG.x = x; ringG.y = y;
  scene.tweens.add({
    targets: ringG, scaleX: radius / 10, scaleY: radius / 10, alpha: 0,
    duration, ease: 'Quad.easeOut', onComplete: () => ringG.destroy(),
  });

  // Central flash glow
  spawnGlow(scene, x, y, { color, coreColor, radius: radius * 0.4, duration: duration * 0.6, depth });

  // Particle spray — small energy motes shooting outward
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
    const dist = radius * Phaser.Math.FloatBetween(0.6, 1.1);
    const moteG = scene.add.graphics().setDepth(depth + 1);
    const moteR = 1.5 + Math.random() * 2.5;
    // Bright core + dim outer
    moteG.fillStyle(coreColor, 0.9);
    moteG.fillCircle(0, 0, moteR * 0.5);
    moteG.fillStyle(color, 0.5);
    moteG.fillCircle(0, 0, moteR);
    moteG.x = x; moteG.y = y;
    scene.tweens.add({
      targets: moteG,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0, scale: 0.4,
      duration: duration * (0.7 + Math.random() * 0.5),
      ease: 'Quad.easeOut',
      onComplete: () => moteG.destroy(),
    });
  }

  if (shake) {
    scene.cameras.main.shake(
      shakeDuration * SKILL_FX_TUNE.shakeScale,
      shakeIntensity * SKILL_FX_TUNE.shakeScale,
    );
  }
}

// =============================================================================
// ANTICIPATION GATHER — inward-pulling particles + growing glow
// =============================================================================
// Used at the start of a skill to telegraph the cast. Particles converge
// toward the center over `duration` ms, then a bright core flash fires.

export function spawnAnticipation(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    color?: number;
    radius?: number;
    duration?: number;
    particleCount?: number;
    depth?: number;
  } = {},
): void {
  const {
    color = 0xffeebb,
    radius = 40,
    duration = 300,
    particleCount = 8,
    depth = y + 99,
  } = options;

  // Inward-converging motes
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
    const dist = radius * Phaser.Math.FloatBetween(0.7, 1.2);
    const startX = x + Math.cos(angle) * dist;
    const startY = y + Math.sin(angle) * dist;
    const moteG = scene.add.graphics().setDepth(depth);
    const r = 1 + Math.random() * 2;
    moteG.fillStyle(color, 0.7);
    moteG.fillCircle(0, 0, r);
    moteG.fillStyle(0xffffff, 0.5);
    moteG.fillCircle(0, 0, r * 0.4);
    moteG.x = startX; moteG.y = startY;
    scene.tweens.add({
      targets: moteG, x, y, alpha: 0, scale: 0.3,
      duration: duration * (0.6 + Math.random() * 0.4),
      ease: 'Quad.easeIn', onComplete: () => moteG.destroy(),
    });
  }

  // Growing center glow (small → medium during anticipation)
  const centerG = scene.add.graphics().setDepth(depth + 1);
  centerG.fillStyle(color, 0.25);
  centerG.fillCircle(0, 0, 6);
  centerG.fillStyle(0xffffff, 0.5);
  centerG.fillCircle(0, 0, 2);
  centerG.x = x; centerG.y = y; centerG.setScale(0.3);
  scene.tweens.add({
    targets: centerG, scale: 1.5, alpha: 0.6,
    duration, ease: 'Quad.easeOut',
    onComplete: () => {
      // Flash at the end of anticipation
      centerG.destroy();
    },
  });
}

// =============================================================================
// AFTER-EFFECT EMBERS — lingering particles drifting upward post-skill
// =============================================================================

export function spawnLingeringEmbers(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    color?: number;
    count?: number;
    spread?: number;
    duration?: number;
    depth?: number;
  } = {},
): void {
  const {
    color = 0xffeebb,
    count = 6,
    spread = 30,
    duration = 600,
    depth = y + 50,
  } = options;
  for (let i = 0; i < count; i++) {
    const startX = x + Phaser.Math.FloatBetween(-spread, spread);
    const startY = y + Phaser.Math.FloatBetween(-4, 4);
    const emberG = scene.add.graphics().setDepth(depth);
    const r = 0.8 + Math.random() * 1.4;
    emberG.fillStyle(color, 0.8);
    emberG.fillCircle(0, 0, r);
    emberG.fillStyle(0xffffff, 0.6);
    emberG.fillCircle(0, 0, r * 0.35);
    emberG.x = startX; emberG.y = startY;
    scene.tweens.add({
      targets: emberG,
      x: startX + Phaser.Math.FloatBetween(-10, 10),
      y: startY - Phaser.Math.FloatBetween(20, 50),
      alpha: 0, scale: 0.3,
      duration: duration + Phaser.Math.Between(-100, 100),
      ease: 'Sine.easeOut', onComplete: () => emberG.destroy(),
    });
  }
}

// =============================================================================
// SCREEN FLASH — tinted full-screen overlay with additive-blend feel
// =============================================================================
// Replaces the old single-rect flash with a 2-layer flash: bright core +
// tinted halo for a more dimensional screen-space effect.

export function spawnScreenFlash(
  scene: Phaser.Scene,
  options: {
    color?: number;
    coreColor?: number;
    alpha?: number;
    duration?: number;
  } = {},
): void {
  const {
    color = 0xffffff,
    coreColor = 0xffffff,
    alpha = 0.45,
    duration = 130,
  } = options;
  const cam = scene.cameras.main;
  const cx = cam.midPoint.x;
  const cy = cam.midPoint.y;
  const w = cam.width + 200;
  const h = cam.height + 200;

  // Tinted halo layer
  const halo = scene.add.rectangle(cx, cy, w, h, color, alpha * 0.4 * SKILL_FX_TUNE.globalIntensity)
    .setScrollFactor(0).setDepth(99998);
  scene.tweens.add({
    targets: halo, alpha: 0, duration: duration * 1.2,
    ease: 'Quad.easeOut', onComplete: () => halo.destroy(),
  });

  // Bright core layer
  const core = scene.add.rectangle(cx, cy, w, h, coreColor, alpha * SKILL_FX_TUNE.globalIntensity)
    .setScrollFactor(0).setDepth(99999);
  scene.tweens.add({
    targets: core, alpha: 0, duration,
    ease: 'Quad.easeOut', onComplete: () => core.destroy(),
  });
}

// =============================================================================
// HOLY SMITE — vertical beam from the sky
// =============================================================================
// 4-phase pillar of light: target mark → sky beam → impact burst → lingering.
// The beam is NOT a single rectangle. It's built from 3 concentric layers
// (outer glow + mid light + hot core) each drawn as irregular polygons so the
// beam has visible width variation and organic edges.
//
// The damage callback fires at the exact moment the beam hits the ground
// (end of Phase 2), so gameplay and visuals are synced.

export function spawnHolySmite(
  scene: Phaser.Scene,
  centerX: number,
  groundY: number,
  options: {
    beamWidth?: number;
    onImpact?: () => void;
    depth?: number;
  } = {},
): void {
  const {
    beamWidth = 70,
    onImpact,
    depth = groundY + 100,
  } = options;

  const ANTICIPATION_MS = 200;
  const DESCENT_MS      = 120;
  const LINGER_MS       = 350;

  const cam = scene.cameras.main;
  const skyTopY = cam.scrollY - 50;
  const beamH = groundY - skyTopY + 70;

  // ===== PHASE 1: GROUND MARK =====

  // Circular glyph — organic blob, not a perfect circle
  const glyphG = scene.add.graphics().setDepth(depth - 2);
  // Outer ring
  const ringPts = blobPath(0, 0, beamWidth * 0.5, beamWidth * 0.16,
    { sides: 18, jitter: 0.12, seed: 55 });
  glyphG.lineStyle(2.0, 0xffe8a0, 0.50 * SKILL_FX_TUNE.globalIntensity);
  glyphG.strokePoints(ringPts, true, true);
  // Inner filled glow
  const innerPts = blobPath(0, 0, beamWidth * 0.35, beamWidth * 0.10,
    { sides: 14, jitter: 0.15, seed: 56 });
  glyphG.fillStyle(0xffe8a0, 0.30 * SKILL_FX_TUNE.globalIntensity);
  glyphG.fillPoints(innerPts, true);
  // Bright core dot
  const corePts = blobPath(0, 0, beamWidth * 0.12, beamWidth * 0.04,
    { sides: 10, jitter: 0.18, seed: 57 });
  glyphG.fillStyle(0xffffff, 0.55 * SKILL_FX_TUNE.globalIntensity);
  glyphG.fillPoints(corePts, true);
  glyphG.x = centerX; glyphG.y = groundY;
  glyphG.setScale(0.5);
  scene.tweens.add({
    targets: glyphG, scale: 1.15, alpha: 0.8,
    duration: ANTICIPATION_MS, ease: 'Sine.easeOut',
  });

  // Faint vertical rays forming upward (4 thin wedges)
  for (let i = 0; i < 4; i++) {
    const rayG = scene.add.graphics().setDepth(depth - 3);
    const rx = centerX + (i - 1.5) * beamWidth * 0.14 + Phaser.Math.FloatBetween(-3, 3);
    const rw = 1.5 + Math.random() * 2.5;
    const rh = 25 + Math.random() * 20;
    rayG.fillStyle(0xfff4cc, 0.15 * SKILL_FX_TUNE.globalIntensity);
    rayG.fillRect(-rw / 2, 0, rw, -rh);
    rayG.x = rx; rayG.y = groundY;
    rayG.setScale(1, 0.1);
    scene.tweens.add({
      targets: rayG, scaleY: 1, alpha: 0.28,
      duration: ANTICIPATION_MS * 0.8, ease: 'Quad.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: rayG, alpha: 0, duration: 160,
          onComplete: () => rayG.destroy(),
        });
      },
    });
  }

  // ===== PHASE 2: TRANSLUCENT LIGHT PILLAR =====
  // Each layer is rendered to a CanvasTexture with a horizontal gradient
  // (transparent → color → transparent) so the beam has SOFT FEATHERED EDGES
  // instead of hard polygon outlines. Three layers stack for the bloom look:
  //   outer aura  — widest, lowest alpha, softest
  //   mid glow    — narrower, brighter, slight shimmer tween
  //   inner core  — thinnest, brightest white
  // All VFX scheduling uses window.setTimeout (real wall-clock time) instead
  // of scene.time.delayedCall, because the hit-stop in Phase 3 sets
  // scene.time.timeScale to near-zero — any delayedCall queued before the
  // restore would be stretched to seconds.
  window.setTimeout(() => {
    const rgb = (c: number): [number, number, number] =>
      [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];

    // Build a single beam-layer CanvasTexture with horizontal gradient feathering.
    // Returns a Phaser.GameObjects.Image positioned at the beam center.
    const buildGradientLayer = (
      widthFrac: number,
      color: number,
      peakAlpha: number,
      depthOff: number,
    ): Phaser.GameObjects.Image => {
      const layerW = Math.ceil(beamWidth * widthFrac);
      const layerH = Math.ceil(beamH);
      const texKey = `_smite_layer_${widthFrac}_${Date.now()}_${Math.random()}`;
      const tex = scene.textures.createCanvas(texKey, layerW, layerH);
      if (!tex) return scene.add.image(centerX, groundY, '__DEFAULT'); // fallback
      const ctx = tex.getContext();
      const [cr, cg, cb] = rgb(color);

      // Horizontal gradient: transparent → peak → transparent (feathered edges)
      const grad = ctx.createLinearGradient(0, 0, layerW, 0);
      grad.addColorStop(0.00, `rgba(${cr},${cg},${cb},0)`);
      grad.addColorStop(0.20, `rgba(${cr},${cg},${cb},${peakAlpha * 0.4})`);
      grad.addColorStop(0.40, `rgba(${cr},${cg},${cb},${peakAlpha * 0.8})`);
      grad.addColorStop(0.50, `rgba(${cr},${cg},${cb},${peakAlpha})`);
      grad.addColorStop(0.60, `rgba(${cr},${cg},${cb},${peakAlpha * 0.8})`);
      grad.addColorStop(0.80, `rgba(${cr},${cg},${cb},${peakAlpha * 0.4})`);
      grad.addColorStop(1.00, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, layerW, layerH);

      // Vertical shimmer — faint brightness variation along the height
      // (subtle horizontal bands at varying alpha to break up uniformity)
      for (let sy = 0; sy < layerH; sy += 12 + Math.random() * 18) {
        const bandH = 4 + Math.random() * 8;
        const bandAlpha = 0.03 + Math.random() * 0.05;
        ctx.fillStyle = `rgba(255,255,255,${bandAlpha})`;
        ctx.fillRect(layerW * 0.15, sy, layerW * 0.7, bandH);
      }

      tex.refresh();

      const img = scene.add.image(centerX, skyTopY + beamH / 2, texKey)
        .setDepth(depth + depthOff)
        .setAlpha(SKILL_FX_TUNE.globalIntensity);
      // Clean up the texture when the image is destroyed
      img.once('destroy', () => { scene.textures.remove(texKey); });
      return img;
    };

    // Layer 1: OUTER AURA — widest, softest, lowest alpha
    const outerBeam = buildGradientLayer(1.6, 0xffe0a0, 0.14, 0);
    // Layer 2: MID GLOW — narrower, brighter
    const midBeam   = buildGradientLayer(0.8, 0xfff4cc, 0.32, 1);
    // Layer 3: INNER CORE — thinnest, brightest white
    const coreBeam  = buildGradientLayer(0.25, 0xffffff, 0.75, 2);
    const beams = [outerBeam, midBeam, coreBeam];

    // Descend via Y-scale from the top of the screen
    for (const beam of beams) {
      beam.setOrigin(0.5, 0);
      beam.y = skyTopY;
      beam.setScale(1, 0.04);
      scene.tweens.add({
        targets: beam, scaleY: 1,
        duration: DESCENT_MS, ease: 'Expo.easeIn',
      });
    }

    // Mid glow gets a subtle width shimmer tween — gentle breathing effect
    scene.tweens.add({
      targets: midBeam, scaleX: 1.08,
      duration: 80, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
    });

    // ----- Sparkle particles inside the column — two waves -----
    const spawnSparkle = (delay: number, yRange: number, drift: number) => {
      window.setTimeout(() => {
        const sg = scene.add.graphics().setDepth(depth + 3);
        const sy = groundY - Math.random() * yRange;
        const sx = centerX + Phaser.Math.FloatBetween(-beamWidth * 0.22, beamWidth * 0.22);
        const sr = 0.7 + Math.random() * 1.2;
        // White core
        sg.fillStyle(0xffffff, 0.90);
        sg.fillCircle(0, 0, sr * 0.35);
        // Gold halo
        sg.fillStyle(0xffe8a0, 0.40);
        sg.fillCircle(0, 0, sr);
        sg.x = sx; sg.y = sy;
        scene.tweens.add({
          targets: sg,
          x: sx + Phaser.Math.FloatBetween(-drift, drift),
          y: sy - Phaser.Math.FloatBetween(10, 30),
          alpha: 0, scale: 0.1,
          duration: 180 + Math.random() * 160,
          ease: 'Quad.easeOut', onComplete: () => sg.destroy(),
        });
      });
    };
    // Wave 1: spread across the beam during descent
    for (let i = 0; i < 16; i++) {
      spawnSparkle(Math.random() * DESCENT_MS, beamH * 0.6, 5);
    }
    // Wave 2: concentrated near the ground at impact
    for (let i = 0; i < 10; i++) {
      spawnSparkle(DESCENT_MS + Math.random() * 60, beamH * 0.12, 10);
    }

    // ----- Upward drifting light motes inside the beam (continuous) -----
    // These drift upward DURING the beam's lifetime, giving it internal
    // vertical energy motion instead of being a static column.
    for (let i = 0; i < 8; i++) {
      const delay = 40 + i * 25;
      window.setTimeout(() => {
        const mote = scene.add.graphics().setDepth(depth + 2);
        const mx = centerX + Phaser.Math.FloatBetween(-beamWidth * 0.15, beamWidth * 0.15);
        const my = groundY - Math.random() * beamH * 0.3;
        mote.fillStyle(0xffffff, 0.65);
        mote.fillCircle(0, 0, 0.8 + Math.random() * 0.6);
        mote.x = mx; mote.y = my;
        scene.tweens.add({
          targets: mote,
          y: my - 40 - Math.random() * 60,
          alpha: 0,
          duration: 300 + Math.random() * 200,
          ease: 'Sine.easeOut', onComplete: () => mote.destroy(),
        });
      });
    }

    // ===== PHASE 3: IMPACT BURST — divine execution moment =====
    window.setTimeout(() => {
      if (onImpact) onImpact();

      // ----- HEAVY HIT-STOP — uses wall-clock setTimeout to restore -----
      const prev = scene.time.timeScale;
      scene.time.timeScale = 0.03;
      window.setTimeout(() => { scene.time.timeScale = prev; }, 100);

      // ----- STRONG CAMERA SHAKE -----
      scene.cameras.main.shake(
        340 * SKILL_FX_TUNE.shakeScale,
        0.020 * SKILL_FX_TUNE.shakeScale,
      );

      // ----- SCREEN-WIDE LIGHT WASH (warm gold → white layered) -----
      const camMid = scene.cameras.main.midPoint;
      // Screen flash removed — caused position-dependent rectangle artifact

      // ----- VERTICAL LIGHT RAYS shooting upward from impact -----
      for (let i = 0; i < 5; i++) {
        const rayG = scene.add.graphics().setDepth(depth + 3);
        const rx = centerX + (i - 2) * beamWidth * 0.12 + Phaser.Math.FloatBetween(-4, 4);
        const rw = 2 + Math.random() * 3;
        const rh = 35 + Math.random() * 45;
        // Bright white core
        rayG.fillStyle(0xffffff, 0.70 * SKILL_FX_TUNE.globalIntensity);
        rayG.fillRect(-rw * 0.3 / 2, 0, rw * 0.3, -rh);
        // Gold outer glow
        rayG.fillStyle(0xffe8a0, 0.30 * SKILL_FX_TUNE.globalIntensity);
        rayG.fillRect(-rw / 2, 0, rw, -rh);
        rayG.x = rx; rayG.y = groundY;
        rayG.setScale(1, 0.1);
        scene.tweens.add({
          targets: rayG, scaleY: 1,
          duration: 120, ease: 'Quad.easeOut',
        });
        scene.tweens.add({
          targets: rayG, alpha: 0, scaleY: 1.4,
          delay: 120, duration: 280, ease: 'Sine.easeOut',
          onComplete: () => rayG.destroy(),
        });
      }

      // Radial shock ring along ground
      spawnRadialBurst(scene, centerX, groundY, {
        color: 0xffe8a0, coreColor: 0xffffff,
        radius: beamWidth * 1.1, particleCount: 14,
        duration: 420, shake: false,
      });

      // Dust + light particles expanding outward
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dist = beamWidth * 0.4 + Math.random() * beamWidth * 0.3;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist * 0.35;
        const dg = scene.add.graphics().setDepth(depth - 1);
        const dPts = blobPath(0, 0, 3.5 + Math.random() * 3, 2.5 + Math.random() * 2,
          { sides: 7, jitter: 0.3, seed: i * 17 });
        dg.fillStyle(0xddccaa, 0.70);
        dg.fillPoints(dPts, true);
        dg.x = centerX; dg.y = groundY;
        scene.tweens.add({
          targets: dg, x: centerX + dx, y: groundY + dy,
          alpha: 0, scale: 1.8,
          duration: 340 + Math.random() * 140,
          ease: 'Quad.easeOut', onComplete: () => dg.destroy(),
        });
      }

      // Ground scorch decal (expanding)
      const scorchG = scene.add.graphics().setDepth(groundY - 1);
      const sI = blobPath(0, 0, beamWidth * 0.35, beamWidth * 0.10,
        { sides: 12, jitter: 0.18, seed: 71 });
      scorchG.fillStyle(0xffe8a0, 0.42 * SKILL_FX_TUNE.globalIntensity);
      scorchG.fillPoints(sI, true);
      const sO = blobPath(0, 0, beamWidth * 0.5, beamWidth * 0.15,
        { sides: 14, jitter: 0.22, seed: 72 });
      scorchG.fillStyle(0x665520, 0.32 * SKILL_FX_TUNE.globalIntensity);
      scorchG.fillPoints(sO, true);
      scorchG.x = centerX; scorchG.y = groundY;
      scorchG.setScale(0.4);
      scene.tweens.add({ targets: scorchG, scale: 1.15, duration: 220, ease: 'Back.easeOut' });
      scene.tweens.add({
        targets: scorchG, alpha: 0, delay: 500, duration: 500,
        ease: 'Sine.easeOut', onComplete: () => scorchG.destroy(),
      });

      // ===== PHASE 4: LINGERING ENERGY =====
      // Beam layers fade
      for (const beam of beams) {
        scene.tweens.add({
          targets: beam, alpha: 0,
          duration: LINGER_MS, ease: 'Sine.easeOut',
          onComplete: () => beam.destroy(),
        });
      }
      // Glyph fades
      scene.tweens.add({
        targets: glyphG, alpha: 0, scale: 1.4,
        duration: LINGER_MS, ease: 'Sine.easeOut',
        onComplete: () => glyphG.destroy(),
      });

      // Vertical light residue — soft gradient column (reuses the same
      // CanvasTexture gradient technique as the beam layers, but thinner
      // and at lower alpha so it reads as fading afterglow)
      {
        const resW = Math.ceil(beamWidth * 0.35);
        const resH = Math.ceil(beamH);
        const resKey = `_smite_res_${Date.now()}_${Math.random()}`;
        const resTex = scene.textures.createCanvas(resKey, resW, resH);
        if (resTex) {
          const rCtx = resTex.getContext();
          const rGrad = rCtx.createLinearGradient(0, 0, resW, 0);
          rGrad.addColorStop(0.0, 'rgba(255,244,204,0)');
          rGrad.addColorStop(0.35, 'rgba(255,244,204,0.12)');
          rGrad.addColorStop(0.50, 'rgba(255,255,255,0.18)');
          rGrad.addColorStop(0.65, 'rgba(255,244,204,0.12)');
          rGrad.addColorStop(1.0, 'rgba(255,244,204,0)');
          rCtx.fillStyle = rGrad;
          rCtx.fillRect(0, 0, resW, resH);
          resTex.refresh();
          const resImg = scene.add.image(centerX, skyTopY + beamH / 2, resKey)
            .setDepth(depth - 1).setAlpha(0.7 * SKILL_FX_TUNE.globalIntensity);
          resImg.once('destroy', () => { scene.textures.remove(resKey); });
          scene.tweens.add({
            targets: resImg, alpha: 0,
            duration: LINGER_MS * 0.8, ease: 'Sine.easeOut',
            onComplete: () => resImg.destroy(),
          });
        }
      }

      // Golden particles rising upward — drifting light motes after strike
      spawnLingeringEmbers(scene, centerX, groundY - 10, {
        color: 0xffe8a0, count: 12, spread: beamWidth * 0.35, duration: 600,
      });

      // Soft expanding ground glow ring — a feathered ring that expands
      // outward from the impact point, selling the "holy energy radiating"
      const glowRing = scene.add.graphics().setDepth(depth - 2);
      const grPts = blobPath(0, 0, beamWidth * 0.35, beamWidth * 0.10,
        { sides: 18, jitter: 0.10, seed: 42 });
      glowRing.lineStyle(4, 0xffe8a0, 0.30 * SKILL_FX_TUNE.globalIntensity);
      glowRing.strokePoints(grPts, true, true);
      glowRing.lineStyle(2, 0xffffff, 0.20 * SKILL_FX_TUNE.globalIntensity);
      glowRing.strokePoints(grPts, true, true);
      glowRing.x = centerX; glowRing.y = groundY;
      scene.tweens.add({
        targets: glowRing, scaleX: 2.2, scaleY: 1.5, alpha: 0,
        duration: LINGER_MS, ease: 'Quad.easeOut',
        onComplete: () => glowRing.destroy(),
      });

      // Soft residual ground glow blob (2-layer)
      const resOuter = scene.add.graphics().setDepth(depth - 2);
      const roPts = blobPath(0, 0, beamWidth * 0.4, beamWidth * 0.12,
        { sides: 14, jitter: 0.14, seed: 44 });
      resOuter.fillStyle(0xffe8a0, 0.20);
      resOuter.fillPoints(roPts, true);
      resOuter.x = centerX; resOuter.y = groundY;
      const resInner = scene.add.graphics().setDepth(depth - 1);
      const riPts = blobPath(0, 0, beamWidth * 0.18, beamWidth * 0.06,
        { sides: 10, jitter: 0.16, seed: 45 });
      resInner.fillStyle(0xffffff, 0.28);
      resInner.fillPoints(riPts, true);
      resInner.x = centerX; resInner.y = groundY;
      for (const r of [resOuter, resInner]) {
        scene.tweens.add({
          targets: r, alpha: 0, scale: 1.25,
          duration: LINGER_MS, ease: 'Sine.easeOut',
          onComplete: () => r.destroy(),
        });
      }
    });
  });
}

// =============================================================================
// COMPOSITE SKILL EFFECT — full 4-phase sequence in one call
// =============================================================================
// Combines anticipation → active → impact → after-effect into a single
// sequenced call. Used by the upgraded skill handlers.

export function spawnSkillEffect(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    // Core properties
    color?: number;
    coreColor?: number;

    // Anticipation phase
    anticipation?: boolean;
    anticipationDuration?: number;
    anticipationRadius?: number;

    // Active phase (energy arc / directional)
    arc?: boolean;
    arcWidth?: number;
    arcAngle?: number;
    flipX?: boolean;

    // Impact phase
    impactRadius?: number;
    impactParticles?: number;
    screenFlash?: boolean;
    shake?: boolean;
    shakeIntensity?: number;
    shakeDuration?: number;
    groundDecal?: boolean;

    // After-effect
    embers?: boolean;
    emberCount?: number;

    // Scale everything by skill strength
    intensity?: number;

    depth?: number;
  } = {},
): void {
  const {
    color = 0xffeebb,
    coreColor = 0xffffff,
    anticipation = true,
    anticipationDuration = 180,
    anticipationRadius = 35,
    arc = false,
    arcWidth = 80,
    arcAngle = 0,
    flipX = false,
    impactRadius = 45,
    impactParticles = 10,
    screenFlash = false,
    shake = true,
    shakeIntensity = 0.005,
    shakeDuration = 120,
    groundDecal = false,
    embers = true,
    emberCount = 6,
    intensity = 1.0,
    depth = y + 100,
  } = options;

  const delay = anticipation ? anticipationDuration : 0;

  // Phase 1: ANTICIPATION
  if (anticipation) {
    spawnAnticipation(scene, x, y, {
      color, radius: anticipationRadius * intensity,
      duration: anticipationDuration, depth,
    });
  }

  // Phase 2 + 3: ACTIVE + IMPACT (delayed by anticipation)
  // Uses wall-clock setTimeout to avoid hit-stop timeScale interference.
  window.setTimeout(() => {
    // Active: energy arc if requested
    if (arc) {
      spawnEnergyArc(scene, x, y, {
        color, coreColor,
        width: arcWidth * intensity,
        angle: arcAngle,
        duration: 280, depth, flipX,
      });
    }

    // Impact: radial burst
    spawnRadialBurst(scene, x, y, {
      color, coreColor,
      radius: impactRadius * intensity,
      particleCount: Math.round(impactParticles * intensity),
      duration: 380, depth,
      shake, shakeIntensity, shakeDuration,
    });

    // Screen flash disabled — caused position-dependent rectangle artifact

    // Ground decal
    if (groundDecal) {
      spawnGroundDecal(scene, x, y, { color: 0x1a1a22, radius: impactRadius * 0.6 * intensity });
    }

    // Phase 4: AFTER-EFFECT (slight delay after impact)
    if (embers) {
      window.setTimeout(() => {
        spawnLingeringEmbers(scene, x, y, {
          color, count: Math.round(emberCount * intensity),
          spread: impactRadius * 0.6 * intensity, depth,
        });
      });
    }
  });
}
