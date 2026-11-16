// Generates every texture the game uses. Each sprite records its "foot": the pixel that
// stands on the tile centre, so the renderer can place it without knowing its size.
//
// Look: warm medieval colours and faceted low-poly shading (a nod to Diplomacy is Not an
// Option), chunky chibi characters with big square heads and thick outlines, red army
// against blue towers (a nod to Fat Princess).

import { TILE_H, TILE_W } from '../iso';
import {
  bricks, diamondRows, drawRows, fillTri, isoBlock, line, makeCanvas, outline, PAL, planks, px, rng, type Ctx,
} from './pixels';

export interface SpriteArt {
  canvas: HTMLCanvasElement;
  /** Foot position in sprite pixels. */
  fx: number;
  fy: number;
  /** Display scale, for art that is stored larger than it is shown. Defaults to 1. */
  scale?: number;
  /** True for painted art that should be smoothed when scaled, not shown as hard pixels. */
  smooth?: boolean;
}

// ---------- Ground ----------

/** Thickness of the island's edge: tile blocks of soil with grass hanging over the top. */
export const GROUND_DEPTH = 26;

const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}

/** Smooth value noise in [0, 1], for soft patches in the grass. */
function noise2(x: number, y: number): number {
  const h = (i: number, j: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * A square grass map of `size` × `size` tiles as one outlined image. Place its top-left
 * corner at world (-ox, oy); that puts tile (0, 0)'s top corner at the world origin.
 * Drawn straight into a pixel buffer, since the map is hundreds of thousands of pixels.
 */
export function drawGround(size: number): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const half = TILE_W / 2;
  const w = size * TILE_W + 2;
  const h = size * TILE_H + GROUND_DEPTH + 2;
  const img = new ImageData(w, h);
  const data = img.data;
  const put = (x: number, y: number, hex: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const [r, g, b] = rgb(hex);
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  };
  const rand = rng(20261116);
  const ox = size * half + 1;
  const rows = diamondRows(TILE_W);
  const bottom = new Array(TILE_W).fill(0);
  for (const { y, x0, x1 } of rows) for (let x = x0; x <= x1; x++) bottom[x] = Math.max(bottom[x], y);

  // Grass colour at a world pixel: soft mottled patches, worked in 2 × 2 pixel clumps.
  const grassAt = (wx: number, wy: number) => {
    const cx = wx >> 1, cy = wy >> 1;
    const n = noise2(cx / 6, cy / 4) * 0.55 + noise2(cx / 1.7, cy / 1.3) * 0.45;
    return n > 0.74 ? PAL.turfHi : n > 0.45 ? PAL.turf1 : n > 0.25 ? PAL.turf2 : PAL.turfPatch;
  };

  /** A small clump of grass blades rising from (x, y). */
  const tuft = (x: number, y: number, tall: number) => {
    // Spiky blades fanning out from a dark base, the tips catching the light.
    for (const [dx, hgt, lean] of [[-3, tall - 2, -1], [-2, tall, -1], [-1, tall - 1, 0], [0, tall + 1, 0], [1, tall - 1, 0], [2, tall, 1], [3, tall - 2, 1]] as const) {
      for (let k = 0; k < hgt; k++) {
        const xx = x + dx + (k > hgt / 2 ? lean : 0);
        put(xx, y - k, k === 0 ? PAL.turfTuft : k === hgt - 1 ? PAL.turfHi : k < 2 ? PAL.turfLo : PAL.turf1);
      }
    }
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bx = ox + (c - r) * half - half;
      const by = 1 + (c + r) * (TILE_H / 2);
      for (const { y, x0, x1 } of rows) {
        for (let x = x0; x <= x1; x++) {
          // A faintly darker seam along each tile's lower edges, so the ground reads as blocks.
          const seam = y === bottom[x];
          put(bx + x, by + y, seam ? PAL.turfSeam : grassAt(bx + x, by + y));
        }
      }

      // Soil sides on the outer edge, with grass hanging over the top.
      if (r === size - 1 || c === size - 1) {
        for (let x = 0; x < TILE_W; x++) {
          const leftFace = x < half;
          if ((leftFace && r !== size - 1) || (!leftFace && c !== size - 1)) continue;
          const hang = 3 + Math.floor(rand() * 3) + (rand() < 0.18 ? 3 + Math.floor(rand() * 4) : 0);
          for (let k = 0; k < GROUND_DEPTH; k++) {
            let color: string;
            if (k === GROUND_DEPTH - 1) color = PAL.ink;
            else if (k < hang) color = k === hang - 1 ? PAL.turfTuft : k < 2 ? PAL.turf2 : PAL.turfLo;
            else if (x === 0 || x === TILE_W - 1) color = PAL.earthSeam; // block seams
            else {
              const n = noise2((bx + x) / 3, k / 3);
              color = n > 0.72 ? PAL.earth3 : leftFace ? (n < 0.25 ? '#c07e48' : PAL.earth1) : (n < 0.25 ? PAL.earth1 : PAL.earth2);
            }
            put(bx + x, by + bottom[x] + 1 + k, color);
          }
        }
      }

      // Grass tufts, tiny yellow flowers and pale pebbles.
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const v = rand();
        const x = bx + 16 + Math.floor(rand() * 32), y = by + 10 + Math.floor(rand() * 14);
        if (v < 0.6) tuft(x, y, 4 + Math.floor(rand() * 3));
        else if (v < 0.75) { put(x, y, PAL.bloom); put(x + 1, y, PAL.bloom); put(x, y + 1, PAL.turfTuft); }
        else if (v < 0.85) {
          put(x, y, PAL.boulder1); put(x + 1, y, PAL.boulder1); put(x + 2, y, PAL.boulder2);
          put(x, y + 1, PAL.boulder2); put(x + 1, y + 1, PAL.boulder2); put(x + 2, y + 1, PAL.boulder3);
          put(x, y + 2, PAL.turfTuft); put(x + 1, y + 2, PAL.turfTuft); put(x + 2, y + 2, PAL.turfTuft);
        }
      }
    }
  }
  const [cv, ctx] = makeCanvas(w, h);
  ctx.putImageData(img, 0, 0);
  outline(cv, PAL.ink);
  return { canvas: cv, ox, oy: -1 };
}

