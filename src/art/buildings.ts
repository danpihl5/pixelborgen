// Building graphics are the owner's reference pictures themselves, cut out by
// tools/cut_buildings.py. They are stored at twice the size they are shown, so they stay
// sharp when zoomed in, and are smoothed rather than shown as hard pixels.

import castleMeta from '../assets/castle.json';
import castleUrl from '../assets/castle.png';
import smithyMeta from '../assets/smithy.json';
import smithyUrl from '../assets/smithy.png';
import wizardMeta from '../assets/wizard.json';
import wizardUrl from '../assets/wizard.png';
import type { BuildingType } from '../game/city';
import { TILE_W } from '../iso';
import { makeCanvas } from './pixels';
import type { SpriteArt } from './textures';

interface Meta { fx: number; fy: number; baseWidth: number; tiles: number }

const SOURCES: Record<BuildingType, { url: string; meta: Meta }> = {
  castle: { url: castleUrl, meta: castleMeta },
  wizard: { url: wizardUrl, meta: wizardMeta },
  smithy: { url: smithyUrl, meta: smithyMeta },
};

/** Picture URLs, for the build menu. */
export const BUILDING_IMAGES = Object.fromEntries(
  Object.entries(SOURCES).map(([type, s]) => [type, s.url]),
) as Record<BuildingType, string>;

async function load(url: string, meta: Meta): Promise<SpriteArt> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const [canvas, ctx] = makeCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  // `baseWidth` sprite pixels span the footprint, which is `tiles` tiles wide on screen.
  return { canvas, fx: meta.fx, fy: meta.fy, scale: (meta.tiles * TILE_W) / meta.baseWidth, smooth: true };
}

export async function loadBuildingArt(): Promise<Record<BuildingType, SpriteArt>> {
  const entries = await Promise.all(
    Object.entries(SOURCES).map(async ([type, s]) => [type, await load(s.url, s.meta)] as const),
  );
  return Object.fromEntries(entries) as Record<BuildingType, SpriteArt>;
}
