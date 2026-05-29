# Enchanted Forest Kit V2

This is the composer-ready version of the forest biome kit. It now contains 100 usable individual PNG assets plus a manifest that the composer loads dynamically.

The first kit used AI-generated atlas sheets. Those sheets looked okay as previews, but they were not true grid atlases, so the composer sliced them into unusable blocks. V2 uses individual PNG assets instead.

## Use These Files

Copy this folder into the Hero Quest repo:

```text
public/assets/biomes/enchanted-forest-kit-v2/
```

The composer expects:

```text
public/assets/biomes/enchanted-forest-kit-v2/individual/
```

## Assets

The kit includes 100 assets across:

- background canopy, trunk walls, and fog bands
- moss/golden/shadow path tiles
- water stream and bank variants
- cliff faces and platform caps
- broken/intact bridge pieces
- trees, trunks, roots, shrubs, and foreground leaf beds
- gates, banners, torches, logs, fences, signposts, ruins
- mushrooms, reeds, vines, rubble, and small decals

The `*-source.png` files are chroma-key originals and do not need to be used by the composer.

## Composer

Use the updated root composer files:

```text
composer.html
src/composer.css
src/composer.js
```

This version does not slice atlases. It places individual assets directly and reads `composer-assets.manifest.json` at startup.
