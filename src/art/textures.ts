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
}

/** Thickness of the floating island's edge: a dirt band over rock. */
export const GROUND_DEPTH = 10;

// ---------- Ground ----------

const GRASS = [PAL.grass1, PAL.grass2, PAL.grass3];

/** Smooth-ish noise per tile so neighbouring facets share tones and form patches. */
function tone(c: number, r: number): number {
  const v = (Math.sin(c * 0.37 + r * 0.21) + Math.sin(r * 0.29 - c * 0.13) + Math.sin((c + r) * 0.9)) / 6 + 0.5;
  return Math.max(0, Math.min(2, Math.floor(v * 3)));
}

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

/**
 * A square grass map of `size` × `size` tiles as one outlined image. Place its top-left
 * corner at world (-ox, oy); that puts tile (0, 0)'s top corner at the world origin.
 * Drawn straight into a pixel buffer, since a 60 × 60 map is millions of pixels.
 */
export function drawGround(size: number): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const half = TILE_W / 2;
  const w = size * TILE_W + 2;
  const h = size * TILE_H + GROUND_DEPTH + 2;
  const img = new ImageData(w, h);
  const data = img.data;
  const put = (x: number, y: number, hex: string) => {
    const i = (y * w + x) * 4;
    const [r, g, b] = rgb(hex);
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  };
  const rand = rng(20261116);
  const ox = size * half + 1;
  const rows = diamondRows(TILE_W);
  const bottom = new Array(TILE_W).fill(0);
  for (const { y, x0, x1 } of rows) for (let x = x0; x <= x1; x++) bottom[x] = Math.max(bottom[x], y);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bx = ox + (c - r) * half - half;
      const by = 1 + (c + r) * (TILE_H / 2);

      // Two flat facets per tile, split one of two ways: the low-poly look.
      const t0 = tone(c, r);
      const t1 = Math.max(0, Math.min(2, t0 + (rand() < 0.5 ? -1 : 1)));
      const vertical = rand() < 0.5;
      for (const { y, x0, x1 } of rows) {
        for (let x = x0; x <= x1; x++) put(bx + x, by + y, GRASS[(vertical ? x < half : y < TILE_H / 2) ? t0 : t1]);
      }

      // Only the outer edge of the island shows its sides.
      if (r === size - 1 || c === size - 1) {
        for (let x = 0; x < TILE_W; x++) {
          const leftFace = x < half;
          if ((leftFace && r !== size - 1) || (!leftFace && c !== size - 1)) continue;
          for (let k = 0; k < GROUND_DEPTH; k++) {
            const color = k === GROUND_DEPTH - 1 ? PAL.outline
              : k < 3 ? (leftFace ? PAL.cliff : PAL.cliffDark)
              : ((x * 7 + k * 3) % 11 === 0 ? PAL.rock3 : leftFace ? PAL.rock1 : PAL.rock2);
            put(bx + x, by + bottom[x] + 1 + k, color);
          }
        }
      }

      // Cartoon plants: grass tufts and the odd flower.
      const v = rand();
      const x = bx + 9 + Math.floor(rand() * 13), y = by + 5 + Math.floor(rand() * 6);
      if (v < 0.3) {
        put(x, y, PAL.grassDark); put(x + 2, y, PAL.grassDark); put(x + 1, y + 1, PAL.grassDark);
      } else if (v < 0.4) {
        const petal = [PAL.white, PAL.pink1, PAL.gold][Math.floor(rand() * 3)];
        put(x, y - 1, petal); put(x - 1, y, petal); put(x + 1, y, petal); put(x, y + 1, petal);
        put(x, y, petal === PAL.gold ? PAL.roof1 : PAL.gold);
      } else if (v < 0.48) {
        put(x, y, PAL.grassLight); put(x + 1, y, PAL.grassLight); put(x + 3, y + 1, PAL.grassLight); put(x + 4, y + 1, PAL.grassLight);
      }
    }
  }
  const [cv, ctx] = makeCanvas(w, h);
  ctx.putImageData(img, 0, 0);
  outline(cv);
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

