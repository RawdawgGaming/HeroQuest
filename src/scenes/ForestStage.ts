import Phaser from 'phaser';
import { Hero, GROUND_MIN_Y, GROUND_MAX_Y } from '../entities/Hero';
import { Enemy, EnemyStats } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Ghoul } from '../entities/Ghoul';
import { WaveSpawner } from '../systems/WaveSpawner';
import { HUD } from '../ui/HUD';
import { LevelSystem } from '../systems/LevelSystem';
import { EventBus, Events } from '../systems/EventBus';
import { HeroClassDef, HERO_CLASSES } from '../data/heroClasses';
import { CharacterProgression, createDefaultProgression } from '../systems/CharacterProgression';
import { saveCharacter } from '../services/supabase';
import type { User } from '@supabase/supabase-js';

const STAGE_WIDTH = 3200;
const STAGE_HEIGHT = 720;

const GOBLIN_STATS: EnemyStats = {
  moveSpeed: 120,
  maxHealth: 40,
  attackPower: 8,
  defense: 2,
  detectionRange: 250,
  attackRange: 40,
  xpReward: 25,
  goldReward: 5,
};

// Decay DOT: 20% of hit damage over 3 seconds
const DECAY_PERCENT = 0.20;
const DECAY_DURATION = 3000;
const DECAY_TICK_INTERVAL = 500; // damage ticks every 500ms

interface DecayEffect {
  enemy: Enemy;
  totalDamage: number;     // total decay damage to deal
  damagePerTick: number;
  elapsed: number;
  tickAccumulator: number;
}

export class ForestStage extends Phaser.Scene {
  private hero!: Hero;
  private waveSpawner!: WaveSpawner;
  private hud!: HUD;
  private levelSystem!: LevelSystem;
  private heroClass!: HeroClassDef;

  // Projectile management
  private projectiles: Projectile[] = [];

  // Decay DOT tracking
  private decayEffects: DecayEffect[] = [];

  // Ghouls (summoned minions)
  private ghouls: Ghoul[] = [];

  // Gold
  private gold = 0;

  // Summon
  private summonKey!: Phaser.Input.Keyboard.Key;
  private summonCooldown = 0;
  private maxGhouls = 0;

