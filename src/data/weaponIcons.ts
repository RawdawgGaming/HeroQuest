import Phaser from 'phaser';
import { TextureKeys } from '../visuals/textures';

/** Maps paladin weapon IDs to their PNG texture keys */
export const WEAPON_TEXTURES: Record<string, string> = {
  oak_mace:           TextureKeys.WEAPON_OAK_MACE,
  spiked_oak_mace:    TextureKeys.WEAPON_SPIKED_OAK_MACE,
  stone_mace:         TextureKeys.WEAPON_STONE_MACE,
  spiked_stone_mace:  TextureKeys.WEAPON_SPIKED_STONE_MACE,
  iron_mace:          TextureKeys.WEAPON_IRON_MACE,
  spiked_iron_mace:   TextureKeys.WEAPON_SPIKED_IRON_MACE,
  golden_mace:        TextureKeys.WEAPON_GOLDEN_MACE,
  spiked_golden_mace: TextureKeys.WEAPON_SPIKED_GOLDEN_MACE,
  ruby_mace:          TextureKeys.WEAPON_RUBY_MACE,
  spiked_ruby_mace:   TextureKeys.WEAPON_SPIKED_RUBY_MACE,
};

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

  // Paladin weapons — use PNG images (pre-cropped to ~85×128)
  const texKey = WEAPON_TEXTURES[weaponId];
  if (texKey && scene.textures.exists(texKey)) {
    const img = scene.add.image(cx, cy, texKey);
    img.setScale(s * 0.35);
    img.setOrigin(0.5, 0.5);
    parts.push(img);
    return parts;
  }

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
    g.fillEllipse(cx, cy + 7 * s, 38 * s, 4 * s);

    // ----- Leather back cover (rounded brown rectangle visible at the bottom front + sides) -----
    g.fillStyle(leather, 1);
    g.fillRoundedRect(cx - 18 * s, cy + 1 * s, 36 * s, 6 * s, 2);
    g.lineStyle(1, leatherDark, 1);
    g.strokeRoundedRect(cx - 18 * s, cy + 1 * s, 36 * s, 6 * s, 2);
    // Lighter leather highlight along the front edge
    g.fillStyle(leatherHi, 1);
    g.fillRect(cx - 17 * s, cy + 6 * s, 34 * s, 0.8 * s);

    // ----- Visible thick page stack on left & right sides (yellowed paper edges wrap around) -----
    g.fillStyle(pageEdgeMid, 1);
    g.fillRect(cx - 17 * s, cy - 1 * s, 2 * s, 4 * s);
    g.fillRect(cx + 15 * s, cy - 1 * s, 2 * s, 4 * s);
    g.fillStyle(pageEdgeLight, 1);
    g.fillRect(cx - 16.5 * s, cy - 0.5 * s, 1 * s, 3 * s);
    g.fillRect(cx + 15.5 * s, cy - 0.5 * s, 1 * s, 3 * s);

    // Helper to draw a smooth dome top using many points along an arc
    const arcDome = (startX: number, peakX: number, endX: number, baseY: number, peakY: number, steps = 12) => {
      const pts: { x: number; y: number }[] = [];
      const halfWidth = (endX - startX) / 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + (endX - startX) * t;
        // Smoothly interpolate y using a sine arc (peak at middle)
        const arcT = (x - startX) / (endX - startX);  // 0..1
        // Map x to arc using a parametric curve where peakX corresponds to t=0.5
        // For simplicity use a smooth sine bump
        const angle = arcT * Math.PI;
        const y = baseY + (peakY - baseY) * Math.sin(angle);
        pts.push({ x, y });
      }
      // Adjust peak position (shift midpoint toward peakX if needed by re-mapping)
      void peakX;
      return pts;
    };

    // ----- LEFT page (gentle slope from spine valley up and outward, then flat) -----
    // Pages slope up from spine center then gently curve down at outer edge
    g.fillStyle(pageTop, 1);
    g.beginPath();
    g.moveTo(cx - 15 * s, cy + 1 * s);   // outer-bottom
    g.lineTo(cx - 15 * s, cy - 1.5 * s); // outer top corner (low — outer edge sits low)
    // Page surface arcs gently UP toward middle of page, then DOWN slightly toward spine valley
    const leftPts = arcDome(cx - 15 * s, cx - 8 * s, cx - 1 * s, cy - 1.5 * s, cy - 3.5 * s, 14);
    for (const p of leftPts) g.lineTo(p.x, p.y);
    g.lineTo(cx - 1 * s, cy + 1 * s);    // spine bottom
    g.closePath();
    g.fillPath();
    g.lineStyle(1, leatherDark, 1);
    g.strokePath();

    // Left page highlight (creamier band along the upper page surface)
    g.fillStyle(pageHi, 1);
    g.beginPath();
    g.moveTo(cx - 13 * s, cy - 1.5 * s);
    const leftHiPts = arcDome(cx - 13 * s, cx - 8 * s, cx - 3 * s, cy - 2 * s, cy - 3.2 * s, 12);
    for (const p of leftHiPts) g.lineTo(p.x, p.y);
    g.lineTo(cx - 3 * s, cy - 1 * s);
    g.lineTo(cx - 13 * s, cy - 1 * s);
    g.closePath();
    g.fillPath();

    // ----- RIGHT page (mirrored) -----
    g.fillStyle(pageTop, 1);
    g.beginPath();
    g.moveTo(cx + 1 * s, cy + 1 * s);    // spine bottom
    g.lineTo(cx + 1 * s, cy - 1.5 * s);  // spine top (where it meets valley)
    const rightPts = arcDome(cx + 1 * s, cx + 8 * s, cx + 15 * s, cy - 1.5 * s, cy - 3.5 * s, 14);
    for (const p of rightPts) g.lineTo(p.x, p.y);
    g.lineTo(cx + 15 * s, cy + 1 * s);   // outer-bottom
    g.closePath();
    g.fillPath();
    g.lineStyle(1, leatherDark, 1);
    g.strokePath();

    // Right page highlight
    g.fillStyle(pageHi, 1);
    g.beginPath();
    g.moveTo(cx + 3 * s, cy - 1 * s);
    g.lineTo(cx + 3 * s, cy - 2 * s);
    const rightHiPts = arcDome(cx + 3 * s, cx + 8 * s, cx + 13 * s, cy - 2 * s, cy - 3 * s, 12);
    for (const p of rightHiPts) g.lineTo(p.x, p.y);
    g.lineTo(cx + 13 * s, cy - 1 * s);
    g.closePath();
    g.fillPath();

    // ----- Page edge stripes along the front bottom (visible thickness) -----
    g.fillStyle(pageEdgeLight, 1);
    g.fillRect(cx - 15 * s, cy + 1 * s, 30 * s, 0.6 * s);
    g.fillStyle(pageEdgeMid, 1);
    g.fillRect(cx - 15 * s, cy + 1.6 * s, 30 * s, 0.5 * s);
    g.fillStyle(pageEdgeLight, 1);
    g.fillRect(cx - 15 * s, cy + 2.1 * s, 30 * s, 0.4 * s);

    // ----- Narrow spine valley (subtle dark line in the middle, not a deep V) -----
    g.fillStyle(leatherDark, 0.8);
    g.fillRect(cx - 0.8 * s, cy - 1.5 * s, 1.6 * s, 2.5 * s);

    // ----- Subtle text lines on each page -----
    g.fillStyle(ink, 0.55);
    g.fillRect(cx - 12 * s, cy - 2.4 * s, 9 * s, 0.3 * s);
    g.fillRect(cx - 12 * s, cy - 1.5 * s, 9 * s, 0.3 * s);
    g.fillRect(cx + 3 * s, cy - 2.4 * s, 9 * s, 0.3 * s);
    g.fillRect(cx + 3 * s, cy - 1.5 * s, 9 * s, 0.3 * s);

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
      // Grim reaper scythe matching the reference: long diagonal twisted handle (lower-left → upper-right),
      // small dark L-bracket + skull at the upper-right end, large hooked crescent blade rising from the bracket
      const wood = 0x4a2a14;
      const woodDark = 0x1a0a02;
      const woodHi = 0x6a4020;
      const blade = 0xcccdd2;
      const bladeHi = 0xffffff;
      const bladeShadow = 0x70707a;
      const bladeEdge = 0x18181f;
      const skullCol = 0xe0dac0;
      const bracketCol = 0x222228;

      const g = scene.add.graphics();

      // Quadratic Bezier helper
      const quad = (ax: number, ay: number, px: number, py: number, bx: number, by: number, steps = 16) => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          const x = u * u * ax + 2 * u * t * px + t * t * bx;
          const y = u * u * ay + 2 * u * t * py + t * t * by;
          pts.push({ x, y });
        }
        return pts;
      };

      // ----- Twisted gnarled snath (curved/crooked, matching the reference photo) -----
      // The handle bows out to the right in the middle, like the gnarled branch in the reference
      const hxBot = cx - 2 * s, hyBot = cy + 16 * s;
      const hxTop = cx + 1 * s, hyTop = cy - 36 * s;
      // Centerline curves out to the right in the middle for the bowed gnarled-branch shape
      const handleCenter = quad(hxBot, hyBot, cx + 7 * s, cy - 8 * s, hxTop, hyTop, 32);

      // Build a tube around the centerline with thickness
      const halfW = 1.6 * s;
      const leftSide: { x: number; y: number }[] = [];
      const rightSide: { x: number; y: number }[] = [];
      for (let i = 0; i < handleCenter.length; i++) {
        const p = handleCenter[i];
        const next = handleCenter[Math.min(i + 1, handleCenter.length - 1)];
        const prev = handleCenter[Math.max(i - 1, 0)];
        const tx = next.x - prev.x;
        const ty = next.y - prev.y;
        const tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl;
        const ny = tx / tl;
        leftSide.push({ x: p.x + nx * halfW, y: p.y + ny * halfW });
        rightSide.push({ x: p.x - nx * halfW, y: p.y - ny * halfW });
      }
      g.fillStyle(wood, 1);
      g.beginPath();
      g.moveTo(leftSide[0].x, leftSide[0].y);
      for (let i = 1; i < leftSide.length; i++) g.lineTo(leftSide[i].x, leftSide[i].y);
      for (let i = rightSide.length - 1; i >= 0; i--) g.lineTo(rightSide[i].x, rightSide[i].y);
      g.closePath();
      g.fillPath();
      g.lineStyle(0.5 * s, woodDark, 1);
      g.strokePath();

      // Twist marks — small diagonal dark stripes along the handle
      g.lineStyle(0.7 * s, woodDark, 0.8);
      for (let i = 2; i < handleCenter.length - 1; i += 3) {
        const p = handleCenter[i];
        const next = handleCenter[i + 1];
        const tx = next.x - p.x;
        const ty = next.y - p.y;
        const tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl;
        const ny = tx / tl;
        g.beginPath();
        g.moveTo(p.x + nx * halfW * 0.9, p.y + ny * halfW * 0.9);
        g.lineTo(p.x - nx * halfW * 0.9, p.y - ny * halfW * 0.9);
        g.strokePath();
      }
      // Highlight stripe
      g.lineStyle(0.5 * s, woodHi, 0.7);
      g.beginPath();
      for (let i = 0; i < handleCenter.length; i++) {
        const p = handleCenter[i];
        const next = handleCenter[Math.min(i + 1, handleCenter.length - 1)];
        const prev = handleCenter[Math.max(i - 1, 0)];
        const tx = next.x - prev.x;
        const ty = next.y - prev.y;
        const tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl;
        const ny = tx / tl;
        const px = p.x + nx * halfW * 0.4;
        const py = p.y + ny * halfW * 0.4;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();

      // ----- Small dark metal bracket at the top of the vertical handle -----
      const brX = hxTop;
      const brY = hyTop;
      g.fillStyle(bracketCol, 1);
      // Compact horizontal bracket centered on the handle
      g.fillRect(brX - 2.5 * s, brY - 1.5 * s, 5 * s, 3 * s);
      g.lineStyle(0.4 * s, 0x000000, 1);
      g.strokeRect(brX - 2.5 * s, brY - 1.5 * s, 5 * s, 3 * s);

      // ----- Small skull mounted just below the bracket -----
      const skullX = brX;
      const skullY = brY + 3 * s;
      g.fillStyle(skullCol, 1);
      g.fillCircle(skullX, skullY, 1.8 * s);
      g.lineStyle(0.4 * s, woodDark, 1);
      g.strokeCircle(skullX, skullY, 1.8 * s);
      // Eye sockets
      g.fillStyle(0x000000, 1);
      g.fillCircle(skullX - 0.65 * s, skullY - 0.25 * s, 0.45 * s);
      g.fillCircle(skullX + 0.65 * s, skullY - 0.25 * s, 0.45 * s);
      // Jaw line
      g.lineStyle(0.3 * s, 0x000000, 1);
      g.beginPath();
      g.moveTo(skullX - 0.55 * s, skullY + 0.7 * s);
      g.lineTo(skullX + 0.55 * s, skullY + 0.7 * s);
      g.strokePath();

      // ----- Horizontal hooked crescent blade extending RIGHT from the bracket -----
      // Matches the reference photo: blade is a thin curved crescent with both edges curving up in the middle
      // Top edge (back) bulges UP dramatically; bottom edge (cutting edge) curves up gently — classic scythe profile
      const baseRX = brX + 1.5 * s, baseRY = brY - 3 * s;        // base TOP-LEFT (back of blade at bracket)
      const baseLX = brX + 1.5 * s, baseLY = brY + 3 * s;        // base BOTTOM-LEFT (cutting edge at bracket)
      const tipX = brX + 30 * s, tipY = brY + 1 * s;             // tip — far RIGHT, slightly above bottom baseline
      // Outer (back/top) curve peaks high in the middle — gives the blade its bulging back
      const outerPeakX = brX + 14 * s, outerPeakY = brY - 18 * s;
      // Inner (cutting/bottom) curve — peak is ABOVE the baseline, giving the cutting edge a gentle upward concave curve
      const innerPeakX = brX + 14 * s, innerPeakY = brY - 3 * s;

      const outerPts = quad(baseRX, baseRY, outerPeakX, outerPeakY, tipX, tipY, 20);
      const innerPts = quad(baseLX, baseLY, innerPeakX, innerPeakY, tipX, tipY, 20);

      // Fill the blade (lit side)
      g.fillStyle(blade, 1);
      g.beginPath();
      g.moveTo(outerPts[0].x, outerPts[0].y);
      for (let i = 1; i < outerPts.length; i++) g.lineTo(outerPts[i].x, outerPts[i].y);
      for (let i = innerPts.length - 1; i >= 0; i--) g.lineTo(innerPts[i].x, innerPts[i].y);
      g.closePath();
      g.fillPath();

      // Shadow band along the back (outer) of the blade — gives 3D shading
      g.fillStyle(bladeShadow, 1);
      const shadowPts = quad(baseRX - 0.6 * s, baseRY, outerPeakX - 1.5 * s, outerPeakY, tipX - 0.4 * s, tipY + 0.4 * s, 20);
      g.beginPath();
      g.moveTo(outerPts[0].x, outerPts[0].y);
      for (let i = 1; i < outerPts.length; i++) g.lineTo(outerPts[i].x, outerPts[i].y);
      for (let i = shadowPts.length - 1; i >= 0; i--) g.lineTo(shadowPts[i].x, shadowPts[i].y);
      g.closePath();
      g.fillPath();

      // Outline the whole blade
      g.lineStyle(0.6 * s, bladeEdge, 1);
      g.beginPath();
      g.moveTo(outerPts[0].x, outerPts[0].y);
      for (let i = 1; i < outerPts.length; i++) g.lineTo(outerPts[i].x, outerPts[i].y);
      for (let i = innerPts.length - 1; i >= 0; i--) g.lineTo(innerPts[i].x, innerPts[i].y);
      g.closePath();
      g.strokePath();

      // Bright highlight along the cutting edge (just inside the inner curve)
      g.lineStyle(0.7 * s, bladeHi, 1);
      g.beginPath();
      const hiPts = quad(baseLX + 0.5 * s, baseLY, innerPeakX + 0.5 * s, innerPeakY, tipX - 0.2 * s, tipY + 0.4 * s, 20);
      g.moveTo(hiPts[0].x, hiPts[0].y);
      for (let i = 1; i < hiPts.length; i++) g.lineTo(hiPts[i].x, hiPts[i].y);
      g.strokePath();

      parts.push(g);

      // Sickly green glow at the blade tip
      parts.push(scene.add.circle(tipX, tipY, 2.5 * s, 0x44ff66, 0.5));
      parts.push(scene.add.circle(tipX, tipY, 1.2 * s, 0xaaffaa, 0.9));
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
    case 'bonewalker_ribcage': {
      // A hollow rib cage with a glowing red core
      // Spine
      parts.push(scene.add.rectangle(cx, cy, 2 * s, 26 * s, 0xeeddbb));
      // Ribs (paired curved arcs on each side)
      const ribColor = 0xddccaa;
      for (let i = 0; i < 4; i++) {
        const ribY = cy - 9 * s + i * 6 * s;
        // Left rib
        parts.push(scene.add.ellipse(cx - 5 * s, ribY, 10 * s, 3 * s, ribColor)
          .setStrokeStyle(0.6, 0x664422));
        // Right rib
        parts.push(scene.add.ellipse(cx + 5 * s, ribY, 10 * s, 3 * s, ribColor)
          .setStrokeStyle(0.6, 0x664422));
      }
      // Glowing red heart in the center of the cage
      parts.push(scene.add.circle(cx, cy, 4.5 * s, 0xcc2222, 0.7));
      parts.push(scene.add.circle(cx, cy, 2.5 * s, 0xff4444, 1));
      break;
    }
    case 'soulrender': {
      // Jagged athame (ritual dagger) with a glowing soul-blue blade
      // Hilt (dark)
      parts.push(scene.add.rectangle(cx, cy + 8 * s, 4 * s, 8 * s, 0x222233));
      // Crossguard
      parts.push(scene.add.rectangle(cx, cy + 3 * s, 12 * s, 2 * s, 0x666688));
      // Blade — main triangle
      parts.push(scene.add.triangle(
        cx, cy - 7 * s,
        -4 * s, 3 * s,
        4 * s, 3 * s,
        0, -16 * s,
        0x88ccff,
      ).setStrokeStyle(1, 0x224488));
      // Inner glow line down the blade
      parts.push(scene.add.rectangle(cx, cy - 6 * s, 1 * s, 14 * s, 0xddeeff));
      // Soul wisp at the tip
      parts.push(scene.add.circle(cx, cy - 16 * s, 3 * s, 0x66ddff, 0.6));
      parts.push(scene.add.circle(cx, cy - 16 * s, 1.5 * s, 0xffffff, 0.9));
      // Pommel gem
      parts.push(scene.add.circle(cx, cy + 12 * s, 2 * s, 0x66ddff));
      break;
    }
    case 'deaths_embrace': {
      // Twin reaper claws — two curved black blades crossing in an X
      // Wrist guard / knuckle
      parts.push(scene.add.circle(cx, cy + 6 * s, 4 * s, 0x111122).setStrokeStyle(1, 0x6633cc));
      // Left claw — curve from lower-right to upper-left
      const lc = scene.add.graphics();
      lc.fillStyle(0x222233, 1);
      lc.beginPath();
      lc.moveTo(cx - 1 * s, cy + 5 * s);
      lc.lineTo(cx - 12 * s, cy - 8 * s);
      lc.lineTo(cx - 9 * s, cy - 13 * s);
      lc.lineTo(cx + 1 * s, cy + 2 * s);
      lc.closePath();
      lc.fillPath();
      lc.lineStyle(0.6, 0x6633cc, 1);
      lc.strokePath();
      parts.push(lc);
      // Right claw — mirrored
      const rc = scene.add.graphics();
      rc.fillStyle(0x222233, 1);
      rc.beginPath();
      rc.moveTo(cx + 1 * s, cy + 5 * s);
      rc.lineTo(cx + 12 * s, cy - 8 * s);
      rc.lineTo(cx + 9 * s, cy - 13 * s);
      rc.lineTo(cx - 1 * s, cy + 2 * s);
      rc.closePath();
      rc.fillPath();
      rc.lineStyle(0.6, 0x6633cc, 1);
      rc.strokePath();
      parts.push(rc);
      // Purple glow at the wrist
      parts.push(scene.add.circle(cx, cy + 6 * s, 6 * s, 0x6633cc, 0.4));
      // Tip sparkles
      parts.push(scene.add.circle(cx - 11 * s, cy - 11 * s, 1.2 * s, 0xaa66ff));
      parts.push(scene.add.circle(cx + 11 * s, cy - 11 * s, 1.2 * s, 0xaa66ff));
      break;
    }
    case 'apex_reliquary': {
      // Ornate gold reliquary — pedestal + crystal orb crowned with three soul flames
      // Pedestal base
      parts.push(scene.add.rectangle(cx, cy + 12 * s, 14 * s, 4 * s, 0xaa8822)
        .setStrokeStyle(0.6, 0x554411));
      parts.push(scene.add.rectangle(cx, cy + 8 * s, 10 * s, 3 * s, 0xddbb44));
      // Central crystal orb
      parts.push(scene.add.circle(cx, cy, 7 * s, 0xffeeaa, 0.4));
      parts.push(scene.add.circle(cx, cy, 5 * s, 0xffdd44, 1)
        .setStrokeStyle(0.8, 0x886611));
      // Inner bright core
      parts.push(scene.add.circle(cx, cy - 1 * s, 2 * s, 0xffffff, 0.85));
      // Three soul flames rising from the top — center, left, right
      const flameColor = 0xff66ff;
      const flameGlow = 0xffaaff;
      // Center flame
      parts.push(scene.add.ellipse(cx, cy - 11 * s, 3 * s, 6 * s, flameColor));
      parts.push(scene.add.ellipse(cx, cy - 12 * s, 1.5 * s, 4 * s, flameGlow));
      // Left flame
      parts.push(scene.add.ellipse(cx - 5 * s, cy - 9 * s, 2.4 * s, 5 * s, flameColor));
      parts.push(scene.add.ellipse(cx - 5 * s, cy - 10 * s, 1.2 * s, 3 * s, flameGlow));
      // Right flame
      parts.push(scene.add.ellipse(cx + 5 * s, cy - 9 * s, 2.4 * s, 5 * s, flameColor));
      parts.push(scene.add.ellipse(cx + 5 * s, cy - 10 * s, 1.2 * s, 3 * s, flameGlow));
      // Outer divine glow
      parts.push(scene.add.circle(cx, cy - 2 * s, 13 * s, 0xffeeaa, 0.15));
      break;
    }
    default: {
      // Generic class-typical weapon icon based on weapon ID prefix.
      // Each new class's weapons fall through to this branch and get a stylized
      // shape using the weapon's `color` value passed via opts.tint (or fallback).
      // We sniff the weapon ID to pick the visual category.
      drawGenericWeapon(scene, weaponId, cx, cy, s, parts);
    }
  }

  return parts;
}

