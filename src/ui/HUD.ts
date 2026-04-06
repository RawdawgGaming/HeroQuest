import Phaser from 'phaser';
import { EventBus, Events } from '../systems/EventBus';

export class HUD {
  private scene: Phaser.Scene;

  // Health bar
  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;

  // XP bar
  private xpBarBg: Phaser.GameObjects.Rectangle;
  private xpBarFill: Phaser.GameObjects.Rectangle;
  private levelText: Phaser.GameObjects.Text;
  private xpText: Phaser.GameObjects.Text;

  // Other
  private goldText: Phaser.GameObjects.Text;
  private stageCompleteText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private levelUpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const D = 100; // base depth for HUD

    // --- Health bar ---
    this.healthBarBg = scene.add.rectangle(145, 25, 250, 20, 0x333333)
      .setScrollFactor(0).setDepth(D);
    this.healthBarFill = scene.add.rectangle(145, 25, 250, 20, 0x44cc44)
      .setScrollFactor(0).setDepth(D + 1);
    this.healthText = scene.add.text(145, 25, '100 / 100', {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);

    // HP label
    scene.add.text(18, 25, 'HP', {
      fontSize: '12px', color: '#88aa88', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D);

    // --- XP bar (right next to HP bar) ---
    const xpX = 420; // start x for XP bar
    const xpW = 200;

    // Level badge
    this.levelText = scene.add.text(xpX - 40, 25, 'Lv.1', {
      fontSize: '14px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);

    this.xpBarBg = scene.add.rectangle(xpX + xpW / 2, 25, xpW, 20, 0x333333)
      .setScrollFactor(0).setDepth(D);
    this.xpBarFill = scene.add.rectangle(xpX, 25, 0, 20, 0x5588dd)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 1);
    this.xpText = scene.add.text(xpX + xpW / 2, 25, '0 / 70', {
      fontSize: '11px', color: '#ccccee', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);

    // XP label
    scene.add.text(xpX - 14, 25, 'XP', {
      fontSize: '12px', color: '#7799bb', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D);

    // --- Gold ---
    this.goldText = scene.add.text(20, 50, 'Gold: 0', {
      fontSize: '14px', color: '#ffdd44', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(D);

    // --- Wave text ---
    this.waveText = scene.add.text(640, 50, '', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D).setAlpha(0);

    // --- Level up text ---
    this.levelUpText = scene.add.text(640, 100, '', {
      fontSize: '28px', color: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 10).setAlpha(0);

    // --- Stage complete ---
    this.stageCompleteText = scene.add.text(640, 300, 'STAGE COMPLETE!', {
      fontSize: '48px', color: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

    // --- Control indicators (bottom of screen) ---
    this.buildControlHints(scene, D);

    // Listen to events
    EventBus.on(Events.HERO_HEALTH_CHANGED, this.onHealthChanged, this);
    EventBus.on(Events.HERO_GOLD_CHANGED, this.onGoldChanged, this);
    EventBus.on(Events.HERO_XP_CHANGED, this.onXpChanged, this);
    EventBus.on(Events.HERO_LEVELED_UP, this.onLeveledUp, this);
    EventBus.on(Events.WAVE_STARTED, this.onWaveStarted, this);
    EventBus.on(Events.WAVE_CLEARED, this.onWaveCleared, this);
    EventBus.on(Events.STAGE_COMPLETED, this.onStageCompleted, this);
  }

  private onHealthChanged = (current: number, max: number): void => {
    const pct = current / max;
    this.healthBarFill.width = 250 * pct;
    this.healthBarFill.x = 20 + (250 * pct) / 2;
    this.healthText.setText(`${current} / ${max}`);

    if (pct > 0.5) this.healthBarFill.fillColor = 0x44cc44;
    else if (pct > 0.25) this.healthBarFill.fillColor = 0xccaa22;
    else this.healthBarFill.fillColor = 0xcc3333;
  };

  private onGoldChanged = (total: number): void => {
    this.goldText.setText(`Gold: ${total}`);
  };

  private onXpChanged = (currentXp: number, xpToNext: number, level: number): void => {
    const pct = currentXp / xpToNext;
    const barW = 200;
    this.xpBarFill.width = barW * pct;
    this.xpText.setText(`${currentXp} / ${xpToNext}`);
    this.levelText.setText(`Lv.${level}`);
  };

  private onLeveledUp = (newLevel: number): void => {
    this.levelUpText.setText(`LEVEL ${newLevel}!`);
    this.levelUpText.setAlpha(1);
    this.levelUpText.setScale(0.5);
    this.scene.tweens.add({
      targets: this.levelUpText,
      scaleX: 1.2, scaleY: 1.2,
      duration: 300,
      ease: 'Back.easeOut',
      yoyo: false,
    });
    this.scene.tweens.add({
      targets: this.levelUpText,
      alpha: 0,
      duration: 800,
      delay: 1500,
    });

    // Flash the XP bar gold briefly
    this.xpBarFill.fillColor = 0xffdd44;
    this.scene.time.delayedCall(400, () => {
      this.xpBarFill.fillColor = 0x5588dd;
    });
  };

  private onWaveStarted = (index: number): void => {
    this.waveText.setText(`Wave ${index + 1}`);
    this.waveText.setAlpha(1);
    this.scene.tweens.add({ targets: this.waveText, alpha: 0, duration: 2000, delay: 1000 });
  };

  private onWaveCleared = (_index: number): void => {
    this.waveText.setText('Wave Cleared!');
    this.waveText.setAlpha(1);
    this.scene.tweens.add({ targets: this.waveText, alpha: 0, duration: 2000, delay: 1000 });
  };

  private onStageCompleted = (): void => {
    this.stageCompleteText.setVisible(true);
    this.scene.tweens.add({
      targets: this.stageCompleteText,
      scaleX: 1.1, scaleY: 1.1, duration: 500, yoyo: true, repeat: 2,
      onComplete: () => {
        this.stageCompleteText.setScale(1);
        this.showStageEndButtons();
      },
    });
  };

  private showStageEndButtons(): void {
    const cx = 640;
    const btnY = 400;

    // Shop button
    const shopBtn = this.scene.add.rectangle(cx - 100, btnY, 160, 50, 0xccaa22)
      .setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    const shopText = this.scene.add.text(cx - 100, btnY, 'SHOP/STATS', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

    shopBtn.on('pointerover', () => { shopBtn.fillColor = 0xddbb33; });
    shopBtn.on('pointerout', () => { shopBtn.fillColor = 0xccaa22; });
    shopBtn.on('pointerdown', () => {
      EventBus.emit('stage_end_choice', 'shop');
    });

    // Continue button
    const contBtn = this.scene.add.rectangle(cx + 100, btnY, 160, 50, 0x33aa55)
      .setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    const contText = this.scene.add.text(cx + 100, btnY, 'CONTINUE', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

    contBtn.on('pointerover', () => { contBtn.fillColor = 0x44cc66; });
    contBtn.on('pointerout', () => { contBtn.fillColor = 0x33aa55; });
    contBtn.on('pointerdown', () => {
      EventBus.emit('stage_end_choice', 'continue');
    });

    // Fade in
    shopBtn.setAlpha(0); shopText.setAlpha(0);
    contBtn.setAlpha(0); contText.setAlpha(0);
    this.scene.tweens.add({ targets: [shopBtn, shopText, contBtn, contText], alpha: 1, duration: 400 });
  }

  private buildControlHints(scene: Phaser.Scene, _D: number): void {
    const ks = 26;   // key size
    const g = 4;     // gap between keys
    const Z = 10000; // above everything including foreground dirt

    const drawKey = (x: number, y: number, label: string, w?: number): void => {
      const kw = w ?? ks;
      // Shadow
      scene.add.rectangle(x + 1, y + 2, kw, ks, 0x000000, 0.3)
        .setScrollFactor(0).setDepth(Z);
      // Key body
      scene.add.rectangle(x, y, kw, ks, 0x1a1a2e)
        .setStrokeStyle(2, 0x555577)
        .setScrollFactor(0).setDepth(Z + 1);
      // Top highlight
      scene.add.rectangle(x, y - ks / 2 + 3, kw - 6, 2, 0x666688)
        .setScrollFactor(0).setDepth(Z + 2).setAlpha(0.5);
      // Label
      scene.add.text(x, y + 1, label, {
        fontSize: kw > ks ? '9px' : '12px', color: '#ddddee', fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(Z + 3);
    };

    const drawLabel = (x: number, y: number, label: string): void => {
      scene.add.text(x, y, label, {
        fontSize: '11px', color: '#8888aa', fontFamily: 'monospace',
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(Z + 1);
    };

    // Dark background bar at the very bottom
    scene.add.rectangle(640, 700, 1280, 44, 0x0a0a14, 0.85)
      .setScrollFactor(0).setDepth(Z - 1);

    const baseY = 700;

    // --- WASD cluster ---
    const wx = 50;
    drawKey(wx, baseY - ks - g, 'W');
    drawKey(wx - ks - g, baseY, 'A');
    drawKey(wx, baseY, 'S');
    drawKey(wx + ks + g, baseY, 'D');
    drawLabel(wx + ks * 2, baseY - ks / 2, 'Move');

    // --- SPACE ---
    const spaceX = 230;
    drawKey(spaceX, baseY, 'SPC', 44);
    drawLabel(spaceX + 28, baseY, 'Jump');

    // --- J (Attack) ---
    const jX = 350;
    drawKey(jX, baseY, 'J');
    drawLabel(jX + 20, baseY, 'Attack');

    // --- U (Summon) ---
    const uX = 460;
    drawKey(uX, baseY, 'U');
    drawLabel(uX + 20, baseY, 'Summon');

    // --- I (Rot) ---
    const iX = 570;
    drawKey(iX, baseY, 'I');
    drawLabel(iX + 20, baseY, 'Rot');

    // --- ESC (Pause) ---
    const escX = 670;
    drawKey(escX, baseY, 'ESC', 40);
    drawLabel(escX + 26, baseY, 'Pause');
  }

  destroy(): void {
    EventBus.off(Events.HERO_HEALTH_CHANGED, this.onHealthChanged, this);
    EventBus.off(Events.HERO_GOLD_CHANGED, this.onGoldChanged, this);
    EventBus.off(Events.HERO_XP_CHANGED, this.onXpChanged, this);
    EventBus.off(Events.HERO_LEVELED_UP, this.onLeveledUp, this);
    EventBus.off(Events.WAVE_STARTED, this.onWaveStarted, this);
    EventBus.off(Events.WAVE_CLEARED, this.onWaveCleared, this);
    EventBus.off(Events.STAGE_COMPLETED, this.onStageCompleted, this);
  }
}
