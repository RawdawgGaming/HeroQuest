# Hero Quest — Art Asset Brief

## How the swap works

Every visual element in the game is registered under a **texture key** (e.g. `env/tree-near-a`). On scene load:

1. **Real PNGs** registered in `src/visuals/textures.ts → ASSET_FILES` are loaded by Phaser first.
2. **Enhanced placeholders** in `src/visuals/placeholderAssets.ts` fill in anything not covered by PNGs.
3. **Standard procedural fallback** in `src/visuals/procedural/environmentTextures.ts` catches everything else.

**To replace any element with real art:** drop a PNG at the specified path, uncomment the corresponding line in `ASSET_FILES`, reload. No other code changes needed.

---

## TIER 1 — Environment (biggest visual upgrade with fewest files)

These 15 PNGs cover the most screen area. Do these first.

### Sky gradient

| Key | File path | Dimensions | Notes |
|---|---|---|---|
| `env/sky-gradient` | `public/assets/env/sky-gradient.png` | **512 × 720** | Vertical gradient, warm horizon at bottom, cool blue at top. Include cloud wisps, sun glow. Tiles horizontally. |

**Anchor:** Center (0.5, 0.5). Used as `tileSprite` spanning full camera width.

**Palette guidance:**
- Top: `#2a3a64` (deep blue)
- Middle: `#907a82` (dusty mauve)
- Bottom: `#e8c87a` (warm gold)
- Clouds: `#fff0d4` at 8-12% opacity
- Sun: warm glow, NOT a hard circle

---

### Near trees (5 variants)

| Key | File path | Dimensions |
|---|---|---|
| `env/tree-near-a` | `public/assets/env/tree-near-a.png` | **140 × 200** |
| `env/tree-near-b` | `public/assets/env/tree-near-b.png` | **140 × 200** |
| `env/tree-near-c` | `public/assets/env/tree-near-c.png` | **140 × 200** |
| `env/tree-near-d` | `public/assets/env/tree-near-d.png` | **140 × 200** |
| `env/tree-near-e` | `public/assets/env/tree-near-e.png` | **140 × 200** |

**Anchor:** Bottom-center (0.5, 1.0). The tree's base/root sits at the anchor point.

**What to draw:** Single complete tree — tapered trunk + full canopy. Each variant should be visually distinct (different canopy shape, trunk lean, branch pattern). These are the largest most visible environment elements.

**Style guidance:**
- Trunk: `#4a3018` base, darker right side (`#281408`), highlight left edge (`#6a4828`)
- Canopy: overlapping blob masses, NOT a single circle. 2-3 green tones: `#355a35`, `#436834`, `#4a7a3a`
- Cel-shaded: darker underside on canopy, lighter top edge
- Outline: 1.5-2 px dark ink (`#1a1a22`), slightly wobbly, NOT a perfect vector stroke
- Surface: visible brush texture, per-pixel variation, small leaf-clump shapes in the canopy
- Background: **transparent PNG**. No bounding box fill.

**Parallax:** 1.0 (camera-locked play layer). Scale: 0.95-1.15×.

---

### Ground patches (3 variants)

| Key | File path | Dimensions |
|---|---|---|
| `env/ground-patch-a` | `public/assets/env/ground-patch-a.png` | **120 × 36** |
| `env/ground-patch-b` | `public/assets/env/ground-patch-b.png` | **120 × 36** |
| `env/ground-patch-c` | `public/assets/env/ground-patch-c.png` | **120 × 36** |

**Anchor:** Center (0.5, 0.5). Scattered across the walkable ground lane.

**What to draw:** Organic dirt/earth patch with irregular edges. Include small baked-in debris: pebbles, twigs, grass stubs. Darker shadow underside, lighter top highlight band.

**Palette:**
- Base earth: `#6b5638`
- Shadow: `#342414`
- Highlight: `#8a7048`
- Debris: small gray-brown pebbles, darker twig lines

**NO outline on ground patches** — they should blend into the ground seamlessly.

---

### Rocks (4 variants)

| Key | File path | Dimensions |
|---|---|---|
| `env/rock-a` | `public/assets/env/rock-a.png` | **60 × 36** |
| `env/rock-b` | `public/assets/env/rock-b.png` | **80 × 44** |
| `env/rock-c` | `public/assets/env/rock-c.png` | **50 × 30** |
| `env/rock-d` | `public/assets/env/rock-d.png` | **70 × 40** |

**Anchor:** Bottom-center (0.5, 1.0). Sits on the ground plane.

**What to draw:** Chunky organic rock blob. Each variant is a different shape (round, flat, jagged, tall). Include a smaller chip/pebble leaning against the main mass.

**Palette:**
- Base stone: `#6c6a76`
- Shadow: `#33333d`
- Highlight: `#9a98a6`
- Optional moss accent on one face: `#4a6630` at low opacity

**Outline:** 1.5-2 px dark ink. Organic, slightly asymmetric.

---

### Ruin pillar

| Key | File path | Dimensions |
|---|---|---|
| `env/ruin-pillar` | `public/assets/env/ruin-pillar.png` | **60 × 140** |

