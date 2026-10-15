import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function buildGame(outdir, { minify = true } = {}) {
  await mkdir(outdir, { recursive: true });
  await build({ entryPoints: [join(root, 'src/main.js')], outfile: join(outdir, 'app.js'), bundle: true, format: 'esm', platform: 'browser',
    target: ['es2020'], minify, sourcemap: !minify, legalComments: 'linked', logLevel: 'info' });
  await copyFile(join(root, 'index.html'), join(outdir, 'index.html'));
  await copyFile(join(root, 'interface.css'), join(outdir, 'interface.css'));
  await cp(join(root,'assets'),join(outdir,'assets'),{recursive:true});
  return outdir;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildGame(join(root, 'dist'));
