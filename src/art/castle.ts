// The castle is the owner's reference picture itself, cut out by tools/cut_castle.py.
// It is stored at about twice the size it is shown, so it stays sharp when zoomed in.

import meta from '../assets/castle.json';
import castleUrl from '../assets/castle.png';
import { TILE_W } from '../iso';
import { makeCanvas } from './pixels';
import type { SpriteArt } from './textures';

/** The moat's outer edge covers the castle's 2 × 2 footprint. */
const FOOTPRINT_TILES = 2;

export async function loadCastle(): Promise<SpriteArt> {
  const img = new Image();
  img.src = castleUrl;
  await img.decode();
  const [canvas, ctx] = makeCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  return { canvas, fx: meta.fx, fy: meta.fy, scale: (FOOTPRINT_TILES * TILE_W) / meta.diamondWidth, smooth: true };
}
