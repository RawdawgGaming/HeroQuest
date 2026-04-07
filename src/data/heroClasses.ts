export type AttackType = 'melee' | 'projectile';

export interface HeroClassDef {
  id: string;
  name: string;
  description: string;
  color: number;         // Placeholder body color
  accentColor: number;   // Eye/weapon accent
  attackType: AttackType;
  projectileColor?: number;  // Color of the projectile (if ranged)
  stats: {
    moveSpeed: number;
    maxHealth: number;
    attackPower: number;
    defense: number;
  };
}

export const HERO_CLASSES: HeroClassDef[] = [
  {
    id: 'paladin',
    name: 'Paladin',
    description: 'Holy warrior with high defense and healing abilities.',
    color: 0xcccc44,
    accentColor: 0xffffaa,
    attackType: 'melee',
    stats: { moveSpeed: 180, maxHealth: 120, attackPower: 10, defense: 8 },
  },
  {
    id: 'barbarian',
    name: 'Barbarian',
    description: 'Brutal melee fighter with massive attack power.',
    color: 0xcc4422,
    accentColor: 0xff8866,
    attackType: 'melee',
    stats: { moveSpeed: 190, maxHealth: 110, attackPower: 15, defense: 4 },
  },
  {
    id: 'templar_knight',
    name: 'Templar Knight',
    description: 'Armored knight balanced between offense and defense.',
    color: 0x8888cc,
    accentColor: 0xaaaaff,
    attackType: 'melee',
    stats: { moveSpeed: 170, maxHealth: 130, attackPower: 11, defense: 7 },
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'Arcane caster with powerful AoE abilities.',
    color: 0x6633cc,
    accentColor: 0xbb66ff,
    attackType: 'melee',
    stats: { moveSpeed: 200, maxHealth: 80, attackPower: 14, defense: 3 },
  },
  {
    id: 'archer',
    name: 'Archer',
    description: 'Swift ranged fighter with high crit chance.',
    color: 0x33aa55,
    accentColor: 0x66ff88,
    attackType: 'melee',
    stats: { moveSpeed: 220, maxHealth: 85, attackPower: 12, defense: 4 },
  },
  {
    id: 'necromancer',
    name: 'Necromancer',
    description: 'Dark summoner who raises undead allies.',
    color: 0x1a1a22,
    accentColor: 0x33ff55,
    attackType: 'projectile',
    projectileColor: 0x220033,
    stats: { moveSpeed: 180, maxHealth: 90, attackPower: 18, defense: 3 },
  },
];
