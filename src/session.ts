// What the player is doing right now: the city plus the spot they have picked but not yet
// confirmed. Shared by the map and the HTML around it.

import { City, type Building, type BuildingType } from './game/city';

export interface Plan {
  type: BuildingType;
  c: number;
  r: number;
}

type Listener = () => void;

export class Session {
  city = new City();
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

  /** The player tapped the map at a grid position (fractions allowed). */
  tapGround(x: number, y: number): void {
    if (this.city.phase !== 'placeCastle') return;
    // Centre the footprint on the finger rather than hanging it off a corner.
    const type: BuildingType = 'castle';
    const c = Math.round(x - 1);
    const r = Math.round(y - 1);
    this.plan = { type, c, r };
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
    this.placedListeners.forEach((fn) => fn(b));
    this.changed();
  }

  cancelPlan(): void {
    this.plan = null;
    this.changed();
  }
}
