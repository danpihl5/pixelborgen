import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './style.css';
import Phaser from 'phaser';
import { WorldScene } from './scenes/WorldScene';
import { Session } from './session';
import { setupHud } from './ui/hud';

async function start(): Promise<void> {
  // Pixel text on the map needs the font before the first popup is drawn.
  await Promise.race([
    document.fonts.load('8px "Press Start 2P"'),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  const session = new Session();
  setupHud(session);

  const phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a1c2c',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { activePointers: 2 },
    banner: false,
    scene: [new WorldScene(session)],
  });

  // Handy in the browser console while developing; left out of the app build.
  if (import.meta.env.DEV) Object.assign(window, { pixelborgen: { session, phaser } });
}

void start();
