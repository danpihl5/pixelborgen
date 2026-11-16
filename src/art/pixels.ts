// Tiny helpers for drawing pixel art onto canvases. Every texture in the game is made here
// at start-up, so the art can later be swapped for hand-drawn PNGs without touching game code.
//
// Style: flat, faceted "low-poly" shading in warm medieval colours, and a thick dark cartoon
// outline around every object.

export const PAL = {
  outline: '#2b1d1a',
  white: '#fbf6ea',
  // terrain
  grass1: '#8bcf4c', grass2: '#7cc143', grass3: '#6db33d', grassDark: '#4f8f30', grassLight: '#b8e467',
  dirt1: '#e0a96a', dirt2: '#d39b5d', dirt3: '#c68c52', dirtDark: '#9b6436', pebble: '#f1d3a1',
  cliff: '#8f5a33', cliffDark: '#6b3f22', rock1: '#a99d8f', rock2: '#857a6d', rock3: '#635a51',
  water1: '#4fc3e8', water2: '#3aa6d6', foam: '#e8fbff',
  wheat1: '#f2c84b', wheat2: '#d9a93a', wheat3: '#b98a2c',
  // buildings
  stone1: '#efe6d6', stone2: '#d4c8b4', stone3: '#ab9e8a', mortar: '#8f8371',
  wood1: '#b97a45', wood2: '#94592f', wood3: '#6e3f20',
  roof1: '#e0683f', roof2: '#b84a2c',
  gold: '#ffd23f', goldDark: '#d19a1f',
  // teams
  blue1: '#5b9cf0', blue2: '#3d7be0', blue3: '#2a56a8',
  red1: '#f0585a', red2: '#d03b3f', red3: '#962a33',
  // characters
  skin1: '#f6c9a3', skin2: '#e0a37c', blush: '#f08a8a',
  hair: '#7a4a2a', metal1: '#dfe6ee', metal2: '#a8b4c2', metal3: '#6f7c8c',
  ogre1: '#9ccc52', ogre2: '#76a83c',
  raven1: '#4b4a6b', raven2: '#2f2e48', beak: '#f5a524',
  pink1: '#ff9ccf', pink2: '#e070a8',
  ice: '#9ff4ff', magic: '#7ee0ff',
  // Terrain, sampled from the owner's building pictures: warm yellow-green grass in soft
  // mottled patches, tile blocks with brown soil sides and grass hanging over the edge,
  // lumpy yellow-green bushes and pale pebbles, all outlined in a dark blue-grey.
  ink: '#1e2c33',
  turf1: '#9cc13b', turf2: '#8fb636', turfHi: '#b9d443', turfPatch: '#83aa34', turfLo: '#6f9a34', turfTuft: '#4e7a32', turfSeam: '#86ad36',
  earth1: '#b0703f', earth2: '#8a5236', earth3: '#5a3127', earthSeam: '#3b2626',
  leaf1: '#dbe138', leaf2: '#a6c832', leaf3: '#72a033', leaf4: '#3f6b33', leaf5: '#2a4d38',
  bark1: '#8a6a4a', bark2: '#5e4532',
  boulder1: '#d3c9b4', boulder2: '#aca290', boulder3: '#7d7365', boulderHi: '#e9e2d0',
  bloom: '#f1e963',
  keep1: '#bcaeb9', keep2: '#9a8a9e', keep3: '#77687e', keepMortar: '#574a5f',
  tileHi: '#f58a5c', tile1: '#e5533f', tile2: '#bb3530', tile3: '#86232a',
  moat1: '#3d8fe0', moat2: '#5fb0f0', moatHi: '#c4e9ff', cobble1: '#a2a2ac', cobble2: '#7c7c88', cobble3: '#5c5c68',
  glow: '#ffc85a',
  // dark grey fortress stone, as in the owner's castle reference
  fortTop: '#a6a6b0', fort1: '#8d8d98', fort2: '#676773', fort3: '#4b4b57', fortMortar: '#393943',
  window: '#ffe85a', chain: '#2e2e38',
} as const;

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
}

