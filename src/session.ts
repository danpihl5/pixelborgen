// What the player is doing right now: the running game plus everything around it that the
// rules don't care about (selection, speed, pause, record). Shared by the map and the HUD.

import { Game, type GameEvent, type Tower } from './game/game';
import type { TowerType } from './game/data';
import { storage } from './storage';

export type Selection =
  | { kind: 'tile'; c: number; r: number }
  | { kind: 'tower'; tower: Tower }
  | null;

type Listener = () => void;
type EventListener = (e: GameEvent) => void;

export class Session {
  game = new Game();
  selection: Selection = null;
  speed = 1;
  paused = false;
  started = false;
  best = Number(storage.get('best')) || 0;

  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();

  /** Called when the selection or the set of towers changes. */
  onChange(fn: Listener): void {
    this.listeners.add(fn);
  }

  /** Receives every game event, after the map has played its effects. */
  onEvent(fn: EventListener): void {
    this.eventListeners.add(fn);
  }

  changed(): void {
    this.listeners.forEach((fn) => fn());
  }

  dispatch(e: GameEvent): void {
    if (e.type === 'waveCleared') this.saveBest(e.wave);
    if (e.type === 'gameOver') {
      this.saveBest(e.wavesCleared);
      this.selection = null;
      this.changed();
    }
    this.eventListeners.forEach((fn) => fn(e));
  }

  get running(): boolean {
    return this.started && !this.paused && !this.game.over;
  }

  tapTile(c: number, r: number): void {
    if (!this.started || this.game.over) return;
    const tower = this.game.towerAt(c, r);
    if (tower) return this.tapTower(tower);
    const sel = this.selection;
    const same = sel?.kind === 'tile' && sel.c === c && sel.r === r;
    this.selection = !same && this.game.canBuild(c, r) ? { kind: 'tile', c, r } : null;
    this.changed();
  }

  tapTower(tower: Tower): void {
    if (!this.started || this.game.over) return;
    const sel = this.selection;
    this.selection = sel?.kind === 'tower' && sel.tower === tower ? null : { kind: 'tower', tower };
    this.changed();
  }

  build(type: TowerType): void {
    const sel = this.selection;
    if (sel?.kind !== 'tile') return;
    const tower = this.game.build(type, sel.c, sel.r);
    if (tower) this.selection = { kind: 'tower', tower };
    this.changed();
  }

  upgrade(): void {
    const sel = this.selection;
    if (sel?.kind === 'tower') this.game.upgrade(sel.tower);
    this.changed();
  }

  sell(): void {
    const sel = this.selection;
    if (sel?.kind !== 'tower') return;
    this.game.sell(sel.tower);
    this.selection = null;
    this.changed();
  }

  restart(): void {
    this.game = new Game();
    this.selection = null;
    this.paused = false;
    this.started = true;
    this.changed();
  }

  private saveBest(waves: number): void {
    if (waves <= this.best) return;
    this.best = waves;
    storage.set('best', String(waves));
  }
}
