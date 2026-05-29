// =============================================================================
// COMBAT FX MODULE
// =============================================================================
// Reusable cartoon-action combat feedback. Every helper here:
//   - takes a scene + position
//   - creates Phaser primitives that animate via tweens
//   - destroys itself when done — no caller cleanup
//
// These are meant to be called from gameplay code at the moment of impact.
// Examples:
//   spawnHitSparks(scene, x, y);
//   spawnImpactFlash(scene);
//   spawnSlashTrail(scene, x, y, angle);
//   spawnDustPuff(scene, x, y);

import Phaser from 'phaser';

// =============================================================================
// HIT SPARKS — organic burst with cartoon "splat" shape
// =============================================================================
// Replaces "fading circle of rectangles" with:
//  - a central organic ink-blob impact shape (drawn via Graphics polygon)
//  - 6-10 angular spike triangles shooting outward
//  - 3-4 small comet trails for energy
// Reads as a hand-drawn brawler hit, not a vector starburst.

import { blobPath } from './paint';

export function spawnHitSparks(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    count?: number;
    color?: number;
    accentColor?: number;
    radius?: number;
    duration?: number;
  } = {},
): void {
  const {
    count = 8,
    color = 0xffeebb,
    accentColor = 0xffffff,
    radius = 32,
    duration = 240,
  } = options;

  // ----- Organic impact splat (not a circle) -----
  const splatG = scene.add.graphics().setDepth(y + 200);
  const splatPts = blobPath(0, 0, 11, 9, { sides: 9, jitter: 0.45, seed: Phaser.Math.Between(1, 9999) });
  splatG.fillStyle(accentColor, 0.92);
  splatG.fillPoints(splatPts, true);
  splatG.lineStyle(2.0, 0xffeeaa, 0.9);
  splatG.strokePoints(splatPts, true, true);
  splatG.x = x;
  splatG.y = y;
  scene.tweens.add({
    targets: splatG,
    scale: 1.8,
    alpha: 0,
    duration: duration * 0.7,
    ease: 'Quad.easeOut',
    onComplete: () => splatG.destroy(),
  });

  // ----- Angular spike shards (triangle Graphics polygons) -----
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.25, 0.25);
    const dist = radius * Phaser.Math.FloatBetween(0.7, 1.15);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const len = Phaser.Math.Between(6, 12);

    const shardG = scene.add.graphics().setDepth(y + 201);
    // Tapered shard polygon — point along +X, base at origin
    const pts = [
      { x: 0,        y: -1.6 },
      { x: 0,        y:  1.6 },
      { x: len * 0.5, y: 0.8 },
      { x: len,      y: 0 },
      { x: len * 0.5, y: -0.8 },
    ];
    shardG.fillStyle(color, 1);
    shardG.fillPoints(pts, true);
    shardG.lineStyle(0.9, 0x8a5a1c, 0.8);
    shardG.strokePoints(pts, true, true);
    shardG.x = x;
    shardG.y = y;
    shardG.rotation = angle;

    scene.tweens.add({
      targets: shardG,
      x: x + dx,
      y: y + dy,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.4,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => shardG.destroy(),
    });
  }

  // ----- Comet trails — small organic blobs that streak outward -----
  for (let i = 0; i < 3; i++) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = radius * 0.7;
    const trailG = scene.add.graphics().setDepth(y + 199);
    const pts = blobPath(0, 0, 3, 1.4, { sides: 7, jitter: 0.3, seed: i * 17 + 3 });
    trailG.fillStyle(color, 0.85);
    trailG.fillPoints(pts, true);
    trailG.x = x;
    trailG.y = y;
    trailG.rotation = angle;
    scene.tweens.add({
      targets: trailG,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scaleX: 2.4,
      scaleY: 0.3,
      duration: duration * 1.1,
      ease: 'Quad.easeOut',
      onComplete: () => trailG.destroy(),
    });
  }
}

// =============================================================================
// IMPACT FLASH (full-screen)
// =============================================================================
// A fast white quad that fills the screen for one frame and fades out.
// Use sparingly — only on heavy hits / finisher impacts.

export function spawnImpactFlash(
  scene: Phaser.Scene,
  options: { color?: number; alpha?: number; duration?: number } = {},
): void {
  const { color = 0xffffff, alpha = 0.45, duration = 110 } = options;
  const cam = scene.cameras.main;
  // Use viewport center (screen coords) since scrollFactor is 0.
  // cam.midPoint is world coords which drifts as the camera scrolls.
  const cx = cam.width / 2;
  const cy = cam.height / 2;
  const flash = scene.add
    .rectangle(cx, cy, cam.width + 200, cam.height + 200, color, alpha)
    .setScrollFactor(0)
    .setDepth(99999);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => flash.destroy(),
  });
}

