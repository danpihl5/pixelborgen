// Generates every texture the game uses. Each sprite records its "foot": the pixel that
// stands on the tile centre, so the renderer can place it without knowing its size.

import type { Level, Tile } from '../game/level';
import { TILE_H, TILE_W } from '../iso';
import { drawRows, isoBlock, makeCanvas, PAL, px, rng, type Ctx } from './pixels';

export interface SpriteArt {
  canvas: HTMLCanvasElement;
  /** Foot position in sprite pixels. */
  fx: number;
  fy: number;
}

/** Thickness of the floating island's dirt edge. */
export const GROUND_DEPTH = 8;

// ---------- Ground ----------

/**
 * The whole map as one image. Its top-left corner sits at world (-rows * TILE_W / 2, 0),
 * which puts tile (0, 0)'s top corner at the world origin.
 */
export function drawGround(level: Level): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const w = (level.cols + level.rows) * (TILE_W / 2);
  const h = (level.cols + level.rows) * (TILE_H / 2) + GROUND_DEPTH;
  const [cv, ctx] = makeCanvas(w, h);
  const rand = rng(20261115);
  const ox = level.rows * (TILE_W / 2);
  const tileAt = (c: number, r: number): Tile | null =>
    r < 0 || r >= level.rows || c < 0 || c >= level.cols ? null : level.tiles[r][c];
  const isRoad = (t: Tile | null) => t === 'path' || t === 'spawn' || t === 'castle';

  // Back to front so nearer blocks cover the sides of those behind them.
  for (let sum = 0; sum < level.cols + level.rows - 1; sum++) {
    for (let c = 0; c < level.cols; c++) {
      const r = sum - c;
      if (r < 0 || r >= level.rows) continue;
      const tile = level.tiles[r][c];
      const bx = ox + (c - r) * (TILE_W / 2) - TILE_W / 2;
      const by = (c + r) * (TILE_H / 2);
      const checker = (c + r) % 2 === 0;
      const noise = new Map<string, string>();

      let top: (x: number, y: number) => string;
      if (isRoad(tile)) {
        top = (x, y) => {
          const k = `${x},${y}`;
          if (!noise.has(k)) {
            const v = rand();
            noise.set(k, v < 0.1 ? PAL.sandDark : v < 0.15 ? PAL.sandLight : PAL.sand);
          }
          return noise.get(k)!;
        };
      } else if (tile === 'water') {
        top = (x, y) => ((x + y * 3) % 11 === 0 ? PAL.waterLight : (y + x) % 17 === 0 ? PAL.ice : PAL.water);
      } else {
        const base = checker ? PAL.grass : '#3dbd69';
        top = (x, y) => {
          const k = `${x},${y}`;
          if (!noise.has(k)) {
            const v = rand();
            noise.set(k, v < 0.05 ? PAL.grassDark : v < 0.075 ? PAL.grassLight : base);
          }
          return noise.get(k)!;
        };
      }
      const bottom = isoBlock(ctx, bx, by, TILE_W, GROUND_DEPTH, top, PAL.dirt, PAL.woodDark);

      // Dark rim where the road meets grass, so the road reads as a groove.
      if (isRoad(tile)) {
        const half = TILE_W / 2;
        for (let x = 0; x < TILE_W; x++) {
          const yTop = x < half ? Math.floor((half - 1 - x) / 2) : Math.floor((x - half) / 2);
          const yBot = bottom[x];
          // The four diamond edges border (c-1, r), (c, r-1), (c, r+1) and (c+1, r).
          if (x < half && !isRoad(tileAt(c - 1, r))) px(ctx, bx + x, by + yTop, PAL.dirt);
          if (x >= half && !isRoad(tileAt(c, r - 1))) px(ctx, bx + x, by + yTop, PAL.dirt);
          if (x < half && !isRoad(tileAt(c, r + 1))) px(ctx, bx + x, by + yBot, PAL.dirt);
          if (x >= half && !isRoad(tileAt(c + 1, r))) px(ctx, bx + x, by + yBot, PAL.dirt);
        }
      }

      if (tile === 'spawn') drawPortal(ctx, bx, by);
      if (tile === 'grass') {
        const v = rand();
        const dx = bx + 10 + Math.floor(rand() * 12);
        const dy = by + 5 + Math.floor(rand() * 6);
        if (v < 0.35) { px(ctx, dx, dy, PAL.grassDark); px(ctx, dx + 2, dy, PAL.grassDark); px(ctx, dx + 1, dy + 1, PAL.grassDark); }
        else if (v < 0.47) { px(ctx, dx, dy, rand() < 0.5 ? PAL.yellow : PAL.white); px(ctx, dx + 1, dy + 1, PAL.orange); px(ctx, dx + 2, dy, PAL.white); }
      }
    }
  }
  return { canvas: cv, ox, oy: 0 };
}

