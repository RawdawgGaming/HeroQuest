/** Sidekicks — small companion creatures that follow the hero and provide passive support. */

export type SidekickAbility =
  | 'heal'        // periodically heals the hero a % of max HP
  | 'freeze'      // periodically freezes the nearest enemy
  | 'poison'      // applies a poison DOT to the nearest enemy
  | 'attack'      // shoots a magic bolt at the nearest enemy
  | 'shield';     // passive damage reduction + small HP regen

/** A skill that augments the sidekick's base ability. Auto-cast — no key binding needed. */
export interface SidekickSkillDef {
  id: string;
  name: string;
  description: string;
  perPoint: string;       // human-readable effect per point
  maxLevel: number;
  unlockLevel: number;    // sidekick level required to invest SP
}

export interface SidekickDef {
  id: string;
  name: string;
  description: string;
  cost: number;            // gold cost
  ability: SidekickAbility;
  cooldownMs: number;      // ability cooldown
  power: number;           // ability power (interpreted per ability type)
  range?: number;          // ability range (for targeting abilities)
  /** Visual config — small floating creature beside the hero */
  bodyColor: number;
  accentColor: number;
  glowColor: number;
  /** Three augment skills the player invests sidekick SP into */
  skills: SidekickSkillDef[];
}

/** Max sidekick level. Player gains 1 SP per level. */
export const SIDEKICK_MAX_LEVEL = 20;

/** XP required to reach (level+1) from level */
export function sidekickXpForLevel(level: number): number {
  return 60 + level * 40;
}

export const SIDEKICKS: SidekickDef[] = [
  {
    id: 'mending_pixie',
    name: 'Mending Pixie',
    description: 'A tiny winged sprite that mends your wounds. Heals 4% max HP every 4 seconds.',
    cost: 7000,
    ability: 'heal',
    cooldownMs: 4000,
    power: 0.04,           // 4% max HP per tick
    bodyColor: 0xffaadd,   // pink
    accentColor: 0xffee88, // yellow sparkle
    glowColor: 0xffccee,
    skills: [
      { id: 'greater_mending', name: 'Greater Mending', description: 'Each heal restores additional HP.', perPoint: '+1% max HP per heal', maxLevel: 5, unlockLevel: 1 },
      { id: 'rapid_pulse', name: 'Rapid Pulse', description: 'The pixie flutters faster, healing more often.', perPoint: '-300ms cooldown', maxLevel: 5, unlockLevel: 5 },
      { id: 'cleansing_light', name: 'Cleansing Light', description: 'Every Nth heal also blasts away poison and rot stacks.', perPoint: '-1 hit until cleanse (start: every 6th)', maxLevel: 5, unlockLevel: 10 },
    ],
  },
  {
    id: 'frost_sprite',
    name: 'Frost Sprite',
    description: 'A frigid elemental that freezes the nearest enemy solid for 2 seconds every 6 seconds.',
    cost: 7000,
    ability: 'freeze',
    cooldownMs: 6000,
    power: 2000,           // freeze duration in ms
    range: 240,
    bodyColor: 0x66ddff,   // cyan
    accentColor: 0xffffff,
    glowColor: 0x99eeff,
    skills: [
      { id: 'glacial_touch', name: 'Glacial Touch', description: 'Frozen enemies stay frozen longer.', perPoint: '+0.5s freeze duration', maxLevel: 5, unlockLevel: 1 },
      { id: 'frost_nova', name: 'Frost Nova', description: 'Each cast freezes additional enemies in range.', perPoint: '+1 enemy frozen per cast', maxLevel: 5, unlockLevel: 5 },
      { id: 'permafrost', name: 'Permafrost', description: 'Frozen enemies take bonus damage from all sources.', perPoint: '+8% damage taken while frozen', maxLevel: 5, unlockLevel: 10 },
    ],
  },
  {
    id: 'plague_bat',
    name: 'Plague Bat',
    description: 'A diseased bat that infects the nearest enemy with a wracking poison every 5 seconds.',
    cost: 7000,
    ability: 'poison',
    cooldownMs: 5000,
    power: 0.12,           // 12% of enemy max HP as DOT total
    range: 260,
    bodyColor: 0x66aa44,   // sickly green
    accentColor: 0x223311,
    glowColor: 0x88cc66,
    skills: [
      { id: 'virulence', name: 'Virulence', description: 'The poison eats through flesh more aggressively.', perPoint: '+3% max HP DOT damage', maxLevel: 5, unlockLevel: 1 },
      { id: 'pandemic', name: 'Pandemic', description: 'The bat strikes more frequently.', perPoint: '-400ms cooldown', maxLevel: 5, unlockLevel: 5 },
      { id: 'black_death', name: 'Black Death', description: 'Poisoned enemies that die explode in a toxic burst.', perPoint: '+15% explosion damage', maxLevel: 5, unlockLevel: 10 },
    ],
  },
  {
    id: 'battle_wisp',
    name: 'Battle Wisp',
    description: 'A burning ember spirit that hurls a fiery bolt at the nearest enemy every 2 seconds.',
    cost: 7000,
    ability: 'attack',
    cooldownMs: 2000,
    power: 35,             // damage per bolt
    range: 320,
    bodyColor: 0xff6622,   // orange-red
    accentColor: 0xffdd44,
    glowColor: 0xff9944,
    skills: [
      { id: 'searing', name: 'Searing Bolts', description: 'Each bolt burns hotter.', perPoint: '+10 damage per bolt', maxLevel: 5, unlockLevel: 1 },
      { id: 'twin_bolts', name: 'Twin Bolts', description: 'Hurl additional bolts per attack.', perPoint: '+1 bolt per attack', maxLevel: 5, unlockLevel: 5 },
      { id: 'inferno', name: 'Inferno', description: 'Bolts pierce through enemies in a line.', perPoint: '+1 enemy pierced per bolt', maxLevel: 5, unlockLevel: 10 },
    ],
  },
  {
    id: 'guardian_spirit',
    name: 'Guardian Spirit',
    description: 'An ancestral protector that grants 12% damage reduction and regenerates 6 HP every second.',
    cost: 7000,
    ability: 'shield',
    cooldownMs: 1000,      // tick interval for regen
    power: 6,              // HP regen per tick
    bodyColor: 0xffeeaa,   // gold
    accentColor: 0xffffff,
    glowColor: 0xffeebb,
    skills: [
      { id: 'hardened_wards', name: 'Hardened Wards', description: 'Increases passive damage reduction.', perPoint: '+1.5% damage reduction', maxLevel: 5, unlockLevel: 1 },
      { id: 'vital_bond', name: 'Vital Bond', description: 'Strengthens the regenerative bond.', perPoint: '+2 HP/s regen', maxLevel: 5, unlockLevel: 5 },
      { id: 'last_stand', name: 'Last Stand', description: 'Grants brief invulnerability when health drops critically low.', perPoint: '+0.5s invuln (60s CD)', maxLevel: 5, unlockLevel: 10 },
    ],
  },
];

export function getSidekickById(id: string | undefined): SidekickDef | null {
  if (!id) return null;
  return SIDEKICKS.find(s => s.id === id) ?? null;
}
