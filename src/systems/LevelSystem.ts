import { EventBus, Events } from './EventBus';
import { Enemy } from '../entities/Enemy';
import type { CharacterProgression } from './CharacterProgression';

// XP curve from GDD:
function xpForLevel(level: number): number {
  if (level <= 10) return 50 + level * 20;
  if (level <= 30) return 200 + level * 40;
  if (level <= 70) return 500 + level * 80;
  return 1000 + level * 150;
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
