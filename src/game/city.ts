// The city: a square grid of tiles and the buildings standing on it. No graphics in here;
// the renderer reads this state, and positions are grid tiles, not screen pixels.

import { generateScenery, type Prop } from './scenery';

export const MAP_SIZE = 30;

export type BuildingType = 'castle' | 'wizard' | 'smithy';

export interface BuildingDef {
  name: string;
  /** Footprint in tiles. */
  w: number;
  h: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  castle: { name: 'Slot', w: 2, h: 2 },
  wizard: { name: 'Troldmandshus', w: 1, h: 1 },
  smithy: { name: 'Smedje', w: 1, h: 1 },
};

/** Buildings the player can put up once the castle stands. */
export const BUILDABLE: BuildingType[] = ['wizard', 'smithy'];

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
  /** Trees and rocks; each blocks its tile. */
  readonly props: Prop[];
  buildings: Building[] = [];
  phase: Phase = 'placeCastle';
  private nextId = 1;
  private propTiles: Set<string>;

  constructor(size = MAP_SIZE, props: Prop[] = generateScenery(size)) {
    this.size = size;
    this.props = props;
    this.propTiles = new Set(props.map((p) => `${p.c},${p.r}`));
  }

  propAt(c: number, r: number): Prop | undefined {
    return this.propTiles.has(`${c},${r}`) ? this.props.find((p) => p.c === c && p.r === r) : undefined;
  }

  buildingAt(c: number, r: number): Building | undefined {
    return this.buildings.find((b) => {
      const d = BUILDINGS[b.type];
      return c >= b.c && c < b.c + d.w && r >= b.r && r < b.r + d.h;
    });
  }

  /** True if the whole footprint is on the map and free of buildings, trees and rocks. */
  fits(type: BuildingType, c: number, r: number): boolean {
    const d = BUILDINGS[type];
    if (c < 0 || r < 0 || c + d.w > this.size || r + d.h > this.size) return false;
    for (let y = r; y < r + d.h; y++) {
      for (let x = c; x < c + d.w; x++) if (this.buildingAt(x, y) || this.propTiles.has(`${x},${y}`)) return false;
    }
    return true;
  }

  canPlace(type: BuildingType, c: number, r: number): boolean {
    // The castle comes first and there is only one; everything else is built after it.
    if ((type === 'castle') !== (this.phase === 'placeCastle')) return false;
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
