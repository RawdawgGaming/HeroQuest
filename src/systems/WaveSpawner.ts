import Phaser from 'phaser';
import { EventBus, Events } from './EventBus';
import { Enemy, EnemyStats } from '../entities/Enemy';
import { Hero, GROUND_MIN_Y, GROUND_MAX_Y } from '../entities/Hero';

export type BodyStyle = 'humanoid' | 'beast' | 'amorphous' | 'mechanical' | 'flying' | 'large_humanoid' | 'plant' | 'raider' | 'shaman';

interface WaveDef {
  enemyCount: number;
  spawnX: number;
  spawnY: number;
  triggerX: number;
  triggered: boolean;
  completed: boolean;
  isBoss?: boolean;
  bossStats?: EnemyStats;
  statsOverride?: EnemyStats;
  tintOverride?: number;
  bodyStyleOverride?: BodyStyle;
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
  private defaultTint: number;
  private defaultBodyStyle: BodyStyle;

  constructor(scene: Phaser.Scene, hero: Hero, enemyStats: EnemyStats, defaultTint: number = 0x22aa44, defaultBodyStyle: BodyStyle = 'humanoid') {
    this.scene = scene;
    this.hero = hero;
    this.enemyStats = enemyStats;
    this.defaultTint = defaultTint;
    this.defaultBodyStyle = defaultBodyStyle;

    EventBus.on(Events.ENEMY_DIED, this.onEnemyDied, this);
  }

  addWave(enemyCount: number, spawnX: number, spawnY: number, triggerX: number): void {
    this.waves.push({ enemyCount, spawnX, spawnY, triggerX, triggered: false, completed: false });
  }

  /** Add a wave with custom enemy stats, tint, and body style. */
  addEliteWave(
    enemyCount: number, spawnX: number, spawnY: number, triggerX: number,
    stats: EnemyStats, tint: number = 0xcc4444, bodyStyle?: BodyStyle,
  ): void {
    this.waves.push({
      enemyCount, spawnX, spawnY, triggerX,
      triggered: false, completed: false,
      statsOverride: stats,
      tintOverride: tint,
      bodyStyleOverride: bodyStyle,
    });
  }

  /** Add a boss wave: spawns 1 large enemy with boosted stats */
  addBossWave(spawnX: number, spawnY: number, triggerX: number, bossStats: EnemyStats,
    bossBodyStyle?: BodyStyle, bossTintOverride?: number): void {
    this.waves.push({
      enemyCount: 1,
      spawnX, spawnY, triggerX,
      triggered: false, completed: false,
      isBoss: true,
      bossStats,
      bodyStyleOverride: bossBodyStyle,
      tintOverride: bossTintOverride,
    });
  }

  private waveActiveTimer = 0;

