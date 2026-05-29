import Phaser from 'phaser';
import type { HeroClassDef } from '../data/heroClasses';
import type { CharacterProgression } from '../systems/CharacterProgression';
import type { User } from '@supabase/supabase-js';

interface StageSelectData {
  heroClass: HeroClassDef;
  user?: User;
  characterId?: string;
  gold: number;
  level: number;
  currentXp: number;
  currentStage: number;
  progression?: CharacterProgression;
}

import { STAGE_CONFIGS } from '../data/stageConfigs';

// Stage names for the map — Stage 1 is hardcoded, 2–50 from stage configs
const STAGE_NAMES = ['Forest Entrance', ...STAGE_CONFIGS.map(s => s.stageName)];

// Generate winding path positions for 50 stages across the parchment map.
// The path snakes left-to-right in 5 rows, each row containing 10 stages.
const STAGE_POSITIONS: { x: number; y: number }[] = (() => {
  const positions: { x: number; y: number }[] = [];
  const rows = 5;
  const perRow = 10;
  const marginX = 100;
  const marginY = 100;
  const usableW = 1280 - marginX * 2;
  const usableH = 720 - marginY * 2;
  const rowH = usableH / (rows - 1);

  for (let row = 0; row < rows; row++) {
    const y = 720 - marginY - row * rowH;
    const leftToRight = row % 2 === 0;
    for (let col = 0; col < perRow; col++) {
      const t = col / (perRow - 1);
      const x = leftToRight
        ? marginX + t * usableW
        : marginX + (1 - t) * usableW;
      // Add slight vertical wobble for organic feel
      const wobble = Math.sin((row * perRow + col) * 0.7) * 15;
      positions.push({ x: Math.round(x), y: Math.round(y + wobble) });
    }
  }
  return positions;
})();

export class StageSelect extends Phaser.Scene {
  private stageData!: StageSelectData;

  constructor() {
    super('StageSelect');
  }

  init(data: StageSelectData): void {
    this.stageData = data;
  }