function drawPortal(ctx: Ctx, bx: number, by: number): void {
  // A dark hole in the road where the monsters crawl out.
  const rows = ['....kkkkkk....', '..kkpppppkkk..', '.kppkkkkkkppk.', 'kppkkkkkkkkppk', '.kppkkkkkkppk.', '..kkpppppkkk..', '....kkkkkk....'];
  drawRows(ctx, rows, { k: PAL.ink, p: PAL.purple }, bx + 9, by + 4);
}

// ---------- Scenery ----------

export function drawTree(seed: number): SpriteArt {
  const [cv, ctx] = makeCanvas(16, 26);
  const rand = rng(seed);
  const cx = 8;
  px(ctx, cx - 1, 20, PAL.woodDark, 2, 5);
  px(ctx, cx - 2, 24, PAL.ink, 4, 1);
  const layers = [{ top: 0, h: 8, w: 8 }, { top: 5, h: 9, w: 12 }, { top: 11, h: 10, w: 16 }];
  for (const L of layers) {
    for (let y = 0; y < L.h; y++) {
      const half = Math.max(1, Math.round(((y + 1) / L.h) * (L.w / 2)));
      for (let x = cx - half; x < cx + half; x++) {
        const edge = x === cx - half || x === cx + half - 1 || y === L.h - 1;
        const color = edge ? PAL.ink : x < cx ? (rand() < 0.15 ? PAL.grassLight : PAL.grass) : PAL.grassDark;
        px(ctx, x, L.top + y, color);
      }
    }
  }
  return { canvas: cv, fx: 8, fy: 23 };
}

export function drawRock(): SpriteArt {
  const [cv, ctx] = makeCanvas(14, 11);
  isoBlock(ctx, 1, 2, 12, 4, (x, y) => (x + y < 8 ? PAL.white : PAL.stone), PAL.stoneDark, PAL.slate, PAL.ink);
  px(ctx, 5, 1, PAL.stone, 4, 1);
  return { canvas: cv, fx: 7, fy: 7 };
}

// ---------- Towers ----------

/** An upright isometric prism whose bottom centre is at (cx, footY). Width must be a multiple of 4. */
function prism(ctx: Ctx, cx: number, footY: number, w: number, height: number, top: string, left: string, right: string): number {
  const oy = footY - w / 4 - height;
  isoBlock(ctx, cx - w / 2, oy, w, height, () => top, left, right);
  return oy + w / 4; // centre of the top face
}

const TOWER_W = 26;
const TOWER_H = 42;
const TOWER_FOOT = 36;

function towerBase(ctx: Ctx): number {
  return prism(ctx, TOWER_W / 2, TOWER_FOOT, 24, 3, PAL.stone, PAL.stoneDark, PAL.slate);
}

