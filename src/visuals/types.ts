// =============================================================================
// VISUAL BUILDER INTERFACE
// =============================================================================
// A visual builder produces a HeroVisualParts bundle and hands it back to the
// Hero entity via attachVisualParts(). The Hero entity stores these references
// and the animation system reads them to drive joints.
//
// To swap a procedural builder for a sprite-based one in the future, write a
// new builder that returns the same shape of HeroVisualParts but populated
// with sprite GameObjects instead of primitive shapes. Combat / movement /
// collision / combo logic does not change.

import Phaser from 'phaser';

export interface HeroVisualParts {
  /** Required: the rect or shape used by state code for color flashes */
  sprite: Phaser.GameObjects.Rectangle;

  // ----- Animated joints (optional — only set by classes that have them) -----
  upperBodyPivot?: Phaser.GameObjects.Container;
  upperBodyInner?: Phaser.GameObjects.Container;
  headPivot?: Phaser.GameObjects.Container;
  /** Base X/Y of the head pivot — used for head stabilization translation */
  headBaseX?: number;
  headBaseY?: number;
  shoulderNode?: Phaser.GameObjects.Container;
  swordNode?: Phaser.GameObjects.Container;
  backArmNode?: Phaser.GameObjects.Container;
  legLeftPivot?: Phaser.GameObjects.Container;
  legLeftKnee?: Phaser.GameObjects.Container;
  legRightPivot?: Phaser.GameObjects.Container;
  legRightKnee?: Phaser.GameObjects.Container;
  defaultSwordVisuals?: Phaser.GameObjects.Container;

  /** Default weapon objects that should be hidden when an equipped weapon is set */
  defaultWeaponVisuals?: Phaser.GameObjects.GameObject[];

  /** Optional cape image — used by Hero update loop for movement-based trailing */
  capeNode?: Phaser.GameObjects.Image;

  /** Optional override for the drop-shadow tint when this class wants it */
  shadowColor?: number;
  shadowAlpha?: number;
}
