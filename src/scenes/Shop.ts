import Phaser from 'phaser';
import type { HeroClassDef } from '../data/heroClasses';
import type { User } from '@supabase/supabase-js';
import { CharacterProgression, getClassAttributes, getClassSkills } from '../systems/CharacterProgression';
import { getClassWeapons } from '../data/weapons';
import { drawWeaponIcon } from '../data/weaponIcons';
import { SIDEKICKS, getSidekickById, sidekickXpForLevel, SIDEKICK_MAX_LEVEL } from '../data/sidekicks';
import { saveCharacter } from '../services/supabase';

interface ShopData {
  heroClass: HeroClassDef;
  user?: User;
  characterId?: string;
  gold: number;
  level: number;
  currentXp: number;
  stageIndex?: number;
  progression?: CharacterProgression;
  returnToStage?: boolean;  // if true, Continue goes back to same stage
  fromMainMenu?: boolean;   // if true, Continue goes to main menu
  fromStageSelect?: boolean; // if true, Continue goes to stage select
}

export class Shop extends Phaser.Scene {
  private shopData!: ShopData;
  private prog!: CharacterProgression;
  private activeTab: 'shop' | 'stats' | 'equips' | 'sidekicks' = 'stats';

  // Dynamic elements that need refreshing
  private contentGroup!: Phaser.GameObjects.Group;
  private goldText!: Phaser.GameObjects.Text;
  private tabShopBg!: Phaser.GameObjects.Rectangle;
  private tabStatsBg!: Phaser.GameObjects.Rectangle;
  private tabEquipsBg!: Phaser.GameObjects.Rectangle;
  private tabSidekicksBg!: Phaser.GameObjects.Rectangle;

  // Scrolling state for the weapons list
  private weaponsContainer: Phaser.GameObjects.Container | null = null;
  private weaponsScrollY = 0;
  private weaponsMaxScroll = 0;
  private weaponsScrollTop = 175;
  private weaponsScrollViewH = 450;
  private weaponsScrollbarFill: Phaser.GameObjects.Rectangle | null = null;
  /** Geometric mask for the weapons scroll viewport — must be destroyed manually since it isn't in contentGroup */
  private weaponsMaskGfx: Phaser.GameObjects.Graphics | null = null;

  /** When set, the sidekicks tab shows the manage sub-view for this sidekick instead of the list */
  private managingSidekickId: string | null = null;

  constructor() {
    super('Shop');
  }

  init(data: ShopData): void {
    this.shopData = data;
    this.prog = data.progression ?? {
      attrPointsAvailable: 0, attributes: {},
      skillPointsAvailable: 0, skills: {},
    };
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111122);
    this.contentGroup = this.add.group();

