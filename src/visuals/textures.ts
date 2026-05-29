// =============================================================================
// TEXTURE REGISTRY + ASSET LOADER
// =============================================================================
// Single source of truth for every texture key the game expects. Procedural
// builders look up keys here; the future raster pipeline loads PNGs into
// the same keys, so swapping a class to real art is a one-line change.
//
// Currently the procedural builders generate textures lazily on first use
// via canvasParts.paintBodyPart(). When raster sprites become available,
// add the file path to the ASSET_FILES table below — Phaser's preload phase
// will load it under the same key, and any code that does
// `scene.add.image(x, y, TextureKeys.PALADIN_TORSO)` instantly uses the
// painted PNG instead of the canvas-rendered version.

import Phaser from 'phaser';

// =============================================================================
// TEXTURE KEYS
// =============================================================================
// Keep these short, kebab-cased, and namespaced by class/type. Don't read
// these as strings anywhere — always import the constant.

export const TextureKeys = {
  // ----- Paladin -----
  PALADIN_SHEET:    'paladin/spritesheet',
  PALADIN_IDLE_SHEET: 'paladin/idle-sheet',
  PALADIN_RUN_SHEET: 'paladin/run-sheet',
  PALADIN_ATTACK_SHEET: 'paladin/attack-sheet',
  PALADIN_FINISHER_SHEET: 'paladin/finisher-sheet',
  PALADIN_FINAL_SMASH_SHEET: 'paladin/final-smash-sheet',
  PALADIN_TORSO:    'paladin/torso',
  PALADIN_HELM:     'paladin/helm',
  PALADIN_PAULDRON_L: 'paladin/pauldron-l',
  PALADIN_PAULDRON_R: 'paladin/pauldron-r',
  PALADIN_THIGH:    'paladin/thigh',
  PALADIN_SHIN:     'paladin/shin',
  PALADIN_BOOT:     'paladin/boot',
  PALADIN_ARM:      'paladin/arm',
  PALADIN_GAUNTLET: 'paladin/gauntlet',
  PALADIN_SWORD:    'paladin/sword',
  PALADIN_SHIELD:   'paladin/shield',
  PALADIN_CAPE:     'paladin/cape',
  PALADIN_TABARD:   'paladin/tabard',
  PALADIN_CROSS:    'paladin/cross',
  PALADIN_PLUME:    'paladin/plume',
  PALADIN_HALO:     'paladin/halo',
  /** Single full-body paladin sprite — replaces ALL part textures when present. */
  PALADIN_FULL:     'paladin/full',

  // ----- Paladin Weapons -----
  WEAPON_OAK_MACE:          'weapon/oak-mace',
  WEAPON_SPIKED_OAK_MACE:   'weapon/spiked-oak-mace',
  WEAPON_STONE_MACE:        'weapon/stone-mace',
  WEAPON_SPIKED_STONE_MACE: 'weapon/spiked-stone-mace',
  WEAPON_IRON_MACE:         'weapon/iron-mace',
  WEAPON_SPIKED_IRON_MACE:  'weapon/spiked-iron-mace',
  WEAPON_GOLDEN_MACE:       'weapon/golden-mace',
  WEAPON_SPIKED_GOLDEN_MACE:'weapon/spiked-golden-mace',
  WEAPON_RUBY_MACE:         'weapon/ruby-mace',
  WEAPON_SPIKED_RUBY_MACE:  'weapon/spiked-ruby-mace',

  // ----- Goblin (enemy) -----
  GOBLIN_BODY:    'goblin/body',
  GOBLIN_HEAD:    'goblin/head',
  GOBLIN_ARM:     'goblin/arm',
  GOBLIN_LEG:     'goblin/leg',
  GOBLIN_WEAPON:  'goblin/weapon',

  // ----- Environment: trees (multi-variant for visual variety) -----
  ENV_TREE_NEAR_A: 'env/tree-near-a',
  ENV_TREE_NEAR_B: 'env/tree-near-b',
  ENV_TREE_NEAR_C: 'env/tree-near-c',
  ENV_TREE_NEAR_D: 'env/tree-near-d',
  ENV_TREE_NEAR_E: 'env/tree-near-e',
  ENV_TREE_MID_A:  'env/tree-mid-a',
  ENV_TREE_MID_B:  'env/tree-mid-b',
  ENV_TREE_MID_C:  'env/tree-mid-c',
  ENV_TREE_MID_D:  'env/tree-mid-d',
  ENV_TREE_FAR_A:  'env/tree-far-a',
  ENV_TREE_FAR_B:  'env/tree-far-b',
  ENV_TREE_FAR_C:  'env/tree-far-c',
  // Rocks (variants)
  ENV_ROCK_A:      'env/rock-a',
  ENV_ROCK_B:      'env/rock-b',
  ENV_ROCK_C:      'env/rock-c',
  ENV_ROCK_D:      'env/rock-d',
  ENV_ROCK_SMALL:  'env/rock-small',
  // Logs / wood debris
  ENV_LOG_A:       'env/log-a',
  ENV_LOG_B:       'env/log-b',
  ENV_PLANK:       'env/plank',
  // Fences (broken)
  ENV_FENCE_POST:  'env/fence-post',
  ENV_FENCE_LEAN:  'env/fence-lean',
  ENV_FENCE_BROKEN:'env/fence-broken',
  // Ruins (mid-background structural shapes)
  ENV_RUIN_PILLAR: 'env/ruin-pillar',
  ENV_RUIN_ARCH:   'env/ruin-arch',
  ENV_RUIN_BLOCK:  'env/ruin-block',
  ENV_RUIN_WALL:   'env/ruin-wall',
  // Vegetation
  ENV_GRASS_A:     'env/grass-a',
  ENV_GRASS_B:     'env/grass-b',
  ENV_GRASS_DEAD:  'env/grass-dead',
  ENV_BUSH:        'env/bush',
  // Ground patches (used along the play layer for variation)
  ENV_GROUND_PATCH_A: 'env/ground-patch-a',
  ENV_GROUND_PATCH_B: 'env/ground-patch-b',
  ENV_GROUND_PATCH_C: 'env/ground-patch-c',
  // Foreground branch silhouettes (overhanging tree limbs)
  ENV_BRANCH_A:    'env/branch-a',
  ENV_BRANCH_B:    'env/branch-b',
  ENV_BRANCH_C:    'env/branch-c',
  // Angled debris (fallen beams, splintered wood)
  ENV_DEBRIS_A:    'env/debris-a',
  ENV_DEBRIS_B:    'env/debris-b',
  // Fence segment (horizontal rail crossing the lane)
  ENV_FENCE_RAIL:  'env/fence-rail',
  // Ground shadow patches (darker zones beneath trees/structures)
  ENV_SHADOW_PATCH:'env/shadow-patch',
  // Terrain elevation hint (slight earth mound / ridge)
  ENV_MOUND:       'env/mound',
  // Distant background silhouette band (mountains / structures)
  ENV_BG_HORIZON:  'env/bg-horizon',
  // Sky gradient
  ENV_SKY_GRADIENT: 'env/sky-gradient',

  // ----- Ambient particles -----
  PARTICLE_LEAF:  'fx/leaf',
  PARTICLE_EMBER: 'fx/ember',
  PARTICLE_DUST:  'fx/dust',
} as const;

