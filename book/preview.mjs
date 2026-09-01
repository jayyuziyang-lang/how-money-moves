import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const ROOT = 'D:\\Desktop\\财经科普';
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.pdf':'application/pdf' };
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = join(ROOT, normalize(p).replace(/^([\\/])+/, ''));
    const st = await stat(f);
    if (!st.isFile()) throw new Error('nf');
    const buf = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('404'); }
}).listen(8795, '127.0.0.1', () => console.log('preview on http://127.0.0.1:8795/'));
