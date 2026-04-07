import Phaser from 'phaser';
import type { HeroClassDef } from '../data/heroClasses';
import type { User } from '@supabase/supabase-js';
import { CharacterProgression, getClassAttributes, getClassSkills } from '../systems/CharacterProgression';
import { getClassWeapons } from '../data/weapons';
import { drawWeaponIcon } from '../data/weaponIcons';
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
  private activeTab: 'shop' | 'stats' | 'equips' = 'stats';

  // Dynamic elements that need refreshing
  private contentGroup!: Phaser.GameObjects.Group;
  private goldText!: Phaser.GameObjects.Text;
  private tabShopBg!: Phaser.GameObjects.Rectangle;
  private tabStatsBg!: Phaser.GameObjects.Rectangle;
  private tabEquipsBg!: Phaser.GameObjects.Rectangle;

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

    // Tabs (3 tabs: STATS, EQUIPS, SHOP)
    this.tabStatsBg = this.add.rectangle(480, 105, 140, 36, 0x334455)
      .setStrokeStyle(2, 0xffdd44)
      .setInteractive({ useHandCursor: true });
    this.add.text(480, 105, 'STATS', {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tabEquipsBg = this.add.rectangle(640, 105, 140, 36, 0x222233)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });
    this.add.text(640, 105, 'EQUIPS', {
      fontSize: '15px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tabShopBg = this.add.rectangle(800, 105, 140, 36, 0x222233)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });
    this.add.text(800, 105, 'SHOP', {
      fontSize: '15px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tabStatsBg.on('pointerdown', () => this.switchTab('stats'));
    this.tabEquipsBg.on('pointerdown', () => this.switchTab('equips'));
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

  private switchTab(tab: 'shop' | 'stats' | 'equips'): void {
    this.activeTab = tab;
    // Reset all tabs to inactive
    this.tabStatsBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    this.tabEquipsBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    this.tabShopBg.setStrokeStyle(2, 0x333355).setFillStyle(0x222233);
    // Highlight active
    if (tab === 'stats') this.tabStatsBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
    else if (tab === 'equips') this.tabEquipsBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
    else this.tabShopBg.setStrokeStyle(2, 0xffdd44).setFillStyle(0x334455);
    this.renderContent();
  }

  private renderContent(): void {
    this.contentGroup.clear(true, true);
    if (this.activeTab === 'stats') this.renderStats();
    else if (this.activeTab === 'equips') this.renderEquips();
    else this.renderShop();
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

      // Weapon icon (unique per weapon)
      const iconBg = this.add.rectangle(330, y, 36, 50, 0x111118)
        .setStrokeStyle(1, 0x444466);
      this.contentGroup.add(iconBg);
      const iconParts = drawWeaponIcon(this, weapon.id, 330, y, 1);
      iconParts.forEach(p => this.contentGroup.add(p));

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
        // Owned + equipped — show purchased + equipped state
        const purchT = this.add.text(945, y - 8, '✓ PURCHASED', {
          fontSize: '11px', color: '#888899', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(purchT);
        const eqT = this.add.text(945, y + 8, 'EQUIPPED', {
          fontSize: '12px', color: '#ffdd44', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(eqT);
      } else if (isOwned) {
        // Owned but not equipped — show purchased + equip button
        const purchT = this.add.text(945, y - 14, '✓ PURCHASED', {
          fontSize: '10px', color: '#888899', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        this.contentGroup.add(purchT);
        const eqBtn = this.add.rectangle(940, y + 6, 80, 26, 0x33aa55)
          .setInteractive({ useHandCursor: true });
        this.contentGroup.add(eqBtn);
        const eqT = this.add.text(940, y + 6, 'EQUIP', {
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
