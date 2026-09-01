import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- 纯 Node 解码 PNG，取边缘颜色 ---------- */
function pngEdgeColor(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; inter = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || inter !== 0 || (ctype !== 2 && ctype !== 6)) return { w, h, unsupported: true };
  const bpp = ctype === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  const px = (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]]; };
  const m = 3;
  const pts = [[m, m], [w - 1 - m, m], [m, h - 1 - m], [w - 1 - m, h - 1 - m],
               [w >> 1, m], [w >> 1, h - 1 - m], [m, h >> 1], [w - 1 - m, h >> 1]];
  const cols = pts.map((q) => px(q[0], q[1]));
  const avg = [0, 1, 2].map((i) => Math.round(cols.reduce((s, c) => s + c[i], 0) / cols.length));
  const spread = Math.max(...cols.map((c) => Math.abs(c[0] - avg[0]) + Math.abs(c[1] - avg[1]) + Math.abs(c[2] - avg[2])));
  return { w, h, avg, spread, corners: cols.slice(0, 4) };
}

/* ---------- 找封面源 ---------- */
let srcName = null;
for (const f of ['cover-art.png', 'cover-art.jpg', 'cover-art.jpeg', 'cover-art.svg']) {
  if (existsSync(join(ROOT, 'assets', f))) { srcName = f; break; }
}
if (!srcName) { console.log('未找到封面源'); process.exit(1); }
const srcPath = join(ROOT, 'assets', srcName);
const dest = join(ROOT, 'book', 'cover-art.png');

if (srcName.endsWith('.svg')) {
  // 矢量：用无头 Chrome 渲染成 300dpi 位图
  const CHROME = 'C:\\Users\\91615\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  const PORT = 9349, W = 1200, H = 900, SCALE = 1.8;
  const profile = mkdtempSync(join(tmpdir(), 'cover-'));
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, '--window-size=' + W + ',' + H, 'about:blank'], { stdio: 'ignore' });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let v = null;
  for (let i = 0; i < 60 && !v; i++) {
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
    return new Promise((res, rej) => { waiting.set(id, { res, rej }); setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); rej(new Error('超时')); } }, 90000); }); };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false }, sessionId);
  await send('Page.navigate', { url: 'file:///' + srcPath.replace(/\\/g, '/') }, sessionId);
  await sleep(1400);
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(dest, Buffer.from(shot.data, 'base64'));
  ws.close(); child.kill();
  console.log('矢量封面渲染为 ' + Math.round(W * SCALE) + '×' + Math.round(H * SCALE) + ' 位图');
} else {
  copyFileSync(srcPath, dest);
  console.log('自备封面 ' + srcName + ' -> book/cover-art.png  ' + (statSync(srcPath).size / 1048576).toFixed(2) + ' MB');
}

const info = pngEdgeColor(dest);
let hex = 'F6F2E9';
if (info && info.avg) {
  hex = info.avg.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  console.log('尺寸 ' + info.w + '×' + info.h + ' · 宽高比 ' + (info.w / info.h).toFixed(3) +
    ' · 边缘平均色 #' + hex + ' · 边缘色差 ' + info.spread +
    (info.spread > 90 ? '（边缘不统一，改用中性纸色）' : ''));
  if (info.spread > 90) hex = 'F6F2E9';
} else if (info) {
  console.log('尺寸 ' + info.w + '×' + info.h + '（PNG 格式不支持取样，使用默认纸色）');
}
writeFileSync(join(ROOT, 'book', 'cover-bg.tex'), '\\definecolor{coverbg}{HTML}{' + hex + '}\n', 'utf8');
console.log('出血底色 #' + hex + ' -> book/cover-bg.tex');

/* ---------- 生成网页用轻量封面 ---------- */
if (info && info.w && info.w > 900) {
  const CHROME = 'C:\\Users\\91615\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  const PORT = 9351;
  const OW = 760, OH = Math.round(760 * info.h / info.w);
  const profile = mkdtempSync(join(tmpdir(), 'coverweb-'));
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--allow-file-access-from-files', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile, '--window-size=' + OW + ',' + OH, 'about:blank'], { stdio: 'ignore' });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let v = null;
  for (let i = 0; i < 60 && !v; i++) {
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
    return new Promise((res, rej) => { waiting.set(id, { res, rej }); setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); rej(new Error('超时')); } }, 90000); }); };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: OW, height: OH, deviceScaleFactor: 1, mobile: false }, sessionId);
  const html = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#' + hex +
    '}img{display:block;width:' + OW + 'px;height:' + OH + 'px;object-fit:cover}</style><img src="' +
    ('file:///' + dest.replace(/\\/g, '/')) + '">';
  const page = join(ROOT, 'book', '_coverweb.html');
  writeFileSync(page, html, 'utf8');
  await send('Page.navigate', { url: 'file:///' + page.replace(/\\/g, '/') }, sessionId);
  await sleep(1500);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86 }, sessionId);
  const jb = Buffer.from(shot.data, 'base64');
  writeFileSync(join(ROOT, 'assets', 'cover-web.jpg'), jb);
  console.log('网页封面 assets/cover-web.jpg  ' + OW + '×' + OH + '  ' + (jb.length / 1024).toFixed(0) + ' KB');
  ws.close(); child.kill();
}
process.exit(0);