export function drawTowerBue(): SpriteArt {
  const [cv, ctx] = makeCanvas(TOWER_W, TOWER_H);
  const cx = TOWER_W / 2;
  const baseTop = towerBase(ctx);
  const top = prism(ctx, cx, baseTop, 16, 15, PAL.wood, PAL.stone, PAL.stoneDark);
  // Merlons on the four corners of the roof.
  for (const [dx, dy] of [[-8, 0], [6, 0], [-1, -4], [-1, 3]]) px(ctx, cx + dx, top + dy - 2, PAL.woodDark, 2, 2);
  // Arrow slits.
  px(ctx, cx - 5, top + 8, PAL.ink, 1, 4);
  px(ctx, cx + 4, top + 8, PAL.ink, 1, 4);
  // Flag.
  px(ctx, cx, top - 12, PAL.ink, 1, 11);
  drawRows(ctx, ['rrrr', 'rrrrr', 'rrrr'], { r: PAL.red }, cx + 1, top - 12);
  return { canvas: cv, fx: cx, fy: TOWER_FOOT - 6 };
}

export function drawTowerKanon(): SpriteArt {
  const [cv, ctx] = makeCanvas(TOWER_W, TOWER_H);
  const cx = TOWER_W / 2;
  const baseTop = towerBase(ctx);
  const top = prism(ctx, cx, baseTop, 20, 8, PAL.wood, PAL.wood, PAL.woodDark);
  const rows = [
    '.......kkk',
    '......kSdk',
    '.....kSddk',
    '..kkkSddk.',
    '.kSSddddk.',
    'kSddddddk.',
    'kSddddddk.',
    'kddddddk..',
    '.kddddk...',
    '..kkkk....',
  ];
  drawRows(ctx, rows, { k: PAL.ink, d: PAL.slate, S: PAL.stoneDark }, cx - 5, top - 9);
  return { canvas: cv, fx: cx, fy: TOWER_FOOT - 6 };
}

export function drawTowerFrost(): SpriteArt {
  const [cv, ctx] = makeCanvas(TOWER_W, TOWER_H);
  const cx = TOWER_W / 2;
  const baseTop = towerBase(ctx);
  const top = prism(ctx, cx, baseTop, 16, 12, PAL.sky, PAL.blue, '#29408f');
  px(ctx, cx - 5, top + 6, PAL.ice, 1, 3);
  px(ctx, cx + 4, top + 6, PAL.ice, 1, 3);
  const crystal = ['...k...', '..kCk..', '.kCwck.', 'kCCwcck', '.kCcck.', '..kck..', '...k...'];
  drawRows(ctx, crystal, { k: PAL.ink, C: PAL.ice, c: PAL.sky, w: PAL.white }, cx - 3, top - 11);
  return { canvas: cv, fx: cx, fy: TOWER_FOOT - 6 };
}

export function drawCastle(): SpriteArt {
  const [cv, ctx] = makeCanvas(48, 60);
  const cx = 24;
  const foot = 52;
  prism(ctx, cx, foot, 36, 4, PAL.stone, PAL.stoneDark, PAL.slate);
  const keep = prism(ctx, cx, foot - 4, 24, 20, PAL.stone, PAL.stone, PAL.stoneDark);
  // Gate on the front-left face.
  drawRows(ctx, ['.kkk.', 'kdddk', 'kdddk', 'kdddk', 'kdddk'], { k: PAL.ink, d: PAL.slate }, cx - 9, keep + 13);
  // Corner turrets.
  for (const dx of [-12, 12]) {
    const t = prism(ctx, cx + dx, foot - 6, 8, 26, PAL.stone, PAL.stone, PAL.stoneDark);
    px(ctx, cx + dx, t - 10, PAL.ink, 1, 9);
    drawRows(ctx, ['yyy', 'yyyy', 'yyy'], { y: PAL.yellow }, cx + dx + 1, t - 10);
  }
  const t = prism(ctx, cx, foot - 18, 8, 22, PAL.stone, PAL.stone, PAL.stoneDark);
  px(ctx, cx, t - 12, PAL.ink, 1, 11);
  drawRows(ctx, ['rrrr', 'rrrrr', 'rrrr'], { r: PAL.red }, cx + 1, t - 12);
  return { canvas: cv, fx: cx, fy: foot - 9 };
}

// ---------- Enemies ----------
// Drawn facing down-right. The renderer mirrors them for down-left, and the "back" variants
// (eyes hidden) are used when walking away from the camera.

