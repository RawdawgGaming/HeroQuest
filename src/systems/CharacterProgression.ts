/** Persistent character progression that carries between stages. */
export interface CharacterProgression {
  // Attribute points (1 per level, spent on class-specific attributes)
  attrPointsAvailable: number;
  attributes: Record<string, number>;  // e.g. { attackPower: 3, attackRange: 2, rotEffect: 1 }

  // Skill points (1 per level, spent on upgrading skills)
  skillPointsAvailable: number;
  skills: Record<string, number>;      // e.g. { summonGhoul: 3, rot: 2, lifeLeech: 1 }
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
  { id: 'attackPower', name: 'Attack Power', description: 'Increases projectile damage.', perPoint: '+2 damage', maxPoints: 8 },
  { id: 'attackSpeed', name: 'Attack Speed', description: 'Faster cast speed.', perPoint: '-8% cast time', maxPoints: 7 },
  { id: 'attackRange', name: 'Attack Range', description: 'Increases projectile travel distance.', perPoint: '+50 range', maxPoints: 7 },
  { id: 'rotEffect', name: 'Rot Effect', description: 'Increases decay DOT damage and duration.', perPoint: '+5% decay, +0.5s duration', maxPoints: 7 },
];

// Necromancer skills (10 + 10 + 9 = 29 SP, all maxable by level 30)
export const NECROMANCER_SKILLS: SkillDef[] = [
  { id: 'summonGhoul', name: 'Summon Ghoul', description: 'Summon a ghoul that auto-attacks nearby enemies.', perPoint: '+1 ghoul, +10% ghoul damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 10 },
  { id: 'rot', name: 'Rot', description: 'Acid rain that slows and melts enemies in front of you for 3s.', perPoint: '+10% max HP DOT, 60% slow (15% base)', maxLevel: 5, costPerPoint: 2, requiredLevel: 15 },
  { id: 'lifeLeech', name: 'Life Leech', description: 'Toggle: drain HP from nearby enemies, healing the necromancer.', perPoint: '+5 DPS, +3 heal/s per enemy', maxLevel: 3, costPerPoint: 3, requiredLevel: 5 },
];

// Map class ID to its attribute/skill definitions
export function getClassAttributes(classId: string): AttributeDef[] {
  switch (classId) {
    case 'necromancer': return NECROMANCER_ATTRIBUTES;
    default: return [
      { id: 'attackPower', name: 'Attack Power', description: 'Increases melee damage.', perPoint: '+2 damage', maxPoints: 10 },
      { id: 'attackSpeed', name: 'Attack Speed', description: 'Faster attack combos.', perPoint: '-5% combo duration', maxPoints: 10 },
      { id: 'defense', name: 'Defense', description: 'Reduces incoming damage.', perPoint: '+1 defense', maxPoints: 10 },
    ];
  }
}

export function getClassSkills(classId: string): SkillDef[] {
  switch (classId) {
    case 'necromancer': return NECROMANCER_SKILLS;
    default: return [
      { id: 'lifeLeech', name: 'Life Leech', description: 'Toggle: drain HP from nearby enemies, healing you.', perPoint: '+5 DPS, +3 heal/s per enemy', maxLevel: 3, costPerPoint: 3, requiredLevel: 5 },
    ];
  }
}

export function createDefaultProgression(): CharacterProgression {
  return {
    attrPointsAvailable: 0,
    attributes: {},
    skillPointsAvailable: 0,
    skills: {},
  };
}
