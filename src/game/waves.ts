import type { EnemyType } from './data';

export interface WaveSpawn {
  type: EnemyType;
  /** Seconds to wait after this spawn before the next one. */
  gap: number;
}

export interface Wave {
  spawns: WaveSpawn[];
  /** Multiplier on every enemy's base hit points. */
  hpMul: number;
  /** Extra gold per kill, so later waves keep paying for upgrades. */
  rewardBonus: number;
}

export function makeWave(wave: number): Wave {
  const count = Math.min(6 + wave * 2, 44);
  const spawns: WaveSpawn[] = [];
  for (let i = 0; i < count; i++) {
    let type: EnemyType = 'slime';
    if (wave >= 3 && i % 3 === 1) type = 'bat';
    if (wave >= 5 && i % 4 === 3) type = 'knight';
    if (wave >= 8 && i % 5 === 0) type = 'knight';
    spawns.push({ type, gap: type === 'bat' ? 0.45 : 0.85 });
  }
  if (wave % 5 === 0) spawns.push({ type: 'boss', gap: 1.5 });
  return {
    spawns,
    hpMul: (1 + 0.25 * (wave - 1)) * Math.pow(1.05, wave - 1),
    rewardBonus: Math.floor(wave / 4),
  };
}

export const isBossWave = (wave: number) => wave % 5 === 0;
