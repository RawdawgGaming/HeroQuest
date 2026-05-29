// ============================================================================
// BOUNDARY EDITOR — in-game tool for defining walk zone polygons
// ============================================================================
// Toggle with B key. Click to place points. Right-click/Enter to close polygon.
// S to save/export JSON. L to load. V to toggle debug overlay.

import Phaser from 'phaser';
import { WalkZoneManager, type WalkZone, type WalkZonePoint, type WalkBoundaryData } from './WalkZoneManager';

const POINT_RADIUS = 6;
const POINT_COLOR = 0x00ff88;
const POINT_SELECTED_COLOR = 0xff4444;
const LINE_COLOR = 0x00ff88;
const FILL_COLOR = 0x00ff88;
const FILL_ALPHA = 0.12;
const LINE_WIDTH = 2;
const CLOSED_LINE_COLOR = 0x44ff44;
const DEBUG_TEXT_COLOR = '#0f0';

export class BoundaryEditor {
  private scene: Phaser.Scene;
  private manager: WalkZoneManager;
  private graphics: Phaser.GameObjects.Graphics;
  private debugText: Phaser.GameObjects.Text;

  private active = false;
  private debugVisible = false;

  // Current polygon being drawn
  private currentPoints: WalkZonePoint[] = [];
  private closedZones: WalkZone[] = [];
  private nextZoneId = 1;

