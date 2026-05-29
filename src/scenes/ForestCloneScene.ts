import Phaser from 'phaser';
import { Hero } from '../entities/Hero';
import { HERO_CLASSES } from '../data/heroClasses';
import {
  forestCloneLevel,
  type ForestCloneLayer,
  type ForestCloneLevelConfig,
  type ForestCloneRect,
} from '../levels/forestCloneLevel';

type WaterOverlay = {
  zone: ForestCloneRect & { speed: number; waveAmplitude: number; alpha: number; shimmerColor: number };
  shimmer: Phaser.GameObjects.Graphics;
};

type ParallaxRuntimeLayer = {
  config: ForestCloneLayer;
  images: Phaser.GameObjects.Image[];
  stripWidth: number;
};

export class ForestCloneScene extends Phaser.Scene {
  private readonly level: ForestCloneLevelConfig = forestCloneLevel;
  private hero!: Hero;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private parallaxDebugKey!: Phaser.Input.Keyboard.Key;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private parallaxDebugText!: Phaser.GameObjects.Text;
  private collisionBodies!: Phaser.Physics.Arcade.StaticGroup;
  private parallaxRuntimeLayers: ParallaxRuntimeLayer[] = [];
  private waterOverlays: WaterOverlay[] = [];
  private debugVisible = false;
  private parallaxDebugVisible = false;
  private masterImage!: Phaser.GameObjects.Image;

  constructor() {
    super('ForestCloneScene');
  }

  preload(): void {
    this.load.image(this.level.image.key, this.level.image.path);

    for (const layer of this.level.parallaxLayers) {
      this.load.image(layer.key, layer.path);
    }

  }

