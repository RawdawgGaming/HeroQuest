import Phaser from 'phaser';

/** Draws a unique mini icon for each weapon at the given position. Returns the parts so they can be added to a container. */
export function drawWeaponIcon(
  scene: Phaser.Scene,
  weaponId: string,
  cx: number,
  cy: number,
  scale: number = 1,
  opts: { open?: boolean } = {},
): Phaser.GameObjects.GameObject[] {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const s = scale;

  switch (weaponId) {
    case 'bone_wand': {
      // Short wand — bone-colored shaft with a small skull tip
      parts.push(scene.add.rectangle(cx, cy + 2 * s, 3 * s, 22 * s, 0xddccaa));
      parts.push(scene.add.circle(cx, cy - 11 * s, 4 * s, 0xeeddbb));
      // Two small black eye dots
      parts.push(scene.add.circle(cx - 1.5 * s, cy - 11 * s, 0.8 * s, 0x111111));
      parts.push(scene.add.circle(cx + 1.5 * s, cy - 11 * s, 0.8 * s, 0x111111));
      break;
    }
    case 'skull_staff': {
      // Wooden staff with a glowing skull on top
      parts.push(scene.add.rectangle(cx, cy + 4 * s, 3 * s, 26 * s, 0x664422));
      // Skull head
      parts.push(scene.add.circle(cx, cy - 12 * s, 6 * s, 0xeeeecc));
      parts.push(scene.add.circle(cx - 2 * s, cy - 13 * s, 1.5 * s, 0x111111));
      parts.push(scene.add.circle(cx + 2 * s, cy - 13 * s, 1.5 * s, 0x111111));
      // Yellow glow ring
      parts.push(scene.add.circle(cx, cy - 12 * s, 7 * s, 0xffdd44, 0.3));
      break;
    }
    case 'cursed_tome': {
      if (opts.open) {
        // Open leather-bound book viewed from a 3/4 angle so the page blocks look thick and curved
        const leatherDark = 0x2a1408;
        const leather = 0x5c2e15;
        const leatherHi = 0x8a4d22;
        const pageEdgeDark = 0xa8956a;
        const pageEdgeMid = 0xc9b890;
        const pageEdgeLight = 0xe6d8a8;
        const pageLight = 0xf5ebc8;
        const pageShadow = 0xd8c898;
        const ink = 0x2a1810;

        // Drop shadow on the table
        parts.push(scene.add.ellipse(cx, cy + 12 * s, 52 * s, 6 * s, 0x000000, 0.45));

        // ============ LEATHER COVER (back of book) ============
        // Wide leather slab visible underneath both page blocks
        parts.push(scene.add.rectangle(cx, cy + 8 * s, 50 * s, 5 * s, leather)
          .setStrokeStyle(1, leatherDark));
        // Darker leather edge along the bottom
        parts.push(scene.add.rectangle(cx, cy + 10.5 * s, 50 * s, 1 * s, leatherDark));

        // ============ LEFT PAGE BLOCK (curved, thick) ============
        // Side profile of the left page stack (rectangle showing page edges)
        // Bottom edge — dark shadow under the page block
        parts.push(scene.add.polygon(cx - 12 * s, cy + 4 * s,
          [-12 * s, 0,   12 * s, -1 * s,   12 * s, 4 * s,   -12 * s, 5 * s],
          pageEdgeDark,
        ));
        // Stacked page-edge stripes on the left block
        for (let i = 0; i < 5; i++) {
          const yOff = 1 * s + i * 0.7 * s;
          const c = i % 2 === 0 ? pageEdgeMid : pageEdgeLight;
          parts.push(scene.add.polygon(cx - 12 * s, cy + 1 * s + yOff,
            [-12 * s, 0,   12 * s, -0.3 * s,   12 * s, 0.7 * s,   -12 * s, 1 * s],
            c,
          ));
        }

        // Top page (the actual open page on the left) — drawn as a polygon that curves up toward the spine
        // Points: outer-bottom, outer-top (lifted), spine-top (highest), spine-bottom
        parts.push(scene.add.polygon(cx - 12 * s, cy - 2 * s,
          [-12 * s, 5 * s,    -11 * s, -3 * s,    12 * s, -5 * s,    12 * s, 4 * s],
          pageLight,
        ).setStrokeStyle(1, pageEdgeDark));
        // Subtle inner shadow toward the spine
        parts.push(scene.add.polygon(cx - 12 * s, cy - 2 * s,
          [8 * s, -4.5 * s,    12 * s, -5 * s,    12 * s, 4 * s,    8 * s, 3.5 * s],
          pageShadow,
        ));

        // ============ RIGHT PAGE BLOCK (curved, thick) ============
        // Bottom edge under the right page block
        parts.push(scene.add.polygon(cx + 12 * s, cy + 4 * s,
          [-12 * s, -1 * s,   12 * s, 0,   12 * s, 5 * s,   -12 * s, 4 * s],
          pageEdgeDark,
        ));
        // Stacked page-edge stripes on the right block
        for (let i = 0; i < 5; i++) {
          const yOff = 1 * s + i * 0.7 * s;
          const c = i % 2 === 0 ? pageEdgeMid : pageEdgeLight;
          parts.push(scene.add.polygon(cx + 12 * s, cy + 1 * s + yOff,
            [-12 * s, -0.3 * s,   12 * s, 0,   12 * s, 1 * s,   -12 * s, 0.7 * s],
            c,
          ));
        }

        // Top page (right side) — curves up toward the spine on the LEFT side of this block
        parts.push(scene.add.polygon(cx + 12 * s, cy - 2 * s,
          [-12 * s, -5 * s,    11 * s, -3 * s,    12 * s, 5 * s,    -12 * s, 4 * s],
          pageLight,
        ).setStrokeStyle(1, pageEdgeDark));
        // Subtle inner shadow toward the spine
        parts.push(scene.add.polygon(cx + 12 * s, cy - 2 * s,
          [-12 * s, -5 * s,    -8 * s, -4.5 * s,    -8 * s, 3.5 * s,    -12 * s, 4 * s],
          pageShadow,
        ));

        // ============ SPINE VALLEY ============
        // Dark V where the two pages meet — the deepest point of the open book
        parts.push(scene.add.triangle(cx, cy - 5 * s,
          -2 * s, 0,
          2 * s, 0,
          0, 6 * s,
          leatherDark,
        ));
        // Tiny spine highlight
        parts.push(scene.add.rectangle(cx, cy - 3 * s, 0.6 * s, 6 * s, leatherHi));

        // ============ TEXT LINES ============
        for (let i = 0; i < 4; i++) {
          const yOff = -4 * s + i * 1.6 * s;
          // Left page text — slight perspective (shorter on left edge to follow the curve)
          parts.push(scene.add.rectangle(cx - 13 * s, cy + yOff, 12 * s, 0.5 * s, ink));
          // Right page text
          parts.push(scene.add.rectangle(cx + 13 * s, cy + yOff, 12 * s, 0.5 * s, ink));
        }

        // ============ LEATHER COVER VISIBLE EDGES (top corners) ============
        // Small bits of leather peeking up at the outer corners of each page block
        parts.push(scene.add.rectangle(cx - 24 * s, cy - 1 * s, 1 * s, 6 * s, leather));
        parts.push(scene.add.rectangle(cx + 24 * s, cy - 1 * s, 1 * s, 6 * s, leather));

        // ============ GLOWING SIGIL (cursed tome flair) ============
        parts.push(scene.add.circle(cx, cy - 13 * s, 3.5 * s, 0xff44aa, 0.4));
        parts.push(scene.add.circle(cx, cy - 13 * s, 2 * s, 0xff66cc));
      } else {
        // Closed book with purple cover (shop icon)
        const cover = scene.add.rectangle(cx, cy, 22 * s, 26 * s, 0x663366);
        cover.setStrokeStyle(1, 0x442244);
        parts.push(cover);
        // Pages (slim white edge)
        parts.push(scene.add.rectangle(cx + 11 * s, cy, 2 * s, 24 * s, 0xeeeedd));
        // Pentagram circle on cover
        parts.push(scene.add.circle(cx, cy, 7 * s, 0xff44aa, 0));
        const pent = scene.add.circle(cx, cy, 6 * s, 0x000000, 0).setStrokeStyle(1.5, 0xff44aa);
        parts.push(pent);
        // Center eye
        parts.push(scene.add.circle(cx, cy, 1.5 * s, 0xff44aa));
      }
      break;
    }
    case 'scythe_of_decay': {
      // Long handle + curved blade
      parts.push(scene.add.rectangle(cx + 2 * s, cy + 4 * s, 3 * s, 28 * s, 0x442211));
      // Blade — represented as triangle
      parts.push(scene.add.triangle(
        cx - 4 * s, cy - 12 * s,
        0, 0,
        14 * s, 4 * s,
        2 * s, 12 * s,
        0xaa8866,
      ).setStrokeStyle(1, 0x664422));
      // Green glow on blade
      parts.push(scene.add.circle(cx, cy - 8 * s, 3 * s, 0x44ff66, 0.5));
      break;
    }
    case 'lich_crook': {
      // Tall crook with curled top + green orb
      parts.push(scene.add.rectangle(cx, cy + 2 * s, 3 * s, 28 * s, 0x223322));
      // Curl at top (arc made of small circles)
      parts.push(scene.add.circle(cx + 2 * s, cy - 12 * s, 4 * s, 0x223322, 0).setStrokeStyle(2, 0x335533));
      // Green orb inside the curl
      parts.push(scene.add.circle(cx + 2 * s, cy - 12 * s, 3 * s, 0x33ff66));
      parts.push(scene.add.circle(cx + 2 * s, cy - 12 * s, 5 * s, 0x33ff66, 0.3));
      break;
    }
    case 'phylactery': {
      // Ornate jar/soul vessel — diamond shape with pink soul
      parts.push(scene.add.polygon(
        cx, cy,
        [0, -14 * s, 12 * s, 0, 0, 14 * s, -12 * s, 0],
        0x442255,
      ).setStrokeStyle(2, 0xff66aa));
      // Glowing pink soul orb in the middle
      parts.push(scene.add.circle(cx, cy, 4 * s, 0xff66cc));
      parts.push(scene.add.circle(cx, cy, 6 * s, 0xff66cc, 0.4));
      // Top cap
      parts.push(scene.add.rectangle(cx, cy - 14 * s, 6 * s, 3 * s, 0x664433));
      break;
    }
    default: {
      // Fallback — colored square
      parts.push(scene.add.rectangle(cx, cy, 14 * s, 14 * s, 0xaaaaaa));
    }
  }

  return parts;
}
