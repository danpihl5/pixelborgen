// Trees and rocks scattered over the map. They take up their tile, so nothing can be built
// there. Generated from a seed so the same map comes back every time.

export type PropKind = 'tree' | 'rock';

export interface Prop {
  kind: PropKind;
  c: number;
  r: number;
}

function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Fraction of the map around the centre kept free for the castle and the first buildings. */
export const CLEAR_CENTRE = 0.4;

export function generateScenery(size: number, seed = 7): Prop[] {
  const rand = rng(seed);
  const mid = (size - 1) / 2;
  const props: Prop[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // 0 in the middle, 1 at the edge.
      const edge = Math.max(Math.abs(c - mid), Math.abs(r - mid)) / mid;
      if (edge < CLEAR_CENTRE) continue;
      const t = (edge - CLEAR_CENTRE) / (1 - CLEAR_CENTRE);
      // Low-frequency waves group the trees into small woods instead of an even sprinkle.
      const wood = Math.sin(c * 0.55) + Math.cos(r * 0.45) + Math.sin((c + r) * 0.3);
      const treeChance = wood > 0.6 ? 0.1 + 0.45 * t : 0.03 * t;
      const v = rand();
      if (v < treeChance) props.push({ kind: 'tree', c, r });
      else if (v < treeChance + 0.025 + 0.02 * t) props.push({ kind: 'rock', c, r });
    }
  }
  return props;
}