export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

// =============================================================================
// TEXTURE GENERATION VERSION STAMP
// =============================================================================
// Bump this number whenever the procedural generation code changes. On scene
// preload, clearProceduralTextures checks this against the cached stamp — if
// it differs, ALL procedural textures are removed so they regenerate cleanly.
// This prevents stale canvas textures from a previous code version lingering
// in the Phaser texture cache across scene restarts.
const GENERATION_VERSION = 10;
const VERSION_STAMP_KEY = '__hq_gen_version';

/**
 * Remove all procedurally generated textures from the Phaser cache if the
 * generation code version has changed since they were last built. Call this
 * BEFORE generatePlaceholderAssets / ensureEnvironmentTextures.
 *
 * Real PNG assets loaded via ASSET_FILES are NOT removed — they reload from
 * disk on the next preload anyway.
 */
export function clearStaleTextures(scene: Phaser.Scene): void {
  // Check the cached version stamp
  const cached = (scene.textures as unknown as Record<string, unknown>)[VERSION_STAMP_KEY];
  if (cached === GENERATION_VERSION) return; // already current

  // Version mismatch (or first run) — purge all procedural keys
  const allKeys = Object.values(TextureKeys) as string[];
  for (const key of allKeys) {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
  }

  // Store the new version stamp so we don't purge again this session
  (scene.textures as unknown as Record<string, unknown>)[VERSION_STAMP_KEY] = GENERATION_VERSION;
}

