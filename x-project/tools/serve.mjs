// npm start → bağımlılıklar dahil derle, yalnız oyun çıktısını sun.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { buildGame } from './build.mjs';

const root = await mkdtemp(join(tmpdir(), 'x-project-'));
await buildGame(root, { minify: false });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.map': 'application/json', '.txt': 'text/plain' };
const port = +process.env.PORT || 8080;

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname), file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end('erişim yok'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('yok');
  }
});
server.listen(port, '0.0.0.0', () => console.log(`X Project (Phaser): http://localhost:${port}\nKaynak değişince sunucuyu yeniden başlat.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(async () => { await rm(root, { recursive: true, force: true }); process.exit(0); }); });