// =============================================================================
// HIT-STOP
// =============================================================================
// A brief pause where time slows or freezes — adds weight to heavy hits.
// Implementation: temporarily reduce scene.time.timeScale, then restore.

export function spawnHitStop(
  scene: Phaser.Scene,
  duration: number = 70,
  scale: number = 0.05,
): void {
  const prev = scene.time.timeScale;
  scene.time.timeScale = scale;
  // MUST use real wall-clock setTimeout, NOT scene.time.delayedCall.
  // delayedCall is affected by timeScale — which we just set to near-zero —
  // so it would delay ALL other queued scene timers by 20-30× their intended
  // duration, causing skills and VFX to fire seconds late.
  window.setTimeout(() => {
    scene.time.timeScale = prev;
  }, duration);
}

// =============================================================================
// SLASH TRAIL
// =============================================================================
// A fast-fading arc behind a swung weapon. Pass the (x, y) world position of
// the blade tip and an angle in radians. Multiple calls per frame stack into
// a smear effect.

export function spawnSlashTrail(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    color?: number;
    length?: number;
    width?: number;
    angle?: number;
    duration?: number;
    alpha?: number;
  } = {},
): void {
  const {
    color = 0xffffff,
    length = 36,
    width = 6,
    angle = 0,
    duration = 140,
    alpha = 0.85,
  } = options;
  const trail = scene.add.rectangle(x, y, length, width, color, alpha)
    .setRotation(angle)
    .setDepth(y + 199);
  scene.tweens.add({
    targets: trail,
    alpha: 0,
    scaleX: 1.4,
    scaleY: 0.3,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => trail.destroy(),
  });
}

// =============================================================================
// DUST PUFF — irregular cartoon dust clouds
// =============================================================================
// Replaces "circles fading out" with organic blob clouds drawn via Graphics
// polygon paths. Each puff has its own jitter seed so the cloud reads as
// hand-drawn. Used for landings, dashes, finisher slams.

export function spawnDustPuff(
  scene: Phaser.Scene,
  x: number, y: number,
  options: { count?: number; color?: number; spread?: number; duration?: number } = {},
): void {
  const {
    count = 6,
    color = 0xddccaa,
    spread = 28,
    duration = 360,
  } = options;
  for (let i = 0; i < count; i++) {
    const dx = Phaser.Math.FloatBetween(-spread, spread);
    const targetY = y - Phaser.Math.FloatBetween(4, 14);
    const rx = Phaser.Math.FloatBetween(4, 7);
    const ry = rx * Phaser.Math.FloatBetween(0.7, 1.0);
    const seed = Phaser.Math.Between(1, 9999);
    const puffG = scene.add.graphics().setDepth(y + 5);
    const pts = blobPath(0, 0, rx, ry, { sides: 9, jitter: 0.35, seed });
    puffG.fillStyle(color, 0.78);
    puffG.fillPoints(pts, true);
    // Soft inner highlight
    const innerPts = blobPath(0, -ry * 0.3, rx * 0.55, ry * 0.45, { sides: 8, jitter: 0.3, seed: seed + 5 });
    puffG.fillStyle(0xffffff, 0.32);
    puffG.fillPoints(innerPts, true);
    puffG.x = x;
    puffG.y = y;
    scene.tweens.add({
      targets: puffG,
      x: x + dx,
      y: targetY,
      scale: Phaser.Math.FloatBetween(1.4, 2.1),
      alpha: 0,
      duration: duration + Phaser.Math.Between(-60, 60),
      ease: 'Quad.easeOut',
      onComplete: () => puffG.destroy(),
    });
  }
}

// =============================================================================
// SHOCKWAVE — irregular ring expanding from an impact
// =============================================================================
// Drawn as an organic Graphics polygon (NOT a circle) so the ring has
// asymmetry like a hand-drawn shock decal.

export function spawnShockwave(
  scene: Phaser.Scene,
  x: number, y: number,
  options: { color?: number; maxRadius?: number; duration?: number } = {},
): void {
  const { color = 0xffeebb, maxRadius = 90, duration = 360 } = options;
  const ringG = scene.add.graphics().setDepth(y + 198);
  const ringPts = blobPath(0, 0, 10, 5, { sides: 16, jitter: 0.18, seed: Phaser.Math.Between(1, 9999) });
  ringG.lineStyle(4.5, color, 0.95);
  ringG.strokePoints(ringPts, true, true);
  // Inner softer ring (gives a 2-pass ink line look)
  ringG.lineStyle(2.2, 0xffffff, 0.7);
  ringG.strokePoints(ringPts, true, true);
  ringG.x = x;
  ringG.y = y;
  scene.tweens.add({
    targets: ringG,
    scaleX: maxRadius / 10,
    scaleY: maxRadius / 10,
    alpha: 0,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => ringG.destroy(),
  });

  // Ground crack streaks — 4 short jagged lines radiating outward
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
    const len = maxRadius * 0.55;
    const crackG = scene.add.graphics().setDepth(y + 197);
    crackG.lineStyle(2.0, 0x2a1a08, 0.7);
    crackG.beginPath();
    crackG.moveTo(0, 0);
    // Jagged line via 3 segments
    const seg = len / 3;
    crackG.lineTo(seg + Phaser.Math.FloatBetween(-2, 2), Phaser.Math.FloatBetween(-2, 2));
    crackG.lineTo(seg * 2 + Phaser.Math.FloatBetween(-2, 2), Phaser.Math.FloatBetween(-2, 2));
    crackG.lineTo(len, 0);
    crackG.strokePath();
    crackG.x = x;
    crackG.y = y;
    crackG.rotation = angle;
    crackG.setScale(0.1);
    scene.tweens.add({
      targets: crackG,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 0,
      duration: duration * 1.1,
      ease: 'Quad.easeOut',
      onComplete: () => crackG.destroy(),
    });
  }
}

