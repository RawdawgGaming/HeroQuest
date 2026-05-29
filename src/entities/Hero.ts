import Phaser from 'phaser';
import { StateMachine, State } from '../systems/StateMachine';
import { EventBus, Events } from '../systems/EventBus';
import type { AttackType } from '../data/heroClasses';
import { drawWeaponIcon, WEAPON_TEXTURES } from '../data/weaponIcons';
import { getHeroVisualBuilder, type HeroVisualParts } from '../visuals';
import { createSoftShadow } from '../visuals/shadow';
import { FINISHER_IMPACT_FRAME } from '../visuals/sprite/paladinSheet';
import { getSocketsForAnim, WEAPON_GRIPS, DEFAULT_GRIP, type WeaponGrip } from '../data/paladinHandData';

export interface HeroStats {
  moveSpeed: number;
  maxHealth: number;
  attackPower: number;
  defense: number;
}

const DEFAULT_STATS: HeroStats = {
  moveSpeed: 200,
  maxHealth: 100,
  attackPower: 10,
  defense: 5,
};

// Ground lane
export const GROUND_MIN_Y = 420;
export const GROUND_MAX_Y = 560;

// Jump physics
const JUMP_VELOCITY = -400;
const GRAVITY = 1200;

// Per-combo-step damage MULTIPLIERS of stats.attackPower.
//
// Steps 0/1/2 are the three BASIC slashes. Step 3 is the SMASH finisher.
// The smash deals exactly 3× the basic damage (sum of all three basics) so
// the player feels rewarded for completing the combo. After the smash, the
// combo wraps back to step 0.
//
// Multiplying by attackPower means leveling up + equipping weapons actually
// scales melee damage instead of being ignored.
const COMBO_MULTIPLIERS = [1.8, 1.8, 1.8, 5.4];
/** True if the given combo step is the smash finisher.
 *  Currently disabled — will be re-enabled when a finisher sprite sheet is added. */
const isSmashStep = (_step: number) => false;

// =============================================================================
// MOVEMENT FEEL TUNING — locomotion / idle / jump / turn polish
// =============================================================================
// Every dial that affects how the character "feels" while moving lives here.
// Tweaking these values is the fastest way to change the feel without touching
// the underlying state machine.
export const MOVEMENT_TUNE = {
  // ----- Acceleration / deceleration -----
  /** How quickly the character ramps up to full speed (0..1, fraction per frame at 60fps) */
  acceleration: 0.22,
  /** How quickly the character bleeds off velocity when no input (higher = snappier stops) */
  deceleration: 0.26,

  // ----- Run cycle (drives FULL BODY: hips → torso → shoulders → arms → head) -----
  // The cycle is treated as a single phase (radians) shared by every body part so
  // the kinetic chain stays musically locked. Each part has its own amplitude.
  /** ms per full stride cycle at full run speed (cycle shortens at higher speed) */
  runStridePeriod: 290,
  /** Minimum stride period at top speed (caps how fast the legs can churn) */
  runStridePeriodMin: 230,
  /** Max leg swing angle in degrees (FRONT/BACK LEGS — alternating) */
  runStrideAmplitude: 46,
  /** Vertical hip bounce amplitude in pixels (HIPS — twice per stride, one per footfall) */
  runBobAmplitude: 3.4,
  /** Lateral hip shift amplitude in pixels (HIPS — weight transfer side to side) */
  runHipLateralAmplitude: 2.8,
  /** Forward-lean of the torso when running, in degrees (TORSO) */
  runForwardLean: 9,
  /** Subtle counter-rotation of the shoulders against the hips, in degrees (SHOULDERS) */
  runShoulderCounter: 6,
  /** Front arm (sword side) swing amplitude during run (degrees) — opposite the legs */
  runArmSwing: 26,
  /** Back arm (shield side) swing amplitude (degrees) — opposite the front arm */
  runBackArmSwing: 22,
  /** Head vertical stabilization fraction (0 = bobs with hips, 1 = perfectly stable) */
  runHeadStabilize: 0.7,
  /** Extra "step accent" — at the moment a foot plants, the hip drives down a bit harder */
  runFootPlantAccent: 1.6,
  /** Knee bend lerp factor between standing (40%) and full keyframe values (100%) at speed */
  runKneeSpeedScale: 0.4,

  // ----- Idle "alive" motion (HIPS rise, TORSO sways, HEAD floats opposite) -----
  /** Vertical hip breathing offset in pixels */
  idleBreathAmplitude: 1.0,
  /** ms per full breath cycle */
  idleBreathPeriod: 2200,
  /** Subtle torso sway amplitude in degrees (TORSO) */
  idleTorsoSway: 0.8,
  /** Counter-bob the head against the chest rise (px) — sells the spine compressing */
  idleHeadFloat: 0.5,
  /** Front arm idle hand drift (degrees, very subtle) */
  idleArmDrift: 1.0,
  /** Contrapposto: bias hip lateral shift toward one side at rest (px) */
  idleHipBias: 0.6,

  // ----- Stop / settle -----
  /** ms it takes for the body to settle back from run pose to idle */
  stopSettleDuration: 140,

  // ----- Turn (quick reverse — actual animation, not just a flip) -----
  /** ms the turn animation lasts when reversing direction quickly */
  turnDuration: 160,
  /** Degrees the upper body counter-rotates during a fast turn (weight transfer) */
  turnTorsoCounter: 14,
  /** Extra hip lateral kick away from the new direction during turn (px) */
  turnHipKick: 4,
  /** Brief vertical drop during the turn (sells the weight transfer) */
  turnHipDrop: 2,

  // ----- Jump -----
  /** Time spent in the squat-anticipation phase before launch (ms) */
  jumpSquatDuration: 90,
  /** How much the body compresses during squat (px) */
  jumpSquatCompression: 7,
  /** Speed of jumpZ at which we consider the character "rising" vs "falling" */
  jumpRiseFallThreshold: 0,
  /** ms of compression on landing (light landing) */
  landCompressionDuration: 160,
  /** Compression amount in pixels for a light landing */
  landCompressionLight: 5,
  /** Compression amount for a hard landing (long fall) */
  landCompressionHard: 11,
  /** Fall speed above which a landing counts as "hard" */
  hardLandingFallSpeed: 240,

  // ----- Coyote / buffering -----
  /** How long after walking off a ledge the player can still jump (ms) */
  coyoteTime: 110,
  /** How long an early jump press is buffered before landing (ms) */
  jumpBufferTime: 140,
} as const;

// =============================================================================
// MELEE ATTACK TUNING — phase-based, frame-by-frame attack controller
// =============================================================================
// A single attack is split into 3 PHASES (windup / active / recovery) which
// in turn drive 5 ANIMATION FRAMES (anticipation, startup, contact,
// follow-through, recovery). Each frame is a target POSE that the body
// interpolates toward — torso, shoulders, sword wrist, and legs all shift.
//
// Total attack time = windupDuration + activeDuration + recoveryDuration.
export const MELEE_TUNE = {
  // ----- Phase durations (ms) — synced to visual animation phases -----
  /** Windup: hammer raises. */
  windupDuration: 175,
  /** Active: strike + impact + follow-through. */
  activeDuration: 250,
  /** Recovery: end-pose hold + buffer before idle transition. */
  recoveryDuration: 40,

  // ----- Where in active is the hitbox actually live -----
  /** Hitbox enables after the downswing reaches impact. */
  hitboxStartOffset: 100,
  /** Hitbox stays on through the follow-through. */
  hitboxEndOffset: 210,

  // ----- Movement multipliers (0..1, fraction of base move speed) -----
  /** Movement during windup — almost frozen, planting feet for the swing. */
  windupMoveMultiplier: 0.3,
  /** Movement during active — committed, minimal drift. */
  activeMoveMultiplier: 0.2,
  /** Recovery — can start moving again but not full speed yet. */
  recoveryMoveMultiplier: 0.6,

  // ----- Lunge -----
  /** Forward velocity (px/s) — reduced for heavy weapon. */
  lungeSpeed: 200,
  /** Maximum total pixels the lunge carries. Short deliberate step. */
  lungeDistance: 16,

  // ----- Combo / queueing -----
  /** Press J this many ms before swing end to queue the next attack. */
  comboInputWindow: 500,
  /** After a swing ends with no follow-up, comboStep resets if no new attack
   *  is started within this many ms. Extra generous for heavy weapon rhythm. */
  comboResetDuration: 1600,

  // ----- JUMP SMASH FINISHER (combo step 3) -----
  // Phase 1 anticipation → 2 launch → 3 apex → 4 descent → 5 impact → 6 recovery
  // Phases run in order with no early-out so the finisher can't be interrupted.
  /** Phase 1 — anticipation crouch before the launch (ms) */
  finisherWindupDuration: 170,
  /** Phase 2 — body rises from ground to peak (ms) */
  finisherLaunchDuration: 130,
  /** Phase 3 — brief hang at the apex with weapon raised overhead (ms) */
  finisherApexDuration: 90,
  /** Phase 4 — fast descent crashing downward (ms). Faster than ascent = gamey, not floaty. */
  finisherDescentDuration: 110,
  /** Phase 5 — landed compression with hitbox active (ms) */
  finisherImpactDuration: 110,
  /** Phase 6 — recovery from landing before control returns (ms) */
  finisherRecoveryDuration: 180,

  /** Peak jump altitude (px above ground — stored as a positive number, internally negative jumpZ) */
  finisherLaunchHeight: 140,
  /** Total forward distance traveled across launch + descent (px) */
  finisherForwardDistance: 40,

  /** When in the impact phase the hitbox is live (ms from impact start) */
  finisherHitboxStartTime: 0,
  finisherHitboxEndTime: 90,
  /** Hitbox dimensions for the slam — wider + taller than the basic combo box */
  finisherHitboxWidth: 143,
  finisherHitboxHeight: 91,
  /** Radial slam radius centered on the hero. Enemies within this distance
   *  in any direction are hit by the finisher. */
  finisherRadius: 260,

  /** Landing compression in pixels — body squashes on the impact frame */
  finisherLandingCompression: 9,
  /** Knockback force on the slam (basic uses 380) */
  finisherKnockbackForce: 900,
  /** Camera shake on slam connect */
  finisherShakeDuration: 320,
  finisherShakeIntensity: 0.020,

  // ----- Turning -----
  /** Facing direction is locked for this long after each attack starts. */
  turnLockDuration: 150,
} as const;

/** Phases of a single melee attack (high-level state) */
type AttackPhase = 'windup' | 'active' | 'recovery' | 'idle';

/** A snapshot of all the body joints used by the attack animation.
 *  This is the FULL KINETIC CHAIN — every body part has a slot so an attack
 *  pose can drive the whole figure, not just the sword arm. */
type BodyPose = {
  /** TORSO lean angle in degrees (positive = lean forward into the swing) */
  upperBody: number;
  /** FRONT-ARM SHOULDER rotation in degrees (positive = arm forward) */
  shoulder: number;
  /** WEAPON wrist rotation in degrees (positive = blade rotates forward across body) */
  sword: number;
  /** BACK ARM angle in degrees (positive = shield/back-arm rotates forward across body)
   *  During a slash, the back arm pulls back as the front arm drives forward
   *  (Newton's third law — counter-rotation gives the swing power). */
  backArm: number;
  /** HEAD vertical offset in pixels (negative = head ducks down with the strike) */
  headDip: number;
  /** HIPS lateral shift in pixels (positive = forward/strike-direction). Lunges hips
   *  into the strike on contact, then settles back. */
  hipShift: number;
  /** HIPS vertical shift in pixels (positive = down). Drives the squash on contact. */
  hipDrop: number;
  /** BACK LEG hip pivot angle (left leg when facing right) — plants and pushes off */
  legLeft: number;
  /** FRONT LEG hip pivot angle (right leg when facing right) — steps into the strike */
  legRight: number;
  /** BACK LEG knee bend (degrees, positive = bent) */
  kneeLeft: number;
  /** FRONT LEG knee bend (degrees, positive = bent) */
  kneeRight: number;
};

/** A single keyframe in the attack animation timeline. */
type AttackFrame = {
  name: string;
  /** End time of this frame, measured in ms from attack start */
  endTime: number;
  /** Easing function used between previous frame's pose and this frame's pose */
  ease: string;
  /** Target pose for the END of this frame */
  pose: BodyPose;
};

const REST_POSE: BodyPose = {
  upperBody: 0, shoulder: 0, sword: 0, backArm: 0, headDip: 0,
  hipShift: 0, hipDrop: 0, legLeft: 0, legRight: 0,
  // Slight standing knee bend at rest — humans don't lock their knees standing
  kneeLeft: 6, kneeRight: 6,
};

// ============================================================================
// RUN CYCLE KEYFRAMES — explicit lower-body poses, not a sine sweep
// ============================================================================
// Eight lower-body poses spaced around one full stride. The cycle is symmetric:
// the second half is the first half with the legs swapped (CONTACT_L → CONTACT_R).
//
// Each pose defines what happens to:
//   HIPS         (vertical drop, lateral shift toward planted foot)
//   FRONT THIGH  (legRight hip angle when facing right)
//   FRONT KNEE   (kneeRight bend)
//   BACK THIGH   (legLeft hip angle)
//   BACK KNEE    (kneeLeft bend)
//
// The four sub-poses, in order, for the LEFT leg planting:
//   1. CONTACT     — left heel reaches forward and just plants
//   2. DOWN        — body lowest, left knee deeply bent absorbing weight
//   3. PASSING     — right leg passes under the body with deep knee tuck
//   4. PUSH-OFF    — left leg drives back/extending, right leg high in air recovery
// Then frames 5-8 mirror frames 1-4 with legs swapped (right-foot stride).
type RunFrame = {
  name: string;
  /** Position in the stride cycle, 0..1 */
  phase: number;
  /** Hip vertical drop in px (positive = down — body lowers on weight load) */
  hipDrop: number;
  /** Hip lateral shift in px (positive = right). Weight rolls onto the planted leg. */
  hipShift: number;
  /** LEFT leg hip angle in degrees (positive = forward) */
  legLeft: number;
  /** RIGHT leg hip angle in degrees */
  legRight: number;
  /** LEFT knee bend in degrees */
  kneeLeft: number;
  /** RIGHT knee bend in degrees */
  kneeRight: number;
};

// Authored at full-speed amplitude. tickRunCycle scales every value by speedFraction
// so a slow walk uses a fraction of these magnitudes.
//
// STRIDE SIZE: The hip-angle magnitudes below directly determine how far each
// foot reaches forward/back during the stride. Bigger numbers = longer strides.
const RUN_FRAMES: RunFrame[] = [
  // ----- LEFT FOOT PLANTING -----
  {
    name: 'contact_L',
    phase: 0.00,
    hipDrop: 0,    hipShift: -2,
    legLeft: 52,  kneeLeft: 14,    // left thigh reaches further forward
    legRight: -40, kneeRight: 22,  // right leg trailing further back
  },
  {
    name: 'down_L',
    phase: 0.12,
    hipDrop: 4,    hipShift: -3,
    legLeft: 38,  kneeLeft: 36,
    legRight: -26, kneeRight: 28,
  },
  {
    name: 'passing_L',
    phase: 0.25,
    hipDrop: 1,    hipShift: -1,
    legLeft: 12,  kneeLeft: 22,
    legRight: 6,   kneeRight: 44,
  },
  {
    name: 'pushoff_L',
    phase: 0.37,
    hipDrop: -2,   hipShift: 0,
    legLeft: -22, kneeLeft: 8,     // LEFT extended further back
    legRight: 36,  kneeRight: 38,  // right driven further forward
  },
  // ----- RIGHT FOOT PLANTING (mirror of frames 1-4) -----
  {
    name: 'contact_R',
    phase: 0.50,
    hipDrop: 0,    hipShift: 2,
    legLeft: -40, kneeLeft: 22,
    legRight: 52,  kneeRight: 14,
  },
  {
    name: 'down_R',
    phase: 0.62,
    hipDrop: 4,    hipShift: 3,
    legLeft: -26, kneeLeft: 28,
    legRight: 38,  kneeRight: 36,
  },
  {
    name: 'passing_R',
    phase: 0.75,
    hipDrop: 1,    hipShift: 1,
    legLeft: 6,   kneeLeft: 44,
    legRight: 12,  kneeRight: 22,
  },
  {
    name: 'pushoff_R',
    phase: 0.87,
    hipDrop: -2,   hipShift: 0,
    legLeft: 36,  kneeLeft: 38,
    legRight: -22, kneeRight: 8,
  },
];

// ============================================================================
// PALADIN ATTACK ANIMATION FRAMES
// ============================================================================
// Each frame is a snapshot of the body at the END of that frame. The
// controller interpolates from the previous frame's pose toward this one
// using the per-frame easing curve.
//
// Each frame describes the FULL BODY at the end of that beat. Body mechanics
// are layered as a kinetic chain — hips initiate, torso follows, shoulders drive
// the arm, the weapon trails then accelerates, and the back arm counter-rotates
// for power. The legs plant/step to anchor the force.
//
// Frame 1 (anticipation): WEIGHT SHIFTS BACK. Sword arm pulls back, torso leans
//   back, BACK ARM rotates forward (counter-balance), HEAD lifts slightly,
//   BACK LEG plants, FRONT LEG raises. Center of mass drops + shifts back.
// Frame 2 (startup): TORSO begins rotating forward. Shoulders initiate the
//   forward arc. Sword still trails — it's the LAST thing to accelerate.
// Frame 3 (contact): FULL COMMITMENT. Hips and chest aligned forward. Sword
//   extended at peak speed. BACK ARM has snapped back hard (counter-rotation).
//   HEAD dips into the strike. FRONT LEG plants forward — step lands on contact.
//   HITBOX ON.
// Frame 4 (follow-through): Momentum carries everything forward. Sword passes
//   through. Back arm starts returning. Head still dipped.
// Frame 5 (recovery): Everything settles back to ready stance under control.
function buildPaladinAttackFrames(): AttackFrame[] {
  const wU = MELEE_TUNE.windupDuration;
  const aC = MELEE_TUNE.activeDuration;
  const rC = MELEE_TUNE.recoveryDuration;
  return [
    {
      // ANTICIPATION — full body LOADS the swing. Weight shifts back, sword cocks
      // behind the head, back arm pushes forward as counter-balance, head lifts.
      name: 'anticipation',
      endTime: wU * 0.55,
      ease: 'Back.easeOut',
      pose: {
        upperBody: -16, shoulder: -150, sword: 65,
        backArm: 32,        // shield arm punches forward to counter the loaded sword
        headDip: -2,        // head lifts — gathering
        hipShift: -5,       // hips load BACK (away from strike direction)
        hipDrop: 2,         // weight drops onto the back leg
        legLeft: -18, legRight: 22,  // back leg planted, front leg picked up to step
        kneeLeft: 22,       // back leg deeply bent — coiling like a spring
        kneeRight: 38,      // front leg lifted high, knee tucked
      },
    },
    {
      // STARTUP — torso begins violent rotation forward. Sword still trails behind
      // (slowest to accelerate — it's whipping). Hips drive everything.
      name: 'startup',
      endTime: wU,
      ease: 'Quad.easeIn',
      pose: {
        upperBody: -4, shoulder: -110, sword: 50,
        backArm: 18,
        headDip: -1,
        hipShift: -2,
        hipDrop: 1,
        legLeft: -8, legRight: 10,
        kneeLeft: 14,       // back leg starting to extend (push prep)
        kneeRight: 28,      // front leg knee still bent, reaching
      },
    },
    {
      // CONTACT — peak impact. HITBOX ON. Hips lunge forward, body fully committed,
      // back arm SNAPS back hard (rotational power), head dips into the strike.
      name: 'contact',
      endTime: wU + aC * 0.40,
      ease: 'Expo.easeIn',
      pose: {
        upperBody: 18, shoulder: -2, sword: 140,
        backArm: -38,       // HARD counter-snap — generates the swing's power
        headDip: 4,         // head ducks into the strike — commitment
        hipShift: 7,        // hips THRUST forward — hip drive sells the impact
        hipDrop: 3,         // weight drops onto the front foot as it plants
        legLeft: 28, legRight: -22,  // back leg pushed off, front leg planted forward
        kneeLeft: 4,        // back leg fully extended in push-off — straight
        kneeRight: 32,      // front leg deeply bent — absorbing the lunge impact
      },
    },
    {
      // FOLLOW-THROUGH — momentum carries the body and sword past contact.
      // Back arm starts returning. Head still committed.
      name: 'follow_through',
      endTime: wU + aC,
      ease: 'Sine.easeOut',
      pose: {
        upperBody: 20, shoulder: 42, sword: 175,
        backArm: -18,       // shield arm returning to guard
        headDip: 2,
        hipShift: 4,
        hipDrop: 1,
        legLeft: 32, legRight: -28,
        kneeLeft: 18,       // back leg lifting/recovering
        kneeRight: 22,      // front leg still bearing weight, partially extending
      },
    },
    {
      // RECOVERY — settle to ready stance. Slight overshoot via Back.easeOut sells
      // the body re-stabilizing under control.
      name: 'recovery',
      endTime: wU + aC + rC,
      ease: 'Back.easeOut',
      pose: REST_POSE,
    },
  ];
}

