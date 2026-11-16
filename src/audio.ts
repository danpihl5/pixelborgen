// Retro bleeps made with the Web Audio API, so the game ships without sound files.
// Browsers only allow audio after a tap, so call `unlock()` from a button handler.

import { storage } from './storage';

export type Sound = 'build';

let ac: AudioContext | null = null;
let muted = storage.get('mute') === '1';
const lastPlayed: Partial<Record<Sound, number>> = {};

export function unlock(): void {
  if (!ac) {
    try {
      ac = new AudioContext();
    } catch {
      return;
    }
  }
  if (ac.state === 'suspended') void ac.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  storage.set('mute', value ? '1' : '0');
}

function tone(f1: number, f2: number, dur: number, type: OscillatorType = 'square', vol = 0.04, delay = 0): void {
  if (muted || !ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f1, t0);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function play(sound: Sound): void {
  if (muted || !ac) return;
  // The same sound fired many times at once would stack into a buzz.
  const now = performance.now();
  if ((lastPlayed[sound] ?? -1e9) > now - 70) return;
  lastPlayed[sound] = now;
  switch (sound) {
    case 'build':
      [392, 523, 659, 784].forEach((f, i) => tone(f, 0, 0.1, 'square', 0.04, i * 0.09));
      break;
  }
}
