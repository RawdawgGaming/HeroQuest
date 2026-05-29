import Phaser from 'phaser';
import { StartScreen } from './scenes/StartScreen';
import { HeroSelect } from './scenes/HeroSelect';
import { CharacterName } from './scenes/CharacterName';
import { ForestStage } from './scenes/ForestStage';
import { Shop } from './scenes/Shop';
import { StageSelect } from './scenes/StageSelect';
import { ForestCloneScene } from './scenes/ForestCloneScene';

const directScene = new URLSearchParams(window.location.search).get('scene');
const isForestCloneDirect = directScene === 'forest-clone';
const scenes = directScene === 'forest-clone'
  ? [ForestCloneScene, StartScreen, HeroSelect, CharacterName, StageSelect, ForestStage, Shop]
  : [StartScreen, HeroSelect, CharacterName, StageSelect, ForestStage, ForestCloneScene, Shop];

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#111122',
  pixelArt: true,        // Nearest-neighbor scaling, no smoothing
  roundPixels: true,     // Integer pixel positions, no sub-pixel blurring
  antialias: false,      // Disable texture antialiasing
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: scenes,
  scale: {
    mode: isForestCloneDirect ? Phaser.Scale.NONE : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Snap the displayed canvas size to integer pixels to prevent
    // fractional CSS scaling that causes background shimmer/jitter.
    snap: { width: 2, height: 2 },
  },
};

const game = new Phaser.Game(config);
(window as any).__PHASER_GAME__ = game;