**Anchor:** Bottom-center (0.5, 1.0).

**What to draw:** Broken stone column with a wider capital (top block). Include a visible crack running down the shaft. Weathered and mossy.

**Palette:**
- Base: `#7a7484` (muted gray-violet)
- Shadow: `#3a3640`
- Highlight: `#a6a0b0`
- Crack: `#3a3640` at 70% opacity

---

### Ruin wall

| Key | File path | Dimensions |
|---|---|---|
| `env/ruin-wall` | `public/assets/env/ruin-wall.png` | **130 × 80** |

**Anchor:** Bottom-center (0.5, 1.0).

**What to draw:** Crumbling low wall with an uneven broken top edge. Should read as "ancient ruins" not "modern construction." Stone blocks visible in the masonry. Moss or vine accents.

**Same palette as ruin pillar.**

---

## TIER 2 — Characters (after environment)

See the detailed character asset list in the previous version of this README (preserved below in the "Character body parts" section). The paladin is highest priority.

### Character body parts (paladin)

| Priority | Key | File path | Dimensions | Anchor | Notes |
|---|---|---|---|---|---|
| 1 | `paladin/torso` | `public/assets/paladin/torso.png` | **80 × 80** | Center | Plate armor breastplate with tabard visible |
| 2 | `paladin/helm` | `public/assets/paladin/helm.png` | **64 × 72** | Center | Closed great helm, visor slit |
| 3 | `paladin/sword` | `public/assets/paladin/sword.png` | **32 × 96** | (0.5, 0.85) grip near bottom | Longsword, blade up, grip at bottom |
| 4 | `paladin/shield` | `public/assets/paladin/shield.png` | **32 × 52** | (0.5, 0.15) top-anchored | Kite shield |
| 5 | `paladin/cape` | `public/assets/paladin/cape.png` | **64 × 80** | Center | White with gold trim, irregular hem |
| 6-7 | `paladin/pauldron-l` / `paladin/pauldron-r` | 2 files | **28 × 24** | Center | Asymmetric chunky gold shoulder caps |
| 8-11 | `paladin/thigh`, `shin`, `boot`, `arm` | 4 files | 16-18 × 18-28 | (0.5, 0) top-center | Plate armor limb segments |
| 12 | `paladin/gauntlet` | 1 file | **14 × 14** | Center | Armored fist |

---

## Style brief for the artist

**Genre:** Hand-painted cartoon brawler (Castle Crashers visual family, NOT a direct copy).

**Key qualities:**
- **Bold silhouettes** — every element should read clearly at 50% zoom
- **Thick ink outlines** — 1.5-2.5 px weight, slightly wobbly (NOT perfect vector), weight variation where it reads naturally
- **Cel-shaded** — each form has a base color, a darker shadow side (lower half), and a small bright highlight (top edge). Hard-edged shadow, not gradient
- **Surface texture** — visible brush strokes / per-pixel noise inside the fills. Not flat. Not smooth gradient.
- **Organic forms** — NO perfect circles, rectangles, or straight lines. Everything slightly asymmetric and hand-shaped
- **Chunky proportions** — exaggerated width, bigger heads relative to bodies, stocky limbs
- **Transparent PNG** background on everything

**Color rules:**
- Environment is **muted and earthy** (desaturated browns, greens, grays)
- Characters are **bolder and more saturated** (bright silver, gold, red accents)
- Combat FX are **bright and hot** (white, yellow, orange accents)
- Goal: characters pop from the background automatically through saturation contrast

**What to avoid:**
- Perfect geometric shapes
- Flat uniform fills with no texture
- Ultra-smooth vector outlines
- Photorealistic rendering
- Gradients that look like Photoshop filters
- Copying any specific copyrighted game's art directly

---

## File placement

```
public/
└── assets/
    ├── env/
    │   ├── sky-gradient.png
    │   ├── tree-near-a.png
    │   ├── tree-near-b.png
    │   ├── tree-near-c.png
    │   ├── tree-near-d.png
    │   ├── tree-near-e.png
    │   ├── ground-patch-a.png
    │   ├── ground-patch-b.png
    │   ├── ground-patch-c.png
    │   ├── rock-a.png
    │   ├── rock-b.png
    │   ├── rock-c.png
    │   ├── rock-d.png
    │   ├── ruin-pillar.png
    │   └── ruin-wall.png
    └── paladin/
        ├── torso.png
        ├── helm.png
        ├── sword.png
        ├── shield.png
        ├── cape.png
        ├── pauldron-l.png
        ├── pauldron-r.png
        ├── thigh.png
        ├── shin.png
        ├── boot.png
        ├── arm.png
        └── gauntlet.png
```

Total: **27 PNG files** for the full Tier 1 + Tier 2 upgrade. The 15 environment PNGs alone would be a massive visual jump.

---

## How to activate a new asset

1. Place the PNG at the path listed above
2. Open `src/visuals/textures.ts`
3. Find the corresponding commented-out line in `ASSET_FILES`
4. Uncomment it
5. Reload the game

The procedural fallback is automatically skipped for that element.
