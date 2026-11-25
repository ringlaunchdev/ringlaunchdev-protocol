import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
const dir = resolve(process.argv[2] || 'dist'), port = Number(process.argv[3] || 4173);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer((q, r) => {
  let p = join(dir, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(dir)) { r.writeHead(403); return r.end(); }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404); return r.end('not found'); }
  r.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p));
}).listen(port, () => console.log('serving', dir, 'on', port));
