import Phaser from 'phaser';
import { StateMachine, State } from '../systems/StateMachine';
import { EventBus, Events } from '../systems/EventBus';
import { Hero, GROUND_MIN_Y, GROUND_MAX_Y } from './Hero';

export interface EnemyStats {
  moveSpeed: number;
  maxHealth: number;
  attackPower: number;
  defense: number;
  detectionRange: number;
  attackRange: number;
  xpReward: number;
  goldReward: number;
}

const ATTACK_DURATION = 400;
const ATTACK_COOLDOWN = 800;
const HITBOX_START = 150;
const HITBOX_DURATION = 150;
const HURT_DURATION = 250;
const DEATH_DURATION = 500;

export class Enemy extends Phaser.GameObjects.Container {
  scene: Phaser.Scene;
  body!: Phaser.Physics.Arcade.Body;

  sprite!: Phaser.GameObjects.Shape;
  shadow: Phaser.GameObjects.Ellipse;
  bodyGroup: Phaser.GameObjects.Container;

  stats: EnemyStats;
  currentHealth: number;
  isDead = false;
  heroRef: Hero;
  id: number;

  // Ground position
  groundY: number;

  // Slow effect (1.0 = normal, 0.5 = half speed)
  speedMultiplier = 1.0;

  // Knockback state — when active, position is shoved away from the hit source
  knockbackTimer = 0;
  knockbackVx = 0;

  // Current target (set by ForestStage each frame to nearest hero/ghoul)
  targetX = 0;
  targetY = 0;
  targetIsDead = true;

  // Hitbox
  hitboxActive = false;
  hitboxTimer = 0;

  // Frozen — blocks movement and attacking
  isFrozen = false;

  // Health bar
  healthBarBg: Phaser.GameObjects.Rectangle;
  healthBarFill: Phaser.GameObjects.Rectangle;
  healthBarVisible = false;

  // State
  sm: StateMachine;
  facingRight = false;

  // Attack state
  attackTimer = 0;
  attackPhase: 'attack' | 'cooldown' = 'attack';
  hitHero = false;

  // Weapon pivot for swing animation (goblin stick)
  private weaponPivot: Phaser.GameObjects.Container | null = null;

  // Jointed legs for walk animation
  private legLeftPivot: Phaser.GameObjects.Container | null = null;
  private legRightPivot: Phaser.GameObjects.Container | null = null;
  private runCycleTime = 0;

  // Eye references (hidden on death, replaced with X's)
  private eyes: Phaser.GameObjects.GameObject[] = [];

  // Hurt state
  hurtTimer = 0;

  // Death state
  deathTimer = 0;

  private static nextId = 0;

  isBoss = false;
  bodyStyle = 'humanoid';

  // Damage reduction percentage (0..1), set externally for bosses
  damageReductionPct = 0;

  // Boss-specific attack timings (set by ForestStage based on stage)
  bossAttackDuration = 400;
  bossAttackCooldown = 800;

  // Per-enemy attack timing overrides (used for stage scaling)
  attackDurationOverride: number | null = null;
  attackCooldownOverride: number | null = null;

  // Boss special attack: ground smash
  smashCooldown = 0;
  smashTelegraphActive = false;
  smashTelegraphTimer = 0;
  pendingSmashDamage = 0;
  pendingSmashRange = 0;
  smashHasFired = false;

  // Boss club swing AOE
  clubSwingCooldown = 0;

  // Boss charge ability (unlocks at 50% HP)
  chargeCooldown = 0;
  chargeTelegraphActive = false;
  chargeTelegraphTimer = 0;
  chargeActive = false;
  chargeTimer = 0;
  chargeTargetX = 0;
  chargeHasHit = false;

