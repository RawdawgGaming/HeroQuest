import Phaser from 'phaser';

// Global event bus for cross-system communication
export const EventBus = new Phaser.Events.EventEmitter();

// Event name constants
export const Events = {
  HERO_HEALTH_CHANGED: 'hero_health_changed',
  HERO_DIED: 'hero_died',
  ENEMY_DIED: 'enemy_died',
  HERO_GOLD_CHANGED: 'hero_gold_changed',    // (totalGold)
  HERO_XP_CHANGED: 'hero_xp_changed',      // (currentXp, xpToNext, level)
  HERO_LEVELED_UP: 'hero_leveled_up',        // (newLevel)
  WAVE_STARTED: 'wave_started',
  WAVE_CLEARED: 'wave_cleared',
  STAGE_COMPLETED: 'stage_completed',
} as const;
