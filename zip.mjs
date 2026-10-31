// Gera os dois artefatos (usa o zipfile do Python, porque o box não tem `zip`):
//  - media-link-for-x-store.zip: CONTEÚDO de dist/ na raiz (manifest.json na raiz),
//    que é o formato exigido pela Chrome Web Store;
//  - media-link-for-x-src.zip: código-fonte, sem node_modules, dist nem zips.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('dist/manifest.json')) throw new Error('Rode `npm run build` antes.');
const py = `
import zipfile, os, sys, fnmatch
mode, out, root = sys.argv[1], sys.argv[2], sys.argv[3]
skip_dirs = {'node_modules', 'dist', '.git', 'coverage'}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
  for r, dirs, fs in os.walk(root):
    dirs[:] = sorted(d for d in dirs if mode == 'store' or d not in skip_dirs)
    for n in sorted(fs):
      if mode == 'src' and (n.endswith('.zip') or n == '.DS_Store'): continue
      p = os.path.join(r, n)
      arc = os.path.relpath(p, root)
      z.write(p, arc if mode == 'store' else os.path.join('media-link-for-x', arc))
`;
execFileSync('python3', ['-c', py, 'store', 'media-link-for-x-store.zip', 'dist'], { stdio: 'inherit' });
execFileSync('python3', ['-c', py, 'src', 'media-link-for-x-src.zip', '.'], { stdio: 'inherit' });
console.log('ok: media-link-for-x-store.zip, media-link-for-x-src.zip');
