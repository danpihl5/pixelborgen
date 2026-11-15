import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the same build works in a browser, in a sub-folder and inside the Capacitor app.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
