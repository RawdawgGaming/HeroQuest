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
}

export class Projectile extends Phaser.GameObjects.Container {
  scene: Phaser.Scene;

  config: ProjectileConfig;
  groundY: number;
  startX: number;
  alive = true;

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

    // Shadow on ground
    this.shadow = scene.add.ellipse(0, config.groundY - config.y, 12, 5, 0x000000, 0.2);
    this.add(this.shadow);

    // Outer glow
    this.glow = scene.add.circle(0, 0, 10, config.color, 0.3);
    this.add(this.glow);

    // Trail particle (behind)
    this.trail = scene.add.circle(-config.directionX * 6, 0, 6, config.color, 0.15);
    this.add(this.trail);

    // Core ball
    this.ball = scene.add.circle(0, 0, 6, config.color);
    this.add(this.ball);

    // Inner bright core
    const core = scene.add.circle(0, 0, 3, 0xffffff, 0.4);
    this.add(core);

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