  // Dragging
  private selectedPointIndex = -1;
  private selectedZoneIndex = -1;
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };

  // Keys
  private keyB!: Phaser.Input.Keyboard.Key;
  private keyV!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keyBackspace!: Phaser.Input.Keyboard.Key;
  private keyDelete!: Phaser.Input.Keyboard.Key;

  // Image info for export
  private imageWidth = 0;
  private imageHeight = 0;

  constructor(scene: Phaser.Scene, manager: WalkZoneManager, imageWidth: number, imageHeight: number) {
    this.scene = scene;
    this.manager = manager;
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;

    this.graphics = scene.add.graphics().setDepth(9000);
    this.debugText = scene.add.text(10, 50, '', {
      fontSize: '12px', color: DEBUG_TEXT_COLOR, backgroundColor: '#000a',
      padding: { x: 4, y: 2 },
    }).setScrollFactor(0).setDepth(9001).setVisible(false);

    // Load existing zones from manager
    this.closedZones = [...manager.allZones];
    this.nextZoneId = this.closedZones.length + 1;

    // Register keys
    const kb = scene.input.keyboard!;
    this.keyB = kb.addKey('B');
    this.keyV = kb.addKey('V');
    this.keyS = kb.addKey('S');
    this.keyL = kb.addKey('L');
    this.keyC = kb.addKey('C');
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keyBackspace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    this.keyDelete = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE);

    // Mouse handlers
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  update(): void {
    // Toggle edit mode
    if (Phaser.Input.Keyboard.JustDown(this.keyB)) {
      this.active = !this.active;
      console.log(`[BoundaryEditor] Edit mode: ${this.active ? 'ON' : 'OFF'}`);
    }

    // Toggle debug overlay
    if (Phaser.Input.Keyboard.JustDown(this.keyV)) {
      this.debugVisible = !this.debugVisible;
      this.debugText.setVisible(this.debugVisible);
    }

    if (this.active) {
      // Close polygon
      if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.closeCurrentPolygon();
      }
      // Delete last point
      if (Phaser.Input.Keyboard.JustDown(this.keyBackspace)) {
        if (this.currentPoints.length > 0) {
          this.currentPoints.pop();
        }
      }
      // Delete selected point from closed zone
      if (Phaser.Input.Keyboard.JustDown(this.keyDelete)) {
        this.deleteSelectedPoint();
      }
      // Clear current polygon
      if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
        this.currentPoints = [];
        this.selectedPointIndex = -1;
        this.selectedZoneIndex = -1;
      }
      // Cancel
      if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
        this.currentPoints = [];
        this.selectedPointIndex = -1;
        this.selectedZoneIndex = -1;
      }
      // Save
      if (Phaser.Input.Keyboard.JustDown(this.keyS)) {
        this.exportJSON();
      }
      // Load
      if (Phaser.Input.Keyboard.JustDown(this.keyL)) {
        this.importJSON();
      }
    }

    this.draw();
    this.updateDebugText();
  }

  private getWorldPointer(): WalkZonePoint {
    const pointer = this.scene.input.activePointer;
    const wp = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    return { x: Math.round(wp.x), y: Math.round(wp.y) };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;

    const wp = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const wx = Math.round(wp.x), wy = Math.round(wp.y);

    // Right click = close polygon
    if (pointer.rightButtonDown()) {
      this.closeCurrentPolygon();
      return;
    }

    if (!pointer.leftButtonDown()) return;

    // Check if clicking near an existing point (for dragging)
    const hitRadius = 12;

    // Check closed zones
    for (let zi = 0; zi < this.closedZones.length; zi++) {
      const zone = this.closedZones[zi];
      for (let pi = 0; pi < zone.points.length; pi++) {
        const p = zone.points[pi];
        if (Math.abs(wx - p.x) < hitRadius && Math.abs(wy - p.y) < hitRadius) {
          this.selectedZoneIndex = zi;
          this.selectedPointIndex = pi;
          this.dragging = true;
          this.dragOffset = { x: wx - p.x, y: wy - p.y };
          return;
        }
      }
    }

    // Check current polygon points
    for (let pi = 0; pi < this.currentPoints.length; pi++) {
      const p = this.currentPoints[pi];
      if (Math.abs(wx - p.x) < hitRadius && Math.abs(wy - p.y) < hitRadius) {
        this.selectedZoneIndex = -1;
        this.selectedPointIndex = pi;
        this.dragging = true;
        this.dragOffset = { x: wx - p.x, y: wy - p.y };
        return;
      }
    }

    // No hit — add new point to current polygon
    this.currentPoints.push({ x: wx, y: wy });
    this.selectedZoneIndex = -1;
    this.selectedPointIndex = this.currentPoints.length - 1;
  }

  private onPointerMove(): void {
    if (!this.active || !this.dragging) return;

    const wp = this.getWorldPointer();

    if (this.selectedZoneIndex >= 0 && this.selectedPointIndex >= 0) {
      const p = this.closedZones[this.selectedZoneIndex].points[this.selectedPointIndex];
      p.x = wp.x - this.dragOffset.x;
      p.y = wp.y - this.dragOffset.y;
    } else if (this.selectedPointIndex >= 0 && this.selectedPointIndex < this.currentPoints.length) {
      this.currentPoints[this.selectedPointIndex].x = wp.x - this.dragOffset.x;
      this.currentPoints[this.selectedPointIndex].y = wp.y - this.dragOffset.y;
    }
  }

  private onPointerUp(): void {
    this.dragging = false;
    // Sync closed zones back to manager
    this.syncToManager();
  }

  private closeCurrentPolygon(): void {
    if (this.currentPoints.length < 3) {
      console.log('[BoundaryEditor] Need at least 3 points to close polygon');
      return;
    }

    const zone: WalkZone = {
      id: `walk_zone_${this.nextZoneId++}`,
      points: [...this.currentPoints],
    };
    this.closedZones.push(zone);
    this.currentPoints = [];
    this.selectedPointIndex = -1;
    this.selectedZoneIndex = -1;
    this.syncToManager();
    console.log(`[BoundaryEditor] Closed polygon: ${zone.id} (${zone.points.length} points)`);
  }

  private deleteSelectedPoint(): void {
    if (this.selectedZoneIndex >= 0 && this.selectedPointIndex >= 0) {
      const zone = this.closedZones[this.selectedZoneIndex];
      zone.points.splice(this.selectedPointIndex, 1);
      if (zone.points.length < 3) {
        this.closedZones.splice(this.selectedZoneIndex, 1);
        console.log(`[BoundaryEditor] Removed zone (too few points)`);
      }
      this.selectedPointIndex = -1;
      this.selectedZoneIndex = -1;
      this.syncToManager();
    }
  }

  private syncToManager(): void {
    const data: WalkBoundaryData = {
      level: 'forest_level_01',
      image: 'Final Forest Level Image.png',
      bounds: { width: this.imageWidth, height: this.imageHeight },
      walkZones: this.closedZones,
    };
    this.manager.loadFromData(data);
  }

  private draw(): void {
    this.graphics.clear();

    if (!this.active && !this.debugVisible) {
      // Draw walk zones lightly even when not editing if debug is on
      return;
    }

    // Draw closed zones
    for (let zi = 0; zi < this.closedZones.length; zi++) {
      const zone = this.closedZones[zi];
      if (zone.points.length < 3) continue;

      // Filled polygon
      this.graphics.fillStyle(FILL_COLOR, FILL_ALPHA);
      this.graphics.beginPath();
      this.graphics.moveTo(zone.points[0].x, zone.points[0].y);
      for (let i = 1; i < zone.points.length; i++) {
        this.graphics.lineTo(zone.points[i].x, zone.points[i].y);
      }
      this.graphics.closePath();
      this.graphics.fillPath();

      // Outline
      this.graphics.lineStyle(LINE_WIDTH, CLOSED_LINE_COLOR, 0.8);
      this.graphics.beginPath();
      this.graphics.moveTo(zone.points[0].x, zone.points[0].y);
      for (let i = 1; i < zone.points.length; i++) {
        this.graphics.lineTo(zone.points[i].x, zone.points[i].y);
      }
      this.graphics.closePath();
      this.graphics.strokePath();

      // Points
      if (this.active) {
        for (let pi = 0; pi < zone.points.length; pi++) {
          const p = zone.points[pi];
          const isSelected = zi === this.selectedZoneIndex && pi === this.selectedPointIndex;
          this.graphics.fillStyle(isSelected ? POINT_SELECTED_COLOR : POINT_COLOR, 1);
          this.graphics.fillCircle(p.x, p.y, POINT_RADIUS);
          this.graphics.lineStyle(1, 0xffffff, 0.6);
          this.graphics.strokeCircle(p.x, p.y, POINT_RADIUS);
        }
      }
    }

    // Draw current in-progress polygon
    if (this.active && this.currentPoints.length > 0) {
      // Lines
      this.graphics.lineStyle(LINE_WIDTH, LINE_COLOR, 0.7);
      this.graphics.beginPath();
      this.graphics.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
      for (let i = 1; i < this.currentPoints.length; i++) {
        this.graphics.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
      }
      // Dashed line to mouse
      const mp = this.getWorldPointer();
      this.graphics.lineTo(mp.x, mp.y);
      this.graphics.strokePath();

      // Points
      for (let pi = 0; pi < this.currentPoints.length; pi++) {
        const p = this.currentPoints[pi];
        const isSelected = this.selectedZoneIndex < 0 && pi === this.selectedPointIndex;
        this.graphics.fillStyle(isSelected ? POINT_SELECTED_COLOR : POINT_COLOR, 1);
        this.graphics.fillCircle(p.x, p.y, POINT_RADIUS);
        this.graphics.lineStyle(1, 0xffffff, 0.6);
        this.graphics.strokeCircle(p.x, p.y, POINT_RADIUS);
      }
    }

    // World bounds outline
    if (this.debugVisible) {
      this.graphics.lineStyle(1, 0xff6600, 0.5);
      this.graphics.strokeRect(0, 0, this.imageWidth, this.imageHeight);
    }
  }

  private updateDebugText(): void {
    if (!this.debugVisible) return;

    const hero = (this.scene as any).hero;
    const cam = this.scene.cameras.main;
    const inside = hero ? this.manager.isPointInsideWalkZone(hero.x, hero.y) : 'N/A';

    const lines = [
      `[Boundary Debug]`,
      `Edit mode: ${this.active ? 'ON (B)' : 'OFF (B)'}`,
      `Zones: ${this.closedZones.length}`,
      `Current points: ${this.currentPoints.length}`,
      `Player pos: ${hero ? `${Math.round(hero.x)}, ${Math.round(hero.y)}` : 'N/A'}`,
      `Inside zone: ${inside}`,
      `Camera: ${Math.round(cam.scrollX)}, ${Math.round(cam.scrollY)}`,
      `World: ${this.imageWidth}x${this.imageHeight}`,
      ``,
      `Controls:`,
      `  B: toggle edit mode`,
      `  V: toggle this overlay`,
      `  Click: add point`,
      `  Right-click/Enter: close polygon`,
      `  Backspace: undo last point`,
      `  Delete: remove selected point`,
      `  C: clear current polygon`,
      `  S: export JSON`,
      `  L: import JSON`,
    ];
    this.debugText.setText(lines.join('\n'));
  }

  private exportJSON(): void {
    const data: WalkBoundaryData = {
      level: 'forest_level_01',
      image: 'Final Forest Level Image.png',
      bounds: { width: this.imageWidth, height: this.imageHeight },
      walkZones: this.closedZones,
    };

    const json = JSON.stringify(data, null, 2);

    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'forest_walk_boundaries.json';
    a.click();
    URL.revokeObjectURL(url);

    // Also log to console
    console.log('[BoundaryEditor] Exported walk boundaries:');
    console.log(json);
    console.log('[BoundaryEditor] Save this file to: public/assets/environment/forest/forest_walk_boundaries.json');
  }

  private importJSON(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as WalkBoundaryData;
          this.closedZones = data.walkZones || [];
          this.nextZoneId = this.closedZones.length + 1;
          this.syncToManager();
          console.log(`[BoundaryEditor] Loaded ${this.closedZones.length} zones`);
        } catch (e) {
          console.error('[BoundaryEditor] Invalid JSON:', e);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}
