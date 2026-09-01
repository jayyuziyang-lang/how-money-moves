import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = 'C:\\Users\\91615\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9345;
const W = 1200, H = 900, SCALE = 1.8;  // 2160×1620 ≈ 封面 16.6cm 宽下的 330dpi

// 用户自备的封面优先
for (const ext of ['png', 'jpg', 'jpeg']) {
  const user = join(ROOT, 'assets', 'cover-art.' + ext);
  if (existsSync(user)) {
    copyFileSync(user, join(ROOT, 'book', 'cover-art.' + ext));
    console.log('检测到自备封面 assets/cover-art.' + ext + '，已复制到 book/');
    process.exit(0);
  }
}

const profile = mkdtempSync(join(tmpdir(), 'cover-'));
const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=' + W + ',' + H, 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function version() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(250);
  }
  throw new Error('Chrome 未启动');
}
const v = await version();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const waiting = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
};
function send(method, params, sessionId) {
  const id = ++seq; const msg = { id, method, params: params || {} };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => { waiting.set(id, { res, rej }); setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); rej(new Error('超时 ' + method)); } }, 90000); });
}
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false }, sessionId);

const url = 'file:///' + join(ROOT, 'assets', 'cover-art.svg').replace(/\\/g, '/');
await send('Page.navigate', { url }, sessionId);
await sleep(1400);

const probe = await send('Runtime.evaluate', {
  expression: '(function(){var s=document.querySelector("svg");if(!s)return JSON.stringify({err:"no svg"});' +
    'var els=[].slice.call(s.querySelectorAll("g[transform], path, circle, rect, text"));' +
    'var drawn=els.filter(function(e){try{var b=e.getBBox();return b.width>0&&b.height>0}catch(x){return false}}).length;' +
    'var vb=s.getAttribute("viewBox");' +
    'return JSON.stringify({vb:vb,total:els.length,drawn:drawn,groups:s.querySelectorAll("g[transform]").length});})()',
  returnByValue: true,
}, sessionId);
console.log('SVG 校验: ' + probe.result.value);

const shot = await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false }, sessionId);
const buf = Buffer.from(shot.data, 'base64');
writeFileSync(join(ROOT, 'book', 'cover-art.png'), buf);
console.log('已渲染 book/cover-art.png  ' + Math.round(W * SCALE) + '×' + Math.round(H * SCALE) + '  ' + (buf.length / 1024).toFixed(0) + ' KB');

ws.close(); child.kill(); process.exit(0);