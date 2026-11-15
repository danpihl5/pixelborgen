// Balance numbers for towers and enemies. Distances are in tiles, times in seconds.

export type TowerType = 'bue' | 'kanon' | 'frost';
export type EnemyType = 'slime' | 'bat' | 'knight' | 'boss';

export interface TowerDef {
  name: string;
  desc: string;
  cost: number;
  range: number;
  dmg: number;
  /** Seconds between shots. */
  rate: number;
  /** Projectile speed in tiles per second. */
  speed: number;
  /** Splash radius in tiles; 0 hits only the target. */
  splash: number;
  /** Fraction of speed removed while slowed; 0 means no slow. */
  slow: number;
}

export interface EnemyDef {
  name: string;
  hp: number;
  /** Tiles per second. */
  speed: number;
  reward: number;
  /** Lives lost when it reaches the castle. */
  dmg: number;
  flying: boolean;
}

export const TOWERS: Record<TowerType, TowerDef> = {
  bue: { name: 'Bue', desc: 'Hurtige pile', cost: 50, range: 2.6, dmg: 7, rate: 0.55, speed: 10, splash: 0, slow: 0 },
  kanon: { name: 'Kanon', desc: 'Rammer flere', cost: 90, range: 2.3, dmg: 16, rate: 1.4, speed: 6, splash: 1.0, slow: 0 },
  frost: { name: 'Frost', desc: 'Bremser dem', cost: 70, range: 2.0, dmg: 3, rate: 0.9, speed: 8, splash: 0.7, slow: 0.5 },
};

export const TOWER_TYPES = Object.keys(TOWERS) as TowerType[];

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  slime: { name: 'Slim', hp: 22, speed: 1.0, reward: 4, dmg: 1, flying: false },
  bat: { name: 'Flagermus', hp: 13, speed: 1.8, reward: 4, dmg: 1, flying: true },
  knight: { name: 'Ridder', hp: 70, speed: 0.7, reward: 9, dmg: 2, flying: false },
  boss: { name: 'Kæmpeslim', hp: 340, speed: 0.55, reward: 60, dmg: 10, flying: false },
};

export const START_GOLD = 160;
export const START_LIVES = 20;
export const MAX_LEVEL = 3;
export const SELL_RATE = 0.7;
/** How long a frost hit keeps an enemy slowed. */
export const SLOW_TIME = 1.6;
/** Bosses shrug off part of the slow. */
export const BOSS_SLOW_FACTOR = 0.75;

export function waveBonus(wave: number): number {
  return 15 + 4 * wave;
}
