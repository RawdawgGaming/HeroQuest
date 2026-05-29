// ============================================================================
// RUNTIME MAP LOADER — reads JSON layouts exported by the map composer
// ============================================================================

import Phaser from 'phaser';

export interface MapPlacement {
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
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  blendMode?: string;
}

export interface MapCollision {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface MapWaterRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  speed?: number;
  alpha?: number;
}

export interface ForestMapLayout {
  id: string;
  world: { width: number; height: number };
  spawn: { x: number; y: number };
  exit: { x: number; y: number; width: number; height: number };
  placements: MapPlacement[];
  collision: MapCollision[];
  waterRegions: MapWaterRegion[];
}

// Atlas keys and their file paths
const ATLAS_FILES: Record<string, { path: string; isGrid: boolean; frameW?: number; frameH?: number }> = {
  forestTerrainTiles:          { path: 'assets/biomes/enchanted-forest-kit/atlases/terrain-tiles-atlas.png', isGrid: true, frameW: 256, frameH: 256 },
  forestWaterWetland:          { path: 'assets/biomes/enchanted-forest-kit/atlases/water-wetland-atlas.png', isGrid: true, frameW: 256, frameH: 256 },
  forestCliffsBridgesPlatforms:{ path: 'assets/biomes/enchanted-forest-kit/atlases/cliffs-bridges-platforms-atlas.png', isGrid: false },
  forestTreesFoliage:          { path: 'assets/biomes/enchanted-forest-kit/atlases/trees-foliage-atlas.png', isGrid: false },
  forestRuinsProps:            { path: 'assets/biomes/enchanted-forest-kit/atlases/ruins-props-atlas.png', isGrid: false },
  forestFogFxDecals:           { path: 'assets/biomes/enchanted-forest-kit/atlases/fog-fx-decals-atlas.png', isGrid: false },
};

/** Preload all biome kit atlases. Call from scene.preload(). */
export function preloadBiomeKit(scene: Phaser.Scene): void {
  for (const [key, info] of Object.entries(ATLAS_FILES)) {
    if (scene.textures.exists(key)) continue;
    if (info.isGrid && info.frameW && info.frameH) {
      scene.load.spritesheet(key, info.path, { frameWidth: info.frameW, frameHeight: info.frameH });
    } else {
      scene.load.image(key, info.path);
    }
  }
}

/** Render a map layout into the scene. Call from scene.create(). */
export function renderMapLayout(scene: Phaser.Scene, layout: ForestMapLayout): void {
  for (const p of layout.placements) {
    if (!scene.textures.exists(p.atlasKey)) continue;

    const atlasInfo = ATLAS_FILES[p.atlasKey];
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

    if (atlasInfo?.isGrid) {
      // Grid-based spritesheet — use frame index
      img = scene.add.image(p.x, p.y, p.atlasKey, p.frame);
    } else {
      // Single image atlas — use crop if specified
      img = scene.add.image(p.x, p.y, p.atlasKey);
      if (p.cropX !== undefined && p.cropW && p.cropH) {
        img.setCrop(p.cropX, p.cropY ?? 0, p.cropW, p.cropH);
      }
    }

    img.setOrigin(0.5, 0.5);
    img.setScale(p.scaleX, p.scaleY);
    img.setRotation(p.rotation);
    img.setFlipX(p.flipX);
    img.setDepth(p.depth);
    img.setScrollFactor(p.scrollFactor);

    if (p.blendMode === 'ADD') img.setBlendMode(Phaser.BlendModes.ADD);
    else if (p.blendMode === 'SCREEN') img.setBlendMode(Phaser.BlendModes.SCREEN);
    else if (p.blendMode === 'MULTIPLY') img.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Use linear filtering for smooth scaling
    img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  // Animated water shimmer for water regions
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
  }
}