  // Boss spore jump (amorphous bosses only)
  sporeJumpCooldown = 0;
  sporeJumpActive = false;
  sporeJumpTargetX = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    hero: Hero,
    stats: EnemyStats,
    color: number = 0x22aa44,
    isBoss: boolean = false,
    bodyStyle: string = 'humanoid',
  ) {
    super(scene, x, groundY);
    this.scene = scene;
    this.heroRef = hero;
    this.stats = { ...stats };
    this.currentHealth = stats.maxHealth;
    this.id = Enemy.nextId++;
    this.groundY = groundY;
    this.isBoss = isBoss;
    this.bodyStyle = bodyStyle;

    // Shadow
    this.shadow = scene.add.ellipse(0, 0, 22, 8, 0x000000, 0.3);
    this.add(this.shadow);

    // Body group
    this.bodyGroup = scene.add.container(0, 0);
    this.add(this.bodyGroup);

    // --- Derived color palette from the archetype color ---
    const cr = (color >> 16) & 0xff, cg = (color >> 8) & 0xff, cb = color & 0xff;
    const dark = (Math.max(0, cr - 0x20) << 16) | (Math.max(0, cg - 0x20) << 8) | Math.max(0, cb - 0x20);
    const light = (Math.min(0xff, cr + 0x15) << 16) | (Math.min(0xff, cg + 0x15) << 8) | Math.min(0xff, cb + 0x15);
    const accent = (Math.min(0xff, cr + 0x28) << 16) | (Math.min(0xff, cg + 0x28) << 8) | Math.min(0xff, cb + 0x28);
    const vdark = (Math.max(0, cr - 0x35) << 16) | (Math.max(0, cg - 0x35) << 8) | Math.max(0, cb - 0x35);

    // --- BODY STYLE DISPATCH ---
    // Each body style creates a fundamentally different silhouette.
    switch (bodyStyle) {
      case 'beast':
        this.buildBeastBody(scene, color, dark, light, accent, vdark);
        break;
      case 'flying':
        this.buildFlyingBody(scene, color, dark, light, accent, vdark);
        break;
      case 'amorphous':
        this.buildAmorphousBody(scene, color, dark, light, accent, vdark);
        break;
      case 'mechanical':
        this.buildMechanicalBody(scene, color, dark, light, accent, vdark);
        break;
      case 'large_humanoid':
        this.buildLargeHumanoidBody(scene, color, dark, light, accent, vdark);
        break;
      case 'plant':
        this.buildPlantBody(scene, color, dark, light, accent, vdark);
        break;
      case 'raider':
        this.buildRaiderBody(scene, color, dark, light, accent, vdark);
        break;
      case 'shaman':
        this.buildShamanBody(scene, color, dark, light, accent, vdark);
        break;
      default: // 'humanoid'
        this.buildHumanoidBody(scene, color, dark, light, accent, vdark);
        break;
    }

    // Health bar (above head) — initialize with the correct width based on isBoss
    const barW = this.isBoss ? 100 : 24;
    this.healthBarBg = scene.add.rectangle(0, -46, barW, 4, 0x333333);
    // Fill is left-anchored so it drains cleanly without repositioning
    this.healthBarFill = scene.add.rectangle(-barW / 2, -46, barW, 4, 0x44cc44).setOrigin(0, 0.5);
    this.bodyGroup.add(this.healthBarBg);
    this.bodyGroup.add(this.healthBarFill);
    this.healthBarBg.visible = false;
    this.healthBarFill.visible = false;

    // Boss scaling — make it 5x bigger and add a red glow
    if (this.isBoss) {
      this.bodyGroup.setScale(3.75);
      this.shadow.setScale(3.75, 3.75);
      this.shadow.fillColor = 0x440000;
      this.shadow.alpha = 0.5;

      // Boss aura (dark red glow)
      const aura = scene.add.circle(0, -25, 60, 0xff2244, 0.15);
      this.bodyGroup.add(aura);
      scene.tweens.add({
        targets: aura,
        scaleX: 1.3, scaleY: 1.3, alpha: 0.05,
        duration: 800, yoyo: true, repeat: -1,
      });
    }

    // Physics — bigger collision box for bosses
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.isBoss) {
      body.setSize(75, 45);
      body.setOffset(-37.5, -22.5);
    } else {
      body.setSize(20, 14);
      body.setOffset(-10, -7);
    }

    // State machine
    this.sm = new StateMachine();
    this.sm.addState(this.createIdleState());
    this.sm.addState(this.createChaseState());
    this.sm.addState(this.createAttackState());
    this.sm.addState(this.createHurtState());
    this.sm.addState(this.createDeathState());
    this.sm.transition('idle');
  }

  // =================================================================
  // BODY BUILDERS — each creates a fundamentally different silhouette
  // =================================================================

  /** HUMANOID: upright goblin/soldier body with two legs, two arms, weapon. */
  private buildHumanoidBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Body
    this.bodyGroup.add(scene.add.rectangle(0, -8, 20, 16, dark));
    const upper = scene.add.rectangle(0, -20, 18, 14, light);
    this.bodyGroup.add(upper);
    this.sprite = upper;
    // Loincloth / belt
    this.bodyGroup.add(scene.add.rectangle(0, -2, 14, 6, 0x664422));
    // Head
    this.bodyGroup.add(scene.add.circle(0, -32, 10, accent));
    // Pointy ears
    this.bodyGroup.add(scene.add.triangle(-12, -34, 0, 6, 6, 0, 3, -4, accent));
    this.bodyGroup.add(scene.add.triangle(12, -34, 0, 6, 6, 0, 3, -4, accent));
    // Nose
    this.bodyGroup.add(scene.add.circle(3, -30, 3, dark));
    // Eyes
    const eyeL = scene.add.circle(-3, -34, 2.5, 0x111111);
    const eyeR = scene.add.circle(4, -34, 2.5, 0x111111);
    const pupilL = scene.add.circle(-3, -34, 1.5, 0xffdd22);
    const pupilR = scene.add.circle(4, -34, 1.5, 0xffdd22);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    this.bodyGroup.add(pupilL); this.bodyGroup.add(pupilR);
    this.eyes = [eyeL, eyeR, pupilL, pupilR];
    // Teeth
    this.bodyGroup.add(scene.add.rectangle(-2, -27, 2, 3, 0xeeeedd));
    this.bodyGroup.add(scene.add.rectangle(2, -27, 2, 3, 0xeeeedd));
    // Arms
    this.bodyGroup.add(scene.add.rectangle(-12, -14, 6, 14, light));
    this.bodyGroup.add(scene.add.rectangle(12, -14, 6, 14, light));
    // Weapon
    this.weaponPivot = scene.add.container(12, -14);
    this.bodyGroup.add(this.weaponPivot);
    const stick = scene.add.rectangle(0, -16, 3, 30, 0x775533).setOrigin(0.5, 1);
    this.weaponPivot.add(stick);
    this.weaponPivot.add(scene.add.circle(0, -31, 3, 0x664422));
    // Legs
    const buildLeg = (hx: number) => {
      const hip = scene.add.container(hx, -2); this.bodyGroup.add(hip);
      hip.add(scene.add.rectangle(0, 4, 6, 8, dark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(0, 11, 5, 6, vdark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(1, 17, 7, 3, 0x553311));
      return hip;
    };
    this.legLeftPivot = buildLeg(-5);
    this.legRightPivot = buildLeg(5);
  }

  /** BEAST: four-legged animal (boar/wolf). Low, wide, horizontal body. */
  private buildBeastBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Wide horizontal torso (low to ground)
    const torso = scene.add.rectangle(0, -10, 32, 14, light);
    this.bodyGroup.add(torso);
    this.sprite = torso;
    // Belly
    this.bodyGroup.add(scene.add.rectangle(0, -5, 28, 8, dark));
    // Head (thrust forward, broader)
    this.bodyGroup.add(scene.add.ellipse(16, -14, 14, 11, accent));
    // Snout
    this.bodyGroup.add(scene.add.ellipse(22, -12, 8, 6, dark));
    // Eyes (beady, on sides of head)
    const eyeL = scene.add.circle(14, -17, 2, 0x111111);
    const pupilL = scene.add.circle(14, -17, 1.2, 0xffdd22);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(pupilL);
    this.eyes = [eyeL, pupilL];
    // Tusks / fangs
    this.bodyGroup.add(scene.add.rectangle(24, -9, 2, 4, 0xeeeedd));
    this.bodyGroup.add(scene.add.rectangle(21, -9, 2, 3, 0xeeeedd));
    // Back ridge / bristles
    for (let i = 0; i < 4; i++) {
      const bx = -8 + i * 7;
      this.bodyGroup.add(scene.add.triangle(bx, -17, -2, 4, 0, -3, 2, 4, vdark));
    }
    // Four legs (short, sturdy)
    const buildBeastLeg = (hx: number) => {
      const hip = scene.add.container(hx, -3); this.bodyGroup.add(hip);
      hip.add(scene.add.rectangle(0, 2, 5, 8, dark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(0, 9, 4, 5, vdark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(0, 14, 6, 3, 0x553311));
      return hip;
    };
    this.legLeftPivot = buildBeastLeg(-10);
    this.legRightPivot = buildBeastLeg(10);
    // Also front legs (static, no animation pivot needed)
    buildBeastLeg(-6); buildBeastLeg(6);
    // Tail
    this.bodyGroup.add(scene.add.rectangle(-17, -14, 6, 3, dark));
    // Wider shadow
    this.shadow.setScale(1.5, 1);
    // No weapon pivot for beasts
    this.weaponPivot = null;
  }

  /** FLYING: small winged creature (sprite/bat). Floats above ground, wings visible. */
  private buildFlyingBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, _vdark: number): void {
    // Small round body (higher up — floats)
    const body = scene.add.circle(0, -22, 7, light);
    this.bodyGroup.add(body);
    this.sprite = body;
    // Head (merged with body — fairy-like)
    this.bodyGroup.add(scene.add.circle(0, -30, 6, accent));
    // Eyes (large, luminous)
    const eyeL = scene.add.circle(-3, -31, 2, 0x111111);
    const eyeR = scene.add.circle(3, -31, 2, 0x111111);
    const pupilL = scene.add.circle(-3, -31, 1.2, 0x88ffaa);
    const pupilR = scene.add.circle(3, -31, 1.2, 0x88ffaa);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    this.bodyGroup.add(pupilL); this.bodyGroup.add(pupilR);
    this.eyes = [eyeL, eyeR, pupilL, pupilR];
    // Wings (two triangle shapes on each side)
    const wingL = scene.add.triangle(-10, -24, 0, 8, -12, -4, -8, 10, accent);
    wingL.setAlpha(0.7);
    this.bodyGroup.add(wingL);
    const wingR = scene.add.triangle(10, -24, 0, 8, 12, -4, 8, 10, accent);
    wingR.setAlpha(0.7);
    this.bodyGroup.add(wingR);
    // Wing flap animation
    scene.tweens.add({ targets: wingL, scaleX: { from: 1, to: 0.3 }, duration: 200, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: wingR, scaleX: { from: 1, to: 0.3 }, duration: 200, yoyo: true, repeat: -1, delay: 50 });
    // Glow aura
    const glow = scene.add.circle(0, -25, 12, accent, 0.15);
    this.bodyGroup.add(glow);
    scene.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.05 }, scaleX: 1.3, scaleY: 1.3, duration: 800, yoyo: true, repeat: -1 });
    // Tiny dangling legs (vestigial)
    this.bodyGroup.add(scene.add.rectangle(-2, -16, 2, 5, dark));
    this.bodyGroup.add(scene.add.rectangle(2, -16, 2, 5, dark));
    // Smaller shadow (floating)
    this.shadow.setScale(0.6, 0.4);
    this.shadow.y = 5; // shadow further from body since floating
    // No legs or weapon for flying
    this.legLeftPivot = null;
    this.legRightPivot = null;
    this.weaponPivot = null;
  }

  /** AMORPHOUS: blob/mushroom creature. No distinct limbs, wobbly shape. */
  private buildAmorphousBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Mushroom cap / dome top
    const cap = scene.add.ellipse(0, -24, 24, 16, accent);
    this.bodyGroup.add(cap);
    // Cap spots
    this.bodyGroup.add(scene.add.circle(-5, -28, 3, light, 0.5));
    this.bodyGroup.add(scene.add.circle(4, -26, 2, light, 0.5));
    this.bodyGroup.add(scene.add.circle(-2, -22, 2.5, light, 0.4));
    // Stalk body
    const stalk = scene.add.rectangle(0, -10, 14, 16, dark);
    this.bodyGroup.add(stalk);
    this.sprite = stalk;
    // Skirt / base ring
    this.bodyGroup.add(scene.add.ellipse(0, -3, 18, 6, vdark));
    // Eyes (peering from under cap)
    const eyeL = scene.add.circle(-4, -18, 2.5, 0x111111);
    const eyeR = scene.add.circle(4, -18, 2.5, 0x111111);
    const pupilL = scene.add.circle(-4, -18, 1.5, 0xffdd22);
    const pupilR = scene.add.circle(4, -18, 1.5, 0xffdd22);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    this.bodyGroup.add(pupilL); this.bodyGroup.add(pupilR);
    this.eyes = [eyeL, eyeR, pupilL, pupilR];
    // Wobble animation — applied to individual parts, not the bodyGroup,
    // so it doesn't conflict with boss scaling on the bodyGroup
    scene.tweens.add({ targets: cap, scaleX: { from: 0.93, to: 1.07 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: stalk, scaleX: { from: 0.96, to: 1.04 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // No legs or weapon
    this.legLeftPivot = null;
    this.legRightPivot = null;
    this.weaponPivot = null;
    // Rounder shadow
    this.shadow.setScale(1.1, 0.8);
  }

  /** MECHANICAL: construct/turret. Angular, rigid, metallic silhouette. */
  private buildMechanicalBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Boxy body
    const body = scene.add.rectangle(0, -14, 22, 20, dark);
    this.bodyGroup.add(body);
    this.sprite = body;
    // Metal plate (lighter center panel)
    this.bodyGroup.add(scene.add.rectangle(0, -14, 16, 14, light));
    // Head (small, angular — visor)
    this.bodyGroup.add(scene.add.rectangle(0, -28, 14, 8, accent));
    // Visor slit
    const eyeL = scene.add.rectangle(-3, -28, 5, 2, 0xffaa22);
    const eyeR = scene.add.rectangle(3, -28, 5, 2, 0xffaa22);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    this.eyes = [eyeL, eyeR];
    // Shoulder plates
    this.bodyGroup.add(scene.add.rectangle(-13, -20, 6, 8, vdark));
    this.bodyGroup.add(scene.add.rectangle(13, -20, 6, 8, vdark));
    // Arms (rigid, angular)
    this.bodyGroup.add(scene.add.rectangle(-14, -12, 5, 12, dark));
    this.bodyGroup.add(scene.add.rectangle(14, -12, 5, 12, dark));
    // Weapon arm (cannon/blade)
    this.weaponPivot = scene.add.container(14, -12);
    this.bodyGroup.add(this.weaponPivot);
    this.weaponPivot.add(scene.add.rectangle(0, -10, 4, 18, 0x6a6a6a).setOrigin(0.5, 1));
    this.weaponPivot.add(scene.add.rectangle(0, -22, 6, 4, 0x888888));
    // Legs (rigid pistons)
    const buildMechLeg = (hx: number) => {
      const hip = scene.add.container(hx, -4); this.bodyGroup.add(hip);
      hip.add(scene.add.rectangle(0, 3, 6, 10, vdark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(0, 12, 5, 6, dark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(0, 18, 8, 3, 0x555555));
      return hip;
    };
    this.legLeftPivot = buildMechLeg(-6);
    this.legRightPivot = buildMechLeg(6);
  }

  /** LARGE_HUMANOID: tall, imposing humanoid (captain/boss). Similar to humanoid but bigger proportions. */
  private buildLargeHumanoidBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Larger body
    this.bodyGroup.add(scene.add.rectangle(0, -10, 26, 20, dark));
    const upper = scene.add.rectangle(0, -24, 24, 18, light);
    this.bodyGroup.add(upper);
    this.sprite = upper;
    // Armor/belt
    this.bodyGroup.add(scene.add.rectangle(0, -2, 20, 6, 0x5a4422));
    this.bodyGroup.add(scene.add.rectangle(0, -18, 20, 4, 0x6a5a3a)); // chest plate
    // Head (larger, helmeted look)
    this.bodyGroup.add(scene.add.circle(0, -38, 12, accent));
    this.bodyGroup.add(scene.add.rectangle(0, -42, 18, 6, vdark)); // helmet brim
    // Eyes
    const eyeL = scene.add.circle(-4, -38, 2.5, 0x111111);
    const eyeR = scene.add.circle(4, -38, 2.5, 0x111111);
    const pupilL = scene.add.circle(-4, -38, 1.5, 0xff4422);
    const pupilR = scene.add.circle(4, -38, 1.5, 0xff4422);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    this.bodyGroup.add(pupilL); this.bodyGroup.add(pupilR);
    this.eyes = [eyeL, eyeR, pupilL, pupilR];
    // Arms (beefy)
    this.bodyGroup.add(scene.add.rectangle(-16, -18, 8, 18, light));
    this.bodyGroup.add(scene.add.rectangle(16, -18, 8, 18, light));
    // Weapon (larger)
    this.weaponPivot = scene.add.container(16, -18);
    this.bodyGroup.add(this.weaponPivot);
    this.weaponPivot.add(scene.add.rectangle(0, -18, 4, 34, 0x6a6a6a).setOrigin(0.5, 1));
    this.weaponPivot.add(scene.add.rectangle(0, -36, 10, 6, 0x888888));
    // Legs
    const buildLeg = (hx: number) => {
      const hip = scene.add.container(hx, -2); this.bodyGroup.add(hip);
      hip.add(scene.add.rectangle(0, 4, 8, 10, dark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(0, 13, 7, 8, vdark).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(1, 21, 9, 3, 0x553311));
      return hip;
    };
    this.legLeftPivot = buildLeg(-7);
    this.legRightPivot = buildLeg(7);
    // Larger shadow
    this.shadow.setScale(1.4, 1.1);
  }

  /** SHAMAN: thin robed caster with staff. Hunched posture, flowing robes,
   *  antler/bone headdress, glowing spell orb on staff. Reads as magic support. */
  private buildShamanBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Flowing robe (wide at bottom, narrow at top — not boxy)
    const g = scene.add.graphics();
    this.bodyGroup.add(g);
    // Robe body (trapezoid — wide skirt, narrow shoulders)
    g.fillStyle(dark, 1);
    g.beginPath();
    g.moveTo(-6, -28); g.lineTo(6, -28);   // shoulders
    g.lineTo(12, 0); g.lineTo(-12, 0);      // robe hem
    g.closePath(); g.fillPath();
    // Robe sash/belt
    g.fillStyle(accent, 0.8);
    g.fillRect(-7, -14, 14, 3);
    // Robe trim at bottom
    g.fillStyle(light, 0.4);
    g.fillRect(-11, -2, 22, 2);

    // Reference sprite for color flash
    const robeCenter = scene.add.rectangle(0, -14, 12, 20, dark, 0);
    this.bodyGroup.add(robeCenter);
    this.sprite = robeCenter;

    // Arms (thin, held out to sides)
    g.fillStyle(dark, 0.9);
    g.fillRect(-10, -24, 4, 12); // left arm
    g.fillRect(6, -24, 4, 12);   // right arm
    // Bony hands
    g.fillStyle(0x8a7a5a, 0.8);
    g.fillCircle(-10, -13, 2);
    g.fillCircle(8, -13, 2);

    // Head — skull-like face with antler headdress
    g.fillStyle(0x7a6a5a, 1); // pale/bone-colored face
    g.fillCircle(0, -34, 7);
    // Hollow eyes (dark, sunken)
    const eyeL = scene.add.circle(-3, -35, 2.5, 0x111111);
    const eyeR = scene.add.circle(3, -35, 2.5, 0x111111);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    // Glowing green pupils
    const pupilL = scene.add.circle(-3, -35, 1.3, 0x44ff44);
    const pupilR = scene.add.circle(3, -35, 1.3, 0x44ff44);
    this.bodyGroup.add(pupilL); this.bodyGroup.add(pupilR);
    this.eyes = [eyeL, eyeR, pupilL, pupilR];
    // Antler/bone headdress
    g.fillStyle(0x8a7a5a, 0.9);
    // Left antler
    g.beginPath();
    g.moveTo(-5, -40); g.lineTo(-12, -52); g.lineTo(-8, -48);
    g.lineTo(-14, -56); g.lineTo(-6, -46); g.lineTo(-4, -40);
    g.closePath(); g.fillPath();
    // Right antler
    g.beginPath();
    g.moveTo(5, -40); g.lineTo(12, -52); g.lineTo(8, -48);
    g.lineTo(14, -56); g.lineTo(6, -46); g.lineTo(4, -40);
    g.closePath(); g.fillPath();

    // STAFF — held in left hand, tall with glowing orb
    this.weaponPivot = scene.add.container(-10, -14);
    this.bodyGroup.add(this.weaponPivot);
    // Staff shaft (tall, wooden)
    const shaft = scene.add.rectangle(-2, -18, 3, 34, 0x5a4020).setOrigin(0.5, 1);
    this.weaponPivot.add(shaft);
    // Gnarled top (forked)
    const staffG = scene.add.graphics();
    this.weaponPivot.add(staffG);
    staffG.fillStyle(0x5a4020, 1);
    staffG.beginPath();
    staffG.moveTo(-4, -30); staffG.lineTo(-2, -36); staffG.lineTo(0, -30);
    staffG.closePath(); staffG.fillPath();
    staffG.beginPath();
    staffG.moveTo(-1, -30); staffG.lineTo(1, -36); staffG.lineTo(3, -30);
    staffG.closePath(); staffG.fillPath();
    // Glowing spell orb nestled in fork
    const orb = scene.add.circle(-1, -34, 4, 0x44ff44, 0.7);
    this.weaponPivot.add(orb);
    const orbGlow = scene.add.circle(-1, -34, 8, 0x44ff44, 0.15);
    this.weaponPivot.add(orbGlow);
    // Orb pulse
    scene.tweens.add({
      targets: orbGlow, alpha: { from: 0.15, to: 0.35 },
      scaleX: { from: 1, to: 1.3 }, scaleY: { from: 1, to: 1.3 },
      duration: 800, yoyo: true, repeat: -1,
    });

    // No visible legs (hidden under robe) — use small shuffle feet
    const buildFoot = (hx: number) => {
      const hip = scene.add.container(hx, -1); this.bodyGroup.add(hip);
      hip.add(scene.add.rectangle(0, 1, 6, 3, vdark));
      return hip;
    };
    this.legLeftPivot = buildFoot(-4);
    this.legRightPivot = buildFoot(4);

    // Taller, thinner shadow
    this.shadow.setScale(0.7, 0.5);

    // Floating spell particles around the shaman
    for (let p = 0; p < 3; p++) {
      const px = Phaser.Math.Between(-12, 12);
      const py = -20 + Phaser.Math.Between(-10, 10);
      const particle = scene.add.circle(px, py, 1.5, 0x44ff44, 0.4);
      this.bodyGroup.add(particle);
      scene.tweens.add({
        targets: particle,
        x: px + Phaser.Math.Between(-8, 8),
        y: py + Phaser.Math.Between(-8, 8),
        alpha: { from: 0.4, to: 0.1 },
        duration: 1500 + p * 400, yoyo: true, repeat: -1,
      });
    }
  }

  /** RAIDER: human-proportioned outlaw/bandit. Taller than goblin, upright posture,
   *  hooded head, leather vest, visible axe/club weapon. Reads as human brigand. */
  private buildRaiderBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Taller, upright human proportions (not squat goblin)
    // Legs (behind torso)
    const buildLeg = (hx: number) => {
      const hip = scene.add.container(hx, -6); this.bodyGroup.add(hip);
      // Pants/trousers
      hip.add(scene.add.rectangle(0, 3, 7, 12, vdark).setOrigin(0.5, 0));
      // Boots (taller than goblin feet)
      hip.add(scene.add.rectangle(0, 14, 6, 8, 0x3a2a1a).setOrigin(0.5, 0));
      hip.add(scene.add.rectangle(1, 22, 8, 3, 0x2a1a0e));
      return hip;
    };
    this.legLeftPivot = buildLeg(-5);
    this.legRightPivot = buildLeg(5);

    // Torso — leather vest over cloth (rectangular, not round)
    this.bodyGroup.add(scene.add.rectangle(0, -12, 18, 18, dark));  // undershirt
    const vest = scene.add.rectangle(0, -14, 20, 16, light);
    this.bodyGroup.add(vest);
    this.sprite = vest;
    // Belt with buckle
    this.bodyGroup.add(scene.add.rectangle(0, -5, 20, 3, 0x3a2a1a));
    this.bodyGroup.add(scene.add.rectangle(0, -5, 4, 3, 0x888855)); // buckle

    // Shoulders (broad, padded)
    this.bodyGroup.add(scene.add.rectangle(-12, -20, 8, 6, dark));
    this.bodyGroup.add(scene.add.rectangle(12, -20, 8, 6, dark));

    // Arms (longer than goblin, human-proportioned)
    this.bodyGroup.add(scene.add.rectangle(-14, -14, 5, 14, dark));
    this.bodyGroup.add(scene.add.rectangle(14, -14, 5, 14, dark));
    // Gloves/wraps
    this.bodyGroup.add(scene.add.rectangle(-14, -4, 5, 4, 0x3a2a1a));
    this.bodyGroup.add(scene.add.rectangle(14, -4, 5, 4, 0x3a2a1a));

    // Head — hooded/masked (no pointy ears, no bulbous nose)
    // Hood (triangular, pulled over head)
    const g = scene.add.graphics();
    this.bodyGroup.add(g);
    g.fillStyle(accent, 1);
    g.beginPath();
    g.moveTo(-9, -24); g.lineTo(0, -38); g.lineTo(9, -24);
    g.closePath(); g.fillPath();
    // Face shadow under hood
    g.fillStyle(vdark, 0.8);
    g.fillRect(-6, -28, 12, 6);
    // Eyes (narrow slits in shadow — menacing, not cute)
    const eyeL = scene.add.rectangle(-3, -26, 3, 1.5, 0xddddaa);
    const eyeR = scene.add.rectangle(3, -26, 3, 1.5, 0xddddaa);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    this.eyes = [eyeL, eyeR];
    // Mask/bandana across lower face
    g.fillStyle(dark, 0.7);
    g.fillRect(-5, -24, 10, 3);

    // Weapon — short axe held in right hand
    this.weaponPivot = scene.add.container(14, -10);
    this.bodyGroup.add(this.weaponPivot);
    // Axe handle
    const handle = scene.add.rectangle(0, -12, 3, 22, 0x5a4020).setOrigin(0.5, 1);
    this.weaponPivot.add(handle);
    // Axe head (angular blade shape)
    const axeG = scene.add.graphics();
    this.weaponPivot.add(axeG);
    axeG.fillStyle(0x8a8a8a, 1);
    axeG.beginPath();
    axeG.moveTo(-1, -20); axeG.lineTo(8, -24); axeG.lineTo(8, -16); axeG.lineTo(-1, -18);
    axeG.closePath(); axeG.fillPath();
    // Axe edge highlight
    axeG.lineStyle(1, 0xaaaaaa, 0.6);
    axeG.lineBetween(8, -24, 8, -16);

    // Human-proportioned shadow
    this.shadow.setScale(1.0, 0.7);
  }

  /** PLANT: tall plant-creature with elongated throwing arm, vine-like limbs,
   *  leaf crest head. Distinct from humanoid — taller, thinner, organic curves. */
  private buildPlantBody(scene: Phaser.Scene, _base: number, dark: number, light: number, accent: number, vdark: number): void {
    // Tall narrow stalk torso (not boxy like humanoid)
    const stalk = scene.add.rectangle(0, -18, 10, 28, dark);
    this.bodyGroup.add(stalk);
    this.sprite = stalk;
    // Bark-textured midsection (wider, organic)
    this.bodyGroup.add(scene.add.ellipse(0, -14, 14, 18, light));
    // Shoulder vine knots
    this.bodyGroup.add(scene.add.circle(-8, -28, 4, dark));
    this.bodyGroup.add(scene.add.circle(8, -28, 4, dark));

    // Head — leaf crest (not a round goblin head)
    // Pointed leaf-shaped head rising upward
    const g = scene.add.graphics();
    this.bodyGroup.add(g);
    g.fillStyle(accent, 1);
    g.beginPath();
    g.moveTo(-6, -34); g.lineTo(0, -48); g.lineTo(6, -34);  // central leaf spike
    g.closePath(); g.fillPath();
    g.fillStyle(light, 0.9);
    g.beginPath();
    g.moveTo(-8, -32); g.lineTo(-4, -42); g.lineTo(0, -32);  // left leaf
    g.closePath(); g.fillPath();
    g.beginPath();
    g.moveTo(0, -32); g.lineTo(4, -42); g.lineTo(8, -32);   // right leaf
    g.closePath(); g.fillPath();
    // Face — two glowing slit eyes (plant-like, not round goblin eyes)
    const eyeL = scene.add.rectangle(-3, -33, 3, 1.5, 0xaaff44);
    const eyeR = scene.add.rectangle(3, -33, 3, 1.5, 0xaaff44);
    this.bodyGroup.add(eyeL); this.bodyGroup.add(eyeR);
    this.eyes = [eyeL, eyeR];

    // LEFT ARM — short, held close (off-hand)
    this.bodyGroup.add(scene.add.rectangle(-10, -22, 4, 12, dark));

    // RIGHT ARM — elongated throwing arm with thorn bundle
    const throwArm = scene.add.container(10, -26);
    this.bodyGroup.add(throwArm);
    // Upper arm (vine-like, curved)
    throwArm.add(scene.add.rectangle(3, 0, 4, 14, light).setOrigin(0.5, 0));
    // Forearm (longer, thinner)
    throwArm.add(scene.add.rectangle(5, 12, 3, 12, dark).setOrigin(0.5, 0));
    // Thorn bundle in hand (cluster of sharp spikes)
    const thornG = scene.add.graphics();
    throwArm.add(thornG);
    thornG.fillStyle(0x886633, 1);
    thornG.fillTriangle(3, 22, 7, 14, 11, 22); // thorn 1
    thornG.fillTriangle(1, 20, 5, 12, 9, 20);  // thorn 2
    thornG.fillTriangle(5, 24, 9, 16, 13, 24); // thorn 3
    // Use throwArm as weapon pivot for attack animation
    this.weaponPivot = throwArm;

    // Legs — root-like, splitting from the stalk base (not human legs)
    const buildRootLeg = (hx: number) => {
      const hip = scene.add.container(hx, -4); this.bodyGroup.add(hip);
      // Root thigh (tapered, organic)
      const rootG = scene.add.graphics();
      hip.add(rootG);
      rootG.fillStyle(vdark, 1);
      rootG.beginPath();
      rootG.moveTo(-3, 0); rootG.lineTo(-1, 10); rootG.lineTo(3, 12); rootG.lineTo(4, 0);
      rootG.closePath(); rootG.fillPath();
      // Root foot (spreading tendrils)
      rootG.fillStyle(vdark, 0.8);
      rootG.fillTriangle(-2, 11, 0, 15, 2, 11);
      rootG.fillTriangle(1, 12, 4, 16, 5, 12);
      return hip;
    };
    this.legLeftPivot = buildRootLeg(-4);
    this.legRightPivot = buildRootLeg(4);

    // Taller, narrower shadow
    this.shadow.setScale(0.8, 0.6);
  }

  update(_time: number, delta: number): void {
    // Frozen — completely still, skip all logic
    if (this.isFrozen) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.knockbackTimer = 0;
      this.knockbackVx = 0;
      return;
    }

    // Tick knockback. While active, it overrides any movement set by the state machine.
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= delta;
      this.knockbackVx *= 0.88;  // smooth slide deceleration
      if (this.knockbackTimer <= 0) {
        this.knockbackTimer = 0;
        this.knockbackVx = 0;
      } else {
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.knockbackVx, 0);
      }
    }
    this.sm.update(delta);
    // While knockback is still active, force the velocity AGAIN after sm.update()
    // since chase state writes velocity every frame.
    if (this.knockbackTimer > 0) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.knockbackVx, 0);
    }

    // --- Leg walk animation ---
    if (this.legLeftPivot && this.legRightPivot && !this.isDead) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const speed = Math.abs(body.velocity.x) + Math.abs(body.velocity.y);
      if (speed > 10) {
        // Running — alternate legs with a sine wave
        this.runCycleTime += delta;
        const stride = 30; // degrees
        const period = 220; // ms per full cycle
        const phase = (this.runCycleTime / period) * Math.PI * 2;
        this.legLeftPivot.angle = Math.sin(phase) * stride;
        this.legRightPivot.angle = Math.sin(phase + Math.PI) * stride;
      } else {
        // Standing still — settle legs back to rest
        this.runCycleTime = 0;
        this.legLeftPivot.angle *= 0.8;
        this.legRightPivot.angle *= 0.8;
        if (Math.abs(this.legLeftPivot.angle) < 0.5) this.legLeftPivot.angle = 0;
        if (Math.abs(this.legRightPivot.angle) < 0.5) this.legRightPivot.angle = 0;
      }
    }
    // Depth sort
    this.setDepth(this.groundY);
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    let actual = Math.max(amount - this.stats.defense, 1);
    // Apply percentage damage reduction (e.g. for bosses)
    if (this.damageReductionPct > 0) {
      actual = Math.max(Math.floor(actual * (1 - this.damageReductionPct)), 1);
    }
    this.currentHealth = Math.max(this.currentHealth - actual, 0);
    this.updateHealthBar();

    if (this.currentHealth <= 0) {
      this.isDead = true;
      this.sm.transition('death');
    } else {
      this.sm.transition('hurt');
    }
  }

  /**
   * Global enemy knockback scale. Every knockback force applied to enemies
   * is multiplied by this value. Adjust here to tune knockback across the
   * entire game in one place. 1.0 = original, 0.5 = half strength.
   */
  static readonly KNOCKBACK_SCALE = 0.5;

  /** Apply a knockback impulse pushing this enemy away from sourceX. */
  applyKnockback(sourceX: number, force: number = 280): void {
    if (this.isDead) return;
    const scaled = force * Enemy.KNOCKBACK_SCALE;
    // Bosses are heavy — they resist knockback strongly
    const effective = this.isBoss ? scaled * 0.15 : scaled;
    const dir = this.x >= sourceX ? 1 : -1;
    this.knockbackVx = dir * effective;
    this.knockbackTimer = 200;  // ms
  }

  updateHealthBarPublic(): void { this.updateHealthBar(); }

  private updateHealthBar(): void {
    if (!this.healthBarVisible) {
      this.healthBarBg.visible = true;
      this.healthBarFill.visible = true;
      this.healthBarVisible = true;
    }
    const pct = Math.max(0, this.currentHealth / this.stats.maxHealth);
    const fullW = this.isBoss ? 100 : 24;
    this.healthBarFill.width = fullW * pct;
  }

  /** Distance to current target on the ground plane */
  private groundDistToTarget(): number {
    return Phaser.Math.Distance.Between(this.x, this.groundY, this.targetX, this.targetY);
  }

  private faceTarget(): void {
    const scale = this.isBoss ? 3.75 : 1;
    const dx = this.targetX - this.x;
    if (dx > 0) {
      this.facingRight = true;
      this.bodyGroup.setScale(scale, scale);
    } else {
      this.facingRight = false;
      this.bodyGroup.setScale(-scale, scale);
    }
  }

  private clampToGroundLane(): void {
    // Use walk mask if available on the scene
    const walkMask = (this.scene as any).walkMask;
    if (walkMask && walkMask.isLoaded) {
      if (!walkMask.isWalkable(this.x, this.y)) {
        const clamped = walkMask.clampToWalkable(this.x, this.y);
        this.x = clamped.x;
        this.y = clamped.y;
      }
    } else {
      if (this.y < GROUND_MIN_Y) this.y = GROUND_MIN_Y;
      if (this.y > GROUND_MAX_Y) this.y = GROUND_MAX_Y;
    }
    this.groundY = this.y;
  }

  activateHitbox(): void {
    this.hitboxActive = true;
    this.hitHero = false;
  }

  deactivateHitbox(): void {
    this.hitboxActive = false;
  }

  getHitboxWorldPosition(): { x: number; y: number; w: number; h: number } {
    const scale = this.isBoss ? 3.75 : 1;
    const offsetX = this.facingRight ? 20 * scale : -42 * scale;
    return {
      x: this.x + offsetX,
      y: this.groundY - 36 * scale,
      w: 22 * scale,
      h: 36 * scale,
    };
  }

  getBodyWorldRect(): Phaser.Geom.Rectangle {
    const scale = this.isBoss ? 3.75 : 1;
    return new Phaser.Geom.Rectangle(
      this.x - 10 * scale,
      this.groundY - 36 * scale,
      20 * scale,
      36 * scale,
    );
  }

  // --- States ---

  private createIdleState(): State {
    return {
      name: 'idle',
      enter: () => {
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      },
      update: () => {
        if (this.targetIsDead) return;
        if (this.groundDistToTarget() < this.stats.detectionRange) {
          this.sm.transition('chase');
          return;
        }
        // Walk toward the hero outside detection range at full speed
        // so enemies spawned off-screen close the gap quickly
        if (this.groundDistToTarget() > this.stats.detectionRange) {
          const body = this.body as Phaser.Physics.Arcade.Body;
          const dx = this.targetX - this.x;
          // Use full move speed (minimum 100) so even slow enemies arrive promptly
          const approachSpeed = Math.max(100, this.stats.moveSpeed) * this.speedMultiplier;
          body.setVelocityX(dx > 0 ? approachSpeed : -approachSpeed);
          this.facingRight = dx > 0;
          this.bodyGroup.setScale(this.facingRight ? -1 : 1, 1);
        }
      },
    };
  }

  private createChaseState(): State {
    return {
      name: 'chase',
      update: () => {
        if (this.targetIsDead) {
          this.sm.transition('idle');
          return;
        }

        if (this.isFrozen) return; // can't move or attack while frozen

        if (this.groundDistToTarget() < this.stats.attackRange) {
          this.sm.transition('attack');
          return;
        }

        this.faceTarget();

        // Move toward target on the ground plane
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.groundY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const body = this.body as Phaser.Physics.Arcade.Body;
          body.setVelocity(
            (dx / len) * this.stats.moveSpeed * this.speedMultiplier,
            (dy / len) * this.stats.moveSpeed * this.speedMultiplier * 0.6,
          );
        }
        this.clampToGroundLane();
      },
      exit: () => {
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      },
    };
  }

  private getAttackDuration(): number {
    if (this.isBoss) return this.bossAttackDuration;
    if (this.attackDurationOverride !== null) return this.attackDurationOverride;
    return ATTACK_DURATION;
  }

  private getAttackCooldown(): number {
    if (this.isBoss) return this.bossAttackCooldown;
    if (this.attackCooldownOverride !== null) return this.attackCooldownOverride;
    return ATTACK_COOLDOWN;
  }

  private createAttackState(): State {
    return {
      name: 'attack',
      enter: () => {
        this.attackTimer = this.getAttackDuration();
        this.attackPhase = 'attack';
        this.hitboxTimer = 0;
        this.hitboxActive = false;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.faceTarget();

        // Swing the stick: wind up then slash forward
        if (this.weaponPivot) {
          this.scene.tweens.killTweensOf(this.weaponPivot);
          this.weaponPivot.angle = -40; // wind up behind
          this.scene.tweens.add({
            targets: this.weaponPivot,
            angle: 60, // swing forward
            duration: HITBOX_START + HITBOX_DURATION,
            ease: 'Quad.easeIn',
          });
        }
      },
      exit: () => {
        this.deactivateHitbox();
        // Return stick to rest
        if (this.weaponPivot) {
          this.scene.tweens.killTweensOf(this.weaponPivot);
          this.scene.tweens.add({
            targets: this.weaponPivot,
            angle: 0,
            duration: 150,
            ease: 'Sine.easeOut',
          });
        }
      },
      update: (delta: number) => {
        if (this.isFrozen) {
          this.deactivateHitbox();
          return; // can't attack while frozen
        }
        this.attackTimer -= delta;

        if (this.attackPhase === 'attack') {
          this.hitboxTimer += delta;
          if (!this.hitboxActive && this.hitboxTimer >= HITBOX_START) {
            this.activateHitbox();
            // Ranged enemies fire a projectile instead of relying on melee hitbox
            if (this.stats.attackRange > 80) {
              EventBus.emit('enemy_ranged_attack', this);
            }
          }
          if (this.hitboxActive && this.hitboxTimer >= HITBOX_START + HITBOX_DURATION) {
            this.deactivateHitbox();
          }

          if (this.attackTimer <= 0) {
            this.attackPhase = 'cooldown';
            this.attackTimer = this.getAttackCooldown();
          }
        } else {
          if (this.attackTimer <= 0) {
            if (!this.targetIsDead && this.groundDistToTarget() < this.stats.attackRange) {
              this.attackTimer = this.getAttackDuration();
              this.attackPhase = 'attack';
              this.hitboxTimer = 0;
              this.faceTarget();
            } else {
              this.sm.transition('chase');
            }
          }
        }
      },
    };
  }

  private createHurtState(): State {
    return {
      name: 'hurt',
      enter: () => {
        this.hurtTimer = HURT_DURATION;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      },
      exit: () => {},
      update: (delta: number) => {
        this.hurtTimer -= delta;
        if (this.hurtTimer <= 0) {
          this.sm.transition('chase');
        }
      },
    };
  }

  private createDeathState(): State {
    return {
      name: 'death',
      enter: () => {
        this.deathTimer = DEATH_DURATION + 400; // extra time for fall animation
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
        this.deactivateHitbox();

        // Hide health bar on death
        this.healthBarBg.visible = false;
        this.healthBarFill.visible = false;

        // Fall over — rotate body group
        this.scene.tweens.add({
          targets: this.bodyGroup,
          angle: 90,
          y: 8,
          duration: 400,
          ease: 'Bounce.easeOut',
        });

        // Hide alive eyes, replace with X's
        for (const eye of this.eyes) (eye as Phaser.GameObjects.Arc).setVisible(false);
        const xSize = 3;
        const eyeY = -34;
        const drawX = (cx: number) => {
          const l1 = this.scene.add.line(0, 0, -xSize, -xSize, xSize, xSize, 0xff3333).setLineWidth(1.5);
          const l2 = this.scene.add.line(0, 0, xSize, -xSize, -xSize, xSize, 0xff3333).setLineWidth(1.5);
          l1.setPosition(cx, eyeY);
          l2.setPosition(cx, eyeY);
          this.bodyGroup.add(l1);
          this.bodyGroup.add(l2);
        };
        drawX(-3);
        drawX(4);

        EventBus.emit(Events.ENEMY_DIED, this);
      },
      update: (delta: number) => {
        this.deathTimer -= delta;
        // Fade out after falling
        if (this.deathTimer < DEATH_DURATION) {
          const alpha = Math.max(0, this.deathTimer / DEATH_DURATION) * 0.6;
          this.bodyGroup.setAlpha(alpha);
        }
        if (this.deathTimer <= 0) {
          this.destroy();
        }
      },
    };
  }
}
