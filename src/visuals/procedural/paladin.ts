// =============================================================================
// PALADIN — MEDIEVAL KNIGHT VISUAL BUILDER
// =============================================================================
// Silhouette reference: realistic medieval great-helm knight.
//   - Tapered great-helm (wider crown, narrower jaw, vertical visor slit)
//   - Cloth tabard over plate armor, belted at the waist
//   - Segmented shoulder plates (steel, not gold orbs)
//   - Forearm plates thicker than upper arm
//   - Pointed knight greaves (wide knee → narrow ankle, center ridge)
//   - Deep red cape anchored at shoulders, trailing to the ground
//   - Steel/silver armor with dark edge shading, off-white tabard

import Phaser from 'phaser';
import type { HeroVisualParts } from '../types';
import { TextureKeys } from '../textures';
import { paintBodyPart, paintBlobPart } from '../canvasParts';
// kiteShieldPath no longer used — tower shield uses inline rectangle points
import { darker, lighter } from '../ink';

// =============================================================================
// PALETTE — steel armor, off-white cloth, deep red cape
// =============================================================================
const STEEL      = 0xb8b8c8;
const STEEL_SH   = darker(STEEL, 0.45);
const STEEL_HI   = lighter(STEEL, 0.32);
const STEEL_EDGE  = darker(STEEL, 0.60); // dark edge shading for contrast
const CLOTH      = 0xf0ece0;             // off-white tabard
const CLOTH_SH   = darker(CLOTH, 0.22);
const CLOTH_HI   = lighter(CLOTH, 0.18);
const CAPE_RED   = 0x8c2020;             // deep red cape
const CAPE_SH    = darker(CAPE_RED, 0.45);
const CAPE_HI    = lighter(CAPE_RED, 0.28);
const CROSS_RED  = 0xb83028;
const CROSS_SH   = darker(CROSS_RED, 0.42);
const CROSS_HI   = lighter(CROSS_RED, 0.28);
const GOLD       = 0xd8b838;
const GOLD_SH    = darker(GOLD, 0.42);
const GOLD_HI    = lighter(GOLD, 0.28);
const LEATHER    = 0x4a2e1a;
const SHIELD_COL = 0xd4bc38;
const SHIELD_SH  = darker(SHIELD_COL, 0.45);
const SHIELD_HI  = lighter(SHIELD_COL, 0.28);

// =============================================================================
// TEXTURE GENERATION
// =============================================================================

