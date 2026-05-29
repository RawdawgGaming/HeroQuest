export type ForestCloneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type ForestClonePathPoint = {
  x: number;
  y: number;
};

export type ForestCloneLayer = {
  key: string;
  path: string;
  source?: ForestCloneRect;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  alpha: number;
  parallaxFactorX: number;
  blendMode?: Phaser.BlendModes | string;
};

export type ForestCloneWaterZone = ForestCloneRect & {
  alpha: number;
  speed: number;
  waveAmplitude: number;
  shimmerColor: number;
};

export interface ForestCloneLevelConfig {
  id: string;
  image: {
    key: string;
    path: string;
    width: number;
    height: number;
  };
  spawn: ForestClonePathPoint;
  cameraBounds: ForestCloneRect;
  worldBounds: ForestCloneRect;
  parallaxLayers: ForestCloneLayer[];
  collisionRects: ForestCloneRect[];
  walkPath: ForestClonePathPoint[];
  raisedPlatforms: ForestCloneRect[];
  waterZones: ForestCloneWaterZone[];
}

const mapRoot = 'assets/env';

export const forestCloneLevel: ForestCloneLevelConfig = {
  id: 'forest-clone',
  image: {
    key: 'forestCloneMaster',
    path: `${mapRoot}/stage2-bg.png`,
    width: 1896,
    height: 830,
  },
  spawn: { x: 150, y: 492 },
  cameraBounds: { x: 0, y: 0, width: 1896, height: 830 },
  worldBounds: { x: 0, y: 360, width: 1896, height: 270 },

  // The full master image is always rendered at scroll factor 1 for gameplay
  // accuracy. These source-image strips are duplicated at runtime and moved
  // explicitly from camera.scrollX so the depth remains visible.
  parallaxLayers: [
    {
      key: 'forestCloneFarBackgroundStrip',
      path: `${mapRoot}/stage2-bg.png`,
      source: { x: 0, y: 0, width: 1896, height: 290 },
      x: 0,
      y: 0,
      width: 1896,
      height: 290,
      depth: -90,
      alpha: 0.24,
      parallaxFactorX: 0.18,
    },
    {
      key: 'forestCloneBlueDepthStrip',
      path: `${mapRoot}/stage2-bg.png`,
      source: { x: 0, y: 286, width: 1896, height: 150 },
      x: 0,
      y: 286,
      width: 1896,
      height: 150,
      depth: -80,
      alpha: 0.18,
      parallaxFactorX: 0.35,
      blendMode: Phaser.BlendModes.SCREEN,
    },
    {
      key: 'forestCloneMidTreeStrip',
      path: `${mapRoot}/stage2-bg.png`,
      source: { x: 0, y: 332, width: 1896, height: 185 },
      x: 0,
      y: 332,
      width: 1896,
      height: 185,
      depth: -70,
      alpha: 0.16,
      parallaxFactorX: 0.62,
    },
    {
      key: 'forestCloneForegroundFoliageStrip',
      path: `${mapRoot}/stage2-bg.png`,
      source: { x: 0, y: 600, width: 1896, height: 230 },
      x: 0,
      y: 600,
      width: 1896,
      height: 230,
      depth: 760,
      alpha: 0.26,
      parallaxFactorX: 1.12,
    },
  ],

  // Rects are intentionally broad and editable. The walking curve below is what
  // keeps the hero feet aligned to the visible painted path.
  collisionRects: [
    { x: 0, y: 456, width: 1220, height: 96, label: 'main forest walk band' },
    { x: 1220, y: 430, width: 676, height: 104, label: 'golden gate walk band' },
    { x: 540, y: 382, width: 280, height: 34, label: 'left raised moss ledge' },
    { x: 990, y: 372, width: 290, height: 34, label: 'center raised moss ledge' },
  ],

  // Sampled from the visible ground path in the source image. Add points here
  // to tune the hero foot line without touching scene code.
  walkPath: [
    { x: 0, y: 494 },
    { x: 180, y: 492 },
    { x: 390, y: 488 },
    { x: 610, y: 490 },
    { x: 820, y: 488 },
    { x: 1040, y: 482 },
    { x: 1240, y: 462 },
    { x: 1450, y: 452 },
    { x: 1680, y: 452 },
    { x: 1896, y: 466 },
  ],

  raisedPlatforms: [
    { x: 540, y: 382, width: 280, height: 34, label: 'left raised moss ledge' },
    { x: 990, y: 372, width: 290, height: 34, label: 'center raised moss ledge' },
  ],

  waterZones: [
    {
      x: 0,
      y: 510,
      width: 1896,
      height: 44,
      alpha: 0.08,
      speed: 0.1,
      waveAmplitude: 0.8,
      shimmerColor: 0x5bd6e6,
      label: 'foreground creek',
    },
    {
      x: 430,
      y: 410,
      width: 270,
      height: 22,
      alpha: 0.055,
      speed: -0.08,
      waveAmplitude: 0.5,
      shimmerColor: 0x48c3d8,
      label: 'left pond ledge',
    },
    {
      x: 860,
      y: 408,
      width: 330,
      height: 22,
      alpha: 0.055,
      speed: -0.08,
      waveAmplitude: 0.5,
      shimmerColor: 0x48c3d8,
      label: 'center pond ledge',
    },
  ],
};
