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
  {
    id: 'bonewalker_ribcage',
    name: 'Bonewalker Ribcage',
    description: 'The hollow chest of an ancient lich, each rib pulsing with necrotic spite.',
    cost: 6500,
    requiredLevel: 40,
    classId: 'necromancer',
    damageBonus: 95,
    attackSpeedPct: 0.45,
    rangeBonus: 130,
    rotBonusPct: 0.35,
    ghoulMaxBonus: 2,
    lifestealPct: 0.12,
    color: 0xddccaa,
  },
  {
    id: 'soulrender',
    name: 'Soulrender',
    description: 'A jagged athame that tears souls from living flesh and binds them to your will.',
    cost: 14000,
    requiredLevel: 50,
    classId: 'necromancer',
    damageBonus: 140,
    attackSpeedPct: 0.55,
    rangeBonus: 160,
    rotBonusPct: 0.45,
    ghoulMaxBonus: 2,
    lifestealPct: 0.18,
    color: 0x66ddff,
  },
  {
    id: 'deaths_embrace',
    name: "Death's Embrace",
    description: 'Twin reaper claws woven from frozen shadow. Every swing is a death sentence.',
    cost: 28000,
    requiredLevel: 60,
    classId: 'necromancer',
    damageBonus: 200,
    attackSpeedPct: 0.65,
    rangeBonus: 200,
    rotBonusPct: 0.55,
    ghoulMaxBonus: 3,
    lifestealPct: 0.22,
    color: 0x6633cc,
  },
  {
    id: 'apex_reliquary',
    name: 'Apex Reliquary',
    description: 'A relic forged from the bones of a forgotten god. The ultimate vessel of necromantic power.',
    cost: 60000,
    requiredLevel: 70,
    classId: 'necromancer',
    damageBonus: 300,
    attackSpeedPct: 0.80,
    rangeBonus: 250,
    rotBonusPct: 0.70,
    ghoulMaxBonus: 4,
    lifestealPct: 0.30,
    color: 0xffdd44,
  },
];

// =============================================================================
// PALADIN — holy maces, hammers and warhammers
// =============================================================================
export const PALADIN_WEAPONS: WeaponDef[] = [
  { id: 'oak_mace',            name: 'Oak Mace',            description: 'A sturdy wooden mace banded with iron.',                            cost: 50,    requiredLevel: 1,  classId: 'paladin', damageBonus: 4,   attackSpeedPct: 0.05, rangeBonus: 0,  rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0xb08850 },
  { id: 'spiked_oak_mace',     name: 'Spiked Oak Mace',     description: 'An oak mace fitted with iron spikes for extra bite.',               cost: 150,   requiredLevel: 5,  classId: 'paladin', damageBonus: 10,  attackSpeedPct: 0.08, rangeBonus: 0,  rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0xb08850 },
  { id: 'stone_mace',          name: 'Stone Mace',          description: 'A heavy mace with a carved stone head.',                            cost: 350,   requiredLevel: 10, classId: 'paladin', damageBonus: 18,  attackSpeedPct: 0.12, rangeBonus: 5,  rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0x888888 },
  { id: 'spiked_stone_mace',   name: 'Spiked Stone Mace',   description: 'Sharpened stone flanges make this mace truly punishing.',           cost: 700,   requiredLevel: 15, classId: 'paladin', damageBonus: 28,  attackSpeedPct: 0.16, rangeBonus: 5,  rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0x888888 },
  { id: 'iron_mace',           name: 'Iron Mace',           description: 'A heavy iron mace blessed by a temple priest.',                     cost: 1500,  requiredLevel: 20, classId: 'paladin', damageBonus: 42,  attackSpeedPct: 0.20, rangeBonus: 10, rotBonusPct: 0.10, ghoulMaxBonus: 0, lifestealPct: 0.03, color: 0xaaaaaa },
  { id: 'spiked_iron_mace',    name: 'Spiked Iron Mace',    description: 'Brutal iron flanges punish the unholy with every swing.',           cost: 3000,  requiredLevel: 25, classId: 'paladin', damageBonus: 62,  attackSpeedPct: 0.25, rangeBonus: 10, rotBonusPct: 0.15, ghoulMaxBonus: 0, lifestealPct: 0.05, color: 0xaaaaaa },
  { id: 'golden_mace',         name: 'Golden Mace',         description: 'A radiant mace forged from consecrated gold.',                      cost: 6500,  requiredLevel: 30, classId: 'paladin', damageBonus: 90,  attackSpeedPct: 0.35, rangeBonus: 15, rotBonusPct: 0.20, ghoulMaxBonus: 0, lifestealPct: 0.08, color: 0xffcc44 },
  { id: 'spiked_golden_mace',  name: 'Spiked Golden Mace',  description: 'Golden spikes channel holy light into devastating blows.',          cost: 14000, requiredLevel: 35, classId: 'paladin', damageBonus: 130, attackSpeedPct: 0.45, rangeBonus: 20, rotBonusPct: 0.30, ghoulMaxBonus: 0, lifestealPct: 0.12, color: 0xffcc44 },
  { id: 'ruby_mace',           name: 'Ruby Mace',           description: 'A crimson mace set with enchanted rubies that burn on contact.',    cost: 28000, requiredLevel: 40, classId: 'paladin', damageBonus: 185, attackSpeedPct: 0.55, rangeBonus: 25, rotBonusPct: 0.40, ghoulMaxBonus: 0, lifestealPct: 0.18, color: 0xcc2233 },
  { id: 'spiked_ruby_mace',    name: 'Spiked Ruby Mace',    description: 'The ultimate paladin relic — ruby spikes crackle with holy fire.', cost: 60000, requiredLevel: 45, classId: 'paladin', damageBonus: 280, attackSpeedPct: 0.70, rangeBonus: 30, rotBonusPct: 0.55, ghoulMaxBonus: 0, lifestealPct: 0.25, color: 0xcc2233 },
];

