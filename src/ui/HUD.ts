import Phaser from 'phaser';
import { EventBus, Events } from '../systems/EventBus';
import { TextureKeys } from '../visuals/textures';

export class HUD {
  private scene: Phaser.Scene;

  // Health bar (artwork layers)
  private hpBottom!: Phaser.GameObjects.Image;
  private hpFillImg!: Phaser.GameObjects.Image;
  private hpTop!: Phaser.GameObjects.Image;
  private hpFillFullW = 0;  // original texture width for crop calculation
  private hpFillFullH = 0;
  private hpPct = 1;        // tweened HP percentage for smooth animation
  private healthText: Phaser.GameObjects.Text;

  // XP bar
  private xpBarBg: Phaser.GameObjects.Rectangle;
  private xpBarFill: Phaser.GameObjects.Rectangle;
  private levelText: Phaser.GameObjects.Text;
  private xpText: Phaser.GameObjects.Text;

  // Ultimate bar
  private ultBarBg!: Phaser.GameObjects.Rectangle;
  private ultBarFill!: Phaser.GameObjects.Rectangle;
  private ultText!: Phaser.GameObjects.Text;
  private ultLabel!: Phaser.GameObjects.Text;

  // Skill icons (radial cooldown circles)
  private skillIcons = new Map<string, {
    bg: Phaser.GameObjects.Arc;
    overlay: Phaser.GameObjects.Graphics;
    keyText: Phaser.GameObjects.Text;
    label: Phaser.GameObjects.Text;
    radius: number;
    color: number;
    centerX: number;
    centerY: number;
  }>();

  // Other
  private goldText: Phaser.GameObjects.Text;
  private stageCompleteText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private levelUpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const D = 100; // base depth for HUD

    // --- Health bar (3-layer artwork, pre-sized 400x53) ---
    const hpX = 220;       // center X of the HP bar
    const hpY = 30;        // center Y

    // Layer 1: Bottom shell (dark background frame)
    this.hpBottom = scene.add.image(hpX, hpY, TextureKeys.HUD_HP_BOTTOM)
      .setScrollFactor(0).setDepth(D);