  create(): void {
    const W = 1280, H = 720;

    // ===== PARCHMENT BACKGROUND =====
    this.drawParchmentBackground(W, H);

    // ===== TERRAIN FEATURES =====
    this.drawTerrain();

    // ===== WINDING PATH between stages =====
    this.drawPath();

    // ===== STAGE NODES =====
    const highestUnlocked = this.stageData.currentStage;
    for (let i = 0; i < STAGE_POSITIONS.length; i++) {
      const pos = STAGE_POSITIONS[i];
      const isCompleted = i < highestUnlocked;
      const isCurrent = i === highestUnlocked;
      const isUnlocked = i <= highestUnlocked;
      this.createStageNode(pos.x, pos.y, i, isUnlocked, isCompleted, isCurrent);
    }

    // ===== MAP TITLE — parchment style =====
    this.add.text(640, 30, 'HERO QUEST — WORLD MAP', {
      fontSize: '22px', color: '#4a3520', fontFamily: 'serif',
      stroke: '#d4c4a0', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(10);

    // Character info
    this.add.text(640, 58, `${this.stageData.heroClass.name}  ·  Lv.${this.stageData.level}  ·  ${this.stageData.gold} Gold`, {
      fontSize: '13px', color: '#6a5a40', fontFamily: 'serif',
    }).setOrigin(0.5).setDepth(10);

    // ===== BOTTOM BAR BUTTONS =====
    this.createBottomButtons();

    // ===== DECORATIVE BORDER =====
    this.drawBorder(W, H);
  }

  // =========================================================================
  // PARCHMENT BACKGROUND
  // =========================================================================
  private drawParchmentBackground(w: number, h: number): void {
    const g = this.add.graphics().setDepth(0);

    // Base parchment fill
    g.fillStyle(0xd4c4a0, 1);
    g.fillRect(0, 0, w, h);

    // Aged stain patches — irregular darker blotches
    const stains = [
      { x: 200, y: 150, rx: 120, ry: 80 },
      { x: 800, y: 400, rx: 150, ry: 100 },
      { x: 500, y: 300, rx: 100, ry: 60 },
      { x: 1050, y: 200, rx: 90, ry: 70 },
      { x: 300, y: 500, rx: 130, ry: 90 },
      { x: 900, y: 100, rx: 80, ry: 50 },
    ];
    for (const s of stains) {
      g.fillStyle(0xc8b890, 0.5);
      g.fillEllipse(s.x, s.y, s.rx, s.ry);
    }

    // Lighter worn patches
    for (let i = 0; i < 8; i++) {
      const lx = Phaser.Math.Between(50, w - 50);
      const ly = Phaser.Math.Between(50, h - 50);
      g.fillStyle(0xe0d4b8, 0.3);
      g.fillEllipse(lx, ly, Phaser.Math.Between(40, 100), Phaser.Math.Between(30, 60));
    }

    // Edge darkening (vignette)
    g.fillStyle(0x8a7a60, 0.15);
    g.fillRect(0, 0, w, 30);
    g.fillRect(0, h - 30, w, 30);
    g.fillRect(0, 0, 30, h);
    g.fillRect(w - 30, 0, 30, h);

    // Corner darkening
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      g.fillStyle(0x7a6a50, 0.2);
      g.fillEllipse(cx, cy, 200, 200);
    }
  }

  // =========================================================================
  // TERRAIN FEATURES — trees, mountains, water
  // =========================================================================
  private drawTerrain(): void {
    const g = this.add.graphics().setDepth(1);

    // --- Trees (scattered forest clusters) ---
    const treeClusters = [
      { x: 60, y: 400, count: 4 }, { x: 180, y: 440, count: 3 },
      { x: 950, y: 580, count: 3 }, { x: 700, y: 440, count: 2 },
      { x: 150, y: 200, count: 3 }, { x: 500, y: 120, count: 2 },
      { x: 1150, y: 300, count: 3 }, { x: 850, y: 220, count: 2 },
    ];
    for (const cluster of treeClusters) {
      for (let i = 0; i < cluster.count; i++) {
        const tx = cluster.x + Phaser.Math.Between(-25, 25);
        const ty = cluster.y + Phaser.Math.Between(-15, 15);
        // Trunk
        g.fillStyle(0x6a5030, 0.6);
        g.fillRect(tx - 2, ty, 4, 10);
        // Canopy
        g.fillStyle(0x5a7a40, 0.5);
        g.fillTriangle(tx, ty - 12, tx - 8, ty + 2, tx + 8, ty + 2);
        g.fillStyle(0x4a6a30, 0.4);
        g.fillTriangle(tx, ty - 18, tx - 6, ty - 6, tx + 6, ty - 6);
      }
    }

    // --- Mountains (top area) ---
    const mountains = [
      { x: 1050, y: 100 }, { x: 1120, y: 120 }, { x: 1000, y: 130 },
      { x: 200, y: 130 }, { x: 260, y: 110 },
    ];
    for (const m of mountains) {
      g.fillStyle(0x8a7a65, 0.5);
      g.fillTriangle(m.x, m.y - 30, m.x - 20, m.y + 10, m.x + 20, m.y + 10);
      // Snow cap
      g.fillStyle(0xe8e0d0, 0.5);
      g.fillTriangle(m.x, m.y - 30, m.x - 6, m.y - 16, m.x + 6, m.y - 16);
    }

    // --- Water/river ---
    g.lineStyle(8, 0x8aaab8, 0.3);
    g.beginPath();
    g.moveTo(0, 350);
    g.lineTo(80, 340);
    g.lineTo(60, 320);
    g.lineTo(30, 300);
    g.strokePath();

    g.lineStyle(6, 0x8aaab8, 0.25);
    g.beginPath();
    g.moveTo(1280, 460);
    g.lineTo(1200, 470);
    g.lineTo(1180, 500);
    g.strokePath();

    // --- Small buildings/ruins ---
    const drawRuin = (rx: number, ry: number) => {
      g.fillStyle(0x7a6a55, 0.5);
      g.fillRect(rx - 6, ry - 8, 12, 12);
      g.fillStyle(0x6a5a45, 0.5);
      g.fillTriangle(rx, ry - 14, rx - 8, ry - 6, rx + 8, ry - 6);
    };
    drawRuin(450, 430);
    drawRuin(750, 250);
    drawRuin(1060, 350);
  }

  // =========================================================================
  // WINDING PATH connecting stages
  // =========================================================================
  private drawPath(): void {
    const g = this.add.graphics().setDepth(2);

    // Dashed/dotted trail between stages
    for (let i = 0; i < STAGE_POSITIONS.length - 1; i++) {
      const a = STAGE_POSITIONS[i];
      const b = STAGE_POSITIONS[i + 1];

      // Outer path (wider, darker)
      g.lineStyle(6, 0x8a7a5a, 0.35);
      g.beginPath();
      g.moveTo(a.x, a.y);
      // Slight curve via midpoint offset
      const mx = (a.x + b.x) / 2 + Phaser.Math.Between(-15, 15);
      const my = (a.y + b.y) / 2 + Phaser.Math.Between(-10, 10);
      g.lineTo(mx, my);
      g.lineTo(b.x, b.y);
      g.strokePath();

      // Inner path (narrower, lighter)
      g.lineStyle(3, 0xa8956a, 0.4);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(mx, my);
      g.lineTo(b.x, b.y);
      g.strokePath();

      // Dot markers along the path
      const steps = 4;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const dx = Phaser.Math.Linear(a.x, b.x, t);
        const dy = Phaser.Math.Linear(a.y, b.y, t);
        g.fillStyle(0x8a7a5a, 0.25);
        g.fillCircle(dx, dy, 2);
      }
    }
  }

