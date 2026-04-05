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
  private bodyGroup: Phaser.GameObjects.Container;

  stats: EnemyStats;
  currentHealth: number;
  isDead = false;
  heroRef: Hero;
  id: number;

  // Ground position
  groundY: number;

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

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    hero: Hero,
    stats: EnemyStats,
    color: number = 0x22aa44,
  ) {
    super(scene, x, groundY);
    this.scene = scene;
    this.heroRef = hero;
    this.stats = { ...stats };
    this.currentHealth = stats.maxHealth;
    this.id = Enemy.nextId++;
    this.groundY = groundY;

    // Shadow
    this.shadow = scene.add.ellipse(0, 0, 22, 8, 0x000000, 0.3);
    this.add(this.shadow);

    // Body group
    this.bodyGroup = scene.add.container(0, 0);
    this.add(this.bodyGroup);

    // Goblin rectangle — shorter than hero
    this.sprite = scene.add.rectangle(0, -16, 20, 32, color);
    this.bodyGroup.add(this.sprite);

    // Eyes
    const eye = scene.add.rectangle(4, -22, 3, 3, 0xff3333);
    this.bodyGroup.add(eye);

    // Health bar (above head)
    this.healthBarBg = scene.add.rectangle(0, -38, 24, 4, 0x333333);
    this.healthBarFill = scene.add.rectangle(0, -38, 24, 4, 0x44cc44);
    this.bodyGroup.add(this.healthBarBg);
    this.bodyGroup.add(this.healthBarFill);
    this.healthBarBg.visible = false;
    this.healthBarFill.visible = false;

    // Physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 14);
    body.setOffset(-10, -7);

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
    this.healthBarFill.width = 24 * pct;
    this.healthBarFill.x = -(24 * (1 - pct)) / 2;
  }

  /** Distance on the ground plane only (X + depth Y) */
  private groundDistToHero(): number {
    return Phaser.Math.Distance.Between(this.x, this.groundY, this.heroRef.x, this.heroRef.groundY);
  }

  private faceHero(): void {
    const dx = this.heroRef.x - this.x;
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
    const offsetX = this.facingRight ? 20 : -42;
    return {
      x: this.x + offsetX,
      y: this.groundY - 36,
      w: 22,
      h: 36,
    };
  }

  getBodyWorldRect(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x - 10,
      this.groundY - 36,
      20,
      36,
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
        if (this.heroRef.isDead) return;
        if (this.groundDistToHero() < this.stats.detectionRange) {
          this.sm.transition('chase');
        }
      },
    };
  }

  private createChaseState(): State {
    return {
      name: 'chase',
      update: () => {
        if (this.heroRef.isDead) {
          this.sm.transition('idle');
          return;
        }

        if (this.groundDistToHero() < this.stats.attackRange) {
          this.sm.transition('attack');
          return;
        }

        this.faceHero();

        // Move toward hero on the ground plane
        const dx = this.heroRef.x - this.x;
        const dy = this.heroRef.groundY - this.groundY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const body = this.body as Phaser.Physics.Arcade.Body;
          body.setVelocity(
            (dx / len) * this.stats.moveSpeed,
            (dy / len) * this.stats.moveSpeed * 0.6,  // Slower depth movement
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
        this.faceHero();
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
            if (!this.heroRef.isDead && this.groundDistToHero() < this.stats.attackRange) {
              this.attackTimer = ATTACK_DURATION;
              this.attackPhase = 'attack';
              this.hitboxTimer = 0;
              this.faceHero();
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
        this.deathTimer = DEATH_DURATION;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
        this.deactivateHitbox();
        this.sprite.fillColor = 0x555555;
        this.sprite.alpha = 0.5;
        EventBus.emit(Events.ENEMY_DIED, this);
      },
      update: (delta: number) => {
        this.deathTimer -= delta;
        this.sprite.alpha = Math.max(0, this.deathTimer / DEATH_DURATION) * 0.5;
        if (this.deathTimer <= 0) {
          this.destroy();
        }
      },
    };
  }
}