// =============================================================================
// BARBARIAN — axes, greatswords, and brutal weapons
// =============================================================================
export const BARBARIAN_WEAPONS: WeaponDef[] = [
  { id: 'rusty_axe',         name: 'Rusty Axe',          description: 'An old hand axe with a chipped edge.',                              cost: 50,    requiredLevel: 5,  classId: 'barbarian', damageBonus: 7,   attackSpeedPct: 0.05, rangeBonus: 0,  rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0x886644 },
  { id: 'broad_axe',         name: 'Broad Axe',          description: 'A wide-bladed axe favored by raiders.',                             cost: 150,   requiredLevel: 10, classId: 'barbarian', damageBonus: 16,  attackSpeedPct: 0.08, rangeBonus: 5,  rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0xaa9966 },
  { id: 'great_axe',         name: 'Great Axe',          description: 'A massive two-handed axe that cleaves armor.',                      cost: 350,   requiredLevel: 15, classId: 'barbarian', damageBonus: 26,  attackSpeedPct: 0.10, rangeBonus: 10, rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0.05, color: 0xccaa77 },
  { id: 'savage_cleaver',    name: 'Savage Cleaver',     description: 'A jagged cleaver dripping with old blood.',                         cost: 700,   requiredLevel: 20, classId: 'barbarian', damageBonus: 38,  attackSpeedPct: 0.15, rangeBonus: 10, rotBonusPct: 0.10, ghoulMaxBonus: 0, lifestealPct: 0.08, color: 0x884422 },
  { id: 'berserker_axe',     name: 'Berserker Axe',      description: 'A red-eyed axe that whispers to its wielder.',                      cost: 1500,  requiredLevel: 25, classId: 'barbarian', damageBonus: 55,  attackSpeedPct: 0.20, rangeBonus: 15, rotBonusPct: 0.15, ghoulMaxBonus: 0, lifestealPct: 0.10, color: 0xcc4422 },
  { id: 'wartorn_blade',     name: 'Wartorn Blade',      description: 'A massive greatsword scarred from a hundred battles.',              cost: 3000,  requiredLevel: 30, classId: 'barbarian', damageBonus: 80,  attackSpeedPct: 0.30, rangeBonus: 25, rotBonusPct: 0.20, ghoulMaxBonus: 0, lifestealPct: 0.12, color: 0x999988 },
  { id: 'titan_hammer',      name: 'Titan Hammer',       description: 'A hammer rumored to have belonged to a giant warlord.',             cost: 6500,  requiredLevel: 40, classId: 'barbarian', damageBonus: 115, attackSpeedPct: 0.40, rangeBonus: 30, rotBonusPct: 0.30, ghoulMaxBonus: 0, lifestealPct: 0.14, color: 0x666666 },
  { id: 'ravager_axe',       name: 'Ravager Axe',        description: 'A black-iron axe that screams when it strikes flesh.',              cost: 14000, requiredLevel: 50, classId: 'barbarian', damageBonus: 165, attackSpeedPct: 0.50, rangeBonus: 35, rotBonusPct: 0.40, ghoulMaxBonus: 0, lifestealPct: 0.18, color: 0x442222 },
  { id: 'doombringer',       name: 'Doombringer',        description: 'The legendary axe of a warlord who never knew defeat.',             cost: 28000, requiredLevel: 60, classId: 'barbarian', damageBonus: 230, attackSpeedPct: 0.60, rangeBonus: 45, rotBonusPct: 0.50, ghoulMaxBonus: 0, lifestealPct: 0.22, color: 0xaa3322 },
  { id: 'world_render',      name: 'World Render',       description: 'A god-slayer greataxe forged at the dawn of time.',                 cost: 60000, requiredLevel: 70, classId: 'barbarian', damageBonus: 340, attackSpeedPct: 0.75, rangeBonus: 60, rotBonusPct: 0.65, ghoulMaxBonus: 0, lifestealPct: 0.30, color: 0xff6644 },
];