// =============================================================================
// RASTER ASSET TABLE
// =============================================================================
// When you have real PNG art for a key, add it here. The preload step will
// load it under the matching texture key, and procedural fallbacks will be
// skipped because the key already exists.
//
// Path is relative to /public — Vite serves /public/* at the site root.
// Example: 'assets/paladin/torso.png' lives at public/assets/paladin/torso.png
// and is loaded by Phaser as `scene.load.image(KEY, 'assets/paladin/torso.png')`.

export interface RasterAssetEntry {
  key: TextureKey;
  path: string;
  /** If true, this is a sprite sheet — frameWidth/Height required */
  isSheet?: boolean;
  frameWidth?: number;
  frameHeight?: number;
  /** Transparent pixels between frames (default 0) */
  spacing?: number;
}

/**
 * RASTER OVERRIDE TABLE — uncomment entries as you add PNG files.
 *
 * When an entry is active and the file exists at the path, Phaser loads it
 * during preload() and the procedural fallback is skipped. When commented
 * out or the file is missing, the CanvasTexture generator fills in.
 *
 * Priority order for the biggest visual upgrade with fewest files:
 *
 * TIER 1 — environment (most screen coverage)
 *   1. ENV_SKY_GRADIENT     256×720    painted sky gradient
 *   2. ENV_TREE_NEAR_A..E   140×200    near trees (5 variants)
 *   3. ENV_GROUND_PATCH_A..C 120×36    ground dirt patches (3 variants)
 *   4. ENV_ROCK_A..D          60–80    rock variants (4)
 *   5. ENV_RUIN_PILLAR        60×140   ruin column
 *   6. ENV_RUIN_WALL         130×80    crumbling wall
 *
 * TIER 2 — characters
 *   7. PALADIN_TORSO          80×80
 *   8. PALADIN_HELM           64×72
 *   ...see assets/README.md for the full list
 */
