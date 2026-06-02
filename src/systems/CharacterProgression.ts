/** Persistent character progression that carries between stages. */
export interface CharacterProgression {
  // Attribute points (1 per level, spent on class-specific attributes)
  attrPointsAvailable: number;
  attributes: Record<string, number>;

  // Skill points (1 per level, spent on upgrading skills)
  skillPointsAvailable: number;
  skills: Record<string, number>;

  // Owned weapons (purchased items)
  ownedWeapons?: string[];
  // Currently equipped weapon ID
  equippedWeapon?: string;

  // Owned sidekicks (purchased companions)
  ownedSidekicks?: string[];
  // Currently equipped sidekick ID
  equippedSidekick?: string;

  // Per-sidekick leveling state
  sidekickLevels?: Record<string, number>;                       // sidekickId → current level
  sidekickXp?: Record<string, number>;                           // sidekickId → currentXp toward next level
  sidekickSkillPoints?: Record<string, number>;                  // sidekickId → unspent SP
  sidekickSkills?: Record<string, Record<string, number>>;       // sidekickId → skillId → level
}

// Per-class attribute definitions
export interface AttributeDef {
  id: string;
  name: string;
  description: string;
  perPoint: string;  // human-readable effect per point
  maxPoints: number; // max points that can be invested
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  perPoint: string;
  maxLevel: number;
  costPerPoint?: number;    // skill points per upgrade (default 1)
  requiredLevel?: number;   // hero level required to unlock
}

// Necromancer attributes (8+7+7+7 = 29 points, all maxable by level 30)
export const NECROMANCER_ATTRIBUTES: AttributeDef[] = [
  { id: 'attackPower', name: 'Attack Power', description: 'Increases projectile damage.', perPoint: '+3 damage', maxPoints: 8 },
  { id: 'attackSpeed', name: 'Attack Speed', description: 'Faster cast speed.', perPoint: '-12% cast time', maxPoints: 7 },
  { id: 'attackRange', name: 'Attack Range', description: 'Increases projectile travel distance.', perPoint: '+50 range', maxPoints: 7 },
  { id: 'rotEffect', name: 'Rot Effect', description: 'Increases decay DOT damage and duration.', perPoint: '+5% decay, +0.5s duration', maxPoints: 7 },
];