// =============================================================================
// TEMPLAR KNIGHT — runed swords and consecrated blades
// =============================================================================
export const TEMPLAR_WEAPONS: WeaponDef[] = [
  { id: 'training_sword',    name: 'Training Sword',     description: 'A standard issue training sword.',                                  cost: 50,    requiredLevel: 5,  classId: 'templar_knight', damageBonus: 6,   attackSpeedPct: 0.05, rangeBonus: 5,  rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0x9999bb },
  { id: 'knights_blade',     name: "Knight's Blade",     description: 'A well-forged knightly long sword.',                                cost: 150,   requiredLevel: 10, classId: 'templar_knight', damageBonus: 14,  attackSpeedPct: 0.10, rangeBonus: 10, rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0xaaaacc },
  { id: 'runed_blade',       name: 'Runed Blade',        description: 'A sword inscribed with arcane runes that glow faintly.',            cost: 350,   requiredLevel: 15, classId: 'templar_knight', damageBonus: 22,  attackSpeedPct: 0.12, rangeBonus: 15, rotBonusPct: 0.05, ghoulMaxBonus: 0, lifestealPct: 0.05, color: 0xbbbbff },
  { id: 'silver_falchion',   name: 'Silver Falchion',    description: 'A curved silver blade that gleams in the moonlight.',               cost: 700,   requiredLevel: 20, classId: 'templar_knight', damageBonus: 32,  attackSpeedPct: 0.18, rangeBonus: 20, rotBonusPct: 0.10, ghoulMaxBonus: 0, lifestealPct: 0.08, color: 0xddddff },
  { id: 'holy_claymore',     name: 'Holy Claymore',      description: 'A massive two-handed claymore blessed at a temple.',                cost: 1500,  requiredLevel: 25, classId: 'templar_knight', damageBonus: 48,  attackSpeedPct: 0.22, rangeBonus: 25, rotBonusPct: 0.15, ghoulMaxBonus: 0, lifestealPct: 0.10, color: 0xeeeeff },
  { id: 'azure_sword',       name: 'Azure Sword',        description: 'A blue-glowing sword that crackles with arcane energy.',            cost: 3000,  requiredLevel: 30, classId: 'templar_knight', damageBonus: 70,  attackSpeedPct: 0.32, rangeBonus: 30, rotBonusPct: 0.20, ghoulMaxBonus: 0, lifestealPct: 0.12, color: 0x6699ff },
  { id: 'paladins_oath',     name: "Paladin's Oath",     description: "A sacred relic blade carried by an order's champion.",              cost: 6500,  requiredLevel: 40, classId: 'templar_knight', damageBonus: 100, attackSpeedPct: 0.42, rangeBonus: 35, rotBonusPct: 0.30, ghoulMaxBonus: 0, lifestealPct: 0.14, color: 0xccddff },
  { id: 'starforged_sword',  name: 'Starforged Sword',   description: 'A blade forged from a fallen star, humming with power.',            cost: 14000, requiredLevel: 50, classId: 'templar_knight', damageBonus: 145, attackSpeedPct: 0.52, rangeBonus: 40, rotBonusPct: 0.40, ghoulMaxBonus: 0, lifestealPct: 0.18, color: 0xaaccff },
  { id: 'covenant_blade',    name: 'Covenant Blade',     description: 'The blade carried by the founder of the Templar Order.',            cost: 28000, requiredLevel: 60, classId: 'templar_knight', damageBonus: 205, attackSpeedPct: 0.62, rangeBonus: 50, rotBonusPct: 0.50, ghoulMaxBonus: 0, lifestealPct: 0.22, color: 0xddeeff },
  { id: 'aetherblade',       name: 'Aetherblade',        description: 'A blade of pure aether — an ultimate templar relic.',               cost: 60000, requiredLevel: 70, classId: 'templar_knight', damageBonus: 305, attackSpeedPct: 0.78, rangeBonus: 60, rotBonusPct: 0.65, ghoulMaxBonus: 0, lifestealPct: 0.30, color: 0xeeffff },
];

