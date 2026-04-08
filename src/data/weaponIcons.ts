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
        // THICK open grimoire — viewed from a slight side angle so thickness is obvious
        // Drop shadow under the book
        parts.push(scene.add.ellipse(cx, cy + 22 * s, 40 * s, 6 * s, 0x000000, 0.4));

        // BOTTOM: thick stack of pages visible from the side (a tall block of stripes)
        const stackHeight = 18 * s;
        const stackTop = cy + 4 * s;
        // Back cover (purple) underneath the page stack
        parts.push(scene.add.rectangle(cx, stackTop + stackHeight / 2 + 1 * s, 36 * s, stackHeight + 4 * s, 0x331133)
          .setStrokeStyle(1, 0x110011));

        // Many alternating cream/tan stripes to look like dozens of pages stacked
        const numStripes = 14;
        const stripeH = stackHeight / numStripes;
        for (let i = 0; i < numStripes; i++) {
          const stripeY = stackTop + i * stripeH + stripeH / 2;
          const color = i % 3 === 0 ? 0xddccaa : (i % 3 === 1 ? 0xeeeedd : 0xccbb99);
          parts.push(scene.add.rectangle(cx, stripeY, 34 * s, stripeH, color));
        }

        // Purple cover wrapping the stack on the LEFT and RIGHT edges
        parts.push(scene.add.rectangle(cx - 17 * s, stackTop + stackHeight / 2, 2 * s, stackHeight + 4 * s, 0x442244));
        parts.push(scene.add.rectangle(cx + 17 * s, stackTop + stackHeight / 2, 2 * s, stackHeight + 4 * s, 0x442244));

        // TOP: open pages spread (the part being read)
        // Cover top edge
        parts.push(scene.add.rectangle(cx, cy - 4 * s, 36 * s, 4 * s, 0x553355)
          .setStrokeStyle(1, 0x221122));
        // Left open page
        parts.push(scene.add.rectangle(cx - 8 * s, cy - 5 * s, 14 * s, 5 * s, 0xeeeedd));
        // Right open page
        parts.push(scene.add.rectangle(cx + 8 * s, cy - 5 * s, 14 * s, 5 * s, 0xeeeedd));
        // Spine on top (thin dark center line)
        parts.push(scene.add.rectangle(cx, cy - 5 * s, 1 * s, 5 * s, 0x442244));
        // Text lines on left page
        for (let i = 0; i < 2; i++) {
          parts.push(scene.add.rectangle(cx - 8 * s, cy - 6 * s + i * 1.8 * s, 11 * s, 0.6 * s, 0x553355));
        }
        // Text lines on right page
        for (let i = 0; i < 2; i++) {
          parts.push(scene.add.rectangle(cx + 8 * s, cy - 6 * s + i * 1.8 * s, 11 * s, 0.6 * s, 0x553355));
        }

        // Glowing pink sigil hovering above the open grimoire
        parts.push(scene.add.circle(cx, cy - 14 * s, 3.5 * s, 0xff44aa, 0.4));
        parts.push(scene.add.circle(cx, cy - 14 * s, 2 * s, 0xff66cc));
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