    // Title
    this.add.text(640, 35, 'SHOP / STATS', {
      fontSize: '32px', color: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Gold + Level display
    this.goldText = this.add.text(640, 70, `Gold: ${this.shopData.gold}   Lv.${this.shopData.level}`, {
      fontSize: '16px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Tabs (4 tabs: STATS, EQUIPS, SIDEKICKS, SHOP)
    const tabW = 130;
    const tabSpacing = 138;
    const tabCenterX = 640;
    const tabXs = [
      tabCenterX - tabSpacing * 1.5,
      tabCenterX - tabSpacing * 0.5,
      tabCenterX + tabSpacing * 0.5,
      tabCenterX + tabSpacing * 1.5,
    ];

    this.tabStatsBg = this.add.rectangle(tabXs[0], 105, tabW, 36, 0x334455)
      .setStrokeStyle(2, 0xffdd44)
      .setInteractive({ useHandCursor: true });
    this.add.text(tabXs[0], 105, 'STATS', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11);

    this.tabEquipsBg = this.add.rectangle(tabXs[1], 105, tabW, 36, 0x222233)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });
    this.add.text(tabXs[1], 105, 'EQUIPS', {
      fontSize: '14px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11);

    this.tabSidekicksBg = this.add.rectangle(tabXs[2], 105, tabW, 36, 0x222233)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });
    this.add.text(tabXs[2], 105, 'SIDEKICKS', {
      fontSize: '13px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11);

    this.tabShopBg = this.add.rectangle(tabXs[3], 105, tabW, 36, 0x222233)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });
    this.add.text(tabXs[3], 105, 'SHOP', {
      fontSize: '14px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11);

    // Ensure tabs stay on top of content for input hit-testing
    this.tabStatsBg.setDepth(10);
    this.tabEquipsBg.setDepth(10);
    this.tabSidekicksBg.setDepth(10);
    this.tabShopBg.setDepth(10);

    this.tabStatsBg.on('pointerdown', () => this.switchTab('stats'));
    this.tabEquipsBg.on('pointerdown', () => this.switchTab('equips'));
    this.tabSidekicksBg.on('pointerdown', () => this.switchTab('sidekicks'));
    this.tabShopBg.on('pointerdown', () => this.switchTab('shop'));

    // Mouse wheel scrolling for the weapons list.
    // Remove any existing handler first so re-entering the scene doesn't stack listeners.
    this.input.removeAllListeners('wheel');
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.activeTab !== 'shop' || !this.weaponsContainer) return;
      this.weaponsScrollY = Phaser.Math.Clamp(
        this.weaponsScrollY + dy * 0.5,
        0,
        this.weaponsMaxScroll,
      );
      this.weaponsContainer.y = this.weaponsScrollTop - this.weaponsScrollY;
      this.updateScrollbar();
    });

    // Clean up persistent state when this scene is shut down or stopped
    this.events.once('shutdown', () => {
      if (this.weaponsMaskGfx) {
        this.weaponsMaskGfx.destroy();
        this.weaponsMaskGfx = null;
      }
      this.weaponsContainer = null;
      this.weaponsScrollbarFill = null;
      this.managingSidekickId = null;
      this.input.removeAllListeners('wheel');
    });

    // Continue / Back button
    const contLabel = this.shopData.fromMainMenu ? 'BACK' : 'CONTINUE';
    const contBtn = this.add.rectangle(640, 660, 260, 50, 0x33aa55)
      .setInteractive({ useHandCursor: true });
    this.add.text(640, 660, contLabel, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    contBtn.on('pointerdown', () => {
      // Auto-save before continuing
      if (this.shopData.characterId) {
        saveCharacter(this.shopData.characterId, {
          level: this.shopData.level,
          gold: this.shopData.gold,
          xp: this.shopData.currentXp,
          current_stage: this.shopData.stageIndex ?? 0,
          progression: this.prog as unknown as Record<string, unknown>,
        });
      }

      if (this.shopData.fromMainMenu || this.shopData.fromStageSelect) {
        // Return to stage select (or main menu for legacy)
        this.scene.start('StageSelect', {
          heroClass: this.shopData.heroClass,
          user: this.shopData.user,
          characterId: this.shopData.characterId,
          gold: this.shopData.gold,
          level: this.shopData.level,
          currentXp: this.shopData.currentXp,
          currentStage: this.shopData.stageIndex ?? 0,
          progression: this.prog,
        });
      } else if (this.shopData.returnToStage) {
        // Return to the same stage (paused mid-stage)
        this.scene.start('ForestStage', {
          heroClass: this.shopData.heroClass,
          user: this.shopData.user,
          characterId: this.shopData.characterId,
          gold: this.shopData.gold,
          level: this.shopData.level,
          currentXp: this.shopData.currentXp,
          stageIndex: this.shopData.stageIndex ?? 0,
          progression: this.prog,
        });
      } else {
        // Go to stage map after shop
        this.scene.start('StageSelect', {
          heroClass: this.shopData.heroClass,
          user: this.shopData.user,
          characterId: this.shopData.characterId,
          gold: this.shopData.gold,
          level: this.shopData.level,
          currentXp: this.shopData.currentXp,
          currentStage: (this.shopData.stageIndex ?? 0) + 1,
          progression: this.prog,
        });
      }
    });

    this.renderContent();
  }

  private switchTab(tab: 'shop' | 'stats' | 'equips' | 'sidekicks'): void {
    this.activeTab = tab;
    // Reset weapons scroll state whenever the user leaves the shop tab.
    // The mask graphics is NOT in contentGroup so we must destroy it manually here.
    if (tab !== 'shop') {
      this.weaponsScrollY = 0;
      this.weaponsContainer = null;
      this.weaponsScrollbarFill = null;
      if (this.weaponsMaskGfx) {
        this.weaponsMaskGfx.destroy();
        this.weaponsMaskGfx = null;
      }
    }
    // Reset sidekick manage view when leaving the sidekicks tab
    if (tab !== 'sidekicks') {
      this.managingSidekickId = null;
    }
    // Reset all tabs to inactive
    this.tabStatsBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    this.tabEquipsBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    this.tabSidekicksBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    this.tabShopBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    // Highlight active
    if (tab === 'stats') this.tabStatsBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
    else if (tab === 'equips') this.tabEquipsBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
    else if (tab === 'sidekicks') this.tabSidekicksBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
    else this.tabShopBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
    this.renderContent();
  }

  private renderContent(): void {
    this.contentGroup.clear(true, true);
    try {
      if (this.activeTab === 'stats') this.renderStats();
      else if (this.activeTab === 'equips') this.renderEquips();
      else if (this.activeTab === 'sidekicks') this.renderSidekicks();
      else this.renderShop();
    } catch (e) {
      // Surface any silent rendering failures so the user/console can see them
      // (instead of leaving the screen "frozen" with a half-rendered state)
      console.error('[Shop] renderContent failed:', e);
      const errMsg = this.add.text(640, 360,
        `Render error on ${this.activeTab} tab.\nCheck the console.`, {
          fontSize: '16px', color: '#ff6666', fontFamily: 'monospace',
          align: 'center',
        }).setOrigin(0.5);
      this.contentGroup.add(errMsg);
    }
  }

  // ==================== STATS TAB ====================

  private renderStats(): void {
    const startY = 145;
    const classId = this.shopData.heroClass.id;
    const attrs = getClassAttributes(classId);
    const skills = getClassSkills(classId);

    // --- Attribute Points ---
    const attrHeader = this.add.text(640, startY, `Attribute Points: ${this.prog.attrPointsAvailable}`, {
      fontSize: '18px', color: '#88ccff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(attrHeader);

    attrs.forEach((attr, i) => {
      const y = startY + 36 + i * 48;
      const currentLvl = this.prog.attributes[attr.id] ?? 0;

      // Background
      const bg = this.add.rectangle(640, y, 550, 42, 0x1a1a2e)
        .setStrokeStyle(1, 0x333355);
      this.contentGroup.add(bg);

      // Name + level
      const nameT = this.add.text(390, y - 10, `${attr.name}`, {
        fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
      });
      this.contentGroup.add(nameT);

      const maxed = currentLvl >= attr.maxPoints;
      const lvlColor = maxed ? '#ffdd44' : '#888899';
      const lvlT = this.add.text(390, y + 8, `${currentLvl} / ${attr.maxPoints}  (${attr.perPoint})${maxed ? '  MAX' : ''}`, {
        fontSize: '11px', color: lvlColor, fontFamily: 'monospace',
      });
      this.contentGroup.add(lvlT);

      // + button (only if points available AND not maxed)
      if (this.prog.attrPointsAvailable > 0 && !maxed) {
        const btn = this.add.rectangle(870, y, 40, 30, 0x33aa55)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(btn);
        const btnT = this.add.text(870, y, '+', {
          fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(btnT);

        btn.on('pointerover', () => btn.fillColor = 0x44cc66);
        btn.on('pointerout', () => btn.fillColor = 0x33aa55);
        btn.on('pointerdown', () => {
          this.prog.attrPointsAvailable--;
          this.prog.attributes[attr.id] = (this.prog.attributes[attr.id] ?? 0) + 1;
          this.renderContent();
        });
      }

      // Current value bar (scaled to max)
      const barW = Math.round((currentLvl / attr.maxPoints) * 200);
      const barColor = maxed ? 0xffdd44 : 0x4488cc;
      const bar = this.add.rectangle(780 - 100, y, barW, 8, barColor).setOrigin(0, 0.5);
      this.contentGroup.add(bar);
    });

    // --- Skill Points ---
    const skillY = startY + 36 + attrs.length * 48 + 8;

    const skillHeader = this.add.text(640, skillY, `Skill Points: ${this.prog.skillPointsAvailable}`, {
      fontSize: '16px', color: '#ffaa44', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(skillHeader);

    // 3-column × 2-row grid of compact skill cards
    const cardW = 290;
    const cardH = 92;
    const colXs = [340, 640, 940];
    const rowYs = [skillY + 60, skillY + 60 + cardH + 8];

    skills.forEach((skill, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = colXs[col];
      const cy = rowYs[row];
      const currentLvl = this.prog.skills[skill.id] ?? 0;
      const cost = skill.costPerPoint ?? 1;
      const reqLevel = skill.requiredLevel ?? 0;
      const locked = this.shopData.level < reqLevel;
      const canAfford = this.prog.skillPointsAvailable >= cost;
      const maxed = currentLvl >= skill.maxLevel;

      const bg = this.add.rectangle(cx, cy, cardW, cardH, locked ? 0x111118 : 0x1a1a2e)
        .setStrokeStyle(1, locked ? 0x222233 : (maxed ? 0xffdd44 : 0x333355));
      this.contentGroup.add(bg);

      if (locked) {
        const lockT = this.add.text(cx, cy - 16, `🔒 ${skill.name}`, {
          fontSize: '13px', color: '#555566', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(lockT);

        const reqT = this.add.text(cx, cy + 6, `Unlocks at Lv ${reqLevel}`, {
          fontSize: '11px', color: '#444455', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(reqT);
        return;
      }

      // Title row: skill name left, level right
      const nameT = this.add.text(cx - cardW / 2 + 10, cy - cardH / 2 + 8, skill.name, {
        fontSize: '13px', color: '#ffdd44', fontFamily: 'monospace',
      }).setOrigin(0, 0);
      this.contentGroup.add(nameT);

      const lvlT = this.add.text(cx + cardW / 2 - 10, cy - cardH / 2 + 8, `${currentLvl}/${skill.maxLevel}`, {
        fontSize: '12px', color: maxed ? '#ffdd44' : '#aaaacc', fontFamily: 'monospace',
      }).setOrigin(1, 0);
      this.contentGroup.add(lvlT);

      // Description (truncate aggressively to keep one line)
      const desc = skill.description.length > 50 ? skill.description.slice(0, 47) + '...' : skill.description;
      const descT = this.add.text(cx, cy - 14, desc, {
        fontSize: '9px', color: '#888899', fontFamily: 'monospace',
        wordWrap: { width: cardW - 16 },
        align: 'center',
      }).setOrigin(0.5, 0.5);
      this.contentGroup.add(descT);

      // Per-point info
      const effectT = this.add.text(cx, cy + 8, `${skill.perPoint}`, {
        fontSize: '9px', color: '#668866', fontFamily: 'monospace',
        align: 'center',
      }).setOrigin(0.5);
      this.contentGroup.add(effectT);

      // Level pips (bottom-left of card)
      const pipY = cy + cardH / 2 - 10;
      const pipStart = cx - cardW / 2 + 12;
      for (let p = 0; p < skill.maxLevel; p++) {
        const pipColor = p < currentLvl ? 0xffaa44 : 0x333344;
        const pip = this.add.rectangle(pipStart + p * 14, pipY, 10, 6, pipColor);
        pip.setOrigin(0, 0.5);
        this.contentGroup.add(pip);
      }

      // + button or cost label at bottom-right
      const btnY = cy + cardH / 2 - 14;
      if (canAfford && !maxed) {
        const btn = this.add.rectangle(cx + cardW / 2 - 22, btnY, 32, 22, 0xcc8822)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(btn);
        const btnT = this.add.text(cx + cardW / 2 - 22, btnY, '+', {
          fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(btnT);

        btn.on('pointerover', () => { btn.fillColor = 0xddaa33; });
        btn.on('pointerout', () => { btn.fillColor = 0xcc8822; });
        btn.on('pointerdown', () => {
          this.prog.skillPointsAvailable -= cost;
          this.prog.skills[skill.id] = (this.prog.skills[skill.id] ?? 0) + 1;
          this.renderContent();
        });

        if (cost > 1) {
          const costT = this.add.text(cx + cardW / 2 - 44, btnY, `${cost}SP`, {
            fontSize: '9px', color: '#aa8844', fontFamily: 'monospace',
          }).setOrigin(1, 0.5);
          this.contentGroup.add(costT);
        }
      } else if (!canAfford && !maxed) {
        const needT = this.add.text(cx + cardW / 2 - 12, btnY, `${cost}SP`, {
          fontSize: '10px', color: '#664422', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(needT);
      } else if (maxed) {
        const maxT = this.add.text(cx + cardW / 2 - 12, btnY, 'MAX', {
          fontSize: '10px', color: '#ffdd44', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(maxT);
      }
    });
  }

  // ==================== EQUIPS TAB ====================

  private renderEquips(): void {
    const allWeapons = getClassWeapons(this.shopData.heroClass.id);
    const owned = this.prog.ownedWeapons ?? [];
    const equipped = this.prog.equippedWeapon;
    const ownedWeapons = allWeapons.filter(w => owned.includes(w.id));

    // Header
    const header = this.add.text(640, 145, 'YOUR WEAPONS', {
      fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(header);

    if (ownedWeapons.length === 0) {
      const empty = this.add.text(640, 320, 'No weapons owned.\nVisit the SHOP to buy one.', {
        fontSize: '16px', color: '#666688', fontFamily: 'monospace',
        align: 'center',
      }).setOrigin(0.5);
      this.contentGroup.add(empty);
      return;
    }

    // Currently equipped weapon (for preview comparison)
    const currentEquipped = allWeapons.find(w => w.id === equipped) ?? null;

    // Base hero stats
    const baseStats = this.shopData.heroClass.stats;
    const atkPowerPts = this.prog.attributes['attackPower'] ?? 0;
    const rangePts = this.prog.attributes['attackRange'] ?? 0;
    const rotPts = this.prog.attributes['rotEffect'] ?? 0;
    const spdPts = this.prog.attributes['attackSpeed'] ?? 0;

    // Render owned weapons list (left side)
    const startY = 180;
    ownedWeapons.forEach((weapon, i) => {
      const y = startY + i * 60;
      const isEquipped = equipped === weapon.id;

      const bgColor = isEquipped ? 0x2a2a3e : 0x1a1a2e;
      const strokeColor = isEquipped ? 0xffdd44 : 0x333355;
      const bg = this.add.rectangle(340, y, 380, 52, bgColor)
        .setStrokeStyle(2, strokeColor)
        .setInteractive({ useHandCursor: true });
      this.contentGroup.add(bg);

      // Icon (unique per weapon)
      const iconBg = this.add.rectangle(180, y, 36, 50, 0x111118)
        .setStrokeStyle(1, 0x444466);
      this.contentGroup.add(iconBg);
      const iconParts = drawWeaponIcon(this, weapon.id, 180, y, 1);
      iconParts.forEach(p => this.contentGroup.add(p));

      const nameColor = isEquipped ? '#ffdd44' : '#ffffff';
      const nameT = this.add.text(205, y - 10, weapon.name, {
        fontSize: '14px', color: nameColor, fontFamily: 'monospace',
      });
      this.contentGroup.add(nameT);

      const stats: string[] = [];
      if (weapon.damageBonus) stats.push(`+${weapon.damageBonus}D`);
      if (weapon.attackSpeedPct) stats.push(`+${Math.round(weapon.attackSpeedPct * 100)}%S`);
      if (weapon.rangeBonus) stats.push(`+${weapon.rangeBonus}R`);
      if (weapon.rotBonusPct) stats.push(`+${Math.round(weapon.rotBonusPct * 100)}%Rot`);
      if (weapon.ghoulMaxBonus) stats.push(`+${weapon.ghoulMaxBonus}G`);
      if (weapon.lifestealPct) stats.push(`${Math.round(weapon.lifestealPct * 100)}%LS`);
      const statsT = this.add.text(205, y + 8, stats.join(' '), {
        fontSize: '10px', color: '#66aaff', fontFamily: 'monospace',
      });
      this.contentGroup.add(statsT);

      // Equip status / button
      if (isEquipped) {
        const eqT = this.add.text(510, y, 'EQUIPPED', {
          fontSize: '11px', color: '#ffdd44', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(eqT);
      } else {
        const btnText = this.add.text(510, y, '[CLICK TO EQUIP]', {
          fontSize: '10px', color: '#88aacc', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(btnText);
      }

      bg.on('pointerover', () => { if (!isEquipped) bg.setStrokeStyle(2, 0x88aacc); });
      bg.on('pointerout', () => { if (!isEquipped) bg.setStrokeStyle(2, 0x333355); });
      bg.on('pointerdown', () => {
        this.prog.equippedWeapon = weapon.id;
        this.renderContent();
      });
    });

    // --- Stats preview panel (right side) ---
    const px = 870;
    const panelBg = this.add.rectangle(px, 360, 320, 380, 0x111118)
      .setStrokeStyle(2, 0x333355);
    this.contentGroup.add(panelBg);

    const panelTitle = this.add.text(px, 195, 'STATS PREVIEW', {
      fontSize: '14px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(panelTitle);

    const subtitle = this.add.text(px, 215, currentEquipped ? `with ${currentEquipped.name}` : 'no weapon equipped', {
      fontSize: '11px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(subtitle);

    // Compute final stats
    const baseAtk = baseStats.attackPower + atkPowerPts * 3;
    const finalAtk = baseAtk + (currentEquipped?.damageBonus ?? 0);

    const baseRange = 400 + rangePts * 50;
    const finalRange = baseRange + (currentEquipped?.rangeBonus ?? 0);

    const baseRotPct = 20 + rotPts * 5;
    const finalRotPct = baseRotPct + Math.round((currentEquipped?.rotBonusPct ?? 0) * 100);

    const baseSpdReduction = spdPts * 12;
    const finalSpdReduction = baseSpdReduction + Math.round((currentEquipped?.attackSpeedPct ?? 0) * 100);

    const lifesteal = Math.round((currentEquipped?.lifestealPct ?? 0) * 100);
    const ghoulBonus = currentEquipped?.ghoulMaxBonus ?? 0;

    const drawStat = (yOff: number, label: string, baseVal: string, finalVal: string, color: string) => {
      this.contentGroup.add(this.add.text(px - 140, 250 + yOff, label, {
        fontSize: '12px', color: '#888899', fontFamily: 'monospace',
      }));
      const baseT = this.add.text(px + 60, 250 + yOff, baseVal, {
        fontSize: '12px', color: '#666677', fontFamily: 'monospace',
      }).setOrigin(1, 0);
      this.contentGroup.add(baseT);
      const arrow = this.add.text(px + 70, 250 + yOff, '→', {
        fontSize: '11px', color: '#888899', fontFamily: 'monospace',
      });
      this.contentGroup.add(arrow);
      const finalT = this.add.text(px + 140, 250 + yOff, finalVal, {
        fontSize: '13px', color: color, fontFamily: 'monospace',
      }).setOrigin(1, 0);
      this.contentGroup.add(finalT);
    };

    // Show base (no weapon) → with-weapon comparison
    drawStat(0, 'Damage', `${baseAtk}`, `${finalAtk}`, finalAtk > baseAtk ? '#44ff66' : '#cccccc');
    drawStat(28, 'Range', `${baseRange}`, `${finalRange}`, finalRange > baseRange ? '#44ff66' : '#cccccc');
    drawStat(56, 'Rot DMG', `${baseRotPct}%`, `${finalRotPct}%`, finalRotPct > baseRotPct ? '#44ff66' : '#cccccc');
    drawStat(84, 'Cast Speed', `${baseSpdReduction}%`, `${finalSpdReduction}%`, finalSpdReduction > baseSpdReduction ? '#44ff66' : '#cccccc');

    if (ghoulBonus > 0) {
      drawStat(112, 'Ghouls', '0', `+${ghoulBonus}`, '#44ff66');
    }
    if (lifesteal > 0) {
      drawStat(140, 'Lifesteal', '0%', `${lifesteal}%`, '#ff66aa');
    }

    // Description of equipped weapon
    if (currentEquipped) {
      const desc = this.add.text(px, 470, currentEquipped.description, {
        fontSize: '10px', color: '#888899', fontFamily: 'monospace',
        wordWrap: { width: 280 }, align: 'center',
      }).setOrigin(0.5);
      this.contentGroup.add(desc);
    }
  }

  // ==================== SHOP TAB ====================

  private renderShop(): void {
    const weapons = getClassWeapons(this.shopData.heroClass.id);
    const owned = this.prog.ownedWeapons ?? [];
    const equipped = this.prog.equippedWeapon;

    // Header
    const header = this.add.text(640, 145, 'WEAPONS', {
      fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(header);

    // Scroll hint
    const scrollHint = this.add.text(640, 168, 'Scroll with mouse wheel', {
      fontSize: '10px', color: '#666677', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(scrollHint);

    // --- Scrollable container with mask ---
    const visibleTop = this.weaponsScrollTop;
    const visibleH = this.weaponsScrollViewH;
    const rowH = 68;
    const innerPad = 30;
    const totalH = weapons.length * rowH + innerPad * 2;
    this.weaponsMaxScroll = Math.max(0, totalH - visibleH);
    this.weaponsScrollY = Math.min(this.weaponsScrollY, this.weaponsMaxScroll);

    // Create the container at the visible top, offset by current scroll
    this.weaponsContainer = this.add.container(0, visibleTop - this.weaponsScrollY);
    this.contentGroup.add(this.weaponsContainer);

    // Apply geometric mask to clip the container to the visible window.
    // Track the mask graphics so we can destroy it on tab switch (it isn't in contentGroup).
    if (this.weaponsMaskGfx) {
      this.weaponsMaskGfx.destroy();
      this.weaponsMaskGfx = null;
    }
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(0, visibleTop, 1280, visibleH);
    this.weaponsMaskGfx = maskGfx;
    const mask = maskGfx.createGeometryMask();
    this.weaponsContainer.setMask(mask);

    // Scrollbar background (right edge)
    const sbX = 1010;
    const sbBg = this.add.rectangle(sbX, visibleTop + visibleH / 2, 6, visibleH, 0x222233)
      .setStrokeStyle(1, 0x333355);
    this.contentGroup.add(sbBg);

    // Scrollbar fill (current scroll position indicator)
    if (this.weaponsMaxScroll > 0) {
      const fillH = Math.max(20, (visibleH / totalH) * visibleH);
      this.weaponsScrollbarFill = this.add.rectangle(sbX, visibleTop + 4, 6, fillH, 0x666688);
      this.weaponsScrollbarFill.setOrigin(0.5, 0);
      this.contentGroup.add(this.weaponsScrollbarFill);
      this.updateScrollbar();
    } else {
      this.weaponsScrollbarFill = null;
    }

    const container = this.weaponsContainer;

    weapons.forEach((weapon, i) => {
      // Local Y inside the container — first row at innerPad + rowH/2
      const y = innerPad + i * rowH + rowH / 2;
      const isOwned = owned.includes(weapon.id);
      const isEquipped = equipped === weapon.id;
      const meetsLevel = this.shopData.level >= weapon.requiredLevel;
      const canAfford = this.shopData.gold >= weapon.cost;

      // Background
      const bgColor = isEquipped ? 0x2a2a3e : (meetsLevel ? 0x1a1a2e : 0x111118);
      const strokeColor = isEquipped ? 0xffdd44 : 0x333355;
      const bg = this.add.rectangle(640, y, 680, 60, bgColor)
        .setStrokeStyle(2, strokeColor)
        .setInteractive({ useHandCursor: true });
      container.add(bg);

      // Weapon icon (unique per weapon)
      const iconBg = this.add.rectangle(330, y, 36, 50, 0x111118)
        .setStrokeStyle(1, 0x444466);
      container.add(iconBg);
      const iconParts = drawWeaponIcon(this, weapon.id, 330, y, 1);
      iconParts.forEach(p => container.add(p));

      // Name + level requirement
      const nameColor = isEquipped ? '#ffdd44' : (meetsLevel ? '#ffffff' : '#555566');
      const nameT = this.add.text(360, y - 18, weapon.name, {
        fontSize: '15px', color: nameColor, fontFamily: 'monospace',
      });
      container.add(nameT);

      const reqT = this.add.text(360, y - 2, `Lv.${weapon.requiredLevel}  ${weapon.description}`, {
        fontSize: '10px', color: '#888899', fontFamily: 'monospace',
      });
      container.add(reqT);

      // Stats line
      const stats: string[] = [];
      if (weapon.damageBonus) stats.push(`+${weapon.damageBonus} DMG`);
      if (weapon.attackSpeedPct) stats.push(`+${Math.round(weapon.attackSpeedPct * 100)}% SPD`);
      if (weapon.rangeBonus) stats.push(`+${weapon.rangeBonus} RNG`);
      if (weapon.rotBonusPct) stats.push(`+${Math.round(weapon.rotBonusPct * 100)}% ROT`);
      if (weapon.ghoulMaxBonus) stats.push(`+${weapon.ghoulMaxBonus} Ghoul`);
      if (weapon.lifestealPct) stats.push(`${Math.round(weapon.lifestealPct * 100)}% Lifesteal`);
      const statsT = this.add.text(360, y + 14, stats.join('  '), {
        fontSize: '10px', color: '#66aaff', fontFamily: 'monospace',
      });
      container.add(statsT);

      // Right side: status / button
      if (isEquipped) {
        const purchT = this.add.text(940, y - 8, '✓ PURCHASED', {
          fontSize: '11px', color: '#888899', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        container.add(purchT);
        const eqT = this.add.text(940, y + 8, 'EQUIPPED', {
          fontSize: '12px', color: '#ffdd44', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        container.add(eqT);
      } else if (isOwned) {
        const purchT = this.add.text(940, y - 14, '✓ PURCHASED', {
          fontSize: '10px', color: '#888899', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        container.add(purchT);
        const eqBtn = this.add.rectangle(935, y + 6, 80, 26, 0x33aa55)
          .setInteractive({ useHandCursor: true });
        container.add(eqBtn);
        const eqT = this.add.text(935, y + 6, 'EQUIP', {
          fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add(eqT);
        eqBtn.on('pointerover', () => { eqBtn.fillColor = 0x44cc66; });
        eqBtn.on('pointerout', () => { eqBtn.fillColor = 0x33aa55; });
        eqBtn.on('pointerdown', () => {
          this.prog.equippedWeapon = weapon.id;
          this.renderContent();
        });
      } else if (!meetsLevel) {
        const lockT = this.add.text(940, y, `Locked`, {
          fontSize: '11px', color: '#555566', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        container.add(lockT);
      } else {
        // Buy button
        const buyColor = canAfford ? 0xccaa22 : 0x444433;
        const buyBtn = this.add.rectangle(935, y, 80, 32, buyColor)
          .setInteractive({ useHandCursor: canAfford });
        container.add(buyBtn);
        const costColor = canAfford ? '#ffffff' : '#888866';
        const buyT = this.add.text(935, y, `${weapon.cost}g`, {
          fontSize: '13px', color: costColor, fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add(buyT);
        if (canAfford) {
          buyBtn.on('pointerover', () => { buyBtn.fillColor = 0xddbb33; });
          buyBtn.on('pointerout', () => { buyBtn.fillColor = 0xccaa22; });
          buyBtn.on('pointerdown', () => {
            this.shopData.gold -= weapon.cost;
            if (!this.prog.ownedWeapons) this.prog.ownedWeapons = [];
            this.prog.ownedWeapons.push(weapon.id);
            // Auto-equip on purchase
            this.prog.equippedWeapon = weapon.id;
            this.goldText.setText(`Gold: ${this.shopData.gold}   Lv.${this.shopData.level}`);
            this.renderContent();
          });
        }
      }
    });
  }

  private updateScrollbar(): void {
    if (!this.weaponsScrollbarFill) return;
    const visibleH = this.weaponsScrollViewH;
    const trackTop = this.weaponsScrollTop + 4;
    const trackBottom = this.weaponsScrollTop + visibleH - 4 - this.weaponsScrollbarFill.height;
    if (this.weaponsMaxScroll <= 0) {
      this.weaponsScrollbarFill.y = trackTop;
    } else {
      const t = this.weaponsScrollY / this.weaponsMaxScroll;
      this.weaponsScrollbarFill.y = trackTop + (trackBottom - trackTop) * t;
    }
  }

  // ==================== SIDEKICKS TAB ====================

  private renderSidekicks(): void {
    if (this.managingSidekickId) {
      this.renderSidekickManage(this.managingSidekickId);
      return;
    }
    const owned = this.prog.ownedSidekicks ?? [];
    const equipped = this.prog.equippedSidekick;

    // Header
    const header = this.add.text(640, 145, 'COMPANIONS', {
      fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(header);

    const subhead = this.add.text(640, 168, 'Equip a sidekick to fight by your side', {
      fontSize: '11px', color: '#888899', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(subhead);

    // Equipped indicator (top-right of content area)
    const equippedDef = getSidekickById(equipped);
    if (equippedDef) {
      const eqLabel = this.add.text(640, 188, `Equipped: ${equippedDef.name}`, {
        fontSize: '11px', color: '#aaffbb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.contentGroup.add(eqLabel);
    } else {
      const eqLabel = this.add.text(640, 188, 'No sidekick equipped', {
        fontSize: '11px', color: '#666677', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.contentGroup.add(eqLabel);
    }

    // Sidekick rows
    const startY = 220;
    const rowH = 76;

    SIDEKICKS.forEach((sk, i) => {
      const y = startY + i * rowH;
      const isOwned = owned.includes(sk.id);
      const isEquipped = equipped === sk.id;
      const canAfford = this.shopData.gold >= sk.cost;

      // Background card
      const bgColor = isEquipped ? 0x2a2a3e : 0x1a1a2e;
      const strokeColor = isEquipped ? 0xffdd44 : 0x333355;
      const bg = this.add.rectangle(640, y, 800, 68, bgColor)
        .setStrokeStyle(2, strokeColor);
      this.contentGroup.add(bg);

      // Sidekick visual (small floating creature)
      const iconX = 280;
      const glow = this.add.circle(iconX, y, 16, sk.glowColor, 0.4);
      this.contentGroup.add(glow);
      const wingL = this.add.circle(iconX - 8, y, 6, sk.bodyColor, 0.55);
      const wingR = this.add.circle(iconX + 8, y, 6, sk.bodyColor, 0.55);
      this.contentGroup.add(wingL);
      this.contentGroup.add(wingR);
      const body = this.add.circle(iconX, y, 9, sk.bodyColor);
      this.contentGroup.add(body);
      const accent = this.add.circle(iconX, y, 3, sk.accentColor);
      this.contentGroup.add(accent);

      // Name
      const nameColor = isEquipped ? '#ffdd44' : '#ffffff';
      const nameT = this.add.text(320, y - 18, sk.name, {
        fontSize: '15px', color: nameColor, fontFamily: 'monospace',
      });
      this.contentGroup.add(nameT);

      // Description (shorter so we have room for level/XP)
      const desc = sk.description.length > 75 ? sk.description.slice(0, 72) + '...' : sk.description;
      const descT = this.add.text(320, y - 4, desc, {
        fontSize: '10px', color: '#888899', fontFamily: 'monospace',
        wordWrap: { width: 540 },
      });
      this.contentGroup.add(descT);

      // Level + XP bar (only for owned sidekicks)
      if (isOwned) {
        const skLevel = this.prog.sidekickLevels?.[sk.id] ?? 1;
        const skXp = this.prog.sidekickXp?.[sk.id] ?? 0;
        const skSp = this.prog.sidekickSkillPoints?.[sk.id] ?? 0;
        const xpToNext = sidekickXpForLevel(skLevel);
        const xpPct = skLevel >= SIDEKICK_MAX_LEVEL ? 1 : Math.min(1, skXp / xpToNext);

        // Level text
        const lvlT = this.add.text(320, y + 14, `Lv.${skLevel}`, {
          fontSize: '11px', color: '#ffdd44', fontFamily: 'monospace',
        });
        this.contentGroup.add(lvlT);
        // XP bar background
        const xpBarBg = this.add.rectangle(360, y + 18, 200, 6, 0x222233)
          .setOrigin(0, 0.5).setStrokeStyle(1, 0x444466);
        this.contentGroup.add(xpBarBg);
        const xpBarFill = this.add.rectangle(360, y + 18, 200 * xpPct, 6, 0x66ccff)
          .setOrigin(0, 0.5);
        this.contentGroup.add(xpBarFill);
        // SP indicator
        if (skSp > 0) {
          const spT = this.add.text(570, y + 14, `+${skSp} SP`, {
            fontSize: '11px', color: '#44ff66', fontFamily: 'monospace',
          });
          this.contentGroup.add(spT);
        }
      }

      // Right side: status / button
      const rightX = 1010;
      if (isEquipped) {
        const eqT = this.add.text(rightX, y - 16, '✓ EQUIPPED', {
          fontSize: '10px', color: '#ffdd44', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(eqT);
        // Manage button
        const mgBtn = this.add.rectangle(rightX - 30, y + 2, 80, 20, 0x4466aa)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(mgBtn);
        const mgT = this.add.text(rightX - 30, y + 2, 'MANAGE', {
          fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(mgT);
        mgBtn.on('pointerover', () => { mgBtn.fillColor = 0x5577cc; });
        mgBtn.on('pointerout', () => { mgBtn.fillColor = 0x4466aa; });
        mgBtn.on('pointerdown', () => {
          this.managingSidekickId = sk.id;
          this.renderContent();
        });
        // Unequip button
        const unBtn = this.add.rectangle(rightX - 30, y + 24, 80, 20, 0x444455)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(unBtn);
        const unT = this.add.text(rightX - 30, y + 24, 'UNEQUIP', {
          fontSize: '10px', color: '#ccccdd', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(unT);
        unBtn.on('pointerover', () => { unBtn.fillColor = 0x555566; });
        unBtn.on('pointerout', () => { unBtn.fillColor = 0x444455; });
        unBtn.on('pointerdown', () => {
          this.prog.equippedSidekick = undefined;
          this.renderContent();
        });
      } else if (isOwned) {
        const purchT = this.add.text(rightX, y - 16, '✓ OWNED', {
          fontSize: '10px', color: '#888899', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(purchT);
        // Manage button
        const mgBtn = this.add.rectangle(rightX - 30, y + 2, 80, 20, 0x4466aa)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(mgBtn);
        const mgT = this.add.text(rightX - 30, y + 2, 'MANAGE', {
          fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(mgT);
        mgBtn.on('pointerover', () => { mgBtn.fillColor = 0x5577cc; });
        mgBtn.on('pointerout', () => { mgBtn.fillColor = 0x4466aa; });
        mgBtn.on('pointerdown', () => {
          this.managingSidekickId = sk.id;
          this.renderContent();
        });
        // Equip button
        const eqBtn = this.add.rectangle(rightX - 30, y + 24, 80, 20, 0x33aa55)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(eqBtn);
        const eqT = this.add.text(rightX - 30, y + 24, 'EQUIP', {
          fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(eqT);
        eqBtn.on('pointerover', () => { eqBtn.fillColor = 0x44cc66; });
        eqBtn.on('pointerout', () => { eqBtn.fillColor = 0x33aa55; });
        eqBtn.on('pointerdown', () => {
          this.prog.equippedSidekick = sk.id;
          this.renderContent();
        });
      } else {
        // Buy button
        const buyColor = canAfford ? 0xccaa22 : 0x444433;
        const buyBtn = this.add.rectangle(rightX - 30, y, 80, 32, buyColor)
          .setInteractive({ useHandCursor: canAfford });
        this.contentGroup.add(buyBtn);
        const costColor = canAfford ? '#ffffff' : '#888866';
        const buyT = this.add.text(rightX - 30, y, `${sk.cost}g`, {
          fontSize: '13px', color: costColor, fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(buyT);
        if (canAfford) {
          buyBtn.on('pointerover', () => { buyBtn.fillColor = 0xddbb33; });
          buyBtn.on('pointerout', () => { buyBtn.fillColor = 0xccaa22; });
          buyBtn.on('pointerdown', () => {
            this.shopData.gold -= sk.cost;
            if (!this.prog.ownedSidekicks) this.prog.ownedSidekicks = [];
            this.prog.ownedSidekicks.push(sk.id);
            // Auto-equip on first purchase if no sidekick equipped
            if (!this.prog.equippedSidekick) this.prog.equippedSidekick = sk.id;
            this.goldText.setText(`Gold: ${this.shopData.gold}   Lv.${this.shopData.level}`);
            this.renderContent();
          });
        }
      }
    });
  }

  // ==================== SIDEKICK MANAGE SUB-VIEW ====================

  private renderSidekickManage(sidekickId: string): void {
    const sk = getSidekickById(sidekickId);
    if (!sk) {
      this.managingSidekickId = null;
      this.renderSidekicks();
      return;
    }

    const skLevel = this.prog.sidekickLevels?.[sk.id] ?? 1;
    const skXp = this.prog.sidekickXp?.[sk.id] ?? 0;
    const skSp = this.prog.sidekickSkillPoints?.[sk.id] ?? 0;
    const xpToNext = sidekickXpForLevel(skLevel);

    // Back button (top-left of content area)
    const backBtn = this.add.rectangle(180, 145, 90, 28, 0x444455)
      .setStrokeStyle(2, 0x666688)
      .setInteractive({ useHandCursor: true });
    this.contentGroup.add(backBtn);
    const backT = this.add.text(180, 145, '← BACK', {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(backT);
    backBtn.on('pointerover', () => { backBtn.fillColor = 0x555566; });
    backBtn.on('pointerout', () => { backBtn.fillColor = 0x444455; });
    backBtn.on('pointerdown', () => {
      this.managingSidekickId = null;
      this.renderContent();
    });

    // Title with sidekick visual
    const iconX = 540;
    const iconY = 145;
    const glow = this.add.circle(iconX, iconY, 18, sk.glowColor, 0.4);
    this.contentGroup.add(glow);
    const wingL = this.add.circle(iconX - 9, iconY, 7, sk.bodyColor, 0.55);
    const wingR = this.add.circle(iconX + 9, iconY, 7, sk.bodyColor, 0.55);
    this.contentGroup.add(wingL);
    this.contentGroup.add(wingR);
    const body = this.add.circle(iconX, iconY, 10, sk.bodyColor);
    this.contentGroup.add(body);

    const nameT = this.add.text(570, 145, sk.name, {
      fontSize: '20px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);
    this.contentGroup.add(nameT);

    // Level + XP
    const lvlT = this.add.text(640, 185, `Level ${skLevel} / ${SIDEKICK_MAX_LEVEL}`, {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(lvlT);

    // XP bar
    const xpBarW = 360;
    const xpPct = skLevel >= SIDEKICK_MAX_LEVEL ? 1 : Math.min(1, skXp / xpToNext);
    const xpBarBg = this.add.rectangle(640, 210, xpBarW, 12, 0x222233)
      .setStrokeStyle(1, 0x444466);
    this.contentGroup.add(xpBarBg);
    const xpBarFill = this.add.rectangle(640 - xpBarW / 2, 210, xpBarW * xpPct, 12, 0x66ccff)
      .setOrigin(0, 0.5);
    this.contentGroup.add(xpBarFill);
    const xpLabel = this.add.text(640, 210, skLevel >= SIDEKICK_MAX_LEVEL ? 'MAX LEVEL' : `${skXp} / ${xpToNext} XP`, {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(xpLabel);

    // SP available
    const spText = this.add.text(640, 232, `Skill Points: ${skSp}`, {
      fontSize: '14px', color: skSp > 0 ? '#44ff66' : '#888899', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(spText);

    // --- Skill cards (3 stacked horizontally) ---
    const skillCardW = 360;
    const skillCardH = 110;
    const skillStartX = 640 - skillCardW - 20;
    const skillY = 320;
    const skillSpacing = skillCardW + 20;

    sk.skills.forEach((skill, i) => {
      const cx = skillStartX + i * skillSpacing;
      const cy = skillY + skillCardH / 2;
      const currentLvl = this.prog.sidekickSkills?.[sk.id]?.[skill.id] ?? 0;
      const locked = skLevel < skill.unlockLevel;
      const maxed = currentLvl >= skill.maxLevel;
      const canAfford = skSp > 0;

      const bgColor = locked ? 0x111118 : (maxed ? 0x2a2a3e : 0x1a1a2e);
      const strokeColor = locked ? 0x222233 : (maxed ? 0xffdd44 : 0x333355);
      const bg = this.add.rectangle(cx, cy, skillCardW, skillCardH, bgColor)
        .setStrokeStyle(2, strokeColor);
      this.contentGroup.add(bg);

      if (locked) {
        const lockT = this.add.text(cx, cy - 12, `🔒 ${skill.name}`, {
          fontSize: '13px', color: '#555566', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(lockT);
        const reqT = this.add.text(cx, cy + 8, `Unlocks at sidekick Lv.${skill.unlockLevel}`, {
          fontSize: '11px', color: '#444455', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(reqT);
        return;
      }

      // Title
      const nameC = this.add.text(cx - skillCardW / 2 + 12, cy - skillCardH / 2 + 10, skill.name, {
        fontSize: '13px', color: '#ffdd44', fontFamily: 'monospace',
      });
      this.contentGroup.add(nameC);
      const lvlC = this.add.text(cx + skillCardW / 2 - 12, cy - skillCardH / 2 + 10, `${currentLvl}/${skill.maxLevel}`, {
        fontSize: '12px', color: maxed ? '#ffdd44' : '#aaaacc', fontFamily: 'monospace',
      }).setOrigin(1, 0);
      this.contentGroup.add(lvlC);

      // Description
      const descC = this.add.text(cx, cy - 8, skill.description, {
        fontSize: '10px', color: '#888899', fontFamily: 'monospace',
        wordWrap: { width: skillCardW - 24 },
        align: 'center',
      }).setOrigin(0.5);
      this.contentGroup.add(descC);

      // Per-point info
      const effC = this.add.text(cx, cy + 18, skill.perPoint, {
        fontSize: '10px', color: '#668866', fontFamily: 'monospace',
        align: 'center',
      }).setOrigin(0.5);
      this.contentGroup.add(effC);

      // Pips
      const pipStart = cx - skillCardW / 2 + 14;
      for (let p = 0; p < skill.maxLevel; p++) {
        const pipColor = p < currentLvl ? 0xffaa44 : 0x333344;
        const pip = this.add.rectangle(pipStart + p * 14, cy + skillCardH / 2 - 12, 10, 6, pipColor)
          .setOrigin(0, 0.5);
        this.contentGroup.add(pip);
      }

      // + button
      if (maxed) {
        const maxT = this.add.text(cx + skillCardW / 2 - 14, cy + skillCardH / 2 - 12, 'MAX', {
          fontSize: '11px', color: '#ffdd44', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(maxT);
      } else if (canAfford) {
        const btn = this.add.rectangle(cx + skillCardW / 2 - 22, cy + skillCardH / 2 - 14, 32, 22, 0xcc8822)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(btn);
        const btnT = this.add.text(cx + skillCardW / 2 - 22, cy + skillCardH / 2 - 14, '+', {
          fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(btnT);
        btn.on('pointerover', () => { btn.fillColor = 0xddaa33; });
        btn.on('pointerout', () => { btn.fillColor = 0xcc8822; });
        btn.on('pointerdown', () => {
          if (!this.prog.sidekickSkills) this.prog.sidekickSkills = {};
          if (!this.prog.sidekickSkills[sk.id]) this.prog.sidekickSkills[sk.id] = {};
          this.prog.sidekickSkills[sk.id][skill.id] = (this.prog.sidekickSkills[sk.id][skill.id] ?? 0) + 1;
          if (!this.prog.sidekickSkillPoints) this.prog.sidekickSkillPoints = {};
          this.prog.sidekickSkillPoints[sk.id] = (this.prog.sidekickSkillPoints[sk.id] ?? 0) - 1;
          this.renderContent();
        });
      } else {
        const needT = this.add.text(cx + skillCardW / 2 - 14, cy + skillCardH / 2 - 12, 'No SP', {
          fontSize: '10px', color: '#664422', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(needT);
      }
    });
  }
}