// ---------- Shapes ----------

/** An upright isometric prism whose bottom centre is at (cx, footY). Width must be a multiple of 4. Returns the top centre's y. */
function prism(
  ctx: Ctx, cx: number, footY: number, w: number, height: number,
  top: string | ((x: number, y: number) => string), left: string | ((x: number, k: number) => string), right: string | ((x: number, k: number) => string),
): number {
  const oy = footY - w / 4 - height;
  isoBlock(ctx, cx - w / 2, oy, w, height, typeof top === 'string' ? () => top : top, left, right);
  return oy + w / 4;
}

/** A four-sided roof whose base is a diamond `w` wide centred at (cx, cy). */
function pyramid(ctx: Ctx, cx: number, cy: number, w: number, h: number, light: string, dark: string, stripe?: [string, string]): number {
  const L: [number, number] = [cx - w / 2, cy];
  const R: [number, number] = [cx + w / 2, cy];
  const F: [number, number] = [cx, cy + w / 4];
  const A: [number, number] = [cx, cy - h];
  fillTri(ctx, L, F, A, stripe ? (_x, y) => (y % 3 === 0 ? stripe[0] : light) : light);
  fillTri(ctx, F, R, A, stripe ? (_x, y) => (y % 3 === 0 ? stripe[1] : dark) : dark);
  return cy - h;
}

/** A Byzantine dome sitting on (cx, baseY). */
function dome(ctx: Ctx, cx: number, baseY: number, rw: number, rh: number, c1: string, c2: string, c3: string): number {
  for (let dy = 0; dy <= rh; dy++) {
    const hw = Math.round(rw * Math.sqrt(1 - (dy / rh) ** 2));
    for (let x = cx - hw; x < cx + hw; x++) {
      const f = (x - (cx - hw)) / Math.max(1, 2 * hw);
      px(ctx, x, baseY - dy, f < 0.34 ? c1 : f < 0.7 ? c2 : c3);
    }
  }
  px(ctx, cx - Math.round(rw / 2), baseY - Math.round(rh * 0.6), PAL.white);
  return baseY - rh;
}

function banner(ctx: Ctx, x: number, y: number, c1: string, c2: string, pole = 9): void {
  px(ctx, x, y - pole, PAL.outline, 1, pole);
  drawRows(ctx, ['aaaa', 'abbbb', 'aaab', 'a.a'], { a: c1, b: c2 }, x + 1, y - pole);
}

function circleBlob(ctx: Ctx, circles: [number, number, number][], shade: (x: number, y: number) => string): void {
  const xs = circles.flatMap(([x, , r]) => [x - r, x + r]);
  const ys = circles.flatMap(([, y, r]) => [y - r, y + r]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (circles.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r)) px(ctx, x, y, shade(x, y));
    }
  }
}

