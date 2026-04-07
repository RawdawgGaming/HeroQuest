import Phaser from 'phaser';
import type { HeroClassDef } from '../data/heroClasses';
import type { User } from '@supabase/supabase-js';
import { CharacterProgression, getClassAttributes, getClassSkills } from '../systems/CharacterProgression';
import { getClassWeapons } from '../data/weapons';
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
}

export class Shop extends Phaser.Scene {
  private shopData!: ShopData;
  private prog!: CharacterProgression;
  private activeTab: 'shop' | 'stats' = 'stats';

  // Dynamic elements that need refreshing
  private contentGroup!: Phaser.GameObjects.Group;
  private goldText!: Phaser.GameObjects.Text;
  private tabShopBg!: Phaser.GameObjects.Rectangle;
  private tabStatsBg!: Phaser.GameObjects.Rectangle;

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

    // Tabs
    this.tabStatsBg = this.add.rectangle(560, 105, 140, 36, 0x334455)
      .setStrokeStyle(2, 0xffdd44)
      .setInteractive({ useHandCursor: true });
    this.add.text(560, 105, 'STATS', {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tabShopBg = this.add.rectangle(720, 105, 140, 36, 0x222233)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });
    this.add.text(720, 105, 'SHOP', {
      fontSize: '15px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tabStatsBg.on('pointerdown', () => this.switchTab('stats'));
    this.tabShopBg.on('pointerdown', () => this.switchTab('shop'));

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

      if (this.shopData.fromMainMenu) {
        // Return to main menu
        this.scene.start('StartScreen');
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
        // Advance to next stage
        this.scene.start('ForestStage', {
          heroClass: this.shopData.heroClass,
          user: this.shopData.user,
          characterId: this.shopData.characterId,
          gold: this.shopData.gold,
          level: this.shopData.level,
          currentXp: this.shopData.currentXp,
          stageIndex: (this.shopData.stageIndex ?? 0) + 1,
          progression: this.prog,
        });
      }
    });

