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
import { getWeaponById } from '../data/weapons';
import { saveCharacter } from '../services/supabase';
import type { User } from '@supabase/supabase-js';

const STAGE_WIDTH = 3200;
const STAGE_HEIGHT = 720;

const GOBLIN_STATS: EnemyStats = {
  moveSpeed: 110,
  maxHealth: 35,
  attackPower: 7,
  defense: 1,
  detectionRange: 250,
  attackRange: 40,
  xpReward: 12,
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
  private summonKeyWasUp = true;  // edge detection: only trigger on fresh press
  private maxGhouls = 0;

  // Rot ability
  private rotKey!: Phaser.Input.Keyboard.Key;
  private rotCooldown = 0;

  // Life Leech (timed: 5s active, 3s cooldown)
  private leechKey!: Phaser.Input.Keyboard.Key;
  private leechActive = false;
  private leechTickTimer = 0;
  private leechActiveTimer = 0;
  private leechCooldown = 0;
  private leechVfx: Phaser.GameObjects.GameObject[] = [];

  // Ultimate ability (Death March for necromancer)
  private ultimateKey!: Phaser.Input.Keyboard.Key;
  private ultimateCharge = 0;
  private ultimateMaxCharge = 20; // kills needed to fill
  private ultimateTimeLeft = 0;
  private ultimateOriginalSpeed = 0;
  private ultimateCloudTimer = 0;
  private ultimateAura: Phaser.GameObjects.GameObject[] = [];
  private deathClouds: { obj: Phaser.GameObjects.Container; lifetime: number; tickTimer: number; x: number; y: number }[] = [];

  // Boss
  private bossDmgReduction = 0;
  private bossAttackDuration = 700;
  private bossAttackCooldown = 2000;
  private bossClubSwingCD = 8000;
  private bossSmashCD = 12000;

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
      this.startLevel,
    );

    // Apply attack speed attribute (weapon bonus folded in via virtual points)
    const baseSpeedPts = this.progression.attributes['attackSpeed'] ?? 0;
    const weapon = getWeaponById(this.progression.equippedWeapon ?? '');
    // Convert weapon speed % to virtual attribute points (each point = 12%)
    const weaponSpeedVirtualPts = weapon ? weapon.attackSpeedPct / 0.12 : 0;
    this.hero.attackSpeedPoints = baseSpeedPts + weaponSpeedVirtualPts;

    // Show the equipped weapon visually on the hero
    this.hero.setEquippedWeapon(this.progression.equippedWeapon);

    // Wire up projectile spawning for ranged heroes
    if (this.heroClass.attackType === 'projectile') {
      this.hero.spawnProjectile = (x, y, groundY, dirX, damage) => {
        this.spawnHeroProjectile(x, y, groundY, dirX, damage);
      };
    }

    // --- Summon Ghoul on U key ---
    this.summonKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.U);

    // --- Rot ability on I key ---
    this.rotKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.rotCooldown = 0;

    // --- Life Leech on K key (toggle) ---
    this.leechKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.leechActive = false;
    this.leechTickTimer = 0;

    // --- Ultimate ability on L key ---
    this.ultimateKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.ultimateCharge = 0;
    this.ultimateTimeLeft = 0;
    this.deathClouds = [];
    EventBus.on(Events.ENEMY_DIED, this.onEnemyDiedUltimate, this);
    EventBus.emit(Events.HERO_ULTIMATE_CHANGED, this.ultimateCharge, this.ultimateMaxCharge, false);

    // --- Wave Spawner (enemies scale aggressively with stage) ---
    const scale = Math.pow(1.15, this.stageIndex);
    const scaledGoblin: EnemyStats = {
      ...GOBLIN_STATS,
      maxHealth: Math.round(GOBLIN_STATS.maxHealth * scale),
      attackPower: Math.round(GOBLIN_STATS.attackPower * scale),
      defense: Math.round(GOBLIN_STATS.defense + this.stageIndex * 0.5),
      moveSpeed: Math.min(GOBLIN_STATS.moveSpeed + this.stageIndex * 8, 230),
      detectionRange: Math.min(250 + this.stageIndex * 30, 600),
      xpReward: Math.round(GOBLIN_STATS.xpReward * scale),
      goldReward: Math.round(GOBLIN_STATS.goldReward * scale),
    };

    // Wave size scales much harder with stage
    const baseCount = 3 + this.stageIndex * 2; // 3, 5, 7, 9, 11, 13...
    this.waveSpawner = new WaveSpawner(this, this.hero, scaledGoblin);
    this.waveSpawner.addWave(baseCount, 650, heroStartY, 420);
    this.waveSpawner.addWave(baseCount + 2, 1450, heroStartY, 1150);
    this.waveSpawner.addWave(baseCount + 4, 2200, heroStartY, 1900);

    // Bonus 4th wave starting at stage 4
    if (this.stageIndex >= 3) {
      this.waveSpawner.addWave(baseCount + 5, 1800, heroStartY, 1600);
    }
    // Bonus 5th wave starting at stage 7
    if (this.stageIndex >= 6) {
      this.waveSpawner.addWave(baseCount + 6, 2500, heroStartY, 2300);
    }

    // --- Boss difficulty scales by stage (NOT player level) ---
    // stageIndex 0 = stage 1 (easy), 5 = stage 6 (hard)
    const stageT = Math.min(this.stageIndex / 9, 1); // 0..1, caps at stage 10

    // HP grows with stage
    const bossHp = Math.round(300 + this.stageIndex * 250);

    // Defense scales gently
    const bossDef = scaledGoblin.defense + this.stageIndex;

    // Damage reduction: 0% at stage 1, scales to 50% at stage 10
    const bossDmgReduction = 0.5 * stageT;

    // Movement: slow at stage 1 (90), reaches 240 by stage 10
    const bossSpeed = Math.round(90 + this.stageIndex * 17);

    // Attack timings: slow swings at stage 1, fast at higher stages
    const bossAttackDuration = Math.round(700 - stageT * 400);  // 700ms → 300ms
    const bossAttackCooldown = Math.round(2000 - stageT * 1500); // 2s → 500ms
    const bossClubSwingCD = Math.round(8000 - stageT * 5000); // 8s → 3s
    const bossSmashCD = Math.round(12000 - stageT * 7000); // 12s → 5s

    // Detection range: smaller at low stages (less aggressive aggro)
    const bossDetection = Math.round(400 + stageT * 1100); // 400 → 1500

    const bossStats: EnemyStats = {
      ...scaledGoblin,
      maxHealth: bossHp,
      attackPower: Math.round(scaledGoblin.attackPower * 1.2),
      defense: bossDef,
      moveSpeed: bossSpeed,
      xpReward: scaledGoblin.xpReward * 20,
      goldReward: scaledGoblin.goldReward * 30,
      attackRange: 90,
      detectionRange: bossDetection,
    };

    // Store boss timings for the spawn handler
    this.bossAttackDuration = bossAttackDuration;
    this.bossAttackCooldown = bossAttackCooldown;
    this.bossClubSwingCD = bossClubSwingCD;
    this.bossSmashCD = bossSmashCD;
    this.waveSpawner.addBossWave(2900, heroStartY, 2650, bossStats);

    // Store boss damage reduction for when the boss spawns
    this.bossDmgReduction = bossDmgReduction;

    // Listen for boss spawn to show banner
    EventBus.on('boss_spawned', this.onBossSpawned, this);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.startFollow(this.hero, false, 0.05, 0.02);
    this.cameras.main.setFollowOffset(0, -50);

    // --- UI Camera (renders HUD without zoom) ---
    const uiCamera = this.cameras.add(0, 0, 1280, 720);
    uiCamera.setName('ui');
    uiCamera.setScroll(0, 0);
    // UI camera ignores all world objects by default; we'll add HUD elements after creation

    // --- HUD ---
    this.hud = new HUD(this);

    // Build skill icons + control hints based on what's actually unlocked
    const ownedSkills = new Set<string>();
    for (const [id, lvl] of Object.entries(this.progression.skills ?? {})) {
      if ((lvl as number) > 0) ownedSkills.add(id);
    }
    const ultimateUnlocked = this.startLevel >= 15;
    this.hud.setupSkillUI(this, ownedSkills, ultimateUnlocked);

    // After all HUD/UI is created, make the main camera ignore them and the UI camera ignore world
    this.setupCameraLayers(uiCamera);

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

    // Apply attribute bonuses
    let bonusDmg = atkPowerPts * 3;
    let bonusRange = rangePts * 50;
    let decayPct = DECAY_PERCENT + rotPts * 0.05;
    let decayDur = DECAY_DURATION + rotPts * 500;

    // Apply equipped weapon bonuses
    const weapon = getWeaponById(prog.equippedWeapon ?? '');
    if (weapon) {
      bonusDmg += weapon.damageBonus;
      bonusRange += weapon.rangeBonus;
      decayPct += weapon.rotBonusPct;
    }

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
    const baseGhoulLevel = this.levelSystem.progression.skills['summonGhoul'] ?? 0;
    if (baseGhoulLevel === 0) return;
    // Weapon adds extra ghoul slots
    const weapon = getWeaponById(this.levelSystem.progression.equippedWeapon ?? '');
    const ghoulLevel = baseGhoulLevel + (weapon?.ghoulMaxBonus ?? 0);

    // Edge detection: only trigger on a fresh key press (was up, now down)
    const keyDown = this.summonKey.isDown;
    if (!keyDown) {
      this.summonKeyWasUp = true;
      return;
    }
    if (!this.summonKeyWasUp) return;  // key is held, not a new press
    this.summonKeyWasUp = false;       // consume the edge

    // Cooldown check
    if (this.summonCooldown > 0) return;

    // Kill all existing ghouls and summon a full fresh batch
    for (const g of this.ghouls) {
      if (g.alive) g.kill();
    }
    this.ghouls = [];

    // Spawn a full batch equal to skill level
    const dmgBonus = Math.round(ghoulLevel * 0.10 * 6);
    for (let i = 0; i < ghoulLevel; i++) {
      const gx = this.hero.x + Phaser.Math.Between(-50, 50);
      const gy = this.hero.groundY + Phaser.Math.Between(-20, 20);
      const ghoul = new Ghoul(this, gx, gy, this.hero, dmgBonus, ghoulLevel);
      this.ghouls.push(ghoul);
    }

    // Green flash on hero to show summon
    this.hero.sprite.fillColor = 0x44ff66;
    this.time.delayedCall(150, () => {
      if (!this.hero.isDead) this.hero.sprite.fillColor = this.hero.baseColor;
    });

    this.summonCooldown = 1500;
  }

  private handleRot(): void {
    const rotLevel = this.levelSystem.progression.skills['rot'] ?? 0;
    if (rotLevel === 0) return;
    if (this.hero.isDead) return;
    if (!Phaser.Input.Keyboard.JustDown(this.rotKey)) return;
    if (this.rotCooldown > 0) return;

    // Rot hits all enemies in front of the hero within range
    const rotRange = 200;
    const rotDepth = 50; // Y proximity
    const enemies = this.waveSpawner.getEnemies();
    let hitAny = false;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;

      // Must be on similar Y depth
      if (Math.abs(this.hero.groundY - enemy.groundY) > rotDepth) continue;

      // Must be in front of the hero and within range
      const dx = enemy.x - this.hero.x;
      const inFront = this.hero.facingRight ? (dx > 0 && dx < rotRange) : (dx < 0 && dx > -rotRange);
      if (inFront) {
        this.applyRotDot(enemy, rotLevel);
        this.applyRotSlow(enemy);
        hitAny = true;
      }
    }

    // Visual: dark cloud + acid rain
    const cloudX = this.hero.x + (this.hero.facingRight ? rotRange / 2 : -rotRange / 2);
    const cloudY = this.hero.groundY - 120;
    this.spawnAcidRainEffect(cloudX, cloudY, rotRange, this.hero.groundY);

    // Hero cast flash
    this.hero.sprite.fillColor = 0x33ff44;
    this.time.delayedCall(200, () => {
      if (!this.hero.isDead) this.hero.sprite.fillColor = this.hero.baseColor;
    });

    // Also apply DOT to enemies that walk into the zone during the 2s rain
    const rainDuration = 2000;
    const rainTickInterval = 400;
    let rainElapsed = 0;
    const rainEvent = this.time.addEvent({
      delay: rainTickInterval,
      repeat: Math.floor(rainDuration / rainTickInterval) - 1,
      callback: () => {
        rainElapsed += rainTickInterval;
        if (rainElapsed > rainDuration) return;
        const currentEnemies = this.waveSpawner.getEnemies();
        for (const enemy of currentEnemies) {
          if (enemy.isDead) continue;
          if (Math.abs(this.hero.groundY - enemy.groundY) > rotDepth) continue;
          const edx = enemy.x - this.hero.x;
          const inFront = this.hero.facingRight ? (edx > 0 && edx < rotRange) : (edx < 0 && edx > -rotRange);
          if (inFront) {
            // Rain tick: 5% max HP, but cap heavily for bosses
            let tickDmg = Math.ceil(enemy.stats.maxHealth * 0.05);
            if (enemy.isBoss) tickDmg = Math.min(tickDmg, 50); // hard cap for bosses
            enemy.currentHealth = Math.max(enemy.currentHealth - tickDmg, 0);
            enemy.updateHealthBarPublic();
            this.applyRotSlow(enemy);
            if (enemy.currentHealth <= 0 && !enemy.isDead) {
              enemy.isDead = true;
              enemy.sm.transition('death');
            }
          }
        }
      },
    });

    this.rotCooldown = 5000; // 5 second cooldown
  }

  private updateSkillIcons(): void {
    // Summon Ghoul: 1500ms cooldown
    this.hud.setSkillCooldown('summonGhoul', Math.max(0, this.summonCooldown / 1500));

    // Rot: 5000ms cooldown
    this.hud.setSkillCooldown('rot', Math.max(0, this.rotCooldown / 5000));

    // Life Leech: shows active duration first (5000ms), then cooldown (3000ms)
    if (this.leechActive) {
      this.hud.setSkillCooldown('lifeLeech', this.leechActiveTimer / 5000);
    } else {
      this.hud.setSkillCooldown('lifeLeech', Math.max(0, this.leechCooldown / 3000));
    }

    // Ultimate: charge-based (inverted — fills as you kill)
    if (this.hero.ultimateActive) {
      this.hud.setSkillCooldown('ultimate', this.ultimateTimeLeft / 5000);
    } else {
      // Show empty when not ready (charge progress goes the other way)
      const chargePct = this.ultimateCharge / this.ultimateMaxCharge;
      this.hud.setSkillCooldown('ultimate', 1 - chargePct);
    }
  }

  // ==================== ULTIMATE: DEATH MARCH ====================

  private onEnemyDiedUltimate = (_enemy: Enemy): void => {
    if (this.hero.ultimateActive) return;
    if (this.startLevel < 15) return;
    if (this.ultimateCharge < this.ultimateMaxCharge) {
      this.ultimateCharge++;
      const ready = this.ultimateCharge >= this.ultimateMaxCharge;
      EventBus.emit(Events.HERO_ULTIMATE_CHANGED, this.ultimateCharge, this.ultimateMaxCharge, ready);
    }
  };

  private handleUltimate(delta: number): void {
    if (this.startLevel < 15) return;
    if (this.hero.isDead) {
      if (this.hero.ultimateActive) this.endUltimate();
      return;
    }

    // Trigger when charge is full
    if (Phaser.Input.Keyboard.JustDown(this.ultimateKey) && !this.hero.ultimateActive && this.ultimateCharge >= this.ultimateMaxCharge) {
      this.startUltimate();
    }

    // Active tick
    if (this.hero.ultimateActive) {
      this.ultimateTimeLeft -= delta;
      this.ultimateCloudTimer += delta;

      // Spawn a death cloud trail every 100ms
      if (this.ultimateCloudTimer >= 100) {
        this.ultimateCloudTimer = 0;
        this.spawnDeathCloud(this.hero.x, this.hero.groundY);
      }

      if (this.ultimateTimeLeft <= 0) {
        this.endUltimate();
      }
    }
  }

  private startUltimate(): void {
    const ULTIMATE_DURATION = 5000;
    const SPEED_MULT = 1.8;

    // Reset charge
    this.ultimateCharge = 0;
    EventBus.emit(Events.HERO_ULTIMATE_CHANGED, 0, this.ultimateMaxCharge, false);

    this.hero.ultimateActive = true;
    this.hero.isInvulnerable = true;
    this.ultimateTimeLeft = ULTIMATE_DURATION;
    this.ultimateCloudTimer = 0;

    // Speed boost
    this.ultimateOriginalSpeed = this.hero.stats.moveSpeed;
    this.hero.stats.moveSpeed = this.ultimateOriginalSpeed * SPEED_MULT;

    // Float effect — lift the hero off the ground visually
    this.tweens.add({
      targets: this.hero,
      // We can't access bodyGroup directly, but tween the hero container's offset is tricky.
      // Instead, set jumpZ via the existing jump system
      duration: 200,
    });
    // Float by setting jumpZ continuously through a tween-like flag
    this.hero.jumpZ = -20;
    this.hero.isGrounded = false; // prevents jump physics from bringing it down
    this.hero.jumpVelZ = 0;

    // Glow aura around the hero
    const aura = this.add.circle(0, -20, 50, 0x44ff66, 0.15);
    this.hero.add(aura);
    this.ultimateAura.push(aura);
    this.tweens.add({
      targets: aura,
      scaleX: 1.4, scaleY: 1.4, alpha: 0.06,
      duration: 400, yoyo: true, repeat: -1,
    });

    // Bright outer ring
    const ring = this.add.circle(0, -20, 35, 0x33ff44, 0).setStrokeStyle(2, 0x44ff88, 0.6);
    this.hero.add(ring);
    this.ultimateAura.push(ring);
    this.tweens.add({
      targets: ring,
      scaleX: 1.6, scaleY: 1.6,
      alpha: 0,
      duration: 800, repeat: -1,
    });

    // "ULTIMATE!" text
    const ultText = this.add.text(640, 200, 'DEATH MARCH', {
      fontSize: '36px', color: '#44ff66', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({
      targets: ultText,
      alpha: 0, y: 180,
      duration: 1500,
      onComplete: () => ultText.destroy(),
    });

    // Camera flash
    this.cameras.main.flash(300, 80, 255, 100);
  }

  private endUltimate(): void {
    this.hero.ultimateActive = false;
    this.hero.isInvulnerable = false;
    this.ultimateTimeLeft = 0;

    // Restore speed
    this.hero.stats.moveSpeed = this.ultimateOriginalSpeed;

    // Drop back to ground
    this.hero.jumpZ = 0;
    this.hero.isGrounded = true;

    // Clean up aura
    for (const obj of this.ultimateAura) obj.destroy();
    this.ultimateAura = [];
  }

  private spawnDeathCloud(x: number, y: number): void {
    const container = this.add.container(x, y);

    // Large puffy gas cloud — multiple overlapping translucent circles
    const offsets = [
      { x: -22, y: -2, r: 26 },
      { x: 0, y: -8, r: 30 },
      { x: 22, y: -3, r: 26 },
      { x: -12, y: 12, r: 22 },
      { x: 14, y: 14, r: 22 },
      { x: 0, y: 5, r: 24 },
    ];
    const cloudParts: Phaser.GameObjects.Arc[] = [];
    for (const off of offsets) {
      const part = this.add.circle(off.x, off.y, off.r, 0x336633, 0.22);
      container.add(part);
      cloudParts.push(part);
    }

    // Toxic green inner glow
    const glow = this.add.circle(0, 0, 36, 0x44ff66, 0.18);
    container.add(glow);

    // Pulsing animation for all cloud parts
    this.tweens.add({
      targets: cloudParts,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: glow,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0.08,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    container.setDepth(y + 50);

    this.deathClouds.push({
      obj: container,
      lifetime: 3000,
      tickTimer: 0,
      x, y,
    });

    // Continuously emit small green bubbles rising out of the cloud
    const bubbleEvent = this.time.addEvent({
      delay: 90,
      repeat: 28, // 28 emissions over 2.5 seconds
      callback: () => {
        if (!container.active) return;
        const bx = x + Phaser.Math.Between(-30, 30);
        const by = y + Phaser.Math.Between(-5, 10);
        const size = Phaser.Math.Between(2, 4);
        const bubble = this.add.circle(bx, by, size, 0x66ff77, 0.8)
          .setStrokeStyle(1, 0xaaffaa, 0.5)
          .setDepth(y + 51);

        // Float upward and to the side, fade out
        this.tweens.add({
          targets: bubble,
          x: bx + Phaser.Math.Between(-15, 15),
          y: by - Phaser.Math.Between(30, 55),
          alpha: 0,
          scaleX: 0.4, scaleY: 0.4,
          duration: Phaser.Math.Between(700, 1100),
          ease: 'Sine.easeOut',
          onComplete: () => bubble.destroy(),
        });
      },
    });

    // Fade in
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 200 });

    // Cancel bubble emission when cloud is destroyed
    container.once('destroy', () => bubbleEvent.destroy());
  }

  private updateDeathClouds(delta: number): void {
    for (let i = this.deathClouds.length - 1; i >= 0; i--) {
      const cloud = this.deathClouds[i];
      cloud.lifetime -= delta;
      cloud.tickTimer += delta;

      // Damage tick every 400ms
      if (cloud.tickTimer >= 400) {
        cloud.tickTimer -= 400;
        const enemies = this.waveSpawner.getEnemies();
        for (const enemy of enemies) {
          if (enemy.isDead) continue;
          const dist = Phaser.Math.Distance.Between(cloud.x, cloud.y, enemy.x, enemy.groundY);
          if (dist > 35) continue;

          // Apply rot DOT (uses player's rot level if any, else minimum 1)
          const rotLevel = Math.max(this.levelSystem.progression.skills['rot'] ?? 0, 1);
          this.applyRotDot(enemy, rotLevel);
          this.applyRotSlow(enemy);

          // Direct damage tick
          let tickDmg = Math.ceil(enemy.stats.maxHealth * 0.04);
          if (enemy.isBoss) tickDmg = Math.min(tickDmg, 80);
          enemy.currentHealth = Math.max(enemy.currentHealth - tickDmg, 0);
          enemy.updateHealthBarPublic();
          if (enemy.currentHealth <= 0 && !enemy.isDead) {
            enemy.isDead = true;
            enemy.sm.transition('death');
          }
        }
      }

      // Fade out near end of lifetime
      if (cloud.lifetime < 800) {
        cloud.obj.setAlpha(Math.max(0, cloud.lifetime / 800));
      }

      if (cloud.lifetime <= 0) {
        cloud.obj.destroy();
        this.deathClouds.splice(i, 1);
      }
    }
  }

  private handleLeech(delta: number): void {
    const leechLevel = this.levelSystem.progression.skills['lifeLeech'] ?? 0;
    if (leechLevel === 0) return;
    if (this.hero.isDead) {
      this.stopLeech();
      return;
    }

    // Tick down cooldown
    if (this.leechCooldown > 0) this.leechCooldown -= delta;

    // Press K to activate (no toggle off — runs for 5 seconds)
    if (Phaser.Input.Keyboard.JustDown(this.leechKey) && !this.leechActive && this.leechCooldown <= 0) {
      this.leechActive = true;
      this.leechActiveTimer = 5000;
      this.leechTickTimer = 0;
    }

    if (!this.leechActive) return;

    // Tick down active duration
    this.leechActiveTimer -= delta;
    if (this.leechActiveTimer <= 0) {
      this.stopLeech();
      this.leechCooldown = 3000;
      return;
    }

    // Tick every 500ms
    this.leechTickTimer += delta;
    if (this.leechTickTimer < 500) return;
    this.leechTickTimer -= 500;

    const leechRange = 120;
    const dpsPerLevel = 5;
    const healPerLevel = 3;
    const dmgPerTick = leechLevel * dpsPerLevel; // damage per 0.5s tick
    const healPerTick = leechLevel * healPerLevel;

    const enemies = this.waveSpawner.getEnemies();
    let totalHeal = 0;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.groundY, enemy.x, enemy.groundY);
      if (dist > leechRange) continue;

      // Damage enemy (bypasses defense, but bosses still get their reduction)
      let actualLeechDmg = dmgPerTick;
      if (enemy.damageReductionPct > 0) {
        actualLeechDmg = Math.max(Math.floor(actualLeechDmg * (1 - enemy.damageReductionPct)), 1);
      }
      enemy.currentHealth = Math.max(enemy.currentHealth - actualLeechDmg, 0);
      enemy.updateHealthBarPublic();

      // Spawn 3-4 red bubbles floating from enemy to necromancer
      const bubbleCount = Phaser.Math.Between(3, 4);
      for (let b = 0; b < bubbleCount; b++) {
        const startX = enemy.x + Phaser.Math.Between(-6, 6);
        const startY = enemy.y - 16 + Phaser.Math.Between(-4, 4);
        const size = Phaser.Math.Between(3, 5);
        const targetX = this.hero.x + Phaser.Math.Between(-4, 4);
        const targetY = this.hero.y - 24 + Phaser.Math.Between(-4, 4);

        // Bubble body — translucent red
        const bubble = this.add.circle(startX, startY, size, 0xcc1133, 0.75)
          .setStrokeStyle(1, 0xff5577, 0.8)
          .setDepth(enemy.groundY + 50);

        // Highlight shine on bubble (small white dot)
        const shine = this.add.circle(startX - size * 0.4, startY - size * 0.4, size * 0.3, 0xffeeee, 0.7)
          .setDepth(enemy.groundY + 51);

        // Stagger start so they spawn in sequence
        const delay = b * 40;
        const duration = Phaser.Math.Between(450, 650);

        // Wobbly path — float upward and inward
        const midX = (startX + targetX) / 2 + Phaser.Math.Between(-15, 15);
        const midY = Math.min(startY, targetY) - Phaser.Math.Between(15, 30);

        this.tweens.add({
          targets: [bubble, shine],
          delay,
          duration,
          ease: 'Sine.easeInOut',
          x: { from: startX, to: targetX },
          y: { from: startY, to: targetY },
          onUpdate: (tween) => {
            // Quadratic bezier-ish wobble
            const t = tween.progress;
            const bx = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * targetX;
            const by = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * targetY;
            bubble.x = bx;
            bubble.y = by;
            shine.x = bx - size * 0.4;
            shine.y = by - size * 0.4;
          },
          onComplete: () => { bubble.destroy(); shine.destroy(); },
        });

        // Fade out near the end
        this.tweens.add({
          targets: [bubble, shine],
          delay: delay + duration * 0.7,
          alpha: 0,
          duration: duration * 0.3,
        });
      }

      totalHeal += healPerTick;

      if (enemy.currentHealth <= 0 && !enemy.isDead) {
        enemy.isDead = true;
        enemy.sm.transition('death');
      }
    }

    // Heal the hero
    if (totalHeal > 0 && this.hero.currentHealth < this.hero.stats.maxHealth) {
      this.hero.currentHealth = Math.min(this.hero.currentHealth + totalHeal, this.hero.stats.maxHealth);
      EventBus.emit(Events.HERO_HEALTH_CHANGED, this.hero.currentHealth, this.hero.stats.maxHealth);

      // Green heal flash on hero
      this.hero.sprite.fillColor = 0x44ff66;
      this.time.delayedCall(100, () => {
        if (!this.hero.isDead) this.hero.sprite.fillColor = this.hero.baseColor;
      });
    }

    // Persistent aura VFX while active
    if (this.leechVfx.length === 0) {
      const aura = this.add.circle(0, -20, leechRange, 0xff2266, 0.04);
      this.hero.add(aura);
      this.leechVfx.push(aura);
      this.tweens.add({
        targets: aura,
        scaleX: 1.1, scaleY: 1.1, alpha: 0.02,
        duration: 600, yoyo: true, repeat: -1,
      });
    }
  }

  private stopLeech(): void {
    this.leechActive = false;
    this.leechTickTimer = 0;
    for (const vfx of this.leechVfx) vfx.destroy();
    this.leechVfx = [];
  }

  private spawnAcidRainEffect(cx: number, cy: number, width: number, groundY: number): void {
    const depth = groundY + 100;

    // Dark cloud — multiple overlapping ellipses for a puffy look
    const cloudParts: Phaser.GameObjects.Arc[] = [];
    const cloudOffsets = [
      { x: -40, y: 0, r: 35 }, { x: -10, y: -8, r: 40 }, { x: 25, y: -3, r: 35 },
      { x: 55, y: 5, r: 30 }, { x: -60, y: 8, r: 25 }, { x: 60, y: 10, r: 20 },
    ];
    for (const off of cloudOffsets) {
      const part = this.add.circle(cx + off.x, cy + off.y, off.r, 0x222233, 0.85)
        .setDepth(depth);
      cloudParts.push(part);
    }
    // Dark underside of cloud
    const undercloud = this.add.ellipse(cx, cy + 15, width * 0.9, 20, 0x111118, 0.5)
      .setDepth(depth);

    // Green glow inside the cloud
    const glow = this.add.circle(cx, cy, 30, 0x33ff44, 0.1).setDepth(depth + 1);
    this.tweens.add({
      targets: glow, alpha: 0.2, scaleX: 1.3, scaleY: 1.3,
      duration: 300, yoyo: true, repeat: 3,
    });

    // Acid rain drops — spawn continuously for 2 seconds
    const rainDuration = 2000;
    const dropInterval = 50;
    let elapsed = 0;

    const rainTimer = this.time.addEvent({
      delay: dropInterval,
      repeat: Math.floor(rainDuration / dropInterval) - 1,
      callback: () => {
        elapsed += dropInterval;
        if (elapsed > rainDuration) return;

        // Spawn 2-3 drops per tick
        const dropCount = Phaser.Math.Between(2, 3);
        for (let i = 0; i < dropCount; i++) {
          const dx = cx + Phaser.Math.Between(-width / 2, width / 2);
          const startY = cy + Phaser.Math.Between(15, 25);

          // Acid drop — small green line/rect
          const drop = this.add.rectangle(dx, startY, 2, Phaser.Math.Between(6, 12), 0x44ff44, 0.7)
            .setDepth(depth + 2);

          // Fall to ground
          this.tweens.add({
            targets: drop,
            y: groundY + Phaser.Math.Between(-5, 5),
            alpha: 0.3,
            duration: Phaser.Math.Between(250, 450),
            onComplete: () => {
              // Splash effect on ground
              const splash = this.add.circle(dx, groundY, Phaser.Math.Between(3, 6), 0x33cc33, 0.4)
                .setDepth(depth + 1);
              this.tweens.add({
                targets: splash,
                scaleX: 2, scaleY: 0.3, alpha: 0,
                duration: 300,
                onComplete: () => splash.destroy(),
              });
              drop.destroy();
            },
          });
        }
      },
    });

    // Fade out cloud after rain stops
    this.time.delayedCall(rainDuration, () => {
      const allCloudParts = [...cloudParts, undercloud, glow];
      this.tweens.add({
        targets: allCloudParts,
        alpha: 0,
        duration: 800,
        onComplete: () => {
          allCloudParts.forEach(p => p.destroy());
        },
      });
    });
  }

  /** Apply a rot DOT based on % of enemy max HP */
  private applyRotDot(enemy: Enemy, rotLevel: number): void {
    const rotDuration = 3000;
    const tickInterval = 500;
    // 15% base + 10% per additional level — very strong DOT
    const hpPercent = 0.15 + (rotLevel - 1) * 0.10;
    let totalDmg = Math.ceil(enemy.stats.maxHealth * hpPercent);
    // Cap rot damage on bosses so they aren't melted by % HP DOT
    if (enemy.isBoss) totalDmg = Math.min(totalDmg, 500);
    const numTicks = Math.floor(rotDuration / tickInterval);
    const dmgPerTick = Math.ceil(totalDmg / numTicks);

    this.decayEffects.push({
      enemy,
      totalDamage: totalDmg,
      damagePerTick: dmgPerTick,
      elapsed: 0,
      tickAccumulator: 0,
    });

    // Poison VFX on the enemy
    this.spawnPoisonEffect(enemy, rotDuration);
  }

  private spawnPoisonEffect(enemy: Enemy, duration: number): void {
    if (enemy.isDead) return;

    // Green toxic aura around the enemy
    const aura = this.add.circle(0, -16, 18, 0x33ff44, 0.12);
    enemy.bodyGroup.add(aura);
    this.tweens.add({
      targets: aura,
      scaleX: 1.4, scaleY: 1.4, alpha: 0.04,
      duration: 400, yoyo: true, repeat: -1,
    });

    // Green tint on the sprite
    enemy.sprite.fillColor = 0x336622;

    // Bubbling poison particles rising from the enemy
    const bubbleInterval = 150;
    let elapsed = 0;
    const bubbleTimer = this.time.addEvent({
      delay: bubbleInterval,
      repeat: Math.floor(duration / bubbleInterval) - 1,
      callback: () => {
        elapsed += bubbleInterval;
        if (elapsed > duration || enemy.isDead) {
          bubbleTimer.destroy();
          return;
        }

        // Spawn 1-2 green bubbles
        const count = Phaser.Math.Between(1, 2);
        for (let i = 0; i < count; i++) {
          const bx = enemy.x + Phaser.Math.Between(-10, 10);
          const by = enemy.y - Phaser.Math.Between(10, 30);
          const size = Phaser.Math.Between(2, 4);
          const bubble = this.add.circle(bx, by, size, 0x44ff44, 0.6)
            .setDepth(enemy.depth + 1);

          this.tweens.add({
            targets: bubble,
            y: by - Phaser.Math.Between(15, 30),
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: Phaser.Math.Between(400, 700),
            onComplete: () => bubble.destroy(),
          });
        }
      },
    });

    // Clean up after duration
    this.time.delayedCall(duration, () => {
      if (!enemy.isDead) {
        enemy.sprite.fillColor = 0x559944; // restore original color
      }
      aura.destroy();
    });
  }

  /** Slow an enemy by 50% for 3 seconds */
  private applyRotSlow(enemy: Enemy): void {
    if (enemy.isDead) return;
    enemy.speedMultiplier = 0.4;
    // Restore speed after 3 seconds (refreshes if re-applied)
    this.time.delayedCall(3000, () => {
      if (!enemy.isDead) {
        enemy.speedMultiplier = 1.0;
      }
    });
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

  /** Split world objects from UI: main camera ignores UI, UI camera ignores world */
  private setupCameraLayers(uiCamera: Phaser.Cameras.Scene2D.Camera): void {
    // Any object with scrollFactor 0 is treated as UI; everything else is world.
    // We iterate all children of the scene and assign them to cameras.
    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    const uiObjects: Phaser.GameObjects.GameObject[] = [];

    this.children.list.forEach((obj: Phaser.GameObjects.GameObject) => {
      // Check if it's a UI object (scrollFactorX = 0)
      const o = obj as Phaser.GameObjects.GameObject & { scrollFactorX?: number };
      if (o.scrollFactorX === 0) {
        uiObjects.push(obj);
      } else {
        worldObjects.push(obj);
      }
    });

    // Main camera ignores UI objects
    if (uiObjects.length > 0) this.cameras.main.ignore(uiObjects);
    // UI camera ignores world objects
    if (worldObjects.length > 0) uiCamera.ignore(worldObjects);

    // For dynamically-created UI elements during gameplay, set up an observer
    // that adds new objects to the right camera based on their scrollFactor
    this.events.on('addedtoscene', (obj: Phaser.GameObjects.GameObject) => {
      const o = obj as Phaser.GameObjects.GameObject & { scrollFactorX?: number };
      // Wait one frame so scrollFactor has been set by the caller
      this.time.delayedCall(0, () => {
        if (o.scrollFactorX === 0) {
          this.cameras.main.ignore(obj);
        } else {
          uiCamera.ignore(obj);
        }
      });
    });
  }

  // ==================== BOSS SPECIAL ATTACKS ====================

  private handleBossCharge(boss: Enemy, delta: number): void {
    // Only available below 50% HP
    const hpPct = boss.currentHealth / boss.stats.maxHealth;
    if (hpPct >= 0.5) return;

    // Tick cooldowns
    if (boss.chargeCooldown > 0) boss.chargeCooldown -= delta;

    // Charge in progress (dash phase)
    if (boss.chargeActive) {
      boss.chargeTimer -= delta;
      // Move boss rapidly toward target X
      const dx = boss.chargeTargetX - boss.x;
      const chargeSpeed = 700;
      const dt = delta / 1000;
      if (Math.abs(dx) > 5) {
        boss.x += Math.sign(dx) * chargeSpeed * dt;
      }

      // Check hit on hero (one hit per charge)
      if (!boss.chargeHasHit && !this.hero.isDead) {
        const distToHero = Math.abs(this.hero.x - boss.x);
        if (distToHero < 80 && Math.abs(this.hero.groundY - boss.groundY) < 100 && this.hero.jumpZ > -40) {
          boss.chargeHasHit = true;
          // Deal 25% of hero's MAX HP as damage (bypasses defense)
          const dmg = Math.ceil(this.hero.stats.maxHealth * 0.25);
          this.hero.takeDamage(dmg);
          // Visual hit feedback
          this.cameras.main.shake(200, 0.01);
        }
      }

      // End the charge after 1.5 seconds or arriving at target
      if (boss.chargeTimer <= 0 || Math.abs(dx) < 5) {
        boss.chargeActive = false;
        boss.chargeCooldown = 8000; // 8 second cooldown
      }
      return;
    }

    // Telegraph in progress (wind-up)
    if (boss.chargeTelegraphActive) {
      boss.chargeTelegraphTimer -= delta;
      if (boss.chargeTelegraphTimer <= 0) {
        boss.chargeTelegraphActive = false;
        this.executeBossCharge(boss);
      }
      return;
    }

    // Should we start a new charge?
    if (boss.chargeCooldown <= 0 && !this.hero.isDead) {
      const distToHero = Math.abs(this.hero.x - boss.x);
      // Trigger when hero is between 200 and 700 px away
      if (distToHero > 200 && distToHero < 700) {
        this.startBossChargeTelegraph(boss);
      }
    }
  }

  private startBossChargeTelegraph(boss: Enemy): void {
    boss.chargeTelegraphActive = true;
    boss.chargeTelegraphTimer = 800; // 0.8s wind-up

    // Boss flashes red and rears back
    boss.sprite.fillColor = 0xff2222;

    // Warning streak from boss to hero direction
    const dirX = this.hero.x > boss.x ? 1 : -1;
    const lineX1 = boss.x;
    const lineX2 = boss.x + dirX * 600;
    const lineY = boss.groundY - 30;
    const warningLine = this.add.line(0, 0, lineX1, lineY, lineX2, lineY, 0xff3333, 0.4)
      .setLineWidth(8)
      .setDepth(boss.groundY + 1);

    // Pulse the line
    this.tweens.add({
      targets: warningLine,
      alpha: 0.8,
      duration: 200,
      yoyo: true,
      repeat: 1,
      onComplete: () => warningLine.destroy(),
    });

    // Boss "CHARGING!" text
    const warnText = this.add.text(640, 280, '⚡ BOSS CHARGE ⚡', {
      fontSize: '30px', color: '#ff4444', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({
      targets: warnText, alpha: 0, duration: 800, delay: 200,
      onComplete: () => warnText.destroy(),
    });

    // Restore color after telegraph
    this.time.delayedCall(800, () => {
      if (!boss.isDead) boss.sprite.fillColor = 0x559944;
    });
  }

  private executeBossCharge(boss: Enemy): void {
    boss.chargeActive = true;
    boss.chargeTimer = 1500; // 1.5s max charge duration
    boss.chargeHasHit = false;
    // Charge straight toward hero's current X position
    boss.chargeTargetX = this.hero.x;

    // Trail effect — leave fading dust behind the boss
    let trailTimer = 0;
    const trailEvent = this.time.addEvent({
      delay: 50,
      repeat: 30,
      callback: () => {
        trailTimer += 50;
        if (!boss.chargeActive || trailTimer > 1500) { trailEvent.destroy(); return; }
        const dust = this.add.circle(boss.x, boss.groundY + 5, 8, 0xccaa66, 0.5)
          .setDepth(boss.groundY - 1);
        this.tweens.add({
          targets: dust,
          alpha: 0,
          scaleX: 1.5, scaleY: 0.5,
          duration: 400,
          onComplete: () => dust.destroy(),
        });
      },
    });
  }

  private handleBossClubSwing(boss: Enemy, delta: number): void {
    if (boss.clubSwingCooldown > 0) boss.clubSwingCooldown -= delta;
    if (boss.clubSwingCooldown > 0) return;

    boss.clubSwingCooldown = this.bossClubSwingCD;
    this.executeBossClubSwing(boss);
  }

  private executeBossClubSwing(boss: Enemy): void {
    // Face the nearest target so the swing is in the right direction
    const nearestX = boss.targetX;
    const facingRight = nearestX > boss.x;

    const swingRange = 220;
    const swingDepth = 100;
    const swingDmg = Math.round(boss.stats.attackPower * 1.0);

    // Visual: arc slash sweeping in front of the boss
    const slashX = boss.x + (facingRight ? swingRange / 2 : -swingRange / 2);
    const slashY = boss.groundY - 30;

    // Big slash arc — using an ellipse
    const slash = this.add.ellipse(slashX, slashY, swingRange, swingDepth * 1.6, 0xffaa44, 0.5)
      .setStrokeStyle(4, 0xff8822, 0.9)
      .setDepth(boss.groundY + 100);

    // Quick scale-up + fade animation
    slash.setScale(0.3);
    this.tweens.add({
      targets: slash,
      scaleX: 1.1,
      scaleY: 1.0,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });

    // White streak lines for the club arc
    for (let i = 0; i < 5; i++) {
      const angle = (facingRight ? 0 : Math.PI) + (i - 2) * 0.2;
      const lineX1 = boss.x + Math.cos(angle) * 30;
      const lineY1 = boss.groundY - 50 + Math.sin(angle) * 30;
      const lineX2 = boss.x + Math.cos(angle) * swingRange;
      const lineY2 = boss.groundY - 50 + Math.sin(angle) * swingRange;
      const streak = this.add.line(0, 0, lineX1, lineY1, lineX2, lineY2, 0xffffff, 0.7)
        .setLineWidth(2)
        .setDepth(boss.groundY + 101);
      this.tweens.add({
        targets: streak,
        alpha: 0,
        duration: 300,
        onComplete: () => streak.destroy(),
      });
    }

    // Camera shake
    this.cameras.main.shake(150, 0.005);

    // Boss flashes
    boss.sprite.fillColor = 0xffaa00;
    this.time.delayedCall(150, () => {
      if (!boss.isDead) boss.sprite.fillColor = 0x559944;
    });

    // --- Damage everything in front ---

    // Hit hero
    if (!this.hero.isDead) {
      const dx = this.hero.x - boss.x;
      const inFront = facingRight ? (dx > 0 && dx < swingRange) : (dx < 0 && dx > -swingRange);
      if (inFront && Math.abs(this.hero.groundY - boss.groundY) < swingDepth && this.hero.jumpZ > -40) {
        this.hero.takeDamage(swingDmg);
      }
    }

    // Hit ALL ghouls in path (no single-target lock)
    for (const ghoul of this.ghouls) {
      if (!ghoul.alive) continue;
      const dx = ghoul.x - boss.x;
      const inFront = facingRight ? (dx > 0 && dx < swingRange) : (dx < 0 && dx > -swingRange);
      if (inFront && Math.abs(ghoul.groundY - boss.groundY) < swingDepth) {
        ghoul.takeDamage(swingDmg);
      }
    }
  }

  private handleBossSmash(boss: Enemy, delta: number): void {
    // Tick cooldowns
    if (boss.smashCooldown > 0) boss.smashCooldown -= delta;

    // Telegraph in progress?
    if (boss.smashTelegraphActive) {
      boss.smashTelegraphTimer -= delta;
      if (boss.smashTelegraphTimer <= 0 && !boss.smashHasFired) {
        // Fire the smash
        boss.smashHasFired = true;
        this.executeBossSmash(boss);
        boss.smashTelegraphActive = false;
        boss.smashCooldown = this.bossSmashCD;
      }
      return;
    }

    // Should we start a new smash? Trigger if cooldown done and hero is within ~250px
    if (boss.smashCooldown <= 0) {
      const dx = this.hero.x - boss.x;
      const dist = Math.abs(dx);
      if (dist < 350 && !this.hero.isDead) {
        this.startBossSmashTelegraph(boss);
      }
    }
  }

  private startBossSmashTelegraph(boss: Enemy): void {
    boss.smashTelegraphActive = true;
    boss.smashTelegraphTimer = 1200; // 1.2 second wind-up
    boss.smashHasFired = false;
    boss.pendingSmashDamage = Math.round(boss.stats.attackPower * 1.2);  // dialed back from 2.5
    boss.pendingSmashRange = 280;

    // Telegraph: red warning circle on the ground in front of the boss
    const telegraphX = boss.x;
    const telegraphY = boss.groundY + 5;

    const warning = this.add.ellipse(telegraphX, telegraphY, boss.pendingSmashRange * 2, 60, 0xff2222, 0.3)
      .setStrokeStyle(3, 0xff4444, 0.9)
      .setDepth(boss.groundY + 1);

    // Pulse the warning
    this.tweens.add({
      targets: warning,
      alpha: 0.6,
      duration: 200,
      yoyo: true,
      repeat: 2,
    });

    // Boss raises club animation — flash bright red
    boss.sprite.fillColor = 0xff3322;
    this.time.delayedCall(1200, () => {
      if (!boss.isDead) boss.sprite.fillColor = 0x559944;
      warning.destroy();
    });

    // "BOSS SMASH!" warning text
    const warnText = this.add.text(640, 250, '⚠ BOSS SMASH ⚠', {
      fontSize: '28px', color: '#ff4444', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({
      targets: warnText, alpha: 0, duration: 1000, delay: 200,
      onComplete: () => warnText.destroy(),
    });
  }

  private executeBossSmash(boss: Enemy): void {
    const smashRange = boss.pendingSmashRange;
    const smashDmg = boss.pendingSmashDamage;

    // Camera shake hard
    this.cameras.main.shake(400, 0.012);

    // Shockwave visual
    const shockwave = this.add.ellipse(boss.x, boss.groundY + 5, 20, 10, 0xffaa44, 0.7)
      .setStrokeStyle(4, 0xff6622, 0.9)
      .setDepth(boss.groundY + 2);
    this.tweens.add({
      targets: shockwave,
      scaleX: smashRange / 5,  // expand outward
      scaleY: 4,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => shockwave.destroy(),
    });

    // Dust particles flying up
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const dist = 30 + Math.random() * 20;
      const px = boss.x + Math.cos(angle) * dist;
      const py = boss.groundY + Math.sin(angle) * dist * 0.4;
      const particle = this.add.circle(px, py, 4, 0xccaa66, 0.7)
        .setDepth(boss.groundY + 3);
      this.tweens.add({
        targets: particle,
        x: px + Math.cos(angle) * 60,
        y: py - 30 - Math.random() * 30,
        alpha: 0,
        scaleX: 0.3, scaleY: 0.3,
        duration: 600,
        onComplete: () => particle.destroy(),
      });
    }

    // Crack lines on the ground
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
      const len = 40 + Math.random() * 30;
      const ex = boss.x + Math.cos(angle) * len;
      const ey = boss.groundY + 5 + Math.sin(angle) * len * 0.4;
      const crack = this.add.line(0, 0, boss.x, boss.groundY + 5, ex, ey, 0x331100)
        .setLineWidth(3)
        .setDepth(boss.groundY + 1);
      this.tweens.add({
        targets: crack, alpha: 0, duration: 1500,
        onComplete: () => crack.destroy(),
      });
    }

    // Damage the hero if in range
    if (!this.hero.isDead) {
      const dx = Math.abs(this.hero.x - boss.x);
      if (dx < smashRange && this.hero.jumpZ > -50) {
        // Can be dodged by jumping!
        this.hero.takeDamage(smashDmg);
      }
    }

    // Damage all ghouls in range
    for (const ghoul of this.ghouls) {
      if (!ghoul.alive) continue;
      const dx = Math.abs(ghoul.x - boss.x);
      if (dx < smashRange) {
        ghoul.takeDamage(smashDmg);
      }
    }
  }

  private onBossSpawned = (boss: Enemy): void => {
    // Apply the calculated boss properties to this specific boss
    boss.damageReductionPct = this.bossDmgReduction;
    boss.bossAttackDuration = this.bossAttackDuration;
    boss.bossAttackCooldown = this.bossAttackCooldown;
    // Show a "BOSS!" banner
    const text = this.add.text(640, 200, 'BOSS APPROACHING!', {
      fontSize: '40px', color: '#ff3344', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setScale(0.5);

    this.tweens.add({
      targets: text,
      scaleX: 1.1, scaleY: 1.1,
      duration: 300, ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: text,
      alpha: 0, y: 180,
      duration: 800, delay: 1800,
      onComplete: () => text.destroy(),
    });

    // Camera shake + flash
    this.cameras.main.shake(400, 0.005);
    this.cameras.main.flash(300, 100, 0, 0);
  };

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
    // Foreground dirt — positioned BELOW the walking lane so it doesn't cover the hero
    // Top edge is at GROUND_MAX_Y + 8 (just below the deepest hero feet position)
    this.add.rectangle(STAGE_WIDTH / 2, GROUND_MAX_Y + 48, STAGE_WIDTH, 80, 0x443311).setDepth(700);
    this.add.rectangle(STAGE_WIDTH / 2, GROUND_MAX_Y + 188, STAGE_WIDTH, 200, 0x332211).setDepth(700);
  }

  // --- Update loop ---

  update(time: number, delta: number): void {
    if (this.paused) return;

    // Purge dead ghouls each frame
    this.ghouls = this.ghouls.filter(g => g.alive);

    this.hero.update(time, delta);

    // Summon ghoul on U key
    if (this.summonCooldown > 0) this.summonCooldown -= delta;
    this.handleSummon();

    // Rot ability on I key
    if (this.rotCooldown > 0) this.rotCooldown -= delta;
    this.handleRot();

    // Life Leech on K key
    this.handleLeech(delta);

    // Ultimate ability on L key
    this.handleUltimate(delta);
    this.updateDeathClouds(delta);

    // Update skill cooldown UI
    this.updateSkillIcons();

    this.waveSpawner.update();

    const enemies = this.waveSpawner.getEnemies();

    // Per-stage goblin aggression: shorter attack timings at higher stages
    const stageT = Math.min(this.stageIndex / 9, 1);
    const goblinAtkDur = Math.round(400 - stageT * 200);   // 400 → 200ms
    const goblinAtkCD = Math.round(800 - stageT * 500);    // 800 → 300ms

    // Set each enemy's target to the nearest hero or ghoul
    for (const enemy of enemies) {
      this.updateEnemyTarget(enemy);

      // Apply stage-scaled aggression to non-boss enemies (idempotent)
      if (!enemy.isBoss) {
        enemy.attackDurationOverride = goblinAtkDur;
        enemy.attackCooldownOverride = goblinAtkCD;
      }

      enemy.update(time, delta);

      // Boss special attacks
      if (enemy.isBoss && !enemy.isDead) {
        this.handleBossSmash(enemy, delta);
        this.handleBossClubSwing(enemy, delta);
        this.handleBossCharge(enemy, delta);
      }
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

  // --- Target selection: enemies target nearest hero or ghoul ---

  private updateEnemyTarget(enemy: Enemy): void {
    let nearestDist = Infinity;
    let tx = this.hero.x;
    let ty = this.hero.groundY;
    let dead = this.hero.isDead;

    // Check hero distance
    if (!this.hero.isDead) {
      const d = Phaser.Math.Distance.Between(enemy.x, enemy.groundY, this.hero.x, this.hero.groundY);
      if (d < nearestDist) {
        nearestDist = d;
        tx = this.hero.x;
        ty = this.hero.groundY;
        dead = false;
      }
    }

    // Check all alive ghouls
    for (const ghoul of this.ghouls) {
      if (!ghoul.alive) continue;
      const d = Phaser.Math.Distance.Between(enemy.x, enemy.groundY, ghoul.x, ghoul.groundY);
      if (d < nearestDist) {
        nearestDist = d;
        tx = ghoul.x;
        ty = ghoul.groundY;
        dead = false;
      }
    }

    enemy.targetX = tx;
    enemy.targetY = ty;
    enemy.targetIsDead = dead;
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
        if (Math.abs(proj.groundY - enemy.groundY) > (enemy.isBoss ? 120 : 30)) continue;

        const enemyRect = enemy.getBodyWorldRect();
        if (Phaser.Geom.Rectangle.Overlaps(projRect, enemyRect)) {
          // Direct hit damage
          enemy.takeDamage(proj.config.damage);
          this.cameras.main.shake(40, 0.0015);

          // Apply decay DOT if configured
          if (proj.config.decay) {
            this.applyDecay(enemy, proj.config.damage);
          }

          // Apply Rot DOT + slow if player has the Rot skill
          const rotLevel = this.levelSystem.progression.skills['rot'] ?? 0;
          if (rotLevel > 0) {
            this.applyRotDot(enemy, rotLevel);
            this.applyRotSlow(enemy);
          }

          // Lifesteal from equipped weapon
          const weapon = getWeaponById(this.levelSystem.progression.equippedWeapon ?? '');
          if (weapon && weapon.lifestealPct > 0 && !this.hero.isDead) {
            const heal = Math.ceil(proj.config.damage * weapon.lifestealPct);
            this.hero.currentHealth = Math.min(this.hero.currentHealth + heal, this.hero.stats.maxHealth);
            EventBus.emit(Events.HERO_HEALTH_CHANGED, this.hero.currentHealth, this.hero.stats.maxHealth);
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
    for (const enemy of enemies) {
      if (!enemy.hitboxActive || enemy.isDead || enemy.hitHero) continue;

      const hb = enemy.getHitboxWorldPosition();
      const enemyHitRect = new Phaser.Geom.Rectangle(hb.x, hb.y, hb.w, hb.h);

      // Check hero
      if (!this.hero.isDead) {
        if (Math.abs(this.hero.groundY - enemy.groundY) <= (enemy.isBoss ? 100 : 30) && this.hero.jumpZ >= -30) {
          const heroRect = new Phaser.Geom.Rectangle(
            this.hero.x - 14,
            this.hero.groundY - 44 + this.hero.jumpZ,
            28, 44,
          );
          if (Phaser.Geom.Rectangle.Overlaps(enemyHitRect, heroRect)) {
            enemy.hitHero = true;
            this.hero.takeDamage(enemy.stats.attackPower);
            continue;
          }
        }
      }

      // Check ghouls
      for (const ghoul of this.ghouls) {
        if (!ghoul.alive) continue;
        if (Math.abs(ghoul.groundY - enemy.groundY) > (enemy.isBoss ? 100 : 30)) continue;

        const ghoulRect = ghoul.getBodyWorldRect();
        if (Phaser.Geom.Rectangle.Overlaps(enemyHitRect, ghoulRect)) {
          enemy.hitHero = true; // reuse flag to prevent multi-hit
          ghoul.takeDamage(enemy.stats.attackPower);
          break;
        }
      }
    }
  }
}
