import Phaser from 'phaser';
import { Hero, GROUND_MIN_Y, GROUND_MAX_Y, MELEE_TUNE } from '../entities/Hero';
import {
  spawnHitSparks,
  spawnHitStop,
  spawnDustPuff,
  spawnShockwave,
  spawnHolyBurst,
} from '../visuals/combatFx';
import * as paint from '../visuals/paint';
import { preloadTextureAssets, TextureKeys, clearStaleTextures } from '../visuals/textures';
import { ensureEnvironmentTextures } from '../visuals/procedural/environmentTextures';
import * as skillFx from '../visuals/skillFx';
import { generatePlaceholderAssets } from '../visuals/placeholderAssets';
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
import { getSidekickById, sidekickXpForLevel, SIDEKICK_MAX_LEVEL } from '../data/sidekicks';
import { Sidekick } from '../entities/Sidekick';
import { saveCharacter } from '../services/supabase';
import type { User } from '@supabase/supabase-js';
import { getStageConfig, getStageBiome } from '../data/stageConfigs';
import { getEnemyArchetype, EnemyArchetype } from '../data/enemyTypes';
import { buildBiomeEnvironment, BiomeId } from '../environments/BiomeBuilder';
import { buildStageEnvironment } from '../environments/StageEnvironments';
import type { ForestMapLayout } from '../environments/MapLoader';
import { WalkMask } from '../systems/WalkMask';

const STAGE_WIDTH = 8000;
const STAGE_HEIGHT = 720;

