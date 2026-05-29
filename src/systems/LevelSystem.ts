import { EventBus, Events } from './EventBus';
import { Enemy } from '../entities/Enemy';
import type { CharacterProgression } from './CharacterProgression';

// =============================================================================
// XP CURVE — how much XP is needed to go from level N to level N+1.
// =============================================================================
// Tuned so that:
//   - early levels (1-5) come at a brisk pace (~2-3 per stage)
//   - mid levels (6-15) slow to ~1 per stage
//   - later levels (16+) require multiple stages to gain a level
//   - by stage 8, the hero should be roughly level 10-12, NOT 24
//
// The curve uses a quadratic component so requirements accelerate with level.
function xpForLevel(level: number): number {
  if (level <= 5)  return 80 + level * 30;                     // 110..230
  if (level <= 15) return 150 + level * 60 + level * level * 4; // ~510..2,250
  if (level <= 30) return 300 + level * 100 + level * level * 6; // ~2,240..8,700
  return 500 + level * 150 + level * level * 10;                // 10,800+
}

export class LevelSystem {
  level = 1;
  currentXp = 0;
  xpToNext: number;
  progression: CharacterProgression;

  constructor(startingLevel = 1, progression?: CharacterProgression) {
    this.level = startingLevel;
    this.xpToNext = xpForLevel(this.level);
    this.progression = progression ?? {
      attrPointsAvailable: 0,
      attributes: {},
      skillPointsAvailable: 0,
      skills: {},
    };
    EventBus.on(Events.ENEMY_DIED, this.onEnemyDied, this);
  }

  private onEnemyDied = (enemy: Enemy): void => {
    this.addXp(enemy.stats.xpReward);
  };

  addXp(amount: number): void {
    this.currentXp += amount;

    while (this.currentXp >= this.xpToNext) {
      this.currentXp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);

      // Award 1 attribute point + 1 skill point per level
      this.progression.attrPointsAvailable++;
      this.progression.skillPointsAvailable++;

      EventBus.emit(Events.HERO_LEVELED_UP, this.level);
    }

    EventBus.emit(Events.HERO_XP_CHANGED, this.currentXp, this.xpToNext, this.level);
  }

  emitCurrent(): void {
    EventBus.emit(Events.HERO_XP_CHANGED, this.currentXp, this.xpToNext, this.level);
  }

  destroy(): void {
    EventBus.off(Events.ENEMY_DIED, this.onEnemyDied, this);
  }
}
