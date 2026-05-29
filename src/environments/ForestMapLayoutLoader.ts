// ============================================================================
// FOREST MAP LAYOUT LOADER — loads JSON from the map composer into the game
// ============================================================================

import Phaser from 'phaser';

export interface ForestMapPlacement {
  id: string;
  atlasKey: string;
  frame: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  depth: number;
  scrollFactor: number;
  category: string;
  blendMode?: 'NORMAL' | 'ADD' | 'SCREEN' | 'MULTIPLY';
}

export interface ForestMapLayout {
  id: string;
  world: { width: number; height: number };
  spawn: { x: number; y: number };
  exit: { x: number; y: number; width: number; height: number };
  placements: ForestMapPlacement[];
  collision: Array<{ x: number; y: number; width: number; height: number; label?: string }>;
  waterRegions: Array<{ x: number; y: number; width: number; height: number; speed?: number; alpha?: number }>;
}

const ATLAS_DEFS = [
  { key: 'forestTerrainTiles',          file: 'assets/biomes/enchanted-forest-kit/atlases/terrain-tiles-atlas.png' },
  { key: 'forestWaterWetland',          file: 'assets/biomes/enchanted-forest-kit/atlases/water-wetland-atlas.png' },
  { key: 'forestCliffsBridgesPlatforms',file: 'assets/biomes/enchanted-forest-kit/atlases/cliffs-bridges-platforms-atlas.png' },
  { key: 'forestTreesFoliage',          file: 'assets/biomes/enchanted-forest-kit/atlases/trees-foliage-atlas.png' },
  { key: 'forestRuinsProps',            file: 'assets/biomes/enchanted-forest-kit/atlases/ruins-props-atlas.png' },
  { key: 'forestFogFxDecals',           file: 'assets/biomes/enchanted-forest-kit/atlases/fog-fx-decals-atlas.png' },
];

const FRAME_W = 256, FRAME_H = 256, COLS = 6;

const BLEND_MAP: Record<string, number> = {
  NORMAL: Phaser.BlendModes.NORMAL,
  ADD: Phaser.BlendModes.ADD,
  SCREEN: Phaser.BlendModes.SCREEN,
  MULTIPLY: Phaser.BlendModes.MULTIPLY,
};

/** Preload all biome kit atlases as spritesheets. Call in scene.preload(). */
export function preloadForestMapKit(scene: Phaser.Scene): void {
  for (const def of ATLAS_DEFS) {
    if (scene.textures.exists(def.key)) continue;
    scene.load.spritesheet(def.key, def.file, {
      frameWidth: FRAME_W,
      frameHeight: FRAME_H,
    });
  }
}

/** Build a complete environment from a composer-exported layout JSON. Call in scene.create(). */
export function buildForestMapFromLayout(
  scene: Phaser.Scene,
  layout: ForestMapLayout,
): Phaser.GameObjects.GameObject[] {
  const created: Phaser.GameObjects.GameObject[] = [];

  // Sort placements by depth so rendering order is correct
  const sorted = [...layout.placements].sort((a, b) => a.depth - b.depth);

  for (const p of sorted) {
    if (!scene.textures.exists(p.atlasKey)) continue;

    const img = scene.add.image(p.x, p.y, p.atlasKey, p.frame);
    img.setScale(p.scaleX, p.scaleY);
    img.setRotation(p.rotation);
    img.setFlipX(p.flipX);
    img.setDepth(p.depth);
    img.setScrollFactor(p.scrollFactor);

    if (p.blendMode && BLEND_MAP[p.blendMode] !== undefined) {
      img.setBlendMode(BLEND_MAP[p.blendMode]);
    }

    img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    created.push(img);
  }

  // Water shimmer regions
  for (const wr of layout.waterRegions) {
    const g = scene.add.graphics().setDepth(-15).setAlpha(wr.alpha ?? 0.18);
    g.fillStyle(0x66ccdd, 1);
    g.fillRect(wr.x, wr.y, wr.width, wr.height);
    const speed = wr.speed ?? 1;
    let t = 0;
    scene.events.on('update', (_time: number, delta: number) => {
      t += delta * 0.001 * speed;
      g.setAlpha((wr.alpha ?? 0.18) + Math.sin(t * 1.5) * 0.05);
    });
    created.push(g);
  }

  return created;
}