    this.renderContent();
  }

  private switchTab(tab: 'shop' | 'stats'): void {
    this.activeTab = tab;
    if (tab === 'stats') {
      this.tabStatsBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
      this.tabShopBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    } else {
      this.tabShopBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
      this.tabStatsBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    }
    this.renderContent();
  }

  private renderContent(): void {
    // Clear previous content
    this.contentGroup.clear(true, true);

    if (this.activeTab === 'stats') {
      this.renderStats();
    } else {
      this.renderShop();
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
      const y = startY + 40 + i * 55;
      const currentLvl = this.prog.attributes[attr.id] ?? 0;

      // Background
      const bg = this.add.rectangle(640, y, 550, 46, 0x1a1a2e)
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
    const skillY = startY + 40 + attrs.length * 55 + 20;

    const skillHeader = this.add.text(640, skillY, `Skill Points: ${this.prog.skillPointsAvailable}`, {
      fontSize: '18px', color: '#ffaa44', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.contentGroup.add(skillHeader);

    skills.forEach((skill, i) => {
      const y = skillY + 40 + i * 75;
      const currentLvl = this.prog.skills[skill.id] ?? 0;
      const cost = skill.costPerPoint ?? 1;
      const reqLevel = skill.requiredLevel ?? 0;
      const locked = this.shopData.level < reqLevel;
      const canAfford = this.prog.skillPointsAvailable >= cost;

      const bg = this.add.rectangle(640, y, 550, 62, locked ? 0x111118 : 0x1a1a2e)
        .setStrokeStyle(1, locked ? 0x222233 : 0x333355);
      this.contentGroup.add(bg);

      if (locked) {
        // Locked skill — show requirement
        const lockT = this.add.text(640, y - 8, `🔒 ${skill.name}`, {
          fontSize: '15px', color: '#555566', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(lockT);

        const reqT = this.add.text(640, y + 10, `Unlocks at Level ${reqLevel}`, {
          fontSize: '12px', color: '#444455', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(reqT);
      } else {
        // Skill name + level
        const nameT = this.add.text(390, y - 16, `${skill.name}  [${currentLvl}/${skill.maxLevel}]`, {
          fontSize: '15px', color: '#ffdd44', fontFamily: 'monospace',
        });
        this.contentGroup.add(nameT);

        const descT = this.add.text(390, y + 2, skill.description, {
          fontSize: '11px', color: '#888899', fontFamily: 'monospace',
        });
        this.contentGroup.add(descT);

        const costLabel = cost > 1 ? `Cost: ${cost} SP` : '';
        const effectT = this.add.text(390, y + 18, `Per point: ${skill.perPoint}  ${costLabel}`, {
          fontSize: '10px', color: '#668866', fontFamily: 'monospace',
        });
        this.contentGroup.add(effectT);

        // + button
        if (canAfford && currentLvl < skill.maxLevel) {
          const btn = this.add.rectangle(870, y, 40, 30, 0xcc8822)
            .setInteractive({ useHandCursor: true });
          this.contentGroup.add(btn);
          const btnT = this.add.text(870, y, '+', {
            fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
          }).setOrigin(0.5);
          this.contentGroup.add(btnT);

          btn.on('pointerover', () => { btn.fillColor = 0xddaa33; });
          btn.on('pointerout', () => { btn.fillColor = 0xcc8822; });
          btn.on('pointerdown', () => {
            this.prog.skillPointsAvailable -= cost;
            this.prog.skills[skill.id] = (this.prog.skills[skill.id] ?? 0) + 1;
            this.renderContent();
          });
        } else if (!canAfford && currentLvl < skill.maxLevel) {
          const needT = this.add.text(870, y, `${cost}SP`, {
            fontSize: '11px', color: '#664422', fontFamily: 'monospace',
          }).setOrigin(0.5);
          this.contentGroup.add(needT);
        }
      }

      // Level pips
      for (let p = 0; p < skill.maxLevel; p++) {
        const pipColor = p < currentLvl ? 0xffaa44 : 0x333344;
        const pip = this.add.rectangle(680 + p * 16, y + 22, 10, 6, pipColor);
        this.contentGroup.add(pip);
      }
    });
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

    const startY = 180;
    weapons.forEach((weapon, i) => {
      const y = startY + i * 68;
      const isOwned = owned.includes(weapon.id);
      const isEquipped = equipped === weapon.id;
      const meetsLevel = this.shopData.level >= weapon.requiredLevel;
      const canAfford = this.shopData.gold >= weapon.cost;

      // Background
      const bgColor = isEquipped ? 0x2a2a3e : (meetsLevel ? 0x1a1a2e : 0x111118);
      const strokeColor = isEquipped ? 0xffdd44 : 0x333355;
      const bg = this.add.rectangle(640, y, 700, 60, bgColor)
        .setStrokeStyle(2, strokeColor)
        .setInteractive({ useHandCursor: true });
      this.contentGroup.add(bg);

      // Weapon icon (small square in class color)
      const icon = this.add.rectangle(330, y, 28, 28, weapon.color)
        .setStrokeStyle(1, 0x666677);
      this.contentGroup.add(icon);

      // Name + level requirement
      const nameColor = isEquipped ? '#ffdd44' : (meetsLevel ? '#ffffff' : '#555566');
      const nameT = this.add.text(360, y - 18, weapon.name, {
        fontSize: '15px', color: nameColor, fontFamily: 'monospace',
      });
      this.contentGroup.add(nameT);

      const reqT = this.add.text(360, y - 2, `Lv.${weapon.requiredLevel}  ${weapon.description}`, {
        fontSize: '10px', color: '#888899', fontFamily: 'monospace',
      });
      this.contentGroup.add(reqT);

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
      this.contentGroup.add(statsT);

      // Right side: status / button
      if (isEquipped) {
        const eqT = this.add.text(945, y, 'EQUIPPED', {
          fontSize: '12px', color: '#ffdd44', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(eqT);
      } else if (isOwned) {
        const eqBtn = this.add.rectangle(940, y, 80, 32, 0x33aa55)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(eqBtn);
        const eqT = this.add.text(940, y, 'EQUIP', {
          fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(eqT);
        eqBtn.on('pointerover', () => { eqBtn.fillColor = 0x44cc66; });
        eqBtn.on('pointerout', () => { eqBtn.fillColor = 0x33aa55; });
        eqBtn.on('pointerdown', () => {
          this.prog.equippedWeapon = weapon.id;
          this.renderContent();
        });
      } else if (!meetsLevel) {
        const lockT = this.add.text(945, y, `Locked`, {
          fontSize: '11px', color: '#555566', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(lockT);
      } else {
        // Buy button
        const buyColor = canAfford ? 0xccaa22 : 0x444433;
        const buyBtn = this.add.rectangle(940, y, 80, 32, buyColor)
          .setInteractive({ useHandCursor: canAfford });
        this.contentGroup.add(buyBtn);
        const costColor = canAfford ? '#ffffff' : '#888866';
        const buyT = this.add.text(940, y, `${weapon.cost}g`, {
          fontSize: '13px', color: costColor, fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.contentGroup.add(buyT);
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
}
