// Yerel sunucu: node tools/serve.mjs → http://localhost:8080
// index.html yayın sırasında bir belge iskeletine sarılır; yerelde iskeleti burada ekliyoruz.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };
const port = +process.env.PORT || 8080;

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
  try {
    let body = await readFile(join(root, rel));
    if (rel === '/index.html') body = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head><body style="margin:0">${body}</body></html>`;
    res.writeHead(200, { 'content-type': types[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('yok');
  }
}).listen(port, () => console.log(`X Project: http://localhost:${port}`));
