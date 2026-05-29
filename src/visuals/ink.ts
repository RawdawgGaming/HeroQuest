// =============================================================================
// INK / CEL-SHADE HELPERS
// =============================================================================
// Tools for giving procedural shapes a unified hand-drawn cartoon feel:
//   - ink()        : thick consistent outline on any shape
//   - shade()      : create a darker rim shape (placed behind a primary shape)
//   - hilite()     : create a small bright highlight rect (placed on top)
//   - darker() / lighter() : color math
//
// Usage pattern:
//   const torso = ink(scene.add.rectangle(0, -22, 32, 24, 0xccccdd));
//   parent.add(shade(scene, 0, -22, 32, 24, 0xccccdd));   // rim BEHIND
//   parent.add(torso);                                    // base
//   parent.add(hilite(scene, 0, -32, 24, 3));             // highlight ON TOP

import Phaser from 'phaser';

/** Standard ink color used for all outlines — near-black with a slight purple
 *  tint so it reads as "ink" rather than pure black. */
export const INK_COLOR = 0x1a1a22;

/** Standard ink line weight — thicker than the previous 0.4–0.8 strokes so
 *  silhouettes read at gameplay distance. */
export const INK_WEIGHT = 1.6;
export const INK_WEIGHT_HEAVY = 2.2;
export const INK_WEIGHT_LIGHT = 1.0;

type Strokeable =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Ellipse
  | Phaser.GameObjects.Arc
  | Phaser.GameObjects.Triangle
  | Phaser.GameObjects.Polygon;

/** Apply a thick consistent ink outline to a shape and return it for chaining. */
export function ink<T extends Strokeable>(
  shape: T,
  weight: number = INK_WEIGHT,
  color: number = INK_COLOR,
): T {
  shape.setStrokeStyle(weight, color, 1);
  return shape;
}

/** Darken a hex color by a fraction (0..1). 0.3 = 30% darker. */
export function darker(color: number, amount: number = 0.35): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const k = 1 - amount;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
}

/** Lighten a hex color toward white by a fraction (0..1). */
export function lighter(color: number, amount: number = 0.35): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (
    (Math.min(255, Math.round(r + (255 - r) * amount)) << 16) |
    (Math.min(255, Math.round(g + (255 - g) * amount)) << 8) |
     Math.min(255, Math.round(b + (255 - b) * amount))
  );
}

/** Create a small bright highlight strip — used to imply a top-light cel
 *  shading band on torsos, helms, pauldrons, etc. */
export function hilite(
  scene: Phaser.Scene,
  x: number, y: number,
  w: number, h: number,
  color: number = 0xffffff,
  alpha: number = 0.32,
): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(x, y, w, h, color, alpha);
}

/** Create a darker shadow-half rectangle that should be added BEHIND the
 *  primary shape so it pokes out as a darker rim. Slightly larger than the
 *  base shape — that's what creates the chunky cartoon "double-line" look. */
export function shadowRim(
  scene: Phaser.Scene,
  x: number, y: number,
  w: number, h: number,
  color: number,
  inset: number = 1.4,
): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(x, y + inset, w + inset * 2, h + inset, darker(color, 0.5));
  r.setStrokeStyle(0, 0, 0);
  return r;
}

/** Cel shade overlay — a darker rectangle placed over the LOWER half of a
 *  primary shape at low alpha. Adds a 2-tone shaded appearance without
 *  needing real lighting. */
export function celShadeBottom(
  scene: Phaser.Scene,
  x: number, y: number,
  w: number, h: number,
  color: number,
  alpha: number = 0.28,
): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(x, y + h * 0.25, w, h * 0.5, darker(color, 0.5), alpha);
}

/** Cel-shade overlay for circles — a darker arc on the lower-right of a
 *  circle, drawn via Graphics. */
export function celShadeCircleArc(
  scene: Phaser.Scene,
  x: number, y: number,
  radius: number,
  color: number,
  alpha: number = 0.32,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(darker(color, 0.5), alpha);
  g.beginPath();
  g.arc(x, y, radius, -Math.PI * 0.15, Math.PI * 0.85, false);
  g.fillPath();
  g.closePath();
  return g;
}
