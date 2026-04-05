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

  // Camera lock
  private cameraLocked = false;
  private cameraLockX = 0;

  constructor(scene: Phaser.Scene, hero: Hero, enemyStats: EnemyStats) {
    this.scene = scene;
    this.hero = hero;
    this.enemyStats = enemyStats;

    EventBus.on(Events.ENEMY_DIED, this.onEnemyDied, this);
  }

  addWave(enemyCount: number, spawnX: number, spawnY: number, triggerX: number): void {
    this.waves.push({ enemyCount, spawnX, spawnY, triggerX, triggered: false });
  }

  update(): void {
    if (this.waveActive) {
      // Enforce camera lock
      if (this.cameraLocked) {
        const cam = this.scene.cameras.main;
        const maxScrollX = this.cameraLockX - cam.width / 2;
        if (cam.scrollX > maxScrollX) {
          cam.scrollX = maxScrollX;
        }
      }
      return;
    }

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

    // Lock camera
    this.cameraLocked = true;
    this.cameraLockX = wave.spawnX + 400;

    EventBus.emit(Events.WAVE_STARTED, index);

    // Spawn enemies spread across the ground lane
    for (let i = 0; i < wave.enemyCount; i++) {
      const offsetX = Phaser.Math.Between(-100, 100);
      const spawnY = Phaser.Math.Between(GROUND_MIN_Y + 10, GROUND_MAX_Y - 10);
      const enemy = new Enemy(
        this.scene,
        wave.spawnX + offsetX,
        spawnY,
        this.hero,
        this.enemyStats,
        0x22aa44,
      );
      this.enemies.push(enemy);
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
    this.cameraLocked = false;
    EventBus.emit(Events.WAVE_CLEARED, this.currentWaveIndex);

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
