import Phaser from 'phaser';
import type { HeroClassDef } from '../data/heroClasses';
import type { User } from '@supabase/supabase-js';
import { CharacterProgression, getClassAttributes, getClassSkills } from '../systems/CharacterProgression';
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
    const items = [
      { name: 'Health Potion', desc: 'Restore 30 HP', cost: 10 },
      { name: 'Attack Boost', desc: '+2 ATK for next stage', cost: 25 },
      { name: 'Defense Boost', desc: '+2 DEF for next stage', cost: 25 },
      { name: 'Speed Boost', desc: '+20 SPD for next stage', cost: 20 },
    ];

    const startY = 170;
    items.forEach((item, i) => {
      const y = startY + i * 70;

      const bg = this.add.rectangle(640, y, 500, 56, 0x1a1a2e)
        .setStrokeStyle(2, 0x333355)
        .setInteractive({ useHandCursor: true });
      this.contentGroup.add(bg);

      const nameT = this.add.text(430, y - 10, item.name, {
        fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
      });
      this.contentGroup.add(nameT);

      const descT = this.add.text(430, y + 10, item.desc, {
        fontSize: '12px', color: '#888899', fontFamily: 'monospace',
      });
      this.contentGroup.add(descT);

      const costColor = this.shopData.gold >= item.cost ? '#ffdd44' : '#664422';
      const costT = this.add.text(840, y, `${item.cost}g`, {
        fontSize: '16px', color: costColor, fontFamily: 'monospace',
      }).setOrigin(1, 0.5);
      this.contentGroup.add(costT);

      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffdd44));
      bg.on('pointerout', () => bg.setStrokeStyle(2, 0x333355));
      bg.on('pointerdown', () => {
        if (this.shopData.gold >= item.cost) {
          this.shopData.gold -= item.cost;
          this.goldText.setText(`Gold: ${this.shopData.gold}   Lv.${this.shopData.level}`);
          this.renderContent();
        }
      });
    });
  }
}
