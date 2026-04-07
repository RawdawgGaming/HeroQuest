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

  sprite: Phaser.GameObjects.Rectangle;
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

  // Current target (set by ForestStage each frame to nearest hero/ghoul)
  targetX = 0;
  targetY = 0;
  targetIsDead = true;

  // Hitbox
  hitboxActive = false;
  hitboxTimer = 0;

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

  // Hurt state
  hurtTimer = 0;

  // Death state
  deathTimer = 0;

  private static nextId = 0;

  isBoss = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    hero: Hero,
    stats: EnemyStats,
    color: number = 0x22aa44,
    isBoss: boolean = false,
  ) {
    super(scene, x, groundY);
    this.scene = scene;
    this.heroRef = hero;
    this.stats = { ...stats };
    this.currentHealth = stats.maxHealth;
    this.id = Enemy.nextId++;
    this.groundY = groundY;
    this.isBoss = isBoss;

    // Shadow
    this.shadow = scene.add.ellipse(0, 0, 22, 8, 0x000000, 0.3);
    this.add(this.shadow);

    // Body group
    this.bodyGroup = scene.add.container(0, 0);
    this.add(this.bodyGroup);

    // --- Goblin troll-like sprite ---
    // Hunched body — wider at bottom (squat build)
    const bodyLower = scene.add.rectangle(0, -8, 20, 16, 0x447733);
    this.bodyGroup.add(bodyLower);
    const bodyUpper = scene.add.rectangle(0, -20, 18, 14, 0x559944);
    this.bodyGroup.add(bodyUpper);
    this.sprite = bodyUpper; // used for color flashing

    // Loincloth
    const loincloth = scene.add.rectangle(0, -2, 14, 6, 0x664422);
    this.bodyGroup.add(loincloth);

    // Head — big round green head
    const head = scene.add.circle(0, -32, 10, 0x66aa55);
    this.bodyGroup.add(head);

    // Pointy ears (triangles via small rotated rectangles)
    const earL = scene.add.triangle(-12, -34, 0, 6, 6, 0, 3, -4, 0x66aa55);
    this.bodyGroup.add(earL);
    const earR = scene.add.triangle(12, -34, 0, 6, 6, 0, 3, -4, 0x66aa55);
    this.bodyGroup.add(earR);

    // Big bulbous nose
    const nose = scene.add.circle(3, -30, 3, 0x558844);
    this.bodyGroup.add(nose);

    // Beady yellow eyes
    const eyeL = scene.add.circle(-3, -34, 2.5, 0x111111);
    this.bodyGroup.add(eyeL);
    const eyeR = scene.add.circle(4, -34, 2.5, 0x111111);
    this.bodyGroup.add(eyeR);
    const pupilL = scene.add.circle(-3, -34, 1.5, 0xffdd22);
    this.bodyGroup.add(pupilL);
    const pupilR = scene.add.circle(4, -34, 1.5, 0xffdd22);
    this.bodyGroup.add(pupilR);

    // Underbite teeth
    const toothL = scene.add.rectangle(-2, -27, 2, 3, 0xeeeedd);
    this.bodyGroup.add(toothL);
    const toothR = scene.add.rectangle(2, -27, 2, 3, 0xeeeedd);
    this.bodyGroup.add(toothR);

    // Arms — thick stubby
    const armL = scene.add.rectangle(-12, -14, 6, 14, 0x559944);
    this.bodyGroup.add(armL);
    const armR = scene.add.rectangle(12, -14, 6, 14, 0x559944);
    this.bodyGroup.add(armR);

    // Club weapon (held in right hand)
    const club = scene.add.rectangle(16, -20, 4, 18, 0x664422);
    this.bodyGroup.add(club);
    const clubHead = scene.add.circle(16, -30, 5, 0x553311);
    this.bodyGroup.add(clubHead);

    // Stubby legs
    const legL = scene.add.rectangle(-5, 2, 6, 8, 0x447733);
    this.bodyGroup.add(legL);
    const legR = scene.add.rectangle(5, 2, 6, 8, 0x447733);
    this.bodyGroup.add(legR);

    // Health bar (above head)
    this.healthBarBg = scene.add.rectangle(0, -46, 24, 4, 0x333333);
    this.healthBarFill = scene.add.rectangle(0, -46, 24, 4, 0x44cc44);
    this.bodyGroup.add(this.healthBarBg);
    this.bodyGroup.add(this.healthBarFill);
    this.healthBarBg.visible = false;
    this.healthBarFill.visible = false;

    // Boss scaling — make it 2.5x bigger and add a red glow
    if (this.isBoss) {
      this.bodyGroup.setScale(2.5);
      this.shadow.setScale(2.5, 2.5);
      this.shadow.fillColor = 0x440000;
      this.shadow.alpha = 0.5;

      // Boss aura (dark red glow)
      const aura = scene.add.circle(0, -25, 50, 0xff2244, 0.15);
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
      body.setSize(50, 32);
      body.setOffset(-25, -16);
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

  update(_time: number, delta: number): void {
    this.sm.update(delta);
    // Depth sort
    this.setDepth(this.groundY);
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    const actual = Math.max(amount - this.stats.defense, 1);
    this.currentHealth = Math.max(this.currentHealth - actual, 0);
    this.updateHealthBar();

    if (this.currentHealth <= 0) {
      this.isDead = true;
      this.sm.transition('death');
    } else {
      this.sm.transition('hurt');
    }
  }

  updateHealthBarPublic(): void { this.updateHealthBar(); }

  private updateHealthBar(): void {
    if (!this.healthBarVisible) {
      this.healthBarBg.visible = true;
      this.healthBarFill.visible = true;
      this.healthBarVisible = true;
    }
    const pct = this.currentHealth / this.stats.maxHealth;
    const w = this.isBoss ? 60 : 24;
    this.healthBarFill.width = w * pct;
    this.healthBarFill.x = -(w * (1 - pct)) / 2;
    if (this.isBoss) {
      this.healthBarBg.width = w;
    }
  }

  /** Distance to current target on the ground plane */
  private groundDistToTarget(): number {
    return Phaser.Math.Distance.Between(this.x, this.groundY, this.targetX, this.targetY);
  }

  private faceTarget(): void {
    const dx = this.targetX - this.x;
    if (dx > 0) {
      this.facingRight = true;
      this.bodyGroup.setScale(1, 1);
    } else {
      this.facingRight = false;
      this.bodyGroup.setScale(-1, 1);
    }
  }

  private clampToGroundLane(): void {
    if (this.y < GROUND_MIN_Y) this.y = GROUND_MIN_Y;
    if (this.y > GROUND_MAX_Y) this.y = GROUND_MAX_Y;
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
    const scale = this.isBoss ? 2.5 : 1;
    const offsetX = this.facingRight ? 20 * scale : -42 * scale;
    return {
      x: this.x + offsetX,
      y: this.groundY - 36 * scale,
      w: 22 * scale,
      h: 36 * scale,
    };
  }

  getBodyWorldRect(): Phaser.Geom.Rectangle {
    const scale = this.isBoss ? 2.5 : 1;
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

  private createAttackState(): State {
    return {
      name: 'attack',
      enter: () => {
        this.attackTimer = ATTACK_DURATION;
        this.attackPhase = 'attack';
        this.hitboxTimer = 0;
        this.hitboxActive = false;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.faceTarget();
        this.sprite.fillColor = 0xffaa22;
      },
      exit: () => {
        this.deactivateHitbox();
        this.sprite.fillColor = 0x22aa44;
      },
      update: (delta: number) => {
        this.attackTimer -= delta;

        if (this.attackPhase === 'attack') {
          this.hitboxTimer += delta;
          if (!this.hitboxActive && this.hitboxTimer >= HITBOX_START) {
            this.activateHitbox();
          }
          if (this.hitboxActive && this.hitboxTimer >= HITBOX_START + HITBOX_DURATION) {
            this.deactivateHitbox();
          }

          if (this.attackTimer <= 0) {
            this.attackPhase = 'cooldown';
            this.attackTimer = ATTACK_COOLDOWN;
          }
        } else {
          if (this.attackTimer <= 0) {
            if (!this.targetIsDead && this.groundDistToTarget() < this.stats.attackRange) {
              this.attackTimer = ATTACK_DURATION;
              this.attackPhase = 'attack';
              this.hitboxTimer = 0;
              this.faceTarget();
              this.sprite.fillColor = 0xffaa22;
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
        this.sprite.fillColor = 0xff3333;
      },
      exit: () => {
        this.sprite.fillColor = 0x22aa44;
      },
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
        this.sprite.fillColor = 0x555555;

        // Fall over — rotate body group
        this.scene.tweens.add({
          targets: this.bodyGroup,
          angle: 90,
          y: 8,
          duration: 400,
          ease: 'Bounce.easeOut',
        });

        // X eyes
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

        // Grey out everything
        this.bodyGroup.iterate((child: Phaser.GameObjects.GameObject) => {
          if ('fillColor' in child) {
            (child as Phaser.GameObjects.Rectangle).fillColor = 0x555555;
          }
        });

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
