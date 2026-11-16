# Pixelborgen

Isometric pixel-art city builder with tower-defence elements, for phones. Early stage: a 30 × 30 grass map where the player places a 2 × 2 castle. Phaser 3 + TypeScript + Vite, wrapped as an app with Capacitor. The owner speaks Danish: all player-facing text and the README are in Danish; code and comments are in English.

## Commands

- `npm run dev` – dev server (exposes `window.pixelborgen` with `session` and `phaser` for debugging)
- `npm test` – Vitest on the game rules
- `npm run build` – type-check and build to `dist/` (Capacitor's `webDir`)
- `npm run build:single` – one self-contained HTML file in `dist-single/`

## Architecture

- `src/game/city.ts` is the pure model: no Phaser, no DOM. Positions are in tile units on a square grid; buildings have a footprint and a top-corner tile. Keep it that way so it stays testable and the art can change freely.
- The earlier tower-defence version (towers, enemies, waves, chibi art) is in git history at `d19260c`; the tower and character drawing code is still in `src/art/textures.ts`.
- `src/iso.ts` is the only place that knows the isometric projection (32×16 tiles).
- `src/art/` draws every texture onto canvases at start-up. Each sprite has a foot point (`fx`, `fy`) that stands on the tile centre.
- Art direction: follow the owner's reference picture of a classic isometric pixel-art castle (see `PAL` in `src/art/pixels.ts`): flat saturated grass with small lit blades (no low-poly facets), layered earth cliffs on the island edge, round bushy trees and grey boulders with dark outlines, mauve-grey castle stone, bright red cone roofs with pennants, a moat with a cobbled rim and a wooden bridge. Characters (from the earlier version) are chibi with thick outlines. Keep it family-friendly.
- Trees and rocks are game state (`src/game/scenery.ts`): they block their tile, and the centre of the map is kept clear.
- `src/scenes/WorldScene.ts` renders the city and the placement ghost, and handles tap/drag/pinch/wheel.
- `src/ui/hud.ts` is the HTML title bar and tray; `src/session.ts` holds the city and the unconfirmed placement, shared by both.
- Press Start 2P drops the accents on Å and É at small sizes; keep those letters out of pixel-font text (Ø is fine).
- Depth sorting: `x + y` in tile units; ground and selection use fixed low layers, effects and text fixed high layers.
