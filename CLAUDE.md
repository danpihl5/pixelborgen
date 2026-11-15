# Pixelborgen

Isometric pixel-art tower defence for phones. Phaser 3 + TypeScript + Vite, wrapped as an app with Capacitor. The owner speaks Danish: all player-facing text and the README are in Danish; code and comments are in English.

## Commands

- `npm run dev` – dev server (exposes `window.pixelborgen` with `session` and `phaser` for debugging)
- `npm test` – Vitest on the game rules
- `npm run build` – type-check and build to `dist/` (Capacitor's `webDir`)
- `npm run build:single` – one self-contained HTML file in `dist-single/`

## Architecture

- `src/game/` is the pure simulation: no Phaser, no DOM. Positions are in tile units on a square grid. It reports what happened through `Game.drainEvents()`. Keep it that way so it stays testable and the art can change freely.
- `src/iso.ts` is the only place that knows the isometric projection (32×16 tiles).
- `src/art/` draws every texture onto canvases at start-up. Each sprite has a foot point (`fx`, `fy`) that stands on the tile centre.
- `src/scenes/WorldScene.ts` renders the state, plays effects and sounds from events, and handles tap/drag/pinch/wheel.
- `src/ui/hud.ts` is the HTML HUD and tray; `src/session.ts` holds selection, speed, pause and the record, shared by both.
- Depth sorting: `x + y` in tile units; ground and selection use fixed low layers, effects and text fixed high layers.