const SLIME = [
  '......kkkk......',
  '....kkllggkk....',
  '...kllgggggGk...',
  '..klgggggggggk..',
  '.klgggggEEgEEgk.',
  '.kggggggEegEegk.',
  'kgggggggggggggGk',
  'kgggggggggggggGk',
  'kGgggggggggggGGk',
  '.kGGgggggggGGGk.',
  '..kkGGGGGGGGGkk.',
  '....kkkkkkkkk...',
];

const BAT_UP = [
  '.k............k.',
  '.kk..........kk.',
  '.kpk...kk...kpk.',
  '.kppk.kppk.kppk.',
  '.kpppkppppkpppk.',
  '..kpppppEepppk..',
  '...kpppppppppk..',
  '.....kpppppk....',
  '......kk.kk.....',
];

const BAT_DOWN = [
  '................',
  '................',
  '.......kk.......',
  '......kppk......',
  '....kkppppkk....',
  '.kkkppppEepppkk.',
  'kpppppppppppppk.',
  'kppk.kpppppk.kpk',
  'kpk...kk.kk...kk',
];

const KNIGHT = [
  '.......kk.......',
  '......krrk......',
  '.....kkrrkk.....',
  '....kssssssk....',
  '...ksSsssssSk...',
  '...ksSsssVVVk...',
  '...ksSsssssSk...',
  '....kkssssskk...',
  '...kbbbbbbbbk...',
  '..kbbbbybbbbbk..',
  '..ksbbbbbbbbsk..',
  '..kskbbbbbbksk..',
  '...kkbbbbbbkk...',
  '....ksSk.ksSk...',
  '....kssk.kssk...',
  '....kkkk.kkkk...',
];

const ENEMY_COLORS: Record<string, string> = {
  k: PAL.ink, w: PAL.white, g: PAL.grass, l: PAL.grassLight, G: PAL.grassDark,
  E: PAL.white, e: PAL.ink, p: PAL.purple, r: PAL.red, s: PAL.stone, S: PAL.stoneDark,
  b: PAL.blue, y: PAL.yellow, V: PAL.ink,
};

function enemyArt(rows: string[], back: boolean, swap: Record<string, string> = {}, hide: Record<string, string> = {}): SpriteArt {
  const w = rows[0].length;
  const [cv, ctx] = makeCanvas(w, rows.length);
  const colors = { ...ENEMY_COLORS, ...swap };
  const src = back ? rows.map((r) => [...r].map((ch) => hide[ch] ?? ch).join('')) : rows;
  drawRows(ctx, src, colors);
  return { canvas: cv, fx: w / 2, fy: rows.length - 1 };
}

export function enemyArts(): Record<string, SpriteArt> {
  const slimeHide = { E: 'g', e: 'g' };
  const bossSwap = { g: PAL.red, l: PAL.orange, G: PAL.purple };
  const batHide = { E: 'p', e: 'p' };
  const knightHide = { V: 's' };
  return {
    'slime-front': enemyArt(SLIME, false),
    'slime-back': enemyArt(SLIME, true, {}, slimeHide),
    'boss-front': enemyArt(SLIME, false, bossSwap),
    'boss-back': enemyArt(SLIME, true, bossSwap, slimeHide),
    'bat-front-0': enemyArt(BAT_UP, false),
    'bat-front-1': enemyArt(BAT_DOWN, false),
    'bat-back-0': enemyArt(BAT_UP, true, {}, batHide),
    'bat-back-1': enemyArt(BAT_DOWN, true, {}, batHide),
    'knight-front': enemyArt(KNIGHT, false),
    'knight-back': enemyArt(KNIGHT, true, {}, knightHide),
  };
}

// ---------- HUD icons ----------

export function drawHeart(): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(8, 7);
  drawRows(ctx, ['.rr..rr.', 'rorrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...'], { r: PAL.red, o: PAL.orange });
  return cv;
}

export function drawCoin(): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(8, 8);
  drawRows(ctx, ['..kkkk..', '.kyyyyk.', 'kyywyyyk', 'kywyyyyk', 'kyyyyyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'], { k: PAL.woodDark, y: PAL.yellow, w: PAL.white });
  return cv;
}