  // Pause
  private paused = false;
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('ForestStage');
  }

  private user?: User;
  private characterId?: string;
  private stageIndex = 0;
  private startGold = 0;
  private startLevel = 1;
  private startXp = 0;
  private progression!: CharacterProgression;

  init(data: { heroClass?: HeroClassDef; user?: User; characterId?: string; stageIndex?: number; gold?: number; level?: number; currentXp?: number; progression?: CharacterProgression }): void {
    this.heroClass = data.heroClass || HERO_CLASSES[0];
    this.user = data.user;
    this.characterId = data.characterId;
    this.stageIndex = data.stageIndex ?? 0;
    this.startGold = data.gold ?? 0;
    this.startLevel = data.level ?? 1;
    this.startXp = data.currentXp ?? 0;
    // Ensure loaded progression has all required fields (DB may return partial JSON)
    const loaded = data.progression;
    this.progression = {
      attrPointsAvailable: loaded?.attrPointsAvailable ?? 0,
      attributes: loaded?.attributes ?? {},
      skillPointsAvailable: loaded?.skillPointsAvailable ?? 0,
      skills: loaded?.skills ?? {},
    };
  }

  create(): void {
    EventBus.removeAllListeners();
    this.projectiles = [];
    this.decayEffects = [];
    this.ghouls = [];

    this.buildBackground();

    // --- Hero ---
    const heroStartY = (GROUND_MIN_Y + GROUND_MAX_Y) / 2;
    this.hero = new Hero(
      this, 120, heroStartY,
      this.heroClass.stats,
      this.heroClass.color,
      this.heroClass.accentColor,
      this.heroClass.attackType,
      this.heroClass.id,
    );

    // Apply skill level for cast speed
    this.hero.basicAttackSkillLevel = this.progression.skills['basicAttack'] ?? 0;

    // Wire up projectile spawning for ranged heroes
    if (this.heroClass.attackType === 'projectile') {
      this.hero.spawnProjectile = (x, y, groundY, dirX, damage) => {
        this.spawnHeroProjectile(x, y, groundY, dirX, damage);
      };
    }

    // --- Summon Ghoul on U key ---
    this.summonKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.U);

    // --- Wave Spawner (enemies scale with stage) ---
    const scale = 1 + this.stageIndex * 0.3;
    const scaledGoblin: EnemyStats = {
      ...GOBLIN_STATS,
      maxHealth: Math.round(GOBLIN_STATS.maxHealth * scale),
      attackPower: Math.round(GOBLIN_STATS.attackPower * scale),
      xpReward: Math.round(GOBLIN_STATS.xpReward * scale),
      goldReward: Math.round(GOBLIN_STATS.goldReward * scale),
    };
    const baseCount = 2 + this.stageIndex; // more enemies each stage
    this.waveSpawner = new WaveSpawner(this, this.hero, scaledGoblin);
    this.waveSpawner.addWave(baseCount, 650, heroStartY, 420);
    this.waveSpawner.addWave(baseCount + 1, 1450, heroStartY, 1150);
    this.waveSpawner.addWave(baseCount + 2, 2250, heroStartY, 1950);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    this.cameras.main.startFollow(this.hero, false, 0.08, 0.02);
    this.cameras.main.setFollowOffset(0, -80);

    // --- HUD ---
    this.hud = new HUD(this);

    // --- Level / XP system (carry forward from previous stage) ---
    this.levelSystem = new LevelSystem(this.startLevel, this.progression);
    if (this.startXp > 0) this.levelSystem.addXp(this.startXp);
    this.levelSystem.emitCurrent();

    // --- Gold (carry forward) ---
    this.gold = this.startGold;
    EventBus.emit(Events.HERO_GOLD_CHANGED, this.gold);
    EventBus.on(Events.ENEMY_DIED, this.onEnemyDiedGold, this);

    // --- Stage end choice ---
    EventBus.on('stage_end_choice', this.onStageEndChoice, this);

    // --- World bounds ---
    this.physics.world.setBounds(0, GROUND_MIN_Y, STAGE_WIDTH, GROUND_MAX_Y - GROUND_MIN_Y);
    (this.hero.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    // --- Stage label ---
    this.add.text(1260, 25, `Stage ${this.stageIndex + 1}`, {
      fontSize: '14px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);

    // --- Hero death ---
    EventBus.on(Events.HERO_DIED, this.onHeroDied, this);

    // --- ESC pause ---
    this.paused = false;
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.paused) this.resumeGame();
      else this.pauseGame();
    });
  }

  private pauseGame(): void {
    this.paused = true;
    this.physics.pause();

    // Dim overlay
    const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(500);
    this.pauseOverlay.push(dim);

    // Pause title
    const title = this.add.text(640, 240, 'PAUSED', {
      fontSize: '48px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);
    this.pauseOverlay.push(title);

    // Resume button
    const resumeBtn = this.add.rectangle(640, 340, 240, 50, 0x33aa55)
      .setScrollFactor(0).setDepth(501).setInteractive({ useHandCursor: true });
    const resumeText = this.add.text(640, 340, 'RESUME', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    resumeBtn.on('pointerover', () => { resumeBtn.fillColor = 0x44cc66; });
    resumeBtn.on('pointerout', () => { resumeBtn.fillColor = 0x33aa55; });
    resumeBtn.on('pointerdown', () => this.resumeGame());
    this.pauseOverlay.push(resumeBtn, resumeText);

    // Shop/Stats button
    const shopBtn = this.add.rectangle(640, 410, 240, 50, 0xccaa22)
      .setScrollFactor(0).setDepth(501).setInteractive({ useHandCursor: true });
    const shopText = this.add.text(640, 410, 'SHOP / STATS', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    shopBtn.on('pointerover', () => { shopBtn.fillColor = 0xddbb33; });
    shopBtn.on('pointerout', () => { shopBtn.fillColor = 0xccaa22; });
    shopBtn.on('pointerdown', () => {
      this.autoSave();
      this.scene.start('Shop', {
        heroClass: this.heroClass,
        user: this.user,
        characterId: this.characterId,
        gold: this.gold,
        level: this.levelSystem.level,
        currentXp: this.levelSystem.currentXp,
        progression: this.levelSystem.progression,
        stageIndex: this.stageIndex,
        returnToStage: true,
      });
    });
    this.pauseOverlay.push(shopBtn, shopText);

    // Quit to Main Menu button
    const quitBtn = this.add.rectangle(640, 480, 240, 50, 0xcc3333)
      .setScrollFactor(0).setDepth(501).setInteractive({ useHandCursor: true });
    const quitText = this.add.text(640, 480, 'MAIN MENU', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    quitBtn.on('pointerover', () => { quitBtn.fillColor = 0xdd4444; });
    quitBtn.on('pointerout', () => { quitBtn.fillColor = 0xcc3333; });
    quitBtn.on('pointerdown', () => {
      this.autoSave();
      this.scene.start('StartScreen');
    });
    this.pauseOverlay.push(quitBtn, quitText);
  }

  private resumeGame(): void {
    this.paused = false;
    this.physics.resume();
    for (const obj of this.pauseOverlay) obj.destroy();
    this.pauseOverlay = [];
  }

  // --- Projectile spawning ---

  private spawnHeroProjectile(x: number, y: number, groundY: number, dirX: number, damage: number): void {
    const prog = this.levelSystem.progression;
    const atkPowerPts = prog.attributes['attackPower'] ?? 0;
    const rangePts = prog.attributes['attackRange'] ?? 0;
    const rotPts = prog.attributes['rotEffect'] ?? 0;
    const skillLvl = prog.skills['basicAttack'] ?? 0;

    // Apply attribute bonuses
    const bonusDmg = atkPowerPts * 2 + skillLvl * 3;
    const bonusRange = rangePts * 50;
    const decayPct = DECAY_PERCENT + rotPts * 0.05;
    const decayDur = DECAY_DURATION + rotPts * 500;

    const proj = new Projectile(this, {
      x, y, groundY,
      directionX: dirX,
      speed: 350,
      damage: damage + bonusDmg,
      color: this.heroClass.projectileColor ?? 0x220033,
      maxRange: 400 + bonusRange,
      decay: { percent: decayPct, durationMs: decayDur },
    });
    this.projectiles.push(proj);
  }

  // --- Decay DOT ---

  private onHeroDied = (): void => {
    // Kill all ghouls
    for (const ghoul of this.ghouls) {
      if (ghoul.alive) ghoul.kill();
    }
    this.ghouls = [];

    // Show death screen after a short delay
    this.time.delayedCall(1000, () => {
      this.showDeathScreen();
    });
  };

  private showDeathScreen(): void {
    this.paused = true;
    this.physics.pause();

    const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(500);

    this.add.text(640, 260, 'YOU DIED', {
      fontSize: '56px', color: '#cc3333', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);

    // Retry button (restart same stage)
    const retryBtn = this.add.rectangle(640, 380, 240, 50, 0xccaa22)
      .setScrollFactor(0).setDepth(501).setInteractive({ useHandCursor: true });
    this.add.text(640, 380, 'RETRY', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    retryBtn.on('pointerover', () => { retryBtn.fillColor = 0xddbb33; });
    retryBtn.on('pointerout', () => { retryBtn.fillColor = 0xccaa22; });
    retryBtn.on('pointerdown', () => {
      this.scene.start('ForestStage', {
        heroClass: this.heroClass,
        user: this.user,
        characterId: this.characterId,
        gold: this.startGold,
        level: this.startLevel,
        currentXp: this.startXp,
        stageIndex: this.stageIndex,
        progression: this.progression,
      });
    });

    // Main menu button
    const menuBtn = this.add.rectangle(640, 450, 240, 50, 0xcc3333)
      .setScrollFactor(0).setDepth(501).setInteractive({ useHandCursor: true });
    this.add.text(640, 450, 'MAIN MENU', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    menuBtn.on('pointerover', () => { menuBtn.fillColor = 0xdd4444; });
    menuBtn.on('pointerout', () => { menuBtn.fillColor = 0xcc3333; });
    menuBtn.on('pointerdown', () => {
      this.autoSave();
      this.scene.start('StartScreen');
    });
  }

  private handleSummon(): void {
    const ghoulLevel = this.levelSystem.progression.skills['summonGhoul'] ?? 0;
    if (ghoulLevel === 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.summonKey)) return;
    if (this.summonCooldown > 0) return;

    // Remove dead ghouls
    this.ghouls = this.ghouls.filter(g => g.alive);

    // Already at max
    if (this.ghouls.length >= ghoulLevel) return;

    // Spawn as many ghouls as needed to reach skill level
    const toSpawn = ghoulLevel - this.ghouls.length;
    const dmgBonus = Math.round(ghoulLevel * 0.10 * 6);
    for (let i = 0; i < toSpawn; i++) {
      const gx = this.hero.x + Phaser.Math.Between(-50, 50);
      const gy = this.hero.groundY + Phaser.Math.Between(-20, 20);
      const ghoul = new Ghoul(this, gx, gy, this.hero, dmgBonus);
      this.ghouls.push(ghoul);
    }

    // Green flash on hero to show summon
    this.hero.sprite.fillColor = 0x44ff66;
    this.time.delayedCall(150, () => {
      if (!this.hero.isDead) this.hero.sprite.fillColor = this.hero.baseColor;
    });

    this.summonCooldown = 1500;
  }

  private onStageEndChoice = (choice: string): void => {
    const passData = {
      heroClass: this.heroClass,
      user: this.user,
      characterId: this.characterId,
      gold: this.gold,
      level: this.levelSystem.level,
      currentXp: this.levelSystem.currentXp,
      progression: this.levelSystem.progression,
      stageIndex: this.stageIndex,
    };

    // Auto-save to Supabase
    this.autoSave();

    if (choice === 'shop') {
      this.scene.start('Shop', passData);
    } else {
      this.scene.start('ForestStage', {
        ...passData,
        stageIndex: this.stageIndex + 1,
      });
    }
  };

  private autoSave(): void {
    if (!this.characterId) return;
    saveCharacter(this.characterId, {
      level: this.levelSystem.level,
      gold: this.gold,
      xp: this.levelSystem.currentXp,
      current_stage: this.stageIndex + 1,  // save the next stage (they beat this one)
      progression: this.levelSystem.progression as unknown as Record<string, unknown>,
    });
  }

  private onEnemyDiedGold = (enemy: Enemy): void => {
    this.gold += enemy.stats.goldReward;
    EventBus.emit(Events.HERO_GOLD_CHANGED, this.gold);
  };

  private applyDecay(enemy: Enemy, hitDamage: number): void {
    const totalDecayDmg = Math.ceil(hitDamage * DECAY_PERCENT);
    const numTicks = Math.floor(DECAY_DURATION / DECAY_TICK_INTERVAL);
    const dmgPerTick = Math.ceil(totalDecayDmg / numTicks);

    this.decayEffects.push({
      enemy,
      totalDamage: totalDecayDmg,
      damagePerTick: dmgPerTick,
      elapsed: 0,
      tickAccumulator: 0,
    });

    // Visual indicator: green tint on decaying enemies
    enemy.sprite.fillColor = 0x225533;
  }

  private updateDecayEffects(delta: number): void {
    for (let i = this.decayEffects.length - 1; i >= 0; i--) {
      const fx = this.decayEffects[i];
      if (fx.enemy.isDead) {
        this.decayEffects.splice(i, 1);
        continue;
      }

      fx.elapsed += delta;
      fx.tickAccumulator += delta;

      // Apply tick damage
      if (fx.tickAccumulator >= DECAY_TICK_INTERVAL) {
        fx.tickAccumulator -= DECAY_TICK_INTERVAL;
        // Direct HP damage (bypasses defense — it's decay)
        fx.enemy.currentHealth = Math.max(fx.enemy.currentHealth - fx.damagePerTick, 0);
        fx.enemy.updateHealthBarPublic();

        // Flash the enemy slightly
        fx.enemy.sprite.fillColor = 0x115522;
        this.time.delayedCall(100, () => {
          if (!fx.enemy.isDead) fx.enemy.sprite.fillColor = 0x225533;
        });

        if (fx.enemy.currentHealth <= 0) {
          fx.enemy.isDead = true;
          fx.enemy.sm.transition('death');
          this.decayEffects.splice(i, 1);
          continue;
        }
      }

      // Expire
      if (fx.elapsed >= DECAY_DURATION) {
        // Restore original color
        if (!fx.enemy.isDead) {
          fx.enemy.sprite.fillColor = 0x22aa44;
        }
        this.decayEffects.splice(i, 1);
      }
    }
  }

  // --- Background ---

  private buildBackground(): void {
    const skyColors = [0x5588cc, 0x6699dd, 0x77aaee, 0x88bbee, 0x99ccee];
    for (let i = 0; i < skyColors.length; i++) {
      const h = 80;
      this.add.rectangle(STAGE_WIDTH / 2, i * h + h / 2, STAGE_WIDTH + 200, h, skyColors[i])
        .setScrollFactor(0.1, 0).setDepth(-100);
    }
    for (let i = 0; i < 8; i++) {
      const mx = i * 500 + Phaser.Math.Between(-50, 50);
      const mw = Phaser.Math.Between(200, 350);
      const mh = Phaser.Math.Between(80, 150);
      this.add.triangle(mx, 380 - mh / 2, 0, mh, mw / 2, 0, mw, mh, 0x445566)
        .setScrollFactor(0.3).setDepth(-90).setAlpha(0.6);
    }
    for (let i = 0; i < 30; i++) {
      const tx = Phaser.Math.Between(-100, STAGE_WIDTH + 100);
      const ty = Phaser.Math.Between(340, 400);
      const trunkH = Phaser.Math.Between(40, 80);
      this.add.rectangle(tx, ty, 8, trunkH, 0x443322).setScrollFactor(0.5).setDepth(-80);
      this.add.circle(tx, ty - trunkH / 2, Phaser.Math.Between(15, 30), 0x226622)
        .setScrollFactor(0.5).setDepth(-80).setAlpha(0.7);
    }
    for (let i = 0; i < 15; i++) {
      const tx = Phaser.Math.Between(0, STAGE_WIDTH);
      const ty = Phaser.Math.Between(GROUND_MIN_Y - 40, GROUND_MIN_Y);
      const trunkH = Phaser.Math.Between(60, 100);
      this.add.rectangle(tx, ty, 12, trunkH, 0x553322).setScrollFactor(0.9).setDepth(-10);
      this.add.circle(tx, ty - trunkH / 2, Phaser.Math.Between(20, 40), 0x338833)
        .setScrollFactor(0.9).setDepth(-10).setAlpha(0.8);
    }
    this.add.rectangle(STAGE_WIDTH / 2, (GROUND_MIN_Y + GROUND_MAX_Y) / 2, STAGE_WIDTH, GROUND_MAX_Y - GROUND_MIN_Y, 0x557733)
      .setDepth(-5).setAlpha(0.4);
    this.add.rectangle(STAGE_WIDTH / 2, GROUND_MIN_Y, STAGE_WIDTH, 4, 0x448833).setDepth(-4);
    this.add.rectangle(STAGE_WIDTH / 2, GROUND_MAX_Y + 40, STAGE_WIDTH, 80, 0x443311).setDepth(9999);
    this.add.rectangle(STAGE_WIDTH / 2, GROUND_MAX_Y + 80, STAGE_WIDTH, 200, 0x332211).setDepth(9999);
  }

  // --- Update loop ---

  update(time: number, delta: number): void {
    if (this.paused) return;
    this.hero.update(time, delta);

    // Summon ghoul on U key
    if (this.summonCooldown > 0) this.summonCooldown -= delta;
    this.handleSummon();

    this.waveSpawner.update();

    const enemies = this.waveSpawner.getEnemies();
    for (const enemy of enemies) {
      enemy.update(time, delta);
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.alive) { this.projectiles.splice(i, 1); continue; }
      proj.update(time, delta);
    }

    // Update ghouls
    for (const ghoul of this.ghouls) {
      ghoul.update(time, delta, enemies);
    }

    // Update decay DOTs
    this.updateDecayEffects(delta);

    // Combat
    this.checkHeroMeleeHits(enemies);
    this.checkProjectileHits(enemies);
    this.checkGhoulHits(enemies);
    this.checkEnemyAttackHits(enemies);
  }

  // --- Combat: melee ---

  private checkHeroMeleeHits(enemies: Enemy[]): void {
    if (!this.hero.hitboxActive) return;

    const hb = this.hero.getHitboxWorldPosition();
    const heroHitRect = new Phaser.Geom.Rectangle(hb.x, hb.y, hb.w, hb.h);

    for (const enemy of enemies) {
      if (enemy.isDead || this.hero.hitEnemies.has(enemy.id)) continue;
      if (Math.abs(this.hero.groundY - enemy.groundY) > 30) continue;

      const enemyRect = enemy.getBodyWorldRect();
      if (Phaser.Geom.Rectangle.Overlaps(heroHitRect, enemyRect)) {
        this.hero.hitEnemies.add(enemy.id);
        enemy.takeDamage(this.hero.currentHitboxDamage);
        this.cameras.main.shake(50, 0.002);
      }
    }
  }

  // --- Combat: projectiles ---

  private checkProjectileHits(enemies: Enemy[]): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;

      const projRect = proj.getWorldRect();

      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        if (Math.abs(proj.groundY - enemy.groundY) > 30) continue;

        const enemyRect = enemy.getBodyWorldRect();
        if (Phaser.Geom.Rectangle.Overlaps(projRect, enemyRect)) {
          // Direct hit damage
          enemy.takeDamage(proj.config.damage);
          this.cameras.main.shake(40, 0.0015);

          // Apply decay DOT if configured
          if (proj.config.decay) {
            this.applyDecay(enemy, proj.config.damage);
          }

          proj.die();
          break; // Projectile hits one enemy
        }
      }
    }
  }

  // --- Combat: enemy attacks ---

  // --- Combat: ghoul attacks ---

  private checkGhoulHits(enemies: Enemy[]): void {
    for (const ghoul of this.ghouls) {
      if (!ghoul.alive || !ghoul.hitboxActive || !ghoul.hitTarget) continue;
      const target = ghoul.hitTarget;
      if (target.isDead) continue;
      if (Math.abs(ghoul.groundY - target.groundY) > 30) continue;

      target.takeDamage(ghoul.hitboxDamage);
    }
  }

  // --- Combat: enemy attacks ---

  private checkEnemyAttackHits(enemies: Enemy[]): void {
    if (this.hero.isDead) return;

    const heroRect = new Phaser.Geom.Rectangle(
      this.hero.x - 14,
      this.hero.groundY - 44 + this.hero.jumpZ,
      28, 44,
    );

    for (const enemy of enemies) {
      if (!enemy.hitboxActive || enemy.isDead || enemy.hitHero) continue;
      if (Math.abs(this.hero.groundY - enemy.groundY) > 30) continue;
      if (this.hero.jumpZ < -30) continue;

      const hb = enemy.getHitboxWorldPosition();
      const enemyHitRect = new Phaser.Geom.Rectangle(hb.x, hb.y, hb.w, hb.h);

      if (Phaser.Geom.Rectangle.Overlaps(enemyHitRect, heroRect)) {
        enemy.hitHero = true;
        this.hero.takeDamage(enemy.stats.attackPower);
      }
    }
  }
}