// ============================================================================
// PALADIN JUMP SMASH FINISHER — combo step 3
// ============================================================================
// Six discrete phases run in order. Each phase has a TARGET POSE that the body
// lerps toward over the phase duration, plus its own per-frame logic for
// vertical position (jumpZ), forward momentum, and hitbox activation.
//
//   Phase 1 — ANTICIPATION : grounded crouch, weapon loaded
//   Phase 2 — LAUNCH       : legs extend, body rises, weapon swings up
//   Phase 3 — APEX         : brief hang at peak with weapon overhead
//   Phase 4 — DESCENT      : crash down, weapon leads
//   Phase 5 — IMPACT       : landed, hitbox active, body compressed
//   Phase 6 — RECOVERY     : settle to rest, control returns
//
// The hitbox is ONLY active during the IMPACT phase — damage is exclusively
// applied at the slam, never on the way up or during descent.
type FinisherPhase =
  | 'idle' | 'anticipation' | 'launch' | 'apex' | 'descent' | 'impact' | 'recovery';

/** Pose targets for each finisher phase. The body lerps toward these. */
const FINISHER_POSES: Record<Exclude<FinisherPhase, 'idle'>, BodyPose> = {
  // PHASE 1 — ANTICIPATION
  // Deep crouch. Weight loaded onto both legs, weapon pulled back, head up
  // looking at where the slam will go.
  anticipation: {
    upperBody: -8,
    shoulder: -120,           // sword cocked back behind the head
    sword: 60,
    backArm: 26,              // shield arm forward as counter-balance
    headDip: -3,              // chin up, eyes on target
    hipShift: 0,
    hipDrop: 7,               // BIG squat — body coils for the launch
    legLeft: -8, legRight: -8,
    kneeLeft: 56, kneeRight: 56,  // both knees deeply bent
  },

  // PHASE 2 — LAUNCH
  // Legs explode straight, body extends upward, weapon begins arcing up.
  launch: {
    upperBody: -4,
    shoulder: -90,            // arm beginning to swing the sword overhead
    sword: 30,
    backArm: 12,
    headDip: -2,
    hipShift: 0,
    hipDrop: -4,              // body extends UP, hips lift
    legLeft: 0, legRight: 0,  // legs straightening for push-off
    kneeLeft: 4, kneeRight: 4, // knees locked extending
  },

  // PHASE 3 — APEX
  // Peak hang. Weapon raised fully overhead, body loaded for the strike.
  apex: {
    upperBody: -12,           // small lean back at the apex to load the slam
    shoulder: -160,           // arm pulled all the way overhead behind
    sword: 100,               // weapon raised high
    backArm: 32,              // shield arm forward as counter
    headDip: -5,              // looking down at the landing spot
    hipShift: 0,
    hipDrop: -2,
    legLeft: -10, legRight: -10,  // legs tucked back/up in the air
    kneeLeft: 38, kneeRight: 38,  // knees bent in flight
  },

  // PHASE 4 — DESCENT
  // Body crashes down, weapon leads aggressively. Torso rotates forward.
  descent: {
    upperBody: 18,            // torso whips forward into the slam
    shoulder: 25,             // arm driving down
    sword: 175,               // weapon leading toward the ground
    backArm: -28,             // shield arm whipped back hard (Newton)
    headDip: 4,               // head plunged forward
    hipShift: 4,              // hips drive forward
    hipDrop: 0,               // returning toward neutral
    legLeft: 6, legRight: 6,
    kneeLeft: 22, kneeRight: 22,  // knees prepping for landing
  },

  // PHASE 5 — IMPACT
  // The slam landed. Hitbox active. Body compressed maximally. This is the
  // payoff frame — the most extreme pose in the whole combo.
  impact: {
    upperBody: 24,            // full forward commitment
    shoulder: 38,             // arm slammed all the way down
    sword: 200,               // weapon past horizontal, embedded in the ground
    backArm: -22,
    headDip: 6,
    hipShift: 5,
    hipDrop: 9,               // DEEP landing crouch — body squashes
    legLeft: 16, legRight: -14,  // legs splayed wide for balance
    kneeLeft: 60, kneeRight: 60,  // both knees fully bent absorbing the impact
  },

  // PHASE 6 — RECOVERY
  // Settle back to rest stance. Control returns at the end of this phase.
  recovery: REST_POSE,
};

// Projectile cast configuration
const CAST_DURATION = 840;     // ms for the cast animation (slowed 20%, was 700)
const CAST_COOLDOWN = 360;     // ms before you can cast again (slowed 20%, was 300)

/** Callback the scene provides so the hero can spawn projectiles */
export type SpawnProjectileFn = (
  x: number, y: number, groundY: number,
  directionX: number, damage: number,
) => void;

export class Hero extends Phaser.GameObjects.Container {
  scene: Phaser.Scene;
  body!: Phaser.Physics.Arcade.Body;

  // Visuals
  sprite!: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Ellipse;
  /** Root object that should be scaled with jumpZ. Equals `shadow` for legacy
   *  flat shadows; equals the SoftShadow container root for migrated classes. */
  private shadowScaleRoot!: Phaser.GameObjects.GameObject & { setScale: (x: number, y: number) => unknown };
  bodyGroup: Phaser.GameObjects.Container;

  // Stats & Health
  stats: HeroStats;
  currentHealth: number;
  isDead = false;

  // Jump
  groundY = 0;
  jumpZ = 0;
  jumpVelZ = 0;
  isGrounded = true;

  // State machine
  sm: StateMachine;

  // Attack type
  attackType: AttackType;
  spawnProjectile: SpawnProjectileFn | null = null;

