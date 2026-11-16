// What the player is doing right now: the city plus the building they have picked and the
// spot they have chosen but not yet confirmed. Shared by the map and the HTML around it.

import { BUILDINGS, City, type Building, type BuildingType } from './game/city';

export interface Plan {
  type: BuildingType;
  c: number;
  r: number;
}

type Listener = () => void;

export class Session {
  city = new City();
  /** The building picked in the build menu; the castle while it still has to be placed. */
  selected: BuildingType | null = 'castle';
  /** A building the player is about to place, shown as a ghost on the map. */
  plan: Plan | null = null;

  private listeners = new Set<Listener>();
  private placedListeners = new Set<(b: Building) => void>();

  onChange(fn: Listener): void {
    this.listeners.add(fn);
  }

  onPlaced(fn: (b: Building) => void): void {
    this.placedListeners.add(fn);
  }

  private changed(): void {
    this.listeners.forEach((fn) => fn());
  }

  select(type: BuildingType | null): void {
    this.selected = type;
    this.plan = null;
    this.changed();
  }

  /** The player tapped the map at a grid position (fractions allowed). */
  tapGround(x: number, y: number): void {
    const type = this.selected;
    if (!type) return;
    // Centre the footprint on the finger rather than hanging it off a corner.
    const d = BUILDINGS[type];
    this.plan = { type, c: Math.round(x - d.w / 2), r: Math.round(y - d.h / 2) };
    this.changed();
  }

  get planValid(): boolean {
    return !!this.plan && this.city.canPlace(this.plan.type, this.plan.c, this.plan.r);
  }

  confirmPlan(): void {
    if (!this.plan) return;
    const b = this.city.place(this.plan.type, this.plan.c, this.plan.r);
    if (!b) return;
    this.plan = null;
    this.selected = null;
    this.placedListeners.forEach((fn) => fn(b));
    this.changed();
  }

  cancelPlan(): void {
    this.plan = null;
    if (this.city.phase === 'build') this.selected = null;
    this.changed();
  }
}
