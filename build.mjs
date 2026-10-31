// Build com esbuild: gera dist/ pronto para "Carregar sem compactação".
// A versão do manifest vem do package.json (fonte única de verdade).
import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
await build({
  entryPoints: { content: 'src/content.ts', background: 'src/background.ts' },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome110', // manter igual a minimum_chrome_version do manifest
  logLevel: 'info',
});
cpSync('public', 'dist', { recursive: true });
const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
manifest.version = pkg.version;
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
