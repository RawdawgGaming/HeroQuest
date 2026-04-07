import Phaser from 'phaser';
import { EventBus, Events } from './EventBus';
import { Enemy, EnemyStats } from '../entities/Enemy';
import { Hero, GROUND_MIN_Y, GROUND_MAX_Y } from '../entities/Hero';

interface WaveDef {
  enemyCount: number;
  spawnX: number;
  spawnY: number;
  triggerX: number;
  triggered: boolean;
  isBoss?: boolean;
  bossStats?: EnemyStats;
}

export class WaveSpawner {
  private scene: Phaser.Scene;
  private hero: Hero;
  private enemies: Enemy[] = [];
  private waves: WaveDef[] = [];
  private currentWaveIndex = -1;
  private waveActive = false;
  private enemiesAlive = 0;
  private enemyStats: EnemyStats;

  // Hero progression lock during waves
  private heroMaxX: number | null = null;

  constructor(scene: Phaser.Scene, hero: Hero, enemyStats: EnemyStats) {
    this.scene = scene;
    this.hero = hero;
    this.enemyStats = enemyStats;

    EventBus.on(Events.ENEMY_DIED, this.onEnemyDied, this);
  }

  addWave(enemyCount: number, spawnX: number, spawnY: number, triggerX: number): void {
    this.waves.push({ enemyCount, spawnX, spawnY, triggerX, triggered: false });
  }

  /** Add a boss wave: spawns 1 large enemy with boosted stats */
  addBossWave(spawnX: number, spawnY: number, triggerX: number, bossStats: EnemyStats): void {
    this.waves.push({
      enemyCount: 1,
      spawnX, spawnY, triggerX,
      triggered: false,
      isBoss: true,
      bossStats,
    });
  }

  update(): void {
    // Enforce hero max x while a wave is active (clamps the hero, not the camera)
    if (this.heroMaxX !== null && this.hero.x > this.heroMaxX) {
      this.hero.x = this.heroMaxX;
      const body = this.hero.body as Phaser.Physics.Arcade.Body;
      if (body && body.velocity.x > 0) body.setVelocityX(0);
    }

    if (this.waveActive) return;

    // Check triggers
    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i];
      if (!wave.triggered && this.hero.x >= wave.triggerX) {
        this.startWave(i);
        return;
      }
    }
  }

  private startWave(index: number): void {
    const wave = this.waves[index];
    wave.triggered = true;
    this.currentWaveIndex = index;
    this.waveActive = true;
    this.enemiesAlive = wave.enemyCount;

    // Lock the hero's max x at their current position so the camera follows naturally
    this.heroMaxX = this.hero.x + 30;

    EventBus.emit(Events.WAVE_STARTED, index);

    // Calculate spawn x: just past the right edge of the camera so enemies enter from off-screen
    const cam = this.scene.cameras.main;
    const rightEdge = cam.scrollX + cam.width / cam.zoom;
    const offScreenX = Math.max(wave.spawnX, rightEdge + 80);

    if (wave.isBoss && wave.bossStats) {
      // Spawn a single boss off-screen to the right
      const boss = new Enemy(
        this.scene,
        offScreenX,
        (GROUND_MIN_Y + GROUND_MAX_Y) / 2,
        this.hero,
        wave.bossStats,
        0x224422,
        true, // isBoss
      );
      this.enemies.push(boss);
      EventBus.emit('boss_spawned', boss);
    } else {
      // Spawn enemies just off the right edge
      for (let i = 0; i < wave.enemyCount; i++) {
        const offsetX = Phaser.Math.Between(0, 200); // staggered behind the front line
        const spawnY = Phaser.Math.Between(GROUND_MIN_Y + 10, GROUND_MAX_Y - 10);
        const enemy = new Enemy(
          this.scene,
          offScreenX + offsetX,
          spawnY,
          this.hero,
          this.enemyStats,
          0x22aa44,
        );
        this.enemies.push(enemy);
      }
    }
  }

  private onEnemyDied = (_enemy: Enemy): void => {
    if (!this.waveActive) return;
    this.enemiesAlive--;
    if (this.enemiesAlive <= 0) {
      this.waveClear();
    }
  };

  private waveClear(): void {
    this.waveActive = false;
    EventBus.emit(Events.WAVE_CLEARED, this.currentWaveIndex);

    // Release the hero progression lock instantly — camera was already following
    this.heroMaxX = null;

    // Check if all waves done
    const allDone = this.waves.every((w) => w.triggered);
    if (allDone) {
      EventBus.emit(Events.STAGE_COMPLETED);
    }
  }

  getEnemies(): Enemy[] {
    return this.enemies.filter((e) => !e.isDead);
  }

  destroy(): void {
    EventBus.off(Events.ENEMY_DIED, this.onEnemyDied, this);
    this.enemies.forEach((e) => { if (e.active) e.destroy(); });
    this.enemies = [];
  }
}
