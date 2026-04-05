import Phaser from 'phaser';
import { Hero, GROUND_MIN_Y, GROUND_MAX_Y } from './Hero';
import { Enemy } from './Enemy';

const GHOUL_SPEED = 140;
const GHOUL_ATTACK_RANGE = 35;
const GHOUL_ATTACK_COOLDOWN = 800;
const GHOUL_BASE_DAMAGE = 6;

export class Ghoul extends Phaser.GameObjects.Container {
  scene: Phaser.Scene;
  heroRef: Hero;
  private sprite: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private bodyGroup: Phaser.GameObjects.Container;
  private eyes: Phaser.GameObjects.Arc[];

  groundY: number;
  private attackCooldown = 0;
  private target: Enemy | null = null;
  damageBonus: number;
  alive = true;

  // Access from ForestStage for hit checking
  hitboxActive = false;
  hitboxDamage = 0;
  hitTarget: Enemy | null = null;

  constructor(scene: Phaser.Scene, x: number, groundY: number, hero: Hero, damageBonus: number) {
    super(scene, x, groundY);
    this.scene = scene;
    this.heroRef = hero;
    this.groundY = groundY;
    this.damageBonus = damageBonus;

    // Shadow
    this.shadow = scene.add.ellipse(0, 0, 18, 6, 0x000000, 0.25);
    this.add(this.shadow);

    // Body group
    this.bodyGroup = scene.add.container(0, 0);
    this.add(this.bodyGroup);

    // Ghoul body — hunched, grey-green
    const torso = scene.add.rectangle(0, -12, 14, 20, 0x334433);
    this.bodyGroup.add(torso);
    this.sprite = torso;

    // Head — small skull
    const head = scene.add.circle(0, -24, 7, 0x99aa88);
    this.bodyGroup.add(head);

    // Dark eye sockets
    const sockL = scene.add.circle(-2, -25, 2, 0x111111);
    this.bodyGroup.add(sockL);
    const sockR = scene.add.circle(2, -25, 2, 0x111111);
    this.bodyGroup.add(sockR);

    // Glowing green eyes
    const eyeL = scene.add.circle(-2, -25, 1.2, 0x44ff66);
    this.bodyGroup.add(eyeL);
    const eyeR = scene.add.circle(2, -25, 1.2, 0x44ff66);
    this.bodyGroup.add(eyeR);
    this.eyes = [eyeL, eyeR];

    scene.tweens.add({
      targets: this.eyes,
      alpha: 0.3, duration: 600, yoyo: true, repeat: -1,
    });

    // Arms (claws)
    const armL = scene.add.rectangle(-8, -10, 4, 10, 0x445544);
    this.bodyGroup.add(armL);
    const armR = scene.add.rectangle(8, -10, 4, 10, 0x445544);
    this.bodyGroup.add(armR);

    // Green aura
    const aura = scene.add.circle(0, -14, 14, 0x22ff66, 0.05);
    this.bodyGroup.add(aura);
    scene.tweens.add({ targets: aura, scaleX: 1.3, scaleY: 1.3, alpha: 0.02, duration: 1000, yoyo: true, repeat: -1 });

    scene.add.existing(this);
    this.setDepth(this.groundY);
  }

  update(_time: number, delta: number, enemies: Enemy[]): void {
    if (!this.alive) return;

    this.hitboxActive = false;
    this.hitTarget = null;

    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    // Find closest alive enemy
    this.target = this.findClosestEnemy(enemies);

    if (this.target) {
      const dist = Phaser.Math.Distance.Between(this.x, this.groundY, this.target.x, this.target.groundY);

      if (dist < GHOUL_ATTACK_RANGE && this.attackCooldown <= 0) {
        // Attack
        this.attackCooldown = GHOUL_ATTACK_COOLDOWN;
        this.hitboxActive = true;
        this.hitboxDamage = GHOUL_BASE_DAMAGE + this.damageBonus;
        this.hitTarget = this.target;

        // Attack flash
        this.sprite.fillColor = 0x66ff66;
        this.scene.time.delayedCall(150, () => {
          if (this.alive) this.sprite.fillColor = 0x334433;
        });
      } else if (dist >= GHOUL_ATTACK_RANGE) {
        // Chase target
        this.moveToward(this.target.x, this.target.groundY, delta);
      }
    } else {
      // Follow hero loosely
      const heroDist = Phaser.Math.Distance.Between(this.x, this.groundY, this.heroRef.x, this.heroRef.groundY);
      if (heroDist > 60) {
        this.moveToward(this.heroRef.x + Phaser.Math.Between(-30, 30), this.heroRef.groundY, delta);
      }
    }

    this.setDepth(this.groundY);
  }

  private moveToward(tx: number, ty: number, delta: number): void {
    const dx = tx - this.x;
    const dy = ty - this.groundY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const speed = GHOUL_SPEED * (delta / 1000);
    this.x += (dx / len) * speed;
    this.groundY += (dy / len) * speed * 0.6;

    // Clamp to ground lane
    this.groundY = Phaser.Math.Clamp(this.groundY, GROUND_MIN_Y, GROUND_MAX_Y);
    this.y = this.groundY;

    // Face direction
    if (dx > 0) this.bodyGroup.setScale(1, 1);
    else if (dx < 0) this.bodyGroup.setScale(-1, 1);
  }

  private findClosestEnemy(enemies: Enemy[]): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of enemies) {
      if (e.isDead) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.groundY, e.x, e.groundY);
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    return closest;
  }

  kill(): void {
    this.alive = false;
    this.destroy();
  }
}
