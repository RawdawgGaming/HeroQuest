import Phaser from 'phaser';
import { HERO_CLASSES, HeroClassDef } from '../data/heroClasses';
import type { User } from '@supabase/supabase-js';

export class HeroSelect extends Phaser.Scene {
  private user!: User;
  private selectedIndex = 0;
  private heroCards: Phaser.GameObjects.Container[] = [];
  private statTexts!: {
    name: Phaser.GameObjects.Text;
    desc: Phaser.GameObjects.Text;
    hp: Phaser.GameObjects.Text;
    atk: Phaser.GameObjects.Text;
    def: Phaser.GameObjects.Text;
    spd: Phaser.GameObjects.Text;
    hpBar: Phaser.GameObjects.Rectangle;
    atkBar: Phaser.GameObjects.Rectangle;
    defBar: Phaser.GameObjects.Rectangle;
    spdBar: Phaser.GameObjects.Rectangle;
  };

  constructor() {
    super('HeroSelect');
  }

  init(data: { user: User }): void {
    this.user = data.user;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111122);

    // Header
    const displayName = this.user.email?.split('@')[0] ?? 'Hero';
    this.add.text(640, 30, `${displayName}'s Quest`, {
      fontSize: '20px',
      color: '#aaaacc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(640, 70, 'CHOOSE YOUR HERO', {
      fontSize: '36px',
      color: '#ffdd44',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Hero cards row
    const startX = 640 - ((HERO_CLASSES.length - 1) * 140) / 2;
    const cardY = 280;

    HERO_CLASSES.forEach((cls, i) => {
      const card = this.createHeroCard(startX + i * 140, cardY, cls, i);
      this.heroCards.push(card);
    });

    // Stats panel (right side area below cards)
    this.createStatsPanel();
    this.updateSelection(0);

    // Play button
    const playBtn = this.add.rectangle(640, 620, 260, 56, 0x33aa55)
      .setInteractive({ useHandCursor: true });
    this.add.text(640, 620, 'NAME YOUR HERO', {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    playBtn.on('pointerover', () => { playBtn.fillColor = 0x44cc66; });
    playBtn.on('pointerout', () => { playBtn.fillColor = 0x33aa55; });
    playBtn.on('pointerdown', () => {
      const selected = HERO_CLASSES[this.selectedIndex];
      this.scene.start('CharacterName', { heroClass: selected, user: this.user });
    });

    // Keyboard nav
    this.input.keyboard!.on('keydown-A', () => this.updateSelection(Math.max(0, this.selectedIndex - 1)));
    this.input.keyboard!.on('keydown-LEFT', () => this.updateSelection(Math.max(0, this.selectedIndex - 1)));
    this.input.keyboard!.on('keydown-D', () => this.updateSelection(Math.min(HERO_CLASSES.length - 1, this.selectedIndex + 1)));
    this.input.keyboard!.on('keydown-RIGHT', () => this.updateSelection(Math.min(HERO_CLASSES.length - 1, this.selectedIndex + 1)));
    this.input.keyboard!.on('keydown-ENTER', () => {
      const selected = HERO_CLASSES[this.selectedIndex];
      this.scene.start('CharacterName', { heroClass: selected, user: this.user });
    });

    // Back button
    const backText = this.add.text(30, 690, '< Back', {
      fontSize: '14px',
      color: '#888899',
      fontFamily: 'monospace',
    })
      .setInteractive({ useHandCursor: true });
    backText.on('pointerover', () => backText.setColor('#ccccdd'));
    backText.on('pointerout', () => backText.setColor('#888899'));
    backText.on('pointerdown', () => this.scene.start('StartScreen'));

    // Instructions
    this.add.text(640, 680, 'A/D or Arrow Keys to browse  |  Click or Enter to select', {
      fontSize: '13px',
      color: '#666688',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private createHeroCard(x: number, y: number, cls: HeroClassDef, index: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Card background
    const bg = this.add.rectangle(0, 0, 120, 200, 0x1a1a2e)
      .setStrokeStyle(2, 0x333355);
    container.add(bg);

    if (cls.id === 'necromancer') {
      // Necromancer-specific card figure
      const shadow = this.add.ellipse(0, 10, 30, 8, 0x114422, 0.4);
      container.add(shadow);
      // Robe
      const robeBot = this.add.rectangle(0, -10, 30, 28, 0x1a1a22);
      container.add(robeBot);
      const robeTop = this.add.rectangle(0, -30, 24, 20, 0x222233);
      container.add(robeTop);
      // Hood
      const hood = this.add.circle(0, -42, 14, 0x111118);
      container.add(hood);
      // Skull
      const skull = this.add.circle(0, -40, 9, 0xccddbb);
      container.add(skull);
      // Eye sockets + green eyes
      const sockL = this.add.circle(-3, -42, 2.5, 0x111111);
      container.add(sockL);
      const sockR = this.add.circle(3, -42, 2.5, 0x111111);
      container.add(sockR);
      const eL = this.add.circle(-3, -42, 1.5, 0x44ff66);
      container.add(eL);
      const eR = this.add.circle(3, -42, 1.5, 0x44ff66);
      container.add(eR);
      this.tweens.add({ targets: [eL, eR], alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
      // Staff
      const staff = this.add.rectangle(16, -28, 3, 40, 0x443322);
      container.add(staff);
      const staffOrb = this.add.circle(16, -48, 5, 0x33ff55, 0.7);
      container.add(staffOrb);
      const staffGlow = this.add.circle(16, -48, 9, 0x22ff44, 0.12);
      container.add(staffGlow);
      this.tweens.add({ targets: staffGlow, scaleX: 1.4, scaleY: 1.4, alpha: 0.04, duration: 1000, yoyo: true, repeat: -1 });
      // Lantern
      const lantern = this.add.rectangle(-14, -26, 6, 8, 0x333333);
      container.add(lantern);
      const lanternG = this.add.circle(-14, -26, 3, 0x44ff88, 0.5);
      container.add(lanternG);
      this.tweens.add({ targets: lanternG, alpha: 0.2, duration: 600, yoyo: true, repeat: -1, delay: 300 });
    } else {
      // Default hero figure
      const body = this.add.rectangle(0, -20, 28, 50, cls.color);
      container.add(body);
      const eye = this.add.rectangle(5, -34, 4, 4, cls.accentColor);
      container.add(eye);
      const shadow = this.add.ellipse(0, 10, 30, 8, 0x000000, 0.3);
      container.add(shadow);
    }

    // Name
    const nameText = this.add.text(0, 55, cls.name, {
      fontSize: '12px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(nameText);

    // Class icon hint
    const iconColor = Phaser.Display.Color.IntegerToColor(cls.color);
    const glow = this.add.circle(0, -55, 8, cls.accentColor, 0.3);
    container.add(glow);

    // Make interactive
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.updateSelection(index);
    });
    bg.on('pointerover', () => {
      if (this.selectedIndex !== index) {
        bg.setStrokeStyle(2, 0x555577);
      }
    });
    bg.on('pointerout', () => {
      if (this.selectedIndex !== index) {
        bg.setStrokeStyle(2, 0x333355);
      }
    });

    // Store reference to bg for selection highlighting
    container.setData('bg', bg);

    return container;
  }

  private createStatsPanel(): void {
    const px = 640;
    const py = 455;

    const name = this.add.text(px, py, '', {
      fontSize: '24px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const desc = this.add.text(px, py + 30, '', {
      fontSize: '13px', color: '#aaaacc', fontFamily: 'monospace',
      wordWrap: { width: 500 },
    }).setOrigin(0.5);

    // Stat bars
    const barStartX = px - 120;
    const barY = py + 65;
    const barW = 140;
    const barH = 12;
    const gap = 24;

    const createStatRow = (label: string, y: number) => {
      this.add.text(barStartX - 10, y, label, {
        fontSize: '12px', color: '#888899', fontFamily: 'monospace',
      }).setOrigin(1, 0.5);
      const bg = this.add.rectangle(barStartX + barW / 2, y, barW, barH, 0x222233);
      const fill = this.add.rectangle(barStartX, y, 0, barH, 0x44cc44).setOrigin(0, 0.5);
      return fill;
    };

    const hpBar = createStatRow('HP', barY);
    const atkBar = createStatRow('ATK', barY + gap);
    const defBar = createStatRow('DEF', barY + gap * 2);
    const spdBar = createStatRow('SPD', barY + gap * 3);

    // Value texts
    const hp = this.add.text(barStartX + barW + 10, barY, '', { fontSize: '12px', color: '#cccccc', fontFamily: 'monospace' }).setOrigin(0, 0.5);
    const atk = this.add.text(barStartX + barW + 10, barY + gap, '', { fontSize: '12px', color: '#cccccc', fontFamily: 'monospace' }).setOrigin(0, 0.5);
    const def = this.add.text(barStartX + barW + 10, barY + gap * 2, '', { fontSize: '12px', color: '#cccccc', fontFamily: 'monospace' }).setOrigin(0, 0.5);
    const spd = this.add.text(barStartX + barW + 10, barY + gap * 3, '', { fontSize: '12px', color: '#cccccc', fontFamily: 'monospace' }).setOrigin(0, 0.5);

    this.statTexts = { name, desc, hp, atk, def, spd, hpBar, atkBar, defBar, spdBar };
  }

  private updateSelection(index: number): void {
    const prev = this.selectedIndex;
    this.selectedIndex = index;
    const cls = HERO_CLASSES[index];

    // Update card highlights
    this.heroCards.forEach((card, i) => {
      const bg = card.getData('bg') as Phaser.GameObjects.Rectangle;
      if (i === index) {
        bg.setStrokeStyle(3, 0xffdd44);
        this.tweens.add({ targets: card, scaleX: 1.08, scaleY: 1.08, duration: 150 });
      } else {
        bg.setStrokeStyle(2, 0x333355);
        this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 150 });
      }
    });

    // Update stat panel
    this.statTexts.name.setText(cls.name);
    this.statTexts.desc.setText(cls.description);

    // Max values for bar normalization
    const maxHP = 140, maxATK = 18, maxDEF = 10, maxSPD = 240;
    const barW = 140;

    this.animateBar(this.statTexts.hpBar, (cls.stats.maxHealth / maxHP) * barW, 0x44cc44);
    this.animateBar(this.statTexts.atkBar, (cls.stats.attackPower / maxATK) * barW, 0xcc4444);
    this.animateBar(this.statTexts.defBar, (cls.stats.defense / maxDEF) * barW, 0x4488cc);
    this.animateBar(this.statTexts.spdBar, (cls.stats.moveSpeed / maxSPD) * barW, 0xccaa44);

    this.statTexts.hp.setText(`${cls.stats.maxHealth}`);
    this.statTexts.atk.setText(`${cls.stats.attackPower}`);
    this.statTexts.def.setText(`${cls.stats.defense}`);
    this.statTexts.spd.setText(`${cls.stats.moveSpeed}`);
  }

  private animateBar(bar: Phaser.GameObjects.Rectangle, targetWidth: number, color: number): void {
    bar.fillColor = color;
    this.tweens.add({
      targets: bar,
      width: targetWidth,
      duration: 200,
      ease: 'Quad.easeOut',
    });
  }
}
