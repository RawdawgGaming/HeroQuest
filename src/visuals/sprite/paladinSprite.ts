// =============================================================================
// PALADIN — SPRITE-BASED VISUAL BUILDER
// =============================================================================
// Replaces procedural geometry with layered sprite components loaded from
// PNG assets. Each body part is a separate Image loaded from a texture key,
// assembled onto the same joint containers the animation system expects.
//
// The builder checks whether sprite assets are available for each body part.
// If ALL required sprites are present, it uses pure sprite rendering.
// If ANY are missing, it falls back to the procedural builder entirely
// (no mixed mode — the procedural fallback already generates textures
// for missing keys, so this builder would use those CanvasTextures anyway).
//
// ANIMATION ATLAS SUPPORT:
// For animated body parts (e.g. a helm with visor open/close frames, or a
// cape with multiple drape frames), the builder checks if the texture key
// is a spritesheet. If it is, it creates a Sprite instead of an Image so
// the animation system can play frame sequences on it.
//
// HOW TO ACTIVATE:
// 1. Place PNG files in public/assets/paladin/ (see assets/README.md)
// 2. Uncomment the corresponding lines in ASSET_FILES (textures.ts)
// 3. The dispatch in visuals/index.ts checks for sprite availability
//    and routes to this builder when sprites are present.

import Phaser from 'phaser';
import type { HeroVisualParts } from '../types';
import { TextureKeys } from '../textures';

// Required texture keys — ALL must be present for sprite mode to activate.
const REQUIRED_SPRITE_KEYS = [
  TextureKeys.PALADIN_HELM,
  TextureKeys.PALADIN_TORSO,
  TextureKeys.PALADIN_CAPE,
  TextureKeys.PALADIN_THIGH,
  TextureKeys.PALADIN_SHIN,
  TextureKeys.PALADIN_BOOT,
  TextureKeys.PALADIN_ARM,
  TextureKeys.PALADIN_GAUNTLET,
  TextureKeys.PALADIN_SWORD,
  TextureKeys.PALADIN_SHIELD,
] as const;

/** Returns true if ALL required paladin sprite assets are loaded as real
 *  raster textures (not CanvasTextures from the procedural fallback). */
export function hasPaladinSprites(scene: Phaser.Scene): boolean {
  for (const key of REQUIRED_SPRITE_KEYS) {
    if (!scene.textures.exists(key)) return false;
    // CanvasTextures are procedural fallback — we want real loaded images
    const tex = scene.textures.get(key);
    if (tex instanceof Phaser.Textures.CanvasTexture) return false;
  }
  return true;
}

/** Create a body-part visual — uses Sprite if the key is a spritesheet,
 *  Image otherwise. This is what enables animation atlas support. */
function makePartImage(
  scene: Phaser.Scene,
  x: number, y: number,
  key: string,
): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite {
  const tex = scene.textures.get(key);
  // If the texture has multiple frames (spritesheet), use Sprite for animation
  if (tex && tex.frameTotal > 1) {
    return scene.add.sprite(x, y, key, 0);
  }
  return scene.add.image(x, y, key);
}

/**
 * Sprite-based Paladin visual builder. Uses the exact same joint structure
 * as the procedural builder so the animation state machine works identically.
 *
 * Every body part is a separate Image/Sprite loaded from a PNG texture key.
 * Joint containers (legLeftPivot, shoulderNode, etc.) are the same Phaser
 * Containers that the animation system writes rotation/position to.
 */
