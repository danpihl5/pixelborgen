// Isometric projection. A grid tile (c, r) becomes a 32×16 pixel diamond on screen.
// Grid x grows towards the lower right of the screen, grid y towards the lower left.

export const TILE_W = 32;
export const TILE_H = 16;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

/** Grid position (in tiles, fractions allowed) to world pixels. (0, 0) is the map's top corner. */
export function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * HW, y: (x + y) * HH };
}

/** World pixels back to a grid position in tiles. */
export function toGrid(sx: number, sy: number): { x: number; y: number } {
  return { x: (sx / HW + sy / HH) / 2, y: (sy / HH - sx / HW) / 2 };
}

/** The tile under a world pixel. */
export function tileAt(sx: number, sy: number): { c: number; r: number } {
  const g = toGrid(sx, sy);
  return { c: Math.floor(g.x), r: Math.floor(g.y) };
}

/** Draw order: things further down the screen are drawn later. */
export function depthOf(x: number, y: number): number {
  return x + y;
}
