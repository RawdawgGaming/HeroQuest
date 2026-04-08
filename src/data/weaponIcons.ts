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
        // Realistic open leather-bound book lying flat on a table
        // Brown leather palette
        const leatherDark = 0x3a1f0f;
        const leather = 0x5c2e15;
        const leatherHi = 0x7a3e1c;
        const pageEdge = 0xc9b890;
        const pageLight = 0xf0e6c8;
        const pageMid = 0xe0d4ac;
        const pageDark = 0xb8a578;
        const ink = 0x3a2818;

        // Drop shadow on the table
        parts.push(scene.add.ellipse(cx, cy + 9 * s, 46 * s, 5 * s, 0x000000, 0.35));

        // Stacked page edges visible from beneath the cover (gives the book its thickness)
        // Bottom rows are darker / more compressed
        for (let i = 0; i < 6; i++) {
          const yOff = 5 * s + i * 0.9 * s;
          const w = 42 * s - i * 0.6 * s;
          const c = i % 2 === 0 ? pageMid : pageDark;
          parts.push(scene.add.rectangle(cx, cy + yOff, w, 1 * s, c));
        }

        // Bottom leather edge (cover wrap visible at the bottom)
        parts.push(scene.add.rectangle(cx, cy + 11 * s, 44 * s, 2 * s, leatherDark));

        // Main leather cover (slightly raised above the pages, wider than the pages)
        parts.push(scene.add.rectangle(cx, cy + 1 * s, 44 * s, 14 * s, leather)
          .setStrokeStyle(1, leatherDark));

        // Leather highlight band (top of cover)
        parts.push(scene.add.rectangle(cx, cy - 5 * s, 44 * s, 1.5 * s, leatherHi));

        // Inset pages (cream area, smaller than cover so leather border shows)
        parts.push(scene.add.rectangle(cx, cy - 1 * s, 38 * s, 9 * s, pageLight));

        // Page edge shading along the inner curve (slight darker strips at top/bottom of pages for depth)
        parts.push(scene.add.rectangle(cx, cy - 5 * s, 38 * s, 0.7 * s, pageEdge));
        parts.push(scene.add.rectangle(cx, cy + 3 * s, 38 * s, 0.7 * s, pageEdge));

        // Spine valley (dark shadow down the center where the pages dip)
        parts.push(scene.add.rectangle(cx, cy - 1 * s, 1.5 * s, 9 * s, leatherDark));
        // Spine highlights on either side of the dip
        parts.push(scene.add.rectangle(cx - 1.5 * s, cy - 1 * s, 0.5 * s, 9 * s, pageEdge));
        parts.push(scene.add.rectangle(cx + 1.5 * s, cy - 1 * s, 0.5 * s, 9 * s, pageEdge));

        // Text lines on LEFT page
        for (let i = 0; i < 4; i++) {
          const yOff = -3.5 * s + i * 2 * s;
          const lineW = 13 * s - (i === 3 ? 4 * s : 0); // last line shorter
          parts.push(scene.add.rectangle(cx - 9 * s, cy - 1 * s + yOff, lineW, 0.6 * s, ink));
        }
        // Text lines on RIGHT page
        for (let i = 0; i < 4; i++) {
          const yOff = -3.5 * s + i * 2 * s;
          const lineW = 13 * s - (i === 3 ? 4 * s : 0);
          parts.push(scene.add.rectangle(cx + 9 * s, cy - 1 * s + yOff, lineW, 0.6 * s, ink));
        }

        // Decorative leather corner ornaments (small dark dots in cover corners)
        parts.push(scene.add.circle(cx - 20 * s, cy - 5 * s, 0.8 * s, leatherDark));
        parts.push(scene.add.circle(cx + 20 * s, cy - 5 * s, 0.8 * s, leatherDark));
        parts.push(scene.add.circle(cx - 20 * s, cy + 7 * s, 0.8 * s, leatherDark));
        parts.push(scene.add.circle(cx + 20 * s, cy + 7 * s, 0.8 * s, leatherDark));

        // Glowing pink sigil hovering above the open book (cursed tome flair)
        parts.push(scene.add.circle(cx, cy - 12 * s, 3 * s, 0xff44aa, 0.4));
        parts.push(scene.add.circle(cx, cy - 12 * s, 1.5 * s, 0xff66cc));
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