// ---------- Scenery ----------

/**
 * A lumpy, cauliflower-like crown of round bumps, each shaded on its own: bright yellow-green
 * on the lit top-left, deep green in the shade. Bumps are drawn back to front.
 */
function crown(ctx: Ctx, bumps: [number, number, number][], rand: () => number): void {
  const sorted = [...bumps].sort((a, b) => a[1] - b[1]);
  const top = Math.min(...bumps.map((b) => b[1] - b[2]));
  const bottom = Math.max(...bumps.map((b) => b[1] + b[2]));
  for (const [bx, by, r] of sorted) {
    for (let y = Math.floor(by - r); y <= Math.ceil(by + r); y++) {
      for (let x = Math.floor(bx - r); x <= Math.ceil(bx + r); x++) {
        const dx = x + 0.5 - bx, dy = y + 0.5 - by;
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > 1) continue;
        // Each bump is lit from the top-left; the whole crown also darkens towards the bottom.
        const depth = (y - top) / Math.max(1, bottom - top);
        const light = (-dx - dy * 1.2) / r * 0.8 + 0.5 - depth * 1.3 + (rand() - 0.5) * 0.3;
        let c: string;
        if (d > 0.82 && dx + dy > 0) c = depth > 0.6 ? PAL.leaf5 : PAL.leaf4;
        else if (light > 0.75) c = PAL.leaf1;
        else if (light > 0.15) c = PAL.leaf2;
        else if (light > -0.5) c = PAL.leaf3;
        else c = PAL.leaf4;
        px(ctx, x, y, c);
      }
    }
  }
}

/** A bushy tree (variants 0, 1) or a low bush (variants 2, 3), as in the owner's pictures. */
export function drawTree(variant: number): SpriteArt {
  const [cv, ctx] = makeCanvas(60, 70);
  const rand = rng(401 + variant * 71);
  const cx = 30, base = 64;
  const bush = variant >= 2;
  if (!bush) {
    px(ctx, cx - 3, base - 14, PAL.bark1, 4, 14);
    px(ctx, cx + 1, base - 14, PAL.bark2, 2, 14);
    px(ctx, cx - 5, base - 2, PAL.bark2, 2, 2); px(ctx, cx + 3, base - 2, PAL.bark2, 2, 2);
  }
  const bumps: [number, number, number][] = [];
  const s = bush ? 0.72 : [1, 0.9][variant];
  const mid = bush ? base - 12 : base - 34 * s;
  // Many small bumps over a rounded mass, denser and bigger towards the middle.
  for (let i = 0; i < (bush ? 14 : 26); i++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand());
    bumps.push([cx + Math.cos(a) * 17 * s * rr, mid + Math.sin(a) * 14 * s * rr, (5 + rand() * 3 + (1 - rr) * 3) * s]);
  }
  crown(ctx, bumps, rand);
  return { canvas: outline(cv, PAL.ink), fx: cx, fy: base - 3 };
}

/** Pale, rounded stones; variant 1 is a smaller cluster. */
export function drawRock(variant = 0): SpriteArt {
  const [cv, ctx] = makeCanvas(44, 32);
  const stone = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const l = -dx - dy * 1.3;
        px(ctx, x, y, l > 1 ? PAL.boulderHi : l > 0 ? PAL.boulder1 : l > -0.8 ? PAL.boulder2 : PAL.boulder3);
      }
    }
  };
  if (variant === 1) {
    stone(15, 21, 5, 4); stone(26, 23, 4, 3); stone(21, 26, 3, 2.4);
  } else {
    stone(18, 18, 9, 7); stone(29, 22, 6, 5); stone(11, 24, 4, 3);
  }
  return { canvas: outline(cv, PAL.ink), fx: 22, fy: 24 };
}

export function drawBush(): SpriteArt {
  const [cv, ctx] = makeCanvas(18, 13);
  circleBlob(ctx, [[6, 7, 4.5], [11, 6, 5], [14, 8, 3.5]], (x, y) => ((x - 9) + (y - 6) < -2 ? PAL.grass1 : (x - 9) + (y - 6) < 3 ? PAL.grass3 : PAL.grassDark));
  px(ctx, 7, 5, PAL.red2); px(ctx, 12, 4, PAL.red2); px(ctx, 10, 8, PAL.red2);
  return { canvas: outline(cv), fx: 9, fy: 10 };
}

