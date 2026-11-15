// The map: a square grid seen from above. The renderer turns it into isometric diamonds,
// but nothing in here knows about the screen.

export type Tile = 'grass' | 'path' | 'tree' | 'rock' | 'bush' | 'field' | 'water' | 'spawn' | 'castle';

export interface Level {
  cols: number;
  rows: number;
  tiles: Tile[][];
  /** Path corners as [col, row]; enemies walk from the first to the last through tile centres. */
  waypoints: [number, number][];
}

const LEGEND: Record<string, Tile> = { '.': 'grass', T: 'tree', r: 'rock', b: 'bush', f: 'field', '~': 'water' };

// Scenery only. The path is carved on top from the waypoints below.
const SCENERY = [
  'TT..b..~~~TT',
  '.........b.T',
  'T.........TT',
  '...........b',
  'T..r.....fff',
  '.........fff',
  'TT......r..T',
  'T..........T',
  'b...........',
  '...........T',
  'T.r....b....',
  'TTb...T..b.T',
];

const WAYPOINTS: [number, number][] = [
  [0, 1], [4, 1], [4, 5], [1, 5], [1, 9], [6, 9], [6, 3], [9, 3], [9, 10],
];

export function buildLevel(scenery = SCENERY, waypoints = WAYPOINTS): Level {
  const rows = scenery.length;
  const cols = scenery[0].length;
  const tiles: Tile[][] = scenery.map((line) => [...line].map((ch) => LEGEND[ch] ?? 'grass'));

  for (let i = 0; i < waypoints.length - 1; i++) {
    const [c1, r1] = waypoints[i];
    const [c2, r2] = waypoints[i + 1];
    if (c1 !== c2 && r1 !== r2) throw new Error(`Path segment ${i} is not straight`);
    const dc = Math.sign(c2 - c1);
    const dr = Math.sign(r2 - r1);
    for (let c = c1, r = r1; ; c += dc, r += dr) {
      tiles[r][c] = 'path';
      if (c === c2 && r === r2) break;
    }
  }
  const [sc, sr] = waypoints[0];
  const [ec, er] = waypoints[waypoints.length - 1];
  tiles[sr][sc] = 'spawn';
  tiles[er][ec] = 'castle';

  return { cols, rows, tiles, waypoints };
}

export function isBuildable(level: Level, c: number, r: number): boolean {
  return r >= 0 && r < level.rows && c >= 0 && c < level.cols && level.tiles[r][c] === 'grass';
}

/** A polyline through tile centres with lookups by distance travelled. */
export class Path {
  readonly points: { x: number; y: number }[];
  private readonly segs: { x: number; y: number; dx: number; dy: number; len: number; start: number }[] = [];
  readonly length: number;

  constructor(waypoints: [number, number][]) {
    this.points = waypoints.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
    let total = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      this.segs.push({ x: a.x, y: a.y, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, len, start: total });
      total += len;
    }
    this.length = total;
  }

  /** Position and walking direction after travelling `d` tiles along the path. */
  at(d: number): { x: number; y: number; dx: number; dy: number } {
    for (const s of this.segs) {
      if (d <= s.start + s.len) {
        const t = Math.max(0, d - s.start);
        return { x: s.x + s.dx * t, y: s.y + s.dy * t, dx: s.dx, dy: s.dy };
      }
    }
    const s = this.segs[this.segs.length - 1];
    return { x: s.x + s.dx * s.len, y: s.y + s.dy * s.len, dx: s.dx, dy: s.dy };
  }
}