  create(): void {
    this.cameras.main.setBackgroundColor('#102014');
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(1);

    this.textures.get(this.level.image.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const layer of this.level.parallaxLayers) {
      this.textures.get(layer.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.physics.world.setBounds(
      this.level.worldBounds.x,
      this.level.worldBounds.y,
      this.level.worldBounds.width,
      this.level.worldBounds.height,
    );

    // Master visual layer: exact native reference art, unscaled and unfiltered.
    this.masterImage = this.add.image(0, 0, this.level.image.key)
      .setOrigin(0, 0)
      .setScrollFactor(1)
      .setDepth(-100);

    this.createParallaxOverlays();
    this.createWaterOverlays();
    this.createCollisionBodies();

    const paladin = HERO_CLASSES[0];
    this.hero = new Hero(
      this,
      this.level.spawn.x,
      this.level.spawn.y,
      paladin.stats,
      paladin.color,
      paladin.accentColor,
      paladin.attackType,
      paladin.id,
      1,
    );
    this.hero.setDepth(this.level.spawn.y);
    (this.hero.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.add.collider(this.hero, this.collisionBodies);

    this.cameras.main.setBounds(
      this.level.cameraBounds.x,
      this.level.cameraBounds.y,
      this.level.cameraBounds.width,
      this.level.cameraBounds.height,
    );
    this.cameras.main.startFollow(this.hero, true, 1, 1);
    this.cameras.main.setFollowOffset(0, -78);

    this.debugGraphics = this.add.graphics().setDepth(2000);
    this.debugKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    this.parallaxDebugKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F4);
    this.redrawDebug();
    this.debugGraphics.setVisible(false);

    this.add.text(18, 18, 'Forest Clone  F3 collision  F4 parallax', {
      fontSize: '14px',
      color: '#d9f6cf',
      fontFamily: 'monospace',
      stroke: '#102014',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(3000);

    this.parallaxDebugText = this.add.text(18, 42, '', {
      fontSize: '13px',
      color: '#9fffea',
      fontFamily: 'monospace',
      stroke: '#102014',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(3000).setVisible(false);

    this.recordRenderStats();
  }

  update(time: number, delta: number): void {
    this.hero.update(time, delta);
    this.snapHeroToPaintedPath();
    this.updateParallaxFromCamera();
    this.animateWater(time, delta);

    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.debugVisible = !this.debugVisible;
      this.debugGraphics.setVisible(this.debugVisible);
    }

    if (Phaser.Input.Keyboard.JustDown(this.parallaxDebugKey)) {
      this.parallaxDebugVisible = !this.parallaxDebugVisible;
      this.parallaxDebugText.setVisible(this.parallaxDebugVisible);
    }

    if (this.parallaxDebugVisible) {
      this.updateParallaxDebugText();
    }
  }

  private createParallaxOverlays(): void {
    for (const layer of this.level.parallaxLayers) {
      const stripKey = this.ensureParallaxStripTexture(layer);
      const stripWidth = layer.source?.width ?? layer.width;
      const imageCount = layer.parallaxFactorX > 1 ? 2 : 1;
      const images: Phaser.GameObjects.Image[] = [];

      for (let index = 0; index < imageCount; index++) {
        const image = this.add.image(layer.x + stripWidth * index, layer.y, stripKey)
          .setOrigin(0, 0)
          .setDepth(layer.depth)
          .setAlpha(layer.alpha)
          .setScrollFactor(1);

        if (layer.blendMode !== undefined) {
          image.setBlendMode(layer.blendMode);
        }

        images.push(image);
      }

      this.parallaxRuntimeLayers.push({ config: layer, images, stripWidth });
    }

    this.updateParallaxFromCamera();
  }

  private ensureParallaxStripTexture(layer: ForestCloneLayer): string {
    const stripKey = `${layer.key}RuntimeStrip`;
    if (this.textures.exists(stripKey)) return stripKey;

    const sourceRect = layer.source ?? { x: 0, y: layer.y, width: layer.width, height: layer.height };
    const sourceImage = this.textures.get(this.level.image.key).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = sourceRect.width;
    canvas.height = sourceRect.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(`Could not create parallax strip canvas for ${layer.key}`);
    }

    context.imageSmoothingEnabled = false;
    context.drawImage(
      sourceImage,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      0,
      0,
      sourceRect.width,
      sourceRect.height,
    );

    const stripTexture = this.textures.addCanvas(stripKey, canvas);
    if (!stripTexture) {
      throw new Error(`Could not register parallax strip texture for ${layer.key}`);
    }
    stripTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return stripKey;
  }

  private updateParallaxFromCamera(): void {
    const scrollX = this.cameras.main.scrollX;

    for (const layer of this.parallaxRuntimeLayers) {
      const baseX = layer.config.x + scrollX * (1 - layer.config.parallaxFactorX);

      for (let index = 0; index < layer.images.length; index++) {
        const image = layer.images[index];
        image.x = Math.round(baseX + layer.stripWidth * index);
        image.y = layer.config.y;
      }
    }
  }

  private createWaterOverlays(): void {
    for (const zone of this.level.waterZones) {
      const shimmer = this.add.graphics().setDepth(-9).setAlpha(zone.alpha * 0.8);
      this.waterOverlays.push({ zone, shimmer });
    }
  }

  private createCollisionBodies(): void {
    this.collisionBodies = this.physics.add.staticGroup();

    for (const rect of this.level.collisionRects) {
      const body = this.add.rectangle(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width,
        rect.height,
        0x00ff88,
        0,
      );
      this.physics.add.existing(body, true);
      this.collisionBodies.add(body);
    }
  }

  private snapHeroToPaintedPath(): void {
    const x = Phaser.Math.Clamp(this.hero.x, 28, this.level.image.width - 28);
    const pathY = this.getWalkPathY(x);

    this.hero.x = x;
    this.hero.y = Phaser.Math.Linear(this.hero.y, pathY, 0.35);
    this.hero.groundY = this.hero.y;
    this.hero.setDepth(this.hero.groundY);

    const body = this.hero.body as Phaser.Physics.Arcade.Body;
    body.y = this.hero.y - body.height / 2;
  }

  private getWalkPathY(x: number): number {
    const points = this.level.walkPath;
    if (x <= points[0].x) return points[0].y;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const next = points[i];
      if (x <= next.x) {
        const t = Phaser.Math.Clamp((x - prev.x) / (next.x - prev.x), 0, 1);
        return Phaser.Math.Linear(prev.y, next.y, t);
      }
    }

    return points[points.length - 1].y;
  }

  private animateWater(time: number, delta: number): void {
    for (const overlay of this.waterOverlays) {
      const zone = overlay.zone;
      overlay.shimmer.clear();
      overlay.shimmer.fillStyle(zone.shimmerColor, zone.alpha);

      const bandGap = 76;
      const bandWidth = 34;
      const phase = ((time * zone.speed * Math.sign(zone.speed || 1)) % bandGap + bandGap) % bandGap;
      for (let x = zone.x - bandGap; x < zone.x + zone.width + bandGap; x += bandGap) {
        const sx = x + phase;
        const wave = Math.sin((sx + time * 0.035) * 0.035) * zone.waveAmplitude;
        overlay.shimmer.fillRect(Math.round(sx), Math.round(zone.y + zone.height * 0.34 + wave), bandWidth, 1);
        overlay.shimmer.fillRect(Math.round(sx + 18), Math.round(zone.y + zone.height * 0.68 - wave), bandWidth * 0.55, 1);
      }
    }
  }

  private recordRenderStats(): void {
    const texture = this.textures.get(this.level.image.key);
    const source = texture.getSourceImage() as HTMLImageElement;
    (window as any).__FOREST_CLONE_RENDER_STATS__ = {
      sourceWidth: source.width,
      sourceHeight: source.height,
      configuredWidth: this.level.image.width,
      configuredHeight: this.level.image.height,
      displayWidth: this.masterImage.displayWidth,
      displayHeight: this.masterImage.displayHeight,
      scaleX: this.masterImage.scaleX,
      scaleY: this.masterImage.scaleY,
      cameraZoom: this.cameras.main.zoom,
      canvasWidth: this.game.canvas.width,
      canvasHeight: this.game.canvas.height,
      cssWidth: this.game.canvas.style.width,
      cssHeight: this.game.canvas.style.height,
      parallaxFactors: this.level.parallaxLayers.map((layer) => ({
        key: layer.key,
        parallaxFactorX: layer.parallaxFactorX,
        alpha: layer.alpha,
      })),
    };
  }

  private updateParallaxDebugText(): void {
    const scrollX = Math.round(this.cameras.main.scrollX);
    const lines = [`scrollX=${scrollX}`];

    for (const layer of this.parallaxRuntimeLayers) {
      lines.push(`${layer.config.key}: factor=${layer.config.parallaxFactorX} x=${Math.round(layer.images[0].x)}`);
    }

    this.parallaxDebugText.setText(lines.join('\n'));
  }

  private redrawDebug(): void {
    this.debugGraphics.clear();

    this.debugGraphics.lineStyle(2, 0x34ff96, 0.9);
    for (const rect of this.level.collisionRects) {
      this.debugGraphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    this.debugGraphics.lineStyle(3, 0xffe066, 0.95);
    const path = this.level.walkPath;
    for (let i = 1; i < path.length; i++) {
      this.debugGraphics.lineBetween(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
    }

    this.debugGraphics.lineStyle(2, 0x62d5ff, 0.8);
    for (const zone of this.level.waterZones) {
      this.debugGraphics.strokeRect(zone.x, zone.y, zone.width, zone.height);
    }
  }
}
