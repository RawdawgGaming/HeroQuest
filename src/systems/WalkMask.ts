// ============================================================================
// WALK MASK — pixel-based walkable area enforcement from a painted mask PNG
// ============================================================================
// Loads a black/white mask image (white = walkable, black = blocked).
// Checks whether a world position is walkable by sampling the mask pixel.
// Clamps player/enemy positions to the nearest walkable pixel.

export class WalkMask {
  private maskData: ImageData | null = null;
  private width = 0;
  private height = 0;
  private loaded = false;

  get isLoaded(): boolean { return this.loaded; }

  /** Load the mask from an image URL. Returns a promise. */
  async loadFromURL(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.width = img.width;
        this.height = img.height;

        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        this.maskData = ctx.getImageData(0, 0, this.width, this.height);
        this.loaded = true;

        console.log(`[WalkMask] Loaded: ${this.width}x${this.height}`);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load walk mask: ${url}`));
      img.src = url;
    });
  }

  /** Check if a world pixel is walkable (white in the mask). */
  isWalkable(x: number, y: number): boolean {
    if (!this.maskData) return true; // no mask = no restriction

    const px = Math.round(x);
    const py = Math.round(y);

    if (px < 0 || px >= this.width || py < 0 || py >= this.height) return false;

    const idx = (py * this.width + px) * 4;
    // White pixel = walkable (R > 128)
    return this.maskData.data[idx] > 128;
  }

  /** Find a valid spawn point: scan the left side of the mask for the first
   *  walkable column and return its vertical center. */
  findSpawnPoint(): { x: number; y: number } {
    if (!this.maskData) return { x: 180, y: 490 };

    // Scan from left, find first column with walkable pixels
    for (let x = 0; x < Math.min(400, this.width); x++) {
      let minY = -1, maxY = -1;
      for (let y = 0; y < this.height; y++) {
        if (this.maskData.data[(y * this.width + x) * 4] > 128) {
          if (minY < 0) minY = y;
          maxY = y;
        }
      }
      if (minY >= 0 && (maxY - minY) >= 10) {
        // Found a column with enough walkable height — use its center
        return { x: x + 20, y: Math.round((minY + maxY) / 2) };
      }
    }

    return { x: 180, y: 490 }; // fallback
  }

  /** Clamp a position to the nearest walkable pixel.
   *  Uses a radial search outward from the target position. */
  clampToWalkable(x: number, y: number): { x: number; y: number } {
    if (!this.maskData) return { x, y };
    if (this.isWalkable(x, y)) return { x, y };

    // Search in expanding rings up to 300px
    const maxRadius = 300;
    let bestX = x, bestY = y, bestDist = Infinity;

    for (let r = 1; r <= maxRadius; r++) {
      // Check points on the perimeter of a square at distance r
      for (let d = -r; d <= r; d++) {
        const candidates = [
          { cx: x + d, cy: y - r }, // top edge
          { cx: x + d, cy: y + r }, // bottom edge
          { cx: x - r, cy: y + d }, // left edge
          { cx: x + r, cy: y + d }, // right edge
        ];
        for (const { cx, cy } of candidates) {
          if (this.isWalkable(cx, cy)) {
            const dist = (cx - x) * (cx - x) + (cy - y) * (cy - y);
            if (dist < bestDist) {
              bestDist = dist;
              bestX = cx;
              bestY = cy;
            }
          }
        }
      }
      // If we found a walkable pixel in this ring, return it
      if (bestDist < Infinity) return { x: bestX, y: bestY };
    }

    // No walkable pixel found within radius — return original
    return { x, y };
  }
}