function ensurePaladinTextures(scene: Phaser.Scene): void {

  // ----- HELM: tapered great-helm (wider crown, narrower jaw, flat face) -----
  paintBodyPart(scene, TextureKeys.PALADIN_HELM, 44, 48, {
    points: [
      // Crown (widest point)
      { x: -14, y: -20 }, { x: -10, y: -23 }, { x: 10, y: -23 }, { x: 14, y: -20 },
      // Sides taper inward toward the jaw
      { x: 15, y: -10 }, { x: 14, y: 0 },
      // Jaw line (narrower than crown)
      { x: 12, y: 12 }, { x: 10, y: 18 },
      // Chin (narrowest)
      { x: 6, y: 22 }, { x: -6, y: 22 },
      // Back up the other side
      { x: -10, y: 18 }, { x: -12, y: 12 },
      { x: -14, y: 0 }, { x: -15, y: -10 },
    ],
    base: STEEL, shadow: STEEL_SH, highlight: STEEL_HI,
    noise: 24, brushCount: 0,
    outlineWeight: 2.0, outlineJitter: 0.5, outlinePasses: 1,
    shadowAlpha: 0.48, shadowExtent: 0.55,
    highlightAlpha: 0.50, highlightExtent: 0.20,
  });

  // ----- TORSO: plate breastplate tapered at the waist -----
  paintBodyPart(scene, TextureKeys.PALADIN_TORSO, 56, 52, {
    points: [
      // Shoulders (widest)
      { x: -16, y: -24 }, { x: -8, y: -26 }, { x: 8, y: -26 }, { x: 16, y: -24 },
      // Ribcage
      { x: 18, y: -14 }, { x: 17, y: -4 },
      // Waist (tapered inward)
      { x: 14, y: 8 }, { x: 12, y: 14 },
      // Belt line
      { x: 10, y: 18 }, { x: -10, y: 18 },
      // Back up the left side
      { x: -12, y: 14 }, { x: -14, y: 8 },
      { x: -17, y: -4 }, { x: -18, y: -14 },
    ],
    base: STEEL, shadow: STEEL_SH, highlight: STEEL_HI,
    noise: 26, brushCount: 0,
    outlineWeight: 2.0, outlineJitter: 0.5, outlinePasses: 1,
    shadowAlpha: 0.48, shadowExtent: 0.55,
    highlightAlpha: 0.48, highlightExtent: 0.18,
  });

  // ----- PAULDRONS: segmented steel shoulder plates (not gold orbs) -----
  // Left pauldron — layered plate shape
  paintBodyPart(scene, TextureKeys.PALADIN_PAULDRON_L, 26, 20, {
    points: [
      { x: -10, y: -4 }, { x: -6, y: -9 }, { x: 2, y: -10 }, { x: 8, y: -8 },
      { x: 10, y: -2 }, { x: 9, y: 4 }, { x: 4, y: 8 },
      { x: -4, y: 8 }, { x: -10, y: 4 },
    ],
    base: STEEL, shadow: STEEL_EDGE, highlight: STEEL_HI,
    noise: 22, brushCount: 0,
    outlineWeight: 1.8, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.50, shadowExtent: 0.55,
    highlightAlpha: 0.50, highlightExtent: 0.25,
  });
  // Right pauldron (mirror)
  paintBodyPart(scene, TextureKeys.PALADIN_PAULDRON_R, 26, 20, {
    points: [
      { x: 10, y: -4 }, { x: 6, y: -9 }, { x: -2, y: -10 }, { x: -8, y: -8 },
      { x: -10, y: -2 }, { x: -9, y: 4 }, { x: -4, y: 8 },
      { x: 4, y: 8 }, { x: 10, y: 4 },
    ],
    base: STEEL, shadow: STEEL_EDGE, highlight: STEEL_HI,
    noise: 22, brushCount: 0,
    outlineWeight: 1.8, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.50, shadowExtent: 0.55,
    highlightAlpha: 0.50, highlightExtent: 0.25,
  });

  // ----- THIGH: plate cuisses (wider at hip, narrower at knee) -----
  paintBodyPart(scene, TextureKeys.PALADIN_THIGH, 16, 20, {
    points: [
      { x: -6, y: -9 }, { x: 6, y: -9 },
      { x: 5, y: 6 }, { x: 4, y: 9 }, { x: -4, y: 9 }, { x: -5, y: 6 },
    ],
    base: STEEL, shadow: STEEL_SH, highlight: STEEL_HI,
    noise: 22, brushCount: 0,
    outlineWeight: 1.6, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.45, shadowExtent: 0.55,
    highlightAlpha: 0.42, highlightExtent: 0.20,
  });

  // ----- SHIN: pointed greaves (wide knee → narrow ankle, center ridge) -----
  paintBodyPart(scene, TextureKeys.PALADIN_SHIN, 16, 20, {
    points: [
      // Knee (widest)
      { x: -5, y: -9 }, { x: 5, y: -9 },
      // Front ridge bump
      { x: 6, y: -4 },
      // Taper to ankle
      { x: 4, y: 6 }, { x: 3, y: 9 },
      // Ankle (narrowest)
      { x: -3, y: 9 }, { x: -4, y: 6 },
      { x: -6, y: -4 },
    ],
    base: STEEL, shadow: STEEL_SH, highlight: STEEL_HI,
    noise: 22, brushCount: 0,
    outlineWeight: 1.6, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.45, shadowExtent: 0.55,
    highlightAlpha: 0.45, highlightExtent: 0.22,
  });

  // ----- GREAVE FOOT: pointed sabatons -----
  paintBodyPart(scene, TextureKeys.PALADIN_BOOT, 22, 14, {
    points: [
      { x: -6, y: -6 }, { x: 6, y: -6 },
      // Front knee guard
      { x: 8, y: -2 },
      // Pointed toe
      { x: 10, y: 3 }, { x: 9, y: 5 },
      // Sole
      { x: 6, y: 6 }, { x: -6, y: 6 },
      // Back heel
      { x: -8, y: 4 }, { x: -8, y: -2 },
    ],
    base: STEEL, shadow: STEEL_EDGE, highlight: STEEL_HI,
    noise: 22, brushCount: 0,
    outlineWeight: 1.6, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.50, shadowExtent: 0.50,
    highlightAlpha: 0.42, highlightExtent: 0.22,
  });

  // ----- ARM: segmented — thicker forearm than upper arm -----
  paintBodyPart(scene, TextureKeys.PALADIN_ARM, 16, 28, {
    points: [
      // Shoulder end (narrower)
      { x: -4, y: -13 }, { x: 4, y: -13 },
      // Elbow (slight bulge)
      { x: 5, y: -2 },
      // Forearm (thicker)
      { x: 6, y: 6 }, { x: 6, y: 12 },
      // Wrist
      { x: 4, y: 13 }, { x: -4, y: 13 },
      // Back side
      { x: -6, y: 12 }, { x: -6, y: 6 },
      { x: -5, y: -2 },
    ],
    base: STEEL, shadow: STEEL_SH, highlight: STEEL_HI,
    noise: 22, brushCount: 0,
    outlineWeight: 1.6, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.45, shadowExtent: 0.55,
    highlightAlpha: 0.42, highlightExtent: 0.18,
  });

  // ----- GAUNTLET -----
  paintBlobPart(scene, TextureKeys.PALADIN_GAUNTLET, 14, 14, {
    base: STEEL, shadow: STEEL_EDGE, highlight: STEEL_HI,
    noise: 20, brushCount: 0,
    outlineWeight: 1.6, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.48, shadowExtent: 0.50,
    highlightAlpha: 0.50, highlightExtent: 0.30,
    sides: 8, jitterAmount: 0.18,
  });

  // ----- SWORD -----
  paintBodyPart(scene, TextureKeys.PALADIN_SWORD, 24, 56, {
    points: [
      { x: -10, y: 18 }, { x: -8, y: 14 },
      { x: -2.5, y: 14 }, { x: -2.5, y: 24 },
      { x: -3, y: 26 }, { x: 3, y: 26 },
      { x: 2.5, y: 24 }, { x: 2.5, y: 14 },
      { x: 8, y: 14 }, { x: 10, y: 18 },
      { x: 10, y: 14 }, { x: 3, y: 12 },
      { x: 3, y: -8 }, { x: 2.4, y: -20 },
      { x: 0, y: -26 },
      { x: -2.4, y: -20 }, { x: -3, y: -8 },
      { x: -3, y: 12 }, { x: -10, y: 14 },
    ],
    base: 0xdddde8, shadow: 0x5a5a6a, highlight: 0xffffff,
    noise: 18, brushCount: 0,
    outlineWeight: 1.8, outlineJitter: 0.5, outlinePasses: 1,
    shadowAlpha: 0.35, shadowExtent: 0.50,
    highlightAlpha: 0.45, highlightExtent: 0.16,
  });

  // ----- SHIELD: rectangular tower shield, neck-to-feet -----
  paintBodyPart(scene, TextureKeys.PALADIN_SHIELD, 28, 56, {
    points: [
      // Flat top edge
      { x: -12, y: -26 }, { x: 12, y: -26 },
      // Right side — straight vertical
      { x: 12, y: 26 },
      // Flat bottom edge
      { x: -12, y: 26 },
      // Left side — straight vertical (closes to top-left)
    ],
    base: STEEL, shadow: STEEL_SH, highlight: STEEL_HI,
    noise: 24, brushCount: 0,
    outlineWeight: 2.0, outlineJitter: 0.5, outlinePasses: 1,
    shadowAlpha: 0.48, shadowExtent: 0.55,
    highlightAlpha: 0.48, highlightExtent: 0.22,
  });

  // ----- CAPE: deep red, shoulder-to-feet, flat bottom hem -----
  paintBodyPart(scene, TextureKeys.PALADIN_CAPE, 50, 82, {
    points: [
      // Top: shoulder attachment
      { x: -14, y: -40 }, { x: 14, y: -40 }, { x: 16, y: -36 },
      // Right side — gentle outward drape
      { x: 18, y: -22 }, { x: 20, y: -6 },
      { x: 22, y: 10 }, { x: 22, y: 30 },
      // Right corner — short taper into flat hem
      { x: 21, y: 38 }, { x: 20, y: 40 },
      // *** Flat bottom hem — straight horizontal line ***
      { x: -20, y: 40 },
      // Left corner — short taper out of flat hem
      { x: -21, y: 38 }, { x: -22, y: 30 },
      // Left side
      { x: -20, y: 10 }, { x: -20, y: -4 },
      { x: -18, y: -18 }, { x: -16, y: -32 }, { x: -15, y: -36 },
    ],
    base: CAPE_RED, shadow: CAPE_SH, highlight: CAPE_HI,
    noise: 22, brushCount: 0,
    outlineWeight: 1.6, outlineJitter: 0.3, outlinePasses: 1,
    shadowAlpha: 0.40, shadowExtent: 0.60,
    highlightAlpha: 0.30, highlightExtent: 0.18,
  });

  // ----- TABARD: off-white cloth panel over armor, reaches below belt -----
  paintBodyPart(scene, TextureKeys.PALADIN_TABARD, 24, 42, {
    points: [
      { x: -8, y: -20 }, { x: 8, y: -20 },
      { x: 9, y: -8 }, { x: 10, y: 4 },
      // Below belt, tabard widens slightly and has an irregular hem
      { x: 9, y: 14 }, { x: 6, y: 18 }, { x: 0, y: 20 }, { x: -6, y: 18 },
      { x: -9, y: 14 },
      { x: -10, y: 4 }, { x: -9, y: -8 },
    ],
    base: CLOTH, shadow: CLOTH_SH, highlight: CLOTH_HI,
    noise: 20, brushCount: 0,
    outlineWeight: 1.4, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.30, shadowExtent: 0.55,
    highlightAlpha: 0.28, highlightExtent: 0.20,
  });

  // ----- CROSS EMBLEM -----
  paintBodyPart(scene, TextureKeys.PALADIN_CROSS, 18, 22, {
    points: [
      { x: -2.5, y: -10 }, { x: 2.5, y: -10 },
      { x: 3, y: -2 }, { x: 8, y: -2 }, { x: 8, y: 2 }, { x: 3, y: 2 },
      { x: 3, y: 10 }, { x: -3, y: 10 },
      { x: -3, y: 2 }, { x: -8, y: 2 }, { x: -8, y: -2 }, { x: -3, y: -2 },
    ],
    base: CROSS_RED, shadow: CROSS_SH, highlight: CROSS_HI,
    noise: 20, brushCount: 0,
    outlineWeight: 1.4, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.40, shadowExtent: 0.55,
    highlightAlpha: 0.40, highlightExtent: 0.22,
  });

  // ----- PLUME -----
  paintBodyPart(scene, TextureKeys.PALADIN_PLUME, 14, 22, {
    points: [
      { x: -3, y: 9 }, { x: 3, y: 9 },
      { x: 4, y: 4 }, { x: 5, y: -2 },
      { x: 4, y: -7 }, { x: 0, y: -10 },
      { x: -4, y: -7 }, { x: -5, y: -2 }, { x: -4, y: 4 },
    ],
    base: CAPE_RED, shadow: CAPE_SH, highlight: CAPE_HI,
    noise: 24, brushCount: 0,
    outlineWeight: 1.4, outlineJitter: 0.4, outlinePasses: 1,
    shadowAlpha: 0.42, shadowExtent: 0.50,
    highlightAlpha: 0.48, highlightExtent: 0.30,
  });

  // ----- HALO -----
  paintBlobPart(scene, TextureKeys.PALADIN_HALO, 28, 14, {
    base: 0xfff8cc, shadow: 0xeacb6c, highlight: 0xffffff,
    noise: 14, brushCount: 0,
    outlineWeight: 1.2, outlineJitter: 0.3, outlinePasses: 1,
    outlineColor: 0xffd566,
    shadowAlpha: 0.20, shadowExtent: 0.50,
    highlightAlpha: 0.55, highlightExtent: 0.50,
    sides: 16, jitterAmount: 0.14,
  });

  // Suppress unused
  void LEATHER; void GOLD; void GOLD_SH; void GOLD_HI;
}

