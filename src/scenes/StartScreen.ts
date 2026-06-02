import Phaser from 'phaser';
import { signIn, signUp, getCurrentUser, getUserCharacters, deleteCharacter, Character } from '../services/supabase';
import { HERO_CLASSES } from '../data/heroClasses';
import { Hero } from '../entities/Hero';
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

    // Check if this is a password reset redirect
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Supabase redirected back with a recovery token — show reset form
      const { supabase } = await import('../services/supabase');
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        this.user = data.session.user;
        this.showResetPasswordForm();
        return;
      }
    }

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

      // Scrollable character list — no limit on characters
      const startY = 330;
      const cardH = 60;
      const gap = 10;
      const visibleHeight = 280; // visible area for scrolling
      const totalContentH = characters.length * (cardH + gap);

      // Scrollable container with mask — extend top margin to show hero sprite above first card
      const scrollContainer = this.add.container(0, 0);
      const maskShape = this.make.graphics({});
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(640 - 220, startY - 40, 440, visibleHeight + 35);
      const mask = maskShape.createGeometryMask();
      scrollContainer.setMask(mask);

      // Place all character cards in the scroll container
      for (let i = 0; i < characters.length; i++) {
        this.createCharacterCard(characters[i], 640, startY + i * (cardH + gap), scrollContainer);
      }

      // Scroll state
      let scrollY = 0;
      const maxScroll = Math.max(0, totalContentH - visibleHeight);

      // Mouse wheel scrolling
      this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
        scrollY = Phaser.Math.Clamp(scrollY + dy * 0.5, 0, maxScroll);
        scrollContainer.y = -scrollY;
      });

      // Scrollbar (if content exceeds visible area)
      if (maxScroll > 0) {
        const barX = 640 + 210;
        const barH = visibleHeight;
        const thumbH = Math.max(30, (visibleHeight / totalContentH) * barH);
        // Track
        this.add.rectangle(barX, startY + barH / 2, 6, barH, 0x222233).setOrigin(0.5);
        // Thumb
        const thumb = this.add.rectangle(barX, startY, 6, thumbH, 0x555577).setOrigin(0.5, 0);
        // Update thumb position on scroll
        this.events.on('update', () => {
          const t = maxScroll > 0 ? scrollY / maxScroll : 0;
          thumb.y = startY + t * (barH - thumbH);
        });

        // Scroll indicator text
        this.add.text(640, startY + visibleHeight + 5, '↕ Scroll for more characters', {
          fontSize: '11px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(0.5, 0);
      }

      // "New Character" button below the scroll area
      const newY = startY + visibleHeight + 25;
      this.createNewCharacterButton(newY);

      // Sign out below everything
      this.createSignOutLink(newY + 60);
    } else {
      // No characters yet — just show new character button
      this.createNewCharacterButton(350);
      this.createSignOutLink(430);
    }
  }

  private createCharacterCard(char: Character, x: number, y: number, parentContainer?: Phaser.GameObjects.Container): void {
    const classDef = HERO_CLASSES.find(c => c.id === char.hero_class);
    const color = classDef?.color ?? 0x555555;
    const accent = classDef?.accentColor ?? 0xffffff;
    const className = classDef?.name ?? char.hero_class;

    // Card background
    const bg = this.add.rectangle(x, y, 400, 56, 0x1a1a2e)
      .setStrokeStyle(2, 0x333355)
      .setInteractive({ useHandCursor: true });
    if (parentContainer) parentContainer.add(bg);

    // Hero figure mini
    const figX = x - 165;
    if (classDef) {
      const holder = this.add.container(figX, y + 18);
      holder.setScale(0.7);
      const hero = new Hero(this, 0, 0, classDef.stats, classDef.color, classDef.accentColor, classDef.attackType, classDef.id, 1, true);
      holder.add(hero);
      if (parentContainer) parentContainer.add(holder);
    } else {
      const fb1 = this.add.rectangle(figX, y, 16, 28, color);
      const fb2 = this.add.rectangle(figX + 4, y - 8, 3, 3, accent);
      if (parentContainer) { parentContainer.add(fb1); parentContainer.add(fb2); }
    }

    // Character name
    const nameText = this.add.text(x - 140, y - 12, char.name, {
      fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
    });
    if (parentContainer) parentContainer.add(nameText);

    // Class + level + stage
    const stage = (char.current_stage ?? 0) + 1;
    const infoText = this.add.text(x - 140, y + 8, `${className}  Lv.${char.level}  Stage ${stage}`, {
      fontSize: '12px', color: '#888899', fontFamily: 'monospace',
    });
    if (parentContainer) parentContainer.add(infoText);

    // Gold display
    const goldText = this.add.text(x + 100, y, `${char.gold}g`, {
      fontSize: '13px', color: '#ccaa44', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);
    if (parentContainer) parentContainer.add(goldText);

    // Stats button
    const statsBtn = this.add.rectangle(x + 170, y, 46, 36, 0x334455)
      .setStrokeStyle(1, 0x555577)
      .setInteractive({ useHandCursor: true });
    const statsLabel = this.add.text(x + 170, y, 'STATS', {
      fontSize: '9px', color: '#88aacc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    if (parentContainer) { parentContainer.add(statsBtn); parentContainer.add(statsLabel); }

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

    // Click to select — show Play / Delete options
    bg.on('pointerdown', () => {
      if (!classDef) return;
      this.showCharacterActions(char, classDef, x, y, parentContainer);
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

  private showCharacterActions(
    char: Character,
    classDef: (typeof HERO_CLASSES)[number],
    cardX: number,
    _cardY: number,
    _parentContainer?: Phaser.GameObjects.Container,
  ): void {
    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6)
      .setInteractive();

    const box = this.add.rectangle(cardX, 360, 300, 140, 0x1a1a2e)
      .setStrokeStyle(2, 0xffdd44);

    const title = this.add.text(cardX, 310, char.name, {
      fontSize: '18px', color: '#ffdd44', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Play button
    const playBtn = this.add.rectangle(cardX - 65, 365, 110, 40, 0x33aa55)
      .setStrokeStyle(1, 0x44cc66)
      .setInteractive({ useHandCursor: true });
    const playLabel = this.add.text(cardX - 65, 365, 'PLAY', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Delete button
    const delBtn = this.add.rectangle(cardX + 65, 365, 110, 40, 0x662222)
      .setStrokeStyle(1, 0x884444)
      .setInteractive({ useHandCursor: true });
    const delLabel = this.add.text(cardX + 65, 365, 'DELETE', {
      fontSize: '16px', color: '#cc4444', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const actionObjects: Phaser.GameObjects.GameObject[] = [blocker, box, title, playBtn, playLabel, delBtn, delLabel];
    const closeActions = () => { actionObjects.forEach(o => o.destroy()); };

    playBtn.on('pointerover', () => { playBtn.fillColor = 0x44cc66; });
    playBtn.on('pointerout', () => { playBtn.fillColor = 0x33aa55; });
    playBtn.on('pointerdown', () => {
      closeActions();
      this.scene.start('StageSelect', {
        heroClass: classDef,
        user: this.user,
        characterId: char.id,
        gold: char.gold,
        level: char.level,
        currentXp: char.xp ?? 0,
        currentStage: char.current_stage ?? 0,
        progression: char.progression ?? undefined,
      });
    });

    delBtn.on('pointerover', () => { delBtn.fillColor = 0x883333; });
    delBtn.on('pointerout', () => { delBtn.fillColor = 0x662222; });
    delBtn.on('pointerdown', () => {
      closeActions();
      this.showDeleteConfirm1(char);
    });

    blocker.on('pointerdown', () => { closeActions(); });
  }

  /** First delete confirmation: "Are you sure?" */
  private showDeleteConfirm1(char: Character): void {
    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6)
      .setInteractive();

    const box = this.add.rectangle(640, 340, 380, 150, 0x1a1a2e)
      .setStrokeStyle(2, 0xcc4444);

    const msg = this.add.text(640, 305, `Delete "${char.name}"?`, {
      fontSize: '18px', color: '#ff6666', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const sub = this.add.text(640, 332, 'Are you sure?', {
      fontSize: '13px', color: '#888899', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const yesBtn = this.add.rectangle(590, 380, 90, 36, 0x882222)
      .setStrokeStyle(1, 0xcc4444)
      .setInteractive({ useHandCursor: true });
    const yesLabel = this.add.text(590, 380, 'YES', {
      fontSize: '14px', color: '#ff6666', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const noBtn = this.add.rectangle(690, 380, 90, 36, 0x333344)
      .setStrokeStyle(1, 0x555577)
      .setInteractive({ useHandCursor: true });
    const noLabel = this.add.text(690, 380, 'NO', {
      fontSize: '14px', color: '#ccccdd', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const objects: Phaser.GameObjects.GameObject[] = [blocker, box, msg, sub, yesBtn, yesLabel, noBtn, noLabel];
    const close = () => { objects.forEach(o => o.destroy()); };

    yesBtn.on('pointerover', () => { yesBtn.fillColor = 0xaa3333; });
    yesBtn.on('pointerout', () => { yesBtn.fillColor = 0x882222; });
    yesBtn.on('pointerdown', () => {
      close();
      this.showDeleteConfirm2(char);
    });

    noBtn.on('pointerover', () => { noBtn.fillColor = 0x444455; });
    noBtn.on('pointerout', () => { noBtn.fillColor = 0x333344; });
    noBtn.on('pointerdown', () => { close(); });
  }

  /** Final delete confirmation: "Absolutely sure? Cannot be recovered." */
  private showDeleteConfirm2(char: Character): void {
    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7)
      .setInteractive();

    const box = this.add.rectangle(640, 340, 420, 170, 0x1a1a2e)
      .setStrokeStyle(2, 0xff4444);

    const msg = this.add.text(640, 298, 'Are you absolutely sure?', {
      fontSize: '18px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const sub = this.add.text(640, 328, `"${char.name}" cannot be recovered\nonce deleted.`, {
      fontSize: '13px', color: '#aa6666', fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);

    const yesBtn = this.add.rectangle(580, 388, 120, 36, 0xaa2222)
      .setStrokeStyle(1, 0xff4444)
      .setInteractive({ useHandCursor: true });
    const yesLabel = this.add.text(580, 388, 'DELETE', {
      fontSize: '14px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const noBtn = this.add.rectangle(700, 388, 120, 36, 0x333344)
      .setStrokeStyle(1, 0x555577)
      .setInteractive({ useHandCursor: true });
    const noLabel = this.add.text(700, 388, 'CANCEL', {
      fontSize: '14px', color: '#ccccdd', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const objects: Phaser.GameObjects.GameObject[] = [blocker, box, msg, sub, yesBtn, yesLabel, noBtn, noLabel];
    const close = () => { objects.forEach(o => o.destroy()); };

    yesBtn.on('pointerover', () => { yesBtn.fillColor = 0xcc3333; });
    yesBtn.on('pointerout', () => { yesBtn.fillColor = 0xaa2222; });
    yesBtn.on('pointerdown', async () => {
      yesLabel.setText('...');
      const { error } = await deleteCharacter(char.id);
      close();
      if (error) {
        console.error('Delete failed:', error);
      }
      this.scene.restart();
    });

    noBtn.on('pointerover', () => { noBtn.fillColor = 0x444455; });
    noBtn.on('pointerout', () => { noBtn.fillColor = 0x333344; });
    noBtn.on('pointerdown', () => { close(); });
  }

  private showResetPasswordForm(): void {
    this.clearOverlay();

    this.overlay = document.createElement('div');
    this.overlay.id = 'auth-overlay';
    this.overlay.innerHTML = `
      <div id="auth-box">
        <h2 id="reset-title">Reset Password</h2>
        <p id="reset-desc">Enter your new password below.</p>
        <form id="reset-form">
          <input type="password" id="reset-password" placeholder="New password" required minlength="6" autocomplete="new-password" />
          <input type="password" id="reset-confirm" placeholder="Confirm password" required minlength="6" autocomplete="new-password" />
          <button type="submit" id="reset-submit">Update Password</button>
          <p id="reset-error"></p>
          <p id="reset-success"></p>
        </form>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'reset-style';
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
      #reset-title {
        color: #ffdd44; font-family: monospace; font-size: 22px;
        text-align: center; margin: 0 0 8px 0;
      }
      #reset-desc {
        color: #888899; font-family: monospace; font-size: 13px;
        text-align: center; margin: 0 0 20px 0;
      }
      #reset-form input {
        width: 100%; padding: 12px; margin-bottom: 12px; background: #0d0d1a;
        border: 1px solid #333355; border-radius: 6px; color: #ffffff;
        font-family: monospace; font-size: 14px; box-sizing: border-box;
      }
      #reset-form input:focus { outline: none; border-color: #ffdd44; }
      #reset-form input::placeholder { color: #555566; }
      #reset-submit {
        width: 100%; padding: 12px; background: #33aa55; border: none; border-radius: 6px;
        color: #ffffff; font-family: monospace; font-size: 16px; cursor: pointer;
      }
      #reset-submit:hover { background: #44cc66; }
      #reset-submit:disabled { background: #555566; cursor: wait; }
      #reset-error { color: #ff5555; font-family: monospace; font-size: 13px; margin-top: 10px; }
      #reset-success { color: #44cc55; font-family: monospace; font-size: 13px; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.overlay);

    const form = this.overlay.querySelector('#reset-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = (this.overlay.querySelector('#reset-password') as HTMLInputElement).value;
      const confirm = (this.overlay.querySelector('#reset-confirm') as HTMLInputElement).value;
      const errorEl = this.overlay.querySelector('#reset-error') as HTMLElement;
      const successEl = this.overlay.querySelector('#reset-success') as HTMLElement;
      const submitBtn = this.overlay.querySelector('#reset-submit') as HTMLButtonElement;
      errorEl.textContent = '';
      successEl.textContent = '';

      if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match.';
        return;
      }
      if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        return;
      }

      submitBtn.disabled = true;
      const { supabase } = await import('../services/supabase');
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        errorEl.textContent = error.message;
        submitBtn.disabled = false;
        return;
      }

      successEl.textContent = 'Password updated! Redirecting...';

      // Clear the hash from the URL so it doesn't trigger again
      window.history.replaceState(null, '', window.location.pathname);

      // Redirect to logged-in state after a moment
      setTimeout(() => {
        this.clearOverlay();
        const resetStyle = document.getElementById('reset-style');
        if (resetStyle) resetStyle.remove();
        this.showLoggedInUI();
      }, 1500);
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
          <a href="#" id="auth-forgot">Forgot Password?</a>
          <p id="auth-error"></p>
          <p id="auth-success"></p>
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
      #auth-forgot {
        display: block; text-align: center; margin-top: 10px; color: #6677aa;
        font-family: monospace; font-size: 13px; text-decoration: none; cursor: pointer;
      }
      #auth-forgot:hover { color: #8899cc; }
      #auth-error { color: #ff5555; font-family: monospace; font-size: 13px; margin-top: 10px; min-height: 20px; }
      #auth-success { color: #44cc55; font-family: monospace; font-size: 13px; min-height: 20px; }
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

    // Forgot password
    const forgotLink = this.overlay.querySelector('#auth-forgot') as HTMLAnchorElement;
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = (this.overlay.querySelector('#auth-email') as HTMLInputElement).value.trim();
      const errorEl = this.overlay.querySelector('#auth-error') as HTMLElement;
      const successEl = this.overlay.querySelector('#auth-success') as HTMLElement;
      errorEl.textContent = '';
      successEl.textContent = '';

      if (!email) {
        errorEl.textContent = 'Enter your email address first.';
        return;
      }

      const { supabase } = await import('../services/supabase');
      const currentUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: currentUrl,
      });

      if (error) {
        errorEl.textContent = error.message;
      } else {
        successEl.textContent = 'Password reset email sent! Check your inbox.';
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
