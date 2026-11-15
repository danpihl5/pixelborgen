// Retro bleeps made with the Web Audio API, so the game ships without sound files.
// Browsers only allow audio after a tap, so call `unlock()` from a button handler.

import { storage } from './storage';

export type Sound =
  | 'bue' | 'kanon' | 'frost' | 'pop' | 'hurt' | 'build' | 'sell' | 'wave' | 'clear' | 'over';

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
  // Many towers firing at once would otherwise stack into a buzz.
  const now = performance.now();
  if ((lastPlayed[sound] ?? -1e9) > now - 70) return;
  lastPlayed[sound] = now;
  switch (sound) {
    case 'bue': tone(900, 500, 0.05, 'square', 0.015); break;
    case 'kanon': tone(180, 50, 0.18, 'sawtooth', 0.045); break;
    case 'frost': tone(1400, 900, 0.08, 'triangle', 0.035); break;
    case 'pop': tone(500, 90, 0.1, 'square', 0.025); break;
    case 'hurt': tone(220, 70, 0.3, 'sawtooth', 0.06); break;
    case 'build': tone(523, 0, 0.07, 'square', 0.04); tone(784, 0, 0.09, 'square', 0.04, 0.07); break;
    case 'sell': tone(784, 392, 0.14, 'square', 0.04); break;
    case 'wave': [392, 523, 659].forEach((f, i) => tone(f, 0, 0.1, 'square', 0.04, i * 0.1)); break;
    case 'clear': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0, 0.1, 'square', 0.04, i * 0.09)); break;
    case 'over': [392, 330, 262, 196].forEach((f, i) => tone(f, 0, 0.22, 'triangle', 0.07, i * 0.2)); break;
  }
}