  update(): void {
    // Safety: if waveActive is stuck (all enemies dead but flag not cleared),
    // force-clear after checking alive enemies
    if (this.waveActive) {
      const alive = this.enemies.filter(e => !e.isDead);
      if (alive.length === 0 && this.enemiesAlive > 0) {
        // All enemies are actually dead but counter didn't reach 0 — force clear
        this.waveActiveTimer++;
        if (this.waveActiveTimer > 60) { // ~1 second at 60fps
          this.enemiesAlive = 0;
          this.waveClear();
          this.waveActiveTimer = 0;
        }
      } else {
        this.waveActiveTimer = 0;
      }
      return;
    }

    // Check triggers — scan by ascending triggerX so earlier positions fire first
    let bestIdx = -1;
    let bestX = Infinity;
    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i];
      if (!wave.triggered && this.hero.x >= wave.triggerX && wave.triggerX < bestX) {
        bestIdx = i;
        bestX = wave.triggerX;
      }
    }
    if (bestIdx >= 0) {
      this.startWave(bestIdx);
      return;
    }

    // If all non-boss waves are done but boss hasn't triggered yet,
    // auto-trigger the boss so the player doesn't get stuck
    const untriggered = this.waves.filter(w => !w.triggered);
    if (untriggered.length > 0) {
      const bossWaves = untriggered.filter(w => w.isBoss);
      const nonBossUntriggered = untriggered.filter(w => !w.isBoss);
      if (nonBossUntriggered.length === 0 && bossWaves.length > 0) {
        // All regular waves cleared — trigger the boss now
        const bossIdx = this.waves.indexOf(bossWaves[0]);
        this.startWave(bossIdx);
      }
    }
  }

  private startWave(index: number): void {
    const wave = this.waves[index];
    wave.triggered = true;
    this.currentWaveIndex = index;
    this.waveActive = true;
    this.enemiesAlive = wave.enemyCount;

    EventBus.emit(Events.WAVE_STARTED, index);

    /** Calculate spawn X just past the right edge of the camera. */
    const getOffScreenX = () => {
      const cam = this.scene.cameras.main;
      const rightEdge = cam.scrollX + cam.width;
      return rightEdge + 80;
    };

    if (wave.isBoss && wave.bossStats) {
      // Use wave-specific overrides for boss tint and body style, or fall back to defaults
      const baseTint = wave.tintOverride ?? this.defaultTint;
      const bossR = Math.max(0, ((baseTint >> 16) & 0xff) - 0x20);
      const bossG = Math.max(0, ((baseTint >> 8) & 0xff) - 0x20);
      const bossB = Math.max(0, (baseTint & 0xff) - 0x20);
      const bossTint = (bossR << 16) | (bossG << 8) | bossB;
      const bossStyle = wave.bodyStyleOverride ?? this.defaultBodyStyle;
      let bossSpawnY = (GROUND_MIN_Y + GROUND_MAX_Y) / 2;
      const bossWalkMask = (this.scene as any).walkMask;
      if (bossWalkMask && bossWalkMask.isLoaded) {
        const clamped = bossWalkMask.clampToWalkable(getOffScreenX(), bossSpawnY);
        bossSpawnY = clamped.y;
      }
      const boss = new Enemy(
        this.scene,
        getOffScreenX(),
        bossSpawnY,
        this.hero,
        wave.bossStats,
        bossTint,
        true,
        bossStyle,
      );
      this.enemies.push(boss);
      EventBus.emit('boss_spawned', boss);
    } else {
      const stats = wave.statsOverride ?? this.enemyStats;
      const tint = wave.tintOverride ?? this.defaultTint;
      const style = wave.bodyStyleOverride ?? this.defaultBodyStyle;
      const delayPerEnemy = 250;
      const baseSpawnX = getOffScreenX();
      for (let i = 0; i < wave.enemyCount; i++) {
        this.scene.time.delayedCall(i * delayPerEnemy, () => {
          const safeX = Math.max(baseSpawnX, getOffScreenX());
          let spawnY = Phaser.Math.Between(GROUND_MIN_Y + 10, GROUND_MAX_Y - 10);
          // Use walk mask if available to find a valid spawn Y
          const walkMask = (this.scene as any).walkMask;
          if (walkMask && walkMask.isLoaded) {
            const clamped = walkMask.clampToWalkable(safeX + Phaser.Math.Between(0, 30), spawnY);
            spawnY = clamped.y;
          }
          const enemy = new Enemy(
            this.scene,
            safeX + Phaser.Math.Between(0, 30),
            spawnY,
            this.hero,
            stats,
            tint,
            false,
            style,
          );
          this.enemies.push(enemy);
        });
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
    // Mark this wave as completed (all enemies dead)
    this.waves[this.currentWaveIndex].completed = true;
    EventBus.emit(Events.WAVE_CLEARED, this.currentWaveIndex);

    // Stage is complete only when ALL waves are completed (enemies dead), not just triggered
    const allDone = this.waves.every((w) => w.completed);
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
