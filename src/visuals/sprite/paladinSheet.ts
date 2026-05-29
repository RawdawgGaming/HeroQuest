// =============================================================================
// PALADIN — SPRITESHEET-BASED ANIMATION BUILDER
// =============================================================================
// Uses individual pose sheets (one PNG per animation state).
// Each sheet is sliced into frames by Phaser's spritesheet loader.
//
// Currently active sheets:
//   IDLE: 1536x1024, 6 cols x 4 rows, 256x256 frames, 15 frames used
//
// Future sheets (add as they become available):
//   WALK, ATTACK, CAST, HURT, DEATH, MOUNTED
//
// When a sheet isn't available, the system falls back to the idle pose
// or to procedural rendering if no sheets exist at all.
// =============================================================================

import Phaser from 'phaser';
import type { HeroVisualParts } from '../types';
import { TextureKeys } from '../textures';

// Animation key constants
export const PALADIN_ANIMS = {
  IDLE:    'paladin-idle',
  WALK:    'paladin-walk',
  ATTACK:  'paladin-attack',
  FINISHER: 'paladin-attack-finisher',
  FINAL_SMASH: 'paladin-final-smash',
  CAST:    'paladin-cast',
  HURT:    'paladin-hurt',
  DEATH:   'paladin-death',
  MOUNTED: 'paladin-mounted',
} as const;

/** Frame index in paladin-attack-finisher where the hammer makes ground contact.
 *  Gameplay logic should trigger splash damage, camera shake, and VFX on this frame. */
export const FINISHER_IMPACT_FRAME = 95;

/** Returns true if at least the idle pose sheet is loaded. */
export function hasPaladinSheet(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(TextureKeys.PALADIN_IDLE_SHEET)) return false;
  const tex = scene.textures.get(TextureKeys.PALADIN_IDLE_SHEET);
  if (tex instanceof Phaser.Textures.CanvasTexture) return false;
  const src = tex.source[0];
  if (!src || src.width === 0) return false;
  return true;
}

