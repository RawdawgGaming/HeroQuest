import Phaser from 'phaser';
import { StateMachine, State } from '../systems/StateMachine';
import { EventBus, Events } from '../systems/EventBus';
import type { AttackType } from '../data/heroClasses';

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

// Melee combo configuration
const COMBO_DAMAGE = [10, 10, 20];
const COMBO_DURATION = [750, 750, 1000];
const INPUT_WINDOW = 300;
const HITBOX_START = 250;
const HITBOX_DURATION = 250;

// Projectile cast configuration
const CAST_DURATION = 900;     // ms for the cast animation (was 600)
const CAST_COOLDOWN = 450;     // ms before you can cast again (was 300)

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
  private bodyGroup: Phaser.GameObjects.Container;

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

  // Melee attack state
  comboStep = 0;
  attackTimer = 0;
  inputQueued = false;
  hitboxTimer = 0;
  hitboxActive = false;
  currentHitboxDamage = 0;
  facingRight = true;

  // Projectile cast state
  castTimer = 0;
  castCooldown = 0;
  projectileFired = false;


  // Attribute: attack speed (set by ForestStage)
  attackSpeedPoints = 0;

  // Hurt state
  hurtTimer = 0;

  // Track which enemies were hit this swing (melee only)
  hitEnemies = new Set<number>();

  // Colors
  baseColor: number;
  accentColor: number;

  // Class ID for custom visuals
  heroClassId: string;

  // Level-based HP scaling: +5 max HP per level above 1
  static readonly HP_PER_LEVEL = 5;
  heroLevel = 1;

  constructor(
    scene: Phaser.Scene, x: number, groundY: number,
    stats?: Partial<HeroStats>, color?: number, accent?: number,
    attackType: AttackType = 'melee',
    heroClassId: string = '',
    heroLevel: number = 1,
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

    // Shadow
    this.shadow = scene.add.ellipse(0, 0, 28, 10, 0x000000, 0.3);
    this.add(this.shadow);

    // Body group
    this.bodyGroup = scene.add.container(0, 0);
    this.add(this.bodyGroup);

    if (heroClassId === 'necromancer') {
      this.buildNecromancerVisual(scene);
    } else {
      this.buildDefaultVisual(scene);
    }

    // Add green aura glow if necromancer
    if (heroClassId === 'necromancer') {
      const aura = scene.add.circle(0, -20, 22, 0x22ff66, 0.08);
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

    // Staff top orb — green glow
    const staffOrb = scene.add.circle(16, -44, 5, 0x33ff55, 0.7);
    this.bodyGroup.add(staffOrb);
    const staffGlow = scene.add.circle(16, -44, 8, 0x22ff44, 0.15);
    this.bodyGroup.add(staffGlow);
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

  update(_time: number, delta: number): void {
    // Read attack input (consume JustDown each frame)
    this.attackPressed = this.keys.attack.isDown;

    // Tick cast cooldown
    if (this.castCooldown > 0) this.castCooldown -= delta;

    // Jump physics
    if (!this.isDead) {
      this.updateJump(delta);
    }

    this.sm.update(delta);
    this.setDepth(this.groundY);
  }

  // --- Jump ---

  private updateJump(delta: number): void {
    const dt = delta / 1000;
    if (!this.isGrounded) {
      this.jumpVelZ += GRAVITY * dt;
      this.jumpZ += this.jumpVelZ * dt;
      if (this.jumpZ >= 0) {
        this.jumpZ = 0;
        this.jumpVelZ = 0;
        this.isGrounded = true;
      }
    }
    if (this.isGrounded && Phaser.Input.Keyboard.JustDown(this.keys.jump)) {
      this.jumpVelZ = JUMP_VELOCITY;
      this.jumpZ = -1;
      this.isGrounded = false;
    }
    this.bodyGroup.y = this.jumpZ;
    const heightFactor = Math.max(0.3, 1 - Math.abs(this.jumpZ) / 200);
    this.shadow.setScale(heightFactor, heightFactor);
    this.shadow.alpha = 0.3 * heightFactor;
  }

  // --- Damage ---

  takeDamage(amount: number): void {
    if (this.isDead) return;
    const actual = Math.max(amount - this.stats.defense, 1);
    this.currentHealth = Math.max(this.currentHealth - actual, 0);
    EventBus.emit(Events.HERO_HEALTH_CHANGED, this.currentHealth, this.stats.maxHealth);
    if (this.currentHealth <= 0) {
      this.isDead = true;
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
    const offsetX = this.facingRight ? 28 : -58;
    return { x: this.x + offsetX, y: this.groundY - 44 + this.jumpZ, w: 30, h: 44 };
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
    body.setVelocity(dir.x * this.stats.moveSpeed, dir.y * this.stats.moveSpeed * 0.6);
    if (this.y < GROUND_MIN_Y) { this.y = GROUND_MIN_Y; body.setVelocityY(0); }
    if (this.y > GROUND_MAX_Y) { this.y = GROUND_MAX_Y; body.setVelocityY(0); }
    this.groundY = this.y;
  }

  updateFacing(dx: number): void {
    if (dx > 0) { this.facingRight = true; this.bodyGroup.setScale(1, 1); }
    else if (dx < 0) { this.facingRight = false; this.bodyGroup.setScale(-1, 1); }
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
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      },
      update: () => {
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
      },
      update: () => {
        const dir = this.getInputDirection();
        if (dir.length() === 0) { this.sm.transition('idle'); return; }

        if (this.attackType === 'projectile') {
          // Cast while moving — no state transition needed
          this.tryCastWhileMoving();
        } else if (this.attackPressed) {
          this.sm.transition('attack'); return;
        }

        this.updateFacing(dir.x);
        this.applyMovement(dir);
      },
    };
  }

  // --- Melee attack (all classes except projectile types) ---

  private createMeleeAttackState(): State {
    return {
      name: 'attack',
      enter: () => {
        this.comboStep = 0;
        this.startComboStep();
      },
      exit: () => {
        this.deactivateHitbox();
        this.comboStep = 0;
        this.inputQueued = false;
        this.sprite.fillColor = this.baseColor;
      },
      update: (delta: number) => {
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        this.hitboxTimer += delta;
        if (!this.hitboxActive && this.hitboxTimer >= HITBOX_START) this.activateHitbox();
        if (this.hitboxActive && this.hitboxTimer >= HITBOX_START + HITBOX_DURATION) this.deactivateHitbox();

        this.attackTimer -= delta;
        if (this.attackPressed && this.attackTimer <= INPUT_WINDOW && this.comboStep < 2) {
          this.inputQueued = true;
        }
        if (this.attackTimer <= 0) {
          if (this.inputQueued && this.comboStep < 2) {
            this.comboStep++;
            this.startComboStep();
          } else {
            this.sm.transition('idle');
          }
        }
      },
    };
  }

  private startComboStep(): void {
    this.attackTimer = COMBO_DURATION[this.comboStep];
    this.inputQueued = false;
    this.hitboxActive = false;
    this.hitboxTimer = 0;
    this.currentHitboxDamage = COMBO_DAMAGE[this.comboStep];
    const brightness = 0xaa + this.comboStep * 0x22;
    this.sprite.fillColor = (brightness << 16) | 0x44;
  }

  // --- Projectile cast (necromancer, etc.) ---

  private getScaledCastDuration(): number {
    const reduction = 1 - this.attackSpeedPoints * 0.12;
    return CAST_DURATION * Math.max(reduction, 0.2);
  }

  private getScaledCastCooldown(): number {
    const reduction = 1 - this.attackSpeedPoints * 0.12;
    return CAST_COOLDOWN * Math.max(reduction, 0.2);
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
        this.hurtTimer = 300;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.sprite.fillColor = 0xff3333;
        this.scene.tweens.add({ targets: this.sprite, alpha: 0.5, duration: 100, yoyo: true, repeat: 1 });
      },
      exit: () => { this.sprite.fillColor = this.baseColor; this.sprite.alpha = 1; },
      update: (delta: number) => {
        this.hurtTimer -= delta;
        if (this.hurtTimer <= 0) this.sm.transition('idle');
      },
    };
  }

  private createDeathState(): State {
    return {
      name: 'death',
      enter: () => {
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
