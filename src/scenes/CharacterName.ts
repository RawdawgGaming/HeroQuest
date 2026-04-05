import Phaser from 'phaser';
import { HeroClassDef } from '../data/heroClasses';
import { isNameTaken, createCharacter } from '../services/supabase';
import type { User } from '@supabase/supabase-js';

export class CharacterName extends Phaser.Scene {
  private user!: User;
  private heroClass!: HeroClassDef;
  private overlay!: HTMLDivElement;

  constructor() {
    super('CharacterName');
  }

  init(data: { heroClass: HeroClassDef; user: User }): void {
    this.heroClass = data.heroClass;
    this.user = data.user;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111122);

    // Starfield
    for (let i = 0; i < 30; i++) {
      const s = this.add.circle(
        Phaser.Math.Between(0, 1280),
        Phaser.Math.Between(0, 720),
        Phaser.Math.Between(1, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.1, 0.4),
      );
      this.tweens.add({ targets: s, alpha: 0, duration: Phaser.Math.Between(1500, 3000), yoyo: true, repeat: -1 });
    }

    // Title
    this.add.text(640, 80, 'NAME YOUR HERO', {
      fontSize: '36px',
      color: '#ffdd44',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Show selected class preview
    const cls = this.heroClass;
    const cx = 640;

    if (cls.id === 'necromancer') {
      // Shadow
      this.add.ellipse(cx, 310, 38, 12, 0x114422, 0.4);
      // Robe
      this.add.rectangle(cx, 285, 36, 30, 0x1a1a22);
      this.add.rectangle(cx, 262, 30, 22, 0x222233);
      // Hood
      this.add.circle(cx, 248, 16, 0x111118);
      // Skull
      this.add.circle(cx, 250, 11, 0xccddbb);
      // Eye sockets + green eyes
      this.add.circle(cx - 4, 248, 3, 0x111111);
      this.add.circle(cx + 4, 248, 3, 0x111111);
      const eL = this.add.circle(cx - 4, 248, 2, 0x44ff66);
      const eR = this.add.circle(cx + 4, 248, 2, 0x44ff66);
      this.tweens.add({ targets: [eL, eR], alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
      // Jaw
      this.add.rectangle(cx, 256, 8, 3, 0x999988);
      // Robe trim
      this.add.rectangle(cx - 13, 272, 2, 24, 0x22aa55, 0.4);
      this.add.rectangle(cx + 13, 272, 2, 24, 0x22aa55, 0.4);
      // Belt + buckle
      this.add.rectangle(cx, 270, 24, 3, 0x334422);
      this.add.rectangle(cx, 270, 5, 5, 0x44ff66, 0.6);
      // Staff
      this.add.rectangle(cx + 20, 260, 3, 44, 0x443322);
      const staffOrb = this.add.circle(cx + 20, 238, 6, 0x33ff55, 0.7);
      const staffGlow = this.add.circle(cx + 20, 238, 10, 0x22ff44, 0.15);
      this.tweens.add({ targets: staffGlow, scaleX: 1.5, scaleY: 1.5, alpha: 0.05, duration: 1000, yoyo: true, repeat: -1 });
      // Lantern
      this.add.rectangle(cx - 18, 256, 1, 10, 0x555555);
      this.add.rectangle(cx - 18, 263, 7, 10, 0x333333);
      const lanternG = this.add.circle(cx - 18, 263, 4, 0x44ff88, 0.5);
      this.tweens.add({ targets: lanternG, alpha: 0.2, duration: 600, yoyo: true, repeat: -1, delay: 300 });
      // Aura
      const aura = this.add.circle(cx, 268, 28, 0x22ff66, 0.06);
      this.tweens.add({ targets: aura, scaleX: 1.3, scaleY: 1.3, alpha: 0.02, duration: 1200, yoyo: true, repeat: -1 });
    } else {
      // Default hero figure
      this.add.ellipse(cx, 310, 34, 10, 0x000000, 0.3);
      this.add.rectangle(cx, 270, 36, 56, cls.color);
      this.add.rectangle(cx + 8, 254, 5, 5, cls.accentColor);
      this.add.rectangle(cx + 16, 272, 8, 20, 0x888888);
    }

    this.add.text(640, 350, cls.name, {
      fontSize: '20px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Stat summary
    this.add.text(640, 380, `HP ${cls.stats.maxHealth}  ATK ${cls.stats.attackPower}  DEF ${cls.stats.defense}  SPD ${cls.stats.moveSpeed}`, {
      fontSize: '13px',
      color: '#888899',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // HTML overlay for text input
    this.showNameInput();

    // Back button
    const backText = this.add.text(30, 690, '< Back', {
      fontSize: '14px',
      color: '#888899',
      fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true });
    backText.on('pointerover', () => backText.setColor('#ccccdd'));
    backText.on('pointerout', () => backText.setColor('#888899'));
    backText.on('pointerdown', () => {
      this.clearOverlay();
      this.scene.start('HeroSelect', { user: this.user });
    });
  }

  private showNameInput(): void {
    this.clearOverlay();

    this.overlay = document.createElement('div');
    this.overlay.id = 'name-overlay';
    this.overlay.innerHTML = `
      <div id="name-box">
        <input type="text" id="char-name" placeholder="Enter character name" maxlength="20" autocomplete="off" spellcheck="false" />
        <div id="name-status"></div>
        <button id="name-submit" disabled>BEGIN QUEST</button>
        <p id="name-rules">3-20 characters. Letters, numbers, and spaces only.</p>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'name-overlay-style';
    style.textContent = `
      #name-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; justify-content: center; align-items: flex-end;
        padding-bottom: 160px; pointer-events: none; z-index: 1000;
      }
      #name-box {
        pointer-events: all; text-align: center; width: 380px;
      }
      #char-name {
        width: 100%; padding: 14px; background: #0d0d1a;
        border: 2px solid #333355; border-radius: 8px; color: #ffffff;
        font-family: monospace; font-size: 22px; text-align: center;
        box-sizing: border-box; letter-spacing: 1px;
      }
      #char-name:focus { outline: none; border-color: #ffdd44; }
      #char-name::placeholder { color: #444455; font-size: 16px; }
      #name-status {
        min-height: 24px; margin: 8px 0; font-family: monospace; font-size: 13px;
      }
      .name-available { color: #44cc55; }
      .name-taken { color: #ff5555; }
      .name-checking { color: #aaaacc; }
      .name-invalid { color: #cc8844; }
      #name-submit {
        width: 100%; padding: 14px; background: #33aa55; border: none;
        border-radius: 8px; color: #ffffff; font-family: monospace;
        font-size: 18px; cursor: pointer; transition: background 0.2s;
        margin-top: 4px;
      }
      #name-submit:hover:not(:disabled) { background: #44cc66; }
      #name-submit:disabled { background: #333344; color: #666677; cursor: not-allowed; }
      #name-rules { color: #555566; font-family: monospace; font-size: 12px; margin-top: 10px; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.overlay);

    const input = this.overlay.querySelector('#char-name') as HTMLInputElement;
    const status = this.overlay.querySelector('#name-status') as HTMLElement;
    const submitBtn = this.overlay.querySelector('#name-submit') as HTMLButtonElement;

    let checkTimeout: ReturnType<typeof setTimeout> | null = null;
    let nameValid = false;

    const NAME_REGEX = /^[a-zA-Z0-9 ]{3,20}$/;

    input.addEventListener('input', () => {
      const val = input.value.trim();
      nameValid = false;
      submitBtn.disabled = true;

      if (checkTimeout) clearTimeout(checkTimeout);

      if (val.length === 0) {
        status.textContent = '';
        status.className = '';
        return;
      }

      if (!NAME_REGEX.test(val)) {
        status.textContent = 'Letters, numbers, and spaces only (3-20 chars).';
        status.className = 'name-invalid';
        return;
      }

      status.textContent = 'Checking availability...';
      status.className = 'name-checking';

      // Debounce the server check
      checkTimeout = setTimeout(async () => {
        const taken = await isNameTaken(val);
        // Verify input hasn't changed while we were checking
        if (input.value.trim() !== val) return;

        if (taken) {
          status.textContent = `"${val}" is already taken.`;
          status.className = 'name-taken';
          nameValid = false;
          submitBtn.disabled = true;
        } else {
          status.textContent = `"${val}" is available!`;
          status.className = 'name-available';
          nameValid = true;
          submitBtn.disabled = false;
        }
      }, 400);
    });

    // Submit
    const doSubmit = async () => {
      if (!nameValid) return;
      const charName = input.value.trim();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
      input.disabled = true;

      const { character, error } = await createCharacter(
        this.user.id,
        charName,
        this.heroClass.id,
      );

      if (error) {
        status.textContent = error;
        status.className = 'name-taken';
        submitBtn.textContent = 'BEGIN QUEST';
        submitBtn.disabled = false;
        input.disabled = false;
        return;
      }

      // Success — start the game
      this.clearOverlay();
      this.scene.start('ForestStage', {
        heroClass: this.heroClass,
        user: this.user,
        characterId: character?.id,
      });
    };

    submitBtn.addEventListener('click', doSubmit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSubmit();
    });

    // Auto-focus
    setTimeout(() => input.focus(), 100);
  }

  private clearOverlay(): void {
    if (this.overlay?.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    const style = document.getElementById('name-overlay-style');
    if (style) style.remove();
  }

  shutdown(): void {
    this.clearOverlay();
  }
}
