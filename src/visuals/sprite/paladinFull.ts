// =============================================================================
// PALADIN — SINGLE FULL-BODY SPRITE BUILDER
// =============================================================================
// Renders the paladin as a single Image loaded from paladin.png instead of
// assembling from geometry or layered parts. The sprite is anchored so the
// feet sit at the hero's ground position and the body is centered on hero.x.
//
// Joint references (shoulderNode, swordNode, legPivots, etc.) are returned
// as null — the animation state machine checks for null before writing to
// them, so it degrades gracefully. The sprite simply doesn't have separate
// body-part rotation. This is intentional: a single sprite is a static pose
// that will later be replaced by a spritesheet with animation frames.
//
// HOW TO ACTIVATE:
// 1. Place paladin.png in public/assets/paladin/
// 2. It's already registered in ASSET_FILES — just reload.
// 3. The dispatch in visuals/index.ts checks hasPaladinFullSprite first.

import Phaser from 'phaser';
import type { HeroVisualParts } from '../types';
import { TextureKeys } from '../textures';

/** Returns true if the single full-body paladin sprite is loaded. */
export function hasPaladinFullSprite(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(TextureKeys.PALADIN_FULL)) return false;
  // Make sure it's a real loaded texture, not a procedural fallback
  const tex = scene.textures.get(TextureKeys.PALADIN_FULL);
  if (tex instanceof Phaser.Textures.CanvasTexture) return false;
  // Check the texture actually has pixel data (file was found and loaded)
  const src = tex.source[0];
  if (!src || src.width === 0) return false;
  return true;
}

/**
 * Build the paladin as a single full-body sprite. The image is placed inside
 * bodyGroup, anchored at bottom-center so the feet rest on the ground plane.
 *
 * Since there are no separate body parts, all joint references are null.
 * The animation state machine handles null joints by skipping writes to them,
 * so the paladin renders as a static sprite. A future spritesheet with
 * animation frames can replace this by using scene.add.sprite + anims.
 */
export function buildPaladinFullSprite(
  scene: Phaser.Scene,
  bodyGroup: Phaser.GameObjects.Container,
): HeroVisualParts {

  // Create the sprite — origin at bottom-center so feet touch ground (y=0 in bodyGroup)
  const img = scene.add.image(0, 0, TextureKeys.PALADIN_FULL);
  img.setOrigin(0.5, 1.0); // bottom-center anchor

  // Scale the sprite to match the procedural paladin's height (~70px from
  // boot soles to helmet crest). The native image is 52×49; we preserve
  // aspect ratio while targeting ~70px tall so the character feels the same
  // size on screen.
  const nativeW = img.width;
  const nativeH = img.height;
  const targetH = 70;
  const scale = targetH / nativeH;
  img.setDisplaySize(Math.round(nativeW * scale), targetH);

  bodyGroup.add(img);

  // Invisible flash sprite for the state machine's color tint system
  const flashSprite = scene.add.rectangle(0, -22, 1, 1, 0xb8b8c8);
  flashSprite.setVisible(false);
  bodyGroup.add(flashSprite);

  return {
    sprite: flashSprite,

    // No separate joints — the whole character is one image.
    // The animation system checks each joint for null before writing,
    // so these are safe to leave undefined.
    upperBodyPivot: undefined,
    upperBodyInner: undefined,
    headPivot: undefined,
    headBaseX: 0,
    headBaseY: 0,
    shoulderNode: undefined,
    swordNode: undefined,
    backArmNode: undefined,
    legLeftPivot: undefined,
    legLeftKnee: undefined,
    legRightPivot: undefined,
    legRightKnee: undefined,
    defaultSwordVisuals: undefined,
    defaultWeaponVisuals: [],

    shadowColor: 0x1a1008,
    shadowAlpha: 0.50,
  };
}
