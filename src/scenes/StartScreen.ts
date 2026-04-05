import Phaser from 'phaser';
import { signIn, signUp, getCurrentUser, getUserCharacters, Character } from '../services/supabase';
import { HERO_CLASSES } from '../data/heroClasses';
import type { User } from '@supabase/supabase-js';

export class StartScreen extends Phaser.Scene {
  private overlay!: HTMLDivElement;
  private user: User | null = null;

  constructor() {
    super('StartScreen');
  }

  async create(): Promise<void> {
    // Background
    this.cameras.main.setBackgroundColor(0x111122);

    // Animated particles in background
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, 1280);
      const y = Phaser.Math.Between(0, 720);
      const size = Phaser.Math.Between(1, 3);
      const star = this.add.circle(x, y, size, 0xffffff, Phaser.Math.FloatBetween(0.1, 0.5));
      this.tweens.add({
        targets: star,
        alpha: 0,
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // Title
    this.add.text(640, 120, 'HERO QUEST', {
      fontSize: '72px',
      color: '#ffdd44',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(640, 185, 'A Side-Scrolling Action RPG', {
      fontSize: '18px',
      color: '#aaaacc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Check for existing session
    this.user = await getCurrentUser();
    if (this.user) {
      this.showLoggedInUI();
    } else {
      this.showLoginForm();
    }
  }

  private async showLoggedInUI(): Promise<void> {
    this.clearOverlay();

    const email = this.user!.email ?? 'Hero';

    // Welcome text
    this.add.text(640, 240, `Welcome back, ${email}!`, {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Fetch existing characters
    const characters = await getUserCharacters(this.user!.id);

    if (characters.length > 0) {
      this.add.text(640, 280, 'Your Characters', {
        fontSize: '16px',
        color: '#aaaacc',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      // Render character cards
      const startY = 330;
      const cardH = 60;
      const gap = 10;
      const maxVisible = Math.min(characters.length, 4); // show up to 4

      for (let i = 0; i < maxVisible; i++) {
        this.createCharacterCard(characters[i], 640, startY + i * (cardH + gap));
      }

      // "New Character" button below the list
      const newY = startY + maxVisible * (cardH + gap) + 10;
      this.createNewCharacterButton(newY);

      // Sign out below everything
      this.createSignOutLink(newY + 60);
    } else {
      // No characters yet — just show new character button
      this.createNewCharacterButton(350);
      this.createSignOutLink(430);
    }
  }

  private createCharacterCard(char: Character, x: number, y: number): void {
    const classDef = HERO_CLASSES.find(c => c.id === char.hero_class);
    const color = classDef?.color ?? 0x555555;
    const accent = classDef?.accentColor ?? 0xffffff;
    const className = classDef?.name ?? char.hero_class;

    // Card background
    const bg = this.add.rectangle(x, y, 400, 56, 0x1a1a2e)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });

    // Hero figure mini
    const figX = x - 165;
    if (char.hero_class === 'necromancer') {
      // Mini necromancer: robe, skull, green eyes, staff
      this.add.rectangle(figX, y + 4, 16, 14, 0x1a1a22);    // robe bottom
      this.add.rectangle(figX, y - 4, 14, 12, 0x222233);     // robe top
      this.add.circle(figX, y - 11, 7, 0x111118);            // hood
      this.add.circle(figX, y - 10, 5, 0xccddbb);            // skull
      const eL = this.add.circle(figX - 2, y - 11, 1, 0x44ff66);  // eye L
      const eR = this.add.circle(figX + 2, y - 11, 1, 0x44ff66);  // eye R
      this.tweens.add({ targets: [eL, eR], alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
      this.add.rectangle(figX + 9, y - 6, 2, 20, 0x443322);  // staff
      const orb = this.add.circle(figX + 9, y - 16, 3, 0x33ff55, 0.7); // staff orb
      this.tweens.add({ targets: orb, alpha: 0.3, duration: 1000, yoyo: true, repeat: -1 });
    } else {
      this.add.rectangle(figX, y, 16, 28, color);
      this.add.rectangle(figX + 4, y - 8, 3, 3, accent);
    }

    // Character name
    this.add.text(x - 140, y - 12, char.name, {
      fontSize: '18px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    });

    // Class + level + stage
    const stage = (char.current_stage ?? 0) + 1;
    this.add.text(x - 140, y + 8, `${className}  Lv.${char.level}  Stage ${stage}`, {
      fontSize: '12px',
      color: '#888899',
      fontFamily: 'monospace',
    });

    // Gold display
    this.add.text(x + 100, y, `${char.gold}g`, {
      fontSize: '13px',
      color: '#ccaa44',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Stats button (right side of card)
    const statsBtn = this.add.rectangle(x + 170, y, 46, 36, 0x334455)
      .setStrokeStyle(1, 0x555577)
      .setInteractive({ useHandCursor: true });
    this.add.text(x + 170, y, 'STATS', {
      fontSize: '9px', color: '#88aacc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    statsBtn.on('pointerover', () => { statsBtn.setStrokeStyle(1, 0x88aacc); statsBtn.fillColor = 0x3a3a4e; });
    statsBtn.on('pointerout', () => { statsBtn.setStrokeStyle(1, 0x555577); statsBtn.fillColor = 0x334455; });
    statsBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (!classDef) return;
      this.scene.start('Shop', {
        heroClass: classDef,
        user: this.user,
        characterId: char.id,
        gold: char.gold,
        level: char.level,
        currentXp: char.xp ?? 0,
        stageIndex: char.current_stage ?? 0,
        progression: char.progression ?? undefined,
        fromMainMenu: true,
      });
    });

    // Hover effects
    bg.on('pointerover', () => { bg.setStrokeStyle(2, 0xffdd44); });
    bg.on('pointerout', () => { bg.setStrokeStyle(2, 0x333355); });

    // Click to play — load saved progress
    bg.on('pointerdown', () => {
      if (!classDef) return;
      this.scene.start('ForestStage', {
        heroClass: classDef,
        user: this.user,
        characterId: char.id,
        gold: char.gold,
        level: char.level,
        currentXp: char.xp ?? 0,
        stageIndex: char.current_stage ?? 0,
        progression: char.progression ?? undefined,
      });
    });
  }

  private createNewCharacterButton(y: number): void {
    const btn = this.add.rectangle(640, y, 260, 50, 0x333355)
      .setStrokeStyle(2, 0x555577)
      .setInteractive({ useHandCursor: true });

    this.add.text(640, y, '+ New Character', {
      fontSize: '18px',
      color: '#aaaacc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setStrokeStyle(2, 0x88aacc); btn.fillColor = 0x3a3a4e; });
    btn.on('pointerout', () => { btn.setStrokeStyle(2, 0x555577); btn.fillColor = 0x333355; });
    btn.on('pointerdown', () => {
      this.scene.start('HeroSelect', { user: this.user });
    });
  }

  private createSignOutLink(y: number): void {
    const signOutText = this.add.text(640, y, 'Sign Out', {
      fontSize: '14px',
      color: '#666677',
      fontFamily: 'monospace',
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    signOutText.on('pointerover', () => { signOutText.setColor('#ccccdd'); });
    signOutText.on('pointerout', () => { signOutText.setColor('#666677'); });
    signOutText.on('pointerdown', async () => {
      const { signOut } = await import('../services/supabase');
      await signOut();
      this.scene.restart();
    });
  }

  private showLoginForm(): void {
    this.clearOverlay();

    // Create HTML overlay for the login form (Phaser has no text inputs)
    this.overlay = document.createElement('div');
    this.overlay.id = 'auth-overlay';
    this.overlay.innerHTML = `
      <div id="auth-box">
        <div id="auth-tabs">
          <button class="auth-tab active" data-tab="login">Sign In</button>
          <button class="auth-tab" data-tab="signup">Sign Up</button>
        </div>
        <form id="auth-form">
          <input type="email" id="auth-email" placeholder="Email" required autocomplete="email" />
          <input type="password" id="auth-password" placeholder="Password" required autocomplete="current-password" />
          <button type="submit" id="auth-submit">Sign In</button>
          <p id="auth-error"></p>
        </form>
      </div>
    `;

    // Style it
    const style = document.createElement('style');
    style.textContent = `
      #auth-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; justify-content: center; align-items: center;
        pointer-events: none; z-index: 1000;
      }
      #auth-box {
        pointer-events: all;
        background: #1a1a2e; border: 2px solid #333355; border-radius: 12px;
        padding: 30px; width: 340px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      }
      #auth-tabs {
        display: flex; gap: 0; margin-bottom: 20px; border-bottom: 2px solid #333355;
      }
      .auth-tab {
        flex: 1; padding: 10px; background: none; border: none; color: #666688;
        font-family: monospace; font-size: 16px; cursor: pointer; transition: color 0.2s;
      }
      .auth-tab.active { color: #ffdd44; border-bottom: 2px solid #ffdd44; margin-bottom: -2px; }
      .auth-tab:hover { color: #aaaacc; }
      #auth-form input {
        width: 100%; padding: 12px; margin-bottom: 12px; background: #0d0d1a;
        border: 1px solid #333355; border-radius: 6px; color: #ffffff;
        font-family: monospace; font-size: 14px; box-sizing: border-box;
      }
      #auth-form input:focus { outline: none; border-color: #ffdd44; }
      #auth-form input::placeholder { color: #555566; }
      #auth-submit {
        width: 100%; padding: 12px; background: #33aa55; border: none; border-radius: 6px;
        color: #ffffff; font-family: monospace; font-size: 16px; cursor: pointer;
        transition: background 0.2s;
      }
      #auth-submit:hover { background: #44cc66; }
      #auth-submit:disabled { background: #555566; cursor: wait; }
      #auth-error { color: #ff5555; font-family: monospace; font-size: 13px; margin-top: 10px; min-height: 20px; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.overlay);

    // Tab switching
    let mode: 'login' | 'signup' = 'login';
    const tabs = this.overlay.querySelectorAll('.auth-tab');
    const submitBtn = this.overlay.querySelector('#auth-submit') as HTMLButtonElement;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        mode = (tab as HTMLElement).dataset.tab as 'login' | 'signup';
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        submitBtn.textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
        (this.overlay.querySelector('#auth-error') as HTMLElement).textContent = '';
      });
    });

    // Form submission
    const form = this.overlay.querySelector('#auth-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (this.overlay.querySelector('#auth-email') as HTMLInputElement).value.trim();
      const password = (this.overlay.querySelector('#auth-password') as HTMLInputElement).value;
      const errorEl = this.overlay.querySelector('#auth-error') as HTMLElement;
      errorEl.textContent = '';
      submitBtn.disabled = true;

      try {
        if (mode === 'signup') {
          const { user, error } = await signUp(email, password);
          if (error) { errorEl.textContent = error; return; }
          if (user) {
            this.user = user;
            this.clearOverlay();
            this.showLoggedInUI();
          } else {
            errorEl.textContent = 'Check your email to confirm your account.';
          }
        } else {
          const { user, error } = await signIn(email, password);
          if (error) { errorEl.textContent = error; return; }
          this.user = user;
          this.clearOverlay();
          this.showLoggedInUI();
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  private clearOverlay(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }

  shutdown(): void {
    this.clearOverlay();
  }
}
