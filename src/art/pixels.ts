// Tiny helpers for drawing pixel art onto canvases. Every texture in the game is made here
// at start-up, so the art can later be swapped for hand-drawn PNGs without touching game code.

export const PAL = {
  ink: '#1a1c2c',
  white: '#f4f4f4',
  grass: '#38b764',
  grassDark: '#257179',
  grassLight: '#a7f070',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  ice: '#73eff7',
  red: '#b13e53',
  orange: '#ef7d57',
  yellow: '#ffcd75',
  purple: '#5d275d',
  stone: '#94b0c2',
  stoneDark: '#566c86',
  slate: '#333c57',
  wood: '#a0703c',
  woodDark: '#6b4426',
  sand: '#c9a26b',
  sandDark: '#a7804f',
  sandLight: '#e3c58f',
  dirt: '#7d5a34',
  water: '#3b5dc9',
  waterLight: '#41a6f6',
} as const;

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
}

export function px(ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Deterministic random numbers, so the map looks the same every time. */
export function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Draws a pixel sprite from text rows. Each character is a palette key from `colors`;
 * '.' is transparent. Rows may be ragged; missing pixels are transparent.
 */
export function drawRows(ctx: Ctx, rows: string[], colors: Record<string, string>, ox = 0, oy = 0): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (c) px(ctx, ox + x, oy + y, c);
    }
  });
}

export function rowsSize(rows: string[]): { w: number; h: number } {
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

/** Pixels covered by a 2:1 isometric diamond `w` wide, with its top-left box at (ox, oy). */
export function diamondRows(w: number): { y: number; x0: number; x1: number }[] {
  const h = w / 2;
  const out: { y: number; x0: number; x1: number }[] = [];
  for (let y = 0; y < h; y++) {
    const half = y < h / 2 ? (y + 1) * 2 : (h - y) * 2;
    out.push({ y, x0: w / 2 - half, x1: w / 2 + half - 1 });
  }
  return out;
}

/**
 * An isometric block: a diamond top `w` pixels wide plus left and right faces `depth` pixels tall.
 * Returns the bottom edge of the top face per column, for callers that add their own detail.
 */
export function isoBlock(
  ctx: Ctx, ox: number, oy: number, w: number, depth: number,
  top: (x: number, y: number) => string, left: string, right: string, edge?: string,
): number[] {
  const rows = diamondRows(w);
  const bottom: number[] = new Array(w).fill(-1);
  for (const { y, x0, x1 } of rows) {
    for (let x = x0; x <= x1; x++) {
      px(ctx, ox + x, oy + y, top(x, y));
      bottom[x] = Math.max(bottom[x], y);
    }
  }
  for (let x = 0; x < w; x++) {
    const color = x < w / 2 ? left : right;
    px(ctx, ox + x, oy + bottom[x] + 1, color, 1, depth);
  }
  if (edge) {
    for (let x = 0; x < w; x++) px(ctx, ox + x, oy + bottom[x] + depth, edge);
  }
  return bottom;
}