export function px(ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Deterministic random numbers, so the map looks the same every time. */
export function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Draws a pixel sprite from text rows. Each character is a key in `colors`;
 * characters without a colour (like '.') are transparent.
 */
export function drawRows(ctx: Ctx, rows: string[], colors: Record<string, string>, ox = 0, oy = 0): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (c) px(ctx, ox + x, oy + y, c);
    }
  });
}

/** A crisp, un-antialiased triangle (canvas paths would blur the edges). */
export function fillTri(ctx: Ctx, a: [number, number], b: [number, number], c: [number, number], color: string | ((x: number, y: number) => string)): void {
  const minX = Math.floor(Math.min(a[0], b[0], c[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const edge = (p: [number, number], q: [number, number], x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const area = edge(a, b, c[0], c[1]);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      const w0 = edge(b, c, cx, cy) / area, w1 = edge(c, a, cx, cy) / area, w2 = edge(a, b, cx, cy) / area;
      if (w0 >= -0.001 && w1 >= -0.001 && w2 >= -0.001) px(ctx, x, y, typeof color === 'string' ? color : color(x, y));
    }
  }
}

/** A one-pixel line. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, thick = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    px(ctx, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color, thick, thick);
  }
}

/** Adds the cartoon outline: every empty pixel touching a filled one becomes `color`. */
export function outline(cv: HTMLCanvasElement, color: string = PAL.outline): HTMLCanvasElement {
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = cv;
  const img = ctx.getImageData(0, 0, w, h);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && img.data[(y * w + x) * 4 + 3] > 0;
  const marks: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) px(ctx, x, y, color);
  return cv;
}

/** Pixels covered by a 2:1 isometric diamond `w` wide. */
export function diamondRows(w: number): { y: number; x0: number; x1: number }[] {
  const h = w / 2;
  const out: { y: number; x0: number; x1: number }[] = [];
  for (let y = 0; y < h; y++) {
    const half = y < h / 2 ? (y + 1) * 2 : (h - y) * 2;
    out.push({ y, x0: w / 2 - half, x1: w / 2 + half - 1 });
  }
  return out;
}

type Paint = string | ((x: number, k: number) => string);

/**
 * An isometric block: a diamond top `w` pixels wide with its box at (ox, oy), plus left and
 * right faces `depth` pixels tall. Face paints get the column and the row counted down from
 * the face's top edge, which follows the slope, so brick rows line up with the block.
 */
export function isoBlock(
  ctx: Ctx, ox: number, oy: number, w: number, depth: number,
  top: (x: number, y: number) => string, left: Paint, right: Paint,
): number[] {
  const bottom: number[] = new Array(w).fill(-1);
  for (const { y, x0, x1 } of diamondRows(w)) {
    for (let x = x0; x <= x1; x++) {
      px(ctx, ox + x, oy + y, top(x, y));
      bottom[x] = Math.max(bottom[x], y);
    }
  }
  for (let x = 0; x < w; x++) {
    const paint = x < w / 2 ? left : right;
    for (let k = 0; k < depth; k++) {
      px(ctx, ox + x, oy + bottom[x] + 1 + k, typeof paint === 'string' ? paint : paint(x, k));
    }
  }
  return bottom;
}

/** Stone-brick face paint: rows of bricks with staggered joints. */
export function bricks(face: string, mortar: string, rowH = 4, brickW = 6): (x: number, k: number) => string {
  return (x, k) => {
    if (k % rowH === rowH - 1) return mortar;
    const offset = Math.floor(k / rowH) % 2 ? brickW / 2 : 0;
    return (x + offset) % brickW === 0 ? mortar : face;
  };
}

/** Wooden plank face paint. */
export function planks(face: string, seam: string, plankW = 4): (x: number, k: number) => string {
  return (x) => (x % plankW === 0 ? seam : face);
}