const GOBLIN_STATS: EnemyStats = {
  moveSpeed: 110,
  maxHealth: 35,
  attackPower: 7,
  defense: 1,
  detectionRange: 250,
  attackRange: 40,
  xpReward: 8,       // reduced from 12 — was causing runaway leveling
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

  // Walk mask boundary system (pixel-based from painted mask PNG)
  public walkMask = new WalkMask();

  // Projectile management
  private projectiles: Projectile[] = [];
  private enemyProjectiles: Projectile[] = [];

  // Decay DOT tracking
  private decayEffects: DecayEffect[] = [];

  // Ghouls (summoned minions)
  private ghouls: Ghoul[] = [];

  // Gold
  private gold = 0;

  // Dragon mount (Paladin only)
  private dragonKey!: Phaser.Input.Keyboard.Key;
  private dragonMounted = false;
  private dragonBody: Phaser.GameObjects.Container | null = null;
  private dragonBreathing = false;
  private dragonOrigSpeed = 0;

  // Summon
  private summonKey!: Phaser.Input.Keyboard.Key;
  private summonCooldown = 0;
  /** Timer for spawning movement dust puffs at hero feet during fast movement */
  private movementDustTimer = 0;
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

  // Bone Spear Volley (level 30)
  private boneVolleyKey!: Phaser.Input.Keyboard.Key;
  private boneVolleyCooldown = 0;
  private static readonly BONE_VOLLEY_CD = 4000;

  // Wraith Form (level 50)
  private wraithFormKey!: Phaser.Input.Keyboard.Key;
  private wraithCooldown = 0;
  private wraithActive = false;
  private wraithTimer = 0;
  private wraithDuration = 0;
  private wraithContactDmg = 0;
  private wraithSpeedOriginal = 0;
  private wraithBaseAlpha = 1;
  private wraithHitTimers = new Map<number, number>();
  private wraithVfx: Phaser.GameObjects.GameObject[] = [];
  private static readonly WRAITH_CD = 18000;

  // Soul Apocalypse (level 70)
  private apocalypseKey!: Phaser.Input.Keyboard.Key;
  private apocalypseCooldown = 0;
  private static readonly APOCALYPSE_CD = 45000;

  // ========== Generic class-skill cooldowns (used by non-necromancer classes) ==========
  /** Map of skillId → remaining cooldown (ms). Polled by tickClassSkills. */
  private classSkillCooldowns: Record<string, number> = {};
  /** Active toggle/buff timers, e.g. berserker rage, eagle eye, bloodthirst. */
  private classBuffs: Record<string, number> = {};
  /** Held arcane shield absorb pool */
  private arcaneShieldHp = 0;

  // Sidekick (companion creature, optional)
  private sidekick: Sidekick | null = null;
  private sidekickShieldActive = false;

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

  // =========================================================================
  // SCENE LAYER SYSTEM — permanent placement references for all stages.
  //
  // RENDER ORDER (back to front):
  //   1. backgroundLayer  — sky, mountains, distant trees, clouds (depth < -10)
  //   2. walkingAreaLayer  — gameplay surface, characters, props (depth ~ -10 to 700)
  //   3. foregroundLayer   — underground cross-section, soil, roots (depth > 700)
  //
  // PLACEMENT RULES:
  //   • All gameplay objects align to walkingAreaY ONLY.
  //   • backgroundLayer is strictly visual backdrop — never used for placement.
  //   • foregroundLayer is strictly underground visual — never used for placement.
  //   • Terrain color must never determine placement.
  //   • Camera offsets must never determine placement.
  // =========================================================================

  /** Walking Area baseline — the top edge of the playable surface where
   *  characters stand and move. ALL ground-touching objects (trees, rocks,
   *  logs, enemies, characters, spawn effects, ground decals, environment
   *  props) must align their bottom edge to this Y value. */
  readonly walkingAreaY: number = GROUND_MIN_Y;

  /** Background layer depth ceiling. Anything with depth below this value
   *  is part of the background (sky, distant scenery). */
  static readonly BACKGROUND_LAYER_DEPTH = -10;

  /** Foreground layer depth floor. Anything with depth above this value
   *  is part of the foreground (underground visuals). */
  static readonly FOREGROUND_LAYER_DEPTH = 700;

  private startGold = 0;
  private startLevel = 1;
  private startXp = 0;
  private progression!: CharacterProgression;

  /** Highest stage the player has ever unlocked (never regresses) */
  private highestStage = 0;

  init(data: { heroClass?: HeroClassDef; user?: User; characterId?: string; stageIndex?: number; highestStage?: number; gold?: number; level?: number; currentXp?: number; progression?: CharacterProgression }): void {
    this.heroClass = data.heroClass || HERO_CLASSES[0];
    this.user = data.user;
    this.characterId = data.characterId;
    this.stageIndex = data.stageIndex ?? 0;
    this.highestStage = data.highestStage ?? this.stageIndex;
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
      ownedWeapons: loaded?.ownedWeapons ?? [],
      equippedWeapon: loaded?.equippedWeapon ?? undefined,
      ownedSidekicks: loaded?.ownedSidekicks ?? [],
      equippedSidekick: loaded?.equippedSidekick ?? undefined,
      sidekickLevels: loaded?.sidekickLevels ?? {},
      sidekickXp: loaded?.sidekickXp ?? {},
      sidekickSkillPoints: loaded?.sidekickSkillPoints ?? {},
      sidekickSkills: loaded?.sidekickSkills ?? {},
    };
  }

  preload(): void {
    // 0. Purge stale procedural textures if the generation code has changed
    //    since last run. This ensures old canvas textures don't linger in the
    //    Phaser cache across scene restarts or code updates.
    clearStaleTextures(this);

    // 1. Generate enhanced placeholders for keys that don't have real PNGs yet.
    //    These run FIRST so they claim the texture key before the standard
    //    procedural fallback does (higher fidelity than the default fallback).
    //    Delete placeholderAssets.ts once all real PNGs are in.
    generatePlaceholderAssets(this);

    // 2. Load any registered raster overrides. If a PNG exists in ASSET_FILES
    //    and is present on disk, Phaser loads it under the key — this trumps
    //    BOTH the placeholder and the procedural fallback.
    preloadTextureAssets(this);

    // 3. Stage 2 forest layers — loaded via DOM Image in buildStage2 (bypasses Phaser loader)
  }

  create(): void {
    EventBus.removeAllListeners();
    this.projectiles = [];
    this.decayEffects = [];
    this.ghouls = [];

    if (this.stageIndex === 0) {
      // Stage 1: load painted forest map (9960×830), tiled at 1024px
      this.buildStage1Map();
    } else {
      // Stages 2+: try per-stage handcrafted builder first
      const stageNum = this.stageIndex + 1; // stageIndex is 0-based
      const hasCustom = buildStageEnvironment(this, stageNum);
      if (!hasCustom) {
        // Fallback to biome generic builder
        const biomeId = getStageBiome(stageNum) as BiomeId;
        if (biomeId) {
          buildBiomeEnvironment(this, biomeId);
        } else {
          this.buildBackground();
        }
      }
      this.buildAmbientParticles();
    }

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

    // Holy burst VFX on final smash impact — fires even if no enemies are hit
    this.events.on('finisher_impact', (hero: Hero) => {
      spawnHolyBurst(this, hero.x, hero.groundY, {
        radius: 260, rayCount: 16, particleCount: 28, duration: 700,
      });
      spawnShockwave(this, hero.x, hero.groundY, {
        color: 0xffeebb, maxRadius: 260, duration: 500,
      });
      spawnDustPuff(this, hero.x, hero.groundY, {
        count: 14, spread: 60, duration: 500, color: 0xddccaa,
      });
      this.cameras.main.shake(MELEE_TUNE.finisherShakeDuration, MELEE_TUNE.finisherShakeIntensity);
      spawnHitStop(this, 90);
    });

    // Spawn the equipped sidekick (if any)
    const sidekickDef = getSidekickById(this.progression.equippedSidekick);
    if (sidekickDef) {
      this.sidekick = new Sidekick(this, sidekickDef, this.hero);
      this.sidekickShieldActive = sidekickDef.ability === 'shield';
      // Guardian Spirit grants passive 12% damage reduction
      if (this.sidekickShieldActive) {
        this.hero.damageReductionPct = 0.12;
      }
    }

    // Wire up projectile spawning for ranged heroes
    if (this.heroClass.attackType === 'projectile') {
      this.hero.spawnProjectile = (x, y, groundY, dirX, damage) => {
        this.spawnHeroProjectile(x, y, groundY, dirX, damage);
      };
    }

    // --- Summon Ghoul on U key ---
    this.summonKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.U);

    // --- Right-hand ergonomic skill layout ---
    // Home row (most-used): J=Attack  K=Bone Volley  L=Rot  ;=Wraith Form
    // Top row (utility):    U=Summon  I=Life Leech   O=Death March  P=Soul Apocalypse

    // Rot — home ring finger
    this.rotKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.rotCooldown = 0;

    // Life Leech — top middle finger
    this.leechKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.leechActive = false;
    this.leechTickTimer = 0;

    // Death March Ultimate — top ring finger
    this.ultimateKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    this.ultimateCharge = 0;

    // Bone Spear Volley — home middle finger (frequent damage skill)
    this.boneVolleyKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    // Wraith Form — home pinky (defensive escape, instant access)
    this.wraithFormKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SEMICOLON);
    // Soul Apocalypse — top pinky (panic button)
    this.apocalypseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    // Dragon mount — Y key (Paladin only)
    this.dragonKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    this.boneVolleyCooldown = 0;
    this.wraithCooldown = 0;
    this.apocalypseCooldown = 0;
    this.wraithActive = false;
    this.ultimateTimeLeft = 0;
    this.deathClouds = [];
    EventBus.on(Events.ENEMY_DIED, this.onEnemyDiedUltimate, this);
    EventBus.emit(Events.HERO_ULTIMATE_CHANGED, this.ultimateCharge, this.ultimateMaxCharge, false);

    // --- Wave Spawner (enemies scale aggressively with stage) ---
    // =============================================================================
    // ENEMY SCALING — uses archetype base stats scaled by stage index.
    // =============================================================================
    // Stage 1 (index 0) uses the original GOBLIN_STATS. Stages 2+ pull from
    // the enemy archetype registry and the stage config's enemyRoster.
    const combatScale = Math.pow(1.15, this.stageIndex);
    const rewardScale = 1 + this.stageIndex * 0.12;

    // Get stage config and enemy roster for this stage
    const stageConfig = getStageConfig(this.stageIndex + 1); // stageIndex is 0-based, config is 1-based
    const enemyRoster: EnemyArchetype[] = [];
    if (stageConfig) {
      for (const id of stageConfig.enemyRoster) {
        try { enemyRoster.push(getEnemyArchetype(id)); } catch (_e) { /* skip missing */ }
      }
    }
    // Primary enemy: first in roster or fallback to goblin
    const primaryArchetype = enemyRoster.length > 0 ? enemyRoster[0] : null;
    const baseStats = primaryArchetype ? primaryArchetype.baseStats : GOBLIN_STATS;

    const scaledGoblin: EnemyStats = {
      ...baseStats,
      maxHealth: Math.round(baseStats.maxHealth * combatScale),
      attackPower: Math.round(baseStats.attackPower * combatScale),
      defense: Math.round(baseStats.defense + this.stageIndex * 0.5),
      moveSpeed: Math.min(baseStats.moveSpeed + this.stageIndex * 4, 250),
      detectionRange: Math.min(baseStats.detectionRange + this.stageIndex * 15, 600),
      xpReward: Math.round(baseStats.xpReward * rewardScale),
      goldReward: Math.round(baseStats.goldReward * rewardScale),
    };

    // Build scaled stats for each archetype in the roster (used for varied spawns)
    const scaledRoster: EnemyStats[] = enemyRoster.map(arch => ({
      ...arch.baseStats,
      maxHealth: Math.round(arch.baseStats.maxHealth * combatScale),
      attackPower: Math.round(arch.baseStats.attackPower * combatScale),
      defense: Math.round(arch.baseStats.defense + this.stageIndex * 0.5),
      moveSpeed: Math.min(arch.baseStats.moveSpeed + this.stageIndex * 4, 250),
      detectionRange: Math.min(arch.baseStats.detectionRange + this.stageIndex * 15, 600),
      xpReward: Math.round(arch.baseStats.xpReward * rewardScale),
      goldReward: Math.round(arch.baseStats.goldReward * rewardScale),
    }));
    // Colors for varied enemy spawns (from archetypes)
    const rosterColors = enemyRoster.map(arch => arch.visual.bodyColor);

    // =================================================================
    // ENCOUNTER ZONES — 7 zones spread across 8000 px stage width.
    // =================================================================
    // The stage is divided into encounter segments with breathing room
    // between each. Enemies scale with stage index via baseCount.
    //
    //   Zone 1 (x ~600)    — OPENING: light encounter, teaches rhythm
    //   Zone 2 (x ~1600)   — ESCALATION: slightly larger group
    //   Zone 3 (x ~2600)   — MID-STAGE MIXED: denser, varied positioning
    //   Zone 4 (x ~3600)   — HEAVY CLUSTER: toughest regular encounter
    //   Zone 5 (x ~4800)   — BREATHER + AMBUSH: small group after a gap
    //   Zone 6 (x ~5800)   — PRE-BOSS PRESSURE: large group, final gauntlet
    //   Zone 7 (x ~7000)   — BOSS ARENA: the boss fight
    //
    // baseCount drives per-zone enemy count. It grows by +1 per stage
    // so later stages have noticeably more enemies per zone.
    const b = 2 + this.stageIndex; // 2, 3, 4, 5, 6, 7... per zone base

    // Pass primary archetype color and body style so spawns match the biome enemy visuals
    const primaryColor = primaryArchetype ? primaryArchetype.visual.bodyColor : 0x22aa44;
    const primaryBodyStyle = primaryArchetype ? primaryArchetype.visual.bodyStyle : 'humanoid';
    this.waveSpawner = new WaveSpawner(this, this.hero, scaledGoblin, primaryColor, primaryBodyStyle as any);

    // Use secondary enemy from roster for mixed waves (if available)
    const secondaryStats = scaledRoster.length > 1 ? scaledRoster[1] : scaledGoblin;
    const secondaryColor = rosterColors.length > 1 ? rosterColors[1] : 0x22aa44;
    const secondaryBodyStyle = enemyRoster.length > 1 ? enemyRoster[1].visual.bodyStyle : primaryBodyStyle;
    const tertiaryStats = scaledRoster.length > 2 ? scaledRoster[2] : secondaryStats;
    const tertiaryColor = rosterColors.length > 2 ? rosterColors[2] : secondaryColor;
    const tertiaryBodyStyle = enemyRoster.length > 2 ? enemyRoster[2].visual.bodyStyle : secondaryBodyStyle;

    // --- Boss stats (shared by all stages) ---
    const stageT = Math.min(this.stageIndex / 9, 1);
    const bossHp = Math.round(80 + this.stageIndex * 50 + this.stageIndex * this.stageIndex * 5.5);
    const bossDef = Math.floor(this.stageIndex * 0.5);
    const bossDmgReduction = 0.15 * stageT;
    const bossSpeed = Math.round(95 + this.stageIndex * 18);
    const bossAttackDuration = Math.round(800 - stageT * 480);
    const bossAttackCooldown = Math.round(2000 - stageT * 1400);
    const bossClubSwingCD = Math.round(9000 - stageT * 6500);
    const bossSmashCD = Math.round(14000 - stageT * 9800);
    const bossDetection = Math.round(600 + stageT * 1000);
    const bossStats: EnemyStats = {
      ...scaledGoblin,
      maxHealth: bossHp,
      attackPower: Math.round(scaledGoblin.attackPower * (0.8 + stageT * 0.55)),
      defense: bossDef,
      moveSpeed: bossSpeed,
      xpReward: scaledGoblin.xpReward * 8,
      goldReward: scaledGoblin.goldReward * 15,
      attackRange: 90,
      detectionRange: bossDetection,
    };
    this.bossAttackDuration = bossAttackDuration;
    this.bossAttackCooldown = bossAttackCooldown;
    this.bossClubSwingCD = bossClubSwingCD;
    this.bossSmashCD = bossSmashCD;

    // Stages 2+: hardcoded zone-based waves
    if (this.stageIndex > 0) {

    // Zone 1: OPENING — primary enemies
    this.waveSpawner.addWave(b,         800,  heroStartY, 600);

    // Zone 2: ESCALATION — introduce secondary enemy type
    if (scaledRoster.length > 1) {
      this.waveSpawner.addEliteWave(b + 1, 1800, heroStartY, 1500, secondaryStats, secondaryColor, secondaryBodyStyle as any);
    } else {
      this.waveSpawner.addWave(b + 1,     1800, heroStartY, 1500);
    }

    // Zone 3: MID-STAGE MIXED — primary + secondary mix
    this.waveSpawner.addWave(b + 1,     2800, heroStartY, 2400);
    if (scaledRoster.length > 1) {
      this.waveSpawner.addEliteWave(b, 3100, heroStartY, 2700, secondaryStats, secondaryColor, secondaryBodyStyle as any);
    } else {
      this.waveSpawner.addWave(b,         3100, heroStartY, 2700);
    }

    // Zone 4: HEAVY CLUSTER — mix all available roster types
    this.waveSpawner.addWave(b + 1,     3900, heroStartY, 3500);
    if (scaledRoster.length > 2) {
      this.waveSpawner.addEliteWave(Math.max(1, Math.floor(b * 0.6)), 4000, heroStartY, 3600, tertiaryStats, tertiaryColor, tertiaryBodyStyle as any);
    }

    // Zone 5: BREATHER + AMBUSH — smaller group after a long walk
    if (this.stageIndex >= 2) {
      this.waveSpawner.addWave(b,       5100, heroStartY, 4700);
    }

    // Zone 6: PRE-BOSS PRESSURE — final gauntlet before the boss
    this.waveSpawner.addWave(b + 2,     6100, heroStartY, 5700);
    if (this.stageIndex >= 4) {
      this.waveSpawner.addWave(b + 1,   6400, heroStartY, 6000);
    }

    // =================================================================
    // MINI-EVENT — 1 per stage, placed in the long gap between Zone 4 and
    // Zone 5 (x ~4100-4600). Rotates between 3 event types by stage index
    // so every stage feels different. Elite enemies use boosted stats with
    // a distinct tint color so the player knows they're special.
    // =================================================================
    {
      const eventX = 4300;          // trigger position (in the breather gap)
      const eventSpawnX = 4500;     // where enemies appear
      const eventType = this.stageIndex % 3;

      // Elite stats: 2× HP, 1.5× ATK, 1.5× XP/gold reward vs regular goblins
      const eliteStats: EnemyStats = {
        ...scaledGoblin,
        maxHealth: Math.round(scaledGoblin.maxHealth * 2),
        attackPower: Math.round(scaledGoblin.attackPower * 1.5),
        defense: scaledGoblin.defense + 1,
        moveSpeed: Math.min(scaledGoblin.moveSpeed + 20, 240),
        xpReward: Math.round(scaledGoblin.xpReward * 1.5),
        goldReward: Math.round(scaledGoblin.goldReward * 1.5),
      };

      switch (eventType) {
        case 0: {
          // ----- AMBUSH: enemies spawn from BOTH sides simultaneously -----
          // Two small waves triggered at the same X, one spawning left and
          // one spawning right. The player is caught in the middle.
          const ambushCount = Math.max(2, Math.floor(b * 0.6));
          this.waveSpawner.addWave(ambushCount, eventSpawnX, heroStartY, eventX);
          // The second "flank" wave spawns at a position behind the hero.
          // WaveSpawner always spawns at rightEdge, but by using a very low
          // spawnX (behind the trigger) we get enemies that were already
          // passed — they'll chase from behind.
          this.waveSpawner.addWave(ambushCount, eventX - 300, heroStartY, eventX);
          break;
        }
        case 1: {
          // ----- ELITE SQUAD: fewer but tougher enemies with boosted stats -----
          // Red-tinted enemies that hit harder and take more hits to kill.
          const eliteCount = Math.max(2, Math.floor(b * 0.5));
          // Use a reddened version of the primary archetype color for elites
          const eliteR = Math.min(0xff, ((primaryColor >> 16) & 0xff) + 0x60);
          const eliteG = Math.max(0, ((primaryColor >> 8) & 0xff) - 0x20);
          const eliteB = Math.max(0, (primaryColor & 0xff) - 0x20);
          const eliteTint = (eliteR << 16) | (eliteG << 8) | eliteB;
          this.waveSpawner.addEliteWave(
            eliteCount, eventSpawnX, heroStartY, eventX,
            eliteStats, eliteTint,
          );
          break;
        }
        case 2: {
          // ----- SWARM: large burst of weaker enemies rushing at once -----
          // 2× the normal count but with reduced HP. Chaotic and fun.
          const swarmStats: EnemyStats = {
            ...scaledGoblin,
            maxHealth: Math.round(scaledGoblin.maxHealth * 0.5),
            moveSpeed: Math.min(scaledGoblin.moveSpeed + 30, 250),
            attackPower: Math.round(scaledGoblin.attackPower * 0.7),
          };
          const swarmCount = Math.max(4, b * 2);
          // Use a brightened version of the primary color for swarm
          const swarmR = Math.min(0xff, ((primaryColor >> 16) & 0xff) + 0x20);
          const swarmG = Math.min(0xff, ((primaryColor >> 8) & 0xff) + 0x30);
          const swarmB = Math.min(0xff, (primaryColor & 0xff) + 0x20);
          const swarmTint = (swarmR << 16) | (swarmG << 8) | swarmB;
          this.waveSpawner.addEliteWave(
            swarmCount, eventSpawnX, heroStartY, eventX,
            swarmStats, swarmTint,
          );
          break;
        }
      }
    }

    // (Boss stats already computed above the if/else block)
    // Zone 7: BOSS ARENA — at the far end of the stage
    // If the stage config specifies a boss archetype, use its body style and color
    let bossBodyStyle: string | undefined;
    let bossTintColor: number | undefined;
    if (stageConfig?.bossArchetype) {
      try {
        const bossArch = getEnemyArchetype(stageConfig.bossArchetype);
        bossBodyStyle = bossArch.visual.bodyStyle;
        bossTintColor = bossArch.visual.bodyColor;
      } catch (_e) { /* use default */ }
    }
    this.waveSpawner.addBossWave(7400, heroStartY, 7000, bossStats,
      bossBodyStyle as any, bossTintColor);
    } else {
      // Stage 1: custom wave spawns from JSON
      const s1 = [
        { x:1385, y:480, n:2 }, { x:1950, y:481, n:3 }, { x:2407, y:501, n:2 },
        { x:3080, y:513, n:3 }, { x:3611, y:443, n:2 }, { x:3821, y:574, n:2 },
        { x:4483, y:520, n:3 }, { x:5201, y:525, n:3 }, { x:5819, y:543, n:2 },
        { x:6508, y:562, n:2 }, { x:7381, y:517, n:2 }, { x:8254, y:507, n:2 },
      ];
      for (const w of s1) this.waveSpawner.addWave(w.n, w.x, w.y, w.x - 200);
      // Boss
      let s1BossStyle: string | undefined;
      let s1BossTint: number | undefined;
      if (stageConfig?.bossArchetype) {
        try { const a = getEnemyArchetype(stageConfig.bossArchetype); s1BossStyle = a.visual.bodyStyle; s1BossTint = a.visual.bodyColor; } catch(_e) {}
      }
      this.waveSpawner.addBossWave(9183, 495, 8983, bossStats, s1BossStyle as any, s1BossTint);
    }

    // Store boss damage reduction for when the boss spawns
    this.bossDmgReduction = bossDmgReduction;

    // Listen for boss spawn to show banner
    EventBus.on('boss_spawned', this.onBossSpawned, this);

    // Ranged enemy attack — spawns a hostile projectile aimed at the hero
    this.enemyProjectiles = [];
    EventBus.on('enemy_ranged_attack', (enemy: Enemy) => {
      if (enemy.isDead || this.hero.isDead) return;
      const dx = this.hero.x - enemy.x;
      const dirX = dx > 0 ? 1 : -1;
      const proj = new Projectile(this, {
        x: enemy.x + dirX * 15,
        y: this.hero.groundY - 15,       // spawn at hero's ground level so it hits
        groundY: this.hero.groundY,       // match hero's groundY for hit detection
        directionX: dirX,
        speed: 200,
        damage: Math.round(enemy.stats.attackPower * 0.8),
        color: 0x66cc44,
        maxRange: 400,
      });
      this.enemyProjectiles.push(proj);
    });

    // --- Camera ---
    // Stages with painted maps use larger dimensions and zoom 1.0
    const mapSizes: Record<number, { w: number; h: number }> = {
      0: { w: 9960, h: 830 },   // Stage 1
      1: { w: 11410, h: 830 },  // Stage 2
      2: { w: 11924, h: 828 },  // Stage 3
      3: { w: 11952, h: 830 },  // Stage 4
      4: { w: 11848, h: 822 },  // Stage 5
      5: { w: 11848, h: 822 },  // Stage 6
      6: { w: 11848, h: 822 },  // Stage 7
    };
    const mapSize = mapSizes[this.stageIndex];
    const stageW = mapSize ? mapSize.w : STAGE_WIDTH;
    const stageH = mapSize ? mapSize.h : STAGE_HEIGHT;
    this.cameras.main.setBounds(0, 0, stageW, stageH);
    const camZoom = mapSize ? 1.0 : 1.5;
    this.cameras.main.setZoom(camZoom);
    const followOffY = mapSize ? -80 : -120;
    this.cameras.main.startFollow(this.hero, true, 1, 1);
    this.cameras.main.setFollowOffset(0, followOffY);
    this.cameras.main.roundPixels = true;

    // --- Walk mask (Stage 2 only) ---
    // --- Walk masks ---
    const walkMaskPaths: Record<number, string> = {
      0: 'assets/Maps/stage1-forest/forest_walkable_mask.png',
      1: 'assets/Maps/forest-level/forest_walkable_mask.png',
      2: 'assets/Maps/stage3-cursed/forest_walkable_mask.png',
      3: 'assets/Maps/stage4-marsh/forest_walkable_mask.png',
      4: 'assets/Maps/stage5-village/forest_walkable_mask.png',
      5: 'assets/Maps/stage6-cathedral/forest_walkable_mask.png',
      6: 'assets/Maps/stage7-graveyard/forest_walkable_mask.png',
    };
    const maskPath = walkMaskPaths[this.stageIndex];
    if (maskPath) {
      const maskUrl = `${import.meta.env.BASE_URL}${maskPath}`;
      this.walkMask.loadFromURL(maskUrl).then(() => {
        this.hero.useWalkMask = true;
        // Move hero to a valid spawn point inside the walk mask
        const spawn = this.walkMask.findSpawnPoint();
        this.hero.x = spawn.x;
        this.hero.y = spawn.y;
        this.hero.groundY = spawn.y;
        const body = this.hero.body as Phaser.Physics.Arcade.Body;
        if (body) { body.x = spawn.x - body.halfWidth; body.y = spawn.y - body.halfHeight; }
      }).catch(err => console.warn('[WalkMask]', err));
    }

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
    this.hud.setupSkillUI(this, ownedSkills, ultimateUnlocked, this.heroClass.id);

    // After all HUD/UI is created, make the main camera ignore them and the UI camera ignore world
    this.setupCameraLayers(uiCamera);


    // --- Level / XP system (carry forward from previous stage) ---
    this.levelSystem = new LevelSystem(this.startLevel, this.progression);
    if (this.startXp > 0) this.levelSystem.addXp(this.startXp);
    this.levelSystem.emitCurrent();

    // --- Force-resync hero HP to actual current level ---
    // The Hero constructor emits HERO_HEALTH_CHANGED before the HUD exists, so that initial
    // event is lost and the HUD stays stuck on its placeholder text ("100 / 100").
    // We must ALWAYS re-emit here so the HUD displays the correct max HP from frame 1.
    const baseHp = this.heroClass.stats.maxHealth;
    const expectedMaxHp = baseHp + (this.levelSystem.level - 1) * Hero.HP_PER_LEVEL;
    if (this.hero.stats.maxHealth < expectedMaxHp) {
      const diff = expectedMaxHp - this.hero.stats.maxHealth;
      this.hero.stats.maxHealth = expectedMaxHp;
      this.hero.currentHealth = Math.min(this.hero.currentHealth + diff, expectedMaxHp);
    }
    // Sync the hero's internal level tracker
    this.hero.heroLevel = this.levelSystem.level;
    // Always emit the current health so the HUD initialises with the correct values
    EventBus.emit(Events.HERO_HEALTH_CHANGED, this.hero.currentHealth, this.hero.stats.maxHealth);

    // --- Gold (carry forward) ---
    this.gold = this.startGold;
    EventBus.emit(Events.HERO_GOLD_CHANGED, this.gold);
    EventBus.on(Events.ENEMY_DIED, this.onEnemyDiedGold, this);

    // --- Stage end choice ---
    EventBus.on('stage_end_choice', this.onStageEndChoice, this);

    // --- World bounds ---
    // Stages with walk masks use the full image height for physics; the mask handles restriction.
    if (maskPath) {
      this.physics.world.setBounds(0, 0, stageW, stageH);
    } else {
      this.physics.world.setBounds(0, GROUND_MIN_Y, stageW, GROUND_MAX_Y - GROUND_MIN_Y);
    }
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

    // Show death screen after a short delay.
    // Uses wall-clock setTimeout instead of scene.time.delayedCall so that
    // hit-stop timeScale slowdown doesn't stretch the delay to 10+ seconds.
    window.setTimeout(() => {
      this.showDeathScreen();
    }, 1000);
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

    // Summon VFX: anticipation gather → green radial burst → embers
    skillFx.spawnSkillEffect(this, this.hero.x, this.hero.groundY - 20, {
      color: 0x44ff66, coreColor: 0xaaffcc,
      anticipation: true, anticipationDuration: 120, anticipationRadius: 30,
      impactRadius: 40, impactParticles: 8,
      shake: true, shakeIntensity: 0.003, shakeDuration: 80,
      embers: true, emberCount: 5,
      screenFlash: false,
    });
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

    // Cast VFX: directional energy arc toward the cloud zone
    skillFx.spawnEnergyArc(this, this.hero.x, this.hero.groundY - 25, {
      color: 0x33ff44, coreColor: 0xaaffcc,
      width: rotRange * 0.5,
      angle: this.hero.facingRight ? 0 : Math.PI,
      flipX: !this.hero.facingRight,
      duration: 350,
    });
    skillFx.spawnGlow(this, cloudX, this.hero.groundY - 25, {
      color: 0x33ff44, radius: 25, duration: 300,
    });
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
            if (enemy.isBoss) tickDmg = Math.min(tickDmg, 20); // hard cap for bosses
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

  // ==================== BONE SPEAR VOLLEY (level 30) ====================

  private handleBoneVolley(): void {
    const lvl = this.levelSystem.progression.skills['boneVolley'] ?? 0;
    if (lvl === 0) return;
    if (this.hero.isDead) return;
    if (!Phaser.Input.Keyboard.JustDown(this.boneVolleyKey)) return;
    if (this.boneVolleyCooldown > 0) return;

    const dirX = this.hero.facingRight ? 1 : -1;
    const numSpears = 3 + lvl;             // 4 → 8 spears
    const damage = 50 + lvl * 10;          // 60 → 100 per spear
    const pierce = 3;                      // each spear hits up to 3 enemies
    const speed = 620;
    const range = 700;

    // Spawn spears with slight Y offsets across the lane so they sweep a wide vertical band
    for (let i = 0; i < numSpears; i++) {
      const t = numSpears === 1 ? 0.5 : i / (numSpears - 1);
      const yOff = (t - 0.5) * 60; // -30..+30 vertical spread
      const startDelay = i * 35;   // 35ms stagger creates a "volley" rolling effect
      this.time.delayedCall(startDelay, () => {
        if (this.hero.isDead) return;
        const proj = new Projectile(this, {
          x: this.hero.x + dirX * 30,
          y: this.hero.groundY - 20 + yOff,
          groundY: this.hero.groundY + yOff,
          directionX: dirX,
          speed,
          damage,
          color: 0xf0e8d0,
          maxRange: range,
          pierce,
          spear: true,
        });
        this.projectiles.push(proj);
      });
    }

    // Cast VFX: anticipation gather → directional energy arc → screen flash
    skillFx.spawnSkillEffect(this, this.hero.x, this.hero.groundY - 20, {
      color: 0xeeeecc, coreColor: 0xffffff,
      anticipation: true, anticipationDuration: 100, anticipationRadius: 25,
      arc: true, arcWidth: 60, arcAngle: this.hero.facingRight ? 0 : Math.PI,
      flipX: !this.hero.facingRight,
      impactRadius: 30, impactParticles: 6,
      shake: true, shakeIntensity: 0.005, shakeDuration: 130,
      screenFlash: false,
      embers: true, emberCount: 4,
    });
    this.hero.sprite.fillColor = 0xeeeecc;
    this.time.delayedCall(180, () => {
      if (!this.hero.isDead) this.hero.sprite.fillColor = this.hero.baseColor;
    });

    this.boneVolleyCooldown = ForestStage.BONE_VOLLEY_CD;
  }

  // ==================== WRAITH FORM (level 50) ====================

  private handleWraithForm(delta: number): void {
    const lvl = this.levelSystem.progression.skills['wraithForm'] ?? 0;
    if (lvl === 0 && !this.wraithActive) {
      if (this.wraithCooldown > 0) this.wraithCooldown -= delta;
      return;
    }
    if (this.wraithCooldown > 0 && !this.wraithActive) this.wraithCooldown -= delta;

    // Activate on key press
    if (!this.wraithActive && lvl > 0 && !this.hero.isDead
        && Phaser.Input.Keyboard.JustDown(this.wraithFormKey)
        && this.wraithCooldown <= 0) {
      this.wraithActive = true;
      this.wraithDuration = 3000 + lvl * 500;     // 3.5s → 5.5s
      this.wraithTimer = this.wraithDuration;
      this.wraithContactDmg = 60 + lvl * 20;       // 80 → 160
      this.wraithSpeedOriginal = this.hero.stats.moveSpeed;
      this.wraithBaseAlpha = this.hero.alpha;
      this.hero.stats.moveSpeed = this.wraithSpeedOriginal * 1.8;
      this.hero.isInvulnerable = true;
      this.hero.alpha = 0.45;
      // Tint hero purple
      this.hero.sprite.fillColor = 0x6622aa;
      this.wraithHitTimers.clear();

      // Spawn aura container around hero
      const aura = this.add.circle(this.hero.x, this.hero.groundY - 25, 36, 0x6622aa, 0.25)
        .setDepth(this.hero.groundY - 1);
      this.tweens.add({ targets: aura, scale: 1.2, alpha: 0.1, duration: 300, yoyo: true, repeat: -1 });
      this.wraithVfx.push(aura);

      // Layered activation VFX: gather → radial burst → screen flash → embers
      skillFx.spawnSkillEffect(this, this.hero.x, this.hero.groundY - 25, {
        color: 0x6622aa, coreColor: 0xcc88ff,
        anticipation: true, anticipationDuration: 100, anticipationRadius: 40,
        impactRadius: 50, impactParticles: 12,
        screenFlash: true,
        shake: true, shakeIntensity: 0.006, shakeDuration: 150,
        groundDecal: true,
        embers: true, emberCount: 8,
        intensity: 1.2,
      });
    }

    if (!this.wraithActive) return;

    this.wraithTimer -= delta;

    // Move trailing aura with the hero
    for (const v of this.wraithVfx) {
      const c = v as Phaser.GameObjects.Arc;
      c.x = this.hero.x;
      c.y = this.hero.groundY - 25;
    }

    // Spawn trailing ghost copies of the hero
    if (Math.random() < 0.4) {
      const trail = this.add.circle(this.hero.x, this.hero.groundY - 25, 14, 0x9944dd, 0.4)
        .setDepth(this.hero.groundY - 1);
      this.tweens.add({
        targets: trail,
        alpha: 0, scale: 0.5,
        duration: 400,
        onComplete: () => trail.destroy(),
      });
    }

    // Damage enemies on contact (each enemy hit at most every 350ms)
    const enemies = this.waveSpawner.getEnemies();
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const last = this.wraithHitTimers.get(enemy.id) ?? 0;
      if (last > 0) {
        this.wraithHitTimers.set(enemy.id, last - delta);
        continue;
      }
      const dx = enemy.x - this.hero.x;
      const dy = enemy.groundY - this.hero.groundY;
      if (Math.abs(dx) < 38 && Math.abs(dy) < 40) {
        let dmg = this.wraithContactDmg;
        if (enemy.isBoss) dmg = Math.min(dmg, 120); // boss cap
        enemy.takeDamage(dmg);
        this.wraithHitTimers.set(enemy.id, 350);
        // Hit spark
        const spark = this.add.circle(enemy.x, enemy.groundY - 20, 12, 0xff66ff, 0.7)
          .setDepth(enemy.groundY + 1);
        this.tweens.add({
          targets: spark,
          alpha: 0, scale: 2,
          duration: 220,
          onComplete: () => spark.destroy(),
        });
      }
    }

    // Tick down per-enemy hit timers we didn't touch above (cleanup)
    if (this.wraithHitTimers.size > 0) {
      for (const [id, t] of this.wraithHitTimers) {
        if (t > 0) this.wraithHitTimers.set(id, Math.max(0, t - delta));
      }
    }

    if (this.wraithTimer <= 0) this.endWraithForm();
  }

  private endWraithForm(): void {
    if (!this.wraithActive) return;
    this.wraithActive = false;
    this.hero.stats.moveSpeed = this.wraithSpeedOriginal;
    this.hero.isInvulnerable = false;
    this.hero.alpha = this.wraithBaseAlpha;
    if (!this.hero.isDead) this.hero.sprite.fillColor = this.hero.baseColor;
    for (const v of this.wraithVfx) v.destroy();
    this.wraithVfx = [];
    this.wraithCooldown = ForestStage.WRAITH_CD;
  }

  // ==================== SOUL APOCALYPSE (level 70) ====================

  private handleSoulApocalypse(delta: number): void {
    if (this.apocalypseCooldown > 0) this.apocalypseCooldown -= delta;
    const lvl = this.levelSystem.progression.skills['soulApocalypse'] ?? 0;
    if (lvl === 0) return;
    if (this.hero.isDead) return;
    if (!Phaser.Input.Keyboard.JustDown(this.apocalypseKey)) return;
    if (this.apocalypseCooldown > 0) return;

    const damage = 200 + lvl * 100;            // 300 → 500
    const executeThreshold = 0.20 + lvl * 0.05; // 25% → 35%

    // Telegraph: dark void implodes around the hero, then explodes
    const tel = this.add.circle(this.hero.x, this.hero.groundY - 25, 8, 0x220033, 0.7)
      .setDepth(this.hero.groundY + 100);
    this.tweens.add({
      targets: tel,
      scaleX: 60, scaleY: 60,
      alpha: 0,
      duration: 500,
      onComplete: () => tel.destroy(),
    });

    // After 0.5s, detonate
    this.time.delayedCall(500, () => {
      if (this.hero.isDead) return;

      // Screen-wide purple shockwave
      const shock = this.add.circle(this.hero.x, this.hero.groundY - 25, 20, 0x9944ff, 0.5)
        .setDepth(this.hero.groundY + 100);
      this.tweens.add({
        targets: shock,
        scaleX: 80, scaleY: 80,
        alpha: 0,
        duration: 700,
        onComplete: () => shock.destroy(),
      });

      // Inner bright flash
      const flash = this.add.rectangle(640, 360, 1280, 720, 0xff66ff, 0.55)
        .setScrollFactor(0).setDepth(9100);
      this.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });

      this.cameras.main.shake(500, 0.012);

      // Lightning streaks from hero to every visible enemy
      const cam = this.cameras.main;
      const left = cam.scrollX - 50;
      const right = cam.scrollX + cam.width / cam.zoom + 50;
      const enemies = this.waveSpawner.getEnemies();
      let killCount = 0;

      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        if (enemy.x < left || enemy.x > right) continue;

        // Lightning bolt from hero to enemy
        const bolt = this.add.line(0, 0,
          this.hero.x, this.hero.groundY - 25,
          enemy.x, enemy.groundY - 20,
          0xddaaff, 0.9)
          .setLineWidth(2.5)
          .setOrigin(0, 0)
          .setDepth(this.hero.groundY + 99);
        this.tweens.add({ targets: bolt, alpha: 0, duration: 350, onComplete: () => bolt.destroy() });

        // Damage (boss takes capped damage)
        let dmg = damage;
        if (enemy.isBoss) dmg = Math.min(dmg, 250);
        enemy.takeDamage(dmg);

        // Execute threshold (NOT bosses)
        if (!enemy.isBoss && enemy.currentHealth > 0
            && enemy.currentHealth / enemy.stats.maxHealth <= executeThreshold) {
          enemy.currentHealth = 0;
          enemy.updateHealthBarPublic();
          enemy.isDead = true;
          enemy.sm.transition('death');
          killCount++;
        } else if (enemy.currentHealth <= 0 && !enemy.isDead) {
          enemy.isDead = true;
          enemy.sm.transition('death');
          killCount++;
        }

        // Hit ring on each enemy
        const ring = this.add.circle(enemy.x, enemy.groundY - 20, 10, 0xff44ff, 0)
          .setStrokeStyle(2, 0xff66ff, 0.9)
          .setDepth(enemy.groundY + 1);
        this.tweens.add({
          targets: ring, scale: 3, alpha: 0,
          duration: 400,
          onComplete: () => ring.destroy(),
        });
      }

      // Heal hero based on kills (4% max HP per kill)
      if (killCount > 0 && !this.hero.isDead) {
        const heal = Math.ceil(this.hero.stats.maxHealth * 0.04 * killCount);
        this.hero.currentHealth = Math.min(this.hero.currentHealth + heal, this.hero.stats.maxHealth);
        EventBus.emit(Events.HERO_HEALTH_CHANGED, this.hero.currentHealth, this.hero.stats.maxHealth);
      }
    });

    // Hero cast flash
    this.hero.sprite.fillColor = 0xff66ff;
    this.time.delayedCall(500, () => {
      if (!this.hero.isDead) this.hero.sprite.fillColor = this.hero.baseColor;
    });

    this.apocalypseCooldown = ForestStage.APOCALYPSE_CD;
  }

  // ==================== GENERIC CLASS SKILLS (non-necromancer) ====================

  /** Cooldown values for each skill ID. Some scale with skill level. */
  private getSkillCooldown(skillId: string, lvl: number = 1): number {
    // Lay On Hands: 10s at lvl 1 → 3s at lvl 5
    if (skillId === 'layOnHands') return Math.max(3000, 10000 - (lvl - 1) * 1750);
    // Consecration: 8s at lvl 1 → 3s at lvl 5
    if (skillId === 'consecration') return Math.max(3000, 8000 - (lvl - 1) * 1250);

    const cds: Record<string, number> = {
      // Paladin
      smite: 3000,
      divineWrath: 5000, crusadersCharge: 6000, aegisEternal: 25000,
      // Barbarian
      cleave: 3500, bloodthirst: 12000, whirlwind: 7000,
      earthshaker: 6000, berserkerRage: 18000, decimate: 30000,
      // Templar
      powerStrike: 3000, magicBolt: 2500, sanctuary: 10000,
      mysticSlash: 5000, divineAegis: 18000, templarsWrath: 28000,
      // Mage
      frostbolt: 2500, arcaneShield: 12000, fireball: 4000,
      lightningStorm: 12000, timeWarp: 20000, meteorStrike: 30000,
      // Archer
      multishot: 2500, eagleEye: 15000, pinDown: 5000,
      rainOfArrows: 8000, phantomStep: 12000, mastersVolley: 25000,
    };
    return cds[skillId] ?? 5000;
  }

  /** Returns true if the skill is owned & ready and consumes its cooldown. */
  private trySkill(skillId: string, key: Phaser.Input.Keyboard.Key): boolean {
    if (this.hero.isDead) return false;
    if (!Phaser.Input.Keyboard.JustDown(key)) return false;
    const lvl = this.levelSystem.progression.skills[skillId] ?? 0;
    if (lvl === 0) return false;
    if ((this.classSkillCooldowns[skillId] ?? 0) > 0) return false;
    this.classSkillCooldowns[skillId] = this.getSkillCooldown(skillId, lvl);
    return true;
  }

  /** Main per-class skill dispatcher. */
  private tickClassSkills(delta: number): void {
    // Tick all cooldowns
    for (const k of Object.keys(this.classSkillCooldowns)) {
      if (this.classSkillCooldowns[k] > 0) this.classSkillCooldowns[k] -= delta;
    }
    // Tick active buffs
    for (const k of Object.keys(this.classBuffs)) {
      if (this.classBuffs[k] > 0) {
        this.classBuffs[k] -= delta;
        if (this.classBuffs[k] <= 0) this.onBuffExpired(k);
      }
    }
    // Update HUD cooldowns for visible skills (non-necromancer classes)
    const slots = HUD.getClassSkillSlots(this.heroClass.id);
    for (const slot of slots) {
      if (slot.id === 'ultimate') continue;
      const cd = this.classSkillCooldowns[slot.id] ?? 0;
      const max = this.getSkillCooldown(slot.id);
      this.hud.setSkillCooldown(slot.id, Math.max(0, cd / max));
    }

    // Dispatch keyboard input by class
    switch (this.heroClass.id) {
      case 'paladin':        this.tickPaladin(); break;
      case 'barbarian':      this.tickBarbarian(); break;
      case 'templar_knight': this.tickTemplar(); break;
      case 'mage':           this.tickMage(); break;
      case 'archer':         this.tickArcher(); break;
    }
  }

  private onBuffExpired(buffId: string): void {
    if (buffId === 'berserkerRage' || buffId === 'eagleEye') {
      this.hero.sprite.fillColor = this.hero.baseColor;
    }
  }

  // ---------- Common visual / damage helpers ----------

  private spawnAoeBurst(x: number, y: number, radius: number, color: number, damage: number, knockback = 0): void {
    // Layered VFX: radial burst → ground decal → embers
    // Camera shake is handled per-skill by the caller's camShake() call.
    skillFx.spawnRadialBurst(this, x, y, {
      color, coreColor: 0xffffff,
      radius, particleCount: 12,
      duration: 450, shake: false,
    });
    skillFx.spawnGroundDecal(this, x, y, { radius: radius * 0.5 });
    skillFx.spawnLingeringEmbers(this, x, y, { color, count: 5, spread: radius * 0.5 });
    // Damage all enemies in range
    const enemies = this.waveSpawner.getEnemies();
    for (const e of enemies) {
      if (e.isDead) continue;
      const d = Math.hypot(e.x - x, e.groundY - y);
      if (d > radius) continue;
      let dmg = damage;
      if (e.isBoss) dmg = Math.min(dmg, Math.round(damage * 0.5));
      e.takeDamage(dmg);
      if (knockback > 0) {
        const dir = e.x > x ? 1 : -1;
        e.x += dir * knockback;
      }
    }
  }

  private spawnDirectionalCone(damage: number, range: number, color: number, fontWidth = 100): void {
    const dirX = this.hero.facingRight ? 1 : -1;
    const cx = this.hero.x + dirX * range / 2;
    const cy = this.hero.groundY - 25;
    // Layered VFX: energy arc + glow at center + embers along the cone
    skillFx.spawnEnergyArc(this, this.hero.x, cy, {
      color, coreColor: 0xffffff,
      width: range * 0.6, angle: dirX > 0 ? 0 : Math.PI,
      duration: 320, flipX: dirX < 0,
    });
    skillFx.spawnGlow(this, cx, cy, { color, radius: fontWidth * 0.35, duration: 300 });
    skillFx.spawnLingeringEmbers(this, cx, cy, { color, count: 4, spread: range * 0.3 });
    // Damage enemies in front
    const enemies = this.waveSpawner.getEnemies();
    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = e.x - this.hero.x;
      const inFront = dirX > 0 ? (dx > 0 && dx < range) : (dx < 0 && dx > -range);
      if (!inFront) continue;
      if (Math.abs(e.groundY - this.hero.groundY) > fontWidth / 2) continue;
      let dmg = damage;
      if (e.isBoss) dmg = Math.min(dmg, Math.round(damage * 0.5));
      e.takeDamage(dmg);
    }
  }

  private healHero(pct: number): void {
    if (this.hero.isDead) return;
    const heal = Math.ceil(this.hero.stats.maxHealth * pct);
    this.hero.currentHealth = Math.min(this.hero.currentHealth + heal, this.hero.stats.maxHealth);
    EventBus.emit(Events.HERO_HEALTH_CHANGED, this.hero.currentHealth, this.hero.stats.maxHealth);
    // Heal flash
    const ring = this.add.circle(this.hero.x, this.hero.groundY - 25, 16, 0x66ff88, 0)
      .setStrokeStyle(3, 0xaaffbb, 0.9)
      .setDepth(this.hero.groundY + 5);
    this.tweens.add({
      targets: ring, scale: 2.2, alpha: 0,
      duration: 600, onComplete: () => ring.destroy(),
    });
  }

  /** Consecration — 5-second buff that boosts attack power and attack speed. */
  private applyConsecrationBuff(lvl: number): void {
    if (this.hero.isDead) return;
    // Don't recast while buff is active
    if (this.classBuffs['consecration'] !== undefined && this.classBuffs['consecration'] > 0) return;

    const DURATION = 5000;
    const atkBonus = Math.round(this.hero.stats.attackPower * (0.50 + lvl * 0.15)); // +50-125% atk
    const spdBonus = 2.1 + lvl * 0.5; // ~1.25x base attack speed + scaling

    // Apply buffs
    const moveBonus = Math.round(this.hero.stats.moveSpeed * 0.5); // +50% run speed
    this.hero.stats.attackPower += atkBonus;
    this.hero.attackSpeedPoints += spdBonus;
    this.hero.stats.moveSpeed += moveBonus;
    this.hero.consecrationActive = true;
    // Speed up run animation to match faster movement
    if (this.hero._sheetSprite) this.hero._sheetSprite.anims.timeScale = 1.5;

    // Clear the cooldown that trySkill set — real cooldown starts after buff expires
    this.classSkillCooldowns['consecration'] = 0;

    // Track for expiry
    this.classBuffs['consecration'] = DURATION;

    // ===== INTENSE SUPER SAIYAN ENERGY AURA =====
    const auraParts: Phaser.GameObjects.GameObject[] = [];

    // Initial power-up explosion — double layered
    const burst1 = this.add.circle(this.hero.x, this.hero.groundY - 25, 14, 0xffffcc, 1.0)
      .setDepth(this.hero.groundY + 6);
    const burst2 = this.add.circle(this.hero.x, this.hero.groundY - 25, 8, 0xffffff, 0.9)
      .setDepth(this.hero.groundY + 7);
    this.tweens.add({ targets: burst1, scale: 8, alpha: 0, duration: 500, onComplete: () => burst1.destroy() });
    this.tweens.add({ targets: burst2, scale: 5, alpha: 0, duration: 350, onComplete: () => burst2.destroy() });
    this.cameras.main.shake(200, 0.006);

    // Continuous energy flame particles — dense and fast
    const flameTimer = this.time.addEvent({
      delay: 25,  // twice as frequent
      repeat: Math.floor(DURATION / 25) - 1,
      callback: () => {
        if (this.hero.isDead) return;
        const hx = this.hero.x;
        const hy = this.hero.groundY;
        for (let i = 0; i < Phaser.Math.Between(3, 5); i++) {
          const fx = hx + Phaser.Math.Between(-16, 16);
          const fy = hy + Phaser.Math.Between(-50, 0);
          const size = Phaser.Math.FloatBetween(4, 10);
          const colors = [0xffdd22, 0xffee44, 0xffcc00, 0xffffaa, 0xffaa00, 0xffffff, 0xffff66];
          const color = colors[Phaser.Math.Between(0, colors.length - 1)];
          const flame = this.add.ellipse(fx, fy, size, size * 2.2, color, Phaser.Math.FloatBetween(0.5, 0.9));
          flame.setDepth(hy - 2);
          auraParts.push(flame);
          this.tweens.add({
            targets: flame,
            y: fy - Phaser.Math.Between(25, 55),
            x: fx + Phaser.Math.Between(-8, 8),
            scaleX: 0.1,
            scaleY: Phaser.Math.FloatBetween(1.6, 2.8),
            alpha: 0,
            duration: Phaser.Math.Between(250, 500),
            ease: 'Quad.easeOut',
            onComplete: () => flame.destroy(),
          });
        }
      },
    });

    // Outer pulsing aura — large, aggressive
    const outerGlow = this.add.ellipse(this.hero.x, this.hero.groundY - 24, 44, 64, 0xffcc00, 0.08)
      .setDepth(this.hero.groundY - 4);
    this.tweens.add({
      targets: outerGlow, scaleX: 1.6, scaleY: 1.4, alpha: 0.03,
      yoyo: true, duration: 150, repeat: -1,
    });

    // Inner pulsing aura — tight, bright
    const innerGlow = this.add.ellipse(this.hero.x, this.hero.groundY - 24, 30, 54, 0xffee44, 0.18)
      .setDepth(this.hero.groundY - 3);
    this.tweens.add({
      targets: innerGlow, scaleX: 1.3, scaleY: 1.15, alpha: 0.08,
      yoyo: true, duration: 120, repeat: -1,
    });

    // Weapon energy glow — attached to swordNode so it moves with swings
    let weaponGlow: Phaser.GameObjects.Ellipse | null = null;
    if (this.hero.swordNode) {
      weaponGlow = this.add.ellipse(0, -8, 12, 28, 0xffdd44, 0.25);
      this.hero.swordNode.add(weaponGlow);
      this.tweens.add({
        targets: weaponGlow, alpha: 0.1, scaleX: 1.4, scaleY: 1.2,
        yoyo: true, duration: 100, repeat: -1,
      });
    }

    // Weapon flame particles — emit from the weapon tip
    const weaponFlameTimer = this.time.addEvent({
      delay: 40,
      repeat: Math.floor(DURATION / 40) - 1,
      callback: () => {
        if (this.hero.isDead || !this.hero.swordNode) return;
        // Get weapon world position via the swordNode's parent chain
        const mat = this.hero.swordNode.getWorldTransformMatrix();
        const wx = mat.tx;
        const wy = mat.ty - 10; // offset toward weapon head
        for (let i = 0; i < 2; i++) {
          const size = Phaser.Math.FloatBetween(2, 5);
          const colors = [0xffdd22, 0xffee66, 0xffffff, 0xffaa00];
          const color = colors[Phaser.Math.Between(0, colors.length - 1)];
          const spark = this.add.ellipse(
            wx + Phaser.Math.Between(-6, 6),
            wy + Phaser.Math.Between(-8, 8),
            size, size * 1.6, color, Phaser.Math.FloatBetween(0.5, 0.8),
          ).setDepth(this.hero.groundY + 10);
          auraParts.push(spark);
          this.tweens.add({
            targets: spark,
            y: spark.y - Phaser.Math.Between(10, 25),
            x: spark.x + Phaser.Math.Between(-5, 5),
            scaleX: 0.2, alpha: 0,
            duration: Phaser.Math.Between(200, 400),
            ease: 'Quad.easeOut',
            onComplete: () => spark.destroy(),
          });
        }
      },
    });

    // Follow hero position each frame
    const updateEvt = this.time.addEvent({
      delay: 16, repeat: Math.floor(DURATION / 16),
      callback: () => {
        if (!this.hero.isDead) {
          innerGlow.x = this.hero.x;
          innerGlow.y = this.hero.groundY - 24;
          outerGlow.x = this.hero.x;
          outerGlow.y = this.hero.groundY - 24;
        }
      },
    });

    // Remove buff after duration
    window.setTimeout(() => {
      this.hero.stats.attackPower -= atkBonus;
      this.hero.attackSpeedPoints -= spdBonus;
      this.hero.stats.moveSpeed -= moveBonus;
      this.hero.consecrationActive = false;
      // Restore normal animation speed
      if (this.hero._sheetSprite) this.hero._sheetSprite.anims.timeScale = 1.0;
      flameTimer.destroy();
      weaponFlameTimer.destroy();
      if (weaponGlow) weaponGlow.destroy();
      innerGlow.destroy();
      outerGlow.destroy();
      updateEvt.destroy();
      for (const p of auraParts) if (p.active) p.destroy();
      delete this.classBuffs['consecration'];
      // Start the real cooldown now that the buff has expired
      this.classSkillCooldowns['consecration'] = this.getSkillCooldown('consecration', lvl);
    }, DURATION);
  }

  private camShake(intensity: number, duration: number): void {
    this.cameras.main.shake(duration, intensity);
  }

  /** Paladin Smite — single large holy pillar from the sky. Damage is
   *  applied at the impact frame, synced with the VFX. */
  private castHolySmite(damage: number, range: number): void {
    const dirX = this.hero.facingRight ? 1 : -1;
    const centerX = this.hero.x + dirX * range * 0.2; // closer to hero so it hits nearby enemies
    const groundY = this.hero.groundY;
    const pillarWidth = 140;
    const hitRadius = pillarWidth * 0.9; // wide enough to reach enemies right next to the hero

    skillFx.spawnHolySmite(this, centerX, groundY, {
      beamWidth: pillarWidth,
      onImpact: () => {
        const enemies = this.waveSpawner.getEnemies();
        for (const e of enemies) {
          if (e.isDead) continue;
          if (Math.abs(e.x - centerX) > hitRadius) continue;
          if (Math.abs(e.groundY - groundY) > 50) continue;
          let dmg = damage;
          if (e.isBoss) dmg = Math.min(dmg, Math.round(damage * 0.5));
          e.takeDamage(dmg);
          if (e.sprite) {
            const prevColor = e.sprite.fillColor;
            e.sprite.fillColor = 0xffffff;
            this.time.delayedCall(80, () => {
              if (e.sprite) e.sprite.fillColor = prevColor;
            });
          }
        }
      },
    });
  }

  // ---------- PALADIN ----------
  private tickPaladin(): void {
    const slots = HUD.getClassSkillSlots('paladin');
    const keyMap: Record<string, Phaser.Input.Keyboard.Key> = {
      'K': this.boneVolleyKey, 'L': this.rotKey, ';': this.wraithFormKey,
      'U': this.summonKey, 'I': this.leechKey, 'P': this.apocalypseKey,
    };
    for (const slot of slots) {
      if (slot.id === 'ultimate') continue;
      if (!this.trySkill(slot.id, keyMap[slot.key])) continue;
      const lvl = this.levelSystem.progression.skills[slot.id] ?? 0;
      switch (slot.id) {
        case 'smite':           this.castHolySmite(60 + lvl * 12, 240); break;
        case 'layOnHands':      this.healHero(0.30 + lvl * 0.05); break;
        case 'consecration':    this.applyConsecrationBuff(lvl); break;
        case 'divineWrath':     this.spawnDirectionalCone(80 + lvl * 20, 320, 0xff8844, 80); this.camShake(0.005, 200); break;
        case 'crusadersCharge': this.hero.applyKnockback(this.hero.x - (this.hero.facingRight ? -200 : 200), 600); this.spawnDirectionalCone(50 + lvl * 15, 280, 0xffbb44, 60); break;
        case 'aegisEternal':    this.hero.isInvulnerable = true; this.classBuffs['aegisEternal'] = 4000 + lvl * 500; break;
      }
    }
    // Tick aegis
    if (this.classBuffs['aegisEternal'] !== undefined && this.classBuffs['aegisEternal'] <= 0) {
      this.hero.isInvulnerable = false;
      delete this.classBuffs['aegisEternal'];
    }

    // Dragon mount — Y key toggles mount/dismount
    if (Phaser.Input.Keyboard.JustDown(this.dragonKey)) {
      if (this.dragonMounted) {
        this.dismountDragon();
      } else {
        this.mountDragon();
      }
    }

    // Dragon fire breath — continuous automatic stream while mounted
    if (this.dragonMounted) {
      this.tickDragonFireBreath();
    }
  }

  // ---------- BARBARIAN ----------
  private tickBarbarian(): void {
    const slots = HUD.getClassSkillSlots('barbarian');
    const keyMap: Record<string, Phaser.Input.Keyboard.Key> = {
      'K': this.boneVolleyKey, 'L': this.rotKey, ';': this.wraithFormKey,
      'U': this.summonKey, 'I': this.leechKey, 'P': this.apocalypseKey,
    };
    for (const slot of slots) {
      if (slot.id === 'ultimate') continue;
      if (!this.trySkill(slot.id, keyMap[slot.key])) continue;
      const lvl = this.levelSystem.progression.skills[slot.id] ?? 0;
      switch (slot.id) {
        case 'cleave':         this.spawnDirectionalCone(70 + lvl * 15, 200, 0xff6644, 80); this.camShake(0.004, 120); break;
        case 'bloodthirst':    this.classBuffs['bloodthirst'] = 6000 + lvl * 1000; break;
        case 'whirlwind':      this.spawnAoeBurst(this.hero.x, this.hero.groundY - 25, 150, 0xff4422, 40 + lvl * 10, 30); this.camShake(0.005, 300); break;
        case 'earthshaker':    this.spawnAoeBurst(this.hero.x, this.hero.groundY - 5, 220, 0xaa6644, 100 + lvl * 25, 80); this.camShake(0.012, 400); break;
        case 'berserkerRage':  this.classBuffs['berserkerRage'] = 8000 + lvl * 500; this.hero.sprite.fillColor = 0xff5522; break;
        case 'decimate':       this.spawnAoeBurst(this.hero.x, this.hero.groundY - 25, 600, 0xff8866, 200 + lvl * 150, 100); this.camShake(0.02, 600); break;
      }
    }
  }

  // ---------- TEMPLAR ----------
  private tickTemplar(): void {
    const slots = HUD.getClassSkillSlots('templar_knight');
    const keyMap: Record<string, Phaser.Input.Keyboard.Key> = {
      'K': this.boneVolleyKey, 'L': this.rotKey, ';': this.wraithFormKey,
      'U': this.summonKey, 'I': this.leechKey, 'P': this.apocalypseKey,
    };
    for (const slot of slots) {
      if (slot.id === 'ultimate') continue;
      if (!this.trySkill(slot.id, keyMap[slot.key])) continue;
      const lvl = this.levelSystem.progression.skills[slot.id] ?? 0;
      switch (slot.id) {
        case 'powerStrike':   this.spawnDirectionalCone(90 + lvl * 18, 180, 0xddddff, 50); this.camShake(0.005, 150); break;
        case 'magicBolt':     this.spawnDirectionalCone(45 + lvl * 10, 350, 0x6699ff, 30); break;
        case 'sanctuary':     this.spawnAoeBurst(this.hero.x, this.hero.groundY - 10, 140, 0xaaccff, 30 + lvl * 8); this.healHero(0.05 + lvl * 0.01); break;
        case 'mysticSlash':   this.hero.applyKnockback(this.hero.x - (this.hero.facingRight ? -150 : 150), 500); this.spawnDirectionalCone(60 + lvl * 15, 280, 0x99bbff, 50); break;
        case 'divineAegis':   this.hero.damageReductionPct = 0.5; this.classBuffs['divineAegis'] = 5000 + lvl * 500; break;
        case 'templarsWrath': this.spawnAoeBurst(this.hero.x, this.hero.groundY - 25, 500, 0xccddff, 150 + lvl * 120, 60); this.camShake(0.015, 500); break;
      }
    }
    if (this.classBuffs['divineAegis'] !== undefined && this.classBuffs['divineAegis'] <= 0) {
      this.hero.damageReductionPct = 0;
      delete this.classBuffs['divineAegis'];
    }
  }

  // ---------- MAGE ----------
  private tickMage(): void {
    const slots = HUD.getClassSkillSlots('mage');
    const keyMap: Record<string, Phaser.Input.Keyboard.Key> = {
      'K': this.boneVolleyKey, 'L': this.rotKey, ';': this.wraithFormKey,
      'U': this.summonKey, 'I': this.leechKey, 'P': this.apocalypseKey,
    };
    for (const slot of slots) {
      if (slot.id === 'ultimate') continue;
      if (!this.trySkill(slot.id, keyMap[slot.key])) continue;
      const lvl = this.levelSystem.progression.skills[slot.id] ?? 0;
      switch (slot.id) {
        case 'frostbolt':       this.spawnDirectionalCone(40 + lvl * 10, 300, 0x66ccff, 30); break;
        case 'arcaneShield':    this.arcaneShieldHp = 60 + lvl * 20; this.classBuffs['arcaneShield'] = 8000; break;
        case 'fireball':        {
          const dirX = this.hero.facingRight ? 1 : -1;
          const tx = this.hero.x + dirX * 250;
          this.spawnAoeBurst(tx, this.hero.groundY - 25, 130 + lvl * 10, 0xff6633, 70 + lvl * 25); this.camShake(0.006, 200);
          break;
        }
        case 'lightningStorm':  {
          const enemies = this.waveSpawner.getEnemies();
          let hit = 0;
          for (const e of enemies) {
            if (e.isDead || hit >= 5 + lvl) continue;
            const bolt = this.add.line(0, 0, e.x, this.hero.groundY - 200, e.x, e.groundY - 25, 0xffff66, 0.9)
              .setLineWidth(3).setOrigin(0, 0).setDepth(e.groundY + 5);
            this.tweens.add({ targets: bolt, alpha: 0, duration: 300, onComplete: () => bolt.destroy() });
            let dmg = 60 + lvl * 20;
            if (e.isBoss) dmg = Math.round(dmg * 0.5);
            e.takeDamage(dmg);
            hit++;
          }
          this.camShake(0.005, 200);
          break;
        }
        case 'timeWarp':        {
          const enemies = this.waveSpawner.getEnemies();
          for (const e of enemies) {
            if (e.isDead) continue;
            const orig = e.stats.moveSpeed;
            e.stats.moveSpeed = orig * 0.4;
            this.time.delayedCall(4000 + lvl * 500, () => { if (!e.isDead) e.stats.moveSpeed = orig; });
          }
          break;
        }
        case 'meteorStrike':    {
          const dirX = this.hero.facingRight ? 1 : -1;
          const tx = this.hero.x + dirX * 200;
          // Telegraph
          const tel = this.add.circle(tx, this.hero.groundY - 5, 10, 0xff9966, 0.6).setDepth(this.hero.groundY + 100);
          this.tweens.add({ targets: tel, scale: 18, alpha: 0, duration: 500, onComplete: () => tel.destroy() });
          this.time.delayedCall(500, () => {
            this.spawnAoeBurst(tx, this.hero.groundY - 25, 200 + lvl * 30, 0xff9966, 200 + lvl * 200, 100);
            this.camShake(0.02, 600);
          });
          break;
        }
      }
    }
    if (this.classBuffs['arcaneShield'] !== undefined && this.classBuffs['arcaneShield'] <= 0) {
      this.arcaneShieldHp = 0;
      delete this.classBuffs['arcaneShield'];
    }
  }

  // ---------- ARCHER ----------
  private tickArcher(): void {
    const slots = HUD.getClassSkillSlots('archer');
    const keyMap: Record<string, Phaser.Input.Keyboard.Key> = {
      'K': this.boneVolleyKey, 'L': this.rotKey, ';': this.wraithFormKey,
      'U': this.summonKey, 'I': this.leechKey, 'P': this.apocalypseKey,
    };
    for (const slot of slots) {
      if (slot.id === 'ultimate') continue;
      if (!this.trySkill(slot.id, keyMap[slot.key])) continue;
      const lvl = this.levelSystem.progression.skills[slot.id] ?? 0;
      switch (slot.id) {
        case 'multishot':       this.spawnDirectionalCone(35 + lvl * 8, 380, 0xeeddaa, 80); break;
        case 'eagleEye':        this.classBuffs['eagleEye'] = 6000 + lvl * 1000; this.hero.sprite.fillColor = 0xffcc66; break;
        case 'pinDown':         {
          const enemies = this.waveSpawner.getEnemies();
          let nearest: Enemy | null = null; let bestD = Infinity;
          for (const e of enemies) {
            if (e.isDead) continue;
            const d = Math.hypot(e.x - this.hero.x, e.groundY - this.hero.groundY);
            if (d < bestD) { bestD = d; nearest = e; }
          }
          if (nearest) {
            const orig = nearest.stats.moveSpeed;
            nearest.stats.moveSpeed = 0;
            nearest.takeDamage(40 + lvl * 15);
            this.time.delayedCall(2000 + lvl * 500, () => { if (nearest && !nearest.isDead) nearest.stats.moveSpeed = orig; });
          }
          break;
        }
        case 'rainOfArrows':    {
          const dirX = this.hero.facingRight ? 1 : -1;
          const tx = this.hero.x + dirX * 200;
          this.spawnAoeBurst(tx, this.hero.groundY - 25, 180, 0xddccaa, 60 + lvl * 15);
          break;
        }
        case 'phantomStep':     this.hero.isInvulnerable = true; this.hero.alpha = 0.3; this.classBuffs['phantomStep'] = 2500 + lvl * 500; break;
        case 'mastersVolley':   this.spawnDirectionalCone(120 + lvl * 30, 500, 0xffeebb, 100); this.camShake(0.012, 400); break;
      }
    }
    if (this.classBuffs['phantomStep'] !== undefined && this.classBuffs['phantomStep'] <= 0) {
      this.hero.isInvulnerable = false;
      this.hero.alpha = 1;
      delete this.classBuffs['phantomStep'];
    }
  }

  // ==================== SIDEKICK ABILITIES ====================

  private getSidekickSkillLevel(sidekickId: string, skillId: string): number {
    return this.progression.sidekickSkills?.[sidekickId]?.[skillId] ?? 0;
  }

  /** Override the cooldown of the sidekick to honor cooldown-reduction skills */
  private getSidekickEffectiveCooldown(sidekick: Sidekick): number {
    const def = sidekick.def;
    let cd = def.cooldownMs;
    if (def.id === 'mending_pixie') {
      // Rapid Pulse: -300ms per point
      const lvl = this.getSidekickSkillLevel(def.id, 'rapid_pulse');
      cd = Math.max(800, cd - lvl * 300);
    } else if (def.id === 'frost_sprite') {
      // Frost Sprite: cooldown reduces as it levels up (3s at lv1 → 0.2s at lv20)
      const level = this.progression.sidekickLevels?.[def.id] ?? 1;
      cd = Math.max(200, 3000 - (level - 1) * (2800 / 19));
    } else if (def.id === 'plague_bat') {
      // Pandemic: -400ms per point
      const lvl = this.getSidekickSkillLevel(def.id, 'pandemic');
      cd = Math.max(1000, cd - lvl * 400);
    }
    return cd;
  }

  private tickSidekickAbility(sidekick: Sidekick): void {
    if (this.hero.isDead) return;
    if (!sidekick.consumeCooldown()) return;
    // Apply effective cooldown override (some skills reduce CD)
    sidekick.cooldown = this.getSidekickEffectiveCooldown(sidekick);

    const def = sidekick.def;
    const sid = def.id;
    const enemies = this.waveSpawner.getEnemies();

    switch (def.ability) {
      case 'heal': {
        // Greater Mending: +1% per point
        const greaterLvl = this.getSidekickSkillLevel(sid, 'greater_mending');
        const healPct = def.power + greaterLvl * 0.01;
        const heal = Math.ceil(this.hero.stats.maxHealth * healPct);
        if (this.hero.currentHealth < this.hero.stats.maxHealth) {
          this.spawnSidekickCastGlow(sidekick);
          this.hero.currentHealth = Math.min(this.hero.currentHealth + heal, this.hero.stats.maxHealth);
          EventBus.emit(Events.HERO_HEALTH_CHANGED, this.hero.currentHealth, this.hero.stats.maxHealth);
          this.spawnSidekickHealVfx();
        }
        break;
      }
      case 'freeze': {
        const glacialLvl = this.getSidekickSkillLevel(sid, 'glacial_touch');
        const novaLvl = this.getSidekickSkillLevel(sid, 'frost_nova');
        const duration = Math.min(2000, 800 + glacialLvl * 300); // 0.8s base, 1.1s at lv1, 2s at lv5
        const targetCount = 1 + novaLvl;
        const targets = this.findNearestEnemies(sidekick, enemies, targetCount);
        if (targets.length > 0) {
          this.spawnSidekickCastGlow(sidekick);
          for (const t of targets) this.applySidekickFreeze(t, duration);
        }
        break;
      }
      case 'poison': {
        const virulenceLvl = this.getSidekickSkillLevel(sid, 'virulence');
        const blackDeathLvl = this.getSidekickSkillLevel(sid, 'black_death');
        const dotPct = def.power + virulenceLvl * 0.03;
        const target = sidekick.findNearestEnemy(enemies);
        if (target) {
          this.spawnSidekickCastGlow(sidekick);
          this.applySidekickPoison(target, dotPct, blackDeathLvl);
        }
        break;
      }
      case 'attack': {
        const searingLvl = this.getSidekickSkillLevel(sid, 'searing');
        const twinLvl = this.getSidekickSkillLevel(sid, 'twin_bolts');
        const infernoLvl = this.getSidekickSkillLevel(sid, 'inferno');
        const damage = def.power + searingLvl * 10;
        const numBolts = 1 + twinLvl;
        const pierce = infernoLvl;
        const targets = this.findNearestEnemies(sidekick, enemies, numBolts);
        if (targets.length === 0) {
          const single = sidekick.findNearestEnemy(enemies);
          if (single) {
            this.spawnSidekickCastGlow(sidekick);
            this.spawnSidekickBolt(sidekick, single, damage, pierce);
          }
        } else {
          this.spawnSidekickCastGlow(sidekick);
          for (let i = 0; i < numBolts; i++) {
            const target = targets[i % targets.length];
            this.time.delayedCall(i * 60, () => {
              if (!target.isDead) this.spawnSidekickBolt(sidekick, target, damage, pierce);
            });
          }
        }
        break;
      }
      case 'shield': {
        const hardenedLvl = this.getSidekickSkillLevel(sid, 'hardened_wards');
        const vitalLvl = this.getSidekickSkillLevel(sid, 'vital_bond');
        // Update DR each tick (in case it changed)
        this.hero.damageReductionPct = 0.12 + hardenedLvl * 0.015;
        const regen = def.power + vitalLvl * 2;
        if (this.hero.currentHealth < this.hero.stats.maxHealth) {
          this.hero.currentHealth = Math.min(this.hero.currentHealth + regen, this.hero.stats.maxHealth);
          EventBus.emit(Events.HERO_HEALTH_CHANGED, this.hero.currentHealth, this.hero.stats.maxHealth);
        }
        break;
      }
    }
  }

  /** Find up to N nearest distinct alive enemies within the sidekick's range. */
  private findNearestEnemies(sidekick: Sidekick, enemies: Enemy[], count: number): Enemy[] {
    const range = sidekick.def.range ?? Infinity;
    const candidates: { e: Enemy; d: number }[] = [];
    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = e.x - this.hero.x;
      const dy = e.groundY - this.hero.groundY;
      const d = Math.hypot(dx, dy);
      if (d > range) continue;
      candidates.push({ e, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    return candidates.slice(0, count).map(c => c.e);
  }

  /** Cast glow — sidekick flashes bright when actually firing an ability. */
  private spawnSidekickCastGlow(sidekick: Sidekick): void {
    const glow = this.add.circle(sidekick.x, sidekick.y, 12, sidekick.def.glowColor, 0.7)
      .setDepth(sidekick.depth + 1);
    this.tweens.add({
      targets: glow, scale: 2.5, alpha: 0,
      duration: 350, ease: 'Quad.easeOut',
      onComplete: () => glow.destroy(),
    });
  }

  private spawnSidekickHealVfx(): void {
    const hx = this.hero.x;
    const hy = this.hero.groundY - 30;
    const ring = this.add.circle(hx, hy, 14, 0x66ff88, 0)
      .setStrokeStyle(2, 0xaaffbb, 0.9)
      .setDepth(this.hero.groundY + 5);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 600,
      onComplete: () => ring.destroy(),
    });
    // Floating + tick text
    const txt = this.add.text(hx, hy - 20, '+', {
      fontSize: '16px', color: '#aaffbb', fontFamily: 'monospace',
      stroke: '#003311', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(this.hero.groundY + 6);
    this.tweens.add({
      targets: txt,
      y: hy - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => txt.destroy(),
    });
  }

  private applySidekickFreeze(enemy: Enemy, durationMs: number): void {
    if ((enemy as Enemy & { _frozenOriginalSpeed?: number })._frozenOriginalSpeed !== undefined) return;

    // ===== ICE SHARD PROJECTILE — flies diagonally down at the enemy =====
    const targetX = enemy.x;
    const targetY = enemy.groundY - 22;
    const startX = targetX - 120;
    const startY = targetY - 160;

    // Sharp ice shard shape (triangle drawn with graphics)
    const shard = this.add.graphics();
    // Main shard body — elongated icy triangle
    shard.fillStyle(0xccf0ff, 0.9);
    shard.fillTriangle(0, -18, -5, 10, 5, 10);
    // Inner highlight for sharpness
    shard.fillStyle(0xeeffff, 0.7);
    shard.fillTriangle(0, -14, -2, 6, 2, 6);
    // Bright tip
    shard.fillStyle(0xffffff, 1);
    shard.fillTriangle(0, -18, -1, -8, 1, -8);
    shard.setPosition(startX, startY);
    shard.setDepth(enemy.groundY + 5);
    // Rotate to point along the flight path (down-right diagonal)
    shard.setRotation(Math.atan2(targetY - startY, targetX - startX) + Math.PI / 2);
    shard.setScale(3.5);

    // Trail particles behind the shard
    const trail1 = this.add.circle(startX, startY, 4, 0xaaddff, 0.4).setDepth(enemy.groundY + 4);
    const trail2 = this.add.circle(startX - 8, startY - 12, 3, 0xccf0ff, 0.3).setDepth(enemy.groundY + 4);

    // Animate shard flying to target
    this.tweens.add({
      targets: [shard, trail1, trail2],
      x: targetX,
      y: targetY,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        shard.destroy();
        trail1.destroy();
        trail2.destroy();

        // ===== FROZEN PUDDLE WITH DRY ICE FOG =====
        const groundY = enemy.groundY;
        const impactX = enemy.x;
        const puddleDepth = groundY - 1;

        // --- Frozen puddle base ---
        const puddle = this.add.graphics().setDepth(puddleDepth);
        // Outer dark ice ring
        puddle.fillStyle(0x5599bb, 0.3);
        puddle.fillEllipse(impactX, groundY, 70, 16);
        // Mid layer — blueish ice
        puddle.fillStyle(0x88ccee, 0.35);
        puddle.fillEllipse(impactX, groundY, 54, 12);
        // Inner frozen core — bright white-blue
        puddle.fillStyle(0xccf0ff, 0.45);
        puddle.fillEllipse(impactX, groundY, 34, 8);
        // Glossy highlight streak
        puddle.fillStyle(0xeeffff, 0.5);
        puddle.fillEllipse(impactX - 6, groundY - 2, 16, 4);
        // Frost cracks in the ice
        puddle.lineStyle(0.8, 0xddffff, 0.5);
        puddle.lineBetween(impactX - 28, groundY + 1, impactX - 12, groundY - 3);
        puddle.lineBetween(impactX + 28, groundY, impactX + 14, groundY - 2);
        puddle.lineBetween(impactX - 8, groundY + 2, impactX + 6, groundY - 2);
        puddle.lineBetween(impactX + 10, groundY + 3, impactX + 20, groundY - 1);

        // --- CO2 fog particles — continuous wispy puffs rising from the puddle ---
        const fogParts: Phaser.GameObjects.GameObject[] = [];
        const fogInterval = 180; // ms between fog puffs
        const fogTimer = this.time.addEvent({
          delay: fogInterval,
          repeat: Math.floor(durationMs / fogInterval) - 1,
          callback: () => {
            // Spawn a wispy fog puff
            const fx = impactX + Phaser.Math.Between(-28, 28);
            const fy = groundY + Phaser.Math.Between(-3, 3);
            const size = Phaser.Math.FloatBetween(6, 14);
            const puff = this.add.ellipse(fx, fy, size, size * 0.6, 0xddeeff, Phaser.Math.FloatBetween(0.15, 0.3));
            puff.setDepth(puddleDepth + 1);
            fogParts.push(puff);
            // Puff drifts upward and sideways, expands, and fades
            this.tweens.add({
              targets: puff,
              x: fx + Phaser.Math.Between(-18, 18),
              y: fy - Phaser.Math.Between(12, 30),
              scaleX: Phaser.Math.FloatBetween(1.8, 3.0),
              scaleY: Phaser.Math.FloatBetween(1.4, 2.2),
              alpha: 0,
              duration: Phaser.Math.Between(600, 1200),
              ease: 'Quad.easeOut',
              onComplete: () => puff.destroy(),
            });
          },
        });

        // Fade out puddle over the freeze duration
        this.tweens.add({
          targets: puddle,
          alpha: 0,
          duration: durationMs * 0.8,
          delay: durationMs * 0.2,
          ease: 'Quad.easeIn',
          onComplete: () => {
            puddle.destroy();
            fogTimer.destroy();
            for (const p of fogParts) if (p.active) p.destroy();
          },
        });

        // ===== IMPACT: apply freeze effect =====
        this.applyFreezeEffect(enemy, durationMs);
      },
    });

    // Offset trails slightly behind the shard
    this.tweens.add({ targets: trail1, x: targetX + 4, y: targetY + 6, duration: 260, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: trail2, x: targetX + 8, y: targetY + 12, duration: 300, ease: 'Quad.easeIn' });
  }

  /** Apply the actual freeze status to an enemy (called after the shard lands). */
  private applyFreezeEffect(enemy: Enemy, durationMs: number): void {
    if (enemy.isDead) return;
    if ((enemy as Enemy & { _frozenOriginalSpeed?: number })._frozenOriginalSpeed !== undefined) return;

    const original = enemy.stats.moveSpeed;
    (enemy as Enemy & { _frozenOriginalSpeed?: number })._frozenOriginalSpeed = original;
    enemy.stats.moveSpeed = 0;
    enemy.isFrozen = true;

    // Create a blue transparent duplicate of every visible body part
    const ICE_COLOR = 0x66ccff;
    const ICE_ALPHA = 0.3;
    const frostOverlay = this.add.container(0, 0);
    enemy.bodyGroup.add(frostOverlay);

    const cloneChildren = (source: Phaser.GameObjects.Container, target: Phaser.GameObjects.Container) => {
      for (const child of source.list) {
        if ('visible' in child && !(child as unknown as { visible: boolean }).visible) continue;
        if (child === frostOverlay) continue; // don't clone the overlay itself
        if (child instanceof Phaser.GameObjects.Rectangle) {
          const r = this.add.rectangle(child.x, child.y, child.displayWidth, child.displayHeight, ICE_COLOR, ICE_ALPHA);
          r.setOrigin(child.originX, child.originY);
          r.setAngle(child.angle);
          target.add(r);
        } else if (child instanceof Phaser.GameObjects.Arc) {
          const c = this.add.circle(child.x, child.y, child.radius, ICE_COLOR, ICE_ALPHA);
          target.add(c);
        } else if (child instanceof Phaser.GameObjects.Triangle) {
          // Clone triangle using its geom vertices
          const g = child.geom as Phaser.Geom.Triangle;
          const t = this.add.triangle(child.x, child.y, g.x1, g.y1, g.x2, g.y2, g.x3, g.y3, ICE_COLOR, ICE_ALPHA);
          target.add(t);
        } else if (child instanceof Phaser.GameObjects.Container) {
          const sub = this.add.container(child.x, child.y);
          sub.setAngle(child.angle);
          target.add(sub);
          cloneChildren(child, sub);
        }
      }
    };
    cloneChildren(enemy.bodyGroup, frostOverlay);

    const frostTween = this.tweens.add({ targets: frostOverlay, alpha: 0.5, yoyo: true, duration: 600, repeat: -1 });

    // Cleanup helper — restores speed, clears frozen flag, destroys overlay
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      const e = enemy as Enemy & { _frozenOriginalSpeed?: number };
      if (e._frozenOriginalSpeed !== undefined) {
        enemy.stats.moveSpeed = e._frozenOriginalSpeed;
        delete e._frozenOriginalSpeed;
      }
      enemy.isFrozen = false;
      frostTween.stop();
      if (frostOverlay.active) frostOverlay.destroy();
    };

    // Use wall-clock setTimeout so hit-stop timeScale can't stretch the duration
    window.setTimeout(() => cleanup(), durationMs);

    // Also clean up immediately if the enemy dies before the freeze expires
    const origTakeDmg = enemy.takeDamage.bind(enemy);
    enemy.takeDamage = (amount: number) => {
      origTakeDmg(amount);
      if (enemy.isDead) cleanup();
    };
  }

  private applySidekickPoison(enemy: Enemy, hpPercent: number, blackDeathLvl: number = 0): void {
    // Apply a DOT through the existing decay system
    let totalDmg = Math.ceil(enemy.stats.maxHealth * hpPercent);
    if (enemy.isBoss) totalDmg = Math.min(totalDmg, 60); // boss cap
    const tickInterval = 500;
    const duration = 4000;
    const ticks = Math.floor(duration / tickInterval);
    const dmgPerTick = Math.ceil(totalDmg / ticks);

    let elapsed = 0;
    const evt = this.time.addEvent({
      delay: tickInterval,
      repeat: ticks - 1,
      callback: () => {
        elapsed += tickInterval;
        if (enemy.isDead || elapsed > duration) { evt.destroy(); return; }
        enemy.currentHealth = Math.max(enemy.currentHealth - dmgPerTick, 0);
        enemy.updateHealthBarPublic();
        // Tiny green sparkle
        const spark = this.add.circle(enemy.x + Phaser.Math.Between(-10, 10), enemy.groundY - 25, 2.5, 0x88cc66, 0.9)
          .setDepth(enemy.groundY + 1);
        this.tweens.add({ targets: spark, alpha: 0, y: spark.y - 12, duration: 400, onComplete: () => spark.destroy() });
        if (enemy.currentHealth <= 0 && !enemy.isDead) {
          enemy.isDead = true;
          enemy.sm.transition('death');
          // Black Death: explode in a toxic burst
          if (blackDeathLvl > 0) this.spawnBlackDeathExplosion(enemy.x, enemy.groundY, blackDeathLvl);
        }
      },
    });
  }

  private spawnBlackDeathExplosion(x: number, y: number, blackDeathLvl: number): void {
    const radius = 100;
    const dmg = 30 + blackDeathLvl * 15;
    // Visual: green burst
    const burst = this.add.circle(x, y - 20, 12, 0x88cc66, 0.7)
      .setDepth(y + 5);
    this.tweens.add({
      targets: burst,
      scale: radius / 12,
      alpha: 0,
      duration: 500,
      onComplete: () => burst.destroy(),
    });
    // Damage all nearby enemies
    const enemies = this.waveSpawner.getEnemies();
    for (const e of enemies) {
      if (e.isDead) continue;
      if (Math.hypot(e.x - x, e.groundY - y) > radius) continue;
      let actualDmg = dmg;
      if (e.isBoss) actualDmg = Math.min(actualDmg, 25);
      e.takeDamage(actualDmg);
    }
  }

  private spawnSidekickBolt(sidekick: Sidekick, target: Enemy, damage: number, pierce: number = 0): void {
    // Spawn a homing-ish fire bolt from the sidekick to the target's current position
    const startX = sidekick.x;
    const startY = sidekick.y;
    const endX = target.x;
    const endY = target.groundY - 22;

    const bolt = this.add.circle(startX, startY, 5, 0xffaa44, 1)
      .setDepth(this.hero.groundY + 60);
    const glow = this.add.circle(startX, startY, 9, 0xff6622, 0.5)
      .setDepth(this.hero.groundY + 59);

    this.tweens.add({
      targets: [bolt, glow],
      x: endX,
      y: endY,
      duration: 220,
      onComplete: () => {
        // Hit burst
        const burst = this.add.circle(endX, endY, 6, 0xffdd44, 0.9)
          .setDepth(target.groundY + 5);
        this.tweens.add({
          targets: burst, scale: 3, alpha: 0,
          duration: 300,
          onComplete: () => burst.destroy(),
        });
        bolt.destroy();
        glow.destroy();

        // Apply damage to primary target
        const hit = (e: Enemy) => {
          if (e.isDead) return;
          let dmg = damage;
          if (e.isBoss) dmg = Math.min(dmg, 25);
          e.takeDamage(dmg);
        };
        hit(target);

        // Inferno: hit additional enemies in a cone behind the target (line pierce)
        if (pierce > 0) {
          const enemies = this.waveSpawner.getEnemies();
          let pierced = 0;
          for (const e of enemies) {
            if (pierced >= pierce) break;
            if (e === target || e.isDead) continue;
            // Hit enemies within 60px of the impact site
            if (Math.hypot(e.x - endX, e.groundY - target.groundY) < 60) {
              hit(e);
              pierced++;
            }
          }
        }
      },
    });
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

    // Bone Spear Volley
    this.hud.setSkillCooldown('boneVolley', Math.max(0, this.boneVolleyCooldown / ForestStage.BONE_VOLLEY_CD));

    // Wraith Form (shows active duration first, then cooldown)
    if (this.wraithActive) {
      this.hud.setSkillCooldown('wraithForm', this.wraithTimer / this.wraithDuration);
    } else {
      this.hud.setSkillCooldown('wraithForm', Math.max(0, this.wraithCooldown / ForestStage.WRAITH_CD));
    }

    // Soul Apocalypse
    this.hud.setSkillCooldown('soulApocalypse', Math.max(0, this.apocalypseCooldown / ForestStage.APOCALYPSE_CD));
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

      // Necromancer-only: spawn a death cloud trail every 100ms
      if (this.heroClass.id === 'necromancer' && this.ultimateCloudTimer >= 100) {
        this.ultimateCloudTimer = 0;
        this.spawnDeathCloud(this.hero.x, this.hero.groundY);
      }
      // Other classes: tick their unique ultimate effect every 100ms
      if (this.heroClass.id !== 'necromancer' && this.ultimateCloudTimer >= 100) {
        this.ultimateCloudTimer = 0;
        this.tickClassUltimate();
      }

      if (this.ultimateTimeLeft <= 0) {
        this.endUltimate();
      }
    }
  }

  /** Per-class ultimate tick effect (called every 100ms while active). */
  private tickClassUltimate(): void {
    const enemies = this.waveSpawner.getEnemies();
    switch (this.heroClass.id) {
      case 'paladin': {
        // Avatar of Light: holy explosions every tick around the hero
        this.spawnAoeBurst(this.hero.x, this.hero.groundY - 25, 90, 0xffeebb, 25);
        break;
      }
      case 'barbarian': {
        // Unleashed Fury: damages everything nearby every tick
        for (const e of enemies) {
          if (e.isDead) continue;
          const d = Math.hypot(e.x - this.hero.x, e.groundY - this.hero.groundY);
          if (d > 80) continue;
          let dmg = 20;
          if (e.isBoss) dmg = 10;
          e.takeDamage(dmg);
        }
        break;
      }
      case 'templar_knight': {
        // Templar Awakening: holy aura damages all on-screen enemies
        const cam = this.cameras.main;
        const left = cam.scrollX - 50;
        const right = cam.scrollX + cam.width / cam.zoom + 50;
        for (const e of enemies) {
          if (e.isDead || e.x < left || e.x > right) continue;
          let dmg = 15;
          if (e.isBoss) dmg = 8;
          e.takeDamage(dmg);
        }
        break;
      }
      case 'mage': {
        // Archmage Ascension: random lightning strikes
        const targets = enemies.filter(e => !e.isDead);
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          const bolt = this.add.line(0, 0, t.x, this.hero.groundY - 250, t.x, t.groundY - 25, 0xffff66, 0.9)
            .setLineWidth(3).setOrigin(0, 0).setDepth(t.groundY + 5);
          this.tweens.add({ targets: bolt, alpha: 0, duration: 300, onComplete: () => bolt.destroy() });
          let dmg = 60;
          if (t.isBoss) dmg = 25;
          t.takeDamage(dmg);
        }
        break;
      }
      case 'archer': {
        // Master Archer: fire arrows at all enemies on screen
        const cam = this.cameras.main;
        const left = cam.scrollX - 50;
        const right = cam.scrollX + cam.width / cam.zoom + 50;
        for (const e of enemies) {
          if (e.isDead || e.x < left || e.x > right) continue;
          // Visual arrow line from hero to enemy
          const arrow = this.add.line(0, 0, this.hero.x, this.hero.groundY - 25, e.x, e.groundY - 25, 0xeeddaa, 0.9)
            .setLineWidth(2).setOrigin(0, 0).setDepth(e.groundY + 4);
          this.tweens.add({ targets: arrow, alpha: 0, duration: 250, onComplete: () => arrow.destroy() });
          let dmg = 30;
          if (e.isBoss) dmg = 12;
          e.takeDamage(dmg);
        }
        break;
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

    // "ULTIMATE!" text — class-specific name
    const classUltimates: Record<string, { name: string; color: string; flash: [number, number, number] }> = {
      necromancer:    { name: 'DEATH MARCH',         color: '#44ff66', flash: [80, 255, 100] },
      paladin:        { name: 'AVATAR OF LIGHT',     color: '#ffeebb', flash: [255, 230, 150] },
      barbarian:      { name: 'UNLEASHED FURY',      color: '#ff5522', flash: [255, 80, 30] },
      templar_knight: { name: 'TEMPLAR AWAKENING',   color: '#66aaff', flash: [120, 180, 255] },
      mage:           { name: 'ARCHMAGE ASCENSION',  color: '#aa66ff', flash: [180, 100, 255] },
      archer:         { name: 'MASTER ARCHER',       color: '#66ff99', flash: [120, 255, 180] },
    };
    const ult = classUltimates[this.heroClass.id] ?? classUltimates.necromancer;
    const ultText = this.add.text(640, 200, ult.name, {
      fontSize: '36px', color: ult.color, fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({
      targets: ultText,
      alpha: 0, y: 180,
      duration: 1500,
      onComplete: () => ultText.destroy(),
    });

    // Camera flash
    this.cameras.main.flash(300, ult.flash[0], ult.flash[1], ult.flash[2]);
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
          if (enemy.isBoss) tickDmg = Math.min(tickDmg, 30);
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
    if (enemy.isBoss) totalDmg = Math.min(totalDmg, 180);
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
    // Auto-save to Supabase (saves next stage as unlocked)
    this.autoSave();

    // Never regress — only advance if this stage is at or beyond the current highest
    const newHighest = Math.max(this.highestStage, this.stageIndex + 1);
    const stageSelectData = {
      heroClass: this.heroClass,
      user: this.user,
      characterId: this.characterId,
      gold: this.gold,
      level: this.levelSystem.level,
      currentXp: this.levelSystem.currentXp,
      currentStage: newHighest,
      progression: this.levelSystem.progression,
    };

    if (choice === 'shop') {
      this.scene.start('Shop', {
        heroClass: this.heroClass,
        user: this.user,
        characterId: this.characterId,
        gold: this.gold,
        level: this.levelSystem.level,
        currentXp: this.levelSystem.currentXp,
        stageIndex: this.stageIndex + 1,
        progression: this.levelSystem.progression,
      });
    } else {
      // Go to stage map instead of directly to next stage
      this.scene.start('StageSelect', stageSelectData);
    }
  };

  private autoSave(): void {
    if (!this.characterId) return;
    // Only save the higher of current highest vs newly completed stage
    const newHighest = Math.max(this.highestStage, this.stageIndex + 1);
    this.highestStage = newHighest; // update local tracking too
    saveCharacter(this.characterId, {
      level: this.levelSystem.level,
      gold: this.gold,
      xp: this.levelSystem.currentXp,
      current_stage: newHighest,
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

    // For dynamically-created objects during gameplay, assign to the correct camera.
    // Most new objects are world objects — immediately ignore them on the UI camera
    // to prevent a 1-frame flash where the UI camera renders them at scroll (0,0).
    this.events.on('addedtoscene', (obj: Phaser.GameObjects.GameObject) => {
      const o = obj as Phaser.GameObjects.GameObject & { scrollFactorX?: number };
      if (o.scrollFactorX === 0) {
        this.cameras.main.ignore(obj);
      } else {
        uiCamera.ignore(obj);
      }
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
        if (distToHero < 80 && Math.abs(this.hero.groundY - boss.groundY) < 100 && this.hero.jumpZ > -40 && !this.hero.isDamageImmune) {
          boss.chargeHasHit = true;
          // Deal 25% of hero's MAX HP as damage (bypasses defense)
          const dmg = Math.ceil(this.hero.stats.maxHealth * 0.25);
          this.hero.applyKnockback(boss.x, 4680);
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

    // Hit hero (skipped during i-frame immunity)
    if (!this.hero.isDead && !this.hero.isDamageImmune) {
      const dx = this.hero.x - boss.x;
      const inFront = facingRight ? (dx > 0 && dx < swingRange) : (dx < 0 && dx > -swingRange);
      if (inFront && Math.abs(this.hero.groundY - boss.groundY) < swingDepth && this.hero.jumpZ > -40) {
        this.hero.applyKnockback(boss.x, 3780);
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

    // Damage the hero if in range (skipped during i-frame immunity)
    if (!this.hero.isDead && !this.hero.isDamageImmune) {
      const dx = Math.abs(this.hero.x - boss.x);
      if (dx < smashRange && this.hero.jumpZ > -50) {
        // Can be dodged by jumping!
        this.hero.applyKnockback(boss.x, 4320);
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

  // ── BOSS SPORE JUMP — amorphous bosses leap into the air and slam down,
  //    creating a poison gas cloud where they land. ──
  private handleBossSporeJump(boss: Enemy, delta: number): void {
    // Only amorphous-style bosses (SporeMushroom) use this attack
    if (boss.bodyStyle !== 'amorphous') return;

    if (boss.sporeJumpCooldown > 0) { boss.sporeJumpCooldown -= delta; return; }
    if (boss.sporeJumpActive) return;

    // Trigger when hero is within 500px and cooldown is ready
    const dist = Math.abs(this.hero.x - boss.x);
    if (dist > 500 || this.hero.isDead) return;

    // Start the jump!
    boss.sporeJumpActive = true;
    boss.sporeJumpTargetX = this.hero.x;
    const targetY = this.hero.groundY;

    // Freeze boss movement during jump
    (boss.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    // Telegraph: green warning circle at hero's position
    const warningX = boss.sporeJumpTargetX;
    const warning = this.add.ellipse(warningX, targetY + 5, 200, 50, 0x44cc22, 0.25)
      .setStrokeStyle(3, 0x66ff44, 0.7).setDepth(targetY + 1);
    this.tweens.add({
      targets: warning, alpha: { from: 0.25, to: 0.6 },
      duration: 150, yoyo: true, repeat: 3,
    });

    // Boss glows green
    const origColor = boss.sprite.fillColor;
    boss.sprite.fillColor = 0x44ff44;

    // Phase 1: Launch into air (0.6s)
    this.tweens.add({
      targets: boss.bodyGroup,
      y: -200,  // fly way up above screen
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Phase 2: Teleport X to target, slam down (0.4s)
        boss.x = boss.sporeJumpTargetX;
        boss.groundY = targetY;
        this.tweens.add({
          targets: boss.bodyGroup,
          y: 0,  // back to ground level
          duration: 400,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            // IMPACT!
            boss.sprite.fillColor = origColor;
            boss.sporeJumpActive = false;
            boss.sporeJumpCooldown = 8000; // 8 second cooldown
            warning.destroy();
            this.executeSporeJumpLanding(boss);
          },
        });
      },
    });
  }

  private executeSporeJumpLanding(boss: Enemy): void {
    const landX = boss.x;
    const landY = boss.groundY;

    // Camera shake
    this.cameras.main.shake(300, 0.01);

    // --- POISON GAS CLOUDS — large billowing cloud shapes that fill the area ---
    const cloudCount = 7;
    const clouds: Phaser.GameObjects.GameObject[] = [];
    for (let c = 0; c < cloudCount; c++) {
      const cx = landX + Phaser.Math.Between(-180, 180);
      const cy = landY + Phaser.Math.Between(-50, 10);
      const g = this.add.graphics().setDepth(landY + 1);

      // Build a cloud shape from multiple overlapping bumpy circles
      // like a real cumulus cloud silhouette
      const bumpCount = Phaser.Math.Between(4, 7);
      const baseW = Phaser.Math.Between(80, 140);
      const baseH = Phaser.Math.Between(40, 70);

      // Outer atmospheric haze (very large, very faint)
      g.fillStyle(0x338818, 0.08);
      g.fillEllipse(cx, cy, baseW * 2, baseH * 1.6);

      // Cloud body — several overlapping bumps along the top edge
      // gives the classic puffy cloud silhouette
      for (let b = 0; b < bumpCount; b++) {
        const t = b / (bumpCount - 1); // 0 to 1 across the cloud width
        const bx = cx - baseW * 0.4 + t * baseW * 0.8;
        // Bumps rise higher in the center, lower at edges (arch shape)
        const archHeight = Math.sin(t * Math.PI) * baseH * 0.6;
        const by = cy - archHeight + Phaser.Math.FloatBetween(-5, 5);
        const bumpW = baseW * Phaser.Math.FloatBetween(0.3, 0.5);
        const bumpH = baseH * Phaser.Math.FloatBetween(0.4, 0.7);
        // Darker outer bump
        g.fillStyle(0x44aa22, 0.12);
        g.fillEllipse(bx, by, bumpW * 1.2, bumpH * 1.2);
        // Main bump
        g.fillStyle(0x55cc33, 0.18);
        g.fillEllipse(bx, by, bumpW, bumpH);
      }

      // Flat bottom fill — clouds have flat bottoms
      g.fillStyle(0x44bb22, 0.14);
      g.fillEllipse(cx, cy + baseH * 0.15, baseW * 0.9, baseH * 0.4);

      // Dense core highlight (brighter center)
      g.fillStyle(0x77ee55, 0.12);
      g.fillEllipse(cx + Phaser.Math.Between(-10, 10),
        cy - baseH * 0.15, baseW * 0.35, baseH * 0.3);

      clouds.push(g);

      // Percolation — bubbling alpha pulses on the cloud, no position movement
      this.tweens.add({
        targets: g,
        alpha: { from: 1, to: Phaser.Math.FloatBetween(0.6, 0.8) },
        scaleY: { from: 1, to: Phaser.Math.FloatBetween(0.94, 0.98) },
        duration: 300 + c * 80,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
      // Small rising spore bubbles percolating up from each cloud
      const bubbleTimer = this.time.addEvent({
        delay: 250 + c * 50,
        repeat: 11, // ~3 seconds of bubbles
        callback: () => {
          const bx = cx + Phaser.Math.Between(-baseW * 0.3, baseW * 0.3);
          const bubble = this.add.circle(bx, cy, Phaser.Math.Between(2, 5), 0x77ee55, 0.4)
            .setDepth(landY + 2);
          this.tweens.add({
            targets: bubble,
            y: cy - Phaser.Math.Between(20, 50),
            alpha: 0,
            scaleX: Phaser.Math.FloatBetween(0.3, 0.6),
            scaleY: Phaser.Math.FloatBetween(1.3, 1.8),
            duration: 500 + Math.random() * 300,
            onComplete: () => bubble.destroy(),
          });
        },
      });
    }

    // Spore particles bursting outward on impact
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      const px = landX + Math.cos(angle) * dist;
      const py = landY + Math.sin(angle) * dist * 0.4;
      const spore = this.add.circle(px, py, Phaser.Math.Between(3, 6), 0x66cc44, 0.7)
        .setDepth(landY + 2);
      this.tweens.add({
        targets: spore,
        x: px + Math.cos(angle) * 80,
        y: py - 20 - Math.random() * 40,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 800 + Math.random() * 400,
        onComplete: () => spore.destroy(),
      });
    }

    // Damage hero on impact (can be dodged by jumping)
    if (!this.hero.isDead && !this.hero.isDamageImmune) {
      const dx = Math.abs(this.hero.x - landX);
      if (dx < 150 && this.hero.jumpZ > -50) {
        const slamDmg = Math.round(boss.stats.attackPower * 1.5);
        this.hero.takeDamage(slamDmg);
        this.hero.applyKnockback(landX, 3000);
      }
    }

    // Lingering poison damage — ticks every 0.5s for 3 seconds while hero is in cloud zone
    let poisonTicks = 0;
    this.time.addEvent({
      delay: 500,
      repeat: 5, // 6 ticks = 3 seconds
      callback: () => {
        poisonTicks++;
        if (this.hero.isDead) return;
        const heroInCloud = Math.abs(this.hero.x - landX) < 200;
        if (heroInCloud && this.hero.jumpZ > -30) {
          this.hero.takeDamage(Math.round(boss.stats.attackPower * 0.2));
          // Green damage flash
          const flash = this.add.circle(this.hero.x, this.hero.groundY - 20, 8, 0x44cc22, 0.4)
            .setDepth(this.hero.groundY + 10);
          this.tweens.add({ targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 300, onComplete: () => flash.destroy() });
        }
        // Fade out and destroy all clouds after 3 seconds
        if (poisonTicks >= 6) {
          for (const cloud of clouds) {
            this.tweens.add({
              targets: cloud, alpha: 0, duration: 800,
              onComplete: () => cloud.destroy(),
            });
          }
        }
      },
    });
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

    // Award XP to the equipped sidekick (35% of the hero's XP gain, so they level slower)
    this.awardSidekickXp(Math.max(1, Math.round(enemy.stats.xpReward * 0.35)));
  };

  private awardSidekickXp(amount: number): void {
    const id = this.progression.equippedSidekick;
    if (!id) return;
    if (!this.progression.sidekickXp) this.progression.sidekickXp = {};
    if (!this.progression.sidekickLevels) this.progression.sidekickLevels = {};
    if (!this.progression.sidekickSkillPoints) this.progression.sidekickSkillPoints = {};

    let level = this.progression.sidekickLevels[id] ?? 1;
    let xp = (this.progression.sidekickXp[id] ?? 0) + amount;
    let xpToNext = sidekickXpForLevel(level);

    while (level < SIDEKICK_MAX_LEVEL && xp >= xpToNext) {
      xp -= xpToNext;
      level++;
      this.progression.sidekickSkillPoints[id] = (this.progression.sidekickSkillPoints[id] ?? 0) + 1;
      xpToNext = sidekickXpForLevel(level);
      // Level-up flash on the sidekick
      if (this.sidekick) {
        const flash = this.add.circle(this.sidekick.x, this.sidekick.y, 20, 0xffdd44, 0.7)
          .setDepth(this.hero.groundY + 100);
        this.tweens.add({
          targets: flash, scale: 2.5, alpha: 0,
          duration: 600,
          onComplete: () => flash.destroy(),
        });
        const txt = this.add.text(this.sidekick.x, this.sidekick.y - 25, `${this.sidekick.def.name} Lv.${level}!`, {
          fontSize: '12px', color: '#ffdd44', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(this.hero.groundY + 101);
        this.tweens.add({
          targets: txt, y: txt.y - 30, alpha: 0,
          duration: 1200,
          onComplete: () => txt.destroy(),
        });
      }
    }

    this.progression.sidekickLevels[id] = level;
    this.progression.sidekickXp[id] = level >= SIDEKICK_MAX_LEVEL ? 0 : xp;
  }

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
    // ===== PAINTED PARALLAX BATTLEFIELD =====
    // 5 distinct parallax layers built from canvas-textured Image instances.
    // Each layer's depth is set so the hero (depth ~ groundY) sits between
    // the play layer and the foreground.
    //
    // Layer mapping (see SCENE LAYER SYSTEM above):
    //   BACKGROUND LAYER (depth < BACKGROUND_LAYER_DEPTH = -10):
    //     sky          — depth -200, scrollFactor 0.20
    //     far          — depth -160, scrollFactor 0.40
    //     mid          — depth -110, scrollFactor 0.70
    //   WALKING AREA LAYER (depth -10 to 700):
    //     play ground  — depth  -10, scrollFactor 1.00
    //     characters   — depth ~ walkingAreaY (420-560)
    //   FOREGROUND LAYER (depth > FOREGROUND_LAYER_DEPTH = 700):
    //     underground  — depth +800, scrollFactor 0.95

    ensureEnvironmentTextures(this);

    // Background layer depths (all < BACKGROUND_LAYER_DEPTH)
    const SKY_DEPTH  = -200;
    const FAR_DEPTH  = -160;
    const MID_DEPTH  = -110;
    // Walking area layer depth
    const PLAY_DEPTH = ForestStage.BACKGROUND_LAYER_DEPTH; // -10
    // Foreground layer depth (> FOREGROUND_LAYER_DEPTH)
    const FG_DEPTH   = ForestStage.FOREGROUND_LAYER_DEPTH + 100; // 800

    // ===== LAYER 1: SKY (painted gradient, parallax 0.20) =====
    this.add.tileSprite(640, 360, STAGE_WIDTH + 600, 720, TextureKeys.ENV_SKY_GRADIENT)
      .setScrollFactor(0.20, 0).setDepth(SKY_DEPTH);
    // Sun glow blob
    const sunG = this.add.graphics().setScrollFactor(0.20, 0).setDepth(SKY_DEPTH + 1);
    const sunPts = paint.blobPath(0, 0, 60, 50, { sides: 18, jitter: 0.12, seed: 7 });
    sunG.fillStyle(0xffe8b0, 0.55);
    sunG.fillPoints(sunPts, true);
    sunG.fillStyle(0xffd680, 0.18);
    sunG.fillPoints(paint.blobPath(0, 0, 110, 90, { sides: 20, jitter: 0.15, seed: 9 }), true);
    sunG.x = 980; sunG.y = 200;

    // ===== LAYER 2: FAR HORIZON (parallax 0.40) =====
    const horizonY = 410;
    if (this.stageIndex !== 0) {
    this.add.image(640, horizonY, TextureKeys.ENV_BG_HORIZON)
      .setScrollFactor(0.40, 0).setDepth(FAR_DEPTH);
    this.add.image(640 + 1280, horizonY, TextureKeys.ENV_BG_HORIZON)
      .setScrollFactor(0.40, 0).setDepth(FAR_DEPTH);
    }
    // Fog haze band
    this.add.rectangle(STAGE_WIDTH / 2, horizonY + 80, STAGE_WIDTH + 800, 70, 0x9a8a86, 0.32)
      .setScrollFactor(0.42, 0).setDepth(FAR_DEPTH + 1);
    // Far tree silhouettes (skipped for stage 0 — replaced by pine forest)
    if (this.stageIndex !== 0) {
    const farKeys = [TextureKeys.ENV_TREE_FAR_A, TextureKeys.ENV_TREE_FAR_B, TextureKeys.ENV_TREE_FAR_C];
    for (let i = 0; i < 22; i++) {
      const tx = -200 + i * 80 + Phaser.Math.Between(-20, 20);
      this.add.image(tx, horizonY + 30 + Phaser.Math.Between(-6, 8), farKeys[i % farKeys.length])
        .setScrollFactor(0.42, 0).setDepth(FAR_DEPTH + 2)
        .setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(0.7, 1.0)).setAlpha(0.78);
    }
    } // end if stageIndex !== 0

    // ===== LAYER 3: MID RUINS + TREES (parallax 0.70) =====
    const midKeys = [TextureKeys.ENV_TREE_MID_A, TextureKeys.ENV_TREE_MID_B, TextureKeys.ENV_TREE_MID_C, TextureKeys.ENV_TREE_MID_D];
    const midY = 480;
    // Ruins (sparse structural shapes — skip for forest entrance)
    if (this.stageIndex !== 0) {
    this.add.image(380, midY, TextureKeys.ENV_RUIN_PILLAR).setScrollFactor(0.70, 0).setDepth(MID_DEPTH).setOrigin(0.5, 1).setAlpha(0.88);
    this.add.image(1100, midY + 8, TextureKeys.ENV_RUIN_WALL).setScrollFactor(0.70, 0).setDepth(MID_DEPTH).setOrigin(0.5, 1).setAlpha(0.85);
    this.add.image(1900, midY, TextureKeys.ENV_RUIN_ARCH).setScrollFactor(0.70, 0).setDepth(MID_DEPTH).setOrigin(0.5, 1).setAlpha(0.85);
    this.add.image(2600, midY - 4, TextureKeys.ENV_RUIN_PILLAR).setScrollFactor(0.70, 0).setDepth(MID_DEPTH).setOrigin(0.5, 1).setAlpha(0.85);
    } // end ruins skip
    // Mid trees (skip for forest entrance)
    if (this.stageIndex !== 0) {
    for (let i = 0; i < 18; i++) {
      const tx = -100 + i * 110 + Phaser.Math.Between(-30, 30);
      this.add.image(tx, midY + Phaser.Math.Between(-8, 8), midKeys[i % midKeys.length])
        .setScrollFactor(0.70, 0).setDepth(MID_DEPTH + 5)
        .setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(0.85, 1.15)).setAlpha(0.92);
    }
    }

    // ===== LAYER 4: PLAY LAYER (ground + props, parallax 1.00) =====
    // The play layer is staged like an illustrated battlefield, not evenly
    // distributed props on a strip. Props are placed in CLUSTERS at authored
    // "staging points" that create visual rhythm across the stage.

    // Shared arrays used across subsections
    const grassKeys = [TextureKeys.ENV_GRASS_A, TextureKeys.ENV_GRASS_B, TextureKeys.ENV_GRASS_DEAD];

    // ----- 4a. Ground base — material-aware terrain surface -----
    // The ground is NOT a flat strip. It's built in layers of clustered
    // material detail so it reads as soil/terrain rather than a painted band.
    const groundG = this.add.graphics().setDepth(PLAY_DEPTH - 5);
    const GY0 = GROUND_MIN_Y;
    const GY1 = GROUND_MAX_Y;
    const GH = GY1 - GY0;

    // Base fill — extends 14 px PAST GROUND_MAX_Y to overlap with the
    // foreground dirt layer and prevent a visible seam between them.
    groundG.fillStyle(0x6b5638, 1);
    groundG.fillRect(0, GY0, STAGE_WIDTH, GH + 14);

    // ----- HORIZONTAL COLOR DRIFT -----
    // Wide semi-transparent patches that shift the ground tone from left to
    // right so it's not one uniform brown. Creates the "painted background"
    // feel of color zones across the terrain.
    const driftColors = [0x7a6848, 0x5a4428, 0x6a5a3a, 0x786040, 0x4a3820];
    for (let i = 0; i < 18; i++) {
      const dx = Phaser.Math.Between(-40, STAGE_WIDTH);
      const dw = 120 + Phaser.Math.Between(0, 240);
      const dc = driftColors[Phaser.Math.Between(0, driftColors.length - 1)];
      groundG.fillStyle(dc, 0.18 + Math.random() * 0.12);
      groundG.fillRect(dx, GY0, dw, GH);
    }

    // ----- DARKER SOIL ISLANDS -----
    // Irregular polygon patches of darker earth scattered across the lane.
    // Clustered — placed in groups of 2-3 near each other, not evenly spaced.
    for (let cluster = 0; cluster < 10; cluster++) {
      const clusterX = Phaser.Math.Between(20, STAGE_WIDTH - 20);
      const clusterY = Phaser.Math.Between(GY0 + 6, GY1 - 6);
      const clusterCount = 1 + Phaser.Math.Between(0, 2);
      for (let i = 0; i < clusterCount; i++) {
        const sx = clusterX + Phaser.Math.Between(-30, 30);
        const sy = clusterY + Phaser.Math.Between(-6, 6);
        const sides = 6 + Phaser.Math.Between(0, 3);
        const rx = 8 + Math.random() * 18;
        const ry = 3 + Math.random() * 6;
        groundG.fillStyle(0x4a3822, 0.30 + Math.random() * 0.15);
        groundG.beginPath();
        for (let j = 0; j < sides; j++) {
          const a = (j / sides) * Math.PI * 2;
          const w = 0.5 + Math.random() * 1.0;
          const px = sx + Math.cos(a) * rx * w;
          const py = sy + Math.sin(a) * ry * w;
          j === 0 ? groundG.moveTo(px, py) : groundG.lineTo(px, py);
        }
        groundG.closePath();
        groundG.fillPath();
      }
    }

    // ----- LIGHTER DUST PATCHES -----
    // Scattered warm-toned lighter blobs — read as dry dusty areas or
    // compacted path sections.
    for (let i = 0; i < 14; i++) {
      const dx = Phaser.Math.Between(10, STAGE_WIDTH - 10);
      const dy = Phaser.Math.Between(GY0 + 4, GY1 - 4);
      const sides = 7 + Phaser.Math.Between(0, 3);
      const rx = 6 + Math.random() * 14;
      const ry = 2 + Math.random() * 5;
      groundG.fillStyle(0x8a7854, 0.18 + Math.random() * 0.12);
      groundG.beginPath();
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        const w = 0.5 + Math.random() * 1.0;
        const px = dx + Math.cos(a) * rx * w;
        const py = dy + Math.sin(a) * ry * w;
        j === 0 ? groundG.moveTo(px, py) : groundG.lineTo(px, py);
      }
      groundG.closePath();
      groundG.fillPath();
    }

    // ----- SOIL FRACTURE CRACKS -----
    // Thin jagged multi-segment paths that read as dried soil fractures.
    // NOT straight strokes — each segment changes direction.
    for (let i = 0; i < 22; i++) {
      let px = Phaser.Math.Between(10, STAGE_WIDTH - 10);
      let py = Phaser.Math.Between(GY0 + 4, GY1 - 4);
      const segs = 2 + Phaser.Math.Between(0, 3);
      groundG.lineStyle(0.5 + Math.random() * 0.6, 0x3a2812, 0.30 + Math.random() * 0.18);
      groundG.beginPath();
      groundG.moveTo(px, py);
      for (let j = 0; j < segs; j++) {
        px += Phaser.Math.Between(-10, 10);
        py += Phaser.Math.Between(-3, 3);
        // Clamp inside the lane
        py = Math.max(GY0 + 2, Math.min(GY1 - 2, py));
        groundG.lineTo(px, py);
      }
      groundG.strokePath();
    }

    // ----- EMBEDDED PEBBLES (with shadow-side offset) -----
    // Small filled dots with a tiny darker dot offset to lower-right,
    // simulating a pebble catching light from the upper-left.
    for (let i = 0; i < 70; i++) {
      const px = Phaser.Math.Between(4, STAGE_WIDTH - 4);
      const py = Phaser.Math.Between(GY0 + 3, GY1 - 3);
      const r = 0.6 + Math.random() * 1.4;
      // Shadow offset (lower-right)
      groundG.fillStyle(0x2a1a08, 0.40 + Math.random() * 0.15);
      groundG.fillCircle(px + 0.6, py + 0.5, r);
      // Pebble body
      const pebbleColor = Math.random() > 0.6 ? 0x8a8890 : 0x787068;
      groundG.fillStyle(pebbleColor, 0.50 + Math.random() * 0.25);
      groundG.fillCircle(px, py, r);
      // Highlight dot (upper-left, only on bigger pebbles)
      if (r > 1.0) {
        groundG.fillStyle(0xc8c0b4, 0.45);
        groundG.fillCircle(px - r * 0.3, py - r * 0.3, r * 0.35);
      }
    }

    // ----- TOP AND BOTTOM EDGE TREATMENT -----
    // Top: slightly brighter highlight band with an irregular wavy edge
    groundG.fillStyle(0x8a7048, 0.40);
    groundG.fillRect(0, GY0, STAGE_WIDTH, 5);
    // Wavy organic top edge — drawn as a filled jagged strip
    groundG.fillStyle(0x9a8050, 0.50);
    groundG.beginPath();
    groundG.moveTo(0, GY0);
    for (let x = 0; x <= STAGE_WIDTH; x += 14) {
      groundG.lineTo(x, GY0 + Phaser.Math.Between(-1, 3));
    }
    groundG.lineTo(STAGE_WIDTH, GY0 + 4);
    groundG.lineTo(0, GY0 + 4);
    groundG.closePath();
    groundG.fillPath();
    // Bottom: shadow band (darker)
    groundG.fillStyle(0x342414, 0.45);
    groundG.fillRect(0, GY1 - 7, STAGE_WIDTH, 7);

    // ----- 4b. Ground shadow patches (darker zones beneath tree positions) -----
    // These go down FIRST so they sit under everything else.
    const treeXs: number[] = [];
    {
      let cur = -60;
      while (cur < STAGE_WIDTH + 60) {
        treeXs.push(cur + Phaser.Math.Between(-20, 20));
        cur += Phaser.Math.Between(110, 180);
      }
    }
    if (this.stageIndex !== 0) { // skip shadow patches, mounds, ground patches for forest entrance
    for (const tx of treeXs) {
      // Shadow patch centered below where each tree stands
      this.add.image(tx, GROUND_MIN_Y + 6, TextureKeys.ENV_SHADOW_PATCH)
        .setDepth(PLAY_DEPTH - 4).setOrigin(0.5, 0)
        .setScale(Phaser.Math.FloatBetween(1.0, 1.6), Phaser.Math.FloatBetween(0.8, 1.2))
        .setAlpha(0.65);
    }
    // Extra random shadow patches between trees (fallen structure shadows, etc.)
    for (let i = 0; i < 14; i++) {
      const sx = Phaser.Math.Between(60, STAGE_WIDTH - 60);
      const sy = Phaser.Math.Between(GROUND_MIN_Y + 10, GROUND_MAX_Y - 10);
      this.add.image(sx, sy, TextureKeys.ENV_SHADOW_PATCH)
        .setDepth(PLAY_DEPTH - 4).setScale(Phaser.Math.FloatBetween(0.6, 1.3))
        .setAlpha(Phaser.Math.FloatBetween(0.35, 0.55))
        .setFlipX(Math.random() > 0.5);
    }

    // ----- 4c. Terrain elevation mounds (break up the flat ground) -----
    for (let i = 0; i < 10; i++) {
      const mx = Phaser.Math.Between(40, STAGE_WIDTH - 40);
      const my = Phaser.Math.Between(GROUND_MIN_Y + 10, GROUND_MAX_Y - 4);
      this.add.image(mx, my, TextureKeys.ENV_MOUND)
        .setDepth(my - 16).setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.8, 1.4))
        .setFlipX(Math.random() > 0.5);
    }

    // ----- 4d. Painted ground patches -----
    const patchKeys = [TextureKeys.ENV_GROUND_PATCH_A, TextureKeys.ENV_GROUND_PATCH_B, TextureKeys.ENV_GROUND_PATCH_C];
    for (let i = 0; i < 36; i++) {
      const px = 30 + Math.random() * (STAGE_WIDTH - 60);
      const py = Phaser.Math.Between(GROUND_MIN_Y + 8, GROUND_MAX_Y - 8);
      this.add.image(px, py, patchKeys[i % patchKeys.length])
        .setDepth(PLAY_DEPTH - 3).setScale(Phaser.Math.FloatBetween(0.7, 1.3))
        .setAlpha(0.92).setFlipX(Math.random() > 0.5);
    }
    } // end shadow/mound/patch skip for stage 0

    // ----- 4e. Near tree row (at the back of the lane) — skip for forest entrance -----
    if (this.stageIndex !== 0) {
    const nearKeys = [TextureKeys.ENV_TREE_NEAR_A, TextureKeys.ENV_TREE_NEAR_B, TextureKeys.ENV_TREE_NEAR_C, TextureKeys.ENV_TREE_NEAR_D, TextureKeys.ENV_TREE_NEAR_E];
    for (const tx of treeXs) {
      const ty = GROUND_MIN_Y + Phaser.Math.Between(-2, 8);
      this.add.image(tx, ty, nearKeys[Phaser.Math.Between(0, nearKeys.length - 1)])
        .setDepth(ty - 30).setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.95, 1.15))
        .setFlipX(Math.random() > 0.5);
    }
    } // end near trees skip

    // ----- 4f. CLUSTERED PROP GROUPS -----
    // Instead of evenly distributed props, place them in authored "staging
    // clusters" at regular intervals. Skip for forest entrance — pines replace props.
    if (this.stageIndex === 0) { /* no prop clusters for forest */ } else {
    const clusterSpacing = STAGE_WIDTH / 8;
    for (let ci = 0; ci < 8; ci++) {
      const clusterX = clusterSpacing * (ci + 0.5) + Phaser.Math.Between(-40, 40);
      const clusterY = GROUND_MIN_Y + Phaser.Math.Between(6, 30);
      const itemCount = 3 + Phaser.Math.Between(0, 3);

      // Rock anchor
      const rockKeys = [TextureKeys.ENV_ROCK_A, TextureKeys.ENV_ROCK_B, TextureKeys.ENV_ROCK_C, TextureKeys.ENV_ROCK_D];
      this.add.image(clusterX, clusterY, rockKeys[Phaser.Math.Between(0, rockKeys.length - 1)])
        .setDepth(clusterY - 20).setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.9, 1.3));

      // Surrounding items spread within 50-80px radius
      const clusterItems = [
        TextureKeys.ENV_ROCK_SMALL, TextureKeys.ENV_FENCE_BROKEN,
        TextureKeys.ENV_DEBRIS_A, TextureKeys.ENV_DEBRIS_B,
        TextureKeys.ENV_PLANK, TextureKeys.ENV_LOG_A, TextureKeys.ENV_LOG_B,
        TextureKeys.ENV_BUSH,
      ];
      for (let j = 0; j < itemCount; j++) {
        const offX = Phaser.Math.Between(-55, 55);
        const offY = Phaser.Math.Between(-4, 14);
        const iy = clusterY + offY;
        const key = clusterItems[Phaser.Math.Between(0, clusterItems.length - 1)];
        const prop = this.add.image(clusterX + offX, iy, key)
          .setDepth(iy - 20).setOrigin(0.5, 1)
          .setScale(Phaser.Math.FloatBetween(0.8, 1.2))
          .setFlipX(Math.random() > 0.5);
        // Angled debris gets a slight rotation
        if (key === TextureKeys.ENV_DEBRIS_A || key === TextureKeys.ENV_DEBRIS_B) {
          prop.setRotation(Phaser.Math.FloatBetween(-0.15, 0.15));
        }
      }

      // GRASS GROUP around each cluster (3-5 tufts close together)
      const grassKeys = [TextureKeys.ENV_GRASS_A, TextureKeys.ENV_GRASS_B, TextureKeys.ENV_GRASS_DEAD];
      const grassCount = 3 + Phaser.Math.Between(0, 2);
      for (let g = 0; g < grassCount; g++) {
        const gx = clusterX + Phaser.Math.Between(-40, 40);
        const gy = clusterY + Phaser.Math.Between(-2, 8);
        this.add.image(gx, gy, grassKeys[Phaser.Math.Between(0, grassKeys.length - 1)])
          .setDepth(gy - 18).setOrigin(0.5, 1)
          .setScale(Phaser.Math.FloatBetween(0.8, 1.3))
          .setFlipX(Math.random() > 0.5);
      }
    }

    // ----- 4g. Broken fence segments crossing the lane -----
    // 3-5 fence rails placed at angle across the walking lane at varied X
    // positions. These read as "something was here" structural storytelling.
    for (let i = 0; i < 4; i++) {
      const fx = Phaser.Math.Between(200, STAGE_WIDTH - 200);
      const fy = Phaser.Math.Between(GROUND_MIN_Y + 8, GROUND_MAX_Y - 10);
      const rail = this.add.image(fx, fy, TextureKeys.ENV_FENCE_RAIL)
        .setDepth(fy - 19).setOrigin(0.5, 0.5)
        .setRotation(Phaser.Math.FloatBetween(-0.12, 0.12))
        .setScale(Phaser.Math.FloatBetween(0.9, 1.2));
      void rail;
      // A fence post at one end
      const postX = fx + Phaser.Math.Between(-40, -30);
      const postY = fy + Phaser.Math.Between(-2, 4);
      this.add.image(postX, postY, Phaser.Math.Between(0, 1) === 0 ? TextureKeys.ENV_FENCE_POST : TextureKeys.ENV_FENCE_LEAN)
        .setDepth(postY - 20).setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.85, 1.05));
    }

    // ----- 4h. Scattered individual grass (NOT evenly spaced — biased near edges + clusters) -----
    // Lane-edge grass (top and bottom of the lane)
    for (let i = 0; i < 40; i++) {
      const gx = 8 + Math.random() * (STAGE_WIDTH - 16);
      const edge = Math.random() > 0.5;
      const gy = edge
        ? GROUND_MIN_Y + Phaser.Math.Between(0, 8)
        : GROUND_MAX_Y - Phaser.Math.Between(0, 6);
      const key = grassKeys[Phaser.Math.Between(0, grassKeys.length - 1)];
      this.add.image(gx, gy, key).setDepth(gy - 18).setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.6, 1.1)).setFlipX(Math.random() > 0.5);
    }

    // ----- 4i. Angled debris scattered along the lane (individual, not clustered) -----
    for (let i = 0; i < 6; i++) {
      const dx = Phaser.Math.Between(80, STAGE_WIDTH - 80);
      const dy = Phaser.Math.Between(GROUND_MIN_Y + 10, GROUND_MAX_Y - 8);
      const key = Phaser.Math.Between(0, 1) === 0 ? TextureKeys.ENV_DEBRIS_A : TextureKeys.ENV_DEBRIS_B;
      this.add.image(dx, dy, key)
        .setDepth(dy - 19).setOrigin(0.5, 1)
        .setRotation(Phaser.Math.FloatBetween(-0.25, 0.25))
        .setScale(Phaser.Math.FloatBetween(0.8, 1.15))
        .setFlipX(Math.random() > 0.5);
    }
    } // end prop/fence/grass/debris skip for stage 0

    // ===== LAYER 5: FOREGROUND (parallax 0.95, depth above hero) =====
    // Big foreground dirt mass — starts 4 px ABOVE GROUND_MAX_Y to overlap
    // with the ground band and eliminate the visible seam.
    const fgGround = this.add.graphics().setDepth(FG_DEPTH - 5);
    fgGround.fillStyle(0x2a1a08, 1);
    fgGround.fillRect(0, GROUND_MAX_Y - 4, STAGE_WIDTH, 332);
    // Transition band — a mid-tone strip that bridges the ground brown and
    // the dark dirt brown so there's no abrupt color cut.
    fgGround.fillStyle(0x4a3418, 0.80);
    fgGround.fillRect(0, GROUND_MAX_Y - 4, STAGE_WIDTH, 10);
    fgGround.fillStyle(0x3a2410, 0.60);
    fgGround.fillRect(0, GROUND_MAX_Y + 4, STAGE_WIDTH, 8);
    for (let i = 0; i < 36; i++) {
      const fx = Phaser.Math.Between(0, STAGE_WIDTH);
      const fy = Phaser.Math.Between(GROUND_MAX_Y + 12, GROUND_MAX_Y + 80);
      const fpts = paint.blobPath(fx, fy, Phaser.Math.Between(14, 30), Phaser.Math.Between(6, 14), {
        sides: 9, jitter: 0.45, seed: i * 79 + 1,
      });
      fgGround.fillStyle(0x140a04, 0.55);
      fgGround.fillPoints(fpts, true);
    }

    // ----- 5a. Foreground branch silhouettes — REMOVED -----
    // The branch silhouette textures (ENV_BRANCH_A/B/C) contained thin dark
    // limb strokes + sub-branch twigs + bark marks that read as accidental
    // scribble marks when tinted dark and placed over the scene. Removed
    // entirely. If foreground framing is re-added later, it should use bold
    // solid silhouette masses (like the tree canopies), not line-art branches.

    // ----- 5b. Foreground silhouette grass (dark tinted, with sway) -----
    for (let i = 0; i < 30; i++) {
      const fx = Phaser.Math.Between(0, STAGE_WIDTH);
      const fy = GROUND_MAX_Y + Phaser.Math.Between(2, 24);
      const tuft = this.add.image(fx, fy, grassKeys[Phaser.Math.Between(0, grassKeys.length - 1)])
        .setScrollFactor(0.95, 1).setDepth(FG_DEPTH)
        .setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(1.0, 1.8))
        .setTint(0x1a1208).setFlipX(Math.random() > 0.5);
      this.tweens.add({
        targets: tuft,
        rotation: Phaser.Math.FloatBetween(-0.05, 0.05),
        duration: Phaser.Math.Between(1600, 2600),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ----- 5c. Foreground rock silhouettes -----
    for (let i = 0; i < 12; i++) {
      this.add.image(Phaser.Math.Between(0, STAGE_WIDTH), GROUND_MAX_Y + Phaser.Math.Between(8, 30), TextureKeys.ENV_ROCK_SMALL)
        .setScrollFactor(0.95, 1).setDepth(FG_DEPTH)
        .setOrigin(0.5, 1).setTint(0x1a1a22)
        .setScale(Phaser.Math.FloatBetween(0.8, 1.5));
    }
  }


  // ===== FOREST ENTRANCE OVERLAY (Stage 1) =====
  // Inspired by Castle Crashers forest style:
  //   - Dark teal atmospheric background
  //   - Thick tree trunks as vertical columns
  //   - Dense leaf canopy across the top
  //   - Bright green grass walking surface
  //   - Foreground bushes framing the bottom
  //   - Small terrain features (ledges, mounds)
  // All drawn natively with Phaser Graphics — no PNG assets.
  // Each section is a separate method for easy editing.

  // ===================================================================
  // SEGMENT SYSTEM — breaks the 8000px stage into varied visual zones
  // ===================================================================
  private forestSegments: {
    startX: number; endX: number;
    density: number;       // 0=sparse, 1=overgrown
    canopy: number;        // 0=open sky, 1=thick canopy
    trunkCount: number;    // 0-4 near trunks in this zone
    trunkWidth: [number, number]; // min/max trunk width
    propMix: number;       // 0=rocks/sticks, 1=flowers/mushrooms
    foreground: number;    // 0=none, 1=heavy
    mood: number;          // 0=shadow, 0.5=neutral, 1=lightShaft
  }[] = [];

  private generateForestSegments(): void {
    this.forestSegments = [];
    let x = 0;
    const templates = [
      { density: 0.9, canopy: 0.9, trunkCount: 3, trunkWidth: [50, 70] as [number, number], propMix: 0.8, foreground: 0.8, mood: 0 },     // dense thicket
      { density: 0.15, canopy: 0.15, trunkCount: 0, trunkWidth: [40, 55] as [number, number], propMix: 0.9, foreground: 0.1, mood: 1 },    // open clearing
      { density: 0.5, canopy: 0.5, trunkCount: 2, trunkWidth: [45, 65] as [number, number], propMix: 0.2, foreground: 0.4, mood: 0.5 },   // rocky patch
      { density: 0.3, canopy: 0.25, trunkCount: 1, trunkWidth: [40, 55] as [number, number], propMix: 1.0, foreground: 0.2, mood: 0.9 },  // flower meadow
      { density: 0.7, canopy: 0.8, trunkCount: 3, trunkWidth: [48, 68] as [number, number], propMix: 0.5, foreground: 0.7, mood: 0.15 },  // twisted roots
      { density: 0.55, canopy: 0.6, trunkCount: 2, trunkWidth: [42, 62] as [number, number], propMix: 0.5, foreground: 0.4, mood: 0.5 },  // standard forest
    ];
    // Shuffle-ish: avoid repeating same template consecutively
    let lastIdx = -1;
    while (x < STAGE_WIDTH) {
      let idx = Phaser.Math.Between(0, templates.length - 1);
      if (idx === lastIdx) idx = (idx + 1) % templates.length;
      lastIdx = idx;
      const t = templates[idx];
      const segW = Phaser.Math.Between(450, 750);
      const jitter = (v: number) => Phaser.Math.Clamp(v + Phaser.Math.FloatBetween(-0.12, 0.12), 0, 1);
      this.forestSegments.push({
        startX: x, endX: Math.min(x + segW, STAGE_WIDTH),
        density: jitter(t.density),
        canopy: jitter(t.canopy),
        trunkCount: Math.max(0, t.trunkCount + Phaser.Math.Between(-1, 1)),
        trunkWidth: t.trunkWidth,
        propMix: jitter(t.propMix),
        foreground: jitter(t.foreground),
        mood: jitter(t.mood),
      });
      x += segW;
    }
  }

  /** Get the segment config at a given world X, with blend factor toward next segment. */
  private getSegment(worldX: number): { seg: ForestStage['forestSegments'][0]; blend: number; nextSeg?: ForestStage['forestSegments'][0] } {
    for (let i = 0; i < this.forestSegments.length; i++) {
      const s = this.forestSegments[i];
      if (worldX >= s.startX && worldX < s.endX) {
        const BLEND = 70;
        const distFromEnd = s.endX - worldX;
        if (distFromEnd < BLEND && i < this.forestSegments.length - 1) {
          return { seg: s, blend: 1 - distFromEnd / BLEND, nextSeg: this.forestSegments[i + 1] };
        }
        return { seg: s, blend: 0 };
      }
    }
    return { seg: this.forestSegments[this.forestSegments.length - 1], blend: 0 };
  }

  private lerpSeg(a: number, b: number, t: number): number { return a + (b - a) * t; }

  /** Stage 1 painted forest map — same approach as Stage 2. */
  private buildStage1Map(): void {
    const TILES = 10;
    const TILE_W = 1024;
    const IMG_W = 9960;
    const IMG_H = 830;

    let needsLoad = false;
    for (let t = 0; t < TILES; t++) {
      const key = `stage1-full-${t}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, `assets/Maps/stage1-forest/full-${t}.png`);
        needsLoad = true;
      }
    }

    const place = () => {
      for (let t = 0; t < TILES; t++) {
        const key = `stage1-full-${t}`;
        if (!this.textures.exists(key)) continue;
        const tile = this.add.image(t * TILE_W, 0, key)
          .setOrigin(0, 0)
          .setDepth(-100)
          .setScrollFactor(1, 1);
        tile.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }

      // Camera bounds set in main create() via mapSizes lookup
      this.cameras.main.setBounds(0, 0, IMG_W, IMG_H);
    };

    if (needsLoad) {
      this.load.once('complete', place);
      this.load.start();
    } else {
      place();
    }
  }

  private buildForestEntranceOverlay(): void {
    const WAY = this.walkingAreaY;
    const SW = STAGE_WIDTH;

    // Generate segment configs
    this.generateForestSegments();

    // =================================================================
    // 1. SKY — dark blue-teal background in WORLD coordinates
    //    Covers the entire stage width and the sky area above walkingAreaY.
    //    NOT screen-fixed — it scrolls with the world like everything else.
    // =================================================================
    const sky = this.add.graphics().setDepth(-200);
    sky.fillStyle(0x0c1820, 1);
    sky.fillRect(-200, -200, SW + 400, WAY + 400);

    // =================================================================
    // DEEP FOREST SILHOUETTE LAYERS — atmospheric depth behind everything
    // 3 new tiers from farthest (softest) to mid-far (more defined).
    // Each tier has a slightly different value/parallax to separate visually.
    // =================================================================
    this.drawDeepForestSilhouettes(WAY, SW);

    // =================================================================
    // LEAF CLUSTER HELPERS — no circles/ellipses, only polygons
    // =================================================================

    /** Shift a color's green channel slightly for saturation variation. */
    const varyGreen = (color: number): number => {
      const r = (color >> 16) & 0xff;
      let gr = (color >> 8) & 0xff;
      const b = color & 0xff;
      gr = Math.max(0, Math.min(255, gr + Phaser.Math.Between(-12, 12)));
      return (r << 16) | (gr << 8) | b;
    };

    /** Draw a single leaf-mass silhouette with interior texture + edge noise. */
    const drawLeafMass = (g: Phaser.GameObjects.Graphics, cx: number, cy: number,
      w: number, h: number, color: number, alpha: number = 1) => {
      // Vary saturation per cluster
      const variedColor = varyGreen(color);
      // Build noisy edge polygon
      const pts = 10 + Phaser.Math.Between(0, 5);
      const edgeNoise = Math.max(1, Math.min(w, h) * 0.08); // leaf-edge noise amount
      g.fillStyle(variedColor, alpha);
      g.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const baseRx = w * 0.5 * (0.7 + Phaser.Math.FloatBetween(0, 0.3));
        const baseRy = h * 0.5 * (0.7 + Phaser.Math.FloatBetween(0, 0.3));
        // Add small jagged noise to each point
        const nx = Phaser.Math.FloatBetween(-edgeNoise, edgeNoise);
        const ny = Phaser.Math.FloatBetween(-edgeNoise, edgeNoise);
        const px = cx + Math.cos(a) * baseRx + nx;
        const py = cy + Math.sin(a) * baseRy + ny;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();

      // Interior texture — small darker patches to break uniform fill
      const patchCount = Math.max(1, Math.floor((w * h) / 400));
      for (let p = 0; p < patchCount; p++) {
        const pa = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const pd = Phaser.Math.FloatBetween(0, 0.3);
        const ppx = cx + Math.cos(pa) * w * pd;
        const ppy = cy + Math.sin(pa) * h * pd;
        const pw = w * Phaser.Math.FloatBetween(0.08, 0.18);
        const ph = h * Phaser.Math.FloatBetween(0.06, 0.14);
        g.fillStyle(0x000000, 0.06);
        // Tiny irregular patch (3-4 points)
        g.beginPath();
        g.moveTo(ppx - pw, ppy);
        g.lineTo(ppx, ppy - ph);
        g.lineTo(ppx + pw, ppy + ph * 0.3);
        g.lineTo(ppx - pw * 0.5, ppy + ph);
        g.closePath();
        g.fillPath();
      }
    };

    /** Draw a layered canopy with shadow mass, highlight mass, texture, and ink outline. */
    const drawCanopy = (g: Phaser.GameObjects.Graphics, cx: number, cy: number,
      w: number, h: number, darkColor: number, midColor: number,
      lightColor: number, outlineColor: number, scale: number = 1) => {
      const sw = w * scale, sh = h * scale;

      // 1. Shadow mass under canopy bottom — darkest, slightly below center
      for (let i = 0; i < Phaser.Math.Between(2, 3); i++) {
        drawLeafMass(g, cx + Phaser.Math.FloatBetween(-sw * 0.12, sw * 0.12),
          cy + sh * 0.15 + Phaser.Math.FloatBetween(0, sh * 0.1),
          sw * Phaser.Math.FloatBetween(0.4, 0.65), sh * Phaser.Math.FloatBetween(0.25, 0.4),
          varyGreen(darkColor), 0.85);
      }

      // 2. Dark interior mass (core fill)
      for (let i = 0; i < Phaser.Math.Between(3, 5); i++) {
        drawLeafMass(g, cx + Phaser.Math.FloatBetween(-sw * 0.15, sw * 0.15),
          cy + Phaser.Math.FloatBetween(-sh * 0.08, sh * 0.12),
          sw * Phaser.Math.FloatBetween(0.45, 0.75), sh * Phaser.Math.FloatBetween(0.45, 0.65),
          varyGreen(darkColor));
      }

      // 3. Mid-tone layer — slightly brighter, offset upward
      for (let i = 0; i < Phaser.Math.Between(2, 4); i++) {
        drawLeafMass(g, cx + Phaser.Math.FloatBetween(-sw * 0.2, sw * 0.2),
          cy + Phaser.Math.FloatBetween(-sh * 0.18, sh * 0.05),
          sw * Phaser.Math.FloatBetween(0.3, 0.55), sh * Phaser.Math.FloatBetween(0.3, 0.5),
          varyGreen(midColor));
      }

      // 4. Highlight mass near canopy top — lightest, smallest
      for (let i = 0; i < Phaser.Math.Between(1, 3); i++) {
        drawLeafMass(g, cx + Phaser.Math.FloatBetween(-sw * 0.12, sw * 0.12),
          cy - sh * 0.18 + Phaser.Math.FloatBetween(-sh * 0.08, 0),
          sw * Phaser.Math.FloatBetween(0.18, 0.35), sh * Phaser.Math.FloatBetween(0.15, 0.3),
          varyGreen(lightColor));
      }

      // 5. Ink outline with noisy edge
      g.lineStyle(1.5 * scale, outlineColor, 0.45);
      g.beginPath();
      const outPts = 14;
      const outNoise = sw * 0.04;
      for (let i = 0; i <= outPts; i++) {
        const a = (i / outPts) * Math.PI * 2;
        const rx = sw * 0.5 * (0.72 + Phaser.Math.FloatBetween(0, 0.3));
        const ry = sh * 0.5 * (0.68 + Phaser.Math.FloatBetween(0, 0.3));
        const nx = Phaser.Math.FloatBetween(-outNoise, outNoise);
        const ny = Phaser.Math.FloatBetween(-outNoise, outNoise);
        const px = cx + Math.cos(a) * rx + nx;
        const py = cy + Math.sin(a) * ry + ny;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
    };

    /** Draw a full tree with wobbly trunk + layered canopy (no circles). */

    // Helper: draw an irregular trunk polygon with ink outline
    const drawTrunk = (g: Phaser.GameObjects.Graphics, x: number, w: number, top: number, bot: number,
      fill: number, outline: number, lightEdge: number) => {
      // Build wobbly left/right edges
      const pts: { x: number; y: number }[] = [];
      const steps = 12;
      const jitter = w * 0.06;
      // Left edge (top to bottom)
      for (let s = 0; s <= steps; s++) {
        const sy = top + (bot - top) * (s / steps);
        const flare = s === steps ? w * 0.15 : 0; // root flare at base
        pts.push({ x: x - w / 2 - flare + Phaser.Math.FloatBetween(-jitter, jitter), y: sy });
      }
      // Right edge (bottom to top)
      for (let s = steps; s >= 0; s--) {
        const sy = top + (bot - top) * (s / steps);
        const flare = s === steps ? w * 0.15 : 0;
        pts.push({ x: x + w / 2 + flare + Phaser.Math.FloatBetween(-jitter, jitter), y: sy });
      }
      // Fill
      g.fillStyle(fill, 1);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) g.lineTo(pts[p].x, pts[p].y);
      g.closePath();
      g.fillPath();

      // ---- GRITTY SURFACE NOISE ----
      const trunkArea = w * (bot - top);
      const trunkH = bot - top;
      const trunkLeft = x - w / 2;
      const trunkRight = x + w / 2;

      // Dense dark grain specks
      const speckCount = Math.max(8, Math.floor(trunkArea / 70));
      for (let sp = 0; sp < speckCount; sp++) {
        const spx = x + Phaser.Math.FloatBetween(-w * 0.42, w * 0.42);
        const spy = top + Phaser.Math.FloatBetween(0, bot - top);
        const spSize = Phaser.Math.FloatBetween(0.5, 2.5);
        g.fillStyle(0x000000, Phaser.Math.FloatBetween(0.06, 0.18));
        g.fillRect(spx, spy, spSize, spSize);
      }
      // Lighter grain specks
      for (let sp = 0; sp < Math.floor(speckCount * 0.4); sp++) {
        const spx = x + Phaser.Math.FloatBetween(-w * 0.35, w * 0.35);
        const spy = top + Phaser.Math.FloatBetween(0, bot - top);
        g.fillStyle(lightEdge, Phaser.Math.FloatBetween(0.05, 0.14));
        g.fillRect(spx, spy, Phaser.Math.FloatBetween(0.5, 2), Phaser.Math.FloatBetween(0.5, 2));
      }

      // Vertical bark streaks — more of them, thicker
      const streakCount = Phaser.Math.Between(4, Math.max(5, Math.floor(w / 4)));
      for (let st = 0; st < streakCount; st++) {
        const sx = x + Phaser.Math.FloatBetween(-w * 0.42, w * 0.42);
        g.lineStyle(Phaser.Math.FloatBetween(0.5, 1.8), 0x000000, Phaser.Math.FloatBetween(0.08, 0.2));
        g.beginPath();
        let sy = top + Phaser.Math.Between(5, 25);
        g.moveTo(sx, sy);
        const segCount = Phaser.Math.Between(5, 12);
        for (let seg = 0; seg < segCount; seg++) {
          sy += Phaser.Math.Between(8, 25);
          if (sy > bot - 5) break;
          g.lineTo(sx + Phaser.Math.FloatBetween(-2, 2), sy);
        }
        g.strokePath();
      }

      // Bark scale plates — short horizontal cracks creating a plated look
      const scaleRows = Math.max(3, Math.floor(trunkH / 40));
      for (let row = 0; row < scaleRows; row++) {
        const ry = top + trunkH * (row + Phaser.Math.FloatBetween(0.05, 0.95)) / scaleRows;
        const crackCount = Phaser.Math.Between(1, 3);
        for (let c = 0; c < crackCount; c++) {
          const cx = x + Phaser.Math.FloatBetween(-w * 0.35, w * 0.35);
          const cLen = Phaser.Math.FloatBetween(w * 0.15, w * 0.4);
          g.lineStyle(Phaser.Math.FloatBetween(0.4, 1.0), 0x000000, Phaser.Math.FloatBetween(0.1, 0.22));
          g.lineBetween(cx - cLen / 2, ry + Phaser.Math.FloatBetween(-1, 1),
            cx + cLen / 2, ry + Phaser.Math.FloatBetween(-1, 1));
        }
      }

      // Mottled dark patches — more and bigger
      const patchCount = Phaser.Math.Between(2, 5);
      for (let pa = 0; pa < patchCount; pa++) {
        const px = x + Phaser.Math.FloatBetween(-w * 0.35, w * 0.35);
        const py = top + (bot - top) * Phaser.Math.FloatBetween(0.05, 0.95);
        const pw = Phaser.Math.Between(4, Math.max(5, Math.floor(w * 0.3)));
        const ph = Phaser.Math.Between(6, Math.max(8, Math.floor(trunkH * 0.08)));
        g.fillStyle(0x000000, Phaser.Math.FloatBetween(0.05, 0.13));
        g.beginPath();
        const pPts = 6;
        for (let p = 0; p <= pPts; p++) {
          const a = (p / pPts) * Math.PI * 2;
          g.lineTo(px + Math.cos(a) * pw * (0.5 + Math.random() * 0.5),
            py + Math.sin(a) * ph * (0.5 + Math.random() * 0.5));
        }
        g.closePath();
        g.fillPath();
      }

      // Moss/lichen patches — faint green irregular blobs (0-2 per trunk)
      if (Math.random() < 0.6) {
        const mossCount = Phaser.Math.Between(1, 2);
        for (let m = 0; m < mossCount; m++) {
          const mx = x + Phaser.Math.FloatBetween(-w * 0.3, w * 0.3);
          const my = top + trunkH * Phaser.Math.FloatBetween(0.3, 0.85);
          const mw = Phaser.Math.Between(3, Math.max(4, Math.floor(w * 0.25)));
          const mh = Phaser.Math.Between(4, Math.max(5, Math.floor(trunkH * 0.06)));
          g.fillStyle(0x2a3a1a, Phaser.Math.FloatBetween(0.08, 0.18));
          g.beginPath();
          const mPts = 7;
          for (let p = 0; p <= mPts; p++) {
            const a = (p / mPts) * Math.PI * 2;
            g.lineTo(mx + Math.cos(a) * mw * (0.5 + Math.random() * 0.5),
              my + Math.sin(a) * mh * (0.5 + Math.random() * 0.5));
          }
          g.closePath();
          g.fillPath();
        }
      }

      // Shadow side — left edge darkening strip (broken, organic)
      const shadSegs = Phaser.Math.Between(4, 7);
      for (let ss = 0; ss < shadSegs; ss++) {
        const ssTop = top + trunkH * (ss / shadSegs) + Phaser.Math.FloatBetween(0, 10);
        const ssBot = top + trunkH * ((ss + 1) / shadSegs);
        if (Math.random() < 0.2) continue; // gaps
        g.fillStyle(0x000000, Phaser.Math.FloatBetween(0.04, 0.1));
        g.beginPath();
        g.moveTo(trunkLeft + Phaser.Math.FloatBetween(-1, 2), ssTop);
        g.lineTo(trunkLeft + Phaser.Math.FloatBetween(-1, 2), ssBot);
        g.lineTo(trunkLeft + w * Phaser.Math.FloatBetween(0.12, 0.22), ssBot);
        g.lineTo(trunkLeft + w * Phaser.Math.FloatBetween(0.1, 0.2), ssTop);
        g.closePath();
        g.fillPath();
      }

      // Ink outline
      g.lineStyle(2.5, outline, 0.7);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) g.lineTo(pts[p].x, pts[p].y);
      g.closePath();
      g.strokePath();

      // ---- BARK TEXTURE (post-outline, drawn on top) ----

      // Deep vertical bark grooves — prominent dark fissures
      const grooveCount = Phaser.Math.Between(3, Math.max(4, Math.floor(w / 6)));
      for (let gr = 0; gr < grooveCount; gr++) {
        const gx = trunkLeft + w * Phaser.Math.FloatBetween(0.1, 0.9);
        g.lineStyle(Phaser.Math.FloatBetween(0.8, 2.2), 0x000000, Phaser.Math.FloatBetween(0.1, 0.25));
        g.beginPath();
        let gy = top + Phaser.Math.Between(5, 20);
        g.moveTo(gx, gy);
        while (gy < bot - 10) {
          gy += Phaser.Math.Between(10, 25);
          g.lineTo(gx + Phaser.Math.FloatBetween(-2.5, 2.5), gy);
        }
        g.strokePath();
      }

      // Knots — dark irregular shapes (1-4 per trunk)
      const knotCount = Phaser.Math.Between(1, 4);
      for (let k = 0; k < knotCount; k++) {
        const kx = x + Phaser.Math.FloatBetween(-w * 0.3, w * 0.3);
        const ky = top + trunkH * Phaser.Math.FloatBetween(0.1, 0.85);
        const kw = Phaser.Math.Between(3, Math.max(4, Math.floor(w * 0.18)));
        const kh = Phaser.Math.Between(2, Math.max(3, Math.floor(w * 0.14)));
        g.fillStyle(0x000000, 0.2);
        const kPts = 7;
        g.beginPath();
        for (let p = 0; p <= kPts; p++) {
          const a = (p / kPts) * Math.PI * 2;
          g.lineTo(kx + Math.cos(a) * (kw + Phaser.Math.FloatBetween(-1.5, 1.5)),
            ky + Math.sin(a) * (kh + Phaser.Math.FloatBetween(-1, 1)));
        }
        g.closePath();
        g.fillPath();
        // Dark center
        g.fillStyle(0x000000, 0.15);
        g.beginPath();
        for (let p = 0; p <= 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.lineTo(kx + Math.cos(a) * kw * 0.45, ky + Math.sin(a) * kh * 0.45);
        }
        g.closePath();
        g.fillPath();
      }

      // Holes — dark spots (0-2 per trunk)
      const holeCount = Math.random() < 0.5 ? Phaser.Math.Between(1, 2) : 0;
      for (let h = 0; h < holeCount; h++) {
        const hx = x + Phaser.Math.FloatBetween(-w * 0.25, w * 0.2);
        const hy = top + trunkH * Phaser.Math.FloatBetween(0.15, 0.75);
        const hr = Phaser.Math.Between(2, Math.max(3, Math.floor(w * 0.1)));
        g.fillStyle(0x040604, 0.35);
        g.beginPath();
        for (let p = 0; p <= 6; p++) {
          const a = (p / 6) * Math.PI * 2;
          g.lineTo(hx + Math.cos(a) * (hr + Phaser.Math.FloatBetween(-1.5, 1.5)),
            hy + Math.sin(a) * (hr * 0.7 + Phaser.Math.FloatBetween(-0.5, 0.5)));
        }
        g.closePath();
        g.fillPath();
      }

      // Peeling bark flaps — thin lighter slivers with dark edge
      const peelCount = Phaser.Math.Between(0, 3);
      for (let pl = 0; pl < peelCount; pl++) {
        const px = x + Phaser.Math.FloatBetween(-w * 0.35, w * 0.35);
        const py = top + trunkH * Phaser.Math.FloatBetween(0.1, 0.85);
        const ph = Phaser.Math.Between(8, Math.max(10, Math.floor(trunkH * 0.1)));
        const pw = Phaser.Math.FloatBetween(1.5, 4);
        // Lighter bark underneath
        g.fillStyle(lightEdge, 0.15);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + pw + Phaser.Math.FloatBetween(-1, 1), py + ph * 0.3);
        g.lineTo(px + pw * 0.5, py + ph);
        g.lineTo(px - pw * 0.3, py + ph * 0.7);
        g.closePath();
        g.fillPath();
        // Dark edge line
        g.lineStyle(0.6, 0x000000, 0.18);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + pw, py + ph * 0.3);
        g.lineTo(px + pw * 0.5, py + ph);
        g.strokePath();
      }

      // Horizontal bark ridges — more frequent cross-grain
      const ridgeCount = Phaser.Math.Between(3, Math.max(4, Math.floor(trunkH / 30)));
      for (let r = 0; r < ridgeCount; r++) {
        const ry = top + trunkH * Phaser.Math.FloatBetween(0.05, 0.95);
        g.lineStyle(Phaser.Math.FloatBetween(0.5, 1.2), 0x000000, Phaser.Math.FloatBetween(0.06, 0.15));
        g.lineBetween(trunkLeft + 2, ry, trunkRight - 2, ry + Phaser.Math.FloatBetween(-2, 2));
      }
    };

    // Helper: draw branches forking off a trunk
    const drawBranches = (g: Phaser.GameObjects.Graphics, x: number, w: number,
      top: number, bot: number, color: number, outlineColor: number, count: number) => {
      const trunkH = bot - top;
      for (let b = 0; b < count; b++) {
        // Branch starts from the trunk between 15%-65% up from bottom
        const attachY = top + trunkH * Phaser.Math.FloatBetween(0.15, 0.65);
        const side = Math.random() < 0.5 ? -1 : 1;
        const attachX = x + side * w * 0.4;
        const branchLen = Phaser.Math.Between(20, Math.max(25, Math.floor(w * 2.5)));
        const branchAngle = side * Phaser.Math.FloatBetween(0.4, 1.1); // radians outward+up
        const endX = attachX + Math.cos(branchAngle) * branchLen * side;
        const endY = attachY - Math.abs(Math.sin(branchAngle)) * branchLen * 0.7;
        const midX = (attachX + endX) / 2 + Phaser.Math.FloatBetween(-5, 5);
        const midY = (attachY + endY) / 2 + Phaser.Math.FloatBetween(-8, -2);
        // Branch thickness tapers
        const baseThick = Phaser.Math.FloatBetween(w * 0.15, w * 0.3);
        // Fill
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(attachX, attachY - baseThick * 0.5);
        g.lineTo(midX + Phaser.Math.FloatBetween(-2, 2), midY - baseThick * 0.25);
        g.lineTo(endX, endY - 1);
        g.lineTo(endX, endY + 1);
        g.lineTo(midX + Phaser.Math.FloatBetween(-2, 2), midY + baseThick * 0.3);
        g.lineTo(attachX, attachY + baseThick * 0.5);
        g.closePath();
        g.fillPath();
        // Outline
        g.lineStyle(1.5, outlineColor, 0.5);
        g.beginPath();
        g.moveTo(attachX, attachY - baseThick * 0.5);
        g.lineTo(midX, midY - baseThick * 0.25);
        g.lineTo(endX, endY);
        g.strokePath();
        // Small sub-twig at end
        if (Math.random() < 0.7) {
          const twigLen = branchLen * 0.35;
          const twigAngle = branchAngle + Phaser.Math.FloatBetween(-0.4, 0.4);
          g.lineStyle(1, color, 0.8);
          g.beginPath();
          g.moveTo(endX, endY);
          g.lineTo(endX + Math.cos(twigAngle) * twigLen * side * 0.5,
            endY - Math.abs(Math.sin(twigAngle)) * twigLen * 0.6);
          g.strokePath();
        }
        // Another sub-twig from midpoint
        if (Math.random() < 0.5) {
          const twigLen = branchLen * 0.3;
          g.lineStyle(1, color, 0.7);
          g.beginPath();
          g.moveTo(midX, midY);
          g.lineTo(midX + side * Phaser.Math.Between(5, 12),
            midY - Phaser.Math.Between(8, 18));
          g.strokePath();
        }
      }
    };

    // Helper: draw roots at the base of a trunk going into the ground
    const drawRoots = (g: Phaser.GameObjects.Graphics, x: number, w: number,
      groundY: number, color: number, outlineColor: number) => {
      const rootCount = Phaser.Math.Between(2, 4);
      for (let r = 0; r < rootCount; r++) {
        const side = r % 2 === 0 ? -1 : 1;
        const rootStartX = x + side * w * Phaser.Math.FloatBetween(0.2, 0.45);
        const rootLen = Phaser.Math.Between(10, Math.max(12, Math.floor(w * 1.2)));
        const rootEndX = rootStartX + side * rootLen;
        const rootThick = Phaser.Math.FloatBetween(w * 0.08, w * 0.18);
        const dip = Phaser.Math.Between(3, 10); // how far root dips below ground
        const midX = (rootStartX + rootEndX) / 2;
        // Root shape — starts from trunk, arches slightly, goes into ground
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(rootStartX, groundY - rootThick);
        g.lineTo(midX + Phaser.Math.FloatBetween(-3, 3), groundY - rootThick * 0.6);
        g.lineTo(rootEndX, groundY + dip * 0.5);
        g.lineTo(rootEndX, groundY + dip);
        g.lineTo(midX + Phaser.Math.FloatBetween(-2, 2), groundY + rootThick * 0.3);
        g.lineTo(rootStartX, groundY + rootThick * 0.5);
        g.closePath();
        g.fillPath();
        // Outline
        g.lineStyle(1.2, outlineColor, 0.5);
        g.beginPath();
        g.moveTo(rootStartX, groundY - rootThick);
        g.lineTo(midX, groundY - rootThick * 0.6);
        g.lineTo(rootEndX, groundY + dip * 0.5);
        g.strokePath();
      }
    };

    // =================================================================
    // 2. FAR TRUNKS — short enough to show full tree tops + canopy
    // =================================================================
    for (let i = 0; i < 20; i++) {
      const x = i * 110 + Phaser.Math.Between(-20, 20);
      const t = this.add.graphics().setScrollFactor(0.3, 0).setDepth(-190);
      const tw = Phaser.Math.Between(18, 30);
      const trunkTop = Phaser.Math.Between(60, 160);
      drawTrunk(t, x, tw, trunkTop, WAY, 0x18120c, 0x0a0804, 0x201810);
      drawBranches(t, x, tw, trunkTop, WAY, 0x18120c, 0x0a0804, Phaser.Math.Between(1, 3));
      drawRoots(t, x, tw, WAY, 0x18120c, 0x0a0804);
      const canopyW = tw * Phaser.Math.FloatBetween(3.5, 6);
      const canopyH = canopyW * Phaser.Math.FloatBetween(0.5, 0.8);
      drawCanopy(t, x, trunkTop - canopyH * 0.3, canopyW, canopyH,
        0x1a3818, 0x224820, 0x2c5828, 0x0a1208, 1);
    }

    // =================================================================
    // 3. MID TRUNKS — tops partially visible, taller than far trunks
    // =================================================================
    for (let i = 0; i < 14; i++) {
      const x = i * 160 + Phaser.Math.Between(-30, 30);
      const t = this.add.graphics().setScrollFactor(0.6, 0).setDepth(-150);
      const tw = Phaser.Math.Between(30, 50);
      const trunkTop = Phaser.Math.Between(-20, 60);
      drawTrunk(t, x, tw, trunkTop, WAY, 0x2a1e14, 0x100a04, 0x3a2e20);
      drawBranches(t, x, tw, Math.max(0, trunkTop), WAY, 0x2a1e14, 0x100a04, Phaser.Math.Between(2, 4));
      drawRoots(t, x, tw, WAY, 0x2a1e14, 0x100a04);
      const canopyW = tw * Phaser.Math.FloatBetween(3, 5);
      const canopyH = canopyW * Phaser.Math.FloatBetween(0.5, 0.8);
      drawCanopy(t, x, trunkTop - canopyH * 0.2, canopyW, canopyH,
        0x1e4018, 0x285220, 0x34642c, 0x0c1408, 1);
    }

    // =================================================================
    // 4. NEAR TRUNKS — tallest, extend off top of screen (no visible tops)
    // =================================================================
    for (const seg of this.forestSegments) {
      const segW = seg.endX - seg.startX;
      const tCount = seg.trunkCount;
      for (let i = 0; i < tCount; i++) {
        const x = seg.startX + (i + 0.5) * (segW / Math.max(1, tCount)) + Phaser.Math.Between(-40, 40);
        const t = this.add.graphics().setDepth(WAY - 8);
        const w = Phaser.Math.Between(seg.trunkWidth[0], seg.trunkWidth[1]);
        const trunkTop = -40;
        drawTrunk(t, x, w, trunkTop, WAY, 0x3a2a18, 0x14100a, 0x4a3a26);
        drawBranches(t, x, w, 0, WAY, 0x3a2a18, 0x14100a, Phaser.Math.Between(2, 5));
        drawRoots(t, x, w, WAY, 0x3a2a18, 0x14100a);
      }
    }

    // =================================================================
    // 7. TERRAIN STRIPS — hand-painted canvas textures for the ground
    //    Replaces rectangle-based grass with textured sprite strips.
    // =================================================================
    this.generateTerrainTextures();
    const groundH = GROUND_MAX_Y - WAY;

    // ---------------------------------------------------------------
    // ORGANIC TERRAIN EDGE — irregular contour instead of straight line
    // ---------------------------------------------------------------

    // Generate the uneven contour points (shared by all edge elements)
    const contourPts: number[] = []; // Y offsets from WAY at each X step
    const contourStep = 30;
    for (let px = 0; px <= SW; px += contourStep) {
      // Gentle bumps: -6 to +3 from WAY (mostly above, slight dips)
      contourPts.push(Phaser.Math.FloatBetween(-6, 3));
    }
    // Smooth the contour so bumps are gentle, not jagged
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < contourPts.length - 1; i++) {
        contourPts[i] = (contourPts[i - 1] + contourPts[i] * 2 + contourPts[i + 1]) / 4;
      }
    }
    const getContourY = (px: number): number => {
      const idx = Math.min(Math.floor(px / contourStep), contourPts.length - 2);
      const t = (px % contourStep) / contourStep;
      return WAY + Phaser.Math.Linear(contourPts[idx], contourPts[idx + 1], t);
    };

    // Main grass body (flat fill below the contour)
    this.add.tileSprite(SW / 2, WAY + 16 + (groundH - 16) / 2, SW, groundH - 16, 'terrain-grass')
      .setDepth(WAY - 10);
    // Edge strip (bright, behind contour)
    this.add.tileSprite(SW / 2, WAY + 8, SW, 16, 'terrain-edge')
      .setDepth(WAY - 9);
    // Shadow strip at bottom
    this.add.tileSprite(SW / 2, GROUND_MAX_Y - 4, SW, 12, 'terrain-shadow')
      .setDepth(WAY - 8);

    // Irregular contour fill — a polygon that follows the bumpy edge
    const contourFill = this.add.graphics().setDepth(WAY - 6);
    // Dark shadow underneath the contour bumps
    contourFill.fillStyle(0x2a5a1a, 1);
    contourFill.beginPath();
    contourFill.moveTo(0, WAY + 6);
    for (let px = 0; px <= SW; px += contourStep) {
      contourFill.lineTo(px, getContourY(px) + 4);
    }
    contourFill.lineTo(SW, WAY + 6);
    contourFill.closePath();
    contourFill.fillPath();

    // Bright grass contour on top
    contourFill.fillStyle(0x4a9a3a, 1);
    contourFill.beginPath();
    contourFill.moveTo(0, WAY + 4);
    for (let px = 0; px <= SW; px += contourStep) {
      contourFill.lineTo(px, getContourY(px));
    }
    contourFill.lineTo(SW, WAY + 4);
    contourFill.closePath();
    contourFill.fillPath();

    // Overlapping lighter grass strips at varying heights
    const overlapG = this.add.graphics().setDepth(WAY - 5);
    for (let strip = 0; strip < 3; strip++) {
      const yOff = strip * 2;
      overlapG.fillStyle([0x5aaa4a, 0x4a9a3a, 0x3a8a2a][strip], 0.6);
      overlapG.beginPath();
      overlapG.moveTo(0, WAY + yOff + 3);
      for (let px = 0; px <= SW; px += contourStep) {
        const cy = getContourY(px) + yOff + Phaser.Math.FloatBetween(-1.5, 1.5);
        overlapG.lineTo(px, cy);
      }
      overlapG.lineTo(SW, WAY + yOff + 3);
      overlapG.closePath();
      overlapG.fillPath();
    }

    // Ground bump mounds — small raised hump shapes at irregular intervals
    const bumpG = this.add.graphics().setDepth(WAY - 4);
    let bumpX = Phaser.Math.Between(80, 200);
    while (bumpX < SW) {
      const bw = Phaser.Math.Between(30, 70);
      const bh = Phaser.Math.Between(3, 7);
      const by = getContourY(bumpX);
      bumpG.fillStyle(0x4a9a3a, 1);
      bumpG.beginPath();
      bumpG.moveTo(bumpX - bw / 2, by);
      bumpG.lineTo(bumpX - bw * 0.3, by - bh);
      bumpG.lineTo(bumpX + bw * 0.1, by - bh - 1);
      bumpG.lineTo(bumpX + bw * 0.35, by - bh + 1);
      bumpG.lineTo(bumpX + bw / 2, by);
      bumpG.closePath();
      bumpG.fillPath();
      // Highlight on top of bump
      bumpG.fillStyle(0x5aaa4a, 0.7);
      bumpG.beginPath();
      bumpG.moveTo(bumpX - bw * 0.2, by - bh + 1);
      bumpG.lineTo(bumpX, by - bh - 1);
      bumpG.lineTo(bumpX + bw * 0.25, by - bh + 1);
      bumpG.lineTo(bumpX + bw * 0.25, by - bh + 3);
      bumpG.lineTo(bumpX - bw * 0.2, by - bh + 3);
      bumpG.closePath();
      bumpG.fillPath();
      bumpX += Phaser.Math.Between(200, 500);
    }

    // Ink outline along the irregular contour
    const edgeLine = this.add.graphics().setDepth(WAY - 3);
    edgeLine.lineStyle(2.5, 0x1a2a10, 0.55);
    edgeLine.beginPath();
    edgeLine.moveTo(0, getContourY(0));
    for (let px = contourStep; px <= SW; px += contourStep) {
      edgeLine.lineTo(px, getContourY(px) + Phaser.Math.FloatBetween(-0.5, 0.5));
    }
    edgeLine.strokePath();

    // Edge shadow variation — darker patches under dips in the contour
    const shadowVar = this.add.graphics().setDepth(WAY - 7);
    for (let px = 0; px < SW; px += contourStep) {
      const cy = getContourY(px);
      if (cy > WAY) { // dip — add shadow
        shadowVar.fillStyle(0x1a3010, 0.2);
        shadowVar.fillEllipse(px, cy + 3, 25, 6);
      }
    }

    // Grass blade tufts following the contour (not a flat line)
    const tufts = this.add.graphics().setDepth(WAY - 2);
    for (let i = 0; i < 140; i++) {
      const gx = Phaser.Math.Between(0, SW);
      const baseY = getContourY(gx);
      const h = Phaser.Math.Between(5, 13);
      const color = [0x4a9a3a, 0x5aaa4a, 0x3a8a2a, 0x5ab848][Phaser.Math.Between(0, 3)];
      tufts.fillStyle(color, 1);
      tufts.fillTriangle(gx, baseY, gx - 2, baseY - h, gx + 2, baseY - h + 1);
      tufts.lineStyle(1, 0x1a3a10, 0.4);
      tufts.strokeTriangle(gx, baseY, gx - 2, baseY - h, gx + 2, baseY - h + 1);
      // Second blade
      const b2x = gx + Phaser.Math.Between(3, 6);
      const b2h = h - Phaser.Math.Between(0, 3);
      tufts.fillStyle(color, 1);
      tufts.fillTriangle(b2x, baseY, b2x - 2, baseY - b2h, b2x + 2, baseY - b2h + 2);
    }

    // Gradient overlay
    const gradG = this.add.graphics().setDepth(WAY - 7);
    for (let row = 0; row < 6; row++) {
      const gy = WAY + row * (groundH / 6);
      gradG.fillStyle(0x1a2a10, row * 0.02);
      gradG.fillRect(0, gy, SW, groundH / 6);
    }

    // =================================================================
    // 8. UNDERGROUND — thin dark earth strip below grass (foreground)
    //    Starts at GROUND_MAX_Y, extends 160px down. origin top-center.
    // =================================================================
    const ugHeight = 160;
    this.add.tileSprite(SW / 2, GROUND_MAX_Y + ugHeight / 2, SW, ugHeight, 'terrain-underground')
      .setDepth(ForestStage.FOREGROUND_LAYER_DEPTH + 50);


    // =================================================================
    // 10. ENVIRONMENTAL DETAIL CLUSTERS — segment-aware
    // =================================================================
    this.drawNearBackgroundDetails(WAY, SW);
    this.drawGroundLevelDetails(WAY, SW);
    this.drawWalkingAreaScatter(WAY, SW);
    this.drawForegroundDetails(SW);

    // =================================================================
    // 10. CONTACT SHADOWS — soft ovals under characters and props
    //    Drawn on a single Graphics object, redrawn each frame.
    // =================================================================
    this.contactShadowGfx = this.add.graphics().setDepth(WAY - 9);

    // =================================================================
    // 11. LIGHTING OVERLAYS — subtle depth through gradients/vignette
    //     Camera-fixed, very low alpha. Must not affect readability.
    // =================================================================
    this.drawLightingOverlays();

    // =================================================================
    // 12. FOREGROUND OCCLUSION — partially overlaps characters from below
    //     Depth above heroes (~650) but below underground layer (750+).
    //     Keeps gameplay readable — elements only at the bottom edge.
    // =================================================================
    this.drawForegroundOcclusion(WAY, SW);
  }

  /** Foreground elements that overlap the lower screen — tall grass, leaves, roots, branches. */
  /** Deep forest silhouette layers — 3 tiers behind the main trunk layers. */
  private drawDeepForestSilhouettes(WAY: number, SW: number): void {
    // Helper: draw a silhouette tree with polygon leaf masses (no ellipses)
    const drawSilTree = (g: Phaser.GameObjects.Graphics, x: number,
      trunkW: number, height: number, canopyW: number, canopyH: number, color: number) => {
      g.fillStyle(color, 1);
      const j = trunkW * 0.08;
      g.beginPath();
      g.moveTo(x - trunkW / 2 + Phaser.Math.FloatBetween(-j, j), WAY);
      g.lineTo(x - trunkW * 0.35 + Phaser.Math.FloatBetween(-j, j), WAY - height);
      g.lineTo(x + trunkW * 0.35 + Phaser.Math.FloatBetween(-j, j), WAY - height);
      g.lineTo(x + trunkW / 2 + Phaser.Math.FloatBetween(-j, j), WAY);
      g.closePath();
      g.fillPath();
      // Canopy — irregular polygon leaf masses
      const cy = WAY - height - canopyH * 0.2;
      for (let b = 0; b < Phaser.Math.Between(4, 6); b++) {
        const bx = x + Phaser.Math.FloatBetween(-canopyW * 0.35, canopyW * 0.35);
        const by = cy + Phaser.Math.FloatBetween(-canopyH * 0.25, canopyH * 0.15);
        const bw = canopyW * Phaser.Math.FloatBetween(0.5, 0.9);
        const bh = canopyH * Phaser.Math.FloatBetween(0.4, 0.7);
        const pts = 7 + Phaser.Math.Between(0, 3);
        g.beginPath();
        for (let p = 0; p <= pts; p++) {
          const a = (p / pts) * Math.PI * 2;
          const prx = bw * (0.7 + Phaser.Math.FloatBetween(0, 0.35));
          const pry = bh * (0.7 + Phaser.Math.FloatBetween(0, 0.35));
          if (p === 0) g.moveTo(bx + Math.cos(a) * prx, by + Math.sin(a) * pry);
          else g.lineTo(bx + Math.cos(a) * prx, by + Math.sin(a) * pry);
        }
        g.closePath();
        g.fillPath();
      }
    };

    // ---------------------------------------------------------------
    // TIER 1: FARTHEST — very dark, low contrast, very slow parallax
    // Barely distinguishable from the sky. Creates atmospheric haze.
    // ---------------------------------------------------------------
    {
      const g = this.add.graphics().setScrollFactor(0.08, 0).setDepth(-199);
      // Continuous treeline silhouette — a solid mass with bumpy top edge
      g.fillStyle(0x101e1a, 1);
      g.beginPath();
      g.moveTo(-100, WAY);
      let tx = -100;
      while (tx < 2200) {
        const peakH = Phaser.Math.Between(60, 140);
        const peakW = Phaser.Math.Between(30, 60);
        g.lineTo(tx, WAY - peakH);
        g.lineTo(tx + peakW * 0.5, WAY - peakH + Phaser.Math.Between(5, 20));
        tx += peakW;
      }
      g.lineTo(2200, WAY);
      g.closePath();
      g.fillPath();
      // A few individual tall trees rising above the mass
      for (let i = 0; i < 8; i++) {
        drawSilTree(g, Phaser.Math.Between(0, 2000),
          Phaser.Math.Between(8, 14), Phaser.Math.Between(160, 240),
          Phaser.Math.Between(25, 45), Phaser.Math.Between(20, 35), 0x101e1a);
      }
    }

    // ---------------------------------------------------------------
    // TIER 2: MID-FAR — slightly lighter, more defined shapes
    // Individual trees visible, slow parallax.
    // ---------------------------------------------------------------
    {
      const g = this.add.graphics().setScrollFactor(0.14, 0).setDepth(-198);
      const color = 0x142820;
      // Bumpy treeline base
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(-100, WAY);
      let tx = -100;
      while (tx < 2400) {
        const peakH = Phaser.Math.Between(50, 120);
        const peakW = Phaser.Math.Between(25, 50);
        g.lineTo(tx, WAY - peakH);
        g.lineTo(tx + peakW * 0.4, WAY - peakH + Phaser.Math.Between(8, 25));
        tx += peakW;
      }
      g.lineTo(2400, WAY);
      g.closePath();
      g.fillPath();
      // Individual trees with varied heights
      for (let i = 0; i < 12; i++) {
        drawSilTree(g, Phaser.Math.Between(-50, 2300),
          Phaser.Math.Between(10, 18), Phaser.Math.Between(120, 200),
          Phaser.Math.Between(28, 50), Phaser.Math.Between(22, 38), color);
      }
    }

    // ---------------------------------------------------------------
    // TIER 3: NEAR-FAR — lightest of the new layers, most defined
    // Clearer tree shapes, moderate parallax.
    // ---------------------------------------------------------------
    {
      const g = this.add.graphics().setScrollFactor(0.22, 0).setDepth(-196);
      const color = 0x1a3228;
      // Base treeline
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(-100, WAY);
      let tx = -100;
      while (tx < 2800) {
        const peakH = Phaser.Math.Between(40, 100);
        const peakW = Phaser.Math.Between(20, 45);
        g.lineTo(tx, WAY - peakH);
        g.lineTo(tx + peakW * 0.45, WAY - peakH + Phaser.Math.Between(5, 18));
        tx += peakW;
      }
      g.lineTo(2800, WAY);
      g.closePath();
      g.fillPath();
      // Taller individual trees standing above
      for (let i = 0; i < 15; i++) {
        const treeX = Phaser.Math.Between(-50, 2700);
        const h = Phaser.Math.Between(100, 180);
        const cw = Phaser.Math.Between(30, 55);
        drawSilTree(g, treeX,
          Phaser.Math.Between(12, 22), h, cw, cw * Phaser.Math.FloatBetween(0.6, 0.85), color);
      }
    }
  }

  private drawForegroundOcclusion(WAY: number, SW: number): void {
    const FG_DEPTH = 650; // above hero depth (~420-560), below underground (750)

    // --- Tall grass silhouettes — segment-aware density ---
    const tallGrass = this.add.graphics().setDepth(FG_DEPTH);
    for (let i = 0; i < 80; i++) {
      const gx = Phaser.Math.Between(0, SW);
      const { seg } = this.getSegment(gx);
      // Skip if segment has low foreground intensity
      if (Math.random() > seg.foreground) continue;
      const baseY = GROUND_MAX_Y - Phaser.Math.Between(-5, 8);
      const bladeCount = Phaser.Math.Between(3, 6);
      const color = [0x2a5a1a, 0x326820, 0x1e4a14, 0x2a5020][Phaser.Math.Between(0, 3)];
      for (let b = 0; b < bladeCount; b++) {
        const bx = gx + Phaser.Math.Between(-8, 8);
        const h = Phaser.Math.Between(18, 40);
        const lean = Phaser.Math.FloatBetween(-4, 4);
        tallGrass.fillStyle(color, 0.85);
        tallGrass.fillTriangle(bx, baseY, bx + lean - 2, baseY - h, bx + lean + 2, baseY - h + 2);
        // Ink edge
        tallGrass.lineStyle(1, 0x0e2008, 0.4);
        tallGrass.strokeTriangle(bx, baseY, bx + lean - 2, baseY - h, bx + lean + 2, baseY - h + 2);
      }
    }

    // --- Foreground leaves — large individual leaf shapes at bottom corners ---
    const leaves = this.add.graphics().setDepth(FG_DEPTH + 2);
    for (let i = 0; i < 25; i++) {
      const lx = Phaser.Math.Between(0, SW);
      const ly = GROUND_MAX_Y + Phaser.Math.Between(-20, 10);
      const lw = Phaser.Math.Between(12, 25);
      const lh = Phaser.Math.Between(6, 14);
      const rot = Phaser.Math.FloatBetween(-0.4, 0.4);
      const color = [0x1e3a10, 0x264a18, 0x1a3210, 0x2e4e20][Phaser.Math.Between(0, 3)];
      // Leaf shape — irregular polygon (not ellipse)
      const pts = 6 + Phaser.Math.Between(0, 2);
      leaves.fillStyle(color, 0.8);
      leaves.beginPath();
      for (let p = 0; p <= pts; p++) {
        const a = (p / pts) * Math.PI * 2 + rot;
        const prx = lw * 0.5 * (0.7 + Phaser.Math.FloatBetween(0, 0.3));
        const pry = lh * 0.5 * (0.7 + Phaser.Math.FloatBetween(0, 0.3));
        if (p === 0) leaves.moveTo(lx + Math.cos(a) * prx, ly + Math.sin(a) * pry);
        else leaves.lineTo(lx + Math.cos(a) * prx, ly + Math.sin(a) * pry);
      }
      leaves.closePath();
      leaves.fillPath();
      // Center vein
      leaves.lineStyle(0.8, 0x142a0c, 0.5);
      leaves.lineBetween(lx - lw * 0.35, ly, lx + lw * 0.35, ly);
    }

    // --- Root shapes emerging from the ground edge ---
    const roots = this.add.graphics().setDepth(FG_DEPTH + 1);
    let rx = Phaser.Math.Between(100, 300);
    while (rx < SW) {
      const ry = GROUND_MAX_Y - Phaser.Math.Between(0, 5);
      const rootLen = Phaser.Math.Between(20, 45);
      const curve = Phaser.Math.FloatBetween(-8, 8);
      roots.lineStyle(Phaser.Math.FloatBetween(2, 4), 0x3a2818, 0.7);
      roots.beginPath();
      roots.moveTo(rx, ry + 5);
      roots.lineTo(rx + rootLen * 0.4, ry - rootLen * 0.3 + curve);
      roots.lineTo(rx + rootLen * 0.7, ry - rootLen * 0.15 + curve * 0.5);
      roots.lineTo(rx + rootLen, ry + 3);
      roots.strokePath();
      // Ink outline thicker
      roots.lineStyle(1, 0x1a1008, 0.35);
      roots.beginPath();
      roots.moveTo(rx - 1, ry + 6);
      roots.lineTo(rx + rootLen * 0.4 - 1, ry - rootLen * 0.3 + curve - 1);
      roots.lineTo(rx + rootLen * 0.7 + 1, ry - rootLen * 0.15 + curve * 0.5 + 1);
      roots.lineTo(rx + rootLen + 1, ry + 4);
      roots.strokePath();
      rx += Phaser.Math.Between(300, 600);
    }

    // --- Branch overlays — thin dark branches crossing from the edges ---
    const branches = this.add.graphics().setDepth(FG_DEPTH + 3);
    let bx = Phaser.Math.Between(200, 500);
    while (bx < SW) {
      const by = GROUND_MAX_Y - Phaser.Math.Between(10, 35);
      const bLen = Phaser.Math.Between(30, 70);
      const bAngle = Phaser.Math.FloatBetween(-0.4, 0.4);
      // Main branch
      branches.lineStyle(Phaser.Math.FloatBetween(2, 3.5), 0x2a1a10, 0.6);
      branches.beginPath();
      branches.moveTo(bx, by + 10);
      const bEndX = bx + bLen * Math.cos(bAngle);
      const bEndY = by - bLen * 0.3;
      branches.lineTo(bx + bLen * 0.5 * Math.cos(bAngle), by - bLen * 0.15);
      branches.lineTo(bEndX, bEndY);
      branches.strokePath();
      // Small twig fork
      branches.lineStyle(1.5, 0x2a1a10, 0.5);
      branches.beginPath();
      branches.moveTo(bEndX, bEndY);
      branches.lineTo(bEndX + 8, bEndY - 6);
      branches.moveTo(bEndX, bEndY);
      branches.lineTo(bEndX + 6, bEndY + 5);
      branches.strokePath();
      bx += Phaser.Math.Between(400, 800);
    }
  }

  /** Graphics object for per-frame contact shadows (Stage 1 only). */
  /** Subtle lighting overlays — canopy shadow, ground edge darkening, vignette, sky tint. */
  private drawLightingOverlays(): void {
    // All overlays are camera-fixed and use very low alpha to stay subtle.
    // Depth 690 — above characters but below underground/foreground.

    // --- 1. CANOPY SHADOW GRADIENT ---
    // Dark gradient falling from the top of the screen downward,
    // simulating shadow cast by the canopy onto the scene below.
    const canopyShadow = this.add.graphics().setScrollFactor(0, 0).setDepth(690);
    const shadowBands = 8;
    for (let i = 0; i < shadowBands; i++) {
      const bandY = i * (180 / shadowBands);
      const bandH = 180 / shadowBands;
      const alpha = 0.12 * (1 - i / shadowBands); // strongest at top, fades down
      canopyShadow.fillStyle(0x0a1408, alpha);
      canopyShadow.fillRect(0, bandY, 1280, bandH);
    }

    // --- 2. GROUND-EDGE DARKENING STRIP ---
    // Thin dark band where the grass meets the underground,
    // creates a subtle shadow at the terrain boundary.
    const groundEdge = this.add.graphics().setScrollFactor(0, 0).setDepth(690);
    // Map GROUND_MAX_Y to screen space (approx screen y = GROUND_MAX_Y - camScrollY)
    // Since camera scrollY varies, use a fixed position that aligns with
    // the typical bottom of the walking area on screen (~62% down).
    const edgeScreenY = 460; // approximate screen position of GROUND_MAX_Y
    groundEdge.fillStyle(0x0a0e04, 0.15);
    groundEdge.fillRect(0, edgeScreenY - 6, 1280, 12);
    groundEdge.fillStyle(0x0a0e04, 0.08);
    groundEdge.fillRect(0, edgeScreenY - 14, 1280, 8);

    // --- 3. SOFT VIGNETTE ---
    // Darken the edges/corners of the screen for depth focus.
    const vignette = this.add.graphics().setScrollFactor(0, 0).setDepth(692);
    // Top edge
    vignette.fillStyle(0x060a04, 0.10);
    vignette.fillRect(0, 0, 1280, 40);
    vignette.fillStyle(0x060a04, 0.05);
    vignette.fillRect(0, 40, 1280, 30);
    // Bottom edge
    vignette.fillStyle(0x060a04, 0.10);
    vignette.fillRect(0, 680, 1280, 40);
    vignette.fillStyle(0x060a04, 0.05);
    vignette.fillRect(0, 650, 1280, 30);
    // Left edge
    vignette.fillStyle(0x060a04, 0.08);
    vignette.fillRect(0, 0, 30, 720);
    vignette.fillStyle(0x060a04, 0.04);
    vignette.fillRect(30, 0, 20, 720);
    // Right edge
    vignette.fillStyle(0x060a04, 0.08);
    vignette.fillRect(1250, 0, 30, 720);
    vignette.fillStyle(0x060a04, 0.04);
    vignette.fillRect(1230, 0, 20, 720);

    // --- 4. FAINT SKY TINT ---
    // Very subtle blue-green wash over the upper portion of the screen
    // to unify the forest atmosphere.
    const skyTint = this.add.graphics().setScrollFactor(0, 0).setDepth(688);
    skyTint.fillStyle(0x0a1818, 0.06);
    skyTint.fillRect(0, 0, 1280, 300);
    skyTint.fillStyle(0x0a1818, 0.03);
    skyTint.fillRect(0, 300, 1280, 100);
  }

  /** Forest-specific ambient motion — drifting particles, swaying, falling leaves. */
  private buildForestAmbientMotion(): void {
    const SW = STAGE_WIDTH;
    const WAY = this.walkingAreaY;

    // --- 1. FLOATING POLLEN SPECKS ---
    // Tiny bright dots drifting slowly across the mid-zone.
    for (let i = 0; i < 14; i++) {
      const px = Phaser.Math.Between(0, 1280);
      const py = Phaser.Math.Between(100, WAY - 20);
      const speck = this.add.circle(px, py, Phaser.Math.FloatBetween(1, 2.5),
        [0xeeffaa, 0xddeeaa, 0xffffcc][Phaser.Math.Between(0, 2)],
        Phaser.Math.FloatBetween(0.2, 0.45))
        .setScrollFactor(0.7, 0).setDepth(-20);

      // Slow drift — looping horizontal + gentle vertical bob
      this.tweens.add({
        targets: speck,
        x: px + Phaser.Math.Between(60, 180),
        y: py + Phaser.Math.Between(-15, 15),
        alpha: { from: speck.alpha, to: speck.alpha * 0.3 },
        duration: Phaser.Math.Between(6000, 12000),
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // --- 2. DRIFTING MOTE PARTICLES ---
    // Slightly larger than pollen, drift diagonally downward very slowly.
    for (let i = 0; i < 10; i++) {
      const mx = Phaser.Math.Between(0, 1280);
      const my = Phaser.Math.Between(80, WAY - 40);
      const mote = this.add.circle(mx, my, Phaser.Math.FloatBetween(1.5, 3),
        0xccddbb, Phaser.Math.FloatBetween(0.1, 0.25))
        .setScrollFactor(0.5, 0).setDepth(-18);

      this.tweens.add({
        targets: mote,
        x: mx + Phaser.Math.Between(-100, 100),
        y: my + Phaser.Math.Between(20, 60),
        duration: Phaser.Math.Between(8000, 15000),
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }


    // --- 4. MOVING CANOPY SHADOW PATCHES ---
    // Dark ovals on the grass that drift slowly, simulating
    // shifting light through the canopy.
    for (let i = 0; i < 6; i++) {
      const sx = Phaser.Math.Between(100, SW - 100);
      const sy = WAY + Phaser.Math.Between(15, 60);
      const shadow = this.add.ellipse(sx, sy,
        Phaser.Math.Between(40, 80), Phaser.Math.Between(10, 20),
        0x1a2a10, Phaser.Math.FloatBetween(0.06, 0.12))
        .setDepth(WAY - 8);

      this.tweens.add({
        targets: shadow,
        x: sx + Phaser.Math.Between(-30, 30),
        scaleX: Phaser.Math.FloatBetween(0.8, 1.2),
        alpha: { from: shadow.alpha, to: shadow.alpha * 0.5 },
        duration: Phaser.Math.Between(5000, 10000),
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // --- 5. FALLING LEAF SPRITES ---
    // Occasional leaves that drift down from the canopy.
    // Spawns continuously using a timer.
    const spawnFallingLeaf = () => {
      const lx = Phaser.Math.Between(0, 1280);
      const ly = Phaser.Math.Between(60, 100);
      const leaf = this.add.graphics().setScrollFactor(0.8, 0.8).setDepth(-15);
      const color = [0x3a6a20, 0x4a7a28, 0x2a5a18, 0x5a8a30][Phaser.Math.Between(0, 3)];
      const size = Phaser.Math.FloatBetween(3, 6);

      // Leaf shape — small irregular polygon
      leaf.fillStyle(color, 0.8);
      leaf.beginPath();
      leaf.moveTo(-size, 0);
      leaf.lineTo(-size * 0.3, -size * 0.4);
      leaf.lineTo(size * 0.5, -size * 0.25);
      leaf.lineTo(size, 0);
      leaf.lineTo(size * 0.4, size * 0.3);
      leaf.lineTo(-size * 0.4, size * 0.35);
      leaf.closePath();
      leaf.fillPath();
      leaf.x = lx;
      leaf.y = ly;

      // Drift down and sideways with rotation
      const drift = Phaser.Math.Between(-60, 60);
      const dur = Phaser.Math.Between(4000, 8000);
      this.tweens.add({
        targets: leaf,
        x: lx + drift,
        y: WAY + Phaser.Math.Between(20, 60),
        rotation: Phaser.Math.FloatBetween(-1.5, 1.5),
        alpha: 0,
        duration: dur,
        ease: 'Sine.easeIn',
        onComplete: () => leaf.destroy(),
      });
    };

    // Spawn a leaf every 2-4 seconds
    this.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => {
        spawnFallingLeaf();
      },
      loop: true,
    });
    // Spawn a few immediately so the scene doesn't start empty
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(Phaser.Math.Between(200, 1500), spawnFallingLeaf);
    }
  }

  private contactShadowGfx: Phaser.GameObjects.Graphics | null = null;

  /** Draw soft contact shadows under the hero and all living enemies. */
  private drawContactShadows(): void {
    const g = this.contactShadowGfx;
    if (!g) return;
    g.clear();

    const WAY = this.walkingAreaY;

    // Hero shadow — larger, softer
    if (this.hero && !this.hero.isDead) {
      const hx = this.hero.x;
      const jumpOffset = Math.abs(this.hero.jumpZ);
      // Shadow shrinks when jumping
      const scale = Math.max(0.3, 1 - jumpOffset / 200);
      // Outer soft ring
      g.fillStyle(0x1a2a10, 0.12 * scale);
      g.fillEllipse(hx, WAY + 4, 42 * scale, 12 * scale);
      // Inner darker core
      g.fillStyle(0x0a1a08, 0.2 * scale);
      g.fillEllipse(hx, WAY + 4, 28 * scale, 8 * scale);
    }

    // Enemy shadows
    const enemies = this.waveSpawner?.getEnemies() ?? [];
    for (const e of enemies) {
      if (e.isDead) continue;
      const ex = e.x;
      const ey = e.groundY;
      const isBoss = e.isBoss;
      const sw = isBoss ? 60 : 24;
      const sh = isBoss ? 16 : 8;
      // Outer
      g.fillStyle(0x1a2a10, 0.10);
      g.fillEllipse(ex, ey + 3, sw * 1.3, sh * 1.3);
      // Inner
      g.fillStyle(0x0a1a08, 0.18);
      g.fillEllipse(ex, ey + 3, sw, sh);
    }
  }

  /** Generate canvas textures for terrain strips (called once per stage load). */
  // =====================================================================
  // NEAR-BACKGROUND + GROUND-LEVEL DETAILS — clustered placement
  // Each cluster: 1 large anchor + 2-4 small companions.
  // Occasional empty gaps break the pattern.
  // =====================================================================
  private drawNearBackgroundDetails(WAY: number, SW: number): void {
    const g = this.add.graphics().setDepth(WAY - 7);
    let cx = Phaser.Math.Between(60, 180);
    while (cx < SW) {
      // Segment-aware density — sparse segments have more gaps
      const { seg, blend, nextSeg } = this.getSegment(cx);
      const density = nextSeg ? this.lerpSeg(seg.density, nextSeg.density, blend) : seg.density;
      const gapChance = 0.4 - density * 0.3; // dense=10% gap, sparse=40% gap
      if (Math.random() < gapChance) { cx += Phaser.Math.Between(250, 500); continue; }

      const s = Phaser.Math.FloatBetween(0.85, 1.15);
      const anchorType = Phaser.Math.Between(0, 2);

      // --- LARGE ANCHOR ---
      if (anchorType === 0) {
        // Large bush — polygon leaf mass
        const bw = Phaser.Math.Between(25, 40) * s;
        const bh = Phaser.Math.Between(16, 26) * s;
        const bColor = [0x1e3814, 0x243e18][Phaser.Math.Between(0, 1)];
        const bPts = 8;
        g.fillStyle(bColor, 0.9);
        g.beginPath();
        for (let p = 0; p <= bPts; p++) {
          const a = (p / bPts) * Math.PI * 2;
          const prx = bw * 0.5 * (0.7 + Phaser.Math.FloatBetween(0, 0.3));
          const pry = bh * 0.5 * (0.7 + Phaser.Math.FloatBetween(0, 0.3));
          if (p === 0) g.moveTo(cx + Math.cos(a) * prx, WAY - 12 * s + Math.sin(a) * pry);
          else g.lineTo(cx + Math.cos(a) * prx, WAY - 12 * s + Math.sin(a) * pry);
        }
        g.closePath();
        g.fillPath();
      } else if (anchorType === 1) {
        // Large rock
        const rw = Phaser.Math.Between(14, 22) * s;
        const rh = Phaser.Math.Between(8, 14) * s;
        g.fillStyle(0x4a4a3a, 0.85);
        g.fillEllipse(cx, WAY - 4 * s, rw, rh);
        g.lineStyle(1.2, 0x2a2a1e, 0.45);
        g.strokeEllipse(cx, WAY - 4 * s, rw, rh);
      } else {
        // Large broken branch
        const len = Phaser.Math.Between(30, 50) * s;
        const rot = Phaser.Math.FloatBetween(-0.3, 0.1);
        g.lineStyle(3 * s, 0x3a2818, 0.8);
        g.beginPath();
        g.moveTo(cx, WAY - 10 * s);
        g.lineTo(cx + len * Math.cos(rot), WAY - 10 * s + len * Math.sin(rot));
        g.strokePath();
        g.lineStyle(1.5 * s, 0x3a2818, 0.6);
        g.lineBetween(cx + len * 0.6 * Math.cos(rot), WAY - 10 * s + len * 0.6 * Math.sin(rot),
          cx + len * 0.6 * Math.cos(rot) + 8 * s, WAY - 22 * s);
      }

      // --- 2-4 SMALL COMPANIONS nearby ---
      const companionCount = Phaser.Math.Between(2, 4);
      for (let c = 0; c < companionCount; c++) {
        const ox = cx + Phaser.Math.Between(-35, 35);
        const compType = Phaser.Math.Between(0, 4);
        const cs = s * Phaser.Math.FloatBetween(0.7, 1.0);

        if (compType === 0) {
          // Small pebble
          g.fillStyle([0x5a5a48, 0x4a4a3a][Phaser.Math.Between(0, 1)], 0.6);
          g.fillEllipse(ox, WAY - Phaser.Math.Between(1, 5), 5 * cs, 3 * cs);
        } else if (compType === 1) {
          // Tiny bush — polygon
          const tbPts = 6;
          g.fillStyle(0x1e3814, 0.7);
          g.beginPath();
          for (let p = 0; p <= tbPts; p++) {
            const a = (p / tbPts) * Math.PI * 2;
            if (p === 0) g.moveTo(ox + Math.cos(a) * 6 * cs * (0.7 + Math.random() * 0.3), WAY - 6 * cs + Math.sin(a) * 4 * cs * (0.7 + Math.random() * 0.3));
            else g.lineTo(ox + Math.cos(a) * 6 * cs * (0.7 + Math.random() * 0.3), WAY - 6 * cs + Math.sin(a) * 4 * cs * (0.7 + Math.random() * 0.3));
          }
          g.closePath(); g.fillPath();
        } else if (compType === 2) {
          // Small leaf drip — polygon
          const ldPts = 5;
          const ldy = WAY - Phaser.Math.Between(20, 40);
          g.fillStyle(0x1e3a14, 0.5);
          g.beginPath();
          for (let p = 0; p <= ldPts; p++) {
            const a = (p / ldPts) * Math.PI * 2;
            if (p === 0) g.moveTo(ox + Math.cos(a) * 5 * cs * (0.7 + Math.random() * 0.3), ldy + Math.sin(a) * 3 * cs * (0.7 + Math.random() * 0.3));
            else g.lineTo(ox + Math.cos(a) * 5 * cs * (0.7 + Math.random() * 0.3), ldy + Math.sin(a) * 3 * cs * (0.7 + Math.random() * 0.3));
          }
          g.closePath(); g.fillPath();
        } else if (compType === 3) {
          // Twig fragment
          g.lineStyle(1.2 * cs, 0x4a3420, 0.5);
          const tl = Phaser.Math.Between(6, 14) * cs;
          g.lineBetween(ox, WAY - 2, ox + tl, WAY - 4 * cs);
        } else {
          // Grass tuft
          g.fillStyle(0x3a7a2a, 0.7);
          const bh = Phaser.Math.Between(4, 8) * cs;
          g.fillTriangle(ox, WAY, ox - 1.5, WAY - bh, ox + 1.5, WAY - bh + 1);
        }
      }

      // Segment-aware spacing: denser segments = tighter spacing
      const baseSpacing = Math.round(Phaser.Math.Linear(250, 500, 1 - density));
      cx += baseSpacing + Phaser.Math.Between(-40, 40);
    }
  }

  private drawGroundLevelDetails(WAY: number, SW: number): void {
    const g = this.add.graphics().setDepth(WAY + 1);
    let cx = Phaser.Math.Between(50, 150);
    while (cx < SW) {
      // Segment-aware: propMix biases anchor type, density controls gaps
      const { seg, blend, nextSeg } = this.getSegment(cx);
      const density = nextSeg ? this.lerpSeg(seg.density, nextSeg.density, blend) : seg.density;
      const propMix = nextSeg ? this.lerpSeg(seg.propMix, nextSeg.propMix, blend) : seg.propMix;
      const gapChance = 0.35 - density * 0.25;
      if (Math.random() < gapChance) { cx += Phaser.Math.Between(300, 600); continue; }

      const s = Phaser.Math.FloatBetween(0.85, 1.15);
      // propMix: 0=rocks/sticks, 1=flowers/mushrooms
      const anchorType = propMix > 0.6
        ? Phaser.Math.Between(0, 1)  // mushroom or flower cluster
        : (propMix < 0.3 ? Phaser.Math.Between(1, 2) : Phaser.Math.Between(0, 3)); // stick/root or mixed

      // --- LARGE ANCHOR on the ground ---
      if (anchorType === 0) {
        // Large mushroom
        const mh = Phaser.Math.Between(6, 10) * s;
        g.fillStyle(0xddd8c0, 0.9);
        g.fillRect(cx - 1.5, WAY - mh, 3, mh);
        g.fillStyle([0xcc3322, 0xddaa33][Phaser.Math.Between(0, 1)], 0.9);
        g.fillEllipse(cx, WAY - mh, 9 * s, 5 * s);
        g.lineStyle(1, 0x4a2010, 0.5);
        g.strokeEllipse(cx, WAY - mh, 9 * s, 5 * s);
      } else if (anchorType === 1) {
        // Fallen stick
        const len = Phaser.Math.Between(18, 35) * s;
        const rot = Phaser.Math.FloatBetween(-0.25, 0.25);
        g.lineStyle(2 * s, 0x5a4020, 0.7);
        g.lineBetween(cx, WAY + 3, cx + len * Math.cos(rot), WAY + 3 + len * Math.sin(rot));
      } else if (anchorType === 2) {
        // Root fragment
        g.lineStyle(2.5 * s, 0x4a3420, 0.65);
        g.beginPath();
        g.moveTo(cx - 8, WAY + 2);
        g.lineTo(cx, WAY - 5 * s);
        g.lineTo(cx + 8, WAY + 1);
        g.strokePath();
      } else {
        // Large flower cluster
        for (let f = 0; f < 3; f++) {
          const fx = cx + Phaser.Math.Between(-6, 6);
          const fh = Phaser.Math.Between(6, 11) * s;
          g.lineStyle(1, 0x3a7a2a, 0.7);
          g.lineBetween(fx, WAY, fx + Phaser.Math.FloatBetween(-2, 2), WAY - fh);
          g.fillStyle([0xffaaaa, 0xaaaaff, 0xffffaa, 0xffaaff][Phaser.Math.Between(0, 3)], 0.8);
          g.fillCircle(fx, WAY - fh, 2.5 * s);
        }
      }

      // --- 2-4 SMALL COMPANIONS ---
      const companionCount = Phaser.Math.Between(2, 4);
      for (let c = 0; c < companionCount; c++) {
        const ox = cx + Phaser.Math.Between(-30, 30);
        const compType = Phaser.Math.Between(0, 3);
        const cs = s * Phaser.Math.FloatBetween(0.6, 1.0);

        if (compType === 0) {
          // Small stone
          g.fillStyle(0x6a6a58, 0.5);
          g.fillEllipse(ox, WAY + Phaser.Math.Between(2, 6), 4 * cs, 2.5 * cs);
        } else if (compType === 1) {
          // Grass blades
          const bh = Phaser.Math.Between(5, 10) * cs;
          g.fillStyle([0x4aaa3a, 0x5abb4a][Phaser.Math.Between(0, 1)], 0.85);
          g.fillTriangle(ox, WAY, ox - 1.5, WAY - bh, ox + 1.5, WAY - bh + 1);
        } else if (compType === 2) {
          // Tiny mushroom
          const th = 4 * cs;
          g.fillStyle(0xddd8c0, 0.8);
          g.fillRect(ox - 0.8, WAY - th, 1.6, th);
          g.fillStyle(0xaa4433, 0.8);
          g.fillEllipse(ox, WAY - th, 4 * cs, 2.5 * cs);
        } else {
          // Single flower
          const fh = Phaser.Math.Between(4, 7) * cs;
          g.lineStyle(0.8, 0x3a7a2a, 0.6);
          g.lineBetween(ox, WAY, ox, WAY - fh);
          g.fillStyle([0xffaaaa, 0xaaaaff, 0xffffaa][Phaser.Math.Between(0, 2)], 0.7);
          g.fillCircle(ox, WAY - fh, 1.5 * cs);
        }
      }

      cx += Math.round(Phaser.Math.Linear(200, 450, 1 - density)) + Phaser.Math.Between(-30, 30);
    }
  }

  // =====================================================================
  // WALKING AREA SCATTER — individual small props every 200-400px
  // Grass tufts, rocks, sticks, mushrooms, flowers along walkingAreaY.
  // Each has scale variation (0.85-1.15) and rotation (-5° to +5°).
  // =====================================================================
  private drawWalkingAreaScatter(WAY: number, SW: number): void {
    const g = this.add.graphics().setDepth(WAY + 2);
    let px = Phaser.Math.Between(40, 120);
    while (px < SW) {
      // Segment-aware type selection and spacing
      const { seg, blend, nextSeg } = this.getSegment(px);
      const propMix = nextSeg ? this.lerpSeg(seg.propMix, nextSeg.propMix, blend) : seg.propMix;
      const density = nextSeg ? this.lerpSeg(seg.density, nextSeg.density, blend) : seg.density;
      // Bias type by propMix: high=flowers/mushrooms(3,4), low=rocks/sticks(1,2)
      const type = propMix > 0.6 ? Phaser.Math.Between(3, 4) :
        (propMix < 0.3 ? Phaser.Math.Between(1, 2) : Phaser.Math.Between(0, 4));
      const s = Phaser.Math.FloatBetween(0.85, 1.15);
      const rot = Phaser.Math.FloatBetween(-0.087, 0.087);

      if (type === 0) {
        // Grass tuft — 3-5 blades with rotation
        const bladeCount = Phaser.Math.Between(3, 5);
        for (let b = 0; b < bladeCount; b++) {
          const bx = px + Phaser.Math.Between(-6, 6);
          const h = Phaser.Math.Between(6, 14) * s;
          const lean = rot + Phaser.Math.FloatBetween(-0.05, 0.05);
          const tipX = bx + h * Math.sin(lean);
          const tipY = WAY - h * Math.cos(lean);
          g.fillStyle([0x4aaa3a, 0x5abb4a, 0x3a9a2a, 0x58b848][Phaser.Math.Between(0, 3)], 0.9);
          g.fillTriangle(bx - 1.5, WAY, tipX, tipY, bx + 1.5, WAY);
          g.lineStyle(0.8, 0x1a3a10, 0.35);
          g.strokeTriangle(bx - 1.5, WAY, tipX, tipY, bx + 1.5, WAY);
        }
      } else if (type === 1) {
        // Small rock — oval with ink outline, slightly rotated
        const rw = Phaser.Math.Between(5, 10) * s;
        const rh = Phaser.Math.Between(3, 6) * s;
        const ry = WAY + Phaser.Math.Between(1, 5);
        g.fillStyle([0x6a6a58, 0x5a5a48, 0x7a7a68][Phaser.Math.Between(0, 2)], 0.7);
        g.fillEllipse(px, ry, rw, rh);
        g.lineStyle(1, 0x3a3a2e, 0.4);
        g.strokeEllipse(px, ry, rw, rh);
        // Tiny highlight
        g.fillStyle(0x8a8a78, 0.3);
        g.fillEllipse(px - rw * 0.15, ry - rh * 0.2, rw * 0.4, rh * 0.3);
      } else if (type === 2) {
        // Stick — angled line with slight rotation
        const len = Phaser.Math.Between(10, 22) * s;
        const angle = rot + Phaser.Math.FloatBetween(-0.2, 0.2);
        g.lineStyle(1.5 * s, 0x5a4020, 0.7);
        g.lineBetween(px, WAY + 3, px + len * Math.cos(angle), WAY + 3 - len * Math.sin(angle) * 0.3);
        g.lineStyle(0.8, 0x3a2810, 0.35);
        g.lineBetween(px, WAY + 4, px + len * Math.cos(angle), WAY + 4 - len * Math.sin(angle) * 0.3);
      } else if (type === 3) {
        // Mushroom — stem + cap with rotation lean
        const mh = Phaser.Math.Between(5, 9) * s;
        const stemTopX = px + mh * Math.sin(rot);
        const stemTopY = WAY - mh * Math.cos(rot);
        // Stem
        g.lineStyle(2 * s, 0xddd8c0, 0.9);
        g.lineBetween(px, WAY, stemTopX, stemTopY);
        // Cap
        const capW = Phaser.Math.Between(5, 8) * s;
        const capH = Phaser.Math.Between(3, 5) * s;
        g.fillStyle([0xcc3322, 0xddaa33, 0xaa4433, 0xcc6644][Phaser.Math.Between(0, 3)], 0.9);
        g.fillEllipse(stemTopX, stemTopY, capW, capH);
        g.lineStyle(0.8, 0x4a2010, 0.45);
        g.strokeEllipse(stemTopX, stemTopY, capW, capH);
        // White spots on red caps
        if (Math.random() > 0.5) {
          g.fillStyle(0xffffff, 0.5);
          g.fillCircle(stemTopX - 1, stemTopY - 1, 0.8 * s);
        }
      } else {
        // Flower — stem + colored petal dot, leaning with rotation
        const fh = Phaser.Math.Between(5, 10) * s;
        const tipX = px + fh * Math.sin(rot);
        const tipY = WAY - fh * Math.cos(rot);
        // Stem
        g.lineStyle(0.8, 0x3a7a2a, 0.7);
        g.lineBetween(px, WAY, tipX, tipY);
        // Leaf on stem
        if (Math.random() > 0.5) {
          const lx = px + (tipX - px) * 0.4;
          const ly = WAY + (tipY - WAY) * 0.4;
          g.fillStyle(0x4a8a3a, 0.6);
          g.fillEllipse(lx + 2, ly, 3 * s, 1.5 * s);
        }
        // Petal
        const petalR = Phaser.Math.Between(2, 3) * s;
        g.fillStyle([0xffaaaa, 0xaaaaff, 0xffffaa, 0xffaaff, 0xaaffff][Phaser.Math.Between(0, 4)], 0.85);
        g.fillCircle(tipX, tipY, petalR);
        // Center dot
        g.fillStyle(0xffff88, 0.7);
        g.fillCircle(tipX, tipY, petalR * 0.35);
      }

      px += Math.round(Phaser.Math.Linear(150, 380, 1 - density)) + Phaser.Math.Between(-20, 20);
    }
  }

  // =====================================================================
  // FOREGROUND DETAILS — below walkingAreaY, in the underground zone
  // =====================================================================
  private drawForegroundDetails(SW: number): void {
    const g = this.add.graphics().setDepth(ForestStage.FOREGROUND_LAYER_DEPTH + 45);
    const GY = GROUND_MAX_Y;
    let cx = Phaser.Math.Between(50, 150);
    while (cx < SW) {
      const clusterType = Phaser.Math.Between(0, 3);
      const s = Phaser.Math.FloatBetween(0.85, 1.15);

      if (clusterType === 0) {
        // Dirt crack lines
        g.lineStyle(1, 0x1a1208, 0.4);
        const len = Phaser.Math.Between(15, 35);
        let px = cx, py = GY + Phaser.Math.Between(10, 50);
        g.beginPath();
        g.moveTo(px, py);
        for (let seg = 0; seg < Phaser.Math.Between(2, 4); seg++) {
          px += Phaser.Math.Between(-8, 12);
          py += Phaser.Math.Between(-4, 6);
          g.lineTo(px, py);
        }
        g.strokePath();
      } else if (clusterType === 1) {
        // Embedded stones
        for (let st = 0; st < Phaser.Math.Between(1, 3); st++) {
          const sx = cx + Phaser.Math.Between(-15, 15);
          const sy = GY + Phaser.Math.Between(8, 45);
          const sw = Phaser.Math.Between(4, 10) * s;
          const sh = Phaser.Math.Between(3, 6) * s;
          g.fillStyle([0x5a5040, 0x4a4030, 0x6a6050][Phaser.Math.Between(0, 2)], 0.4);
          g.fillEllipse(sx, sy, sw, sh);
        }
      } else if (clusterType === 2) {
        // Root silhouette curving through soil
        g.lineStyle(2.5 * s, 0x2a1a0e, 0.35);
        g.beginPath();
        const ry = GY + Phaser.Math.Between(5, 30);
        g.moveTo(cx - 20 * s, ry);
        g.lineTo(cx, ry - 6 * s);
        g.lineTo(cx + 15 * s, ry + 3 * s);
        g.lineTo(cx + 30 * s, ry - 2 * s);
        g.strokePath();
      } else {
        // Soil texture patch — slightly different color
        g.fillStyle([0x2e1e10, 0x341e0e, 0x261a0c][Phaser.Math.Between(0, 2)], 0.25);
        g.fillEllipse(cx, GY + Phaser.Math.Between(10, 50),
          Phaser.Math.Between(20, 50) * s, Phaser.Math.Between(8, 18) * s);
      }

      cx += Phaser.Math.Between(200, 400);
    }
  }

  private generateTerrainTextures(): void {
    // --- Grass edge strip (16px tall, tileable) ---
    if (!this.textures.exists('terrain-edge')) {
      const edgeW = 256, edgeH = 16;
      const edgeTex = this.textures.createCanvas('terrain-edge', edgeW, edgeH);
      const ec = edgeTex!.getContext();
      // Bright grass highlight
      ec.fillStyle = '#5a9a48';
      ec.fillRect(0, 0, edgeW, edgeH);
      // Brighter top strip
      ec.fillStyle = '#6aaa58';
      ec.fillRect(0, 0, edgeW, 5);
      // Painted streaks for texture variation
      for (let i = 0; i < 30; i++) {
        const sx = Math.random() * edgeW;
        ec.fillStyle = Math.random() > 0.5 ? '#5aaa4a' : '#4a8a38';
        ec.fillRect(sx, Math.random() * edgeH, 3 + Math.random() * 8, 2 + Math.random() * 4);
      }
      edgeTex!.refresh();
    }

    // --- Main grass body (64px tall, tileable) ---
    if (!this.textures.exists('terrain-grass')) {
      const gW = 256, gH = 64;
      const gTex = this.textures.createCanvas('terrain-grass', gW, gH);
      const gc = gTex!.getContext();
      // Base green
      gc.fillStyle = '#3a7a2a';
      gc.fillRect(0, 0, gW, gH);
      // Painted variation — streaks and patches
      for (let i = 0; i < 50; i++) {
        const px = Math.random() * gW;
        const py = Math.random() * gH;
        gc.fillStyle = ['#3a8030', '#347828', '#408a34', '#2e7020', '#468e38'][Math.floor(Math.random() * 5)];
        gc.fillRect(px, py, 4 + Math.random() * 12, 2 + Math.random() * 6);
      }
      // Subtle darker patches
      for (let i = 0; i < 15; i++) {
        gc.fillStyle = 'rgba(20,40,10,0.15)';
        gc.beginPath();
        gc.ellipse(Math.random() * gW, Math.random() * gH, 8 + Math.random() * 20, 4 + Math.random() * 8, 0, 0, Math.PI * 2);
        gc.fill();
      }
      gTex!.refresh();
    }

    // --- Shadow strip (12px tall, tileable) ---
    if (!this.textures.exists('terrain-shadow')) {
      const sW = 256, sH = 12;
      const sTex = this.textures.createCanvas('terrain-shadow', sW, sH);
      const sc = sTex!.getContext();
      // Dark gradient shadow
      const grad = sc.createLinearGradient(0, 0, 0, sH);
      grad.addColorStop(0, '#2a5a1a');
      grad.addColorStop(0.5, '#1a3a0e');
      grad.addColorStop(1, '#1a2a0a');
      sc.fillStyle = grad;
      sc.fillRect(0, 0, sW, sH);
      sTex!.refresh();
    }

    // --- Underground strip (64px tall, tileable) ---
    if (!this.textures.exists('terrain-underground')) {
      const uW = 256, uH = 64;
      const uTex = this.textures.createCanvas('terrain-underground', uW, uH);
      const uc = uTex!.getContext();
      // Dark earth gradient
      const grad = uc.createLinearGradient(0, 0, 0, uH);
      grad.addColorStop(0, '#3a2a14');
      grad.addColorStop(0.3, '#2a1a0a');
      grad.addColorStop(1, '#1a1008');
      uc.fillStyle = grad;
      uc.fillRect(0, 0, uW, uH);
      // Dirt texture — small specks and streaks
      for (let i = 0; i < 40; i++) {
        uc.fillStyle = ['#2e1e0e', '#3a2814', '#221408'][Math.floor(Math.random() * 3)];
        uc.fillRect(Math.random() * uW, Math.random() * uH, 2 + Math.random() * 6, 1 + Math.random() * 3);
      }
      // Scattered pebbles
      for (let i = 0; i < 10; i++) {
        uc.fillStyle = 'rgba(80,70,50,0.3)';
        uc.beginPath();
        uc.ellipse(Math.random() * uW, Math.random() * uH, 2 + Math.random() * 3, 1 + Math.random() * 2, 0, 0, Math.PI * 2);
        uc.fill();
      }
      uTex!.refresh();
    }
  }

  // ===== AMBIENT PARTICLES — drifting leaves + warm embers =====
  // Adds atmospheric depth on top of the static parallax. Uses tweened
  // Graphics objects (cheap, predictable) — does not require a particle
  // texture, so works without external assets.
  private buildAmbientParticles(): void {
    // ---- Drifting leaves ----
    // Spawn ~16 leaves continuously cycling across the screen at parallax 0.7.
    // Each leaf is an organic blob shape that drifts down + sideways and rotates.
    const STAGE_W = STAGE_WIDTH;
    const spawnLeaf = (initialX?: number) => {
      const startX = initialX ?? Phaser.Math.Between(0, STAGE_W);
      const startY = Phaser.Math.Between(80, 200);
      const leaf = this.add.graphics().setDepth(-25).setScrollFactor(0.7);
      const colors = [0xc8a040, 0xa07028, 0x884a18, 0xb86c20, 0x986030];
      const c = colors[Phaser.Math.Between(0, colors.length - 1)];
      const pts = paint.blobPath(0, 0, 4, 2, { sides: 6, jitter: 0.4, seed: Phaser.Math.Between(1, 9999) });
      leaf.fillStyle(c, 0.85);
      leaf.fillPoints(pts, true);
      leaf.lineStyle(0.8, 0x2a1a08, 0.9);
      leaf.strokePoints(pts, true, true);
      leaf.x = startX;
      leaf.y = startY;
      leaf.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const targetX = startX + Phaser.Math.Between(-60, 80);
      const leafHeroY = this.hero?.groundY ?? GROUND_MAX_Y;
      const targetY = Phaser.Math.Between(leafHeroY - 40, leafHeroY + 20);
      const dur = Phaser.Math.Between(8000, 14000);
      this.tweens.add({
        targets: leaf,
        x: targetX,
        y: targetY,
        rotation: leaf.rotation + Phaser.Math.FloatBetween(-3, 3),
        alpha: { from: 0.85, to: 0 },
        duration: dur,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          leaf.destroy();
          spawnLeaf();
        },
      });
    };
    for (let i = 0; i < 18; i++) {
      // Stagger the initial population so they don't all spawn at the same Y
      this.time.delayedCall(i * 200, () => spawnLeaf());
    }

    // ---- Warm embers ----
    // Smaller and brighter than leaves, drifting upward (heat rising) at
    // parallax 0.5 (mid background). Adds a subtle glow to the scene.
    const spawnEmber = (initialX?: number) => {
      const startX = initialX ?? Phaser.Math.Between(0, STAGE_W);
      const heroY = this.hero?.groundY ?? GROUND_MIN_Y;
      const startY = Phaser.Math.Between(heroY - 40, heroY + 10);
      const ember = this.add.graphics().setDepth(-22).setScrollFactor(0.5);
      const sz = Phaser.Math.FloatBetween(1.0, 2.2);
      ember.fillStyle(0xffe080, 0.85);
      ember.fillCircle(0, 0, sz);
      ember.fillStyle(0xffffff, 0.6);
      ember.fillCircle(0, 0, sz * 0.45);
      ember.x = startX;
      ember.y = startY;
      const dur = Phaser.Math.Between(4000, 8000);
      this.tweens.add({
        targets: ember,
        x: startX + Phaser.Math.Between(-40, 40),
        y: startY - Phaser.Math.Between(140, 240),
        alpha: { from: 0.85, to: 0 },
        duration: dur,
        ease: 'Sine.easeOut',
        onComplete: () => {
          ember.destroy();
          spawnEmber();
        },
      });
    };
    for (let i = 0; i < 14; i++) {
      this.time.delayedCall(i * 280, () => spawnEmber());
    }

    // ---- Pollen / fireflies (small bright dots) ----
    // Slow drifting motes near the action lane, parallax 0.95 (almost foreground)
    for (let i = 0; i < 10; i++) {
      const startX = Phaser.Math.Between(0, STAGE_W);
      const pollenHeroY = this.hero?.groundY ?? GROUND_MIN_Y;
      const startY = Phaser.Math.Between(pollenHeroY - 80, pollenHeroY);
      const pollen = this.add.graphics().setDepth(-15).setScrollFactor(0.95);
      pollen.fillStyle(0xfff4c8, 0.9);
      pollen.fillCircle(0, 0, 1.2);
      pollen.fillStyle(0xffffff, 0.7);
      pollen.fillCircle(0, 0, 0.6);
      pollen.x = startX;
      pollen.y = startY;
      this.tweens.add({
        targets: pollen,
        x: startX + Phaser.Math.Between(-30, 30),
        y: startY + Phaser.Math.Between(-20, 20),
        alpha: { from: 0.9, to: 0.3 },
        duration: Phaser.Math.Between(2500, 5000),
        repeat: -1,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // --- Update loop ---

  update(time: number, delta: number): void {
    if (this.paused) return;

    // Contact shadows (Stage 1 only)
    if (this.contactShadowGfx) this.drawContactShadows();

    // Purge dead ghouls each frame
    this.ghouls = this.ghouls.filter(g => g.alive);

    this.hero.update(time, delta);

    // Walk mask enforcement — clamp hero to painted walkable area
    if (this.walkMask.isLoaded && !this.hero.isDead) {
      if (!this.walkMask.isWalkable(this.hero.x, this.hero.y)) {
        const clamped = this.walkMask.clampToWalkable(this.hero.x, this.hero.y);
        this.hero.x = clamped.x;
        this.hero.y = clamped.y;
        const body = this.hero.body as Phaser.Physics.Arcade.Body;
        if (body) { body.x = clamped.x - body.halfWidth; body.y = clamped.y - body.halfHeight; }
      }
    }

    // ----- Movement dust puffs at the hero's feet -----
    // Spawns a small dust cloud every ~120 ms while the hero is moving at
    // >40% speed, grounded, and not in a finisher jump.
    if (!this.hero.isDead) {
      const body = this.hero.body as Phaser.Physics.Arcade.Body;
      const speed = Math.abs(body.velocity.x) + Math.abs(body.velocity.y);
      const isMovingFast = speed > this.hero.stats.moveSpeed * 0.4;
      const isGrounded = this.hero.jumpZ >= -1;
      if (isMovingFast && isGrounded) {
        this.movementDustTimer -= delta;
        if (this.movementDustTimer <= 0) {
          this.movementDustTimer = 120; // ms between puffs
          spawnDustPuff(this, this.hero.x, this.hero.groundY, {
            count: 2,
            color: 0xb8a882,
            spread: 12,
            duration: 260,
          });
        }
      } else {
        this.movementDustTimer = 0;
      }
    }

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

    // Advanced skills (level 30/50/70) — necromancer-specific handlers
    if (this.heroClass.id === 'necromancer') {
      if (this.boneVolleyCooldown > 0) this.boneVolleyCooldown -= delta;
      this.handleBoneVolley();
      this.handleWraithForm(delta);
      this.handleSoulApocalypse(delta);
    } else {
      // Generic class skill dispatcher for non-necromancer classes
      this.tickClassSkills(delta);
    }

    // Sidekick (companion creature)
    if (this.sidekick) {
      this.sidekick.update(time, delta);
      this.tickSidekickAbility(this.sidekick);
    }

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
        this.handleBossSporeJump(enemy, delta);
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.alive) { this.projectiles.splice(i, 1); continue; }
      proj.update(time, delta);
    }
    // Update enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      if (!proj.alive) { this.enemyProjectiles.splice(i, 1); continue; }
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
    this.checkEnemyProjectileHits();
    this.checkGhoulHits(enemies);
    this.checkEnemyAttackHits(enemies);

    // Snap camera to whole pixels to prevent subpixel jitter on the background
    const cam = this.cameras.main;
    cam.scrollX = Math.round(cam.scrollX);
    cam.scrollY = Math.round(cam.scrollY);
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
    // Paladin's swings have heavy hitting force — every basic attack knocks
    // enemies away. The JUMP SMASH FINISHER hits even harder and shakes the
    // camera to sell the slam impact.
    const isPaladin = this.heroClass.id === 'paladin';
    const isFinisher = isPaladin && this.hero.isFinisherImpact();
    let finisherLanded = false;

    for (const enemy of enemies) {
      if (enemy.isDead || this.hero.hitEnemies.has(enemy.id)) continue;

      let hit = false;

      if (isFinisher) {
        // ----- FINISHER: radial distance check centered on the hero -----
        // Hits in EVERY direction — front, back, touching. No facing limit.
        const dist = Phaser.Math.Distance.Between(
          this.hero.x, this.hero.groundY,
          enemy.x, enemy.groundY,
        );
        if (dist <= MELEE_TUNE.finisherRadius) hit = true;
      } else {
        // ----- BASIC COMBO: rectangle overlap (directional) -----
        const yBand = 30;
        if (Math.abs(this.hero.groundY - enemy.groundY) > yBand) continue;
        const enemyRect = enemy.getBodyWorldRect();
        if (Phaser.Geom.Rectangle.Overlaps(heroHitRect, enemyRect)) hit = true;
      }

      if (hit) {
        this.hero.hitEnemies.add(enemy.id);
        enemy.takeDamage(this.hero.currentHitboxDamage);
        if (isPaladin) {
          enemy.applyKnockback(this.hero.x, isFinisher ? MELEE_TUNE.finisherKnockbackForce : 380);
        }
        if (isFinisher) finisherLanded = true;
        this.cameras.main.shake(50, 0.002);

        // ----- COMBAT FX: hit sparks burst at the impact point -----
        const hitX = isFinisher ? enemy.x : (heroHitRect.x + heroHitRect.right) / 2;
        const hitY = enemy.groundY - 22;
        spawnHitSparks(this, hitX, hitY, {
          count: isFinisher ? 14 : 8,
          radius: isFinisher ? 50 : 32,
          color: isFinisher ? 0xffeebb : 0xffffff,
        });
      }
    }

    // ----- HEAVY HIT FX: only on finisher slam -----
    if (finisherLanded) {
      this.cameras.main.shake(MELEE_TUNE.finisherShakeDuration, MELEE_TUNE.finisherShakeIntensity);
      spawnHitStop(this, 90);
      // Holy burst — golden light explosion with splash damage VFX
      spawnHolyBurst(this, this.hero.x, this.hero.groundY, {
        radius: 260, rayCount: 16, particleCount: 28, duration: 700,
      });
      // Slam shockwave at the hero's feet
      spawnShockwave(this, this.hero.x, this.hero.groundY, {
        color: 0xffeebb, maxRadius: 260, duration: 500,
      });
      spawnDustPuff(this, this.hero.x, this.hero.groundY, {
        count: 14, spread: 60, duration: 500, color: 0xddccaa,
      });
    }
  }

  // --- Combat: projectiles ---

  private checkProjectileHits(enemies: Enemy[]): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;

      const projRect = proj.getWorldRect();
      const isPiercing = (proj.config.pierce ?? 0) > 0;

      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        if (Math.abs(proj.groundY - enemy.groundY) > (enemy.isBoss ? 120 : 30)) continue;
        // Piercing projectiles never hit the same enemy twice
        if (isPiercing && proj.hitEnemies.has(enemy.id)) continue;

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

          if (isPiercing) {
            proj.hitEnemies.add(enemy.id);
            proj.pierceLeft--;
            if (proj.pierceLeft <= 0) {
              proj.die();
              break;
            }
            // Continue scanning other enemies in the same frame
            continue;
          }

          proj.die();
          break; // Non-piercing projectile hits one enemy
        }
      }
    }
  }

  /** Check enemy projectiles hitting the hero. */
  private checkEnemyProjectileHits(): void {
    if (this.hero.isDead) return;
    for (const proj of this.enemyProjectiles) {
      if (!proj.alive) continue;
      // Check groundY proximity (same as hero projectile logic)
      if (Math.abs(proj.groundY - this.hero.groundY) > 40) continue;
      // Check rectangle overlap
      const projRect = proj.getWorldRect();
      const heroBody = this.hero.body as Phaser.Physics.Arcade.Body;
      const heroRect = new Phaser.Geom.Rectangle(
        this.hero.x + heroBody.offset.x, this.hero.y + heroBody.offset.y,
        heroBody.width, heroBody.height,
      );
      if (Phaser.Geom.Rectangle.Overlaps(projRect, heroRect)) {
        this.hero.takeDamage(proj.config.damage);
        proj.die();
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

      // Check hero — skip entirely when the hero is in the post-hit immunity
      // window so enemies can't pin or body-block the hero with overlapping hits.
      if (!this.hero.isDead && !this.hero.isDamageImmune) {
        if (Math.abs(this.hero.groundY - enemy.groundY) <= (enemy.isBoss ? 100 : 30) && this.hero.jumpZ >= -30) {
          const heroRect = new Phaser.Geom.Rectangle(
            this.hero.x - 14,
            this.hero.groundY - 44 + this.hero.jumpZ,
            28, 44,
          );
          if (Phaser.Geom.Rectangle.Overlaps(enemyHitRect, heroRect)) {
            enemy.hitHero = true;
            this.hero.applyKnockback(enemy.x, enemy.isBoss ? 3420 : 2700);
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

  // =================================================================
  // DRAGON MOUNT (Paladin only)
  // =================================================================

  private mountDragon(): void {
    if (this.dragonMounted) return;
    this.dragonMounted = true;
    this.dragonOrigSpeed = this.hero.stats.moveSpeed;
    this.hero.stats.moveSpeed = this.dragonOrigSpeed * 5;
    this.hero.isInvulnerable = true;
    this.hero.isMounted = true;
    this.hero.playSheetAnim('MOUNTED');

    // ── Mount socket: the point on the dragon where the saddle seat is.
    // Dragon body center sits at dragonY below hero origin.
    // Saddle seat is at roughly y = dragonY - 24 in hero-local space.
    // Hero's hip (anchor for seated pose) is at bodyGroup local y = -27.
    // So we shift bodyGroup.y so the hip lands on the saddle:
    //   saddleSeatY = dragonY - 24
    //   hipInBodyGroup = -27
    //   bodyGroup.y = saddleSeatY - hipInBodyGroup = saddleSeatY + 27
    const dragonY = 15;
    const saddleSeatY = dragonY - 24;  // mount socket Y
    const mountedBodyY = saddleSeatY + 27; // shifts hero so hip sits on saddle
    this.dragonBody = this.add.container(0, dragonY);
    this.hero.addAt(this.dragonBody, 0); // add behind hero body parts

    // Shift hero so hips sit on the saddle mount socket
    this.hero.bodyGroup.y = mountedBodyY;

    // Splay legs outward for a riding/seated pose
    if (this.hero.legLeftPivot) {
      this.hero.legLeftPivot.angle = 55;   // left leg out to the side
      // Tuck the knee container if it exists
      const kneeL = this.hero.legLeftPivot.getAt(1) as Phaser.GameObjects.Container | undefined;
      if (kneeL && 'angle' in kneeL) (kneeL as any).angle = -40;
    }
    if (this.hero.legRightPivot) {
      this.hero.legRightPivot.angle = -55;  // right leg out to other side
      const kneeR = this.hero.legRightPivot.getAt(1) as Phaser.GameObjects.Container | undefined;
      if (kneeR && 'angle' in kneeR) (kneeR as any).angle = 40;
    }
    // Slight forward lean on upper body for a natural riding posture
    if (this.hero.upperBodyPivot) {
      this.hero.upperBodyPivot.angle = 5;
    }

    const g = this.add.graphics();
    this.dragonBody.add(g);

    // --- Dragon body (large, reptilian) ---
    // Torso — long horizontal body
    g.fillStyle(0x884422, 1);
    g.fillEllipse(0, -12, 80, 24);
    // Belly scales (lighter underside)
    g.fillStyle(0xcc8844, 0.8);
    g.fillEllipse(0, -6, 55, 14);
    // Back ridge scales
    for (let s = 0; s < 5; s++) {
      const sx = -18 + s * 9;
      g.fillStyle(0x6a3318, 0.9);
      g.fillTriangle(sx, -24, sx + 4, -30, sx + 8, -24);
    }

    // --- SADDLE (where paladin sits) ---
    // Saddle base — brown leather pad on dragon's back
    g.fillStyle(0x553322, 1);
    g.fillEllipse(0, -24, 22, 8);
    // Saddle pommel (front rise)
    g.fillStyle(0x442211, 1);
    g.fillRect(8, -30, 4, 8);
    g.fillEllipse(10, -31, 6, 4);
    // Saddle cantle (back rise)
    g.fillRect(-10, -29, 4, 7);
    g.fillEllipse(-9, -30, 5, 3);
    // Stirrup straps (hanging down each side)
    g.lineStyle(1.5, 0x442211, 0.8);
    g.lineBetween(-5, -20, -8, -8);
    g.lineBetween(5, -20, 8, -8);
    // Stirrup rings
    g.lineStyle(1.5, 0x888888, 0.7);
    g.strokeCircle(-8, -6, 3);
    g.strokeCircle(8, -6, 3);
    // Saddle blanket edges (red cloth peeking out)
    g.fillStyle(0xaa2222, 0.7);
    g.fillRect(-12, -22, 24, 3);

    // --- Neck (extending forward and up) ---
    g.fillStyle(0x884422, 1);
    g.beginPath();
    g.moveTo(35, -18); g.lineTo(58, -40); g.lineTo(63, -30); g.lineTo(38, -10);
    g.closePath(); g.fillPath();
    // Neck scales
    g.lineStyle(1, 0x6a3318, 0.4);
    for (let n = 0; n < 4; n++) {
      const t = n / 4;
      const nx = 38 + t * 22; const ny = -14 - t * 20;
      g.lineBetween(nx - 3, ny, nx + 3, ny);
    }

    // --- Head (angular, reptilian) ---
    g.fillStyle(0x995533, 1);
    g.beginPath();
    g.moveTo(58, -42); g.lineTo(80, -38); g.lineTo(78, -28); g.lineTo(60, -30);
    g.closePath(); g.fillPath();
    // Jaw (opens slightly)
    g.fillStyle(0x774422, 1);
    g.beginPath();
    g.moveTo(60, -30); g.lineTo(78, -28); g.lineTo(76, -22); g.lineTo(58, -25);
    g.closePath(); g.fillPath();
    // Teeth
    g.fillStyle(0xeeeedd, 0.8);
    for (let t = 0; t < 4; t++) {
      g.fillTriangle(62 + t * 4, -28, 64 + t * 4, -24, 66 + t * 4, -28);
    }
    // Eye (fierce, glowing)
    g.fillStyle(0xff2200, 1);
    g.fillCircle(68, -36, 3.5);
    g.fillStyle(0xffaa00, 1);
    g.fillCircle(68, -36, 1.5);
    // Horns (two curved)
    g.fillStyle(0x553318, 1);
    g.fillTriangle(62, -42, 55, -56, 60, -41);
    g.fillTriangle(67, -42, 63, -54, 68, -41);
    // Nostrils
    g.fillStyle(0x444444, 0.5);
    g.fillCircle(79, -32, 2);
    g.fillCircle(77, -34, 1.5);

    // --- Wings (large, bat-like, behind the saddle) ---
    // Left wing (top, spread wide)
    g.fillStyle(0x774422, 0.85);
    g.beginPath();
    g.moveTo(-8, -22); g.lineTo(-55, -70); g.lineTo(-40, -50);
    g.lineTo(-65, -60); g.lineTo(-35, -40);
    g.lineTo(-50, -42); g.lineTo(-18, -20);
    g.closePath(); g.fillPath();
    // Wing membrane
    g.fillStyle(0xaa6633, 0.25);
    g.beginPath();
    g.moveTo(-8, -20); g.lineTo(-55, -68); g.lineTo(-50, -42); g.lineTo(-18, -18);
    g.closePath(); g.fillPath();
    // Right wing (behind, slightly smaller)
    g.fillStyle(0x664418, 0.65);
    g.beginPath();
    g.moveTo(-8, -18); g.lineTo(-45, -55); g.lineTo(-30, -38);
    g.lineTo(-40, -42); g.lineTo(-15, -16);
    g.closePath(); g.fillPath();

    // --- Tail (long, curving back) ---
    g.lineStyle(5, 0x884422, 1);
    g.beginPath();
    g.moveTo(-35, -10); g.lineTo(-55, -4); g.lineTo(-70, -10); g.lineTo(-82, -2);
    g.strokePath();
    // Tail spade
    g.fillStyle(0x664422, 1);
    g.fillTriangle(-82, -8, -94, -2, -82, 4);

    // --- Legs (tucked under while flying) ---
    g.fillStyle(0x774422, 1);
    // Front legs (thicker, with claws)
    g.fillRect(20, -4, 7, 16);
    g.fillStyle(0x664418, 1);
    g.fillTriangle(19, 12, 22, 16, 25, 12);
    g.fillTriangle(23, 12, 26, 16, 29, 12);
    // Back legs
    g.fillStyle(0x774422, 1);
    g.fillRect(-18, -4, 7, 16);
    g.fillStyle(0x664418, 1);
    g.fillTriangle(-19, 12, -16, 16, -13, 12);
    g.fillTriangle(-15, 12, -12, 16, -9, 12);

    // Wing flap animation — bob the whole dragon gently
    this.tweens.add({
      targets: this.dragonBody,
      y: { from: dragonY, to: dragonY - 6 },
      duration: 400,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Dramatic entrance — screen flash + text
    this.cameras.main.flash(300, 255, 150, 50);
    const mountText = this.add.text(640, 200, 'DRAGON MOUNT!', {
      fontSize: '36px', color: '#ff8822', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({
      targets: mountText, alpha: 0, y: 170,
      duration: 1500, onComplete: () => mountText.destroy(),
    });
  }

  private dismountDragon(): void {
    if (!this.dragonMounted) return;
    this.dragonMounted = false;
    this.hero.stats.moveSpeed = this.dragonOrigSpeed;
    this.hero.isInvulnerable = false;
    this.hero.isMounted = false;
    this.hero.playSheetAnim('IDLE');

    // Reset hero body to standing pose
    this.hero.bodyGroup.y = 0;
    if (this.hero.legLeftPivot) {
      this.hero.legLeftPivot.angle = 0;
      const kneeL = this.hero.legLeftPivot.getAt(1) as Phaser.GameObjects.Container | undefined;
      if (kneeL && 'angle' in kneeL) (kneeL as any).angle = 0;
    }
    if (this.hero.legRightPivot) {
      this.hero.legRightPivot.angle = 0;
      const kneeR = this.hero.legRightPivot.getAt(1) as Phaser.GameObjects.Container | undefined;
      if (kneeR && 'angle' in kneeR) (kneeR as any).angle = 0;
    }
    if (this.hero.upperBodyPivot) {
      this.hero.upperBodyPivot.angle = 0;
    }

    // Remove dragon visual
    if (this.dragonBody) {
      this.tweens.killTweensOf(this.dragonBody);
      this.dragonBody.destroy();
      this.dragonBody = null;
    }
  }

  private dragonFireTimer = 0;

  /** Continuous fire breath — spawns flame particles and kills enemies every tick. */
  private tickDragonFireBreath(): void {
    // Flip dragon to match hero facing direction
    if (this.dragonBody) {
      this.dragonBody.scaleX = this.hero.facingRight ? 1 : -1;
    }

    const dirX = this.hero.facingRight ? 1 : -1;
    const mouthX = this.hero.x + dirX * 60;
    const mouthY = this.hero.groundY - 35;

    // Spawn 2-3 flame particles per frame from the dragon's mouth
    for (let i = 0; i < 3; i++) {
      const spreadDist = Phaser.Math.Between(30, 350);
      const spreadY = Phaser.Math.Between(-20, 20) * (spreadDist / 200);
      const fx = mouthX + dirX * spreadDist;
      const fy = mouthY + spreadY;
      const size = 4 + (spreadDist / 350) * 12;
      const colors = [0xff2200, 0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffcc00, 0xffee44];
      const color = colors[Phaser.Math.Between(0, colors.length - 1)];
      const alpha = 0.9 - (spreadDist / 350) * 0.6;
      const flame = this.add.circle(fx, fy, size, color, alpha)
        .setDepth(this.hero.groundY + 5);
      this.tweens.add({
        targets: flame,
        x: fx + dirX * Phaser.Math.Between(20, 60),
        y: fy + Phaser.Math.Between(-10, 10),
        scaleX: 0.1, scaleY: 0.1, alpha: 0,
        duration: 200 + Math.random() * 150,
        onComplete: () => flame.destroy(),
      });
    }

    // Persistent fire stream glow (redrawn every few frames)
    this.dragonFireTimer++;
    if (this.dragonFireTimer % 3 === 0) {
      const stream = this.add.graphics().setDepth(this.hero.groundY + 4);
      const streamW = 350;
      const streamH = 40;
      const streamCX = mouthX + dirX * streamW / 2;
      // Outer glow
      stream.fillStyle(0xff4400, 0.12);
      stream.fillEllipse(streamCX, mouthY, streamW, streamH * 1.4);
      // Core
      stream.fillStyle(0xff8800, 0.15);
      stream.fillEllipse(streamCX, mouthY, streamW * 0.7, streamH * 0.7);
      // Hot center
      stream.fillStyle(0xffcc44, 0.1);
      stream.fillEllipse(mouthX + dirX * streamW * 0.2, mouthY, streamW * 0.3, streamH * 0.4);
      this.tweens.add({
        targets: stream, alpha: 0, duration: 150,
        onComplete: () => stream.destroy(),
      });
    }

    // Subtle continuous camera rumble
    if (this.dragonFireTimer % 10 === 0) {
      this.cameras.main.shake(50, 0.002);
    }

    // Smoke wisps rising from the fire stream
    if (this.dragonFireTimer % 8 === 0) {
      const smokeX = mouthX + dirX * Phaser.Math.Between(50, 300);
      const smoke = this.add.circle(smokeX, mouthY - 5, Phaser.Math.Between(4, 8), 0x444444, 0.25)
        .setDepth(this.hero.groundY + 6);
      this.tweens.add({
        targets: smoke,
        y: mouthY - Phaser.Math.Between(30, 60),
        alpha: 0, scaleX: 2, scaleY: 2,
        duration: 600,
        onComplete: () => smoke.destroy(),
      });
    }

    // Kill ALL enemies in the fire cone — every frame, no cooldown
    const enemies = this.waveSpawner.getEnemies();
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = (enemy.x - this.hero.x) * dirX;
      if (dx > -20 && dx < 400) {
        const dy = Math.abs(enemy.groundY - this.hero.groundY);
        if (dy < 80) {
          enemy.takeDamage(99999);
        }
      }
    }
  }
}
