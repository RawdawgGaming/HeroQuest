# Claude Code Prompt: Build A Hero Quest Visual Map Composer

Use this prompt inside the Hero Quest repo after copying the biome kit into:

```text
public/assets/biomes/enchanted-forest-kit/
```

## Prompt

I have a Phaser 3 + TypeScript game called Hero Quest. Build a visual map composer for the enchanted forest biome using this asset kit:

```text
public/assets/biomes/enchanted-forest-kit/biome-kit.manifest.json
public/assets/biomes/enchanted-forest-kit/atlases/terrain-tiles-atlas.png
public/assets/biomes/enchanted-forest-kit/atlases/cliffs-bridges-platforms-atlas.png
public/assets/biomes/enchanted-forest-kit/atlases/water-wetland-atlas.png
public/assets/biomes/enchanted-forest-kit/atlases/trees-foliage-atlas.png
public/assets/biomes/enchanted-forest-kit/atlases/ruins-props-atlas.png
public/assets/biomes/enchanted-forest-kit/atlases/fog-fx-decals-atlas.png
```

The composer should let me assemble an 8000x720 Stage 1 forest map using the biome kit, then export a JSON layout that the actual ForestStage can load.

## Required Composer Features

- Phaser scene or admin tool route for map composition.
- 8000x720 world canvas.
- Camera pan and zoom.
- Asset palette grouped by atlas/category.
- Place, drag, scale, rotate, flip, duplicate, and delete assets.
- Snap-to-grid for terrain/water tiles, with optional free placement for props/fog.
- Depth controls using the manifest depth recommendations.
- Scroll-factor controls for parallax layers.
- Toggle collision debug rectangles.
- Paint walking-band collision around Y 420-560.
- Add water regions for future shimmer animation.
- Add stage exit trigger near the far-right gate.
- Save/export layout JSON.
- Load/import layout JSON.

## Runtime Integration

Create a loader that reads the exported layout JSON and builds the environment inside Stage 1:

- Load all atlas textures.
- Render tiles/props/fog/decals according to JSON.
- Apply scroll factors and depths.
- Create invisible static physics bodies for collision rectangles.
- Create water shimmer regions from exported water data.
- Create stage-complete trigger from exported exit data.

## Suggested JSON Shape

```ts
type ForestMapLayout = {
  id: string;
  world: { width: 8000; height: 720 };
  spawn: { x: number; y: number };
  exit: { x: number; y: number; width: number; height: number };
  placements: Array<{
    id: string;
    atlasKey: string;
    frame?: string | number;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    flipX: boolean;
    depth: number;
    scrollFactor: number;
    category: 'terrain' | 'water' | 'cliff' | 'bridge' | 'tree' | 'foliage' | 'ruin' | 'prop' | 'fog' | 'fx' | 'decal';
    blendMode?: 'NORMAL' | 'ADD' | 'SCREEN' | 'MULTIPLY';
  }>;
  collision: Array<{ x: number; y: number; width: number; height: number; label?: string }>;
  waterRegions: Array<{ x: number; y: number; width: number; height: number; speed: number; alpha: number }>;
};
```

## Important Visual Rules

- Match the original reference image: dark canopy at top, blue mist behind trees, mossy path at center, turquoise water and dense foliage at bottom, ruins and gates toward the right.
- Do not bake one giant background. Compose from reusable assets.
- Keep the hero readable in the walk band.
- Use foreground foliage sparingly over the play lane.
- Use fog and glows with subtle alpha so gameplay remains clear.