export function buildPaladinSprite(
  scene: Phaser.Scene,
  bodyGroup: Phaser.GameObjects.Container,
): HeroVisualParts {

  // ===== CAPE (behind everything) =====
  const cape = makePartImage(scene, 0, -32, TextureKeys.PALADIN_CAPE);
  cape.setOrigin(0.5, 0.12);
  bodyGroup.add(cape);

  // Cape is static — no idle tweens.

  // ===== LEGS =====
  const HIP_Y = -13;
  const THIGH_LEN = 10;
  const SHIN_LEN  = 10;

  const buildJointedLeg = (hipX: number) => {
    const hip = scene.add.container(hipX, HIP_Y);
    bodyGroup.add(hip);
    // Thigh
    const thigh = makePartImage(scene, 0, 0, TextureKeys.PALADIN_THIGH);
    thigh.setOrigin(0.5, 0);
    hip.add(thigh);

    const knee = scene.add.container(0, THIGH_LEN);
    hip.add(knee);
    // Shin
    const shin = makePartImage(scene, 0, 0, TextureKeys.PALADIN_SHIN);
    shin.setOrigin(0.5, 0);
    knee.add(shin);
    // Boot / sabaton
    const boot = makePartImage(scene, 1, SHIN_LEN + 1, TextureKeys.PALADIN_BOOT);
    boot.setOrigin(0.5, 0.35);
    knee.add(boot);
    return { hip, knee };
  };
  const left  = buildJointedLeg(-5);
  const right = buildJointedLeg(5);

  // ===== UPPER BODY PIVOT =====
  const upperBodyPivot = scene.add.container(0, -12);
  bodyGroup.add(upperBodyPivot);
  const upperBody = scene.add.container(0, 12);
  upperBodyPivot.add(upperBody);

  // Torso
  const torso = makePartImage(scene, 0, -22, TextureKeys.PALADIN_TORSO);
  upperBody.add(torso);

  // Tabard (if available — optional overlay)
  if (scene.textures.exists(TextureKeys.PALADIN_TABARD)) {
    const tabard = makePartImage(scene, 0, -14, TextureKeys.PALADIN_TABARD);
    upperBody.add(tabard);
  }

  // Cross emblem (if available)
  if (scene.textures.exists(TextureKeys.PALADIN_CROSS)) {
    const cross = makePartImage(scene, 0, -18, TextureKeys.PALADIN_CROSS);
    upperBody.add(cross);
  }

  // Pauldrons
  if (scene.textures.exists(TextureKeys.PALADIN_PAULDRON_L)) {
    const pauldronL = makePartImage(scene, -15, -29, TextureKeys.PALADIN_PAULDRON_L);
    upperBody.add(pauldronL);
  }
  if (scene.textures.exists(TextureKeys.PALADIN_PAULDRON_R)) {
    const pauldronR = makePartImage(scene, 15, -29, TextureKeys.PALADIN_PAULDRON_R);
    upperBody.add(pauldronR);
  }

  // ===== HEAD PIVOT =====
  const headPivot = scene.add.container(0, -42);
  upperBody.add(headPivot);
  // Halo
  if (scene.textures.exists(TextureKeys.PALADIN_HALO)) {
    const halo = makePartImage(scene, 0, -18, TextureKeys.PALADIN_HALO);
    headPivot.add(halo);
    scene.tweens.add({ targets: halo, alpha: { from: 0.55, to: 0.25 }, duration: 1200, yoyo: true, repeat: -1 });
  }
  // Plume
  if (scene.textures.exists(TextureKeys.PALADIN_PLUME)) {
    const plume = makePartImage(scene, 0, -20, TextureKeys.PALADIN_PLUME);
    headPivot.add(plume);
  }
  // Helm
  const helm = makePartImage(scene, 0, 0, TextureKeys.PALADIN_HELM);
  headPivot.add(helm);

  // ===== SWORD ARM =====
  const shoulderX = 14;
  const shoulderY = -28;
  const shoulderNode = scene.add.container(shoulderX, shoulderY);
  upperBody.add(shoulderNode);

  const HAND_X = 6;
  const HAND_Y = 18;
  // Arm
  const arm = makePartImage(scene, HAND_X / 2, HAND_Y / 2, TextureKeys.PALADIN_ARM);
  arm.setDisplaySize(11, Math.hypot(HAND_X, HAND_Y) + 2);
  arm.setRotation(Math.atan2(HAND_Y, HAND_X) - Math.PI / 2);
  shoulderNode.add(arm);
  // Gauntlet
  const gauntlet = makePartImage(scene, HAND_X, HAND_Y, TextureKeys.PALADIN_GAUNTLET);
  shoulderNode.add(gauntlet);

  // Sword
  const swordNode = scene.add.container(HAND_X, HAND_Y);
  swordNode.setScale(1.5);
  shoulderNode.add(swordNode);
  const defaultSwordSub = scene.add.container(0, 0);
  swordNode.add(defaultSwordSub);
  const sword = makePartImage(scene, 0, 0, TextureKeys.PALADIN_SWORD);
  sword.setOrigin(0.5, 0.85);
  defaultSwordSub.add(sword);

  // ===== BACK ARM — shield =====
  const backArmNode = scene.add.container(-15, -28);
  upperBody.add(backArmNode);
  const shield = makePartImage(scene, 0, 4, TextureKeys.PALADIN_SHIELD);
  shield.setOrigin(0.5, 0.15);
  backArmNode.add(shield);

  // ===== FLASH SPRITE (for state color tints) =====
  // Sprite-based parts use .setTint() instead of .fillColor, but the state
  // machine expects a Rectangle with fillColor. This invisible rect bridges
  // the two APIs. A future refactor could make the state machine tint-aware.
  const flashSprite = scene.add.rectangle(0, -22, 1, 1, 0xb8b8c8);
  flashSprite.setVisible(false);
  upperBody.add(flashSprite);

  return {
    sprite: flashSprite,
    upperBodyPivot,
    upperBodyInner: upperBody,
    headPivot,
    headBaseX: 0,
    headBaseY: -42,
    shoulderNode,
    swordNode,
    backArmNode,
    legLeftPivot: left.hip,
    legLeftKnee: left.knee,
    legRightPivot: right.hip,
    legRightKnee: right.knee,
    defaultSwordVisuals: defaultSwordSub,
    defaultWeaponVisuals: [],
    capeNode: cape,
    shadowColor: 0x1a1008,
    shadowAlpha: 0.50,
  };
}