export function drawTent(): SpriteArt {
  // The red army's camp, where the enemies march out.
  const [cv, ctx] = makeCanvas(32, 34);
  const cx = 16, base = 26;
  const apex = pyramid(ctx, cx, base, 26, 16, PAL.red1, PAL.red2, [PAL.red2, PAL.red3]);
  fillTri(ctx, [cx - 8, base + 3], [cx - 3, base + 5], [cx - 4, base - 5], PAL.outline);
  banner(ctx, cx, apex, PAL.red2, PAL.red3, 7);
  return { canvas: outline(cv), fx: cx, fy: base + 2 };
}

// ---------- Towers (blue army) ----------

const TOWER_W = 32;
const TOWER_H = 54;
const FOOT = 46;
const stoneL = bricks(PAL.stone1, PAL.stone3);
const stoneR = bricks(PAL.stone2, PAL.stone3);

function towerBase(ctx: Ctx, cx: number): number {
  return prism(ctx, cx, FOOT, 24, 4, PAL.stone2, bricks(PAL.stone2, PAL.mortar), bricks(PAL.stone3, PAL.mortar));
}

export function drawTowerBue(): SpriteArt {
  const [cv, ctx] = makeCanvas(TOWER_W, TOWER_H);
  const cx = TOWER_W / 2;
  const base = towerBase(ctx, cx);
  const body = prism(ctx, cx, base, 16, 13, PAL.stone1, stoneL, stoneR);
  px(ctx, cx - 5, body + 7, PAL.outline, 1, 4);
  px(ctx, cx + 4, body + 7, PAL.outline, 1, 4);
  const gallery = prism(ctx, cx, body + 3, 20, 4, PAL.wood1, planks(PAL.wood1, PAL.wood2), planks(PAL.wood2, PAL.wood3));
  const apex = pyramid(ctx, cx, gallery, 24, 13, PAL.roof1, PAL.roof2, [PAL.roof2, '#933a22']);
  banner(ctx, cx, apex, PAL.blue2, PAL.blue1);
  return { canvas: outline(cv), fx: cx, fy: FOOT };
}

export function drawTowerKanon(): SpriteArt {
  // A wheeled catapult on a low stone base.
  const [cv, ctx] = makeCanvas(TOWER_W, TOWER_H);
  const cx = TOWER_W / 2;
  const top = towerBase(ctx, cx);
  const beam = top - 4;
  // Support frame and pivot.
  line(ctx, cx - 4, beam, cx - 1, beam - 11, PAL.wood3, 2);
  line(ctx, cx + 4, beam, cx + 1, beam - 11, PAL.wood2, 2);
  // Throwing arm: counterweight low on the right, bucket with a boulder high on the left.
  line(ctx, cx + 8, beam - 6, cx - 9, beam - 18, PAL.wood1, 2);
  px(ctx, cx + 6, beam - 7, PAL.rock2, 5, 5);
  px(ctx, cx + 6, beam - 7, PAL.rock1, 2, 2);
  drawRows(ctx, ['.rrr.', 'rRrrr', 'rrrrr', 'ddddd', '.ddd.'], { r: PAL.rock1, R: PAL.stone1, d: PAL.wood3 }, cx - 14, beam - 24);
  // Base beam and wheels.
  px(ctx, cx - 11, beam, PAL.wood1, 22, 1);
  px(ctx, cx - 11, beam + 1, PAL.wood2, 22, 2);
  for (const wx of [cx - 8, cx + 7]) {
    circleBlob(ctx, [[wx, beam + 3, 3.2]], () => PAL.wood3);
    px(ctx, wx - 1, beam + 2, PAL.metal2, 2, 2);
  }
  banner(ctx, cx, beam - 11, PAL.blue2, PAL.blue1, 6);
  return { canvas: outline(cv), fx: cx, fy: FOOT };
}

