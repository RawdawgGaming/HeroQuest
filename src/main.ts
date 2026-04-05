import Phaser from 'phaser';
import { StartScreen } from './scenes/StartScreen';
import { HeroSelect } from './scenes/HeroSelect';
import { CharacterName } from './scenes/CharacterName';
import { ForestStage } from './scenes/ForestStage';
import { Shop } from './scenes/Shop';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#111122',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [StartScreen, HeroSelect, CharacterName, ForestStage, Shop],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
