# Pixelborgen

Isometric pixel-art city builder with tower-defence elements, for phones. Early stage: a 30 × 30 grass map where the player places a 2 × 2 castle and can then build an Ølstue (tavern), a Farmerhus (farm) and a Troldmandshus (wizard), each 1 × 1 with its picture scaled to fit the tile. Phaser 3 + TypeScript + Vite, wrapped as an app with Capacitor. The owner speaks Danish: all player-facing text and the README are in Danish; code and comments are in English.

## Commands

- `npm run dev` – dev server (exposes `window.pixelborgen` with `session` and `phaser` for debugging)
- `npm test` – Vitest on the game rules
- `npm run build` – type-check and build to `dist/` (Capacitor's `webDir`)
- `npm run build:single` – one self-contained HTML file in `dist-single/`

## Architecture

- `src/game/city.ts` is the pure model: no Phaser, no DOM. Positions are in tile units on a square grid; buildings have a footprint and a top-corner tile. Keep it that way so it stays testable and the art can change freely.
- The earlier tower-defence version (towers, enemies, waves, chibi art) is in git history at `d19260c`; the tower and character drawing code is still in `src/art/textures.ts`.
- `src/iso.ts` is the only place that knows the isometric projection (64×32 pixel tiles).
- `src/art/` draws every texture onto canvases at start-up. Each sprite has a foot point (`fx`, `fy`) that stands on the tile centre.
- Art direction: follow the owner's reference picture of a classic isometric pixel-art castle (see `PAL` in `src/art/pixels.ts`): flat saturated grass with small lit blades (no low-poly facets), layered earth cliffs on the island edge, round bushy trees and grey boulders with dark outlines, Buildings are not drawn in code: each is the owner's reference picture itself, cut out by `tools/cut_buildings.py` into `src/assets/<type>.png` (+ `.json` with the foot point and footprint width) and loaded by `src/art/buildings.ts`, shown smoothed at half its stored size. The source pictures are other people's artwork (one is a watermarked stock image), so they are placeholders: they must be licensed or replaced before the game is published. The originals are not in the repository. The owner wants references followed closely, with little reinterpretation. Characters (from the earlier version) are chibi with thick outlines. Keep it family-friendly.
- Trees and rocks are game state (`src/game/scenery.ts`): they block their tile, and the centre of the map is kept clear.
- `src/scenes/WorldScene.ts` renders the city and the placement ghost, and handles tap/drag/pinch/wheel.
- `src/ui/hud.ts` is the HTML title bar and tray; `src/session.ts` holds the city, the building picked in the build menu and the unconfirmed placement, shared by both.
- Press Start 2P drops the accents on Å and É at small sizes; keep those letters out of pixel-font text (Ø is fine).
- Depth sorting: `x + y` in tile units; ground and selection use fixed low layers, effects and text fixed high layers.
