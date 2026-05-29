// ============================================================================
// STAGE CONFIGURATION TABLE — Stages 2–50
// ============================================================================
// Stage 1 (Forest Entrance) is already implemented in ForestStage.ts.
// This file defines stages 2–50 across 10 biome arcs.
//
// Biome Progression:
//   Stages  2– 8: Forest
//   Stages  9–14: Occupied Wildlands
//   Stages 15–19: Stone March
//   Stages 20–23: Fortress Interior
//   Stages 24–28: Deep Caverns
//   Stages 29–33: Mirelands
//   Stages 34–38: Highland Wilds
//   Stages 39–42: Ruined Civilization
//   Stages 43–46: Arcane Expanse
//   Stages 47–50: Dark Sovereign Domain
//
// Boss stages: 8, 14, 19, 23, 28, 33, 38, 42, 46, 50
// ============================================================================

export interface StageConfig {
  stageNumber: number;
  stageName: string;
  biomeId: string;
  enemyRoster: string[];
  environmentMechanic: string;
  terrainFeatures: string[];
  bossName?: string;
  /** Override the boss enemy's archetype (bodyStyle + color). If unset, boss uses primary archetype. */
  bossArchetype?: string;
}

export const STAGE_CONFIGS: StageConfig[] = [
  // ========================== FOREST (Stages 2–8) ==========================
  {
    stageNumber: 2,
    stageName: 'Mossy Hollow',
    biomeId: 'forest',
    enemyRoster: ['forest_hedge_sprite', 'forest_goblin_scout'],
    environmentMechanic: 'Dense undergrowth slows movement; clearings grant brief speed boosts.',
    terrainFeatures: ['moss-covered boulders', 'fallen logs', 'shallow creek'],
  },
  {
    stageNumber: 3,
    stageName: 'Bramblewood Path',
    biomeId: 'forest',
    enemyRoster: ['forest_barkhide_boar', 'forest_hedge_sprite'],
    environmentMechanic: 'Thorny brambles damage heroes who linger; burning them creates temporary safe zones.',
    terrainFeatures: ['thorn walls', 'dirt trail', 'wildflower patches'],
  },
  {
    stageNumber: 4,
    stageName: 'Sporecap Glade',
    biomeId: 'forest',
    enemyRoster: ['forest_thorn_slinger', 'forest_goblin_scout'],
    environmentMechanic: 'Mushroom clusters release toxic clouds on a timer; wind gusts periodically clear them.',
    terrainFeatures: ['giant mushrooms', 'rotting stumps', 'bioluminescent moss'],
  },
  {
    stageNumber: 5,
    stageName: 'Thorn Ridge',
    biomeId: 'forest',
    enemyRoster: ['forest_spore_mushroom', 'forest_barkhide_boar'],
    environmentMechanic: 'Elevated ridges give ranged enemies height advantage; heroes can climb to neutralize it.',
    terrainFeatures: ['rocky ridge', 'thorn thickets', 'exposed tree roots'],
  },
  {
    stageNumber: 6,
    stageName: 'Whispering Canopy',
    biomeId: 'forest',
    enemyRoster: ['forest_thorn_slinger', 'forest_spore_mushroom', 'forest_hedge_sprite'],
    environmentMechanic: 'Fungal territory — periodic spore vents release hazard clouds; glowcap mushroom clusters mark danger zones.',
    terrainFeatures: ['mushroom clusters', 'spore fog pockets', 'rotting logs', 'dense canopy shadows', 'glowcap accents'],
  },
  {
    stageNumber: 7,
    stageName: 'Bandit\'s Crossing',
    biomeId: 'forest',
    enemyRoster: ['forest_bandit_raider', 'forest_bandit_captain', 'forest_shaman'],
    environmentMechanic: 'Bandit ambush zone — raiders charge from barricades; shaman boss commands from the rear.',
    terrainFeatures: ['rope barricades', 'broken supply crates', 'cut stumps', 'campfire remains', 'wooden spike traps', 'wagon wreckage'],
    bossName: 'Grimroot the Elder Shaman',
    bossArchetype: 'forest_shaman',
  },
  {
    stageNumber: 8,
    stageName: 'The Bandit Stronghold',
    biomeId: 'forest',
    enemyRoster: ['forest_bandit_captain', 'forest_shaman', 'forest_bandit_raider'],
    environmentMechanic: 'Fortified bandit camp — barricade choke points, shaman-protected zones, captain rally calls.',
    terrainFeatures: ['barricade walls', 'bandit tents', 'campfire clusters', 'watch posts', 'weapon racks', 'cut-log fortifications'],
    bossName: 'Ironjaw the Bandit King',
  },

  // =================== OCCUPIED WILDLANDS (Stages 9–14) ====================
  {
    stageNumber: 9,
    stageName: 'Scorched Perimeter',
    biomeId: 'wildlands',
    enemyRoster: ['wildlands_foot_soldier', 'wildlands_shield_bearer'],
    environmentMechanic: 'Burned grassland offers no cover; smoke plumes periodically obscure vision.',
    terrainFeatures: ['charred stumps', 'smoldering grass', 'patrol markers'],
  },
  {
    stageNumber: 10,
    stageName: 'Supply Line',
    biomeId: 'wildlands',
    enemyRoster: ['wildlands_shield_bearer', 'wildlands_foot_soldier'],
    environmentMechanic: 'Supply wagons move across the field; destroying them drops temporary power-ups.',
    terrainFeatures: ['dirt road', 'supply crates', 'wagon tracks'],
  },
  {
    stageNumber: 11,
    stageName: 'Fieldworks',
    biomeId: 'wildlands',
    enemyRoster: ['wildlands_crossbowman', 'wildlands_shield_bearer'],
    environmentMechanic: 'Trenches provide cover but limit movement; enemy net throwers flush heroes from shelter.',
    terrainFeatures: ['trenches', 'wooden stakes', 'sandbag walls'],
  },
  {
    stageNumber: 12,
    stageName: 'Rally Point',
    biomeId: 'wildlands',
    enemyRoster: ['wildlands_net_thrower', 'wildlands_foot_soldier', 'wildlands_crossbowman'],
    environmentMechanic: 'War banners buff nearby enemies with increased attack speed; destroying banners removes the buff.',
    terrainFeatures: ['command tent', 'war banners', 'weapon racks'],
  },
  {
    stageNumber: 13,
    stageName: 'Siege Encampment',
    biomeId: 'wildlands',
    enemyRoster: ['wildlands_banner_carrier', 'wildlands_shield_bearer', 'wildlands_net_thrower'],
    environmentMechanic: 'Catapult strikes land on timed intervals; impact zones are telegraphed before detonation.',
    terrainFeatures: ['siege equipment', 'palisade walls', 'fire pits'],
  },
  {
    stageNumber: 14,
    stageName: 'The Warlord\'s Stand',
    biomeId: 'wildlands',
    enemyRoster: ['wildlands_war_sergeant', 'wildlands_shield_bearer', 'wildlands_crossbowman', 'wildlands_net_thrower'],
    environmentMechanic: 'The Warlord rallies reinforcements every 30 seconds; breaking his war horn stops reinforcements.',
    terrainFeatures: ['raised platform', 'trophy poles', 'iron cage'],
    bossName: 'Ironjaw the Occupation Warlord',
  },

  // ===================== STONE MARCH (Stages 15–19) ========================
  {
    stageNumber: 15,
    stageName: 'The Broken Road',
    biomeId: 'stone_march',
    enemyRoster: ['stone_gravel_runner', 'stone_cliff_slinger'],
    environmentMechanic: 'Crumbling roadway collapses underfoot; stable stones are subtly marked.',
    terrainFeatures: ['fractured cobblestones', 'cliff face', 'rockslide debris'],
  },
  {
    stageNumber: 16,
    stageName: 'Dust Canyon',
    biomeId: 'stone_march',
    enemyRoster: ['stone_stonebreaker', 'stone_gravel_runner'],
    environmentMechanic: 'Dust storms reduce visibility every 20 seconds; hugging canyon walls provides shelter.',
    terrainFeatures: ['narrow canyon', 'wind-carved pillars', 'sand drifts'],
  },
  {
    stageNumber: 17,
    stageName: 'Boulder Choke',
    biomeId: 'stone_march',
    enemyRoster: ['stone_cliff_slinger', 'stone_boulder_pusher'],
    environmentMechanic: 'Boulders roll down slopes on a timer; side alcoves provide safety.',
    terrainFeatures: ['steep incline', 'boulder chute', 'rock alcoves'],
  },
  {
    stageNumber: 18,
    stageName: 'Drumfire Pass',
    biomeId: 'stone_march',
    enemyRoster: ['stone_boulder_pusher', 'stone_stonebreaker'],
    environmentMechanic: 'War drums accelerate enemy spawn rate; silencing each drum slows spawns.',
    terrainFeatures: ['mountain pass', 'drum platforms', 'stone watchtowers'],
  },
  {
    stageNumber: 19,
    stageName: 'The Granite Throne',
    biomeId: 'stone_march',
    enemyRoster: ['stone_pass_warden', 'stone_war_drummer', 'stone_stonebreaker', 'stone_cliff_slinger'],
    environmentMechanic: 'The throne empowers the boss with stone armor that regenerates; destroying pillars weakens it.',
    terrainFeatures: ['carved throne', 'support pillars', 'collapsed archway'],
    bossName: 'Korrath the Mountain King',
  },

  // =================== FORTRESS INTERIOR (Stages 20–23) ====================
  {
    stageNumber: 20,
    stageName: 'Gatehouse Breach',
    biomeId: 'fortress',
    enemyRoster: ['fortress_castle_guard', 'fortress_arrow_turret'],
    environmentMechanic: 'Portcullis gates slam shut on a timer, splitting the arena; levers reopen them.',
    terrainFeatures: ['iron portcullis', 'murder holes', 'torch sconces'],
  },
  {
    stageNumber: 21,
    stageName: 'The Gauntlet Halls',
    biomeId: 'fortress',
    enemyRoster: ['fortress_tower_knight', 'fortress_trap_engineer'],
    environmentMechanic: 'Floor panels trigger dart traps and flame jets; engineers continuously reset sprung traps.',
    terrainFeatures: ['stone corridors', 'pressure plates', 'iron grates'],
  },
  {
    stageNumber: 22,
    stageName: 'Dungeon Block',
    biomeId: 'fortress',
    enemyRoster: ['fortress_arrow_turret', 'fortress_castle_guard'],
    environmentMechanic: 'Alarm bells summon waves of reinforcements; destroying bells prevents extra spawns.',
    terrainFeatures: ['prison cells', 'chains and shackles', 'drainage grates'],
  },
  {
    stageNumber: 23,
    stageName: 'The Iron Sanctum',
    biomeId: 'fortress',
    enemyRoster: ['fortress_trap_engineer', 'fortress_alarm_bell_warden', 'fortress_tower_knight'],
    environmentMechanic: 'The Castellan activates fortress defenses in phases: turrets, then traps, then lockdown.',
    terrainFeatures: ['command chamber', 'weapon displays', 'reinforced doors'],
    bossName: 'Castellan Dredmor',
  },

  // ===================== DEEP CAVERNS (Stages 24–28) =======================
  {
    stageNumber: 24,
    stageName: 'Gloomtunnel Descent',
    biomeId: 'deep_caverns',
    enemyRoster: ['caverns_cave_bat', 'caverns_tunnel_burrower'],
    environmentMechanic: 'Near-total darkness; light sources reveal enemies but also attract cave bats.',
    terrainFeatures: ['stalactites', 'narrow tunnels', 'dripping water'],
  },
  {
    stageNumber: 25,
    stageName: 'Crystal Vein',
    biomeId: 'deep_caverns',
    enemyRoster: ['caverns_tunnel_burrower', 'caverns_cave_bat'],
    environmentMechanic: 'Crystal formations refract projectiles, bouncing shots unpredictably through the cavern.',
    terrainFeatures: ['crystal clusters', 'reflective walls', 'mineral deposits'],
  },
  {
    stageNumber: 26,
    stageName: 'Echo Chamber',
    biomeId: 'deep_caverns',
    enemyRoster: ['caverns_crystal_spitter', 'caverns_tunnel_burrower'],
    environmentMechanic: 'Sound-based attacks echo and hit twice; silence zones negate the echo effect.',
    terrainFeatures: ['domed cavern', 'sound-dampening moss', 'echo wells'],
  },
  {
    stageNumber: 27,
    stageName: 'The Fungal Sprawl',
    biomeId: 'deep_caverns',
    enemyRoster: ['caverns_echo_leech', 'caverns_crystal_spitter'],
    environmentMechanic: 'Glowcap colonies spread across the floor over time; stepping on them releases slowing spores.',
    terrainFeatures: ['bioluminescent fungi', 'spore clouds', 'cavern lake'],
  },
  {
    stageNumber: 28,
    stageName: 'The Crystalline Maw',
    biomeId: 'deep_caverns',
    enemyRoster: ['caverns_crystal_titan', 'caverns_glowcap_colony'],
    environmentMechanic: 'The Crystal Titan absorbs crystal formations to heal; shattering crystals first denies healing.',
    terrainFeatures: ['massive geode chamber', 'crystal throne', 'underground river'],
    bossName: 'Xylothar the Crystal Titan',
  },

  // ======================== MIRELANDS (Stages 29–33) =======================
  {
    stageNumber: 29,
    stageName: 'Bogwater Crossing',
    biomeId: 'mirelands',
    enemyRoster: ['mire_bog_imp', 'mire_vine_grabber'],
    environmentMechanic: 'Swamp water slows movement to half speed; raised hummocks offer solid footing.',
    terrainFeatures: ['murky pools', 'reed beds', 'rotting boardwalk'],
  },
  {
    stageNumber: 30,
    stageName: 'Fetid Shallows',
    biomeId: 'mirelands',
    enemyRoster: ['mire_mud_hulk', 'mire_bog_imp'],
    environmentMechanic: 'Toad shamans curse tiles, causing poison damage over time; cleansing totems purify the ground.',
    terrainFeatures: ['bubbling mud', 'dead trees', 'insect swarms'],
  },
  {
    stageNumber: 31,
    stageName: 'The Stranglemarsh',
    biomeId: 'mirelands',
    enemyRoster: ['mire_toad_shaman', 'mire_vine_grabber'],
    environmentMechanic: 'Vines periodically erupt from the ground to root heroes in place for 2 seconds.',
    terrainFeatures: ['grasping vines', 'pitcher plants', 'sunken ruins'],
  },
  {
    stageNumber: 32,
    stageName: 'Rot Hollow',
    biomeId: 'mirelands',
    enemyRoster: ['mire_vine_grabber', 'mire_mud_hulk', 'mire_rot_priest'],
    environmentMechanic: 'Rot priests channel decay auras that weaken hero armor; interrupting the channel dispels it.',
    terrainFeatures: ['blighted clearing', 'bone piles', 'corrupted shrine'],
  },
  {
    stageNumber: 33,
    stageName: 'The Sunken Altar',
    biomeId: 'mirelands',
    enemyRoster: ['mire_swamp_horror', 'mire_bog_imp', 'mire_toad_shaman', 'mire_vine_grabber'],
    environmentMechanic: 'The altar periodically submerges the arena in rising water; the boss gains power while submerged.',
    terrainFeatures: ['half-sunken altar', 'fetid waterfall', 'ritual circles'],
    bossName: 'Blightmother Vasska',
  },

  // ==================== HIGHLAND WILDS (Stages 34–38) ======================
  {
    stageNumber: 34,
    stageName: 'Windswept Plateau',
    biomeId: 'highland',
    enemyRoster: ['highland_goat_raider', 'highland_frost_ram'],
    environmentMechanic: 'Strong winds push heroes and projectiles sideways; wind direction changes periodically.',
    terrainFeatures: ['exposed plateau', 'wind-bent pines', 'snow patches'],
  },
  {
    stageNumber: 35,
    stageName: 'Frostbite Ridge',
    biomeId: 'highland',
    enemyRoster: ['highland_frost_ram', 'highland_goat_raider'],
    environmentMechanic: 'Ice patches cause heroes to slide; frozen enemies shatter for area damage.',
    terrainFeatures: ['icy ledges', 'frozen streams', 'jagged peaks'],
  },
  {
    stageNumber: 36,
    stageName: 'Gale Summit',
    biomeId: 'highland',
    enemyRoster: ['highland_ice_caster', 'highland_windcaller'],
    environmentMechanic: 'Windcallers conjure gale walls that block movement; flanking around them is required.',
    terrainFeatures: ['mountain summit', 'prayer flags', 'stone cairns'],
  },
  {
    stageNumber: 37,
    stageName: 'Avalanche Run',
    biomeId: 'highland',
    enemyRoster: ['highland_windcaller', 'highland_frost_ram'],
    environmentMechanic: 'Avalanche waves cascade down the slope on a timer; overhangs provide shelter.',
    terrainFeatures: ['steep snowfield', 'rock overhangs', 'ice caves'],
  },
  {
    stageNumber: 38,
    stageName: 'The Stormcrown Peak',
    biomeId: 'highland',
    enemyRoster: ['highland_avalanche_giant', 'highland_storm_totem'],
    environmentMechanic: 'Lightning strikes random positions; storm totems redirect lightning toward heroes.',
    terrainFeatures: ['peak summit', 'lightning rods', 'thundercloud layer'],
    bossName: 'Thundrak the Stormborn',
  },

  // ================== RUINED CIVILIZATION (Stages 39–42) ===================
  {
    stageNumber: 39,
    stageName: 'Crumbling Colonnade',
    biomeId: 'ruins',
    enemyRoster: ['ruins_relic_drone', 'ruins_archive_wisp'],
    environmentMechanic: 'Pillars collapse when damaged, creating rubble cover but also crushing anything beneath.',
    terrainFeatures: ['marble columns', 'cracked mosaics', 'overgrown courtyards'],
  },
  {
    stageNumber: 40,
    stageName: 'The Silent Archive',
    biomeId: 'ruins',
    enemyRoster: ['ruins_stone_sentinel', 'ruins_relic_drone'],
    environmentMechanic: 'Ancient rune cannons activate when heroes step on glyph tiles; wisps recharge spent cannons.',
    terrainFeatures: ['towering bookshelves', 'floating rune tablets', 'dust motes'],
  },
  {
    stageNumber: 41,
    stageName: 'Glyph Labyrinth',
    biomeId: 'ruins',
    enemyRoster: ['ruins_rune_cannon', 'ruins_glyph_trap'],
    environmentMechanic: 'Glyph traps teleport heroes to random positions; memorizing safe paths avoids displacement.',
    terrainFeatures: ['shifting walls', 'glowing floor glyphs', 'broken statuary'],
  },
  {
    stageNumber: 42,
    stageName: 'The Colossus Gate',
    biomeId: 'ruins',
    enemyRoster: ['ruins_archive_wisp', 'ruins_colossus_fragment', 'ruins_stone_sentinel', 'ruins_rune_cannon'],
    environmentMechanic: 'Colossus fragments reassemble over time; destroying all pieces simultaneously prevents revival.',
    terrainFeatures: ['massive gate frame', 'colossus debris', 'ancient mechanism'],
    bossName: 'The Reassembled Colossus',
  },

  // ===================== ARCANE EXPANSE (Stages 43–46) =====================
  {
    stageNumber: 43,
    stageName: 'Mana Flats',
    biomeId: 'arcane',
    enemyRoster: ['arcane_mana_sprite', 'arcane_rift_caster'],
    environmentMechanic: 'Ambient mana pools amplify abilities used near them but also empower enemies equally.',
    terrainFeatures: ['crystalline plains', 'mana geysers', 'floating debris'],
  },
  {
    stageNumber: 44,
    stageName: 'Rift Corridor',
    biomeId: 'arcane',
    enemyRoster: ['arcane_arcane_golem', 'arcane_mana_sprite'],
    environmentMechanic: 'Dimensional rifts pull heroes toward them; rift casters open new rifts mid-combat.',
    terrainFeatures: ['torn reality seams', 'hovering platforms', 'arcane storms'],
  },
  {
    stageNumber: 45,
    stageName: 'Gravity Nexus',
    biomeId: 'arcane',
    enemyRoster: ['arcane_rift_caster', 'arcane_gravity_well'],
    environmentMechanic: 'Gravity reverses in zones; heroes float upward and must navigate inverted terrain.',
    terrainFeatures: ['inverted towers', 'gravity anchors', 'energy conduits'],
  },
  {
    stageNumber: 46,
    stageName: 'The Leyline Convergence',
    biomeId: 'arcane',
    enemyRoster: ['arcane_gravity_well', 'arcane_leyline_anchor'],
    environmentMechanic: 'Leylines pulse with escalating energy; the boss channels all leylines for a devastating attack unless anchors are destroyed.',
    terrainFeatures: ['leyline intersection', 'energy spire', 'void rift'],
    bossName: 'Aethon the Leyline Tyrant',
  },

  // ================= DARK SOVEREIGN DOMAIN (Stages 47–50) ==================
  {
    stageNumber: 47,
    stageName: 'Obsidian Threshold',
    biomeId: 'dark_sovereign',
    enemyRoster: ['arcane_phase_guardian', 'dark_blackblade_acolyte'],
    environmentMechanic: 'Shadow zones drain hero health over time; light orbs dispel shadows temporarily.',
    terrainFeatures: ['obsidian spires', 'shadow pools', 'flickering torches'],
  },
  {
    stageNumber: 48,
    stageName: 'The Blood Corridor',
    biomeId: 'dark_sovereign',
    enemyRoster: ['dark_blackblade_acolyte', 'dark_shadow_chain_caster'],
    environmentMechanic: 'Blood priests siphon hero health to empower the Sovereign; killing priests returns stolen health.',
    terrainFeatures: ['blood channels', 'sacrificial basins', 'dark tapestries'],
  },
  {
    stageNumber: 49,
    stageName: 'Chain Sanctum',
    biomeId: 'dark_sovereign',
    enemyRoster: ['dark_obsidian_knight', 'dark_void_archer'],
    environmentMechanic: 'Shadow chains bind heroes to pillars; breaking chains requires sustained damage to the anchor point.',
    terrainFeatures: ['chain pillars', 'execution platform', 'soul lanterns'],
  },
  {
    stageNumber: 50,
    stageName: 'The Dark Sovereign\'s Throne',
    biomeId: 'dark_sovereign',
    enemyRoster: ['dark_royal_executioner', 'dark_obsidian_knight', 'dark_void_archer', 'dark_blood_priest'],
    environmentMechanic: 'The Dark Sovereign cycles through three phases: shadow clones, void storm, and final stand. Each phase requires a different strategy.',
    terrainFeatures: ['obsidian throne', 'void portal', 'shattered crown pedestal'],
    bossName: 'Malachar the Dark Sovereign',
  },
];

/**
 * Retrieve the configuration for a specific stage number.
 */
export function getStageConfig(stageNumber: number): StageConfig | undefined {
  return STAGE_CONFIGS.find((s) => s.stageNumber === stageNumber);
}

/**
 * Get the biome ID for a given stage number.
 * Returns 'forest' for stage 1 (handled elsewhere) and 'unknown' for invalid stages.
 */
export function getStageBiome(stageNumber: number): string {
  if (stageNumber === 1) return 'forest';
  const config = getStageConfig(stageNumber);
  return config ? config.biomeId : 'unknown';
}