// =============================================================================
// MAGE — staves, wands, and arcane orbs
// =============================================================================
export const MAGE_WEAPONS: WeaponDef[] = [
  { id: 'apprentice_wand',   name: 'Apprentice Wand',    description: "A novice mage's first focus.",                                      cost: 50,    requiredLevel: 5,  classId: 'mage', damageBonus: 6,   attackSpeedPct: 0.05, rangeBonus: 30, rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0xaa66cc },
  { id: 'oak_staff',         name: 'Oak Staff',          description: 'A simple oak staff topped with a small crystal.',                   cost: 150,   requiredLevel: 10, classId: 'mage', damageBonus: 14,  attackSpeedPct: 0.10, rangeBonus: 50, rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0x884466 },
  { id: 'arcane_orb',        name: 'Arcane Orb',         description: 'A floating orb that focuses raw arcane energy.',                    cost: 350,   requiredLevel: 15, classId: 'mage', damageBonus: 22,  attackSpeedPct: 0.15, rangeBonus: 60, rotBonusPct: 0.10, ghoulMaxBonus: 0, lifestealPct: 0,    color: 0x9966ff },
  { id: 'frost_wand',        name: 'Frost Wand',         description: 'A wand carved from glacial ice.',                                   cost: 700,   requiredLevel: 20, classId: 'mage', damageBonus: 32,  attackSpeedPct: 0.20, rangeBonus: 75, rotBonusPct: 0.15, ghoulMaxBonus: 0, lifestealPct: 0.05, color: 0x66ccff },
  { id: 'fire_staff',        name: 'Fire Staff',         description: 'A staff topped with a constantly burning flame.',                   cost: 1500,  requiredLevel: 25, classId: 'mage', damageBonus: 48,  attackSpeedPct: 0.25, rangeBonus: 90, rotBonusPct: 0.20, ghoulMaxBonus: 0, lifestealPct: 0.08, color: 0xff6633 },
  { id: 'arcane_codex',      name: 'Arcane Codex',       description: 'A floating tome that turns its own pages.',                         cost: 3000,  requiredLevel: 30, classId: 'mage', damageBonus: 70,  attackSpeedPct: 0.35, rangeBonus: 110,rotBonusPct: 0.25, ghoulMaxBonus: 0, lifestealPct: 0.10, color: 0xaa44ff },
  { id: 'phoenix_staff',     name: 'Phoenix Staff',      description: 'A staff topped with a phoenix feather that flares with each spell.',cost: 6500,  requiredLevel: 40, classId: 'mage', damageBonus: 100, attackSpeedPct: 0.45, rangeBonus: 130,rotBonusPct: 0.35, ghoulMaxBonus: 0, lifestealPct: 0.12, color: 0xff8844 },
  { id: 'chronomancer_orb',  name: 'Chronomancer Orb',   description: 'An orb that bends time around the wielder.',                        cost: 14000, requiredLevel: 50, classId: 'mage', damageBonus: 145, attackSpeedPct: 0.55, rangeBonus: 160,rotBonusPct: 0.45, ghoulMaxBonus: 0, lifestealPct: 0.18, color: 0x66ffcc },
  { id: 'archmage_staff',    name: 'Archmage Staff',     description: 'A staff carried only by those who reach archmage rank.',            cost: 28000, requiredLevel: 60, classId: 'mage', damageBonus: 205, attackSpeedPct: 0.65, rangeBonus: 200,rotBonusPct: 0.55, ghoulMaxBonus: 0, lifestealPct: 0.22, color: 0xcc66ff },
  { id: 'reality_weaver',    name: 'Reality Weaver',     description: 'A staff that lets the wielder reshape the laws of magic itself.',   cost: 60000, requiredLevel: 70, classId: 'mage', damageBonus: 305, attackSpeedPct: 0.80, rangeBonus: 250,rotBonusPct: 0.70, ghoulMaxBonus: 0, lifestealPct: 0.30, color: 0xff66ff },
];

