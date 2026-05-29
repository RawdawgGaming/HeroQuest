import Phaser from 'phaser';
import { HeroClassDef } from '../data/heroClasses';
import { Hero } from '../entities/Hero';
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

    // Show selected class preview using the actual in-game Hero sprite
    const cls = this.heroClass;
    const cx = 640;

    // Wrap in a scaled holder so the small in-game sprite reads as a portrait
    const holder = this.add.container(cx, 290);
    holder.setScale(2.4);
    const hero = new Hero(this, 0, 0, cls.stats, cls.color, cls.accentColor, cls.attackType, cls.id, 1, true);
    holder.add(hero);

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
        <div id="name-buttons">
          <button id="name-cancel">CANCEL</button>
          <button id="name-submit" disabled>BEGIN QUEST</button>
        </div>
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
      #name-buttons {
        display: flex; gap: 10px; margin-top: 4px;
      }
      #name-submit {
        flex: 2; padding: 14px; background: #33aa55; border: none;
        border-radius: 8px; color: #ffffff; font-family: monospace;
        font-size: 18px; cursor: pointer; transition: background 0.2s;
      }
      #name-submit:hover:not(:disabled) { background: #44cc66; }
      #name-submit:disabled { background: #333344; color: #666677; cursor: not-allowed; }
      #name-cancel {
        flex: 1; padding: 14px; background: #444455; border: none;
        border-radius: 8px; color: #ccccdd; font-family: monospace;
        font-size: 16px; cursor: pointer; transition: background 0.2s;
      }
      #name-cancel:hover { background: #555566; color: #ffffff; }
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
        stageIndex: 0,
      });
    };

    submitBtn.addEventListener('click', doSubmit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSubmit();
      if (e.key === 'Escape') {
        this.clearOverlay();
        this.scene.start('HeroSelect', { user: this.user });
      }
    });

    // Cancel button — return to hero select
    const cancelBtn = this.overlay.querySelector('#name-cancel') as HTMLButtonElement;
    cancelBtn.addEventListener('click', () => {
      this.clearOverlay();
      this.scene.start('HeroSelect', { user: this.user });
    });

    // Disable Phaser keyboard capture while typing in the HTML input
    // so game keybinds (Y, U, I, O, P, J, K, L, etc.) don't steal keystrokes
    input.addEventListener('focus', () => {
      if (this.input.keyboard) this.input.keyboard.enabled = false;
    });
    input.addEventListener('blur', () => {
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });

    // Auto-focus
    setTimeout(() => input.focus(), 100);
  }

  private clearOverlay(): void {
    // Blur any focused input first so focus returns to the document body
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
    if (this.overlay?.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    // Also remove by id in case `this.overlay` is stale
    document.getElementById('name-overlay')?.remove();
    document.getElementById('name-overlay-style')?.remove();
  }

  shutdown(): void {
    this.clearOverlay();
  }
}