    // Layer 2: Fill (red HP energy — cropped based on HP%)
    // Origin (0, 0.5) so left edge stays anchored when cropping from right
    const fillTexW = scene.textures.get(TextureKeys.HUD_HP_FILL).getSourceImage().width;
    const fillDisplayW = fillTexW; // no scaling, 1:1
    this.hpFillImg = scene.add.image(hpX - fillDisplayW / 2, hpY, TextureKeys.HUD_HP_FILL)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 1);
    // Store original texture dimensions for crop math
    this.hpFillFullW = this.hpFillImg.texture.getSourceImage().width;
    this.hpFillFullH = this.hpFillImg.texture.getSourceImage().height;

    // Layer 3: Top shell (ornate gold frame overlay)
    this.hpTop = scene.add.image(hpX, hpY, TextureKeys.HUD_HP_TOP)
      .setScrollFactor(0).setDepth(D + 2);

    // HP text (on top of all layers)
    this.healthText = scene.add.text(hpX, hpY, '100 / 100', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3);

    // HP label
    scene.add.text(hpX - this.hpBottom.displayWidth / 2 + 18, hpY, 'HP', {
      fontSize: '13px', color: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3);

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

    // --- Ultimate bar (right of XP) ---
    const ultX = 720;
    const ultW = 180;
    this.ultLabel = scene.add.text(ultX - 18, 25, 'ULT', {
      fontSize: '11px', color: '#aa66cc', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D);
    this.ultBarBg = scene.add.rectangle(ultX + ultW / 2, 25, ultW, 20, 0x331144)
      .setScrollFactor(0).setDepth(D);
    this.ultBarFill = scene.add.rectangle(ultX, 25, 0, 20, 0xaa44ff)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 1);
    this.ultText = scene.add.text(ultX + ultW / 2, 25, '0 / 20', {
      fontSize: '11px', color: '#eeccff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);

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

    // Skill icons and control hints are now built by ForestStage via setupSkillUI
    // (so they can be conditioned on skill ownership)

    // Listen to events
    EventBus.on(Events.HERO_HEALTH_CHANGED, this.onHealthChanged, this);
    EventBus.on(Events.HERO_GOLD_CHANGED, this.onGoldChanged, this);
    EventBus.on(Events.HERO_XP_CHANGED, this.onXpChanged, this);
    EventBus.on(Events.HERO_ULTIMATE_CHANGED, this.onUltimateChanged, this);
    EventBus.on(Events.HERO_LEVELED_UP, this.onLeveledUp, this);
    EventBus.on(Events.WAVE_STARTED, this.onWaveStarted, this);
    EventBus.on(Events.WAVE_CLEARED, this.onWaveCleared, this);
    EventBus.on(Events.STAGE_COMPLETED, this.onStageCompleted, this);
  }

  private onHealthChanged = (current: number, max: number): void => {
    const pct = Phaser.Math.Clamp(max > 0 ? current / max : 0, 0, 1);
    this.healthText.setText(`${current} / ${max}`);

    // Smooth tween the crop percentage
    this.scene.tweens.add({
      targets: this,
      hpPct: pct,
      duration: 250,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const w = Math.round(this.hpFillFullW * this.hpPct);
        this.hpFillImg.setCrop(0, 0, w, this.hpFillFullH);
      },
    });
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

  private onUltimateChanged = (current: number, max: number, ready: boolean): void => {
    const pct = Math.min(current / max, 1);
    const barW = 180;
    this.ultBarFill.width = barW * pct;
    this.ultText.setText(ready ? 'READY!' : `${current} / ${max}`);

    if (ready) {
      this.ultBarFill.fillColor = 0xff44ff;
      this.ultText.setColor('#ffddff');
      this.ultLabel.setColor('#ff66ff');
      // Pulse glow
      if (!this.ultBarFill.getData('pulsing')) {
        this.ultBarFill.setData('pulsing', true);
        this.scene.tweens.add({
          targets: this.ultBarFill,
          alpha: 0.6,
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      this.ultBarFill.fillColor = 0xaa44ff;
      this.ultText.setColor('#eeccff');
      this.ultLabel.setColor('#aa66cc');
      this.ultBarFill.alpha = 1;
      if (this.ultBarFill.getData('pulsing')) {
        this.scene.tweens.killTweensOf(this.ultBarFill);
        this.ultBarFill.setData('pulsing', false);
      }
    }
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

  /** Build skill icons for the skills the player has unlocked. */
  setupSkillUI(scene: Phaser.Scene, ownedSkills: Set<string>, ultimateUnlocked: boolean, classId: string = 'necromancer'): void {
    this.buildSkillIcons(scene, ownedSkills, ultimateUnlocked, classId);
    this.buildControlHints(scene, ownedSkills, ultimateUnlocked, classId);
  }

  /** Returns the per-class skill slot mapping (id, key, name, color). */
  static getClassSkillSlots(classId: string): Array<{ id: string; key: string; name: string; color: number }> {
    switch (classId) {
      case 'paladin': return [
        { id: 'smite',           key: 'K', name: 'Smite',    color: 0xffeeaa },
        { id: 'consecration',    key: 'L', name: 'Conse.',   color: 0xffcc66 },
        { id: 'aegisEternal',    key: ';', name: 'Aegis',    color: 0xffffcc },
        { id: 'layOnHands',      key: 'U', name: 'Heal',     color: 0xaaffaa },
        { id: 'crusadersCharge', key: 'I', name: 'Charge',   color: 0xffbb44 },
        { id: 'ultimate',        key: 'O', name: 'Ultimate', color: 0xffeebb },
        { id: 'divineWrath',     key: 'P', name: 'Wrath',    color: 0xff8844 },
      ];
      case 'barbarian': return [
        { id: 'cleave',          key: 'K', name: 'Cleave',   color: 0xff6644 },
        { id: 'whirlwind',       key: 'L', name: 'Whirl',    color: 0xff4422 },
        { id: 'berserkerRage',   key: ';', name: 'Rage',     color: 0xff2200 },
        { id: 'bloodthirst',     key: 'U', name: 'Blood',    color: 0xcc2233 },
        { id: 'earthshaker',     key: 'I', name: 'Quake',    color: 0xaa6644 },
        { id: 'ultimate',        key: 'O', name: 'Ultimate', color: 0xff5522 },
        { id: 'decimate',        key: 'P', name: 'Decim.',   color: 0xff8866 },
      ];
      case 'templar_knight': return [
        { id: 'powerStrike',     key: 'K', name: 'Strike',   color: 0xddddff },
        { id: 'sanctuary',       key: 'L', name: 'Sanct.',   color: 0xaaccff },
        { id: 'divineAegis',     key: ';', name: 'Aegis',    color: 0xeeeeff },
        { id: 'magicBolt',       key: 'U', name: 'Bolt',     color: 0x6699ff },
        { id: 'mysticSlash',     key: 'I', name: 'Slash',    color: 0x99bbff },
        { id: 'ultimate',        key: 'O', name: 'Ultimate', color: 0x66aaff },
        { id: 'templarsWrath',   key: 'P', name: 'Wrath',    color: 0xccddff },
      ];
      case 'mage': return [
        { id: 'frostbolt',       key: 'K', name: 'Frost',    color: 0x66ccff },
        { id: 'fireball',        key: 'L', name: 'Fire',     color: 0xff6633 },
        { id: 'arcaneShield',    key: ';', name: 'Shield',   color: 0xaa66ff },
        { id: 'lightningStorm',  key: 'U', name: 'Storm',    color: 0xffff66 },
        { id: 'timeWarp',        key: 'I', name: 'Time',     color: 0x66ffcc },
        { id: 'ultimate',        key: 'O', name: 'Ultimate', color: 0xaa66ff },
        { id: 'meteorStrike',    key: 'P', name: 'Meteor',   color: 0xff9966 },
      ];
      case 'archer': return [
        { id: 'multishot',       key: 'K', name: 'Multi',    color: 0xeeddaa },
        { id: 'pinDown',         key: 'L', name: 'Pin',      color: 0xccaa66 },
        { id: 'phantomStep',     key: ';', name: 'Phantom',  color: 0x66ff99 },
        { id: 'eagleEye',        key: 'U', name: 'Eye',      color: 0xffcc66 },
        { id: 'rainOfArrows',    key: 'I', name: 'Rain',     color: 0xddccaa },
        { id: 'ultimate',        key: 'O', name: 'Ultimate', color: 0x66ff99 },
        { id: 'mastersVolley',   key: 'P', name: 'Volley',   color: 0xffeebb },
      ];
      default: return [
        { id: 'boneVolley',     key: 'K', name: 'Volley',  color: 0xeeeecc },
        { id: 'rot',            key: 'L', name: 'Rot',     color: 0x33cc44 },
        { id: 'wraithForm',     key: ';', name: 'Wraith',  color: 0x9944dd },
        { id: 'summonGhoul',    key: 'U', name: 'Summon',  color: 0x44ff66 },
        { id: 'lifeLeech',      key: 'I', name: 'Leech',   color: 0xff3366 },
        { id: 'ultimate',       key: 'O', name: 'Ultimate',color: 0xaa44ff },
        { id: 'soulApocalypse', key: 'P', name: 'Apoc',    color: 0xff44ff },
      ];
    }
  }

  private buildSkillIcons(scene: Phaser.Scene, ownedSkills: Set<string>, ultimateUnlocked: boolean, classId: string): void {
    const Z = 10000;
    const y = 68;
    const radius = 15;
    const slotW = 112;
    const allSkills = HUD.getClassSkillSlots(classId);

    // Filter to only owned skills
    const skills = allSkills.filter(s => {
      if (s.id === 'ultimate') return ultimateUnlocked;
      return ownedSkills.has(s.id);
    });

    if (skills.length === 0) return;

    // Center the entire row horizontally around x=640
    const totalW = skills.length * slotW;
    const startX = 640 - totalW / 2 + slotW / 2;

    // Faint background bar behind the skill row so it reads clearly against gameplay
    scene.add.rectangle(640, y, totalW + 20, 42, 0x0a0a14, 0.55)
      .setStrokeStyle(1, 0x333355, 0.8)
      .setScrollFactor(0).setDepth(Z - 1);

    skills.forEach((skill, i) => {
      const slotCenterX = startX + i * slotW;
      // Circle is on the LEFT of each slot, label on the RIGHT
      const cx = slotCenterX - slotW / 2 + radius + 6;

      // Background circle
      scene.add.circle(cx, y, radius, 0x111122, 0.95)
        .setStrokeStyle(2, 0x666688)
        .setScrollFactor(0).setDepth(Z);

      // Inner colored circle
      const inner = scene.add.circle(cx, y, radius - 3, skill.color, 0.45)
        .setScrollFactor(0).setDepth(Z + 1);

      // Cooldown overlay (drawn on top, fills as cooldown ticks down)
      const overlay = scene.add.graphics()
        .setScrollFactor(0).setDepth(Z + 2);

      // Key letter inside the circle
      const keyText = scene.add.text(cx, y, skill.key, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(Z + 3);

      // Skill name label to the RIGHT of the circle
      const labelX = cx + radius + 6;
      const label = scene.add.text(labelX, y, skill.name, {
        fontSize: '12px', color: '#ddddee', fontFamily: 'monospace',
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(Z + 3);

      this.skillIcons.set(skill.id, {
        bg: inner,
        overlay,
        keyText,
        label,
        radius,
        color: skill.color,
        centerX: cx,
        centerY: y,
      });
    });
  }

  /** Set cooldown progress for a skill icon. progress 0..1 (1=full cooldown, 0=ready). */
  setSkillCooldown(skillId: string, progress: number): void {
    const icon = this.skillIcons.get(skillId);
    if (!icon) return;

    icon.overlay.clear();
    if (progress > 0) {
      // Draw a dark filled pie covering the remaining cooldown
      icon.overlay.fillStyle(0x000000, 0.7);
      icon.overlay.beginPath();
      icon.overlay.moveTo(icon.centerX, icon.centerY);
      const startAngle = -Math.PI / 2; // start at top
      const endAngle = startAngle + Math.PI * 2 * progress;
      icon.overlay.arc(icon.centerX, icon.centerY, icon.radius - 2, startAngle, endAngle, false);
      icon.overlay.closePath();
      icon.overlay.fillPath();
      icon.bg.fillAlpha = 0.2;
    } else {
      icon.bg.fillAlpha = 0.4;
    }
  }

  /** Mark a skill as ready/active for visual feedback */
  setSkillReady(skillId: string, ready: boolean): void {
    const icon = this.skillIcons.get(skillId);
    if (!icon) return;
    icon.bg.fillAlpha = ready ? 0.7 : 0.4;
  }

  private buildControlHints(scene: Phaser.Scene, ownedSkills: Set<string>, ultimateUnlocked: boolean, classId: string): void {
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

    // --- J (Attack) — always shown ---
    let cursor = 350;
    drawKey(cursor, baseY, 'J');
    drawLabel(cursor + 20, baseY, 'Attack');
    cursor += 110;

    // Render the class-specific skill slots
    const slots = HUD.getClassSkillSlots(classId);
    for (const slot of slots) {
      const isOwned = slot.id === 'ultimate' ? ultimateUnlocked : ownedSkills.has(slot.id);
      if (!isOwned) continue;
      drawKey(cursor, baseY, slot.key);
      drawLabel(cursor + 20, baseY, slot.name);
      cursor += slot.name.length * 7 + 50;
    }

    // --- ESC (Pause) — always shown ---
    drawKey(cursor, baseY, 'ESC', 40);
    drawLabel(cursor + 26, baseY, 'Pause');
  }

  destroy(): void {
    EventBus.off(Events.HERO_HEALTH_CHANGED, this.onHealthChanged, this);
    EventBus.off(Events.HERO_GOLD_CHANGED, this.onGoldChanged, this);
    EventBus.off(Events.HERO_XP_CHANGED, this.onXpChanged, this);
    EventBus.off(Events.HERO_ULTIMATE_CHANGED, this.onUltimateChanged, this);
    EventBus.off(Events.HERO_LEVELED_UP, this.onLeveledUp, this);
    EventBus.off(Events.WAVE_STARTED, this.onWaveStarted, this);
    EventBus.off(Events.WAVE_CLEARED, this.onWaveCleared, this);
    EventBus.off(Events.STAGE_COMPLETED, this.onStageCompleted, this);
  }
}
