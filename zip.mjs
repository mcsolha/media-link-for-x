// Gera x-media-link.zip (dist + fonte) usando o zipfile do Python (o box não tem `zip`).
import { execFileSync } from 'node:child_process';
const files = ['dist','src','test','public','build.mjs','zip.mjs','package.json','package-lock.json','tsconfig.json','vitest.config.ts','README.md'];
execFileSync('python3', ['-c', `
import zipfile,os,sys
with zipfile.ZipFile('x-media-link.zip','w',zipfile.ZIP_DEFLATED) as z:
  for f in sys.argv[1:]:
    if os.path.isdir(f):
      for r,_,fs in os.walk(f):
        for n in fs: z.write(os.path.join(r,n),os.path.join('x-media-link',r,n))
    else: z.write(f,os.path.join('x-media-link',f))
`, ...files], { stdio: 'inherit' });
