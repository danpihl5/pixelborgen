import { describe, expect, it } from 'vitest';
import { City } from './city';

describe('city', () => {
  it('is a 60 × 60 map that starts by asking for the castle', () => {
    const city = new City();
    expect(city.size).toBe(60);
    expect(city.phase).toBe('placeCastle');
    expect(city.buildings).toHaveLength(0);
  });

  it('places a castle covering 2 × 2 tiles', () => {
    const city = new City();
    const castle = city.place('castle', 10, 20);
    expect(castle).not.toBeNull();
    expect(city.buildingAt(10, 20)).toBe(castle);
    expect(city.buildingAt(11, 21)).toBe(castle);
    expect(city.buildingAt(12, 20)).toBeUndefined();
    expect(city.buildingAt(10, 22)).toBeUndefined();
    expect(city.phase).toBe('build');
  });

  it('keeps the whole footprint on the map', () => {
    const city = new City();
    expect(city.canPlace('castle', -1, 5)).toBe(false);
    expect(city.canPlace('castle', 59, 5)).toBe(false);
    expect(city.canPlace('castle', 5, 59)).toBe(false);
    expect(city.canPlace('castle', 58, 58)).toBe(true);
  });

  it('allows only one castle', () => {
    const city = new City();
    city.place('castle', 0, 0);
    expect(city.place('castle', 30, 30)).toBeNull();
    expect(city.buildings).toHaveLength(1);
  });
});