// Necromancer skills — early skills unlock by level 15, advanced trio unlocks at 30
export const NECROMANCER_SKILLS: SkillDef[] = [
  { id: 'lifeLeech', name: 'Life Leech', description: 'Toggle: drain HP from nearby enemies, healing the necromancer.', perPoint: '+5 DPS, +3 heal/s per enemy', maxLevel: 3, costPerPoint: 3, requiredLevel: 5 },
  { id: 'summonGhoul', name: 'Summon Ghoul', description: 'Summon a ghoul that auto-attacks nearby enemies.', perPoint: '+1 ghoul, +10% ghoul damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 10 },
  { id: 'rot', name: 'Rot', description: 'Acid rain that slows and melts enemies in front of you for 3s.', perPoint: '+10% max HP DOT, 60% slow (15% base)', maxLevel: 5, costPerPoint: 2, requiredLevel: 15 },
  { id: 'boneVolley', name: 'Bone Spear Volley', description: 'Unleash a barrage of piercing bone spears that tear through everything in front of you.', perPoint: '+1 spear, +10 dmg', maxLevel: 5, costPerPoint: 2, requiredLevel: 30 },
  { id: 'wraithForm', name: 'Wraith Form', description: 'Become an incorporeal wraith for 3s — invulnerable, fast, and lethal to anything you pass through.', perPoint: '+0.5s duration, +20 contact dmg', maxLevel: 5, costPerPoint: 3, requiredLevel: 30 },
  { id: 'soulApocalypse', name: 'Soul Apocalypse', description: 'Unleash a void detonation that obliterates every enemy on screen and executes the wounded.', perPoint: '+100 dmg, +5% execute threshold', maxLevel: 3, costPerPoint: 4, requiredLevel: 30 },
];

// =============================================================================
// PALADIN — holy warrior, defense + healing
// =============================================================================
export const PALADIN_ATTRIBUTES: AttributeDef[] = [
  { id: 'attackPower', name: 'Attack Power', description: 'Increases weapon damage.', perPoint: '+3 damage', maxPoints: 8 },
  { id: 'defense', name: 'Defense', description: 'Reduces all incoming damage.', perPoint: '+2 defense', maxPoints: 8 },
  { id: 'vitality', name: 'Vitality', description: 'Boosts your max HP.', perPoint: '+15 max HP', maxPoints: 7 },
  { id: 'holyPower', name: 'Holy Power', description: 'Increases holy damage and healing strength.', perPoint: '+5% holy effect', maxPoints: 7 },
];
export const PALADIN_SKILLS: SkillDef[] = [
  { id: 'smite', name: 'Smite', description: 'Strike with a bolt of holy light that pierces enemies in front of you.', perPoint: '+12 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 5 },
  { id: 'layOnHands', name: 'Lay on Hands', description: 'Heal yourself for a large portion of your max HP.', perPoint: '+5% max HP healed', maxLevel: 5, costPerPoint: 2, requiredLevel: 10 },
  { id: 'consecration', name: 'Consecration', description: 'Sanctify the ground beneath you, burning enemies that step into the holy zone.', perPoint: '+1s duration, +5 dmg/s', maxLevel: 5, costPerPoint: 2, requiredLevel: 15 },
  { id: 'divineWrath', name: 'Divine Wrath', description: 'Unleash a cone of holy fire that scorches every enemy in front of you.', perPoint: '+20 damage, +1 enemy hit', maxLevel: 5, costPerPoint: 2, requiredLevel: 30 },
  { id: 'crusadersCharge', name: "Crusader's Charge", description: 'Charge forward, knocking back and damaging every enemy in your path.', perPoint: '+15 damage, +50 charge distance', maxLevel: 5, costPerPoint: 3, requiredLevel: 30 },
  { id: 'aegisEternal', name: 'Aegis Eternal', description: 'Surround yourself with a divine bubble that absorbs all damage for several seconds.', perPoint: '+0.5s duration', maxLevel: 3, costPerPoint: 4, requiredLevel: 30 },
];

// =============================================================================
// BARBARIAN — berserker, raw damage and crit
// =============================================================================
export const BARBARIAN_ATTRIBUTES: AttributeDef[] = [
  { id: 'attackPower', name: 'Attack Power', description: 'Increases weapon damage.', perPoint: '+4 damage', maxPoints: 8 },
  { id: 'attackSpeed', name: 'Attack Speed', description: 'Faster swings.', perPoint: '-10% swing time', maxPoints: 7 },
  { id: 'ferocity', name: 'Ferocity', description: 'Chance to land critical hits.', perPoint: '+3% crit chance', maxPoints: 7 },
  { id: 'toughness', name: 'Toughness', description: 'Reduces incoming damage.', perPoint: '+1 defense', maxPoints: 7 },
];
export const BARBARIAN_SKILLS: SkillDef[] = [
  { id: 'cleave', name: 'Cleave', description: 'A wide horizontal swing that hits every enemy in front of you.', perPoint: '+15 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 5 },
  { id: 'bloodthirst', name: 'Bloodthirst', description: 'Toggle: each kill restores HP for several seconds.', perPoint: '+2% HP per kill', maxLevel: 3, costPerPoint: 3, requiredLevel: 10 },
  { id: 'whirlwind', name: 'Whirlwind', description: 'Spin in a deadly whirlwind, damaging every enemy around you.', perPoint: '+0.5s duration, +5 dmg/tick', maxLevel: 5, costPerPoint: 2, requiredLevel: 15 },
  { id: 'earthshaker', name: 'Earthshaker', description: 'Smash the ground, sending out a shockwave that knocks enemies back.', perPoint: '+25 damage, +30 range', maxLevel: 5, costPerPoint: 2, requiredLevel: 30 },
  { id: 'berserkerRage', name: 'Berserker Rage', description: 'Enter a furious rage gaining massive attack speed and damage for several seconds.', perPoint: '+10% bonus damage', maxLevel: 5, costPerPoint: 3, requiredLevel: 30 },
  { id: 'decimate', name: 'Decimate', description: 'Unleash a screen-shaking AoE that crushes wounded enemies instantly.', perPoint: '+150 damage, +5% execute threshold', maxLevel: 3, costPerPoint: 4, requiredLevel: 30 },
];

// =============================================================================
// TEMPLAR KNIGHT — balanced melee and magic
// =============================================================================
export const TEMPLAR_ATTRIBUTES: AttributeDef[] = [
  { id: 'attackPower', name: 'Attack Power', description: 'Increases melee damage.', perPoint: '+3 damage', maxPoints: 7 },
  { id: 'defense', name: 'Defense', description: 'Reduces incoming damage.', perPoint: '+2 defense', maxPoints: 7 },
  { id: 'magicPower', name: 'Magic Power', description: 'Increases magical skill damage.', perPoint: '+4 magic damage', maxPoints: 7 },
  { id: 'vitality', name: 'Vitality', description: 'Increases your max HP.', perPoint: '+12 max HP', maxPoints: 8 },
];
export const TEMPLAR_SKILLS: SkillDef[] = [
  { id: 'powerStrike', name: 'Power Strike', description: 'A heavy overhead blow that deals massive single-target damage.', perPoint: '+18 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 5 },
  { id: 'magicBolt', name: 'Magic Bolt', description: 'Fire a glowing arcane bolt at the nearest enemy.', perPoint: '+10 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 10 },
  { id: 'sanctuary', name: 'Sanctuary', description: 'Plant a holy zone that heals you and damages enemies inside it.', perPoint: '+1s duration, +3 heal/s', maxLevel: 5, costPerPoint: 2, requiredLevel: 15 },
  { id: 'mysticSlash', name: 'Mystic Slash', description: 'Dash through enemies, leaving a trail of magical blades that damage everything you pass.', perPoint: '+15 damage, +30 dash range', maxLevel: 5, costPerPoint: 2, requiredLevel: 30 },
  { id: 'divineAegis', name: 'Divine Aegis', description: 'Reduce all incoming damage by half for several seconds.', perPoint: '+0.5s duration', maxLevel: 5, costPerPoint: 3, requiredLevel: 30 },
  { id: 'templarsWrath', name: "Templar's Wrath", description: 'Unleash a holy explosion that damages and stuns all enemies on screen.', perPoint: '+120 damage, +0.5s stun', maxLevel: 3, costPerPoint: 4, requiredLevel: 30 },
];

// =============================================================================
// MAGE — arcane caster
// =============================================================================
export const MAGE_ATTRIBUTES: AttributeDef[] = [
  { id: 'spellPower', name: 'Spell Power', description: 'Increases all spell damage.', perPoint: '+5 damage', maxPoints: 8 },
  { id: 'castSpeed', name: 'Cast Speed', description: 'Faster spellcasting.', perPoint: '-10% cast time', maxPoints: 7 },
  { id: 'spellRange', name: 'Spell Range', description: 'Increases the range of your spells.', perPoint: '+50 range', maxPoints: 7 },
  { id: 'arcaneEffect', name: 'Arcane Effect', description: 'Increases the duration and area of spell effects.', perPoint: '+8% effect strength', maxPoints: 7 },
];
export const MAGE_SKILLS: SkillDef[] = [
  { id: 'frostbolt', name: 'Frostbolt', description: 'Hurl a freezing bolt that slows enemies on impact.', perPoint: '+10 damage, +0.3s slow', maxLevel: 5, costPerPoint: 2, requiredLevel: 5 },
  { id: 'arcaneShield', name: 'Arcane Shield', description: 'Surround yourself with a magical barrier that absorbs damage.', perPoint: '+20 absorb', maxLevel: 5, costPerPoint: 2, requiredLevel: 10 },
  { id: 'fireball', name: 'Fireball', description: 'Cast a roaring fireball that explodes in a wide area on impact.', perPoint: '+25 damage, +20 radius', maxLevel: 5, costPerPoint: 2, requiredLevel: 15 },
  { id: 'lightningStorm', name: 'Lightning Storm', description: 'Call down lightning bolts on random enemies for several seconds.', perPoint: '+1 bolt/s, +20 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 30 },
  { id: 'timeWarp', name: 'Time Warp', description: 'Slow time itself, halving the speed of every enemy on screen.', perPoint: '+0.5s duration', maxLevel: 5, costPerPoint: 3, requiredLevel: 30 },
  { id: 'meteorStrike', name: 'Meteor Strike', description: 'Summon a colossal meteor from the sky that obliterates everything in its crater.', perPoint: '+200 damage, +30 radius', maxLevel: 3, costPerPoint: 4, requiredLevel: 30 },
];

// =============================================================================
// ARCHER — ranged precision
// =============================================================================
export const ARCHER_ATTRIBUTES: AttributeDef[] = [
  { id: 'attackPower', name: 'Attack Power', description: 'Increases arrow damage.', perPoint: '+3 damage', maxPoints: 8 },
  { id: 'attackSpeed', name: 'Attack Speed', description: 'Faster bow draw.', perPoint: '-10% draw time', maxPoints: 7 },
  { id: 'attackRange', name: 'Attack Range', description: 'Increases arrow flight distance.', perPoint: '+60 range', maxPoints: 7 },
  { id: 'criticalHit', name: 'Critical Hit', description: 'Chance for double-damage shots.', perPoint: '+3% crit chance', maxPoints: 7 },
];
export const ARCHER_SKILLS: SkillDef[] = [
  { id: 'multishot', name: 'Multishot', description: 'Fire three arrows in a fan, hitting multiple enemies at once.', perPoint: '+1 arrow, +5 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 5 },
  { id: 'eagleEye', name: 'Eagle Eye', description: 'Sharpen your aim, gaining bonus crit and range for several seconds.', perPoint: '+10% crit, +1s duration', maxLevel: 5, costPerPoint: 2, requiredLevel: 10 },
  { id: 'pinDown', name: 'Pin Down', description: 'Pierce the nearest enemy with a slowing arrow that anchors them in place.', perPoint: '+0.5s slow, +15 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 15 },
  { id: 'rainOfArrows', name: 'Rain of Arrows', description: 'Fire arrows into the sky that rain down across a wide area in front of you.', perPoint: '+5 arrows, +10 damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 30 },
  { id: 'phantomStep', name: 'Phantom Step', description: 'Vanish in a puff of smoke, becoming briefly invulnerable and dashing.', perPoint: '+0.5s duration', maxLevel: 5, costPerPoint: 3, requiredLevel: 30 },
  { id: 'mastersVolley', name: "Master's Volley", description: 'Fire a devastating volley of ten precision arrows that pierce everything.', perPoint: '+2 arrows, +20 damage', maxLevel: 3, costPerPoint: 4, requiredLevel: 30 },
];

// Map class ID to its attribute/skill definitions
export function getClassAttributes(classId: string): AttributeDef[] {
  switch (classId) {
    case 'necromancer':    return NECROMANCER_ATTRIBUTES;
    case 'paladin':        return PALADIN_ATTRIBUTES;
    case 'barbarian':      return BARBARIAN_ATTRIBUTES;
    case 'templar_knight': return TEMPLAR_ATTRIBUTES;
    case 'mage':           return MAGE_ATTRIBUTES;
    case 'archer':         return ARCHER_ATTRIBUTES;
    default: return NECROMANCER_ATTRIBUTES;
  }
}

export function getClassSkills(classId: string): SkillDef[] {
  switch (classId) {
    case 'necromancer':    return NECROMANCER_SKILLS;
    case 'paladin':        return PALADIN_SKILLS;
    case 'barbarian':      return BARBARIAN_SKILLS;
    case 'templar_knight': return TEMPLAR_SKILLS;
    case 'mage':           return MAGE_SKILLS;
    case 'archer':         return ARCHER_SKILLS;
    default: return NECROMANCER_SKILLS;
  }
}

export function createDefaultProgression(): CharacterProgression {
  return {
    attrPointsAvailable: 0,
    attributes: {},
    skillPointsAvailable: 0,
    skills: {},
    ownedWeapons: ['oak_mace'],
    equippedWeapon: 'oak_mace',
    ownedSidekicks: [],
    equippedSidekick: undefined,
    sidekickLevels: {},
    sidekickXp: {},
    sidekickSkillPoints: {},
    sidekickSkills: {},
  };
}