export function drawTree(variant: number): SpriteArt {
  if (variant === 3) {
    // Cypress: tall and Mediterranean.
    const [cv, ctx] = makeCanvas(14, 32);
    px(ctx, 6, 24, PAL.wood2, 2, 4);
    for (let y = 2; y <= 26; y++) {
      const t = (y - 14) / 12.5;
      const hw = Math.round(4.6 * Math.sqrt(Math.max(0, 1 - t * t)));
      for (let x = 7 - hw; x < 7 + hw; x++) px(ctx, x, y, x < 6 ? PAL.grass3 : x < 8 ? PAL.grassDark : '#3c7426');
    }
    px(ctx, 5, 9, PAL.grass2, 1, 3);
    return { canvas: outline(cv), fx: 7, fy: 28 };
  }
  const [cv, ctx] = makeCanvas(24, 30);
  const rand = rng(101 + variant * 37);
  px(ctx, 10, 17, PAL.wood2, 2, 9);
  px(ctx, 12, 17, PAL.wood3, 1, 9);
  const big = 7 + Math.floor(rand() * 2);
  circleBlob(ctx, [[12, 11, big], [7, 14, 5], [17, 14, 5]], (x, y) => {
    const d = (x - 12) + (y - 11) * 1.2;
    return d < -5 ? PAL.grassLight : d < 2 ? PAL.grass1 : d < 7 ? PAL.grass3 : PAL.grassDark;
  });
  if (variant === 1) for (let i = 0; i < 4; i++) px(ctx, 6 + Math.floor(rand() * 12), 7 + Math.floor(rand() * 9), PAL.red2);
  return { canvas: outline(cv), fx: 11, fy: 26 };
}

export function drawBush(): SpriteArt {
  const [cv, ctx] = makeCanvas(18, 13);
  circleBlob(ctx, [[6, 7, 4.5], [11, 6, 5], [14, 8, 3.5]], (x, y) => ((x - 9) + (y - 6) < -2 ? PAL.grass1 : (x - 9) + (y - 6) < 3 ? PAL.grass3 : PAL.grassDark));
  px(ctx, 7, 5, PAL.red2); px(ctx, 12, 4, PAL.red2); px(ctx, 10, 8, PAL.red2);
  return { canvas: outline(cv), fx: 9, fy: 10 };
}

export function drawRock(): SpriteArt {
  const [cv, ctx] = makeCanvas(18, 14);
  prism(ctx, 9, 11, 12, 4, PAL.rock1, PAL.rock2, PAL.rock3);
  prism(ctx, 7, 7, 8, 2, PAL.stone2, PAL.rock1, PAL.rock2);
  return { canvas: outline(cv), fx: 9, fy: 9 };
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

/** The castle on a 2 × 2 footprint. Its foot is the centre of the footprint. */
export function drawCastle(): SpriteArt {
  const [cv, ctx] = makeCanvas(84, 112);
  const cx = 42, foot = 98;
  prism(ctx, cx, foot, 60, 5, PAL.rock1, PAL.rock2, PAL.rock3);
  const wallTop = prism(ctx, cx, foot - 5, 52, 14, PAL.stone2, stoneL, stoneR);
  // Merlons along the front edges of the wall.
  for (let i = 0; i <= 24; i += 4) {
    px(ctx, cx - 26 + i, wallTop + Math.floor(i / 2) - 2, PAL.stone1, 2, 2);
    px(ctx, cx + 24 - i, wallTop + Math.floor(i / 2) - 2, PAL.stone2, 2, 2);
  }
  // Gate in the left wall.
  drawRows(ctx, [
    '.oooo.', 'owwwwo', 'owdwdo', 'owdwdo', 'owwwwo', 'owdwdo', 'owdwdo', 'owwwwo',
  ], { o: PAL.outline, w: PAL.wood2, d: PAL.wood3 }, cx - 17, wallTop + 11);
  const keep = prism(ctx, cx, wallTop + 3, 28, 24, PAL.stone1, stoneL, stoneR);
  for (const wx of [cx - 9, cx + 6]) drawRows(ctx, ['.o.', 'obo', 'obo', 'obo'], { o: PAL.outline, b: PAL.blue3 }, wx, keep + 10);
  const apex = pyramid(ctx, cx, keep, 32, 18, PAL.roof1, PAL.roof2, [PAL.roof2, '#933a22']);
  banner(ctx, cx, apex, PAL.blue2, PAL.blue1, 12);
  // Corner towers: a blue dome on the left, a red cone on the right.
  const lt = prism(ctx, cx - 24, foot - 10, 12, 34, PAL.stone1, stoneL, stoneR);
  const ld = dome(ctx, cx - 24, lt + 1, 7, 7, PAL.blue1, PAL.blue2, PAL.blue3);
  px(ctx, cx - 25, ld - 3, PAL.gold, 2, 3);
  const rt = prism(ctx, cx + 24, foot - 10, 12, 34, PAL.stone1, stoneL, stoneR);
  const ra = pyramid(ctx, cx + 24, rt, 16, 12, PAL.roof1, PAL.roof2);
  banner(ctx, cx + 24, ra, PAL.blue2, PAL.blue1, 8);
  // The princess, waving from the wall.
  drawRows(ctx, [
    '.g.g.',
    '.ggg.',
    'yssyy',
    'ysesy',
    '.sss.s',
    '.ppp.s',
    'ppppp',
    'PPPPP',
  ], { g: PAL.gold, y: PAL.gold, s: PAL.skin1, e: PAL.outline, p: PAL.pink1, P: PAL.pink2 }, cx + 9, wallTop - 2);
  return { canvas: outline(cv), fx: cx, fy: foot };
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
