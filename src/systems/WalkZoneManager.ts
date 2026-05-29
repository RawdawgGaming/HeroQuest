// ============================================================================
// WALK ZONE MANAGER — runtime boundary enforcement for beat-em-up movement
// ============================================================================

export interface WalkZonePoint {
  x: number;
  y: number;
}

export interface WalkZone {
  id: string;
  points: WalkZonePoint[];
}

export interface WalkBoundaryData {
  level: string;
  image: string;
  bounds: { width: number; height: number };
  walkZones: WalkZone[];
}

/** Point-in-polygon test using ray casting algorithm */
function isInsidePolygon(px: number, py: number, polygon: WalkZonePoint[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Find closest point on a polygon edge to the given point */
function closestPointOnPolygonEdge(px: number, py: number, polygon: WalkZonePoint[]): WalkZonePoint {
  let bestX = px, bestY = py, bestDist = Infinity;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;

    let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const dist = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestX = cx;
      bestY = cy;
    }
  }

  return { x: bestX, y: bestY };
}

export class WalkZoneManager {
  private zones: WalkZone[] = [];
  private loaded = false;

  get isLoaded(): boolean { return this.loaded; }
  get allZones(): WalkZone[] { return this.zones; }

  loadFromData(data: WalkBoundaryData): void {
    this.zones = data.walkZones || [];
    this.loaded = true;
  }

  loadFromJSON(json: string): void {
    const data = JSON.parse(json) as WalkBoundaryData;
    this.loadFromData(data);
  }

  /** Check if a point is inside any walk zone */
  isPointInsideWalkZone(x: number, y: number): boolean {
    if (!this.loaded || this.zones.length === 0) return true; // no zones = no restriction
    for (const zone of this.zones) {
      if (isInsidePolygon(x, y, zone.points)) return true;
    }
    return false;
  }

  /** Clamp a point to the nearest valid position inside a walk zone */
  clampPointToWalkZone(x: number, y: number): WalkZonePoint {
    if (!this.loaded || this.zones.length === 0) return { x, y };
    if (this.isPointInsideWalkZone(x, y)) return { x, y };

    // Find the closest edge point across all zones
    let bestX = x, bestY = y, bestDist = Infinity;
    for (const zone of this.zones) {
      const cp = closestPointOnPolygonEdge(x, y, zone.points);
      const d = (x - cp.x) * (x - cp.x) + (y - cp.y) * (y - cp.y);
      if (d < bestDist) {
        bestDist = d;
        bestX = cp.x;
        bestY = cp.y;
      }
    }
    return { x: bestX, y: bestY };
  }
}