  // Input
  keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    attack: Phaser.Input.Keyboard.Key;
  };
  attackPressed = false;

  // Melee attack state — phase-based combat controller
  /** Current combo step. 0/1/2 = basic slashes, 3 = smash finisher. After
   *  the smash completes, this resets back to 0. */
  comboStep = 0;
  /** Counts down between attacks. When it hits 0, comboStep resets to 0.
   *  Topped up to MELEE_TUNE.comboResetDuration each time an attack ends. */
  private comboResetTimer = 0;
  hitboxActive = false;
  currentHitboxDamage = 0;
  facingRight = true;
  /** Current phase within an attack swing */
  private attackPhase: AttackPhase = 'idle';
  /** Time elapsed within the current phase (ms) */
  private attackPhaseTimer = 0;
  /** Set to true when the player presses J during the comboInputWindow at the end of a swing */
  private attackQueued = false;
  /** Countdown after attack-start during which the facing direction is locked (ms) */
  private attackTurnLockTimer = 0;
  /** How far the lunge has carried the character so far in the current active phase (px) */
  private lungeTraveled = 0;
  /** True when the attack sprite animation has finished playing (including hold) */
  private attackVisualDone = false;
  /** Time elapsed since the start of the current attack swing (sums across phases) */
  private attackTotalElapsed = 0;
  /** Cached attack frame timeline (paladin only for now) */
  private attackFrames: AttackFrame[] = [];

  // ----- Jump smash finisher state -----
  /** Active phase of the jump smash finisher. 'idle' = not in a finisher. */
  private finisherPhase: FinisherPhase = 'idle';
  /** Time elapsed within the current finisher phase (ms) */
  private finisherPhaseTimer = 0;
  /** Pose the body was in when the current finisher phase started — used for lerp */
  private finisherPhaseStartPose: BodyPose = REST_POSE;
  /** Forward distance the finisher has carried the hero so far (px) */
  private finisherForwardTraveled = 0;
  /** Was the impact already applied (so we don't double-shake/double-knock)? */
  private finisherImpactLanded = false;

  /** Upper-body pivot for paladin torso lean. Inner container holds the parts. */
  upperBodyPivot: Phaser.GameObjects.Container | null = null;
  /** HEAD pivot — wraps helm + plume + halo. Translates to stabilize head over the bob. */
  headPivot: Phaser.GameObjects.Container | null = null;
  headBaseX = 0;
  headBaseY = 0;
  /** BACK ARM pivot — wraps shield + shield gauntlet. Used for back-arm swing during run/attack. */
  backArmNode: Phaser.GameObjects.Container | null = null;
  upperBodyInner: Phaser.GameObjects.Container | null = null;

  // Projectile cast state
  castTimer = 0;
  castCooldown = 0;
  projectileFired = false;


  // Attribute: attack speed (set by ForestStage)
  attackSpeedPoints = 0;
  /** When true, every attack uses the final smash animation and damage. Set by Consecration. */
  consecrationActive = false;
  /** When true, the walk mask handles Y restriction instead of GROUND_MIN/MAX_Y. */
  useWalkMask = false;

  // Ultimate ability: damage immunity flag
  isInvulnerable = false;
  ultimateActive = false;

  // ----- Post-hit damage immunity (i-frames) -----
  // After taking enemy damage, the hero is immune to further damage for a
  // brief window so the player isn't melted by overlapping attacks.
  /** How long the immunity lasts after a hit (ms). Tune this one value. */
  static readonly DAMAGE_IMMUNITY_DURATION = 2000;
  /** Blink cycle interval during immunity — lower = faster flicker (ms). */
  static readonly IMMUNITY_BLINK_INTERVAL = 120;
  /** Minimum alpha during the blink cycle (0 = fully invisible at the low point). */
  static readonly IMMUNITY_MIN_ALPHA = 0.3;
  /** Duration of the initial hit flash tint (ms). */
  static readonly HIT_FLASH_DURATION = 100;

  /** Time remaining on the post-hit damage immunity window (ms). 0 = vulnerable. */
  private damageImmunityTimer = 0;
  /** True while the hero is in the post-hit immunity window. */
  get isDamageImmune(): boolean { return this.damageImmunityTimer > 0; }

  // Hurt state
  hurtTimer = 0;

  // Track which enemies were hit this swing (melee only)
  hitEnemies = new Set<number>();

  // Colors
  baseColor: number;
  accentColor: number;

  // Class ID for custom visuals
  heroClassId: string;

  // Held weapon visuals (replaceable when equipping)
  private heldWeaponVisuals: Phaser.GameObjects.GameObject[] = [];
  private defaultWeaponVisuals: Phaser.GameObjects.GameObject[] = [];
  /** Two-joint sword arm — outer container pivots at the shoulder. */
  shoulderNode: Phaser.GameObjects.Container | null = null;
  /** Inner container pivots at the hand so the sword can rotate independently of the arm. */
  swordNode: Phaser.GameObjects.Container | null = null;
  /** Sub-container holding the DEFAULT sword visuals — hidden when an equipped weapon takes its place. */
  defaultSwordVisuals: Phaser.GameObjects.Container | null = null;
  /** Toggles the sword behind/in-front of the body on each moulinet revolution. */
  private moulinetBehindBody = false;
  /** Pivoted leg containers for running animation (populated by class visual builders) */
  /** HIP joint — rotates the entire leg (thigh + shin + foot) around the hip */
  legLeftPivot: Phaser.GameObjects.Container | null = null;
  legRightPivot: Phaser.GameObjects.Container | null = null;
  /** KNEE joint — rotates the shin + foot around the knee. New for jointed legs. */
  legLeftKnee: Phaser.GameObjects.Container | null = null;
  legRightKnee: Phaser.GameObjects.Container | null = null;
  /** Spritesheet animation sprite (null if using procedural rendering) */
  _sheetSprite: Phaser.GameObjects.Sprite | null = null;
  _sheetAnims: Record<string, string> | null = null;
  private _currentSheetAnim = '';
  /** Weapon overlay image — anchor-aligned per-frame to the hand */
  private _weaponOverlay: Phaser.GameObjects.Image | null = null;
  private _weaponDebug: Phaser.GameObjects.Graphics | null = null;
  private _currentGrip: WeaponGrip = DEFAULT_GRIP;

  /** Play a spritesheet animation if available. No-op for procedural rendering. */
  playSheetAnim(animKey: string, ignoreIfPlaying = true): void {
    if (!this._sheetSprite || !this._sheetAnims) return;
    const key = (this._sheetAnims as any)[animKey];
    if (!key) return;
    // Only change animation and scale if the animation actually exists in Phaser
    if (!this._sheetSprite.scene.anims.exists(key)) return;
    if (ignoreIfPlaying && this._currentSheetAnim === key) return;
    this._currentSheetAnim = key;
    this._sheetSprite.play(key, ignoreIfPlaying);
    // Adjust scale based on which sprite sheet is now active
    // Run: 288x192 frames — scale 86/192
    // Idle + Attack: 672x448 frames — scale 86/448
    if (animKey === 'WALK' || animKey === 'RUN') {
      this._sheetSprite.setScale(86 / 192);
      this._sheetSprite.x = -4.8;   // align run body center with idle
    } else {
      this._sheetSprite.setScale(86 / 224);
      this._sheetSprite.x = 0;      // idle is the reference position
    }
  }

  /** Per-frame weapon socket — pure frame-index lookup, zero interpolation. */
  private updateWeaponOverlay(
    anim: Phaser.Animations.Animation,
    frame: Phaser.Animations.AnimationFrame,
  ): void {
    if (!this._sheetSprite) return;

    // 1. Get socket array for the ACTUAL playing animation
    const sockets = getSocketsForAnim(anim.key);
    if (!sockets || sockets.length === 0) return;

    // 2. Direct frame-index lookup
    const idx = Math.min(frame.index, sockets.length - 1);
    const socket = sockets[idx];

    // 3. Sprite top-left in bodyGroup coords
    const topX = this._sheetSprite.x
      - this._sheetSprite.displayWidth * this._sheetSprite.originX;
    const topY = this._sheetSprite.y
      - this._sheetSprite.displayHeight * this._sheetSprite.originY;

    // 4. Socket position in bodyGroup coords
    const sx = topX + socket.x;
    const sy = topY + socket.y;

    // 5. Place weapon grip at the socket
    if (this._weaponOverlay && this._weaponOverlay.visible) {
      const grip = this._currentGrip;
      this._weaponOverlay.x = sx;
      this._weaponOverlay.y = sy;
      this._weaponOverlay.setOrigin(
        grip.x / this._weaponOverlay.width,
        grip.y / this._weaponOverlay.height,
      );
      this._weaponOverlay.rotation = Phaser.Math.DegToRad(socket.angle);

      // Z-order: weapon in front of sprite
      if (socket.behind) {
        this.bodyGroup.moveBelow(this._weaponOverlay, this._sheetSprite);
      } else {
        this.bodyGroup.moveAbove(this._weaponOverlay, this._sheetSprite);
      }
    }

    // 6. Debug dot — toggle with window.__WEAPON_DEBUG = true
    if (this._weaponDebug) {
      const on = (window as any).__WEAPON_DEBUG;
      this._weaponDebug.setVisible(!!on);
      if (on) {
        this._weaponDebug.clear();
        this._weaponDebug.fillStyle(0xff0000, 1);
        this._weaponDebug.fillCircle(sx, sy, 3);
      }
    }
  }

  /** Phase accumulator for the running cycle (in ms) */
  private runCycleTime = 0;

  // ===== Cape wind trailing =====
  private capeNode: Phaser.GameObjects.Image | null = null;
  /** Smoothed trailing rotation added on top of wind tweens */
  private capeTrailRotation = 0;

  // ===== Locomotion / animation polish state =====
  /** Smoothed horizontal velocity for accel/decel feel (px/s) */
  private smoothedVx = 0;
  private smoothedVy = 0;
  /** Accumulated time used for idle breath / run bob / etc. */
  private idleBreathTime = 0;
  /** Tracks the previous facing direction so we can detect quick reverses for the turn state */
  private prevFacingRight = true;
  /** Vertical bob offset added to bodyGroup.y on top of the jumpZ */
  private bodyBobOffset = 0;
  /** Vertical compression applied to legs (squat/landing) — pushes upper body down */
  private bodyCompression = 0;
  /** Lateral hip shift (px). Drives weight transfer side to side during the run cycle. */
  private hipLateralShift = 0;
  /** Active when reversing direction quickly — drives a brief counter-lean turn pose */
  private turnTimer = 0;
  /** Sign of the turn direction (+1 turning right, -1 turning left) */
  private turnDir = 0;
  /** Jump phase state */
  private jumpPhase: 'grounded' | 'squat' | 'rising' | 'falling' | 'landing' = 'grounded';
  private jumpPhaseTimer = 0;
  /** True after a jump key press while airborne — used for jump buffering */
  private jumpBufferTimer = 0;
  /** Coyote time after walking off a ledge */
  private coyoteTimer = 0;
  /** Tracks the maximum fall speed of the current jump for landing impact */
  private maxFallSpeed = 0;

  // Level-based HP scaling: +20 max HP per level above 1
  /** HP gained per level. Reduced from 20 → 12 so the hero doesn't massively
   *  outscale enemy damage by mid-game. */
  static readonly HP_PER_LEVEL = 12;
  heroLevel = 1;

  constructor(
    scene: Phaser.Scene, x: number, groundY: number,
    stats?: Partial<HeroStats>, color?: number, accent?: number,
    attackType: AttackType = 'melee',
    heroClassId: string = '',
    heroLevel: number = 1,
    /** When true, skip all keyboard input and gameplay state machine setup —
     *  used for static portraits on the hero select / character name screens
     *  so the WASD/J/Space keys aren't captured (which would block HTML inputs). */
    displayOnly: boolean = false,
  ) {
    super(scene, x, groundY);
    this.scene = scene;
    this.stats = { ...DEFAULT_STATS, ...stats };
    this.heroLevel = heroLevel;

    // Apply level-based HP bonus
    const hpBonus = (this.heroLevel - 1) * Hero.HP_PER_LEVEL;
    this.stats.maxHealth += hpBonus;
    this.currentHealth = this.stats.maxHealth;
    this.groundY = groundY;
    this.baseColor = color ?? 0x3366cc;
    this.accentColor = accent ?? 0xffffff;
    this.attackType = attackType;
    this.heroClassId = heroClassId;

    // Shadow — soft 3-layer drop shadow built later by attachVisualParts
    // (so the visual builder can choose tint per-class). Default to a flat
    // ellipse for classes that haven't migrated yet.
    this.shadow = scene.add.ellipse(0, 0, 28, 10, 0x000000, 0.3);
    this.add(this.shadow);
    this.shadowScaleRoot = this.shadow as unknown as typeof this.shadowScaleRoot;

    // Body group
    this.bodyGroup = scene.add.container(0, 0);
    this.add(this.bodyGroup);

    // ===== Visual builder dispatch =====
    // Migrated classes go through the src/visuals/ layer (procedural now,
    // sprite-swappable later). Unmigrated classes still use their inline
    // builders inside this file.
    const externalBuilder = getHeroVisualBuilder(heroClassId);
    if (externalBuilder) {
      const parts = externalBuilder(scene, this.bodyGroup);
      this.attachVisualParts(scene, parts);
    } else {
      switch (heroClassId) {
        case 'necromancer':    this.buildNecromancerVisual(scene); break;
        case 'barbarian':      this.buildBarbarianVisual(scene); break;
        case 'templar_knight': this.buildTemplarVisual(scene); break;
        case 'mage':           this.buildMageVisual(scene); break;
        case 'archer':         this.buildArcherVisual(scene); break;
        default:               this.buildDefaultVisual(scene); break;
      }
    }

    // Class-specific aura glow
    const auraColors: Record<string, number> = {
      necromancer:    0x22ff66,  // sickly green
      paladin:        0xffeeaa,  // golden
      barbarian:      0xff5522,  // fiery red
      templar_knight: 0x66aaff,  // azure
      mage:           0xaa66ff,  // arcane purple
      archer:         0x66ff99,  // forest green
    };
    const auraColor = auraColors[heroClassId];
    if (auraColor !== undefined) {
      const aura = scene.add.circle(0, -20, 22, auraColor, 0.08);
      this.bodyGroup.add(aura);
      scene.tweens.add({
        targets: aura,
        scaleX: 1.3, scaleY: 1.3, alpha: 0.03,
        duration: 1200, yoyo: true, repeat: -1,
      });
    }

    // Physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 14);
    body.setOffset(-14, -7);

    if (displayOnly) {
      // Disable physics body and skip keyboard input + state machine for portrait usage.
      // Without this, addKey() on WASD/J/SPACE captures those keys at the Phaser level
      // and prevents them from reaching HTML <input> elements on the same page.
      body.enable = false;
      // Provide stub keys so any code that touches `this.keys` doesn't crash
      this.keys = {} as Hero['keys'];
      this.sm = new StateMachine();
      // No states added — the static portrait never updates
      return;
    }

    // Input — J key for basic attack
    this.keys = {
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      attack: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J),
    };

    // State machine
    this.sm = new StateMachine();
    this.sm.addState(this.createIdleState());
    this.sm.addState(this.createRunState());

    if (this.attackType === 'projectile') {
      this.sm.addState(this.createCastState());
    } else {
      this.sm.addState(this.createMeleeAttackState());
    }

    this.sm.addState(this.createHurtState());
    this.sm.addState(this.createDeathState());
    this.sm.transition('idle');

    // Listen for level-ups to increase HP
    EventBus.on(Events.HERO_LEVELED_UP, this.onLevelUp, this);

    EventBus.emit(Events.HERO_HEALTH_CHANGED, this.currentHealth, this.stats.maxHealth);
  }

  private onLevelUp = (_newLevel: number): void => {
    if (this.isDead) return;
    this.heroLevel++;
    this.stats.maxHealth += Hero.HP_PER_LEVEL;
    // Heal the bonus amount (don't full heal, just add the new HP)
    this.currentHealth += Hero.HP_PER_LEVEL;
    EventBus.emit(Events.HERO_HEALTH_CHANGED, this.currentHealth, this.stats.maxHealth);
  };

  private buildDefaultVisual(scene: Phaser.Scene): void {
    // Generic hero rectangle
    this.sprite = scene.add.rectangle(0, -20, 28, 44, this.baseColor);
    this.bodyGroup.add(this.sprite);

    // Eyes
    const eye = scene.add.rectangle(6, -28, 4, 4, this.accentColor);
    this.bodyGroup.add(eye);

    // Weapon
    const weapon = scene.add.rectangle(16, -18, 6, 16, 0x888888);
    this.bodyGroup.add(weapon);
  }

  /**
   * Receive a visual parts bundle from an external visual builder.
   * Migrated classes call this from their dispatch path; legacy inline
   * builders set fields directly. Either way, the same animation joints
   * end up populated on this Hero instance.
   *
   * Also upgrades the flat shadow ellipse to a soft 3-layer drop shadow
   * tinted per the builder's preference.
   */
  attachVisualParts(scene: Phaser.Scene, parts: HeroVisualParts): void {
    this.sprite = parts.sprite;
    this.upperBodyPivot = parts.upperBodyPivot ?? null;
    this.upperBodyInner = parts.upperBodyInner ?? null;
    this.headPivot = parts.headPivot ?? null;
    this.headBaseX = parts.headBaseX ?? 0;
    this.headBaseY = parts.headBaseY ?? 0;
    this.shoulderNode = parts.shoulderNode ?? null;
    this.swordNode = parts.swordNode ?? null;
    this.backArmNode = parts.backArmNode ?? null;
    this.legLeftPivot = parts.legLeftPivot ?? null;
    this.legLeftKnee = parts.legLeftKnee ?? null;
    this.legRightPivot = parts.legRightPivot ?? null;
    this.legRightKnee = parts.legRightKnee ?? null;
    this.defaultSwordVisuals = parts.defaultSwordVisuals ?? null;
    if (parts.defaultWeaponVisuals) {
      this.defaultWeaponVisuals = parts.defaultWeaponVisuals;
    }
    this.capeNode = parts.capeNode ?? null;

    // Check if we have a spritesheet-animated character
    this._sheetSprite = (this.bodyGroup as any).__paladinSprite ?? null;
    this._sheetAnims = (this.bodyGroup as any).__paladinAnims ?? null;
    this._weaponOverlay = (this.bodyGroup as any).__weaponOverlay ?? null;
    this._weaponDebug = (this.bodyGroup as any).__weaponDebug ?? null;

    // Wire up per-frame weapon anchor alignment
    if (this._sheetSprite && this._weaponOverlay) {
      this._sheetSprite.on('animationupdate', this.updateWeaponOverlay, this);
    }

    // ----- SWAP THE FLAT SHADOW FOR A SOFT 3-LAYER DROP SHADOW -----
    // The Hero container holds the old shadow ellipse at index 0. Replace it
    // in place so the rest of the constructor logic (jumpZ scaling) still
    // operates on `this.shadow` — we point it at the new core ellipse.
    const oldShadow = this.shadow;
    this.remove(oldShadow);
    oldShadow.destroy();
    const tint = parts.shadowColor ?? 0x000000;
    const soft = createSoftShadow(scene, 30, 9, tint);
    if (parts.shadowAlpha !== undefined) soft.core.alpha = parts.shadowAlpha;
    this.addAt(soft.root, 0);
    this.shadow = soft.core;
    this.shadowScaleRoot = soft.root as unknown as typeof this.shadowScaleRoot;
  }

  /** Set the equipped weapon by ID — replaces the held weapon visual on the hero */
  setEquippedWeapon(weaponId: string | undefined): void {
    // Remove old custom visuals
    for (const obj of this.heldWeaponVisuals) obj.destroy();
    this.heldWeaponVisuals = [];

    // Spritesheet paladin: use the anchor-based weapon overlay system
    if (this._sheetSprite && this._weaponOverlay) {
      if (weaponId) {
        const texKey = WEAPON_TEXTURES[weaponId];
        if (texKey && this.scene.textures.exists(texKey)) {
          this._weaponOverlay.setTexture(texKey);
          this._weaponOverlay.setVisible(true);
          this._weaponOverlay.setScale(0.55);
          this._weaponOverlay.texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
          // Set grip point for this weapon (used in updateWeaponOverlay)
          this._currentGrip = WEAPON_GRIPS[weaponId] ?? DEFAULT_GRIP;
        }
      } else {
        this._weaponOverlay.setVisible(false);
      }
      return;
    }

    if (!weaponId) {
      // No weapon equipped — show defaults
      for (const obj of this.defaultWeaponVisuals) (obj as unknown as { visible: boolean }).visible = true;
      if (this.defaultSwordVisuals) this.defaultSwordVisuals.visible = true;
      return;
    }

    // Hide default visuals when a custom weapon is equipped
    for (const obj of this.defaultWeaponVisuals) (obj as unknown as { visible: boolean }).visible = false;
    if (this.defaultSwordVisuals) this.defaultSwordVisuals.visible = false;

    // ===== PALADIN — equipped weapons attach to the swordNode so they rotate
    // with the moulinet animation. The arm and shield are always visible because
    // they live outside defaultWeaponVisuals; only defaultSwordVisuals was hidden. =====
    if (this.heroClassId === 'paladin' && this.swordNode) {

      // Per-weapon vertical offset so the grip aligns with the hand position
      // (the swordNode origin = the hand). The maces/hammers have their haft
      // drawn with the pommel near the BOTTOM of the icon. We push the icon
      // strongly upward (negative y) so the hand grips near the pommel — i.e.
      // LOW on the pole — and the mace head sits just above the paladin's helm.
      const offsets: Record<string, { y: number; scale: number }> = {
        oak_mace:         { y: -16, scale: 1.0 },
        iron_mace:        { y: -16, scale: 1.0 },
        morning_star:     { y: -16, scale: 1.0 },
        warhammer:        { y: -8, scale: 1.0 },
        consecrated_mace: { y: -16, scale: 1.0 },
        sunfire_hammer:   { y: -16, scale: 1.05 },
        aegis_breaker:    { y: -16, scale: 1.05 },
        divine_judge:     { y: -16, scale: 1.1 },
        avenger:          { y: -16, scale: 1.1 },
        lights_aurora:    { y: -16, scale: 1.15 },
      };
      const o = offsets[weaponId] ?? { y: -16, scale: 1.0 };

      // Wrap in a rotated container so weapons are held horizontally.
      const weaponSub = this.scene.add.container(0, 0);
      weaponSub.angle = 90;
      this.swordNode.add(weaponSub);
      this.heldWeaponVisuals.push(weaponSub);

      const parts = drawWeaponIcon(this.scene, weaponId, 0, o.y, o.scale, { held: true });
      for (const part of parts) {
        weaponSub.add(part);
      }
      return;
    }

    // ===== Other classes (necromancer, etc.) — equip into bodyGroup at the placement
    // table position. These weapons don't have a swing animation. =====
    const placement: Record<string, { x: number; y: number; scale: number }> = {
      bone_wand:          { x: 18, y: -18, scale: 1.1 },
      skull_staff:        { x: 18, y: -18, scale: 1.1 },
      cursed_tome:        { x: 4, y: -22, scale: 1.0 },  // held in one hand, slightly off-center
      scythe_of_decay:    { x: 18, y: -18, scale: 1.0 },
      lich_crook:         { x: 18, y: -18, scale: 1.05 },
      phylactery:         { x: 16, y: -14, scale: 0.7 },   // smaller jar held in hand
      bonewalker_ribcage: { x: 16, y: -16, scale: 0.85 },
      soulrender:         { x: 18, y: -16, scale: 1.0 },
      deaths_embrace:     { x: 18, y: -16, scale: 1.0 },
      apex_reliquary:     { x: 16, y: -14, scale: 0.85 },
    };
    const p = placement[weaponId] ?? { x: 18, y: -18, scale: 1.1 };

    const parts = drawWeaponIcon(this.scene, weaponId, p.x, p.y, p.scale, {
      open: weaponId === 'cursed_tome',
      held: true,
    });
    for (const part of parts) {
      this.bodyGroup.add(part);
      this.bodyGroup.bringToTop(part);
      this.heldWeaponVisuals.push(part);
    }

    // For the tome, add a single hand cradling the book from underneath
    if (weaponId === 'cursed_tome') {
      const hand = this.scene.add.circle(p.x, p.y + 5, 2.5, 0xccddbb);
      this.bodyGroup.add(hand);
      this.bodyGroup.bringToTop(hand);
      this.heldWeaponVisuals.push(hand);
    }
  }

  private buildNecromancerVisual(scene: Phaser.Scene): void {
    // Dark hooded robe — wider at bottom (trapezoid via two rects)
    const robeBottom = scene.add.rectangle(0, -10, 30, 24, 0x1a1a22);
    this.bodyGroup.add(robeBottom);
    const robeTop = scene.add.rectangle(0, -28, 24, 18, 0x222233);
    this.bodyGroup.add(robeTop);

    // Hood (dark arc over the head)
    const hood = scene.add.circle(0, -38, 13, 0x111118);
    this.bodyGroup.add(hood);

    // Skull face — pale bone color
    const skull = scene.add.circle(0, -36, 8, 0xccddbb);
    this.bodyGroup.add(skull);

    // Dark eye sockets
    const eyeSocketL = scene.add.circle(-3, -38, 2.5, 0x111111);
    this.bodyGroup.add(eyeSocketL);
    const eyeSocketR = scene.add.circle(3, -38, 2.5, 0x111111);
    this.bodyGroup.add(eyeSocketR);

    // Glowing green eyes
    const eyeL = scene.add.circle(-3, -38, 1.5, 0x44ff66);
    this.bodyGroup.add(eyeL);
    const eyeR = scene.add.circle(3, -38, 1.5, 0x44ff66);
    this.bodyGroup.add(eyeR);

    // Eye glow pulse
    scene.tweens.add({
      targets: [eyeL, eyeR],
      alpha: 0.4, duration: 800, yoyo: true, repeat: -1,
    });

    // Jaw/teeth line
    const jaw = scene.add.rectangle(0, -33, 6, 2, 0x999988);
    this.bodyGroup.add(jaw);

    // Robe trim — green accent lines
    const trimL = scene.add.rectangle(-10, -16, 2, 20, 0x22aa55, 0.4);
    this.bodyGroup.add(trimL);
    const trimR = scene.add.rectangle(10, -16, 2, 20, 0x22aa55, 0.4);
    this.bodyGroup.add(trimR);

    // Belt / buckle
    const belt = scene.add.rectangle(0, -18, 20, 3, 0x334422);
    this.bodyGroup.add(belt);
    const buckle = scene.add.rectangle(0, -18, 4, 4, 0x44ff66, 0.6);
    this.bodyGroup.add(buckle);

    // Staff (held to the side)
    const staff = scene.add.rectangle(16, -26, 3, 36, 0x443322);
    this.bodyGroup.add(staff);
    this.defaultWeaponVisuals.push(staff);

    // Staff top orb — green glow
    const staffOrb = scene.add.circle(16, -44, 5, 0x33ff55, 0.7);
    this.bodyGroup.add(staffOrb);
    this.defaultWeaponVisuals.push(staffOrb);
    const staffGlow = scene.add.circle(16, -44, 8, 0x22ff44, 0.15);
    this.bodyGroup.add(staffGlow);
    this.defaultWeaponVisuals.push(staffGlow);
    scene.tweens.add({
      targets: staffGlow,
      scaleX: 1.5, scaleY: 1.5, alpha: 0.05,
      duration: 1000, yoyo: true, repeat: -1,
    });

    // Lantern on the other side (small)
    const lanternChain = scene.add.rectangle(-14, -30, 1, 8, 0x555555);
    this.bodyGroup.add(lanternChain);
    const lanternBody = scene.add.rectangle(-14, -24, 6, 8, 0x333333);
    this.bodyGroup.add(lanternBody);
    const lanternGlow = scene.add.circle(-14, -24, 3, 0x44ff88, 0.5);
    this.bodyGroup.add(lanternGlow);
    scene.tweens.add({
      targets: lanternGlow,
      alpha: 0.2, duration: 600, yoyo: true, repeat: -1, delay: 300,
    });

    // The sprite rect is used for color flashing in states — make it the robe
    this.sprite = robeTop;

    // Green shadow instead of black
    this.shadow.fillColor = 0x114422;
    this.shadow.alpha = 0.4;
  }

  // ==================== PALADIN ====================
  // MIGRATED to src/visuals/procedural/paladin.ts via the visuals dispatch
  // layer. The constructor's externalBuilder path handles paladin entirely.
  // The historical inline builder has been removed; the dispatch in the
  // constructor now routes 'paladin' through src/visuals/index.ts.
  // (legacy paladin builder removed — see src/visuals/procedural/paladin.ts)

  // ==================== BARBARIAN ====================
  // Inspired by Conan, Diablo barbarian, Castle Crashers Red Knight — bare chested,
  // fur kilt, wild red hair, war paint, horned helmet, massive double-bladed axe.
  private buildBarbarianVisual(scene: Phaser.Scene): void {
    // Fur cape behind body
    this.bodyGroup.add(scene.add.rectangle(0, -22, 22, 26, 0x554433, 0.85));
    // Bare muscular legs (skin tone)
    this.bodyGroup.add(scene.add.rectangle(-5, -4, 8, 12, 0xcc9966));
    this.bodyGroup.add(scene.add.rectangle(5, -4, 8, 12, 0xcc9966));
    // Fur boots
    this.bodyGroup.add(scene.add.rectangle(-5, 4, 10, 5, 0x664422));
    this.bodyGroup.add(scene.add.rectangle(5, 4, 10, 5, 0x664422));
    // Cross-strap leg wraps
    this.bodyGroup.add(scene.add.rectangle(-5, -2, 10, 0.8, 0x442211));
    this.bodyGroup.add(scene.add.rectangle(5, -2, 10, 0.8, 0x442211));
    this.bodyGroup.add(scene.add.rectangle(-5, -6, 10, 0.8, 0x442211));
    this.bodyGroup.add(scene.add.rectangle(5, -6, 10, 0.8, 0x442211));
    // Fur loincloth (front-center hangs lower)
    this.bodyGroup.add(scene.add.rectangle(0, -10, 14, 12, 0x664422));
    this.bodyGroup.add(scene.add.rectangle(0, -8, 12, 8, 0x886644));
    // Belt with skull buckle
    this.bodyGroup.add(scene.add.rectangle(0, -16, 26, 3, 0x442211));
    this.bodyGroup.add(scene.add.circle(0, -16, 2.5, 0xeeddbb));  // skull buckle
    this.bodyGroup.add(scene.add.circle(-1, -16, 0.6, 0x111111)); // eye
    this.bodyGroup.add(scene.add.circle(1, -16, 0.6, 0x111111));  // eye
    // Bare massive chest (skin tone)
    const chest = scene.add.rectangle(0, -24, 32, 16, 0xcc9966);
    this.bodyGroup.add(chest);
    // Pec muscle highlights
    this.bodyGroup.add(scene.add.rectangle(-6, -22, 12, 4, 0xddaa77));
    this.bodyGroup.add(scene.add.rectangle(6, -22, 12, 4, 0xddaa77));
    this.bodyGroup.add(scene.add.rectangle(0, -22, 0.8, 8, 0x884422));
    // Battle scar across chest (diagonal)
    this.bodyGroup.add(scene.add.rectangle(-2, -23, 16, 1, 0x882233).setRotation(-0.3));
    // War paint stripes (red)
    this.bodyGroup.add(scene.add.rectangle(-8, -25, 4, 0.8, 0xcc2222));
    this.bodyGroup.add(scene.add.rectangle(8, -25, 4, 0.8, 0xcc2222));
    // Massive shoulders / biceps
    this.bodyGroup.add(scene.add.circle(-15, -28, 6, 0xcc9966));
    this.bodyGroup.add(scene.add.circle(15, -28, 6, 0xcc9966));
    // Spiked iron bracers
    this.bodyGroup.add(scene.add.rectangle(-15, -16, 6, 7, 0x444455));
    this.bodyGroup.add(scene.add.rectangle(15, -16, 6, 7, 0x444455));
    // Bracer spikes
    this.bodyGroup.add(scene.add.triangle(-18, -19, 0, -2, 2, 0, 0, 0, 0x888899));
    this.bodyGroup.add(scene.add.triangle(-18, -15, 0, -2, 2, 0, 0, 0, 0x888899));
    this.bodyGroup.add(scene.add.triangle(18, -19, 0, -2, -2, 0, 0, 0, 0x888899));
    this.bodyGroup.add(scene.add.triangle(18, -15, 0, -2, -2, 0, 0, 0, 0x888899));
    // ----- BULL HEAD -----
    // Skull/head main shape — wider at the top, tapering to a narrower snout below
    // Top crown of the bull head (broad)
    this.bodyGroup.add(scene.add.ellipse(0, -42, 26, 16, 0x332211).setStrokeStyle(0.6, 0x110000));
    // Forehead highlight (lighter brown)
    this.bodyGroup.add(scene.add.ellipse(0, -45, 20, 6, 0x4a2f1a));
    // Long bull snout extending downward
    this.bodyGroup.add(scene.add.ellipse(0, -32, 18, 14, 0x332211).setStrokeStyle(0.6, 0x110000));
    // Lighter snout patch on the muzzle
    this.bodyGroup.add(scene.add.ellipse(0, -30, 14, 8, 0x553322));
    // Nostrils (two dark dots on the snout)
    this.bodyGroup.add(scene.add.ellipse(-3, -30, 2.5, 1.6, 0x000000));
    this.bodyGroup.add(scene.add.ellipse(3, -30, 2.5, 1.6, 0x000000));
    // Mouth slit
    this.bodyGroup.add(scene.add.rectangle(0, -26, 8, 0.8, 0x000000));
    // Bull ears flopping out the sides
    this.bodyGroup.add(scene.add.ellipse(-15, -42, 6, 8, 0x332211).setStrokeStyle(0.5, 0x110000));
    this.bodyGroup.add(scene.add.ellipse(15, -42, 6, 8, 0x332211).setStrokeStyle(0.5, 0x110000));
    // Ear inner pink
    this.bodyGroup.add(scene.add.ellipse(-15, -42, 3, 4, 0x884433));
    this.bodyGroup.add(scene.add.ellipse(15, -42, 3, 4, 0x884433));
    // ----- HUGE CURVED HORNS sweeping outward and slightly up -----
    // Left horn (pale bone, curving from temple out and up)
    const hornLeft = scene.add.graphics();
    hornLeft.fillStyle(0xeeddbb, 1);
    hornLeft.fillTriangle(-13, -47, -24, -54, -10, -42);
    hornLeft.fillStyle(0xffeebb, 1);
    hornLeft.fillTriangle(-13, -47, -22, -52, -16, -50);
    hornLeft.lineStyle(0.6, 0x553311, 1);
    hornLeft.strokeTriangle(-13, -47, -24, -54, -10, -42);
    // Horn dark base ring
    hornLeft.fillStyle(0x442211, 1);
    hornLeft.fillCircle(-13, -47, 1.6);
    this.bodyGroup.add(hornLeft);
    // Right horn (mirrored)
    const hornRight = scene.add.graphics();
    hornRight.fillStyle(0xeeddbb, 1);
    hornRight.fillTriangle(13, -47, 24, -54, 10, -42);
    hornRight.fillStyle(0xffeebb, 1);
    hornRight.fillTriangle(13, -47, 22, -52, 16, -50);
    hornRight.lineStyle(0.6, 0x553311, 1);
    hornRight.strokeTriangle(13, -47, 24, -54, 10, -42);
    hornRight.fillStyle(0x442211, 1);
    hornRight.fillCircle(13, -47, 1.6);
    this.bodyGroup.add(hornRight);
    // ----- GLOWING RED EYES -----
    // Outer red glow
    const eyeGlowL = scene.add.circle(-5, -42, 3.5, 0xff0000, 0.55);
    const eyeGlowR = scene.add.circle(5, -42, 3.5, 0xff0000, 0.55);
    this.bodyGroup.add(eyeGlowL);
    this.bodyGroup.add(eyeGlowR);
    // Bright red iris
    const eyeL = scene.add.circle(-5, -42, 1.8, 0xff2222);
    const eyeR = scene.add.circle(5, -42, 1.8, 0xff2222);
    this.bodyGroup.add(eyeL);
    this.bodyGroup.add(eyeR);
    // Hot white center
    this.bodyGroup.add(scene.add.circle(-5, -42, 0.8, 0xffeecc));
    this.bodyGroup.add(scene.add.circle(5, -42, 0.8, 0xffeecc));
    // Pulsing red glow tween
    scene.tweens.add({
      targets: [eyeGlowL, eyeGlowR],
      alpha: 0.25,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
    // Tiny eye glint to make them feel alive
    scene.tweens.add({
      targets: [eyeL, eyeR],
      alpha: 0.7,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
    // Neck — thick brown band joining bull head to chest
    this.bodyGroup.add(scene.add.rectangle(0, -22, 12, 4, 0x332211));

    // Default weapon: massive double-bladed axe over the right shoulder
    const axeShaft = scene.add.rectangle(18, -22, 3, 32, 0x442211);
    this.bodyGroup.add(axeShaft);
    this.defaultWeaponVisuals.push(axeShaft);
    // Top double blade
    const axeHead = scene.add.graphics();
    axeHead.fillStyle(0xbbbbcc, 1);
    axeHead.fillTriangle(18, -38, 28, -32, 18, -28);  // right blade
    axeHead.fillTriangle(18, -38, 8, -32, 18, -28);   // left blade
    axeHead.lineStyle(0.8, 0x222233, 1);
    axeHead.strokeTriangle(18, -38, 28, -32, 18, -28);
    axeHead.strokeTriangle(18, -38, 8, -32, 18, -28);
    this.bodyGroup.add(axeHead);
    this.defaultWeaponVisuals.push(axeHead);
    // Center metal sleeve
    const sleeve = scene.add.rectangle(18, -34, 5, 6, 0x444455);
    this.bodyGroup.add(sleeve);
    this.defaultWeaponVisuals.push(sleeve);

    this.sprite = chest;
    this.shadow.fillColor = 0x331100;
    this.shadow.alpha = 0.4;
  }

  // ==================== TEMPLAR KNIGHT ====================
  // Inspired by medieval crusader knights — heavy dark plate, rectangular great helm
  // with cross-slit visor, white tabard with blue cross, kite shield, two-handed sword.
  private buildTemplarVisual(scene: Phaser.Scene): void {
    // Long blue cape behind body
    this.bodyGroup.add(scene.add.rectangle(0, -16, 26, 36, 0x224477, 0.9));
    this.bodyGroup.add(scene.add.rectangle(0, 0, 28, 4, 0x336699, 0.9));
    // Plate legs (dark steel)
    this.bodyGroup.add(scene.add.rectangle(-5, -6, 9, 14, 0x556677).setStrokeStyle(0.6, 0x222244));
    this.bodyGroup.add(scene.add.rectangle(5, -6, 9, 14, 0x556677).setStrokeStyle(0.6, 0x222244));
    // Knee guards
    this.bodyGroup.add(scene.add.circle(-5, -8, 3, 0x778899));
    this.bodyGroup.add(scene.add.circle(5, -8, 3, 0x778899));
    // Sabaton boots
    this.bodyGroup.add(scene.add.rectangle(-5, 4, 11, 4, 0x444466));
    this.bodyGroup.add(scene.add.rectangle(5, 4, 11, 4, 0x444466));
    // Plate torso
    const torso = scene.add.rectangle(0, -22, 30, 22, 0x778899).setStrokeStyle(0.8, 0x222244);
    this.bodyGroup.add(torso);
    // Chainmail showing at sides
    this.bodyGroup.add(scene.add.rectangle(-13, -22, 3, 20, 0x555566));
    this.bodyGroup.add(scene.add.rectangle(13, -22, 3, 20, 0x555566));
    // Long white tabard down the front (extends below the belt)
    this.bodyGroup.add(scene.add.rectangle(0, -18, 14, 28, 0xf5f5f5));
    // Blue cross emblem (large)
    this.bodyGroup.add(scene.add.rectangle(0, -18, 4, 18, 0x224488));
    this.bodyGroup.add(scene.add.rectangle(0, -22, 12, 4, 0x224488));
    // Belt with steel buckle
    this.bodyGroup.add(scene.add.rectangle(0, -10, 22, 3, 0x442211));
    this.bodyGroup.add(scene.add.rectangle(0, -10, 4, 4, 0x888899));
    // Big rectangular pauldrons
    this.bodyGroup.add(scene.add.rectangle(-14, -29, 8, 6, 0x778899).setStrokeStyle(0.6, 0x222244));
    this.bodyGroup.add(scene.add.rectangle(14, -29, 8, 6, 0x778899).setStrokeStyle(0.6, 0x222244));
    // Pauldron rivets
    this.bodyGroup.add(scene.add.circle(-15, -30, 0.6, 0xaabbcc));
    this.bodyGroup.add(scene.add.circle(-13, -30, 0.6, 0xaabbcc));
    this.bodyGroup.add(scene.add.circle(13, -30, 0.6, 0xaabbcc));
    this.bodyGroup.add(scene.add.circle(15, -30, 0.6, 0xaabbcc));
    // Gauntlets
    this.bodyGroup.add(scene.add.rectangle(-15, -16, 5, 6, 0x556677).setStrokeStyle(0.4, 0x222244));
    this.bodyGroup.add(scene.add.rectangle(15, -16, 5, 6, 0x556677).setStrokeStyle(0.4, 0x222244));
    // Chainmail at neck
    this.bodyGroup.add(scene.add.rectangle(0, -34, 16, 4, 0x666677));
    // Great helm — tall rectangular bucket helm
    this.bodyGroup.add(scene.add.rectangle(0, -42, 22, 22, 0x778899).setStrokeStyle(0.8, 0x222244));
    // Tapered top (slightly narrower at top)
    this.bodyGroup.add(scene.add.rectangle(0, -52, 18, 4, 0x666677));
    // Horizontal sight slit
    this.bodyGroup.add(scene.add.rectangle(0, -42, 16, 1.5, 0x111122));
    // Vertical breathing slits (3 on each side of the cross)
    this.bodyGroup.add(scene.add.rectangle(-4, -38, 0.8, 4, 0x111122));
    this.bodyGroup.add(scene.add.rectangle(0, -38, 0.8, 4, 0x111122));
    this.bodyGroup.add(scene.add.rectangle(4, -38, 0.8, 4, 0x111122));
    // Cross emblem on the front of the helm
    this.bodyGroup.add(scene.add.rectangle(0, -47, 1.5, 6, 0x224488));
    this.bodyGroup.add(scene.add.rectangle(0, -49, 4, 1.5, 0x224488));
    // Helm rivets
    for (const x of [-9, 9]) {
      this.bodyGroup.add(scene.add.circle(x, -50, 0.7, 0xaabbcc));
      this.bodyGroup.add(scene.add.circle(x, -34, 0.7, 0xaabbcc));
    }

    // Default weapon — large two-handed longsword on the right
    const sword = scene.add.rectangle(17, -22, 4, 32, 0xddeeff).setStrokeStyle(0.6, 0x444466);
    this.bodyGroup.add(sword);
    this.defaultWeaponVisuals.push(sword);
    // Center fuller
    this.defaultWeaponVisuals.push(scene.add.rectangle(17, -22, 0.8, 30, 0xffffff, 0.6));
    this.bodyGroup.add(this.defaultWeaponVisuals[this.defaultWeaponVisuals.length - 1]);
    // Crossguard (long, wide, gold)
    const crossguard = scene.add.rectangle(17, -6, 16, 3, 0xccaa44).setStrokeStyle(0.4, 0x664422);
    this.bodyGroup.add(crossguard);
    this.defaultWeaponVisuals.push(crossguard);
    // Pommel (round)
    const pommel = scene.add.circle(17, 2, 2.4, 0xccaa44).setStrokeStyle(0.4, 0x664422);
    this.bodyGroup.add(pommel);
    this.defaultWeaponVisuals.push(pommel);
    // Hilt wrapping
    const hilt = scene.add.rectangle(17, -2, 2.5, 7, 0x442211);
    this.bodyGroup.add(hilt);
    this.defaultWeaponVisuals.push(hilt);

    this.sprite = torso;
    this.shadow.fillColor = 0x223344;
    this.shadow.alpha = 0.4;
  }

  // ==================== MAGE ====================
  // Inspired by Gandalf, Merlin, classic D&D wizards — long flowing blue robe with stars,
  // pointed wizard hat, long white beard, glowing crystal staff.
  private buildMageVisual(scene: Phaser.Scene): void {
    // Long flowing robe — wider at bottom (like a bell)
    // Bottom hem (widest)
    this.bodyGroup.add(scene.add.rectangle(0, 0, 36, 6, 0x224488));
    // Lower robe (sloped — render as overlapping rects)
    this.bodyGroup.add(scene.add.rectangle(0, -4, 32, 8, 0x224488).setStrokeStyle(0.6, 0x112244));
    this.bodyGroup.add(scene.add.rectangle(0, -10, 28, 8, 0x2a4488));
    // Mid robe
    this.bodyGroup.add(scene.add.rectangle(0, -18, 26, 10, 0x335599));
    // Upper robe / chest
    this.bodyGroup.add(scene.add.rectangle(0, -26, 22, 8, 0x335599).setStrokeStyle(0.6, 0x112244));
    // Star runes on the robe (gold sparkles)
    this.bodyGroup.add(scene.add.circle(-7, -14, 1.2, 0xffdd44));
    this.bodyGroup.add(scene.add.circle(7, -10, 1.2, 0xffdd44));
    this.bodyGroup.add(scene.add.circle(-4, -6, 1, 0xffdd44));
    this.bodyGroup.add(scene.add.circle(5, -4, 1, 0xffdd44));
    this.bodyGroup.add(scene.add.circle(-9, -22, 1, 0xffdd44));
    this.bodyGroup.add(scene.add.circle(8, -22, 1, 0xffdd44));
    // Crescent moon emblem on chest
    this.bodyGroup.add(scene.add.circle(0, -22, 2.5, 0xffeebb));
    this.bodyGroup.add(scene.add.circle(1, -22, 2, 0x335599));
    // Belt with pouches
    this.bodyGroup.add(scene.add.rectangle(0, -16, 24, 2.5, 0x442211));
    this.bodyGroup.add(scene.add.rectangle(-7, -14, 3, 4, 0x553322));
    this.bodyGroup.add(scene.add.rectangle(7, -14, 3, 4, 0x553322));
    // Wide robe sleeves
    this.bodyGroup.add(scene.add.rectangle(-14, -22, 6, 12, 0x335599));
    this.bodyGroup.add(scene.add.rectangle(14, -22, 6, 12, 0x335599));
    // Sleeve cuffs (gold)
    this.bodyGroup.add(scene.add.rectangle(-14, -16, 7, 1.5, 0xddcc44));
    this.bodyGroup.add(scene.add.rectangle(14, -16, 7, 1.5, 0xddcc44));
    // Hands peeking out (skin tone)
    this.bodyGroup.add(scene.add.circle(-14, -13, 2, 0xddccaa));
    this.bodyGroup.add(scene.add.circle(14, -13, 2, 0xddccaa));
    // Face — old wizard
    const face = scene.add.circle(0, -36, 8, 0xddccaa);
    this.bodyGroup.add(face);
    // Bushy white eyebrows
    this.bodyGroup.add(scene.add.rectangle(-3, -39, 4, 1.2, 0xeeeeee));
    this.bodyGroup.add(scene.add.rectangle(3, -39, 4, 1.2, 0xeeeeee));
    // Wise eyes
    this.bodyGroup.add(scene.add.circle(-3, -37, 1, 0x222244));
    this.bodyGroup.add(scene.add.circle(3, -37, 1, 0x222244));
    // Bulbous nose
    this.bodyGroup.add(scene.add.circle(0, -34, 1.5, 0xcc9988));
    // LONG flowing white beard (extends down to the chest)
    this.bodyGroup.add(scene.add.rectangle(0, -28, 11, 12, 0xeeeeee));
    this.bodyGroup.add(scene.add.rectangle(0, -22, 8, 8, 0xeeeeee));
    this.bodyGroup.add(scene.add.rectangle(0, -16, 5, 4, 0xeeeeee));
    this.bodyGroup.add(scene.add.circle(0, -14, 2, 0xdddddd));
    // Mustache
    this.bodyGroup.add(scene.add.rectangle(-3, -33, 3, 1.5, 0xeeeeee));
    this.bodyGroup.add(scene.add.rectangle(3, -33, 3, 1.5, 0xeeeeee));
    // Pointed wizard hat brim (wide)
    this.bodyGroup.add(scene.add.rectangle(0, -45, 26, 2.5, 0x224488));
    this.bodyGroup.add(scene.add.rectangle(0, -45, 26, 1, 0x335599));
    // Tall pointed hat (cone)
    const hatCone = scene.add.graphics();
    hatCone.fillStyle(0x224488, 1);
    hatCone.fillTriangle(0, -65, -10, -47, 10, -47);
    hatCone.lineStyle(0.6, 0x112244, 1);
    hatCone.strokeTriangle(0, -65, -10, -47, 10, -47);
    this.bodyGroup.add(hatCone);
    // Hat tip slightly bent
    this.bodyGroup.add(scene.add.circle(0, -64, 1.5, 0xffeebb));
    // Hat stars
    this.bodyGroup.add(scene.add.circle(-3, -52, 1, 0xffdd44));
    this.bodyGroup.add(scene.add.circle(3, -56, 1, 0xffdd44));
    this.bodyGroup.add(scene.add.circle(0, -58, 0.8, 0xffdd44));

    // Default weapon — wooden staff with glowing blue crystal topper
    const staff = scene.add.rectangle(17, -22, 3, 42, 0x553311).setStrokeStyle(0.4, 0x331100);
    this.bodyGroup.add(staff);
    this.defaultWeaponVisuals.push(staff);
    // Bands around the staff
    this.defaultWeaponVisuals.push(scene.add.rectangle(17, -10, 5, 1, 0x664422));
    this.bodyGroup.add(this.defaultWeaponVisuals[this.defaultWeaponVisuals.length - 1]);
    this.defaultWeaponVisuals.push(scene.add.rectangle(17, -22, 5, 1, 0x664422));
    this.bodyGroup.add(this.defaultWeaponVisuals[this.defaultWeaponVisuals.length - 1]);
    // Crystal claw setting
    this.defaultWeaponVisuals.push(scene.add.rectangle(17, -42, 6, 3, 0x664422));
    this.bodyGroup.add(this.defaultWeaponVisuals[this.defaultWeaponVisuals.length - 1]);
    // Floating glowing blue crystal
    const orbGlow = scene.add.circle(17, -46, 9, 0x66aaff, 0.25);
    this.bodyGroup.add(orbGlow);
    this.defaultWeaponVisuals.push(orbGlow);
    const orb = scene.add.circle(17, -46, 5, 0x88ccff, 0.95).setStrokeStyle(0.6, 0x224488);
    this.bodyGroup.add(orb);
    this.defaultWeaponVisuals.push(orb);
    const orbCore = scene.add.circle(16, -47, 2, 0xffffff, 0.85);
    this.bodyGroup.add(orbCore);
    this.defaultWeaponVisuals.push(orbCore);
    scene.tweens.add({
      targets: orbGlow,
      scaleX: 1.5, scaleY: 1.5, alpha: 0.08,
      duration: 1000, yoyo: true, repeat: -1,
    });

    this.sprite = scene.add.rectangle(0, -22, 22, 8, 0x335599); // invisible-ish handle for color flash
    this.bodyGroup.add(this.sprite);
    this.shadow.fillColor = 0x113355;
    this.shadow.alpha = 0.4;
  }

  // ==================== ARCHER ====================
  // Inspired by Legolas, Robin Hood, ranger archetypes — green hooded cloak, leather
  // armor, longbow ready to fire, full quiver of fletched arrows on the back.
  private buildArcherVisual(scene: Phaser.Scene): void {
    // Long green cloak behind body
    this.bodyGroup.add(scene.add.rectangle(-2, -16, 26, 32, 0x224422, 0.9));
    this.bodyGroup.add(scene.add.rectangle(0, 0, 28, 4, 0x336633));
    // Leather pants (dark brown)
    this.bodyGroup.add(scene.add.rectangle(-5, -4, 8, 14, 0x553322));
    this.bodyGroup.add(scene.add.rectangle(5, -4, 8, 14, 0x553322));
    // Lacing on the pants
    this.bodyGroup.add(scene.add.rectangle(-5, -2, 6, 0.5, 0x332211));
    this.bodyGroup.add(scene.add.rectangle(5, -2, 6, 0.5, 0x332211));
    // Soft leather boots
    this.bodyGroup.add(scene.add.rectangle(-5, 5, 9, 5, 0x442211));
    this.bodyGroup.add(scene.add.rectangle(5, 5, 9, 5, 0x442211));
    // Boot tops with fold-over
    this.bodyGroup.add(scene.add.rectangle(-5, 1, 10, 1.5, 0x553311));
    this.bodyGroup.add(scene.add.rectangle(5, 1, 10, 1.5, 0x553311));
    // Green tunic
    const tunic = scene.add.rectangle(0, -22, 26, 22, 0x33aa55).setStrokeStyle(0.6, 0x114422);
    this.bodyGroup.add(tunic);
    // Tunic v-neck collar
    this.bodyGroup.add(scene.add.triangle(0, -28, -3, 0, 3, 0, 0, 4, 0xccaa88));
    // Leather chest plate (over tunic)
    this.bodyGroup.add(scene.add.rectangle(0, -22, 18, 14, 0x664422).setStrokeStyle(0.6, 0x331100));
    // Leather strap going across chest (quiver strap)
    this.bodyGroup.add(scene.add.rectangle(-1, -22, 24, 2, 0x442211).setRotation(-0.4));
    // Belt
    this.bodyGroup.add(scene.add.rectangle(0, -12, 22, 2, 0x331100));
    this.bodyGroup.add(scene.add.rectangle(0, -12, 3, 3, 0xddcc44));
    // Arm bracers (leather)
    this.bodyGroup.add(scene.add.rectangle(-13, -16, 4, 8, 0x553322).setStrokeStyle(0.4, 0x221100));
    this.bodyGroup.add(scene.add.rectangle(13, -16, 4, 8, 0x553322).setStrokeStyle(0.4, 0x221100));
    // Bracer ties
    this.bodyGroup.add(scene.add.rectangle(-13, -18, 5, 0.6, 0x331100));
    this.bodyGroup.add(scene.add.rectangle(-13, -14, 5, 0.6, 0x331100));
    this.bodyGroup.add(scene.add.rectangle(13, -18, 5, 0.6, 0x331100));
    this.bodyGroup.add(scene.add.rectangle(13, -14, 5, 0.6, 0x331100));
    // Quiver on the back (left, peeking up)
    this.bodyGroup.add(scene.add.rectangle(-12, -28, 6, 16, 0x442211).setStrokeStyle(0.4, 0x221100));
    this.bodyGroup.add(scene.add.rectangle(-12, -34, 7, 2, 0x553322));
    // Many arrows sticking out — fletched ends visible
    for (let i = -2; i <= 2; i++) {
      const ax = -12 + i * 1.4;
      // Shaft
      this.bodyGroup.add(scene.add.rectangle(ax, -38, 0.8, 6, 0x886644));
      // Fletching (alternating red/white)
      const fletchColor = i % 2 === 0 ? 0xcc4422 : 0xeeeecc;
      this.bodyGroup.add(scene.add.rectangle(ax, -41, 1.6, 2, fletchColor));
    }
    // Hood drawn over head (green, pointed)
    const hoodG = scene.add.graphics();
    hoodG.fillStyle(0x224422, 1);
    hoodG.fillTriangle(-12, -32, 12, -32, 0, -50);
    hoodG.lineStyle(0.6, 0x113311, 1);
    hoodG.strokeTriangle(-12, -32, 12, -32, 0, -50);
    this.bodyGroup.add(hoodG);
    // Hood opening (darker shadow)
    this.bodyGroup.add(scene.add.circle(0, -38, 9, 0x113311));
    // Face inside hood (shadowed skin tone)
    const face = scene.add.circle(0, -37, 7, 0xbb9966);
    this.bodyGroup.add(face);
    // Sharp focused eyes (green, intense)
    this.bodyGroup.add(scene.add.rectangle(-3, -38, 2.5, 1.2, 0x111111));
    this.bodyGroup.add(scene.add.rectangle(3, -38, 2.5, 1.2, 0x111111));
    this.bodyGroup.add(scene.add.circle(-3, -38, 0.5, 0x44dd66));
    this.bodyGroup.add(scene.add.circle(3, -38, 0.5, 0x44dd66));
    // Determined mouth
    this.bodyGroup.add(scene.add.rectangle(0, -33, 4, 0.6, 0x553322));
    // Hood point at the top
    this.bodyGroup.add(scene.add.circle(0, -50, 1.5, 0x113311));

    // Default weapon — drawn longbow with arrow nocked, held vertically on the right
    const bowG = scene.add.graphics();
    // Bow body — full circle arc
    bowG.lineStyle(2.4, 0x664422, 1);
    bowG.beginPath();
    bowG.arc(22, -22, 22, Math.PI * 0.7, Math.PI * 1.3, false);
    bowG.strokePath();
    // Bow grip (where the hand holds it)
    bowG.lineStyle(3, 0x442211, 1);
    bowG.beginPath();
    bowG.moveTo(22, -25);
    bowG.lineTo(22, -19);
    bowG.strokePath();
    // Bowstring (taut)
    bowG.lineStyle(0.8, 0xeeeeee, 0.95);
    bowG.beginPath();
    bowG.moveTo(15, -38);
    bowG.lineTo(15, -6);
    bowG.strokePath();
    // Nocked arrow (on the string, pointing out)
    bowG.lineStyle(1.4, 0x886644, 1);
    bowG.beginPath();
    bowG.moveTo(15, -22);
    bowG.lineTo(34, -22);
    bowG.strokePath();
    // Arrowhead
    bowG.fillStyle(0xccccdd, 1);
    bowG.fillTriangle(34, -24, 34, -20, 38, -22);
    // Fletching at the back of the arrow
    bowG.fillStyle(0xcc4422, 1);
    bowG.fillTriangle(15, -22, 12, -19, 12, -25);
    bowG.fillStyle(0xeeeecc, 1);
    bowG.fillTriangle(15, -22, 13, -25, 11, -22);
    this.bodyGroup.add(bowG);
    this.defaultWeaponVisuals.push(bowG);
    // Bow tips (small caps)
    this.defaultWeaponVisuals.push(scene.add.circle(15, -38, 1, 0x442211));
    this.bodyGroup.add(this.defaultWeaponVisuals[this.defaultWeaponVisuals.length - 1]);
    this.defaultWeaponVisuals.push(scene.add.circle(15, -6, 1, 0x442211));
    this.bodyGroup.add(this.defaultWeaponVisuals[this.defaultWeaponVisuals.length - 1]);

    this.sprite = tunic;
    this.shadow.fillColor = 0x113322;
    this.shadow.alpha = 0.4;
  }

  update(_time: number, delta: number): void {
    // Read attack input (consume JustDown each frame)
    this.attackPressed = this.keys.attack.isDown;

    // ----- COMBO RESET TIMER -----
    // Only ticks when we're NOT mid-attack. Once it expires, the combo step
    // resets to 0 so the next swing starts a fresh combo.
    if (this.attackPhase === 'idle' && this.comboStep > 0 && this.comboResetTimer > 0) {
      this.comboResetTimer -= delta;
      if (this.comboResetTimer <= 0) {
        this.comboStep = 0;
        this.comboResetTimer = 0;
      }
    }

    // ----- POST-HIT DAMAGE IMMUNITY (i-frames) -----
    // Tick the timer down and drive the blink effect. When the timer expires,
    // restore full alpha so the hero is solid again.
    if (this.damageImmunityTimer > 0) {
      this.damageImmunityTimer -= delta;
      if (this.damageImmunityTimer <= 0) {
        // Immunity expired — restore solid alpha
        this.damageImmunityTimer = 0;
        this.bodyGroup.setAlpha(1);
      } else {
        // Blink: oscillate alpha between 1.0 and IMMUNITY_MIN_ALPHA on a
        // cycle of IMMUNITY_BLINK_INTERVAL ms. Uses a triangle wave so the
        // blink is a smooth pulse, not a harsh on/off flicker.
        const cycle = (this.damageImmunityTimer % Hero.IMMUNITY_BLINK_INTERVAL)
                    / Hero.IMMUNITY_BLINK_INTERVAL;
        const wave = Math.abs(cycle * 2 - 1); // 0→1→0 triangle wave
        const minA = Hero.IMMUNITY_MIN_ALPHA;
        this.bodyGroup.setAlpha(minA + (1 - minA) * wave);
      }
    }

    // Tick cast cooldown
    if (this.castCooldown > 0) this.castCooldown -= delta;

    // Tick knockback (decay velocity over time for a smooth slide)
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= delta;
      // Linear decay so the slide gradually slows
      this.knockbackVx *= 0.88;
      if (this.knockbackTimer <= 0) {
        this.knockbackTimer = 0;
        this.knockbackVx = 0;
      }
    }

    // Jump physics — skipped during the jump smash finisher, which drives
    // jumpZ manually via its own phase machine.
    if (!this.isDead && this.finisherPhase === 'idle') {
      this.updateJump(delta);
    }

    this.sm.update(delta);
    // Apply procedural body offsets (bob from run/idle, compression from jump/land)
    // AFTER the state machine has updated the joints. This must run last so
    // bodyGroup.y reflects the latest jumpZ + bob + compression for this frame.
    this.applyBodyOffsets();
    const heightFactor = Math.max(0.3, 1 - Math.abs(this.jumpZ) / 200);
    this.shadowScaleRoot.setScale(heightFactor, heightFactor);
    (this.shadowScaleRoot as unknown as { alpha: number }).alpha = heightFactor;

    // ----- Cape movement trailing -----
    // Adds a small rotation when moving so the cape trails behind.
    // At rest (speed=0) this decays to 0 — cape is completely still.
    if (this.capeNode) {
      const speed = Math.abs(this.smoothedVx) + Math.abs(this.smoothedVy);
      const maxTrail = 0.12;
      const trailTarget = Math.min(1, speed / 220) * maxTrail;
      const blendUp = 0.04;
      const blendDown = 0.015;
      const blend = trailTarget > this.capeTrailRotation ? blendUp : blendDown;
      this.capeTrailRotation = Phaser.Math.Linear(this.capeTrailRotation, trailTarget, blend);
      this.capeNode.rotation = this.capeTrailRotation;
    }

    this.setDepth(this.groundY);


  }

  // --- Jump (phase-based with coyote time + jump buffering + landing squash) ---

  private updateJump(delta: number): void {
    const dt = delta / 1000;
    const jumpJustPressed = Phaser.Input.Keyboard.JustDown(this.keys.jump);

    // Buffer the jump press so a slightly-early tap still launches on landing
    if (jumpJustPressed) this.jumpBufferTimer = MOVEMENT_TUNE.jumpBufferTime;
    else if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= delta;

    // Coyote time: brief grace period after leaving the ground
    if (this.isGrounded) this.coyoteTimer = MOVEMENT_TUNE.coyoteTime;
    else if (this.coyoteTimer > 0) this.coyoteTimer -= delta;

    // Phase machine
    switch (this.jumpPhase) {
      case 'grounded': {
        // Trigger squat anticipation if a (buffered) jump is queued
        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
          this.jumpPhase = 'squat';
          this.jumpPhaseTimer = MOVEMENT_TUNE.jumpSquatDuration;
          this.jumpBufferTimer = 0;
        }
        break;
      }
      case 'squat': {
        // Compress legs while we wind up — fast, anticipatory crouch
        this.jumpPhaseTimer -= delta;
        const t = 1 - Math.max(0, this.jumpPhaseTimer) / MOVEMENT_TUNE.jumpSquatDuration;
        this.bodyCompression = MOVEMENT_TUNE.jumpSquatCompression * t;
        if (this.jumpPhaseTimer <= 0) {
          // Launch
          this.jumpVelZ = JUMP_VELOCITY;
          this.jumpZ = -1;
          this.isGrounded = false;
          this.coyoteTimer = 0;
          this.bodyCompression = 0;
          this.jumpPhase = 'rising';
          this.maxFallSpeed = 0;
        }
        break;
      }
      case 'rising': {
        if (this.jumpVelZ > MOVEMENT_TUNE.jumpRiseFallThreshold) this.jumpPhase = 'falling';
        break;
      }
      case 'falling': {
        if (this.jumpVelZ > this.maxFallSpeed) this.maxFallSpeed = this.jumpVelZ;
        break;
      }
      case 'landing': {
        // Decompress legs over landCompressionDuration
        this.jumpPhaseTimer -= delta;
        const t = Math.max(0, this.jumpPhaseTimer) / MOVEMENT_TUNE.landCompressionDuration;
        // Start fully compressed, ease back to 0
        const target = (this.maxFallSpeed >= MOVEMENT_TUNE.hardLandingFallSpeed)
          ? MOVEMENT_TUNE.landCompressionHard
          : MOVEMENT_TUNE.landCompressionLight;
        this.bodyCompression = target * t;
        if (this.jumpPhaseTimer <= 0) {
          this.bodyCompression = 0;
          this.jumpPhase = 'grounded';
          this.maxFallSpeed = 0;
        }
        break;
      }
    }

    // Vertical physics — only when airborne
    if (!this.isGrounded) {
      this.jumpVelZ += GRAVITY * dt;
      this.jumpZ += this.jumpVelZ * dt;
      if (this.jumpZ >= 0) {
        // Touchdown — enter landing compression
        this.jumpZ = 0;
        const fallSpeed = this.jumpVelZ;
        this.jumpVelZ = 0;
        this.isGrounded = true;
        this.maxFallSpeed = Math.max(this.maxFallSpeed, fallSpeed);
        this.jumpPhase = 'landing';
        this.jumpPhaseTimer = MOVEMENT_TUNE.landCompressionDuration;
      }
    }
  }

  // --- Damage ---

  /** Damage reduction from passive sources (e.g. Guardian Spirit sidekick). 0..1 */
  damageReductionPct = 0;

  /** Knockback state — when active, position is shoved away from the hit source */
  knockbackTimer = 0;
  knockbackVx = 0;

  /**
   * Global hero incoming knockback scale. Every knockback force applied to
   * the hero is multiplied by this value. Adjust here to tune hero knockback
   * across the entire game in one place. 1.0 = original, 0.5 = half strength.
   */
  static readonly HERO_KNOCKBACK_SCALE = 0.5;

  /** Apply a knockback impulse pushing the hero away from sourceX. Force is the initial velocity. */
  applyKnockback(sourceX: number, force: number = 320): void {
    const dir = this.x >= sourceX ? 1 : -1;
    this.knockbackVx = dir * force * Hero.HERO_KNOCKBACK_SCALE;
    this.knockbackTimer = 220; // ms
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    if (this.isInvulnerable) return; // Ultimate ability immunity
    if (this.isDamageImmune) return; // Post-hit i-frame immunity

    let actual = Math.max(amount - this.stats.defense, 1);
    if (this.damageReductionPct > 0) {
      actual = Math.max(1, Math.round(actual * (1 - this.damageReductionPct)));
    }
    this.currentHealth = Math.max(this.currentHealth - actual, 0);
    EventBus.emit(Events.HERO_HEALTH_CHANGED, this.currentHealth, this.stats.maxHealth);

    // Start the post-hit immunity window so overlapping enemy attacks
    // don't melt the hero's HP in a single frame.
    this.damageImmunityTimer = Hero.DAMAGE_IMMUNITY_DURATION;

    // Brief hit flash — tint the body red for HIT_FLASH_DURATION ms
    this.bodyGroup.setAlpha(1);
    if (this.sprite) this.sprite.fillColor = 0xff4444;
    this.scene.time.delayedCall(Hero.HIT_FLASH_DURATION, () => {
      if (!this.isDead && this.sprite) this.sprite.fillColor = this.baseColor;
    });

    if (this.currentHealth <= 0) {
      this.isDead = true;
      this.damageImmunityTimer = 0; // no immunity when dead
      this.bodyGroup.setAlpha(1);
      this.sm.transition('death');
    } else {
      this.sm.transition('hurt');
    }
  }

  // --- Melee hitbox helpers ---

  activateHitbox(): void {
    this.hitboxActive = true;
    this.hitEnemies.clear();
  }

  deactivateHitbox(): void {
    this.hitboxActive = false;
  }

  getHitboxWorldPosition(): { x: number; y: number; w: number; h: number } {
    const isFinisherSlam = this.finisherPhase === 'impact';

    if (isFinisherSlam) {
      // ----- FINISHER RADIAL SLAM -----
      // Full circle around the hero — hits in every direction (front, back,
      // touching). The rectangle returned is a bounding box for the radius;
      // the actual overlap check in checkHeroMeleeHits uses distance for
      // finisher hits, not rectangle intersection.
      const r = MELEE_TUNE.finisherRadius;
      const side = r * 2;
      return { x: this.x - r, y: this.groundY - r + this.jumpZ, w: side, h: side };
    }

    // ----- BASIC COMBO HITBOX -----
    const offsetX = this.facingRight ? 11 : -87;
    return { x: this.x + offsetX, y: this.groundY - 102 + this.jumpZ, w: 72, h: 102 };
  }

  // --- Movement ---

  getInputDirection(): Phaser.Math.Vector2 {
    let dx = 0, dy = 0;
    if (this.keys.left.isDown) dx -= 1;
    if (this.keys.right.isDown) dx += 1;
    if (this.keys.up.isDown) dy -= 1;
    if (this.keys.down.isDown) dy += 1;
    const vec = new Phaser.Math.Vector2(dx, dy);
    if (vec.length() > 0) vec.normalize();
    return vec;
  }

  private applyMovement(dir: Phaser.Math.Vector2): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.knockbackTimer > 0) {
      // Knockback overrides input — slide back from the hit source
      body.setVelocity(this.knockbackVx, 0);
    } else {
      // Smoothed acceleration toward the target velocity for natural ramp-up.
      // The smoothing factor is frame-rate independent (per-second exponent).
      const targetVx = dir.x * this.stats.moveSpeed;
      const targetVy = dir.y * this.stats.moveSpeed * 0.6;
      const accelMix = (dir.length() > 0) ? MOVEMENT_TUNE.acceleration : MOVEMENT_TUNE.deceleration;
      // Lerp toward target velocity (rough but reads as accel/decel)
      this.smoothedVx = Phaser.Math.Linear(this.smoothedVx, targetVx, accelMix);
      this.smoothedVy = Phaser.Math.Linear(this.smoothedVy, targetVy, accelMix);
      body.setVelocity(this.smoothedVx, this.smoothedVy);
    }
    if (!this.useWalkMask) {
      if (this.y < GROUND_MIN_Y) { this.y = GROUND_MIN_Y; body.setVelocityY(0); }
      if (this.y > GROUND_MAX_Y) { this.y = GROUND_MAX_Y; body.setVelocityY(0); }
    }
    this.groundY = this.y;
  }

  updateFacing(dx: number): void {
    if (dx > 0) { this.facingRight = true; this.bodyGroup.setScale(1, 1); }
    else if (dx < 0) { this.facingRight = false; this.bodyGroup.setScale(-1, 1); }
  }

  // ===========================================================================
  // PROCEDURAL ANIMATION HELPERS
  // ===========================================================================
  // These compute and apply per-frame body offsets based on the current state.
  // They run on top of the state machine's logic so the visual feel can be
  // tuned without rewriting state transitions.

  /**
   * RUN CYCLE — full kinetic chain.
   *
   * Body mechanics, in order of force generation:
   *   FRONT LEG / BACK LEG  →  plant and push off, alternating 180° out of phase
   *   HIPS                  →  bounce vertically (twice per stride) AND shift laterally
   *                            toward the planted leg (weight transfer)
   *   TORSO                 →  leans forward into the run, scaled by speed
   *   SHOULDERS             →  counter-rotate against the hips
   *   FRONT ARM             →  swings opposite the front leg (sword side)
   *   BACK ARM              →  swings opposite the front arm (shield side)
   *   HEAD                  →  partially stabilized — counters most of the hip bob
   *                            so the eyes don't pogo, but still moves enough to feel alive
   *   WEAPON                →  rides the front arm (when not in attack state)
   *
   * Every value shares a single `phase` variable so the chain stays musically locked.
   */
  /** When true, leg/body animations are frozen (dragon mount riding pose). */
  isMounted = false;

  private tickRunCycle(delta: number, speedFraction: number): void {
    if (!this.legLeftPivot || !this.legRightPivot) return;
    if (this.isMounted) return; // Don't animate legs while mounted
    // Stride period shortens with speed — faster movement = faster leg churn.
    const period = Phaser.Math.Linear(
      MOVEMENT_TUNE.runStridePeriod,
      MOVEMENT_TUNE.runStridePeriodMin,
      speedFraction,
    );
    this.runCycleTime += delta;
    // Position in the stride cycle, 0..1
    const cyclePos = ((this.runCycleTime % period) + period) % period / period;

    // ----- LOWER BODY: KEYFRAME-DRIVEN ------------------------------------
    // Find the two RUN_FRAMES bracketing the current cycle position and
    // interpolate every lower-body value between them.
    let prev = RUN_FRAMES[RUN_FRAMES.length - 1];
    let next = RUN_FRAMES[0];
    let prevPhase = prev.phase - 1; // wrap-around
    let nextPhase = next.phase;
    for (let i = 0; i < RUN_FRAMES.length; i++) {
      const f = RUN_FRAMES[i];
      if (cyclePos < f.phase) {
        next = f;
        nextPhase = f.phase;
        prev = i === 0 ? RUN_FRAMES[RUN_FRAMES.length - 1] : RUN_FRAMES[i - 1];
        prevPhase = i === 0 ? prev.phase - 1 : prev.phase;
        break;
      }
      if (i === RUN_FRAMES.length - 1) {
        // We're past the last frame — wrap to the first
        prev = f;
        prevPhase = f.phase;
        next = RUN_FRAMES[0];
        nextPhase = next.phase + 1;
      }
    }
    const span = Math.max(0.0001, nextPhase - prevPhase);
    const t = Phaser.Math.Clamp((cyclePos - prevPhase) / span, 0, 1);

    // Knee bend lerp: at low speed, scale toward the standing baseline so a
    // walk doesn't have the same exaggerated tuck as a sprint.
    const kneeScale = Phaser.Math.Linear(MOVEMENT_TUNE.runKneeSpeedScale, 1, speedFraction);

    // ----- HIPS -----
    // hipDrop and hipShift are scaled by speedFraction and shift the body group.
    const hipDrop  = Phaser.Math.Linear(prev.hipDrop,  next.hipDrop,  t) * speedFraction;
    const hipShift = Phaser.Math.Linear(prev.hipShift, next.hipShift, t) * speedFraction
                     * MOVEMENT_TUNE.runHipLateralAmplitude * 0.5;
    this.bodyBobOffset   = hipDrop;
    this.hipLateralShift = hipShift;

    // ----- LEFT LEG (back leg when facing right) -----
    // FRONT THIGH = legRight when facing right, but the joints are absolute.
    // The keyframes are authored so left leg = legLeft.
    const lHip  = Phaser.Math.Linear(prev.legLeft,  next.legLeft,  t) * speedFraction;
    const lKnee = Phaser.Math.Linear(prev.kneeLeft, next.kneeLeft, t) * kneeScale;
    this.legLeftPivot.angle = lHip;
    if (this.legLeftKnee) this.legLeftKnee.angle = lKnee;

    // ----- RIGHT LEG (front leg when facing right) -----
    const rHip  = Phaser.Math.Linear(prev.legRight,  next.legRight,  t) * speedFraction;
    const rKnee = Phaser.Math.Linear(prev.kneeRight, next.kneeRight, t) * kneeScale;
    this.legRightPivot.angle = rHip;
    if (this.legRightKnee) this.legRightKnee.angle = rKnee;

    // ----- TORSO -----------------------------------------------------------
    // Lean forward into the run, scaled by speed so it eases in.
    if (this.upperBodyPivot) {
      this.upperBodyPivot.angle = MOVEMENT_TUNE.runForwardLean * speedFraction;
    }

    // ----- ARMS (phase-locked to the leg cycle) ----------------------------
    // The arms swing opposite the legs. We re-derive a phase angle from cyclePos
    // so the upper body stays musically locked to the lower body keyframes.
    const armPhase = cyclePos * Math.PI * 2;
    const armSinP  = Math.sin(armPhase);
    const armSinPi = Math.sin(armPhase + Math.PI);
    const shoulderTwist = armSinPi * MOVEMENT_TUNE.runShoulderCounter * speedFraction;
    if (this.shoulderNode) {
      // Front arm swings opposite the right (front) leg
      this.shoulderNode.angle =
        armSinPi * MOVEMENT_TUNE.runArmSwing * speedFraction + shoulderTwist;
    }
    if (this.backArmNode) {
      // Back arm swings opposite the front arm = with the front leg
      this.backArmNode.angle =
        armSinP * MOVEMENT_TUNE.runBackArmSwing * speedFraction - shoulderTwist;
    }

    // ----- HEAD ------------------------------------------------------------
    // Stabilization: translate the head OPPOSITE the hip bounce by `runHeadStabilize`
    // of the bob, so the eyes stay roughly level while the body works underneath.
    // A small lateral counter-shift keeps the helm from sliding with the hips.
    if (this.headPivot) {
      this.headPivot.y = this.headBaseY - this.bodyBobOffset * MOVEMENT_TUNE.runHeadStabilize;
      this.headPivot.x = this.headBaseX - this.hipLateralShift * 0.3;
    }
  }

  /**
   * IDLE BREATH — full body still has work to do at rest.
   *
   * Body mechanics:
   *   HIPS      →  rise and fall on inhale/exhale
   *   TORSO     →  half-frequency micro-sway so the rhythm doesn't look mechanical
   *   SHOULDERS →  ride the torso (no extra motion)
   *   HEAD      →  floats opposite the chest rise — sells the spine compressing
   *   ARMS      →  tiny drift on the front arm (relaxed grip)
   */
  private tickIdleBreath(delta: number): void {
    if (this.isMounted) return;
    this.idleBreathTime += delta;
    const phase = (this.idleBreathTime / MOVEMENT_TUNE.idleBreathPeriod) * Math.PI * 2;
    const sinP = Math.sin(phase);

    // ----- HIPS -----
    // Keep bodyBobOffset at zero so the feet stay planted on the ground.
    // Breathing rise is applied to the upper body pivot only (below).
    this.bodyBobOffset = 0;
    this.hipLateralShift = MOVEMENT_TUNE.idleHipBias * (this.facingRight ? 1 : -1);

    // ----- TORSO -----
    // No vertical motion during idle — hero stays completely still.
    if (this.upperBodyPivot) {
      this.upperBodyPivot.angle = 0;
      this.upperBodyPivot.y = 0;
    }

    // ----- HEAD ----- (locked in place during idle)
    if (this.headPivot) {
      this.headPivot.y = this.headBaseY;
      this.headPivot.x = this.headBaseX;
    }

    // ----- FRONT ARM ----- (locked during idle — no drift)
    if (this.shoulderNode && !this.swordNode) {
      this.shoulderNode.angle = 0;
    }
    // ----- BACK ARM ----- (shield rests against the body — no motion)

    // ----- KNEES ----- (standing bend — slightly more on the weight-bearing leg)
    // Contrapposto biases weight onto one leg, so that knee bends more.
    if (this.legLeftKnee)  this.legLeftKnee.angle  = this.facingRight ? 8 : 4;
    if (this.legRightKnee) this.legRightKnee.angle = this.facingRight ? 4 : 8;
  }

  /**
   * QUICK TURN — overlays on top of the run cycle when the player reverses
   * direction at speed.
   *
   * Body mechanics:
   *   HIPS  →  kick AWAY from the new direction (skid), then drop briefly
   *   TORSO →  counter-leans against the new direction (weight transfer)
   *   HEAD  →  stays roughly stable (already stabilized in the run cycle)
   *
   * The lean falls off as a half-sin curve: 0 → peak → 0 over `turnDuration`.
   */
  private tickTurn(delta: number): void {
    this.turnTimer = Math.max(0, this.turnTimer - delta);
    const t = 1 - this.turnTimer / MOVEMENT_TUNE.turnDuration; // 0 → 1
    const curve = Math.sin(t * Math.PI); // 0 → 1 → 0 bell curve
    // Counter-lean: torso leans AGAINST the new direction (resistance to the change)
    if (this.upperBodyPivot) {
      this.upperBodyPivot.angle += -this.turnDir * MOVEMENT_TUNE.turnTorsoCounter * curve;
    }
    // Hip kick: shoves the hips slightly back from the new direction (skid)
    this.hipLateralShift += -this.turnDir * MOVEMENT_TUNE.turnHipKick * curve;
    // Hip drop: vertical compression sells the weight transfer
    this.bodyBobOffset += MOVEMENT_TUNE.turnHipDrop * curve;
  }

  /** Smoothly relax every joint back to neutral. Used by stop/settle so the run
   *  pose blends into idle instead of snapping. */
  private tickSettleToNeutral(delta: number, duration: number): void {
    const t = Math.min(1, delta / Math.max(1, duration));
    if (this.legLeftPivot)   this.legLeftPivot.angle  = Phaser.Math.Linear(this.legLeftPivot.angle, 0, t);
    if (this.legRightPivot)  this.legRightPivot.angle = Phaser.Math.Linear(this.legRightPivot.angle, 0, t);
    // Knees relax to a slight standing bend (not zero — locked knees look bad)
    if (this.legLeftKnee)    this.legLeftKnee.angle   = Phaser.Math.Linear(this.legLeftKnee.angle, 6, t);
    if (this.legRightKnee)   this.legRightKnee.angle  = Phaser.Math.Linear(this.legRightKnee.angle, 6, t);
    if (this.upperBodyPivot) {
      this.upperBodyPivot.angle = Phaser.Math.Linear(this.upperBodyPivot.angle, 0, t);
      this.upperBodyPivot.y = Phaser.Math.Linear(this.upperBodyPivot.y, 0, t);
    }
    if (this.backArmNode)    this.backArmNode.angle    = Phaser.Math.Linear(this.backArmNode.angle, 0, t);
    if (this.shoulderNode && !this.swordNode) {
      this.shoulderNode.angle = Phaser.Math.Linear(this.shoulderNode.angle, 0, t);
    }
    if (this.headPivot) {
      this.headPivot.x = Phaser.Math.Linear(this.headPivot.x, this.headBaseX, t);
      this.headPivot.y = Phaser.Math.Linear(this.headPivot.y, this.headBaseY, t);
    }
    this.bodyBobOffset   = Phaser.Math.Linear(this.bodyBobOffset, 0, t);
    this.hipLateralShift = Phaser.Math.Linear(this.hipLateralShift, 0, t);
  }

  /** Write all per-frame body offsets to the body group transform.
   *  Called after the state machine ticks so the latest joint values are committed. */
  private applyBodyOffsets(): void {
    // Y combines: jumpZ (vertical world position) + bob (run/idle) + compression (squat/land)
    // For spritesheet mode, skip hip shift and body bob (they cause turn glitches)
    if (this._sheetSprite) {
      this.bodyGroup.y = this.jumpZ;
      this.bodyGroup.x = 0;
    } else {
      this.bodyGroup.y = this.jumpZ + this.bodyBobOffset + this.bodyCompression;
      this.bodyGroup.x = this.hipLateralShift;
    }
  }

  // --- States ---

  /** For projectile heroes: try to fire while in any state */
  private tryCastWhileMoving(): void {
    if (this.attackType !== 'projectile') return;
    if (!this.attackPressed) return;
    if (this.castCooldown > 0) return;

    this.castCooldown = this.getScaledCastCooldown();
    this.fireProjectile();

    // Brief sprite flash to show cast
    this.sprite.fillColor = this.accentColor;
    this.scene.time.delayedCall(80, () => {
      if (!this.isDead) this.sprite.fillColor = this.baseColor;
    });
  }

  private createIdleState(): State {
    return {
      name: 'idle',
      enter: () => {
        this.sprite.fillColor = this.baseColor;
        this.playSheetAnim('IDLE');
        // Don't snap velocity to zero — let smoothedVx decay naturally so the
        // character settles instead of stopping on a dime.
      },
      update: (delta: number) => {
        // Decay any leftover velocity smoothly (deceleration)
        this.smoothedVx = Phaser.Math.Linear(this.smoothedVx, 0, MOVEMENT_TUNE.deceleration);
        this.smoothedVy = Phaser.Math.Linear(this.smoothedVy, 0, MOVEMENT_TUNE.deceleration);
        if (Math.abs(this.smoothedVx) < 1) this.smoothedVx = 0;
        if (Math.abs(this.smoothedVy) < 1) this.smoothedVy = 0;
        if (this.knockbackTimer > 0) {
          (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.knockbackVx, 0);
        } else {
          (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.smoothedVx, this.smoothedVy);
        }

        // Idle breath — subtle vertical bob + tiny torso sway
        this.tickIdleBreath(delta);
        // Smoothly settle legs back to neutral if there's leftover stride pose
        this.tickSettleToNeutral(delta, MOVEMENT_TUNE.stopSettleDuration);

        if (this.getInputDirection().length() > 0) { this.sm.transition('run'); return; }
        if (this.attackType === 'projectile') {
          this.tryCastWhileMoving();
        } else if (this.attackPressed) {
          this.sm.transition('attack'); return;
        }
      },
    };
  }

  private createRunState(): State {
    return {
      name: 'run',
      enter: () => {
        const r = ((this.baseColor >> 16) & 0xff);
        const g = ((this.baseColor >> 8) & 0xff);
        const b = (this.baseColor & 0xff);
        this.sprite.fillColor = (Math.min(r + 20, 255) << 16) | (Math.min(g + 20, 255) << 8) | Math.min(b + 20, 255);
        this.playSheetAnim('WALK');
      },
      exit: () => {
        // Don't snap legs to neutral — the idle state's settle tween handles relaxation
      },
      update: (delta: number) => {
        const dir = this.getInputDirection();
        if (dir.length() === 0) { this.sm.transition('idle'); return; }

        // ----- TURN DETECTION -----
        // Skip turn animation for spritesheet rendering (causes position glitch)
        if (!this._sheetSprite) {
          if ((dir.x > 0 && !this.facingRight) || (dir.x < 0 && this.facingRight)) {
            if (Math.abs(this.smoothedVx) > this.stats.moveSpeed * 0.35 && this.turnTimer <= 0) {
              this.turnTimer = MOVEMENT_TUNE.turnDuration;
              this.turnDir = dir.x > 0 ? 1 : -1;
            }
            this.prevFacingRight = this.facingRight;
          }
        }

        if (this.attackType === 'projectile') {
          this.tryCastWhileMoving();
        } else if (this.attackPressed) {
          this.sm.transition('attack'); return;
        }

        this.updateFacing(dir.x);
        this.applyMovement(dir);

        // Run cycle drives ALL the body parts (legs, bob, torso lean, arm swing)
        // Speed fraction is how close to max speed we're moving — newly-started
        // movement still ramps up via smoothedVx so the cycle eases in naturally.
        const currentSpeed = Math.abs(this.smoothedVx) + Math.abs(this.smoothedVy);
        const speedFraction = Phaser.Math.Clamp(currentSpeed / Math.max(1, this.stats.moveSpeed), 0, 1);
        this.tickRunCycle(delta, speedFraction);
        // Turn animation overlays on top of the run cycle (counter-lean + hip kick)
        if (this.turnTimer > 0) this.tickTurn(delta);
      },
    };
  }

  // ==================== PHASE-BASED, FRAME-BY-FRAME MELEE ATTACK ====================
  //
  // High-level phases:        WINDUP → ACTIVE → RECOVERY → (queue? next : idle)
  // Internal animation frames: anticipation → startup → contact → follow → recovery
  //
  // Phases drive the gameplay (hitbox, lunge, damage). The 5-frame timeline drives
  // the visual pose: torso, shoulder, sword, and both legs all shift between frames
  // so the entire body flows through the swing instead of just the arm rotating.

  /**
   * Trigger the attack sprite visual for the current combo step.
   * This is PURELY VISUAL — it does not control combo logic, hit detection,
   * damage, or attack phases. Those are driven by the existing attack system.
   *
   * comboStep 0: forward + backward (hit 1)
   * comboStep 1: forward + backward (hit 2)
   * comboStep 2: forward only (hit 3)
   * comboStep 3: finisher (separate system)
   */
  /** Timer handle for the end-pose hold delay, so it can be cancelled on exit */
  private _attackHoldTimer: Phaser.Time.TimerEvent | null = null;

  private triggerAttackVisual(): void {
    if (!this._sheetSprite) return;

    this._sheetSprite.removeAllListeners('animationcomplete');
    if (this._attackHoldTimer) { this._attackHoldTimer.destroy(); this._attackHoldTimer = null; }
    // All attack sheets have 275px body in 544px frames (1:1, no upscaling).
    // Scale to match idle body size: 275 * (86/320) = 73.9px rendered.
    this._sheetSprite.setScale(86 / 160);
    // Idle body is 11.1px left of frame center; attack sheets are centered.
    // Apply offset only on the first combo stage (idle→attack entry point).
    // Stages 1→2 share the same centered anchor — no shift needed between them.
    if (this.comboStep === 0) {
      this._sheetSprite.x = -11.1;
    }
    // All sheets have per-frame feet at frame bottom — no Y shift needed.
    this._sheetSprite.y = 0;
    this.attackVisualDone = false;

    const s = this.getAttackSpeedMultiplier ? this.getAttackSpeedMultiplier() : 1;
    const sprite = this._sheetSprite;

    const markDone = () => { this.attackVisualDone = true; };

    // Pick animation based on combo stage:
    //   stage 0 → paladin-attack-1 (basic swing)
    //   stage 1 → paladin-attack-2 (basic swing)
    //   stage 2 → paladin-attack-finisher (overhead slam)
    // When Consecration is active, every attack uses the final smash.
    let animKey: string;
    let fps: number;
    if (this.consecrationActive || this.comboStep === 2) {
      animKey = 'paladin-final-smash';
      fps = (this.consecrationActive ? 67 : 134) / s;  // consecration: half speed
    } else if (this.comboStep === 1) {
      animKey = 'paladin-attack-2';
      fps = 228 / s;  // basic attack 2x speed (was 114)
    } else {
      animKey = 'paladin-attack-1';
      fps = 228 / s;  // basic attack 2x speed (was 114)
    }

    if (!sprite.scene.anims.exists(animKey)) return;

    // Start from frame 1 for basic swings (frame 0 doesn't match idle pose).
    // Finisher starts from frame 0 — it has its own lead-in.
    const useSmash = this.consecrationActive || this.comboStep === 2;
    const startFrame = useSmash ? 0 : 1;
    sprite.play({ key: animKey, frameRate: fps, repeat: 0, startFrame });
    this._currentSheetAnim = animKey;

    // Finisher: emit impact event when the hammer hits (frame 97).
    // Listeners can use this for splash damage, camera shake, VFX.
    if (useSmash) {
      const impactFrame = FINISHER_IMPACT_FRAME;
      let impactFired = false;
      const onFrame = (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
        if (!impactFired && frame.index >= impactFrame) {
          impactFired = true;
          this.scene.events.emit('finisher_impact', this);
          sprite.off('animationupdate', onFrame);
        }
      };
      sprite.on('animationupdate', onFrame);
    }

    sprite.once('animationcomplete', () => {
      if (this.comboStep === 2 && !this.consecrationActive) {
        // Hold the final smash end pose briefly before recovering.
        // Use real setTimeout to avoid being affected by hitStop timeScale.
        window.setTimeout(() => { markDone(); }, 250);
      } else {
        markDone();
      }
    });
  }

  private createMeleeAttackState(): State {
    return {
      name: 'attack',
      enter: () => {
        // Trigger visual animation based on current combo step
        this.triggerAttackVisual();
        // NOTE: comboStep is NOT reset here — it carries over from the
        // previous swing so the player can chain into 2/3/finisher. The reset
        // happens (a) when comboResetTimer expires while idle, or (b)
        // immediately after the finisher slam completes.
        this.attackQueued = false;
        this.attackTurnLockTimer = MELEE_TUNE.turnLockDuration;
        this.attackTotalElapsed = 0;

        if (isSmashStep(this.comboStep)) {
          // Combo step 3 → JUMP SMASH FINISHER. Start its own phase machine
          // and DO NOT use the basic attack frame timeline at all.
          this.startFinisher();
        } else {
          this.attackFrames = buildPaladinAttackFrames();
          this.beginAttackPhase('windup');
        }
      },
      exit: () => {
        this.deactivateHitbox();
        if (this._sheetSprite) this._sheetSprite.removeAllListeners('animationcomplete');
        if (this._attackHoldTimer) { this._attackHoldTimer.destroy(); this._attackHoldTimer = null; }
        this.attackVisualDone = false;
        this.comboResetTimer = MELEE_TUNE.comboResetDuration;
        this.attackQueued = false;
        this.attackPhase = 'idle';
        this.attackPhaseTimer = 0;
        this.attackTurnLockTimer = 0;
        this.lungeTraveled = 0;
        this.attackTotalElapsed = 0;
        // Reset finisher state in case we exited mid-finisher (shouldn't happen
        // — finisher is uninterruptible — but be defensive)
        this.finisherPhase = 'idle';
        this.finisherPhaseTimer = 0;
        this.finisherForwardTraveled = 0;
        this.finisherImpactLanded = false;
        this.jumpZ = 0;
        this.jumpVelZ = 0;
        this.isGrounded = true;
        this.jumpPhase = 'grounded';
        this.sprite.fillColor = this.baseColor;
        // Smoothly settle every animated joint back to rest
        this.tweenPoseToRest(140);
      },
      update: (delta: number) => {
        // Finisher has its own phase machine and pose driver — no overlap.
        if (this.finisherPhase !== 'idle') this.tickFinisher(delta);
        else this.tickAttackPhase(delta);
      },
    };
  }

  /** Sets damage + sprite tint for the current combo step. */
  private startComboStep(): void {
    this.hitboxActive = false;
    // Consecration: use the smash (last) multiplier for every attack
    const mulIdx = this.consecrationActive ? COMBO_MULTIPLIERS.length - 1 : this.comboStep;
    this.currentHitboxDamage = Math.max(
      1,
      Math.round(this.stats.attackPower * COMBO_MULTIPLIERS[mulIdx]),
    );
    const brightness = 0xaa + this.comboStep * 0x22;
    this.sprite.fillColor = (brightness << 16) | 0x44;
  }

  /** Switch into a new attack phase and reset the per-phase timer. */
  private beginAttackPhase(phase: AttackPhase): void {
    this.attackPhase = phase;
    this.attackPhaseTimer = 0;
    if (phase === 'windup') {
      this.startComboStep();
      this.deactivateHitbox();
    } else if (phase === 'active') {
      this.lungeTraveled = 0;
      // Hitbox is enabled below at the configured offset, not immediately
    } else if (phase === 'recovery') {
      this.deactivateHitbox();
    }
  }

  /** Smoothly tween every animated joint back to rest pose. */
  private tweenPoseToRest(duration: number): void {
    const ease = 'Quad.easeOut';
    const targets: Phaser.GameObjects.Container[] = [];
    if (this.shoulderNode)   targets.push(this.shoulderNode);
    if (this.swordNode)      targets.push(this.swordNode);
    if (this.upperBodyPivot) targets.push(this.upperBodyPivot);
    if (this.backArmNode)    targets.push(this.backArmNode);
    if (this.legLeftPivot)   targets.push(this.legLeftPivot);
    if (this.legRightPivot)  targets.push(this.legRightPivot);
    for (const t of targets) {
      this.scene.tweens.killTweensOf(t);
      this.scene.tweens.add({ targets: t, angle: 0, duration, ease });
    }
    // Knees relax to standing bend, not zero
    for (const k of [this.legLeftKnee, this.legRightKnee]) {
      if (!k) continue;
      this.scene.tweens.killTweensOf(k);
      this.scene.tweens.add({ targets: k, angle: 6, duration, ease });
    }
    if (this.headPivot) {
      this.scene.tweens.killTweensOf(this.headPivot);
      this.scene.tweens.add({
        targets: this.headPivot, x: this.headBaseX, y: this.headBaseY, duration, ease,
      });
    }
    // Decay hip drive back to neutral via the standard settle path
    this.hipLateralShift = 0;
    this.bodyBobOffset = 0;
    this.moulinetBehindBody = false;
    if (this.shoulderNode) this.bodyGroup.bringToTop(this.shoulderNode);
  }

  /** Apply a body pose snapshot to ALL animated joints in the kinetic chain. */
  private applyPose(pose: BodyPose): void {
    if (this.upperBodyPivot) this.upperBodyPivot.angle = pose.upperBody;
    if (this.shoulderNode)   this.shoulderNode.angle = pose.shoulder;
    if (this.swordNode)      this.swordNode.angle = pose.sword;
    if (this.backArmNode)    this.backArmNode.angle = pose.backArm;
    if (this.headPivot) {
      // headDip is in pixels — translate the head pivot from its base position
      this.headPivot.x = this.headBaseX;
      this.headPivot.y = this.headBaseY + pose.headDip;
    }
    if (this.legLeftPivot)   this.legLeftPivot.angle = pose.legLeft;
    if (this.legRightPivot)  this.legRightPivot.angle = pose.legRight;
    if (this.legLeftKnee)    this.legLeftKnee.angle = pose.kneeLeft;
    if (this.legRightKnee)   this.legRightKnee.angle = pose.kneeRight;
    // Hip drive — bypass the run cycle bob/shift, write the attack pose directly.
    // hipShift is in strike-direction space, so flip it when facing left.
    this.hipLateralShift = pose.hipShift * (this.facingRight ? 1 : -1);
    this.bodyBobOffset = pose.hipDrop;
  }

  /**
   * Walk the attack frame timeline at the given elapsed time and write the
   * interpolated pose to all the joints. Each frame uses its own easing curve
   * to interpolate from the previous frame's target pose to its own.
   */
  private updateAttackPose(elapsed: number): void {
    if (this.attackFrames.length === 0) return;
    let prevPose: BodyPose = REST_POSE;
    let prevEnd = 0;
    for (const frame of this.attackFrames) {
      if (elapsed <= frame.endTime) {
        const span = Math.max(1, frame.endTime - prevEnd);
        const rawT = Phaser.Math.Clamp((elapsed - prevEnd) / span, 0, 1);
        const easeFn = Phaser.Tweens.Builders.GetEaseFunction(frame.ease);
        const t = easeFn ? easeFn(rawT) : rawT;
        const pose: BodyPose = {
          upperBody: Phaser.Math.Linear(prevPose.upperBody, frame.pose.upperBody, t),
          shoulder:  Phaser.Math.Linear(prevPose.shoulder,  frame.pose.shoulder,  t),
          sword:     Phaser.Math.Linear(prevPose.sword,     frame.pose.sword,     t),
          backArm:   Phaser.Math.Linear(prevPose.backArm,   frame.pose.backArm,   t),
          headDip:   Phaser.Math.Linear(prevPose.headDip,   frame.pose.headDip,   t),
          hipShift:  Phaser.Math.Linear(prevPose.hipShift,  frame.pose.hipShift,  t),
          hipDrop:   Phaser.Math.Linear(prevPose.hipDrop,   frame.pose.hipDrop,   t),
          legLeft:   Phaser.Math.Linear(prevPose.legLeft,   frame.pose.legLeft,   t),
          legRight:  Phaser.Math.Linear(prevPose.legRight,  frame.pose.legRight,  t),
          kneeLeft:  Phaser.Math.Linear(prevPose.kneeLeft,  frame.pose.kneeLeft,  t),
          kneeRight: Phaser.Math.Linear(prevPose.kneeRight, frame.pose.kneeRight, t),
        };
        this.applyPose(pose);
        return;
      }
      prevPose = frame.pose;
      prevEnd = frame.endTime;
    }
    this.applyPose(this.attackFrames[this.attackFrames.length - 1].pose);
  }

  /** Per-frame attack controller. Drives phases, lunge, movement, queueing, and pose. */
  private tickAttackPhase(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.attackTurnLockTimer > 0) this.attackTurnLockTimer -= delta;

    // Movement input (allowed in all phases at varying multipliers)
    const dir = this.getInputDirection();
    let moveMult = 0;
    switch (this.attackPhase) {
      case 'windup':   moveMult = MELEE_TUNE.windupMoveMultiplier; break;
      case 'active':   moveMult = MELEE_TUNE.activeMoveMultiplier; break;
      case 'recovery': moveMult = MELEE_TUNE.recoveryMoveMultiplier; break;
    }

    // Finisher locks out movement until 80% of the animation completes
    if (this.comboStep === 2 && this._sheetSprite?.anims?.isPlaying) {
      if (this._sheetSprite.anims.getProgress() < 0.8) {
        moveMult = 0;
      }
    }

    if (this.attackTurnLockTimer <= 0 && dir.x !== 0 &&
        !(this.comboStep === 2 && this._sheetSprite?.anims?.isPlaying && this._sheetSprite.anims.getProgress() < 0.8)) {
      this.updateFacing(dir.x);
    }

    let vx = dir.x * this.stats.moveSpeed * moveMult;
    let vy = dir.y * this.stats.moveSpeed * moveMult * 0.6;


    if (this.knockbackTimer > 0) {
      body.setVelocity(this.knockbackVx, 0);
    } else {
      body.setVelocity(vx, vy);
    }

    // Scale melee phase durations by attack speed
    const spdMul = this.getAttackSpeedMultiplier();

    // Finisher vertical jump arc — driven by animation progress, not physics.
    // Peak matches the normal jump height: V²/(2g) = 400²/(2×1200) ≈ 67px.
    if (this.comboStep === 2 && this._sheetSprite) {
      const progress = this._sheetSprite.anims?.isPlaying
        ? this._sheetSprite.anims.getProgress() : (this.attackVisualDone ? 1 : 0);
      const peak = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY) * 1.5; // ~100px finisher leap
      // Impact at frame 95/121 = 78.5% progress
      if (progress < 0.05) {
        // Grounded — feet planted before launch
        this.jumpZ = 0;
      } else if (progress < 0.45) {
        // Rise to peak (5%→45%)
        const t = (progress - 0.05) / 0.40;
        this.jumpZ = -peak * Math.sin(t * Math.PI * 0.5);
      } else if (progress < 0.55) {
        // Brief apex (45%→55%)
        this.jumpZ = -peak;
      } else if (progress < 0.785) {
        // Descent to ground (55%→78.5%) — lands at impact frame 95
        const t = (progress - 0.55) / 0.235;
        this.jumpZ = -peak * (1 - t * t);
      } else {
        // Grounded — impact and recovery
        this.jumpZ = 0;
      }
    }

    // Hitbox window: only ON during the active phase between hitboxStart/EndOffset (scaled)
    if (this.attackPhase === 'active') {
      const t = this.attackPhaseTimer;
      const inWindow = t >= MELEE_TUNE.hitboxStartOffset * spdMul && t <= MELEE_TUNE.hitboxEndOffset * spdMul;
      if (inWindow && !this.hitboxActive) this.activateHitbox();
      else if (!inWindow && this.hitboxActive) this.deactivateHitbox();
    } else if (this.hitboxActive) {
      this.deactivateHitbox();
    }
    const windupDur = MELEE_TUNE.windupDuration * spdMul;
    const activeDur = MELEE_TUNE.activeDuration * spdMul;
    const recoveryDur = MELEE_TUNE.recoveryDuration * spdMul;

    // Queue the next combo stage during the last 30% of attack-1/attack-2 animation,
    // or any time during recovery. No buffering during the finisher (comboStep 2).
    if (this.attackPressed && this.comboStep < 2) {
      const animProgress = this._sheetSprite?.anims?.isPlaying
        ? this._sheetSprite.anims.getProgress() : 1;
      const inBuffer = animProgress >= 0.7;
      const inRecovery = this.attackPhase === 'recovery';
      if (inBuffer || inRecovery) {
        this.attackQueued = true;
      }
    }

    // Tick timers + drive the visual pose.
    // Pose keyframes use unscaled endTimes, so divide elapsed by spdMul
    // so the full swing animation plays even at higher attack speed.
    this.attackPhaseTimer += delta;
    this.attackTotalElapsed += delta;
    this.updateAttackPose(this.attackTotalElapsed / spdMul);

    // Phase progression
    switch (this.attackPhase) {
      case 'windup':
        if (this.attackPhaseTimer >= windupDur) this.beginAttackPhase('active');
        break;
      case 'active':
        if (this.attackPhaseTimer >= activeDur) this.beginAttackPhase('recovery');
        break;
      case 'recovery': {
        const fixedRecovery = 25 * spdMul;
        // Basic attacks (comboStep 0/1): exit as soon as the timer expires, don't wait for animation.
        // Finisher (comboStep 2): still waits for animation to finish.
        const isBasic = this.comboStep < 2;
        const canExit = isBasic
          ? this.attackPhaseTimer >= fixedRecovery
          : this.attackVisualDone && this.attackPhaseTimer >= fixedRecovery;

        if (canExit || this.attackPhaseTimer >= recoveryDur) {
          if (this.comboStep === 2 && !this.consecrationActive) {
            // Finisher (stage 3) — no chaining allowed (unless Consecration is active).
            // Wait for the visual to finish, then reset combo and return to idle.
            // Safety: force exit after 3s to prevent permanent freeze.
            if (this.attackVisualDone || !this._sheetSprite || this.attackPhaseTimer >= recoveryDur + 3000) {
              this.comboStep = 0;
              this.attackVisualDone = true;
              this.sm.transition('idle');
            }
            // else: finisher visual still playing — keep waiting
          } else if (this.attackQueued) {
            // Chain to next combo stage: 0→1→2
            this.comboStep = this.comboStep + 1;
            this.attackQueued = false;
            this.attackTurnLockTimer = MELEE_TUNE.turnLockDuration;
            this.attackTotalElapsed = 0;
            this.beginAttackPhase('windup');
            this.triggerAttackVisual();
          } else if (this.attackVisualDone || !this._sheetSprite) {
            this.sm.transition('idle');
          } else if (this.attackPhaseTimer >= recoveryDur + 3000) {
            this.attackVisualDone = true;
            this.sm.transition('idle');
          }
        }
        break;
      }
    }
  }

  // ==========================================================================
  // JUMP SMASH FINISHER
  // ==========================================================================
  // Six-phase aerial finisher. Each phase has its own duration, target body
  // pose, jumpZ trajectory, and forward distance contribution. The hitbox is
  // ONLY active during phase 5 (impact) so damage is exclusively the slam.
  //
  // The finisher cannot be cancelled or interrupted mid-move — once started,
  // it plays out through landing.

  /** Begin the jump smash finisher. Called from createMeleeAttackState.enter
   *  when comboStep is the finisher step. */
  private startFinisher(): void {
    this.finisherPhase = 'anticipation';
    this.finisherPhaseTimer = 0;
    this.finisherPhaseStartPose = this.captureCurrentPose();
    this.finisherForwardTraveled = 0;
    this.finisherImpactLanded = false;
    this.attackQueued = false;
    this.deactivateHitbox();
    // Damage is read from COMBO_MULTIPLIERS[3] = 5.4× attackPower (= 3 basics)
    this.currentHitboxDamage = Math.max(
      1,
      Math.round(this.stats.attackPower * COMBO_MULTIPLIERS[3]),
    );
  }

  /** Snapshot the body's current pose so a phase can lerp from "wherever it
   *  is now" to its target. */
  private captureCurrentPose(): BodyPose {
    return {
      upperBody: this.upperBodyPivot?.angle ?? 0,
      shoulder:  this.shoulderNode?.angle ?? 0,
      sword:     this.swordNode?.angle ?? 0,
      backArm:   this.backArmNode?.angle ?? 0,
      headDip:   (this.headPivot?.y ?? this.headBaseY) - this.headBaseY,
      hipShift:  this.hipLateralShift * (this.facingRight ? 1 : -1),
      hipDrop:   this.bodyBobOffset,
      legLeft:   this.legLeftPivot?.angle ?? 0,
      legRight:  this.legRightPivot?.angle ?? 0,
      kneeLeft:  this.legLeftKnee?.angle ?? 0,
      kneeRight: this.legRightKnee?.angle ?? 0,
    };
  }

  /** Advance to the next finisher phase. Snapshots the current pose so the
   *  next phase's lerp starts from the live body, not from the previous
   *  phase's target. */
  private advanceFinisherPhase(next: FinisherPhase): void {
    this.finisherPhase = next;
    this.finisherPhaseTimer = 0;
    this.finisherPhaseStartPose = this.captureCurrentPose();
  }

  /** Per-frame finisher controller. Drives jumpZ, forward velocity, body
   *  pose, hitbox, and phase progression. */
  private tickFinisher(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.finisherPhaseTimer += delta;
    this.attackTotalElapsed += delta;

    // Disable normal updateJump physics for the duration — we drive jumpZ
    // manually via the phase machine.
    this.isGrounded = false;

    // Look up the current phase's duration and target pose
    const dur = this.finisherPhaseDuration(this.finisherPhase);
    const target = this.finisherPhase === 'idle' ? REST_POSE : FINISHER_POSES[this.finisherPhase];
    const tRaw = Phaser.Math.Clamp(this.finisherPhaseTimer / Math.max(1, dur), 0, 1);

    // Per-phase ease curve
    let easeName = 'Sine.easeInOut';
    switch (this.finisherPhase) {
      case 'anticipation': easeName = 'Quad.easeOut'; break;
      case 'launch':       easeName = 'Quad.easeOut'; break; // explosive lift
      case 'apex':         easeName = 'Sine.easeInOut'; break;
      case 'descent':      easeName = 'Quad.easeIn'; break;  // accelerating fall
      case 'impact':       easeName = 'Expo.easeOut'; break; // hard squash
      case 'recovery':     easeName = 'Quad.easeOut'; break;
    }
    const easeFn = Phaser.Tweens.Builders.GetEaseFunction(easeName);
    const tEased = easeFn ? easeFn(tRaw) : tRaw;

    // Lerp every joint from phase-start pose toward the target pose
    const pose = this.lerpPose(this.finisherPhaseStartPose, target, tEased);
    this.applyPose(pose);

    // ----- Vertical (jumpZ) trajectory per phase -----
    const peak = -MELEE_TUNE.finisherLaunchHeight; // jumpZ is negative when airborne
    switch (this.finisherPhase) {
      case 'anticipation':
        // Grounded crouch — no vertical motion
        this.jumpZ = 0;
        break;
      case 'launch':
        // Body rises from ground (0) to peak — accelerating up via easeOut
        this.jumpZ = Phaser.Math.Linear(0, peak, tEased);
        break;
      case 'apex':
        // Held at peak height — brief hang
        this.jumpZ = peak;
        break;
      case 'descent':
        // Crash down from peak to ground — accelerating via easeIn
        this.jumpZ = Phaser.Math.Linear(peak, 0, tEased);
        break;
      case 'impact':
      case 'recovery':
        // Grounded
        this.jumpZ = 0;
        break;
    }

    // ----- Forward momentum during launch + descent -----
    // Total forward distance is split: 35% during launch, 65% during descent.
    if (this.finisherPhase === 'launch' || this.finisherPhase === 'descent') {
      const totalFwd = MELEE_TUNE.finisherForwardDistance;
      const split = this.finisherPhase === 'launch' ? totalFwd * 0.35 : totalFwd * 0.65;
      const stepPx = (split * (delta / Math.max(1, dur)));
      const dirSign = this.facingRight ? 1 : -1;
      const stepClamped = Math.min(stepPx, totalFwd - this.finisherForwardTraveled);
      this.finisherForwardTraveled += stepClamped;
      body.setVelocity(dirSign * (split * 1000 / Math.max(1, dur)), 0);
    } else {
      body.setVelocity(0, 0);
    }
    if (this.knockbackTimer > 0) body.setVelocity(this.knockbackVx, 0);

    // ----- Hitbox: ONLY during the impact phase, in its hit window -----
    if (this.finisherPhase === 'impact') {
      const t = this.finisherPhaseTimer;
      const inWindow = t >= MELEE_TUNE.finisherHitboxStartTime && t <= MELEE_TUNE.finisherHitboxEndTime;
      if (inWindow && !this.hitboxActive) this.activateHitbox();
      else if (!inWindow && this.hitboxActive) this.deactivateHitbox();
    } else if (this.hitboxActive) {
      this.deactivateHitbox();
    }

    // ----- Phase progression -----
    if (this.finisherPhaseTimer >= dur) {
      switch (this.finisherPhase) {
        case 'anticipation': this.advanceFinisherPhase('launch');   break;
        case 'launch':       this.advanceFinisherPhase('apex');     break;
        case 'apex':         this.advanceFinisherPhase('descent');  break;
        case 'descent':
          // Touchdown — enter impact, snap jumpZ to ground
          this.jumpZ = 0;
          this.advanceFinisherPhase('impact');
          break;
        case 'impact':       this.advanceFinisherPhase('recovery'); break;
        case 'recovery': {
          // Finisher complete. Reset combo to 0 and exit the attack state.
          this.finisherPhase = 'idle';
          this.finisherPhaseTimer = 0;
          this.finisherForwardTraveled = 0;
          this.jumpZ = 0;
          this.jumpVelZ = 0;
          this.isGrounded = true;
          this.jumpPhase = 'grounded';
          this.deactivateHitbox();
          this.comboStep = 0;
          // If the player kept holding attack, immediately start a new combo
          if (this.attackPressed) {
            this.attackTurnLockTimer = MELEE_TUNE.turnLockDuration;
            this.attackTotalElapsed = 0;
            this.attackFrames = buildPaladinAttackFrames();
            this.beginAttackPhase('windup');
          } else {
            this.sm.transition('idle');
          }
          break;
        }
      }
    }
  }

  /** Look up the duration of a finisher phase. */
  private finisherPhaseDuration(phase: FinisherPhase): number {
    switch (phase) {
      case 'anticipation': return MELEE_TUNE.finisherWindupDuration;
      case 'launch':       return MELEE_TUNE.finisherLaunchDuration;
      case 'apex':         return MELEE_TUNE.finisherApexDuration;
      case 'descent':      return MELEE_TUNE.finisherDescentDuration;
      case 'impact':       return MELEE_TUNE.finisherImpactDuration;
      case 'recovery':     return MELEE_TUNE.finisherRecoveryDuration;
      default:             return 0;
    }
  }

  /** Lerp every joint between two body poses. */
  private lerpPose(a: BodyPose, b: BodyPose, t: number): BodyPose {
    return {
      upperBody: Phaser.Math.Linear(a.upperBody, b.upperBody, t),
      shoulder:  Phaser.Math.Linear(a.shoulder,  b.shoulder,  t),
      sword:     Phaser.Math.Linear(a.sword,     b.sword,     t),
      backArm:   Phaser.Math.Linear(a.backArm,   b.backArm,   t),
      headDip:   Phaser.Math.Linear(a.headDip,   b.headDip,   t),
      hipShift:  Phaser.Math.Linear(a.hipShift,  b.hipShift,  t),
      hipDrop:   Phaser.Math.Linear(a.hipDrop,   b.hipDrop,   t),
      legLeft:   Phaser.Math.Linear(a.legLeft,   b.legLeft,   t),
      legRight:  Phaser.Math.Linear(a.legRight,  b.legRight,  t),
      kneeLeft:  Phaser.Math.Linear(a.kneeLeft,  b.kneeLeft,  t),
      kneeRight: Phaser.Math.Linear(a.kneeRight, b.kneeRight, t),
    };
  }

  /** True if the hero is currently mid-finisher (any phase except idle). */
  isFinisherActive(): boolean {
    return this.finisherPhase !== 'idle';
  }
  /** True if the hero is currently in the impact phase of the finisher.
   *  Used by the scene to apply the slam knockback + camera shake. */
  isFinisherImpact(): boolean {
    return this.finisherPhase === 'impact' || (this.comboStep === 2 && this.hitboxActive);
  }

  /**
   * Start a continuous moulinet sword swing. Called once when the attack state begins.
   *
   * The MOULINET is a classic European sword technique (also called "molinello") where the
   * wrist drives a tight circular rotation of the blade around the hand. The arm stays
   * mostly still — the SWORD itself spins in a vertical plane, with the tip and pommel
   * swapping positions on each rotation. This builds momentum, maintains constant pressure,
   * and lets the wielder chain cuts without breaking rhythm.
   *
   * Implementation:
   *  - Hold the shoulder/arm extended forward at chest level (small slow bob for life).
   *  - Continuously rotate the sword 360° around the hand at a fast linear speed.
   */
  private startFigureEightSwing(): void {
    if (!this.shoulderNode || !this.swordNode) return;
    const sNode = this.shoulderNode;
    const wNode = this.swordNode;
    this.scene.tweens.killTweensOf(sNode);
    this.scene.tweens.killTweensOf(wNode);

    // Arm extended forward in a "ready" position so the hand sits in front of the chest
    const SHOULDER_BASE = -55;
    const SHOULDER_BOB  = 8;     // small oscillation for liveliness
    const BOB_PERIOD    = 360;   // ms per bob cycle (slow)
    // Sword spins 360° per cycle. Faster = more aggressive.
    const SWORD_PERIOD  = 320;   // ms for one full revolution

    // Start with the sword pointing up from the hand (rest sword orientation)
    sNode.angle = SHOULDER_BASE - SHOULDER_BOB;
    wNode.angle = 0;

    // Reset the front/behind toggle and snap shoulderNode to the front of the body
    this.moulinetBehindBody = false;
    this.bodyGroup.bringToTop(sNode);

    // Subtle arm bob — keeps the silhouette alive without breaking the moulinet illusion
    this.scene.tweens.add({
      targets: sNode,
      angle: SHOULDER_BASE + SHOULDER_BOB,
      duration: BOB_PERIOD,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Continuous 360° wrist rotation — the moulinet itself.
    // Linear ease so the rotation speed is constant and the loop wraps cleanly.
    // Each full revolution the sword swaps between in-front-of and behind-the-body
    // by re-ordering the swing container within bodyGroup. The visual effect is
    // that the moulinet alternates between cutting in front and circling behind.
    this.scene.tweens.add({
      targets: wNode,
      angle: 360,
      duration: SWORD_PERIOD,
      ease: 'Linear',
      repeat: -1,
      onRepeat: () => {
        // Snap the wrap so the next cycle starts from 0
        wNode.angle = 0;
        // Toggle front/behind for the next revolution
        this.moulinetBehindBody = !this.moulinetBehindBody;
        if (this.moulinetBehindBody) {
          this.bodyGroup.sendToBack(sNode);
        } else {
          this.bodyGroup.bringToTop(sNode);
        }
      },
    });
  }

  // --- Projectile cast (necromancer, etc.) ---

  /** Attack speed multiplier from attackSpeedPoints (lower = faster, min 0.2). */
  private getAttackSpeedMultiplier(): number {
    return Math.max(0.2, 1 - this.attackSpeedPoints * 0.12);
  }

  private getScaledCastDuration(): number {
    return CAST_DURATION * this.getAttackSpeedMultiplier();
  }

  private getScaledCastCooldown(): number {
    return CAST_COOLDOWN * this.getAttackSpeedMultiplier();
  }

  private createCastState(): State {
    return {
      name: 'attack',
      enter: () => {
        if (this.castCooldown > 0) {
          this.sm.transition('idle');
          return;
        }
        this.castTimer = this.getScaledCastDuration();
        this.projectileFired = false;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.sprite.fillColor = this.accentColor;
      },
      exit: () => {
        this.sprite.fillColor = this.baseColor;
      },
      update: (delta: number) => {
        this.castTimer -= delta;

        const castDur = this.getScaledCastDuration();
        if (!this.projectileFired && this.castTimer <= castDur / 2) {
          this.projectileFired = true;
          this.fireProjectile();
        }

        if (this.castTimer <= 0) {
          this.castCooldown = this.getScaledCastCooldown();
          // If J is still held, immediately re-enter attack
          if (this.attackPressed) {
            this.sm.transition('idle');  // exit to reset state
            this.sm.transition('attack'); // re-enter cast
            return;
          }
          this.sm.transition('idle');
        }
      },
    };
  }

  private fireProjectile(): void {
    if (!this.spawnProjectile) return;
    const dirX = this.facingRight ? 1 : -1;
    const spawnX = this.x + dirX * 20;
    const spawnY = this.groundY - 20 + this.jumpZ;
    this.spawnProjectile(spawnX, spawnY, this.groundY, dirX, this.stats.attackPower);
  }

  // --- Hurt / Death ---

  private createHurtState(): State {
    return {
      name: 'hurt',
      enter: () => {
        this.playSheetAnim('HURT', false);
        this.hurtTimer = 300;
        // Apply knockback velocity if active, otherwise stop
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (this.knockbackTimer > 0) body.setVelocity(this.knockbackVx, 0);
        else body.setVelocity(0, 0);
        this.sprite.fillColor = 0xff3333;
        this.scene.tweens.add({ targets: this.sprite, alpha: 0.5, duration: 100, yoyo: true, repeat: 1 });
      },
      exit: () => { this.sprite.fillColor = this.baseColor; this.sprite.alpha = 1; },
      update: (delta: number) => {
        this.hurtTimer -= delta;
        // Continuously apply knockback velocity while it's active so the body slides
        if (this.knockbackTimer > 0) {
          (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.knockbackVx, 0);
        }
        if (this.hurtTimer <= 0) this.sm.transition('idle');
      },
    };
  }

  private createDeathState(): State {
    return {
      name: 'death',
      enter: () => {
        this.playSheetAnim('DEATH', false);
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
        this.deactivateHitbox();

        // Grey out the body
        this.sprite.fillColor = 0x555555;
        this.sprite.alpha = 0.6;

        // Rotate body group to lay on the ground
        this.scene.tweens.add({
          targets: this.bodyGroup,
          angle: 90,
          y: 10,  // shift down so it looks like lying on the ground
          duration: 400,
          ease: 'Bounce.easeOut',
        });

        // Draw X eyes over the face
        const xSize = this.heroClassId === 'necromancer' ? 4 : 5;
        const eyeY = this.heroClassId === 'necromancer' ? -38 : -28;
        const eyeX1 = this.heroClassId === 'necromancer' ? -3 : 4;
        const eyeX2 = this.heroClassId === 'necromancer' ? 3 : 8;

        // X eye left
        const xl1 = this.scene.add.line(0, 0, -xSize, -xSize, xSize, xSize, 0xff3333).setLineWidth(1.5);
        const xl2 = this.scene.add.line(0, 0, xSize, -xSize, -xSize, xSize, 0xff3333).setLineWidth(1.5);
        xl1.setPosition(eyeX1, eyeY);
        xl2.setPosition(eyeX1, eyeY);
        this.bodyGroup.add(xl1);
        this.bodyGroup.add(xl2);

        // X eye right
        const xr1 = this.scene.add.line(0, 0, -xSize, -xSize, xSize, xSize, 0xff3333).setLineWidth(1.5);
        const xr2 = this.scene.add.line(0, 0, xSize, -xSize, -xSize, xSize, 0xff3333).setLineWidth(1.5);
        xr1.setPosition(eyeX2, eyeY);
        xr2.setPosition(eyeX2, eyeY);
        this.bodyGroup.add(xr1);
        this.bodyGroup.add(xr2);

        EventBus.emit(Events.HERO_DIED);
      },
    };
  }
}