export function drawTowerFrost(): SpriteArt {
  // The mage tower: white stone, blue band, blue dome and a floating crystal.
  const [cv, ctx] = makeCanvas(TOWER_W, TOWER_H);
  const cx = TOWER_W / 2;
  const base = towerBase(ctx, cx);
  const band = (paint: (x: number, k: number) => string, c: string) => (x: number, k: number) => (k < 3 ? c : paint(x, k));
  const body = prism(ctx, cx, base, 16, 15, PAL.stone1, band(stoneL, PAL.blue2), band(stoneR, PAL.blue3));
  drawRows(ctx, ['.o.', 'obo', 'obo'], { o: PAL.outline, b: PAL.blue3 }, cx - 6, body + 9);
  px(ctx, cx - 9, body + 2, PAL.gold, 18, 1);
  const top = dome(ctx, cx, body + 1, 9, 9, PAL.blue1, PAL.blue2, PAL.blue3);
  px(ctx, cx - 1, top - 3, PAL.gold, 2, 3);
  drawRows(ctx, ['..c..', '.cCc.', 'cCwCc', '.cCc.', '..c..'], { c: PAL.blue2, C: PAL.magic, w: PAL.white }, cx - 3, top - 10);
  return { canvas: outline(cv), fx: cx, fy: FOOT };
}

// ---------- Characters (red army) ----------
// Drawn facing down-right. The renderer mirrors them for down-left; the "back" variants are
// used when walking away from the camera. Frames 0 and 1 are a two-step walk (or wing beat).

interface Chibi {
  skin: [string, string];
  body: [string, string];
  legs: string;
  fat?: boolean;
  hair?: string;
  hat?: boolean;
  helmet?: boolean;
  crown?: boolean;
  item?: 'fork' | 'sword' | 'club';
  shield?: boolean;
}

function chibi(o: Chibi, back: boolean, frame: number): SpriteArt {
  const [cv, ctx] = makeCanvas(22, 26);
  const OX = 3, OY = 5;
  const P = (x: number, y: number, c: string, w = 1, h = 1) => px(ctx, OX + x, OY + y, c, w, h);

  // Legs and feet, one lifted per frame.
  const legX = o.fat ? [3, 9] : [4, 8];
  const legTop = o.fat ? 15 : 14;
  legX.forEach((lx, i) => {
    const lift = i === frame ? 1 : 0;
    P(lx, legTop, o.legs, 2, 3 - lift);
    P(lx, legTop + 2 - lift, PAL.wood3, 2, 1);
  });

  // Body with a shaded right side and a belt.
  const [bx0, bx1] = o.fat ? [2, 11] : [4, 9];
  const bodyBottom = legTop - 1;
  for (let y = 9; y <= bodyBottom; y++) {
    for (let x = bx0; x <= bx1; x++) P(x, y, x >= bx1 - 1 ? o.body[1] : o.body[0]);
  }
  P(bx0, bodyBottom - 1, PAL.wood3, bx1 - bx0 + 1, 1);
  if (!back) P(Math.floor((bx0 + bx1) / 2), bodyBottom - 1, PAL.gold);
  // Arms.
  P(bx0 - 1, 10, o.skin[0], 1, 2);
  P(bx1 + 1, 10, o.skin[1], 1, 2);

  // Big square head with rounded corners.
  for (let y = 0; y <= 8; y++) {
    for (let x = 2; x <= 11; x++) {
      if ((y === 0 || y === 8) && (x === 2 || x === 11)) continue;
      P(x, y, x === 11 || y === 8 ? o.skin[1] : o.skin[0]);
    }
  }
  const hair = o.hair ?? PAL.hair;
  if (back) {
    for (let y = 0; y <= 6; y++) P(2 + (y === 0 ? 1 : 0), y, hair, y === 0 ? 8 : 10, 1);
  } else {
    P(3, 0, hair, 8, 1);
    P(2, 1, hair, 10, 2);
    P(2, 3, hair, 2, 3);
    P(7, 4, PAL.outline, 1, 2);
    P(10, 4, PAL.outline, 1, 2);
    P(6, 6, PAL.blush); P(11, 6, PAL.blush);
    P(9, 7, PAL.outline);
  }
  if (o.helmet) {
    P(3, -1, PAL.metal1, 8, 1);
    P(2, 0, PAL.metal1, 7, 3); P(9, 0, PAL.metal2, 3, 3);
    P(2, 3, PAL.metal2, 2, back ? 4 : 3);
    if (back) P(4, 3, PAL.metal2, 8, 4);
    P(5, -3, PAL.red2, 4, 2); P(6, -4, PAL.red1, 2, 1);
  }
  if (o.hat) {
    P(0, 0, PAL.wheat1, 14, 1);
    P(3, -2, PAL.wheat2, 8, 2);
    P(3, -1, PAL.red2, 8, 1);
  }
  if (o.crown) {
    P(3, -2, PAL.gold, 8, 2);
    P(3, -3, PAL.gold); P(6, -3, PAL.gold, 2, 1); P(10, -3, PAL.gold);
    P(6, -2, PAL.red2, 2, 1);
  }

  // Held items.
  if (o.item === 'fork') {
    P(13, 0, PAL.wood2, 1, 16);
    P(12, -3, PAL.metal2, 1, 3); P(14, -3, PAL.metal2, 1, 3); P(13, -3, PAL.metal2, 1, 3);
    P(12, -1, PAL.metal2, 3, 1);
  } else if (o.item === 'sword') {
    P(13, 2, PAL.metal1, 1, 8); P(14, 3, PAL.metal2, 1, 7);
    P(12, 10, PAL.gold, 4, 1); P(13, 11, PAL.wood3, 2, 2);
  } else if (o.item === 'club') {
    P(12, 1, PAL.wood1, 3, 6); P(14, 2, PAL.wood2, 1, 5); P(13, 7, PAL.wood2, 1, 6);
    P(12, 2, PAL.metal2); P(13, 4, PAL.metal2);
  }
  if (o.shield) {
    P(0, 9, PAL.red2, 4, 5); P(0, 14, PAL.red3, 4, 1); P(1, 11, PAL.gold, 2, 1); P(1, 10, PAL.gold, 1, 3);
  }
  return { canvas: outline(cv), fx: OX + 7, fy: OY + legTop + 3 };
}