// =============================================================================
// HOLY SMASH BURST — golden light explosion with radial rays and rising particles
// =============================================================================
export function spawnHolyBurst(
  scene: Phaser.Scene,
  x: number, y: number,
  options: {
    radius?: number;
    rayCount?: number;
    particleCount?: number;
    duration?: number;
  } = {},
): void {
  const {
    radius = 180,
    rayCount = 12,
    particleCount = 20,
    duration = 600,
  } = options;

  // ---- Central flash ----
  const flash = scene.add.circle(x, y, 20, 0xfff8cc, 0.9).setDepth(y + 200);
  scene.tweens.add({
    targets: flash,
    scaleX: radius / 20,
    scaleY: radius / 20 * 0.4,
    alpha: 0,
    duration: duration * 0.7,
    ease: 'Quad.easeOut',
    onComplete: () => flash.destroy(),
  });

  // ---- Golden light rays radiating outward ----
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
    const rayLen = radius * Phaser.Math.FloatBetween(0.6, 1.0);
    const rayWidth = Phaser.Math.FloatBetween(2, 5);
    const ray = scene.add.graphics().setDepth(y + 199);
    const rayColor = Phaser.Math.RND.pick([0xffdd44, 0xffeebb, 0xfff8cc, 0xffcc22]);
    ray.lineStyle(rayWidth, rayColor, 0.8);
    ray.beginPath();
    ray.moveTo(0, 0);
    ray.lineTo(rayLen, 0);
    ray.strokePath();
    ray.x = x;
    ray.y = y;
    ray.rotation = angle;
    ray.setScale(0.1);
    scene.tweens.add({
      targets: ray,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 0,
      duration: duration * Phaser.Math.FloatBetween(0.7, 1.0),
      ease: 'Quad.easeOut',
      onComplete: () => ray.destroy(),
    });
  }

  // ---- Expanding golden ring ----
  const ring = scene.add.graphics().setDepth(y + 201);
  ring.lineStyle(3, 0xffdd44, 0.9);
  ring.strokeCircle(0, 0, 10);
  ring.lineStyle(1.5, 0xffffff, 0.6);
  ring.strokeCircle(0, 0, 10);
  ring.x = x;
  ring.y = y;
  scene.tweens.add({
    targets: ring,
    scaleX: radius / 10,
    scaleY: radius / 10 * 0.35,
    alpha: 0,
    duration: duration * 0.8,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  });

  // ---- Rising holy particles ----
  for (let i = 0; i < particleCount; i++) {
    const px = x + Phaser.Math.FloatBetween(-radius * 0.6, radius * 0.6);
    const py = y + Phaser.Math.FloatBetween(-10, 10);
    const size = Phaser.Math.FloatBetween(2, 5);
    const color = Phaser.Math.RND.pick([0xffdd44, 0xffeebb, 0xffffff, 0xfff8cc]);
    const particle = scene.add.circle(px, py, size, color, 0.8).setDepth(y + 202);
    scene.tweens.add({
      targets: particle,
      y: py - Phaser.Math.FloatBetween(40, 100),
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: duration * Phaser.Math.FloatBetween(0.8, 1.3),
      delay: Phaser.Math.FloatBetween(0, 150),
      ease: 'Quad.easeOut',
      onComplete: () => particle.destroy(),
    });
  }

  // ---- Horizontal ground shockwave ----
  const wave = scene.add.graphics().setDepth(y + 198);
  wave.lineStyle(3, 0xffcc22, 0.7);
  wave.beginPath();
  wave.moveTo(-10, 0);
  wave.lineTo(10, 0);
  wave.strokePath();
  wave.x = x;
  wave.y = y;
  scene.tweens.add({
    targets: wave,
    scaleX: radius / 10,
    alpha: 0,
    duration: duration * 0.6,
    ease: 'Quad.easeOut',
    onComplete: () => wave.destroy(),
  });
}
