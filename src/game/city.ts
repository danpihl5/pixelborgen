// The city: a square grid of tiles and the buildings standing on it. No graphics in here;
// the renderer reads this state, and positions are grid tiles, not screen pixels.

export const MAP_SIZE = 30;

export type BuildingType = 'castle';

export interface BuildingDef {
  name: string;
  /** Footprint in tiles. */
  w: number;
  h: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  castle: { name: 'Slot', w: 2, h: 2 },
};

export interface Building {
  id: number;
  type: BuildingType;
  /** Top corner of the footprint. */
  c: number;
  r: number;
}

/** What the player has to do next. */
export type Phase = 'placeCastle' | 'build';

export class City {
  readonly size: number;
  buildings: Building[] = [];
  phase: Phase = 'placeCastle';
  private nextId = 1;

  constructor(size = MAP_SIZE) {
    this.size = size;
  }

  buildingAt(c: number, r: number): Building | undefined {
    return this.buildings.find((b) => {
      const d = BUILDINGS[b.type];
      return c >= b.c && c < b.c + d.w && r >= b.r && r < b.r + d.h;
    });
  }

  /** True if the whole footprint is on the map and free. */
  fits(type: BuildingType, c: number, r: number): boolean {
    const d = BUILDINGS[type];
    if (c < 0 || r < 0 || c + d.w > this.size || r + d.h > this.size) return false;
    for (let y = r; y < r + d.h; y++) {
      for (let x = c; x < c + d.w; x++) if (this.buildingAt(x, y)) return false;
    }
    return true;
  }

  canPlace(type: BuildingType, c: number, r: number): boolean {
    if (type === 'castle' && this.phase !== 'placeCastle') return false;
    return this.fits(type, c, r);
  }

  place(type: BuildingType, c: number, r: number): Building | null {
    if (!this.canPlace(type, c, r)) return null;
    const b: Building = { id: this.nextId++, type, c, r };
    this.buildings.push(b);
    if (type === 'castle') this.phase = 'build';
    return b;
  }
}
