export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  requiredLevel: number;
  classId: string;
  // Stat bonuses
  damageBonus: number;       // flat added to projectile damage
  attackSpeedPct: number;    // 0.10 = 10% faster
  rangeBonus: number;        // pixels added
  rotBonusPct: number;       // 0.05 = +5% rot DOT
  ghoulMaxBonus: number;     // extra ghoul slots
  lifestealPct: number;      // 0.05 = 5% of damage healed
  color: number;             // tint for icon
}

export const NECROMANCER_WEAPONS: WeaponDef[] = [
  {
    id: 'bone_wand',
    name: 'Bone Wand',
    description: 'A simple wand carved from a goblin femur.',
    cost: 50,
    requiredLevel: 5,
    classId: 'necromancer',
    damageBonus: 5,
    attackSpeedPct: 0.05,
    rangeBonus: 0,
    rotBonusPct: 0,
    ghoulMaxBonus: 0,
    lifestealPct: 0,
    color: 0xddccaa,
  },
  {
    id: 'skull_staff',
    name: 'Skull Staff',
    description: 'A wooden staff topped with a glowing skull.',
    cost: 150,
    requiredLevel: 10,
    classId: 'necromancer',
    damageBonus: 12,
    attackSpeedPct: 0.10,
    rangeBonus: 25,
    rotBonusPct: 0,
    ghoulMaxBonus: 0,
    lifestealPct: 0,
    color: 0xaaaa66,
  },
  {
    id: 'cursed_tome',
    name: 'Cursed Tome',
    description: 'A book bound in flesh that whispers dark secrets.',
    cost: 350,
    requiredLevel: 15,
    classId: 'necromancer',
    damageBonus: 20,
    attackSpeedPct: 0.15,
    rangeBonus: 25,
    rotBonusPct: 0.05,
    ghoulMaxBonus: 0,
    lifestealPct: 0,
    color: 0x663366,
  },
  {
    id: 'scythe_of_decay',
    name: 'Scythe of Decay',
    description: 'A massive scythe radiating with rotting energy.',
    cost: 700,
    requiredLevel: 20,
    classId: 'necromancer',
    damageBonus: 30,
    attackSpeedPct: 0.20,
    rangeBonus: 50,
    rotBonusPct: 0.10,
    ghoulMaxBonus: 0,
    lifestealPct: 0,
    color: 0x884444,
  },
  {
    id: 'lich_crook',
    name: "Lich Lord's Crook",
    description: 'A staff once wielded by an undead king.',
    cost: 1500,
    requiredLevel: 25,
    classId: 'necromancer',
    damageBonus: 45,
    attackSpeedPct: 0.25,
    rangeBonus: 75,
    rotBonusPct: 0.15,
    ghoulMaxBonus: 1,
    lifestealPct: 0,
    color: 0x33aa66,
  },
  {
    id: 'phylactery',
    name: 'Phylactery of the Damned',
    description: 'A soul jar housing the essence of a death god. Heals you on every hit.',
    cost: 3000,
    requiredLevel: 30,
    classId: 'necromancer',
    damageBonus: 65,
    attackSpeedPct: 0.35,
    rangeBonus: 100,
    rotBonusPct: 0.25,
    ghoulMaxBonus: 1,
    lifestealPct: 0.10,
    color: 0xff44aa,
  },
];

export function getClassWeapons(classId: string): WeaponDef[] {
  switch (classId) {
    case 'necromancer': return NECROMANCER_WEAPONS;
    default: return [];
  }
}

export function getWeaponById(id: string): WeaponDef | null {
  return NECROMANCER_WEAPONS.find(w => w.id === id) ?? null;
}
