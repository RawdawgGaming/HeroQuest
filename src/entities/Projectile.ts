import Phaser from 'phaser';

export interface ProjectileConfig {
  x: number;
  y: number;
  groundY: number;
  directionX: number;   // 1 = right, -1 = left
  speed: number;
  damage: number;
  color: number;
  maxRange: number;
  /** If set, applies a DOT: { percent of damage, duration in ms } */
  decay?: { percent: number; durationMs: number };
  /** If > 0, the projectile pierces through this many enemies before dying */
  pierce?: number;
  /** Render as a sharp bone spear instead of an energy ball */
  spear?: boolean;
}

export class Projectile extends Phaser.GameObjects.Container {
  scene: Phaser.Scene;

  config: ProjectileConfig;
  groundY: number;
  startX: number;
  alive = true;
  /** Set of enemies already hit by this projectile (used for piercing) */
  hitEnemies = new Set<number>();
  /** Remaining pierce count (0 = next hit kills it) */
  pierceLeft = 0;

  // Visuals
  private ball: Phaser.GameObjects.Arc;
  private glow: Phaser.GameObjects.Arc;
  private trail: Phaser.GameObjects.Arc;
  private shadow: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, config: ProjectileConfig) {
    super(scene, config.x, config.y);
    this.scene = scene;
    this.config = config;
    this.groundY = config.groundY;
    this.startX = config.x;
    this.pierceLeft = config.pierce ?? 0;

    // Shadow on ground
    this.shadow = scene.add.ellipse(0, config.groundY - config.y, config.spear ? 16 : 12, 5, 0x000000, 0.2);
    this.add(this.shadow);

    // Outer glow
    this.glow = scene.add.circle(0, 0, config.spear ? 14 : 10, config.color, 0.3);
    this.add(this.glow);

    // Trail particle (behind)
    this.trail = scene.add.circle(-config.directionX * (config.spear ? 10 : 6), 0, config.spear ? 5 : 6, config.color, 0.18);
    this.add(this.trail);

    if (config.spear) {
      // Render as a sharp bone spear: tapered shaft + pointed tip
      const dir = config.directionX;
      const shaft = scene.add.rectangle(0, 0, 22, 3, 0xf0e8d0);
      this.add(shaft);
      // Tip (sharp triangle pointing in direction of travel)
      const tip = scene.add.triangle(
        dir * 11, 0,
        0, -3,
        dir * 8, 0,
        0, 3,
        0xfffff0,
      );
      this.add(tip);
      // Dark fletching at the back
      const back = scene.add.triangle(
        -dir * 11, 0,
        0, -2,
        -dir * 5, 0,
        0, 2,
        0x554433,
      );
      this.add(back);
      // Reuse `ball` reference for the death-tween target
      this.ball = shaft as unknown as Phaser.GameObjects.Arc;
    } else {
      // Core ball
      this.ball = scene.add.circle(0, 0, 6, config.color);
      this.add(this.ball);

      // Inner bright core
      const core = scene.add.circle(0, 0, 3, 0xffffff, 0.4);
      this.add(core);
    }

    scene.add.existing(this);

    // Pulsing glow
    scene.tweens.add({
      targets: this.glow,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0.15,
      duration: 200,
      yoyo: true,
      repeat: -1,
    });

    this.setDepth(this.groundY);
  }

  update(_time: number, delta: number): void {
    if (!this.alive) return;

    // Move horizontally
    const dx = this.config.directionX * this.config.speed * (delta / 1000);
    this.x += dx;

    // Check max range
    if (Math.abs(this.x - this.startX) > this.config.maxRange) {
      this.die();
    }
  }

  getWorldRect(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 8, this.y - 8, 16, 16);
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;

    // Burst effect
    this.scene.tweens.add({
      targets: this.glow,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 200,
    });
    this.scene.tweens.add({
      targets: this.ball,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      duration: 150,
      onComplete: () => { this.destroy(); },
    });
  }
}
