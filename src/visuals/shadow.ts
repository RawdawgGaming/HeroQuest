// =============================================================================
// SOFT DROP SHADOW
// =============================================================================
// Replaces the flat single-ellipse shadow with a stack of nested ellipses at
// decreasing alpha so it reads as a soft drop shadow without alpha textures.
//
// The returned object is a Phaser.GameObjects.Container holding all 3 layers
// so callers can add it to their hero/enemy in one line, and the existing
// jumpZ scaling code that targets the shadow can simply scale this container.

import Phaser from 'phaser';

export interface SoftShadow {
  /** The container holding all shadow layers — add this to your entity. */
  root: Phaser.GameObjects.Container;
  /** Inner solid layer — used for color flashes if needed (e.g., aura tint). */
  core: Phaser.GameObjects.Ellipse;
}

/**
 * Build a soft 3-layer drop shadow under a character. The widest layer is at
 * the lowest alpha so the edge fades into the ground; the inner layer is the
 * darkest core under the feet.
 *
 * @param scene  scene to add into
 * @param baseW  width of the inner shadow core (px)
 * @param baseH  height of the inner shadow core (px)
 * @param tint   tint of the shadow (0x000000 default; class shadows can override)
 */
export function createSoftShadow(
  scene: Phaser.Scene,
  baseW: number = 28,
  baseH: number = 8,
  tint: number = 0x000000,
): SoftShadow {
  const root = scene.add.container(0, 0);
  // Outer halo — widest, lowest alpha
  const outer = scene.add.ellipse(0, 0, baseW * 1.7, baseH * 1.6, tint, 0.10);
  // Mid layer
  const mid   = scene.add.ellipse(0, 0, baseW * 1.25, baseH * 1.2, tint, 0.18);
  // Core — darkest, narrowest
  const core  = scene.add.ellipse(0, 0, baseW, baseH, tint, 0.32);
  root.add([outer, mid, core]);
  return { root, core };
}