// =============================================================================
// ARCHER — bows and crossbows
// =============================================================================
export const ARCHER_WEAPONS: WeaponDef[] = [
  { id: 'short_bow',         name: 'Short Bow',          description: 'A simple short bow strung with sinew.',                             cost: 50,    requiredLevel: 5,  classId: 'archer', damageBonus: 5,   attackSpeedPct: 0.10, rangeBonus: 40, rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0x886633 },
  { id: 'hunting_bow',       name: 'Hunting Bow',        description: 'A reliable bow used by woodland hunters.',                          cost: 150,   requiredLevel: 10, classId: 'archer', damageBonus: 12,  attackSpeedPct: 0.15, rangeBonus: 60, rotBonusPct: 0,    ghoulMaxBonus: 0, lifestealPct: 0,    color: 0xaa8855 },
  { id: 'longbow',           name: 'Longbow',            description: 'A tall yew longbow with great draw weight.',                        cost: 350,   requiredLevel: 15, classId: 'archer', damageBonus: 20,  attackSpeedPct: 0.18, rangeBonus: 90, rotBonusPct: 0.05, ghoulMaxBonus: 0, lifestealPct: 0,    color: 0xccaa66 },
  { id: 'composite_bow',     name: 'Composite Bow',      description: 'A bow made from layered horn and sinew for extra speed.',           cost: 700,   requiredLevel: 20, classId: 'archer', damageBonus: 30,  attackSpeedPct: 0.25, rangeBonus: 110,rotBonusPct: 0.10, ghoulMaxBonus: 0, lifestealPct: 0.05, color: 0xddbb77 },
  { id: 'recurve_bow',       name: 'Recurve Bow',        description: 'A curved bow that snaps arrows with stunning force.',               cost: 1500,  requiredLevel: 25, classId: 'archer', damageBonus: 45,  attackSpeedPct: 0.30, rangeBonus: 130,rotBonusPct: 0.15, ghoulMaxBonus: 0, lifestealPct: 0.08, color: 0x664422 },
  { id: 'elven_longbow',     name: 'Elven Longbow',      description: 'An elegant longbow crafted by elven master bowyers.',               cost: 3000,  requiredLevel: 30, classId: 'archer', damageBonus: 65,  attackSpeedPct: 0.40, rangeBonus: 160,rotBonusPct: 0.20, ghoulMaxBonus: 0, lifestealPct: 0.10, color: 0xeeddaa },
  { id: 'thunderstrike_bow', name: 'Thunderstrike Bow',  description: 'A bow whose arrows strike like lightning bolts.',                   cost: 6500,  requiredLevel: 40, classId: 'archer', damageBonus: 95,  attackSpeedPct: 0.50, rangeBonus: 190,rotBonusPct: 0.30, ghoulMaxBonus: 0, lifestealPct: 0.12, color: 0x66ddff },
  { id: 'shadowstring',      name: 'Shadowstring',       description: 'An assassin\'s bow that fires almost silently.',                    cost: 14000, requiredLevel: 50, classId: 'archer', damageBonus: 140, attackSpeedPct: 0.60, rangeBonus: 220,rotBonusPct: 0.40, ghoulMaxBonus: 0, lifestealPct: 0.18, color: 0x444455 },
  { id: 'hawkeye_bow',       name: 'Hawkeye Bow',        description: 'A precision bow used by master archers to slay kings.',             cost: 28000, requiredLevel: 60, classId: 'archer', damageBonus: 200, attackSpeedPct: 0.70, rangeBonus: 260,rotBonusPct: 0.50, ghoulMaxBonus: 0, lifestealPct: 0.22, color: 0xffcc66 },
  { id: 'world_piercer',     name: 'World Piercer',      description: 'The ultimate bow — its arrows can pierce mountains.',               cost: 60000, requiredLevel: 70, classId: 'archer', damageBonus: 300, attackSpeedPct: 0.85, rangeBonus: 320,rotBonusPct: 0.65, ghoulMaxBonus: 0, lifestealPct: 0.30, color: 0xffeebb },
];

const ALL_WEAPONS = [
  ...NECROMANCER_WEAPONS,
  ...PALADIN_WEAPONS,
  ...BARBARIAN_WEAPONS,
  ...TEMPLAR_WEAPONS,
  ...MAGE_WEAPONS,
  ...ARCHER_WEAPONS,
];

export function getClassWeapons(classId: string): WeaponDef[] {
  switch (classId) {
    case 'necromancer':    return NECROMANCER_WEAPONS;
    case 'paladin':        return PALADIN_WEAPONS;
    case 'barbarian':      return BARBARIAN_WEAPONS;
    case 'templar_knight': return TEMPLAR_WEAPONS;
    case 'mage':           return MAGE_WEAPONS;
    case 'archer':         return ARCHER_WEAPONS;
    default: return [];
  }
}

export function getWeaponById(id: string): WeaponDef | null {
  return ALL_WEAPONS.find(w => w.id === id) ?? null;
}
