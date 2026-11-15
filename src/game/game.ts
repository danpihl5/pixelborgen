// The whole game simulation. It has no idea how things are drawn: the renderer reads the
// public state each frame and plays sounds and effects from the events the game emits.

import {
  BOSS_SLOW_FACTOR, ENEMIES, MAX_LEVEL, SELL_RATE, SLOW_TIME, START_GOLD, START_LIVES, TOWERS,
  waveBonus, type EnemyType, type TowerType,
} from './data';
import { buildLevel, isBuildable, Path, type Level } from './level';
import { makeWave, type WaveSpawn } from './waves';

export interface Tower {
  id: number;
  type: TowerType;
  c: number;
  r: number;
  /** Tile-centre position. */
  x: number;
  y: number;
  level: number;
  cooldown: number;
  /** Gold put into this tower, used for the sell price. */
  spent: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  /** Tiles travelled along the path. */
  dist: number;
  x: number;
  y: number;
  /** Unit walking direction in tile space. */
  dx: number;
  dy: number;
  speed: number;
  reward: number;
  dmg: number;
  slowTime: number;
  slowFactor: number;
  dead: boolean;
}

export interface Shot {
  id: number;
  type: TowerType;
  x: number;
  y: number;
  /** 0 at the tower, 1 on impact; lets the renderer arc the projectile. */
  progress: number;
  startDist: number;
  target: Enemy | null;
  tx: number;
  ty: number;
  dmg: number;
  splash: number;
  slow: number;
  speed: number;
  done: boolean;
}

export type GameEvent =
  | { type: 'shoot'; tower: Tower }
  | { type: 'hit'; shot: Shot }
  | { type: 'damage'; enemy: Enemy }
  | { type: 'kill'; enemy: Enemy }
  | { type: 'leak'; enemy: Enemy }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'gameOver'; wavesCleared: number }
  | { type: 'build'; tower: Tower }
  | { type: 'upgrade'; tower: Tower }
  | { type: 'sell'; tower: Tower; refund: number };

export interface TowerStats {
  dmg: number;
  range: number;
  rate: number;
  splash: number;
  slow: number;
  speed: number;
}

export function towerStats(type: TowerType, level: number): TowerStats {
  const b = TOWERS[type];
  const l = level - 1;
  return {
    dmg: Math.round(b.dmg * Math.pow(1.6, l)),
    range: b.range + 0.35 * l,
    rate: b.rate * Math.pow(0.85, l),
    splash: b.splash,
    slow: b.slow,
    speed: b.speed,
  };
}

export class Game {
  readonly level: Level;
  readonly path: Path;

  gold = START_GOLD;
  lives = START_LIVES;
  wave = 0;
  waveActive = false;
  over = false;

  towers: Tower[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];

  private queue: WaveSpawn[] = [];
  private spawnTimer = 0;
  private hpMul = 1;
  private rewardBonus = 0;
  private nextId = 1;
  private events: GameEvent[] = [];

  constructor(level: Level = buildLevel()) {
    this.level = level;
    this.path = new Path(level.waypoints);
  }