// =============================================================================
// BUILDER
// =============================================================================
export function buildPaladinProcedural(
  scene: Phaser.Scene,
  bodyGroup: Phaser.GameObjects.Container,
): HeroVisualParts {
  ensurePaladinTextures(scene);

  // =========================================================================
  // All Y offsets are built from BOOT SOLES = y 0 (ground contact baseline).
  // Original design had boots at y≈14, so every root-level child in bodyGroup
  // shifts up by 14 so boot soles land at y=0.
  // Working upward: boots → shins → thighs → hips → belt → torso → head.
  // =========================================================================

  // =======================================================================
  // DRAW ORDER (back to front):
  //   1. cape        — furthest back
  //   2. legs        — behind torso
  //   3. upperBody   — torso, shield, arms, head (in front of legs)
  // =======================================================================

  // ===== 1. CAPE =====
  // Hangs from shoulders to about knee level, leaving boots visible.
  const cape = scene.add.image(0, -44, TextureKeys.PALADIN_CAPE);
  cape.setOrigin(0.5, 0);
  cape.setDisplaySize(32, 36);
  bodyGroup.add(cape);

  // ===== 2. LEGS (behind torso) =====
  const HIP_Y = -27;
  const THIGH_LEN = 10;
  const SHIN_LEN  = 10;

  const buildJointedLeg = (hipX: number) => {
    const hip = scene.add.container(hipX, HIP_Y);
    bodyGroup.add(hip);
    const thigh = scene.add.image(0, 0, TextureKeys.PALADIN_THIGH);
    thigh.setOrigin(0.5, 0);
    thigh.setDisplaySize(11, THIGH_LEN + 2);
    hip.add(thigh);

    const knee = scene.add.container(0, THIGH_LEN);
    hip.add(knee);
    const shin = scene.add.image(0, 0, TextureKeys.PALADIN_SHIN);
    shin.setOrigin(0.5, 0);
    shin.setDisplaySize(11, SHIN_LEN + 2);
    knee.add(shin);
    const boot = scene.add.image(1, SHIN_LEN + 1, TextureKeys.PALADIN_BOOT);
    boot.setOrigin(0.5, 0.35);
    boot.setDisplaySize(17, 10);
    knee.add(boot);
    return { hip, knee };
  };
  const left  = buildJointedLeg(-5);
  const right = buildJointedLeg(5);

  // ===== 3. UPPER BODY (in front of legs) =====
  const upperBodyPivot = scene.add.container(0, 0);
  bodyGroup.add(upperBodyPivot);
  const upperBody = scene.add.container(0, -2);
  upperBodyPivot.add(upperBody);

  // ----- TORSO (plate armor — ends at waist so legs show below) -----
  const torso = scene.add.image(0, -26, TextureKeys.PALADIN_TORSO);
  torso.setDisplaySize(34, 22);
  upperBody.add(torso);

  // ----- BELT SEPARATION (dark leather belt at waist) -----
  const beltG = scene.add.graphics();
  beltG.fillStyle(0x3a2414, 1);
  beltG.fillRect(-13, -17, 26, 4);
  // Gold buckle
  beltG.fillStyle(0xd8b838, 1);
  beltG.fillRect(-3, -18, 6, 6);
  beltG.lineStyle(1.0, 0x1a1a22, 0.7);
  beltG.strokeRect(-3, -18, 6, 6);
  upperBody.add(beltG);

  // ----- TABARD (off-white cloth — chest to just above thighs) -----
  const tabard = scene.add.image(0, -22, TextureKeys.PALADIN_TABARD);
  tabard.setDisplaySize(20, 26);
  upperBody.add(tabard);

  // ----- CROSS EMBLEM -----
  const cross = scene.add.image(0, -24, TextureKeys.PALADIN_CROSS);
  cross.setDisplaySize(14, 16);
  upperBody.add(cross);

  // ----- PAULDRONS (segmented steel plates) -----
  const pauldronL = scene.add.image(-15, -35, TextureKeys.PALADIN_PAULDRON_L);
  pauldronL.setDisplaySize(16, 13);
  upperBody.add(pauldronL);
  const pauldronR = scene.add.image(15, -35, TextureKeys.PALADIN_PAULDRON_R);
  pauldronR.setDisplaySize(16, 13);
  upperBody.add(pauldronR);

  // ===== HEAD PIVOT =====
  const headPivot = scene.add.container(0, -48);
  upperBody.add(headPivot);
  // Halo
  const halo = scene.add.image(0, -18, TextureKeys.PALADIN_HALO);
  halo.setDisplaySize(22, 11);
  headPivot.add(halo);
  scene.tweens.add({ targets: halo, alpha: { from: 0.55, to: 0.25 }, duration: 1200, yoyo: true, repeat: -1 });
  // Plume (red, matching cape)
  const plume = scene.add.image(0, -20, TextureKeys.PALADIN_PLUME);
  plume.setDisplaySize(11, 18);
  headPivot.add(plume);
  // Helm (tapered great-helm)
  const helm = scene.add.image(0, 0, TextureKeys.PALADIN_HELM);
  helm.setDisplaySize(28, 30);
  headPivot.add(helm);
  // Visor slit detail (drawn on top of the helm image)
  const visorG = scene.add.graphics();
  visorG.fillStyle(0x1a1a22, 0.85);
  visorG.fillRect(-6, -2, 12, 2.5); // horizontal slit
  headPivot.add(visorG);

  // ===== SHIELD ARM (right side — added first so it renders BEHIND weapon) =====
  const backArmNode = scene.add.container(15, -34);
  upperBody.add(backArmNode);
  const shield = scene.add.image(0, -6, TextureKeys.PALADIN_SHIELD);
  shield.setOrigin(0.5, 0);
  shield.setDisplaySize(24, 42);
  backArmNode.add(shield);

  // ===== WEAPON ARM (left side — added after shield so it renders IN FRONT) =====
  const shoulderX = -14;
  const shoulderY = -34;
  const shoulderNode = scene.add.container(shoulderX, shoulderY);
  upperBody.add(shoulderNode);

  const HAND_X = -6;
  const HAND_Y = 18;
  const arm = scene.add.image(HAND_X / 2, HAND_Y / 2, TextureKeys.PALADIN_ARM);
  arm.setDisplaySize(11, Math.hypot(HAND_X, HAND_Y) + 2);
  arm.setRotation(Math.atan2(HAND_Y, HAND_X) - Math.PI / 2);
  shoulderNode.add(arm);

  const swordNode = scene.add.container(HAND_X, HAND_Y);
  swordNode.setScale(1.5);
  shoulderNode.add(swordNode);

  const gauntlet = scene.add.image(HAND_X, HAND_Y, TextureKeys.PALADIN_GAUNTLET);
  gauntlet.setDisplaySize(8, 8);
  shoulderNode.add(gauntlet);
  const defaultSwordSub = scene.add.container(0, 0);
  defaultSwordSub.angle = 90;
  swordNode.add(defaultSwordSub);
  const sword = scene.add.image(0, 0, TextureKeys.PALADIN_SWORD);
  sword.setOrigin(0.5, 0.78);
  sword.setDisplaySize(20, 46);
  defaultSwordSub.add(sword);

  // ===== FLASH SPRITE (for state color tints) =====
  const flashSprite = scene.add.rectangle(0, -22, 1, 1, STEEL);
  flashSprite.setVisible(false);
  upperBody.add(flashSprite);

  return {
    sprite: flashSprite,
    upperBodyPivot,
    upperBodyInner: upperBody,
    headPivot,
    headBaseX: 0,
    headBaseY: -48,
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
