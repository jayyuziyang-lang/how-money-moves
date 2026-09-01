import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = 'C:\\Users\\91615\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9361;
const PDF = process.argv[2] || join(ROOT, 'book', 'main.pdf');
const PAGES = (process.argv[3] || '1,2,3').split(',').map(Number);

function pngStats(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6)) return { w, h, unsupported: true };
  const bpp = ctype === 2 ? 3 : 4, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++]; const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  // 统计颜色分布
  const hist = new Map();
  const step = 2;
  let n = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = y * stride + x * bpp;
    const key = (out[i] >> 3) + ',' + (out[i + 1] >> 3) + ',' + (out[i + 2] >> 3);
    hist.set(key, (hist.get(key) || 0) + 1); n++;
  }
  let top = null, topN = 0;
  for (const [k, c] of hist) if (c > topN) { topN = c; top = k; }
  return { w, h, colors: hist.size, dominant: top, dominantPct: +(topN / n * 100).toFixed(1),
           nonDominantPct: +((1 - topN / n) * 100).toFixed(1) };
}

const profile = mkdtempSync(join(tmpdir(), 'pdfshot-'));
const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--allow-file-access-from-files', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=900,1250', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let v = null;
for (let i = 0; i < 80 && !v; i++) {
  try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) v = await r.json(); } catch (e) {}
  if (!v) await sleep(250);
}
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const waiting = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); } };
const send = (method, params, sid) => { const id = ++seq; const msg = { id, method, params: params || {} };
  if (sid) msg.sessionId = sid; ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => { waiting.set(id, { res, rej }); setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); rej(new Error('超时 ' + method)); } }, 90000); }); };
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1250, deviceScaleFactor: 1, mobile: false }, sessionId);

const base = 'file:///' + PDF.replace(/\\/g, '/');
for (const pg of PAGES) {
  await send('Page.navigate', { url: 'about:blank' }, sessionId);
  await sleep(500);
  await send('Page.navigate', { url: base + '?v=' + pg + '#page=' + pg + '&zoom=page-fit&toolbar=0&navpanes=0' }, sessionId);
  await sleep(3600);
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const b = Buffer.from(shot.data, 'base64');
  writeFileSync(join(ROOT, 'book', '_pg' + pg + '.png'), b);
  const st = pngStats(b);
  console.log('第 ' + pg + ' 页 · 主色 ' + st.dominant + ' 占 ' + st.dominantPct + '% · 非主色像素 ' +
    st.nonDominantPct + '% · 色彩数 ' + st.colors + '  =>  ' +
    (st.nonDominantPct < 4 ? '几乎空白' : st.colors > 900 ? '有大面积图像' : '有文字内容'));
}
ws.close(); child.kill(); process.exit(0);