/** Generic weapon drawer that infers a visual category from the weapon ID. */
function drawGenericWeapon(
  scene: Phaser.Scene,
  weaponId: string,
  cx: number,
  cy: number,
  s: number,
  parts: Phaser.GameObjects.GameObject[],
): void {
  // --- PALADIN: maces and hammers ---
  if (
    weaponId === 'oak_mace' || weaponId === 'iron_mace' || weaponId === 'morning_star' ||
    weaponId === 'warhammer' || weaponId === 'consecrated_mace' || weaponId === 'sunfire_hammer' ||
    weaponId === 'aegis_breaker' || weaponId === 'divine_judge' || weaponId === 'avenger' ||
    weaponId === 'lights_aurora'
  ) {
    // Wooden / leather haft
    parts.push(scene.add.rectangle(cx, cy + 6 * s, 3 * s, 22 * s, 0x664422));
    // Pommel
    parts.push(scene.add.circle(cx, cy + 16 * s, 2 * s, 0x444422));
    // Mace head — depends on weapon
    if (weaponId === 'morning_star') {
      // Spiked ball
      parts.push(scene.add.circle(cx, cy - 10 * s, 6 * s, 0xccccaa));
      // Spikes
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sx = cx + Math.cos(a) * 8 * s;
        const sy = cy - 10 * s + Math.sin(a) * 8 * s;
        parts.push(scene.add.triangle(sx, sy, 0, -2 * s, 1.5 * s, 1.5 * s, -1.5 * s, 1.5 * s, 0xeeeecc));
      }
    } else if (weaponId === 'warhammer' || weaponId === 'aegis_breaker' ||
               weaponId === 'sunfire_hammer' || weaponId === 'avenger') {
      // Square hammer head
      const headColor = weaponId === 'sunfire_hammer' ? 0xffcc44
                      : weaponId === 'avenger' ? 0xffeebb
                      : weaponId === 'aegis_breaker' ? 0xddbb55
                      : 0x888888;
      parts.push(scene.add.rectangle(cx, cy - 10 * s, 14 * s, 10 * s, headColor).setStrokeStyle(0.8, 0x222222));
      parts.push(scene.add.rectangle(cx, cy - 10 * s, 12 * s, 1.5 * s, 0xffffff, 0.4));
    } else {
      // Round mace head (oak, iron, consecrated, divine_judge, lights_aurora)
      const headColor = weaponId === 'lights_aurora' ? 0xfff8cc
                      : weaponId === 'divine_judge' ? 0xfff0aa
                      : weaponId === 'consecrated_mace' ? 0xffeeaa
                      : weaponId === 'iron_mace' ? 0xaaaaaa
                      : 0xb08850;
      parts.push(scene.add.circle(cx, cy - 10 * s, 7 * s, headColor).setStrokeStyle(0.8, 0x222222));
      // Ridges
      parts.push(scene.add.rectangle(cx, cy - 10 * s, 14 * s, 1.5 * s, 0x000000, 0.3));
      parts.push(scene.add.rectangle(cx, cy - 10 * s, 1.5 * s, 14 * s, 0x000000, 0.3));
      // Holy glow for end-game maces
      if (weaponId === 'lights_aurora' || weaponId === 'divine_judge' || weaponId === 'consecrated_mace') {
        parts.push(scene.add.circle(cx, cy - 10 * s, 11 * s, 0xffeeaa, 0.25));
      }
    }
    return;
  }

  // --- BARBARIAN: axes and great weapons ---
  if (
    weaponId === 'rusty_axe' || weaponId === 'broad_axe' || weaponId === 'great_axe' ||
    weaponId === 'savage_cleaver' || weaponId === 'berserker_axe' || weaponId === 'wartorn_blade' ||
    weaponId === 'titan_hammer' || weaponId === 'ravager_axe' || weaponId === 'doombringer' ||
    weaponId === 'world_render'
  ) {
    if (weaponId === 'wartorn_blade') {
      // Greatsword instead of an axe
      parts.push(scene.add.rectangle(cx, cy + 8 * s, 2.4 * s, 8 * s, 0x664422));
      parts.push(scene.add.rectangle(cx, cy + 4 * s, 12 * s, 2 * s, 0x666666));
      parts.push(scene.add.triangle(
        cx, cy - 8 * s,
        -3 * s, 12 * s,
        3 * s, 12 * s,
        0, -16 * s,
        0x999988,
      ).setStrokeStyle(0.8, 0x222222));
      parts.push(scene.add.rectangle(cx, cy - 4 * s, 0.8 * s, 14 * s, 0xddddcc));
      return;
    }
    // Wooden haft
    parts.push(scene.add.rectangle(cx + 1 * s, cy + 6 * s, 3 * s, 22 * s, 0x553311));
    parts.push(scene.add.circle(cx + 1 * s, cy + 16 * s, 2 * s, 0x332211));
    // Axe head — large curved blade on the left
    const headColor = weaponId === 'world_render' ? 0xff6644
                    : weaponId === 'doombringer' ? 0xaa3322
                    : weaponId === 'ravager_axe' ? 0x442222
                    : weaponId === 'berserker_axe' ? 0xcc4422
                    : weaponId === 'savage_cleaver' ? 0x884422
                    : weaponId === 'great_axe' ? 0xccaa77
                    : weaponId === 'broad_axe' ? 0xaa9966
                    : 0x886644;
    // Asymmetric blade triangle
    parts.push(scene.add.triangle(
      cx - 4 * s, cy - 8 * s,
      0, -4 * s,
      14 * s, 0,
      -2 * s, 10 * s,
      headColor,
    ).setStrokeStyle(0.8, 0x222222));
    // Highlight edge
    parts.push(scene.add.rectangle(cx - 8 * s, cy - 6 * s, 2 * s, 8 * s, 0xffffff, 0.3));
    // Glow for end-game
    if (weaponId === 'doombringer' || weaponId === 'world_render') {
      parts.push(scene.add.circle(cx - 4 * s, cy - 6 * s, 14 * s, headColor, 0.15));
    }
    return;
  }

  // --- TEMPLAR: swords ---
  if (
    weaponId === 'training_sword' || weaponId === 'knights_blade' || weaponId === 'runed_blade' ||
    weaponId === 'silver_falchion' || weaponId === 'holy_claymore' || weaponId === 'azure_sword' ||
    weaponId === 'paladins_oath' || weaponId === 'starforged_sword' || weaponId === 'covenant_blade' ||
    weaponId === 'aetherblade'
  ) {
    // Hilt
    parts.push(scene.add.rectangle(cx, cy + 10 * s, 2.5 * s, 7 * s, 0x442211));
    // Pommel
    parts.push(scene.add.circle(cx, cy + 14 * s, 2 * s, 0xddcc66));
    // Crossguard
    parts.push(scene.add.rectangle(cx, cy + 5 * s, 12 * s, 2 * s, 0xaa8844));
    // Blade
    const bladeColor = weaponId === 'aetherblade' ? 0xeeffff
                     : weaponId === 'covenant_blade' ? 0xddeeff
                     : weaponId === 'starforged_sword' ? 0xaaccff
                     : weaponId === 'paladins_oath' ? 0xccddff
                     : weaponId === 'azure_sword' ? 0x6699ff
                     : weaponId === 'holy_claymore' ? 0xeeeeff
                     : weaponId === 'silver_falchion' ? 0xddddff
                     : weaponId === 'runed_blade' ? 0xbbbbff
                     : weaponId === 'knights_blade' ? 0xaaaacc
                     : 0x9999bb;
    parts.push(scene.add.triangle(
      cx, cy - 4 * s,
      -2 * s, 8 * s,
      2 * s, 8 * s,
      0, -16 * s,
      bladeColor,
    ).setStrokeStyle(0.8, 0x222222));
    // Center groove
    parts.push(scene.add.rectangle(cx, cy - 4 * s, 0.6 * s, 18 * s, 0xffffff, 0.4));
    // Glow for end-game swords
    if (weaponId === 'aetherblade' || weaponId === 'covenant_blade' || weaponId === 'starforged_sword') {
      parts.push(scene.add.circle(cx, cy - 4 * s, 14 * s, bladeColor, 0.2));
    }
    return;
  }

  // --- MAGE: wands, staves, orbs ---
  if (
    weaponId === 'apprentice_wand' || weaponId === 'oak_staff' || weaponId === 'arcane_orb' ||
    weaponId === 'frost_wand' || weaponId === 'fire_staff' || weaponId === 'arcane_codex' ||
    weaponId === 'phoenix_staff' || weaponId === 'chronomancer_orb' || weaponId === 'archmage_staff' ||
    weaponId === 'reality_weaver'
  ) {
    if (weaponId === 'arcane_orb' || weaponId === 'chronomancer_orb') {
      // Floating orb (no shaft)
      const orbColor = weaponId === 'chronomancer_orb' ? 0x66ffcc : 0x9966ff;
      parts.push(scene.add.circle(cx, cy, 9 * s, orbColor, 0.4));
      parts.push(scene.add.circle(cx, cy, 6 * s, orbColor, 0.85).setStrokeStyle(0.8, 0x222222));
      parts.push(scene.add.circle(cx - 1 * s, cy - 1 * s, 2 * s, 0xffffff, 0.7));
      // Surrounding sparks
      parts.push(scene.add.circle(cx - 8 * s, cy - 4 * s, 1 * s, orbColor));
      parts.push(scene.add.circle(cx + 8 * s, cy + 4 * s, 1 * s, orbColor));
      parts.push(scene.add.circle(cx + 6 * s, cy - 8 * s, 1 * s, orbColor));
      return;
    }
    if (weaponId === 'arcane_codex') {
      // Floating tome
      parts.push(scene.add.rectangle(cx, cy, 16 * s, 12 * s, 0x442255).setStrokeStyle(1, 0xffaa44));
      parts.push(scene.add.rectangle(cx, cy, 14 * s, 10 * s, 0xeedd99));
      parts.push(scene.add.rectangle(cx, cy, 0.6 * s, 12 * s, 0x442255));
      // Glowing rune
      parts.push(scene.add.circle(cx - 4 * s, cy, 1.5 * s, 0xaa44ff));
      parts.push(scene.add.circle(cx + 4 * s, cy, 1.5 * s, 0xaa44ff));
      return;
    }
    // Staff/wand: shaft + topper
    const shaftColor = weaponId === 'reality_weaver' ? 0x442266
                     : weaponId === 'archmage_staff' ? 0x553388
                     : weaponId === 'phoenix_staff' ? 0x884422
                     : weaponId === 'fire_staff' ? 0x553311
                     : weaponId === 'frost_wand' ? 0xaaccdd
                     : 0x664422;
    parts.push(scene.add.rectangle(cx, cy + 4 * s, 2.5 * s, 24 * s, shaftColor));
    parts.push(scene.add.circle(cx, cy + 16 * s, 1.5 * s, 0x332211));
    // Topper crystal/flame
    const topColor = weaponId === 'reality_weaver' ? 0xff66ff
                   : weaponId === 'archmage_staff' ? 0xcc66ff
                   : weaponId === 'phoenix_staff' ? 0xff8844
                   : weaponId === 'fire_staff' ? 0xff6633
                   : weaponId === 'frost_wand' ? 0x66ccff
                   : weaponId === 'oak_staff' ? 0xaaccff
                   : 0xaa66cc;
    parts.push(scene.add.circle(cx, cy - 12 * s, 5 * s, topColor, 0.5));
    parts.push(scene.add.circle(cx, cy - 12 * s, 3.5 * s, topColor));
    parts.push(scene.add.circle(cx, cy - 12 * s, 1.5 * s, 0xffffff, 0.8));
    return;
  }

  // --- ARCHER: bows ---
  if (
    weaponId === 'short_bow' || weaponId === 'hunting_bow' || weaponId === 'longbow' ||
    weaponId === 'composite_bow' || weaponId === 'recurve_bow' || weaponId === 'elven_longbow' ||
    weaponId === 'thunderstrike_bow' || weaponId === 'shadowstring' || weaponId === 'hawkeye_bow' ||
    weaponId === 'world_piercer'
  ) {
    const bowColor = weaponId === 'world_piercer' ? 0xffeebb
                   : weaponId === 'hawkeye_bow' ? 0xffcc66
                   : weaponId === 'shadowstring' ? 0x444455
                   : weaponId === 'thunderstrike_bow' ? 0x66ddff
                   : weaponId === 'elven_longbow' ? 0xeeddaa
                   : weaponId === 'recurve_bow' ? 0x664422
                   : weaponId === 'composite_bow' ? 0xddbb77
                   : weaponId === 'longbow' ? 0xccaa66
                   : weaponId === 'hunting_bow' ? 0xaa8855
                   : 0x886633;
    // Bow curve drawn via two arc segments using filled arc points
    const g = scene.add.graphics();
    g.lineStyle(2 * s, bowColor, 1);
    // Top arc
    g.beginPath();
    g.arc(cx + 8 * s, cy, 14 * s, Math.PI * 0.85, Math.PI * 1.15, false);
    g.strokePath();
    // Bowstring
    g.lineStyle(0.8 * s, 0xeeeeee, 0.9);
    g.beginPath();
    g.moveTo(cx - 6 * s, cy - 12 * s);
    g.lineTo(cx - 6 * s, cy + 12 * s);
    g.strokePath();
    // Arrow nocked on the string
    g.lineStyle(1.2 * s, 0x442211, 1);
    g.beginPath();
    g.moveTo(cx - 6 * s, cy);
    g.lineTo(cx + 12 * s, cy);
    g.strokePath();
    g.fillStyle(0xeeeecc, 1);
    g.fillTriangle(cx + 12 * s, cy - 2 * s, cx + 12 * s, cy + 2 * s, cx + 16 * s, cy);
    parts.push(g);
    if (weaponId === 'world_piercer' || weaponId === 'hawkeye_bow') {
      parts.push(scene.add.circle(cx, cy, 14 * s, bowColor, 0.2));
    }
    return;
  }

  // True fallback — gray square
  parts.push(scene.add.rectangle(cx, cy, 14 * s, 14 * s, 0xaaaaaa));
}
