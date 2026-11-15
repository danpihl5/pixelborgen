import { describe, expect, it } from 'vitest';
import { START_GOLD, TOWERS } from './data';
import { Game } from './game';
import { buildLevel, Path } from './level';
import { makeWave } from './waves';

function run(game: Game, seconds: number, step = 1 / 60) {
  for (let t = 0; t < seconds && !game.over; t += step) game.update(step);
}

describe('level', () => {
  it('carves the path from spawn to castle', () => {
    const level = buildLevel();
    const [sc, sr] = level.waypoints[0];
    const [ec, er] = level.waypoints[level.waypoints.length - 1];
    expect(level.tiles[sr][sc]).toBe('spawn');
    expect(level.tiles[er][ec]).toBe('castle');
    expect(level.tiles.flat().filter((t) => t === 'path').length).toBeGreaterThan(20);
  });

  it('rejects diagonal path segments', () => {
    expect(() => buildLevel(['...', '...', '...'], [[0, 0], [2, 2]])).toThrow();
  });

  it('measures and walks the path', () => {
    const path = new Path([[0, 0], [3, 0], [3, 2]]);
    expect(path.length).toBe(5);
    expect(path.at(4)).toMatchObject({ x: 3.5, y: 1.5, dx: 0, dy: 1 });
  });
});

describe('building', () => {
  it('only builds on free grass and charges gold', () => {
    const g = new Game();
    expect(g.build('bue', 4, 1)).toBeNull(); // path
    expect(g.build('bue', 0, 0)).toBeNull(); // tree
    const t = g.build('bue', 2, 3);
    expect(t).not.toBeNull();
    expect(g.gold).toBe(START_GOLD - TOWERS.bue.cost);
    expect(g.build('kanon', 2, 3)).toBeNull(); // occupied
  });

  it('upgrades up to level 3 and refunds 70 % on sale', () => {
    const g = new Game();
    g.gold = 1000;
    const t = g.build('kanon', 2, 3)!;
    expect(g.upgrade(t)).toBe(true);
    expect(g.upgrade(t)).toBe(true);
    expect(g.upgrade(t)).toBe(false);
    const spent = t.spent;
    const before = g.gold;
    g.sell(t);
    expect(g.gold).toBe(before + Math.floor(spent * 0.7));
    expect(g.towers).toHaveLength(0);
  });
});

describe('waves', () => {
  it('adds a boss every fifth wave', () => {
    expect(makeWave(4).spawns.some((s) => s.type === 'ogre')).toBe(false);
    expect(makeWave(5).spawns.at(-1)?.type).toBe('ogre');
  });

  it('a couple of towers hold the first wave', () => {
    const g = new Game();
    g.build('bue', 3, 2);
    g.build('kanon', 2, 6);
    g.startWave();
    run(g, 60);
    expect(g.waveActive).toBe(false);
    expect(g.lives).toBe(20);
    expect(g.drainEvents().some((e) => e.type === 'waveCleared')).toBe(true);
  });

  it('ends the game when an undefended castle falls', () => {
    const g = new Game();
    for (let i = 0; i < 5 && !g.over; i++) {
      g.startWave();
      run(g, 120);
    }
    expect(g.over).toBe(true);
    expect(g.lives).toBe(0);
    expect(g.drainEvents().some((e) => e.type === 'gameOver')).toBe(true);
  });
});
