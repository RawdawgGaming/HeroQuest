import Phaser from 'phaser';

/** Draws a unique mini icon for each weapon at the given position. Returns the parts so they can be added to a container. */
export function drawWeaponIcon(
  scene: Phaser.Scene,
  weaponId: string,
  cx: number,
  cy: number,
  scale: number = 1,
  opts: { open?: boolean; held?: boolean } = {},
): Phaser.GameObjects.GameObject[] {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const s = scale;

  // Held tome — drawn with Phaser Graphics for smooth arcs/curves to match the reference photo
  if (weaponId === 'cursed_tome' && opts.held) {
    const leather = 0x6b3818;
    const leatherDark = 0x2a1408;
    const leatherHi = 0x9a5a2a;
    const pageTop = 0xe8d39a;
    const pageHi = 0xf5e6b8;
    const pageEdgeMid = 0xc9a868;
    const pageEdgeLight = 0xddc080;
    const ink = 0x3a2818;

    // Use a Graphics object for smooth curved shapes
    const g = scene.add.graphics();

    // ----- Drop shadow -----
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(cx, cy + 7 * s, 36 * s, 4 * s);

    // ----- Leather back cover (rounded brown rectangle visible at the bottom front) -----
    g.fillStyle(leather, 1);
    g.fillRoundedRect(cx - 17 * s, cy + 2 * s, 34 * s, 5 * s, 1.5);
    g.lineStyle(1, leatherDark, 1);
    g.strokeRoundedRect(cx - 17 * s, cy + 2 * s, 34 * s, 5 * s, 1.5);
    // Lighter leather highlight along the front edge
    g.fillStyle(leatherHi, 1);
    g.fillRect(cx - 16 * s, cy + 6 * s, 32 * s, 0.8 * s);

    // ----- LEFT page dome (arc-topped block) -----
    // Cream fill with dome top
    g.fillStyle(pageTop, 1);
    g.beginPath();
    g.moveTo(cx - 15 * s, cy + 4 * s);   // outer-bottom
    g.lineTo(cx - 15 * s, cy - 1 * s);   // outer-top
    // Curve over the top to the spine using a bezier curve for the dome
    g.lineTo(cx - 14 * s, cy - 3 * s);
    g.lineTo(cx - 11 * s, cy - 5 * s);
    g.lineTo(cx - 7 * s, cy - 6 * s);    // peak
    g.lineTo(cx - 3 * s, cy - 5 * s);
    g.lineTo(cx - 1 * s, cy - 3 * s);
    g.lineTo(cx - 0.5 * s, cy - 1 * s);  // spine top
    g.lineTo(cx - 0.5 * s, cy + 4 * s);  // spine bottom
    g.closePath();
    g.fillPath();
    // Outline
    g.lineStyle(1, leatherDark, 1);
    g.strokePath();

    // Left dome highlight (lighter cream)
    g.fillStyle(pageHi, 1);
    g.beginPath();
    g.moveTo(cx - 13 * s, cy - 2 * s);
    g.lineTo(cx - 11 * s, cy - 4.5 * s);
    g.lineTo(cx - 7 * s, cy - 5.5 * s);
    g.lineTo(cx - 5 * s, cy - 4 * s);
    g.lineTo(cx - 4 * s, cy - 1 * s);
    g.lineTo(cx - 12 * s, cy);
    g.closePath();
    g.fillPath();

    // ----- RIGHT page dome (mirrored) -----
    g.fillStyle(pageTop, 1);
    g.beginPath();
    g.moveTo(cx + 0.5 * s, cy + 4 * s);  // spine bottom
    g.lineTo(cx + 0.5 * s, cy - 1 * s);  // spine top
    g.lineTo(cx + 1 * s, cy - 3 * s);
    g.lineTo(cx + 3 * s, cy - 5 * s);
    g.lineTo(cx + 7 * s, cy - 6 * s);    // peak
    g.lineTo(cx + 11 * s, cy - 5 * s);
    g.lineTo(cx + 14 * s, cy - 3 * s);
    g.lineTo(cx + 15 * s, cy - 1 * s);   // outer-top
    g.lineTo(cx + 15 * s, cy + 4 * s);   // outer-bottom
    g.closePath();
    g.fillPath();
    g.lineStyle(1, leatherDark, 1);
    g.strokePath();

    // Right dome highlight
    g.fillStyle(pageHi, 1);
    g.beginPath();
    g.moveTo(cx + 5 * s, cy - 4 * s);
    g.lineTo(cx + 7 * s, cy - 5.5 * s);
    g.lineTo(cx + 11 * s, cy - 4.5 * s);
    g.lineTo(cx + 13 * s, cy - 2 * s);
    g.lineTo(cx + 12 * s, cy);
    g.lineTo(cx + 4 * s, cy - 1 * s);
    g.closePath();
    g.fillPath();

    // ----- Page edge stripes along the front bottom (visible thickness) -----
    g.fillStyle(pageEdgeMid, 1);
    g.fillRect(cx - 14 * s, cy + 4 * s, 28 * s, 0.6 * s);
    g.fillStyle(pageEdgeLight, 1);
    g.fillRect(cx - 14 * s, cy + 4.7 * s, 28 * s, 0.5 * s);
    g.fillStyle(pageEdgeMid, 1);
    g.fillRect(cx - 14 * s, cy + 5.4 * s, 28 * s, 0.5 * s);

    // ----- Spine valley (dark V in the middle) -----
    g.fillStyle(leatherDark, 1);
    g.beginPath();
    g.moveTo(cx - 1.2 * s, cy - 3 * s);
    g.lineTo(cx + 1.2 * s, cy - 3 * s);
    g.lineTo(cx + 0.6 * s, cy + 4 * s);
    g.lineTo(cx - 0.6 * s, cy + 4 * s);
    g.closePath();
    g.fillPath();

    // ----- Text lines on each page (dark ink) -----
    g.fillStyle(ink, 1);
    for (let i = 0; i < 2; i++) {
      const yOff = -1.5 * s + i * 1.5 * s;
      g.fillRect(cx - 12 * s, cy + yOff, 9 * s, 0.4 * s);
      g.fillRect(cx + 3 * s, cy + yOff, 9 * s, 0.4 * s);
    }

    parts.push(g);

    // ----- Glowing pink sigil hovering above the open book (kept as separate circles for tweens) -----
    parts.push(scene.add.circle(cx, cy - 9 * s, 2.2 * s, 0xff44aa, 0.4));
    parts.push(scene.add.circle(cx, cy - 9 * s, 1.2 * s, 0xff66cc));

    return parts;
  }

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
        // Front 3/4 view of an open leather-bound book on a table
        // Pages bulge outward in two domes with a deep V-valley in the center
        const leatherDark = 0x2a1408;
        const leather = 0x6b3818;
        const leatherHi = 0x9a5a2a;
        const pageEdgeDark = 0xa88a55;
        const pageEdgeMid = 0xc9a868;
        const pageEdgeLight = 0xddc080;
        const pageTop = 0xe8d39a;
        const pageHi = 0xf5e6b8;
        const pageShadow = 0x9a7e44;

        // ============ DROP SHADOW ON TABLE ============
        parts.push(scene.add.ellipse(cx, cy + 14 * s, 56 * s, 5 * s, 0x000000, 0.5));

        // ============ LEATHER BACK COVER (visible at the bottom, wrapping around) ============
        // The leather peeks out from under the bulging pages
        parts.push(scene.add.polygon(cx, cy + 9 * s,
          [
            -28 * s, -2 * s,
            -25 * s, 4 * s,
            25 * s, 4 * s,
            28 * s, -2 * s,
            22 * s, -3 * s,
            -22 * s, -3 * s,
          ],
          leather,
        ).setStrokeStyle(1, leatherDark));
        // Lighter leather highlight along the front edge
        parts.push(scene.add.rectangle(cx, cy + 12 * s, 48 * s, 0.7 * s, leatherHi));

        // ============ LEFT PAGE DOME ============
        // Side profile: tall dome with a curved top, flat bottom on the leather
        // Outer edge is lower (the page edges are visible), peak rises near the spine
        parts.push(scene.add.polygon(cx - 11 * s, cy,
          [
            -14 * s, 8 * s,    // outer bottom
            -14 * s, 0,         // outer top of page edge stack
            -12 * s, -6 * s,    // start of curve
            -8 * s, -10 * s,    // climbing
            -3 * s, -12 * s,    // peak
            2 * s, -11 * s,     // dropping toward spine
            5 * s, -7 * s,
            5 * s, 8 * s,       // spine bottom
          ],
          pageTop,
        ).setStrokeStyle(1, pageEdgeDark));
        // Highlight on the left page (catches light on the upper-left)
        parts.push(scene.add.polygon(cx - 11 * s, cy,
          [
            -12 * s, -5 * s,
            -8 * s, -9 * s,
            -3 * s, -11 * s,
            -3 * s, -8 * s,
            -10 * s, -3 * s,
          ],
          pageHi,
        ));
        // Page edges visible along the bottom-left curve (stacked stripes)
        for (let i = 0; i < 4; i++) {
          const yOff = i * 1 * s;
          const c = i % 2 === 0 ? pageEdgeMid : pageEdgeLight;
          // Curved bottom strip
          parts.push(scene.add.polygon(cx - 11 * s, cy + 4 * s + yOff,
            [
              -14 * s, 0,
              -13 * s, 1 * s,
              -8 * s, 2 * s,
              0, 2 * s,
              0, 1 * s,
            ],
            c,
          ));
        }
        // Page-edge stack visible on the OUTER LEFT side of the book (the side profile)
        for (let i = 0; i < 6; i++) {
          const yOff = -1 * s + i * 1.2 * s;
          const c = i % 2 === 0 ? pageEdgeMid : pageEdgeLight;
          parts.push(scene.add.rectangle(cx - 25 * s, cy + 1 * s + yOff, 3 * s, 1 * s, c));
        }

        // ============ RIGHT PAGE DOME (mirror of left) ============
        parts.push(scene.add.polygon(cx + 11 * s, cy,
          [
            -5 * s, 8 * s,       // spine bottom
            -5 * s, -7 * s,      // spine-side rising
            -2 * s, -11 * s,
            3 * s, -12 * s,      // peak
            8 * s, -10 * s,
            12 * s, -6 * s,
            14 * s, 0,           // outer top of page edge stack
            14 * s, 8 * s,       // outer bottom
          ],
          pageTop,
        ).setStrokeStyle(1, pageEdgeDark));
        // Right page highlight
        parts.push(scene.add.polygon(cx + 11 * s, cy,
          [
            3 * s, -11 * s,
            8 * s, -9 * s,
            12 * s, -5 * s,
            10 * s, -3 * s,
            3 * s, -8 * s,
          ],
          pageHi,
        ));
        // Right page bottom edge stripes
        for (let i = 0; i < 4; i++) {
          const yOff = i * 1 * s;
          const c = i % 2 === 0 ? pageEdgeMid : pageEdgeLight;
          parts.push(scene.add.polygon(cx + 11 * s, cy + 4 * s + yOff,
            [
              0, 1 * s,
              0, 2 * s,
              8 * s, 2 * s,
              13 * s, 1 * s,
              14 * s, 0,
            ],
            c,
          ));
        }
        // Page-edge stack visible on the OUTER RIGHT side
        for (let i = 0; i < 6; i++) {
          const yOff = -1 * s + i * 1.2 * s;
          const c = i % 2 === 0 ? pageEdgeMid : pageEdgeLight;
          parts.push(scene.add.rectangle(cx + 25 * s, cy + 1 * s + yOff, 3 * s, 1 * s, c));
        }

        // ============ SPINE VALLEY ============
        // Dark V where the two pages dip down into the binding
        parts.push(scene.add.polygon(cx, cy - 4 * s,
          [
            -3 * s, -6 * s,
            -1.5 * s, -7 * s,
            1.5 * s, -7 * s,
            3 * s, -6 * s,
            1 * s, 4 * s,
            -1 * s, 4 * s,
          ],
          leatherDark,
        ));
        // Page shadow falling into the spine valley (dark gradient toward center)
        parts.push(scene.add.rectangle(cx - 4 * s, cy - 3 * s, 2 * s, 8 * s, pageShadow));
        parts.push(scene.add.rectangle(cx + 4 * s, cy - 3 * s, 2 * s, 8 * s, pageShadow));

        // ============ GLOWING SIGIL (cursed tome flair) ============
        parts.push(scene.add.circle(cx, cy - 16 * s, 3.5 * s, 0xff44aa, 0.4));
        parts.push(scene.add.circle(cx, cy - 16 * s, 2 * s, 0xff66cc));
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