const RAVEN_UP = [
  '.k..........k...',
  '.kKk......kKk...',
  '..kKKk..kKKk....',
  '...kKKkkKKkKK...',
  '....kKKKKKKwKo..',
  '.....kKKKKKKoo..',
  '......kKKKKk....',
  '.......kk.......',
];
const RAVEN_DOWN = [
  '................',
  '..........KK....',
  '.........KKwKo..',
  '..kkkkkKKKKKoo..',
  '.kKKKKKKKKKKk...',
  'kKKkkKKKKKkKKk..',
  'kKk..kKKKk..kKk.',
  'kk....kk.....kk.',
];

function raven(back: boolean, frame: number): SpriteArt {
  const [cv, ctx] = makeCanvas(18, 11);
  const rows = frame === 0 ? RAVEN_UP : RAVEN_DOWN;
  const colors = { k: PAL.raven2, K: PAL.raven1, w: back ? PAL.raven1 : PAL.white, o: back ? PAL.raven1 : PAL.beak };
  drawRows(ctx, rows, colors, 1, 1);
  return { canvas: outline(cv), fx: 9, fy: 9 };
}

const CHIBIS: Record<'peasant' | 'knight' | 'ogre', Chibi> = {
  peasant: { skin: [PAL.skin1, PAL.skin2], body: [PAL.red2, PAL.red3], legs: PAL.wood1, hat: true, item: 'fork' },
  knight: { skin: [PAL.skin1, PAL.skin2], body: [PAL.red2, PAL.red3], legs: PAL.metal2, helmet: true, item: 'sword', shield: true },
  ogre: { skin: [PAL.ogre1, PAL.ogre2], body: [PAL.wood1, PAL.wood2], legs: PAL.ogre2, fat: true, hair: PAL.ogre2, crown: true, item: 'club' },
};

/** Keys look like `knight-front-0`. */
export function enemyArts(): Record<string, SpriteArt> {
  const out: Record<string, SpriteArt> = {};
  for (const side of ['front', 'back'] as const) {
    for (const frame of [0, 1]) {
      for (const [type, o] of Object.entries(CHIBIS)) out[`${type}-${side}-${frame}`] = chibi(o, side === 'back', frame);
      out[`raven-${side}-${frame}`] = raven(side === 'back', frame);
    }
  }
  return out;
}

// ---------- HUD icons ----------

export function drawHeart(): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(10, 9);
  drawRows(ctx, ['.rr..rr.', 'rwrrrrrr', 'rrrrrrrR', 'rrrrrrrR', '.rrrrrR.', '..rrRR..', '...RR...'], { r: PAL.red1, R: PAL.red2, w: PAL.white }, 1, 1);
  return outline(cv);
}

export function drawCoin(): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(10, 10);
  drawRows(ctx, ['..yyyy..', '.yywyyy.', 'yywyyyYy', 'ywyyyyYy', 'yyyyyyYy', 'yyyyyYYy', '.yYYYYy.', '..yyyy..'], { y: PAL.gold, Y: PAL.goldDark, w: PAL.white }, 1, 1);
  return outline(cv);
}
