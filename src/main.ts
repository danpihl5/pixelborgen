import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './style.css';
import Phaser from 'phaser';
import { loadBuildingArt } from './art/buildings';
import { WorldScene } from './scenes/WorldScene';
import { Session } from './session';
import { setupHud } from './ui/hud';

async function start(): Promise<void> {
  // Pixel text on the map needs the font before the first popup is drawn.
  await Promise.race([
    document.fonts.load('8px "Press Start 2P"'),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  const buildingArt = await loadBuildingArt();
  const session = new Session();
  setupHud(session);

  const host = document.getElementById('game')!;
  const phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#241a17',
    pixelArt: true,
    roundPixels: true,
    // Sized by hand below: Phaser's own RESIZE mode lags a step behind when the tray changes height.
    scale: { mode: Phaser.Scale.NONE, width: host.clientWidth, height: host.clientHeight },
    input: { activePointers: 2 },
    banner: false,
    scene: [new WorldScene(session, buildingArt)],
  });
  new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    phaser.scale.resize(Math.round(width), Math.round(height));
  }).observe(host);

  // Handy in the browser console while developing; left out of the app build.
  if (import.meta.env.DEV) Object.assign(window, { pixelborgen: { session, phaser } });
}

void start();
