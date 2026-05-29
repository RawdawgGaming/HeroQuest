// =============================================================================
// VISUALS — public API
// =============================================================================
// Single import surface for the visual layer. Gameplay code does not need to
// know whether a class is rendered procedurally or via sprites — it asks the
// dispatcher for a builder by classId and gets back parts to attach.
//
// To swap a class to sprite art later, write a builder that returns the same
// HeroVisualParts shape, then change the line in HERO_BUILDERS for that class.

import Phaser from 'phaser';
import type { HeroVisualParts } from './types';
import { buildPaladinProcedural } from './procedural/paladin';
import { buildPaladinSheet, hasPaladinSheet } from './sprite/paladinSheet';
// Sprite-based renderers kept for future re-activation:
// import { buildPaladinSprite, hasPaladinSprites } from './sprite/paladinSprite';
// import { buildPaladinFullSprite, hasPaladinFullSprite } from './sprite/paladinFull';

export type { HeroVisualParts } from './types';

/**
 * Builder signature: takes a scene and the entity's bodyGroup container,
 * populates it with visual primitives or sprites, and returns a
 * HeroVisualParts bundle. The animation system doesn't know or care
 * which renderer produced the parts.
 */
export type HeroVisualBuilder = (
  scene: Phaser.Scene,
  bodyGroup: Phaser.GameObjects.Container,
) => HeroVisualParts;

/**
 * Per-class dispatch table. The paladin checks for sprite availability
 * at runtime and uses the sprite builder when all required PNGs are
 * loaded, falling back to procedural otherwise.
 *
 * To add sprite support for another class:
 * 1. Create src/visuals/sprite/<class>Sprite.ts with has<Class>Sprites + build<Class>Sprite
 * 2. Add the conditional dispatch below
 */
export const HERO_BUILDERS: Record<string, HeroVisualBuilder | undefined> = {
  paladin: (scene, bodyGroup) => {
    // Spritesheet takes priority when the PNG is loaded
    if (hasPaladinSheet(scene)) {
      return buildPaladinSheet(scene, bodyGroup);
    }
    // Fall back to procedural rendering
    return buildPaladinProcedural(scene, bodyGroup);
  },
};

/**
 * Look up the visual builder for a hero class. Returns undefined for classes
 * that haven't been migrated yet — caller (Hero.ts) should fall back to its
 * inline builder in that case.
 */
export function getHeroVisualBuilder(classId: string): HeroVisualBuilder | undefined {
  return HERO_BUILDERS[classId];
}

// Re-export the FX modules for direct import by gameplay code
export * from './combatFx';
export * from './skillFx';
export { createSoftShadow } from './shadow';
export type { SoftShadow } from './shadow';
