# Enchanted Forest Biome Kit

This kit turns the original Hero Quest forest reference image into reusable map-building assets.

## Contents

- `biome-kit.manifest.json` - atlas metadata and composer rules.
- `atlases/terrain-tiles-atlas.png` - 6x4 terrain tile sheet.
- `atlases/cliffs-bridges-platforms-atlas.png` - transparent platform/cliff/bridge props.
- `atlases/water-wetland-atlas.png` - 6x4 water/wetland tile sheet.
- `atlases/trees-foliage-atlas.png` - transparent trees, shrubs, vines, logs, mushrooms.
- `atlases/ruins-props-atlas.png` - transparent ruins, gates, torches, stones, stakes.
- `atlases/fog-fx-decals-atlas.png` - mist, glow, particles, decals, shadow strips.
- `docs/CLAUDE_MAP_COMPOSER_PROMPT.md` - prompt to give Claude Code for building the visual map composer.

The `*-source.png` files preserve the original chroma-key sheets. Use the non-source versions for transparent prop atlases.

## Recommended Game Flow

1. Copy this entire folder into the Hero Quest repo:

```text
public/assets/biomes/enchanted-forest-kit/
```

2. Give Claude Code the prompt in:

```text
docs/CLAUDE_MAP_COMPOSER_PROMPT.md
```

3. Have Claude build the composer and runtime layout loader.

4. Compose Stage 1 as JSON, then load that layout in `ForestStage`.