  // =========================================================================
  // STAGE NODE — shield/banner shape
  // =========================================================================
  private createStageNode(
    x: number, y: number, stageIndex: number,
    isUnlocked: boolean, isCompleted: boolean, isCurrent: boolean,
  ): void {
    const g = this.add.graphics().setDepth(5);

    // Shield shape colors
    let shieldColor = 0x6a5a45;  // locked: dark brown
    let shieldAlpha = 0.4;
    let borderColor = 0x5a4a35;
    let textColor = '#5a5040';

    if (isCompleted) {
      shieldColor = 0x5a8a40;    // green
      shieldAlpha = 0.9;
      borderColor = 0x3a6a25;
      textColor = '#ffffff';
    } else if (isCurrent) {
      shieldColor = 0xc8a830;    // gold
      shieldAlpha = 1;
      borderColor = 0xa08020;
      textColor = '#ffffff';
    } else if (isUnlocked) {
      shieldColor = 0x6888a8;    // blue-grey
      shieldAlpha = 0.9;
      borderColor = 0x4a6888;
      textColor = '#ffffff';
    }

    // Draw shield shape (pointed bottom)
    const sw = 28, sh = 32;
    g.fillStyle(shieldColor, shieldAlpha);
    g.beginPath();
    g.moveTo(x - sw / 2, y - sh / 2);       // top-left
    g.lineTo(x + sw / 2, y - sh / 2);       // top-right
    g.lineTo(x + sw / 2, y + sh / 4);       // mid-right
    g.lineTo(x, y + sh / 2);                // bottom point
    g.lineTo(x - sw / 2, y + sh / 4);       // mid-left
    g.closePath();
    g.fillPath();

    // Shield border
    g.lineStyle(2, borderColor, shieldAlpha);
    g.beginPath();
    g.moveTo(x - sw / 2, y - sh / 2);
    g.lineTo(x + sw / 2, y - sh / 2);
    g.lineTo(x + sw / 2, y + sh / 4);
    g.lineTo(x, y + sh / 2);
    g.lineTo(x - sw / 2, y + sh / 4);
    g.closePath();
    g.strokePath();

    // Shield cross detail (for completed/current)
    if (isUnlocked) {
      g.lineStyle(1.5, 0xffffff, 0.2);
      g.lineBetween(x, y - sh / 2, x, y + sh / 4);
      g.lineBetween(x - sw / 2, y - 4, x + sw / 2, y - 4);
    }

    // Stage number
    this.add.text(x, y - 4, `${stageIndex + 1}`, {
      fontSize: '14px', color: textColor, fontFamily: 'serif',
      stroke: '#000000', strokeThickness: isUnlocked ? 2 : 0,
    }).setOrigin(0.5).setDepth(6);

    // Stage name below
    const name = STAGE_NAMES[stageIndex] ?? `Stage ${stageIndex + 1}`;
    this.add.text(x, y + sh / 2 + 10, name, {
      fontSize: '9px', color: isUnlocked ? '#4a3520' : '#9a8a70',
      fontFamily: 'serif',
    }).setOrigin(0.5).setDepth(6);

    // Completed — checkmark flag
    if (isCompleted) {
      const flag = this.add.graphics().setDepth(7);
      flag.fillStyle(0x3a8a25, 1);
      flag.fillCircle(x + 14, y - 18, 7);
      this.add.text(x + 14, y - 19, '✓', {
        fontSize: '10px', color: '#ffffff', fontFamily: 'serif',
      }).setOrigin(0.5).setDepth(8);
    }

    // Current — pulsing golden glow
    if (isCurrent) {
      const glow = this.add.circle(x, y, 24, 0xc8a830, 0.15).setDepth(4);
      this.tweens.add({
        targets: glow, scale: 1.5, alpha: 0.05,
        yoyo: true, duration: 700, repeat: -1,
      });
      // Arrow pointing down at current stage
      const arrow = this.add.graphics().setDepth(7);
      arrow.fillStyle(0xc83030, 0.9);
      arrow.fillTriangle(x, y - sh / 2 - 8, x - 6, y - sh / 2 - 20, x + 6, y - sh / 2 - 20);
      arrow.fillStyle(0xc83030, 0.9);
      arrow.fillRect(x - 3, y - sh / 2 - 30, 6, 12);
      this.tweens.add({
        targets: arrow, y: 4, yoyo: true, duration: 500, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Locked — small lock drawn on shield
    if (!isUnlocked) {
      const lock = this.add.graphics().setDepth(7);
      lock.fillStyle(0x5a4a35, 0.7);
      lock.fillRect(x - 5, y - 2, 10, 8);
      lock.lineStyle(2, 0x5a4a35, 0.7);
      lock.strokeCircle(x, y - 5, 5);
    }

    // Interaction — clickable hit area
    if (isUnlocked) {
      const hitArea = this.add.rectangle(x, y, sw + 8, sh + 8, 0xffffff, 0)
        .setInteractive({ useHandCursor: true }).setDepth(9);

      hitArea.on('pointerover', () => {
        g.clear();
        // Redraw with highlight
        g.fillStyle(0xddc050, 0.9);
        g.beginPath();
        g.moveTo(x - sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y + sh / 4);
        g.lineTo(x, y + sh / 2);
        g.lineTo(x - sw / 2, y + sh / 4);
        g.closePath();
        g.fillPath();
        g.lineStyle(2.5, 0xffdd44, 1);
        g.beginPath();
        g.moveTo(x - sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y + sh / 4);
        g.lineTo(x, y + sh / 2);
        g.lineTo(x - sw / 2, y + sh / 4);
        g.closePath();
        g.strokePath();
      });

      hitArea.on('pointerout', () => {
        g.clear();
        // Redraw normal
        g.fillStyle(shieldColor, shieldAlpha);
        g.beginPath();
        g.moveTo(x - sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y + sh / 4);
        g.lineTo(x, y + sh / 2);
        g.lineTo(x - sw / 2, y + sh / 4);
        g.closePath();
        g.fillPath();
        g.lineStyle(2, borderColor, shieldAlpha);
        g.beginPath();
        g.moveTo(x - sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y - sh / 2);
        g.lineTo(x + sw / 2, y + sh / 4);
        g.lineTo(x, y + sh / 2);
        g.lineTo(x - sw / 2, y + sh / 4);
        g.closePath();
        g.strokePath();
        if (isUnlocked) {
          g.lineStyle(1.5, 0xffffff, 0.2);
          g.lineBetween(x, y - sh / 2, x, y + sh / 4);
          g.lineBetween(x - sw / 2, y - 4, x + sw / 2, y - 4);
        }
      });

      hitArea.on('pointerdown', () => {
        this.scene.start('ForestStage', {
          heroClass: this.stageData.heroClass,
          user: this.stageData.user,
          characterId: this.stageData.characterId,
          gold: this.stageData.gold,
          level: this.stageData.level,
          currentXp: this.stageData.currentXp,
          stageIndex: stageIndex,
          highestStage: this.stageData.currentStage, // preserve highest unlocked
          progression: this.stageData.progression,
        });
      });
    }
  }

  // =========================================================================
  // DECORATIVE BORDER
  // =========================================================================
  private drawBorder(w: number, h: number): void {
    const g = this.add.graphics().setDepth(10);
    const t = 8; // border thickness

    // Outer frame
    g.lineStyle(t, 0x6a5030, 0.8);
    g.strokeRect(t / 2, t / 2, w - t, h - t);

    // Inner frame line
    g.lineStyle(2, 0x8a7050, 0.5);
    g.strokeRect(t + 4, t + 4, w - t * 2 - 8, h - t * 2 - 8);

    // Corner ornaments
    const cornerSize = 20;
    for (const [cx, cy] of [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]]) {
      g.fillStyle(0x6a5030, 0.8);
      g.fillCircle(cx, cy, cornerSize / 2);
      g.fillStyle(0x8a7050, 0.6);
      g.fillCircle(cx, cy, cornerSize / 3);
    }
  }

  // =========================================================================
  // BOTTOM BUTTONS
  // =========================================================================
  private createBottomButtons(): void {
    // Back button — parchment style
    const backG = this.add.graphics().setDepth(10);
    backG.fillStyle(0xb0a080, 0.9);
    backG.fillRoundedRect(30, 660, 120, 40, 6);
    backG.lineStyle(2, 0x6a5030, 0.8);
    backG.strokeRoundedRect(30, 660, 120, 40, 6);
    this.add.text(90, 680, 'BACK', {
      fontSize: '15px', color: '#4a3520', fontFamily: 'serif',
    }).setOrigin(0.5).setDepth(11);
    const backHit = this.add.rectangle(90, 680, 120, 40, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(12);
    backHit.on('pointerover', () => { backG.clear(); backG.fillStyle(0xc8b890, 1); backG.fillRoundedRect(30, 660, 120, 40, 6); backG.lineStyle(2, 0x6a5030, 1); backG.strokeRoundedRect(30, 660, 120, 40, 6); });
    backHit.on('pointerout', () => { backG.clear(); backG.fillStyle(0xb0a080, 0.9); backG.fillRoundedRect(30, 660, 120, 40, 6); backG.lineStyle(2, 0x6a5030, 0.8); backG.strokeRoundedRect(30, 660, 120, 40, 6); });
    backHit.on('pointerdown', () => this.scene.start('StartScreen'));

    // Shop button
    const shopG = this.add.graphics().setDepth(10);
    shopG.fillStyle(0xb0a080, 0.9);
    shopG.fillRoundedRect(170, 660, 150, 40, 6);
    shopG.lineStyle(2, 0x6a5030, 0.8);
    shopG.strokeRoundedRect(170, 660, 150, 40, 6);
    this.add.text(245, 680, 'SHOP / STATS', {
      fontSize: '13px', color: '#4a3520', fontFamily: 'serif',
    }).setOrigin(0.5).setDepth(11);
    const shopHit = this.add.rectangle(245, 680, 150, 40, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(12);
    shopHit.on('pointerover', () => { shopG.clear(); shopG.fillStyle(0xc8b890, 1); shopG.fillRoundedRect(170, 660, 150, 40, 6); shopG.lineStyle(2, 0x6a5030, 1); shopG.strokeRoundedRect(170, 660, 150, 40, 6); });
    shopHit.on('pointerout', () => { shopG.clear(); shopG.fillStyle(0xb0a080, 0.9); shopG.fillRoundedRect(170, 660, 150, 40, 6); shopG.lineStyle(2, 0x6a5030, 0.8); shopG.strokeRoundedRect(170, 660, 150, 40, 6); });
    shopHit.on('pointerdown', () => {
      this.scene.start('Shop', {
        heroClass: this.stageData.heroClass,
        user: this.stageData.user,
        characterId: this.stageData.characterId,
        gold: this.stageData.gold,
        level: this.stageData.level,
        currentXp: this.stageData.currentXp,
        stageIndex: this.stageData.currentStage,
        progression: this.stageData.progression,
        fromStageSelect: true,
      });
    });
  }
}