export const ASSET_FILES: RasterAssetEntry[] = [
  // ===== PALADIN SPRITESHEET (combined — disabled until all rows are ready) =====
  // { key: TextureKeys.PALADIN_SHEET, path: 'assets/paladin/spritesheet.png',
  //   isSheet: true, frameWidth: 128, frameHeight: 128 },

  // ===== PALADIN INDIVIDUAL POSE SHEETS =====
  // Idle: 5376x3136, 8 cols x 7 rows (50 filled), 672x448 per frame
  { key: TextureKeys.PALADIN_IDLE_SHEET, path: 'assets/paladin/paladin_idle_main_v1.png',
    isSheet: true, frameWidth: 672, frameHeight: 448 },
  // Run: 1440x960, 5 cols x 5 rows (22 filled), 288x192 per frame
  { key: TextureKeys.PALADIN_RUN_SHEET, path: 'assets/paladin/paladin_run_main_v1.png',
    isSheet: true, frameWidth: 288, frameHeight: 192 },
  // Attack: converted from 256x256 cells → 1056x544 canvas per frame (147 frames)
  { key: TextureKeys.PALADIN_ATTACK_SHEET, path: 'assets/paladin/paladin_attack_main_v1_converted.png',
    isSheet: true, frameWidth: 1056, frameHeight: 544 },
  // Finisher (overhead swing): 10560x8160, 10 cols x 15 rows (150 filled), 1056x544 per frame
  // Taller than attack (480) to fit overhead weapon arc at torso-matched scale.
  { key: TextureKeys.PALADIN_FINISHER_SHEET, path: 'assets/paladin/paladin_overhead_swing_v1.png',
    isSheet: true, frameWidth: 1056, frameHeight: 576 },
  // Final Smash: 12672x6528, 12 cols x 12 rows (144 filled), 1056x544 per frame
  { key: TextureKeys.PALADIN_FINAL_SMASH_SHEET, path: 'assets/paladin/paladin_final_smash_v1.png',
    isSheet: true, frameWidth: 1056, frameHeight: 544 },

  // ===== PALADIN WEAPONS =====
  { key: TextureKeys.WEAPON_OAK_MACE,          path: 'assets/paladin/Weapons/Oak Mace.png' },
  { key: TextureKeys.WEAPON_SPIKED_OAK_MACE,   path: 'assets/paladin/Weapons/Spiked Oak Mace.png' },
  { key: TextureKeys.WEAPON_STONE_MACE,         path: 'assets/paladin/Weapons/Stone Mace.png' },
  { key: TextureKeys.WEAPON_SPIKED_STONE_MACE,  path: 'assets/paladin/Weapons/Spiked Stone Mace.png' },
  { key: TextureKeys.WEAPON_IRON_MACE,           path: 'assets/paladin/Weapons/Iron Mace.png' },
  { key: TextureKeys.WEAPON_SPIKED_IRON_MACE,    path: 'assets/paladin/Weapons/Spiked Iron Mace.png' },
  { key: TextureKeys.WEAPON_GOLDEN_MACE,         path: 'assets/paladin/Weapons/Golden Mace.png' },
  { key: TextureKeys.WEAPON_SPIKED_GOLDEN_MACE,  path: 'assets/paladin/Weapons/Spiked Golden Mace.png' },
  { key: TextureKeys.WEAPON_RUBY_MACE,            path: 'assets/paladin/Weapons/Ruby Mace.png' },
  { key: TextureKeys.WEAPON_SPIKED_RUBY_MACE,     path: 'assets/paladin/Weapons/Spiked Ruby Mace.png' },

  // ===== PALADIN FULL SPRITE (single image fallback) =====
  { key: TextureKeys.PALADIN_FULL, path: 'assets/paladin/paladin.png' },

  // ===== TIER 1: ENVIRONMENT =====
  // Uncomment each line as you add the corresponding PNG to public/assets/

  // Sky
  // { key: TextureKeys.ENV_SKY_GRADIENT, path: 'assets/env/sky-gradient.png' },

  // Near trees (5 variants — each is a single tree with trunk + canopy)
  // { key: TextureKeys.ENV_TREE_NEAR_A, path: 'assets/env/tree-near-a.png' },
  // { key: TextureKeys.ENV_TREE_NEAR_B, path: 'assets/env/tree-near-b.png' },
  // { key: TextureKeys.ENV_TREE_NEAR_C, path: 'assets/env/tree-near-c.png' },
  // { key: TextureKeys.ENV_TREE_NEAR_D, path: 'assets/env/tree-near-d.png' },
  // { key: TextureKeys.ENV_TREE_NEAR_E, path: 'assets/env/tree-near-e.png' },

  // Ground patches (3 variants — tileable dirt blobs)
  // { key: TextureKeys.ENV_GROUND_PATCH_A, path: 'assets/env/ground-patch-a.png' },
  // { key: TextureKeys.ENV_GROUND_PATCH_B, path: 'assets/env/ground-patch-b.png' },
  // { key: TextureKeys.ENV_GROUND_PATCH_C, path: 'assets/env/ground-patch-c.png' },

  // Rocks (4 variants)
  // { key: TextureKeys.ENV_ROCK_A, path: 'assets/env/rock-a.png' },
  // { key: TextureKeys.ENV_ROCK_B, path: 'assets/env/rock-b.png' },
  // { key: TextureKeys.ENV_ROCK_C, path: 'assets/env/rock-c.png' },
  // { key: TextureKeys.ENV_ROCK_D, path: 'assets/env/rock-d.png' },

  // Ruins
  // { key: TextureKeys.ENV_RUIN_PILLAR, path: 'assets/env/ruin-pillar.png' },
  // { key: TextureKeys.ENV_RUIN_WALL,   path: 'assets/env/ruin-wall.png' },
];

// =============================================================================
// PRELOAD HOOK
// =============================================================================
// Call this from Scene.preload() in any scene that needs hero/enemy textures.
// It iterates ASSET_FILES and registers them with Phaser's loader. Procedural
// canvas textures (from canvasParts) are generated lazily on first use, NOT
// here, so this loader only handles real PNG assets.

export function preloadTextureAssets(scene: Phaser.Scene): void {
  for (const entry of ASSET_FILES) {
    if (scene.textures.exists(entry.key)) continue;
    if (entry.isSheet && entry.frameWidth && entry.frameHeight) {
      scene.load.spritesheet(entry.key, entry.path, {
        frameWidth: entry.frameWidth,
        frameHeight: entry.frameHeight,
        spacing: entry.spacing ?? 0,
      });
    } else {
      scene.load.image(entry.key, entry.path);
    }
  }
}

/** True if a real raster asset has been loaded for the given key. */
export function hasRasterAsset(scene: Phaser.Scene, key: TextureKey): boolean {
  if (!scene.textures.exists(key)) return false;
  // Heuristic: if the key was generated by paintBodyPart it's a CanvasTexture;
  // if it was loaded via load.image it's an Image texture. Both work, but
  // some callers may want to know whether real art is available.
  const tex = scene.textures.get(key);
  return tex.source[0] !== undefined && !(tex instanceof Phaser.Textures.CanvasTexture);
}
