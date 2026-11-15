// Builds the whole game into one self-contained HTML file (dist-single/index.html):
// scripts, styles and fonts inlined. Handy for sharing a playable copy without a server.

import { build } from 'vite';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'dist-single-tmp';
await build({
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false },
});

const assets = join(outDir, 'assets');
const files = readdirSync(assets);
const js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8').replaceAll('</script', '<\\/script');
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');

const html = readFileSync(join(outDir, 'index.html'), 'utf8')
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, () => '')
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  .replace('</body>', () => `<script type="module">${js}</script>\n</body>`);

mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/index.html', html);
rmSync(outDir, { recursive: true, force: true });
console.log(`dist-single/index.html (${Math.round(html.length / 1024)} kB)`);
