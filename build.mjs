// Build com esbuild: gera dist/ pronto para "Carregar sem compactação".
import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
await build({
  entryPoints: { content: 'src/content.ts', background: 'src/background.ts' },
  bundle: true, outdir: 'dist', format: 'iife', target: 'chrome110', logLevel: 'info',
});
cpSync('public', 'dist', { recursive: true });
