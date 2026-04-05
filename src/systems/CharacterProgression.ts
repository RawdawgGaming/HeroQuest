/** Persistent character progression that carries between stages. */
export interface CharacterProgression {
  // Attribute points (1 per level, spent on class-specific attributes)
  attrPointsAvailable: number;
  attributes: Record<string, number>;  // e.g. { attackPower: 3, attackRange: 2, rotEffect: 1 }

  // Skill points (1 per level, spent on upgrading skills)
  skillPointsAvailable: number;
  skills: Record<string, number>;      // e.g. { basicAttack: 5 }
}

// Per-class attribute definitions
export interface AttributeDef {
  id: string;
  name: string;
  description: string;
  perPoint: string;  // human-readable effect per point
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

// Necromancer attributes
export const NECROMANCER_ATTRIBUTES: AttributeDef[] = [
  { id: 'attackPower', name: 'Attack Power', description: 'Increases projectile damage.', perPoint: '+2 damage' },
  { id: 'attackRange', name: 'Attack Range', description: 'Increases projectile travel distance.', perPoint: '+50 range' },
  { id: 'rotEffect', name: 'Rot Effect', description: 'Increases decay DOT damage and duration.', perPoint: '+5% decay, +0.5s duration' },
];

// Necromancer skills
export const NECROMANCER_SKILLS: SkillDef[] = [
  { id: 'basicAttack', name: 'Dark Bolt', description: 'Black energy ball. Each level increases damage and cast speed.', perPoint: '+3 damage, -10% cooldown', maxLevel: 10 },
  { id: 'summonGhoul', name: 'Summon Ghoul', description: 'Summon a ghoul that auto-attacks nearby enemies.', perPoint: '+1 ghoul, +10% ghoul damage', maxLevel: 5, costPerPoint: 2, requiredLevel: 10 },
];

// Map class ID to its attribute/skill definitions
export function getClassAttributes(classId: string): AttributeDef[] {
  switch (classId) {
    case 'necromancer': return NECROMANCER_ATTRIBUTES;
    default: return [
      { id: 'attackPower', name: 'Attack Power', description: 'Increases melee damage.', perPoint: '+2 damage' },
      { id: 'attackSpeed', name: 'Attack Speed', description: 'Faster attack combos.', perPoint: '-5% combo duration' },
      { id: 'defense', name: 'Defense', description: 'Reduces incoming damage.', perPoint: '+1 defense' },
    ];
  }
}

export function getClassSkills(classId: string): SkillDef[] {
  switch (classId) {
    case 'necromancer': return NECROMANCER_SKILLS;
    default: return [
      { id: 'basicAttack', name: 'Basic Combo', description: 'Melee combo. Each level increases damage.', perPoint: '+3 damage per hit', maxLevel: 10 },
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
