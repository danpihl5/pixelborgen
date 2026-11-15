// localStorage can be missing or throw (private browsing, blocked storage), so every access
// is guarded. Works the same inside the Capacitor app.

const PREFIX = 'pixelborgen-';

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      // Not saved; the game works without it.
    }
  },
};
