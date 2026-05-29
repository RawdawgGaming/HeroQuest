import Phaser from 'phaser';
import type { SidekickDef } from '../data/sidekicks';
import type { Hero } from './Hero';
import type { Enemy } from './Enemy';

/**
 * A small floating companion that follows the hero and triggers an ability on a cooldown.
 * The owning scene drives the ability logic via `tickAbility(...)` so it has full access
 * to enemies, the hero, projectile spawning, etc.
 */
export class Sidekick extends Phaser.GameObjects.Container {
  scene: Phaser.Scene;
  def: SidekickDef;
  hero: Hero;

  cooldown = 0;
  bobTime = 0;

  // Visuals
  private bodyShape!: Phaser.GameObjects.Arc;
  private glow!: Phaser.GameObjects.Arc;
  private accent?: Phaser.GameObjects.GameObject;
  private wingL?: Phaser.GameObjects.Arc;
  private wingR?: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, def: SidekickDef, hero: Hero) {
    super(scene, hero.x - 30, hero.groundY - 50);
    this.scene = scene;
    this.def = def;
    this.hero = hero;
    this.cooldown = def.cooldownMs * 0.4; // small initial delay so it doesn't fire instantly

    // Outer glow
    this.glow = scene.add.circle(0, 0, 14, def.glowColor, 0.35);
    this.add(this.glow);

    // Wings (small arcs flapping)
    this.wingL = scene.add.circle(-7, 0, 5, def.bodyColor, 0.55);
    this.wingR = scene.add.circle(7, 0, 5, def.bodyColor, 0.55);
    this.add(this.wingL);
    this.add(this.wingR);

    // Body
    this.bodyShape = scene.add.circle(0, 0, 7, def.bodyColor);
    this.add(this.bodyShape);

    // Accent — varies by ability type for visual variety
    this.accent = this.buildAccent(scene, def);
    if (this.accent) this.add(this.accent);

    scene.add.existing(this);
    this.setDepth(hero.groundY + 50); // floats above the action

    // Pulsing glow tween
    scene.tweens.add({
      targets: this.glow,
      scale: 1.25,
      alpha: 0.2,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  private buildAccent(scene: Phaser.Scene, def: SidekickDef): Phaser.GameObjects.GameObject | undefined {
    switch (def.ability) {
      case 'heal': {
        // Tiny yellow plus sign
        const g = scene.add.graphics();
        g.fillStyle(def.accentColor, 1);
        g.fillRect(-1, -3, 2, 6);
        g.fillRect(-3, -1, 6, 2);
        return g;
      }
      case 'freeze': {
        // White snowflake-ish star
        const g = scene.add.graphics();
        g.fillStyle(def.accentColor, 1);
        g.fillRect(-3, -0.5, 6, 1);
        g.fillRect(-0.5, -3, 1, 6);
        g.fillRect(-2, -2, 1, 1);
        g.fillRect(1, 1, 1, 1);
        g.fillRect(-2, 1, 1, 1);
        g.fillRect(1, -2, 1, 1);
        return g;
      }
      case 'poison': {
        // Dark drip
        const drop = scene.add.circle(0, 1, 2, def.accentColor);
        return drop;
      }
      case 'attack': {
        // Bright yellow inner core
        return scene.add.circle(0, 0, 2.5, def.accentColor);
      }
      case 'shield': {
        // White ring outline
        const ring = scene.add.circle(0, 0, 4, 0, 0).setStrokeStyle(1.2, def.accentColor);
        return ring;
      }
    }
  }

  /** Move position to follow the hero each frame. */
  update(_time: number, delta: number): void {
    this.bobTime += delta;
    // Bob up and down + float beside the hero (offset right when hero faces right, left otherwise)
    const sideOffset = this.hero.facingRight ? -38 : 38;
    const targetX = this.hero.x + sideOffset;
    const targetY = this.hero.groundY - 55 + Math.sin(this.bobTime / 250) * 4;
    // Smooth chase
    this.x += (targetX - this.x) * 0.15;
    this.y += (targetY - this.y) * 0.15;
    this.setDepth(this.hero.groundY + 50);

    // Wing flap
    if (this.wingL && this.wingR) {
      const flap = Math.sin(this.bobTime / 80) * 0.5 + 1;
      this.wingL.setScale(flap, 1);
      this.wingR.setScale(flap, 1);
    }

    if (this.cooldown > 0) this.cooldown -= delta;
  }

  /** Returns true if the ability is ready to fire. Resets the cooldown. */
  consumeCooldown(): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = this.def.cooldownMs;
    return true;
  }

  /** Find the nearest non-dead enemy within range (or any if no range). */
  findNearestEnemy(enemies: Enemy[]): Enemy | null {
    const range = this.def.range ?? Infinity;
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = e.x - this.hero.x;
      const dy = e.groundY - this.hero.groundY;
      const d = Math.hypot(dx, dy);
      if (d > range) continue;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  destroySidekick(): void {
    this.destroy();
  }
}
