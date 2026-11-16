import { describe, expect, it } from 'vitest';
import { City } from './city';
import { CLEAR_CENTRE, generateScenery } from './scenery';

describe('city', () => {
  it('is a 30 × 30 map that starts by asking for the castle', () => {
    const city = new City();
    expect(city.size).toBe(30);
    expect(city.phase).toBe('placeCastle');
    expect(city.buildings).toHaveLength(0);
  });

  it('places a castle covering 2 × 2 tiles', () => {
    const city = new City(30, []);
    const castle = city.place('castle', 10, 20);
    expect(castle).not.toBeNull();
    expect(city.buildingAt(10, 20)).toBe(castle);
    expect(city.buildingAt(11, 21)).toBe(castle);
    expect(city.buildingAt(12, 20)).toBeUndefined();
    expect(city.buildingAt(10, 22)).toBeUndefined();
    expect(city.phase).toBe('build');
  });

  it('keeps the whole footprint on the map', () => {
    const city = new City(30, []);
    expect(city.canPlace('castle', -1, 5)).toBe(false);
    expect(city.canPlace('castle', 29, 5)).toBe(false);
    expect(city.canPlace('castle', 5, 29)).toBe(false);
    expect(city.canPlace('castle', 28, 28)).toBe(true);
  });

  it('allows only one castle', () => {
    const city = new City(30, []);
    city.place('castle', 0, 0);
    expect(city.place('castle', 30, 30)).toBeNull();
    expect(city.buildings).toHaveLength(1);
  });

  it('builds other buildings only after the castle, and not on top of each other', () => {
    const city = new City(30, []);
    expect(city.canPlace('tavern', 5, 5)).toBe(false);
    city.place('castle', 10, 10);
    expect(city.place('tavern', 5, 5)).not.toBeNull();
    expect(city.place('wizard', 5, 5)).toBeNull();
    expect(city.place('wizard', 10, 11)).toBeNull(); // the castle is in the way
    const farm = city.place('farm', 6, 5);
    expect(farm).not.toBeNull();
    expect(city.buildingAt(6, 5)).toBe(farm);
    expect(city.buildingAt(7, 5)).toBeUndefined();
    expect(city.canPlace('farm', 29, 29)).toBe(true);
    expect(city.canPlace('farm', 30, 29)).toBe(false);
    expect(city.place('smithy', 6, 6)).not.toBeNull();
    expect(city.buildings).toHaveLength(4);
  });

  it('does not build on trees or rocks', () => {
    const city = new City(30, [{ kind: 'tree', c: 5, r: 5 }, { kind: 'rock', c: 9, r: 9 }]);
    expect(city.canPlace('castle', 4, 4)).toBe(false);
    expect(city.canPlace('castle', 8, 9)).toBe(false);
    expect(city.canPlace('castle', 6, 5)).toBe(true);
    expect(city.propAt(5, 5)?.kind).toBe('tree');
  });
});

describe('scenery', () => {
  it('is the same every time and keeps the centre clear', () => {
    const a = generateScenery(30);
    expect(a).toEqual(generateScenery(30));
    expect(a.some((p) => p.kind === 'tree')).toBe(true);
    expect(a.some((p) => p.kind === 'rock')).toBe(true);
    const mid = 29 / 2;
    for (const p of a) expect(Math.max(Math.abs(p.c - mid), Math.abs(p.r - mid)) / mid).toBeGreaterThanOrEqual(CLEAR_CENTRE);
    expect(new City().canPlace('castle', 14, 14)).toBe(true);
  });
});