/** Register all available paladin animations. Call once after preload. */
export function createPaladinAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists(PALADIN_ANIMS.IDLE)) return;

  // IDLE — 50 frames (672x448), sequential 0→49 at 10fps, looping
  if (scene.textures.exists(TextureKeys.PALADIN_IDLE_SHEET)) {
    const seq = [];
    for (let i = 0; i < 50; i++) seq.push(i);
    scene.anims.create({
      key: PALADIN_ANIMS.IDLE,
      frames: seq.map(f => ({ key: TextureKeys.PALADIN_IDLE_SHEET, frame: f })),
      frameRate: 30,
      repeat: -1,
    });
    const idleTex = scene.textures.get(TextureKeys.PALADIN_IDLE_SHEET);
    if (idleTex) idleTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // RUN — 22 frames (288x192), frames 0→21 at 30fps, looping
  if (scene.textures.exists(TextureKeys.PALADIN_RUN_SHEET)) {
    const seq = [];
    for (let i = 0; i < 22; i++) seq.push(i);
    scene.anims.create({
      key: PALADIN_ANIMS.WALK,
      frames: seq.map(f => ({ key: TextureKeys.PALADIN_RUN_SHEET, frame: f })),
      frameRate: 30,
      repeat: -1,
    });
    const runTex = scene.textures.get(TextureKeys.PALADIN_RUN_SHEET);
    if (runTex) runTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // ATTACK — split into phased sub-animations for variable-speed playback:
  //   windup (F0-20):    fast — quick raise
  //   strike (F20-35):   powerful — deliberate downswing
  //   impact (F35-45):   fast — decisive hit moment
  //   follow (F45-62):   fast — quick follow-through
  //   reverse (F62-0):   fast — quick return/reset
  if (scene.textures.exists(TextureKeys.PALADIN_ATTACK_SHEET)) {
    const k = TextureKeys.PALADIN_ATTACK_SHEET;
    const mkFrames = (start: number, end: number) => {
      const frames = [];
      if (start <= end) { for (let i = start; i <= end; i++) frames.push(i); }
      else { for (let i = start; i >= end; i--) frames.push(i); }
      return frames.map(f => ({ key: k, frame: f }));
    };
    // Combo stage 1 & 2: same swing animation from the base attack sheet (65 frames)
    scene.anims.create({ key: 'paladin-attack-1', frames: mkFrames(0, 64), frameRate: 75, repeat: 0 });
    scene.anims.create({ key: 'paladin-attack-2', frames: mkFrames(0, 64), frameRate: 75, repeat: 0 });
    // Keep legacy keys for compatibility
    scene.anims.create({ key: 'paladin-atk-forward', frames: mkFrames(0, 64), frameRate: 75, repeat: 0 });
    const fwd = []; for (let i = 0; i < 65; i++) fwd.push(i);
    scene.anims.create({ key: PALADIN_ANIMS.ATTACK, frames: fwd.map(f => ({ key: k, frame: f })), frameRate: 30, repeat: 0 });

    const atkTex = scene.textures.get(k);
    if (atkTex) atkTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // FINISHER (overhead swing) — ends at impact frame (F93), non-looping
  if (scene.textures.exists(TextureKeys.PALADIN_FINISHER_SHEET)) {
    const fk = TextureKeys.PALADIN_FINISHER_SHEET;
    const finFrames = [];
    for (let i = 0; i <= FINISHER_IMPACT_FRAME; i++) finFrames.push({ key: fk, frame: i });
    scene.anims.create({
      key: PALADIN_ANIMS.FINISHER,
      frames: finFrames,
      frameRate: 30,
      repeat: 0,
    });
    const finTex = scene.textures.get(fk);
    if (finTex) finTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // FINAL SMASH — 121 frames (1056x576), non-looping
  if (scene.textures.exists(TextureKeys.PALADIN_FINAL_SMASH_SHEET)) {
    const smk = TextureKeys.PALADIN_FINAL_SMASH_SHEET;
    const smFrames = [];
    for (let i = 0; i < 121; i++) smFrames.push({ key: smk, frame: i });
    scene.anims.create({
      key: PALADIN_ANIMS.FINAL_SMASH,
      frames: smFrames,
      frameRate: 30,
      repeat: 0,
    });
    const smTex = scene.textures.get(smk);
    if (smTex) smTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // Future pose sheets: CAST, HURT, DEATH, MOUNTED
}

/**
 * Build the paladin using spritesheet animation.
 * The sprite is placed inside bodyGroup, anchored at bottom-center.
 *
 * All joint references are null — Hero state machine drives animations
 * via playSheetAnim() instead of rotating joints.
 */
export function buildPaladinSheet(
  scene: Phaser.Scene,
  bodyGroup: Phaser.GameObjects.Container,
): HeroVisualParts {
  createPaladinAnimations(scene);

  // Disable texture filtering — use nearest-neighbor scaling for crisp pixel art
  const tex = scene.textures.get(TextureKeys.PALADIN_IDLE_SHEET);
  if (tex) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

  // Create the animated sprite — 672x448 frames, bottom-center pivot
  // All sheets are normalized: character feet at frame bottom (y=447).
  // Origin (0.5, 1.0) anchors at bottom-center = character feet.
  const sprite = scene.add.sprite(0, 0, TextureKeys.PALADIN_IDLE_SHEET, 0);
  sprite.setOrigin(0.5, 1.0);
  // Scale large frames to gameplay size (86px target)
  sprite.setScale(86 / 448);
  // Explicit nearest-neighbor on the sprite itself
  (sprite as any).texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  // Re-apply nearest-neighbor whenever the animation (and thus texture) changes
  sprite.on('animationstart', () => {
    (sprite as any).texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
  });

  bodyGroup.add(sprite);

  // Weapon overlay — anchor-aligned per-frame by Hero.ts
  const weaponOverlay = scene.add.image(0, 0, '__DEFAULT');
  weaponOverlay.setOrigin(0.5, 0.8); // will be overridden per-weapon by gripAnchor
  weaponOverlay.setVisible(false);
  weaponOverlay.setScale(0.55);
  (weaponOverlay as any).texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
  bodyGroup.add(weaponOverlay);

  // Debug graphics for anchor visualization (hidden by default)
  const weaponDebug = scene.add.graphics();
  weaponDebug.setVisible(false);
  bodyGroup.add(weaponDebug);

  // Start with idle animation
  if (scene.anims.exists(PALADIN_ANIMS.IDLE)) {
    sprite.play(PALADIN_ANIMS.IDLE);
  }

  // Store references for external access by Hero.ts
  (bodyGroup as any).__paladinSprite = sprite;
  (bodyGroup as any).__paladinAnims = PALADIN_ANIMS;
  (bodyGroup as any).__weaponOverlay = weaponOverlay;
  (bodyGroup as any).__weaponDebug = weaponDebug;

  return {
    sprite: sprite as any,
    // All joints null — spritesheet replaces joint-based animation
    upperBodyPivot: undefined,
    upperBodyInner: undefined,
    headPivot: undefined,
    shoulderNode: undefined,
    swordNode: undefined,
    backArmNode: undefined,
    legLeftPivot: undefined,
    legLeftKnee: undefined,
    legRightPivot: undefined,
    legRightKnee: undefined,
    defaultSwordVisuals: undefined,
    defaultWeaponVisuals: undefined,
    capeNode: undefined,
  };
}