  /** Events since the last call, oldest first. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  towerAt(c: number, r: number): Tower | undefined {
    return this.towers.find((t) => t.c === c && t.r === r);
  }

  canBuild(c: number, r: number): boolean {
    return !this.over && isBuildable(this.level, c, r) && !this.towerAt(c, r);
  }

  build(type: TowerType, c: number, r: number): Tower | null {
    const cost = TOWERS[type].cost;
    if (!this.canBuild(c, r) || this.gold < cost) return null;
    this.gold -= cost;
    const tower: Tower = { id: this.nextId++, type, c, r, x: c + 0.5, y: r + 0.5, level: 1, cooldown: 0, spent: cost };
    this.towers.push(tower);
    this.events.push({ type: 'build', tower });
    return tower;
  }

  upgradeCost(t: Tower): number {
    return Math.round(TOWERS[t.type].cost * 0.75 * t.level);
  }

  upgrade(t: Tower): boolean {
    const cost = this.upgradeCost(t);
    if (this.over || t.level >= MAX_LEVEL || this.gold < cost) return false;
    this.gold -= cost;
    t.spent += cost;
    t.level++;
    this.events.push({ type: 'upgrade', tower: t });
    return true;
  }

  sellValue(t: Tower): number {
    return Math.floor(t.spent * SELL_RATE);
  }

  sell(t: Tower): void {
    if (this.over || !this.towers.includes(t)) return;
    const refund = this.sellValue(t);
    this.gold += refund;
    this.towers = this.towers.filter((x) => x !== t);
    this.events.push({ type: 'sell', tower: t, refund });
  }

  startWave(): boolean {
    if (this.waveActive || this.over) return false;
    this.wave++;
    const w = makeWave(this.wave);
    this.queue = [...w.spawns];
    this.hpMul = w.hpMul;
    this.rewardBonus = w.rewardBonus;
    this.spawnTimer = 0.3;
    this.waveActive = true;
    this.events.push({ type: 'waveStart', wave: this.wave });
    return true;
  }

  update(dt: number): void {
    if (this.over) return;
    this.spawn(dt);
    this.moveEnemies(dt);
    if (this.over) return;
    this.fireTowers(dt);
    this.moveShots(dt);

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.shots = this.shots.filter((s) => !s.done);

    if (this.waveActive && this.queue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      const bonus = waveBonus(this.wave);
      this.gold += bonus;
      this.events.push({ type: 'waveCleared', wave: this.wave, bonus });
    }
  }

  private spawn(dt: number): void {
    if (!this.queue.length) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const next = this.queue.shift()!;
    const def = ENEMIES[next.type];
    const hp = Math.round(def.hp * this.hpMul);
    const p = this.path.at(0);
    this.enemies.push({
      id: this.nextId++, type: next.type, hp, maxHp: hp, dist: 0, x: p.x, y: p.y, dx: p.dx, dy: p.dy,
      speed: def.speed, reward: def.reward + this.rewardBonus, dmg: def.dmg, slowTime: 0, slowFactor: 1, dead: false,
    });
    this.spawnTimer = next.gap;
  }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const slow = e.slowTime > 0 ? e.slowFactor : 1;
      e.slowTime = Math.max(0, e.slowTime - dt);
      e.dist += e.speed * slow * dt;
      const p = this.path.at(e.dist);
      e.x = p.x; e.y = p.y; e.dx = p.dx; e.dy = p.dy;
      if (e.dist >= this.path.length) {
        e.dead = true;
        this.lives = Math.max(0, this.lives - e.dmg);
        this.events.push({ type: 'leak', enemy: e });
        if (this.lives === 0) {
          this.over = true;
          this.waveActive = false;
          this.events.push({ type: 'gameOver', wavesCleared: this.wave - 1 });
          return;
        }
      }
    }
  }

  private fireTowers(dt: number): void {
    for (const t of this.towers) {
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const st = towerStats(t.type, t.level);
      // Aim at the enemy furthest along the path inside range.
      let target: Enemy | null = null;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        if (dx * dx + dy * dy <= st.range * st.range && (!target || e.dist > target.dist)) target = e;
      }
      if (!target) continue;
      this.shots.push({
        id: this.nextId++, type: t.type, x: t.x, y: t.y, progress: 0,
        startDist: Math.hypot(target.x - t.x, target.y - t.y), target, tx: target.x, ty: target.y,
        dmg: st.dmg, splash: st.splash, slow: st.slow, speed: st.speed, done: false,
      });
      t.cooldown = st.rate;
      this.events.push({ type: 'shoot', tower: t });
    }
  }

  private moveShots(dt: number): void {
    for (const s of this.shots) {
      if (s.target && !s.target.dead) { s.tx = s.target.x; s.ty = s.target.y; }
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const d = Math.hypot(dx, dy);
      const step = s.speed * dt;
      if (d <= step) {
        s.x = s.tx; s.y = s.ty; s.progress = 1;
        this.impact(s);
        s.done = true;
      } else {
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        s.progress = Math.min(0.99, 1 - d / Math.max(s.startDist, d));
      }
    }
  }

  private impact(s: Shot): void {
    if (s.splash > 0) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        if (dx * dx + dy * dy > s.splash * s.splash) continue;
        if (s.slow > 0) {
          e.slowTime = SLOW_TIME;
          e.slowFactor = e.type === 'boss' ? BOSS_SLOW_FACTOR : 1 - s.slow;
        }
        this.damage(e, s.dmg);
      }
    } else if (s.target && !s.target.dead) {
      this.damage(s.target, s.dmg);
    }
    this.events.push({ type: 'hit', shot: s });
  }

  private damage(e: Enemy, dmg: number): void {
    if (e.dead) return;
    e.hp -= dmg;
    this.events.push({ type: 'damage', enemy: e });
    if (e.hp <= 0) {
      e.dead = true;
      this.gold += e.reward;
      this.events.push({ type: 'kill', enemy: e });
    }
  }
}
