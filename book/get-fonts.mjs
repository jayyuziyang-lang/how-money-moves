import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const OUT = 'D:\\Desktop\\财经科普\\book\\fonts';
mkdirSync(OUT, { recursive: true });

const FILES = [
  ['Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf',  'NotoSerifSC-Regular.otf'],
  ['Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf',     'NotoSerifSC-Bold.otf'],
  ['Serif/SubsetOTF/SC/NotoSerifSC-SemiBold.otf', 'NotoSerifSC-SemiBold.otf'],
  ['Serif/SubsetOTF/SC/NotoSerifSC-Light.otf',    'NotoSerifSC-Light.otf'],
  ['Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',    'NotoSansSC-Regular.otf'],
  ['Sans/SubsetOTF/SC/NotoSansSC-Bold.otf',       'NotoSansSC-Bold.otf'],
  ['Sans/SubsetOTF/SC/NotoSansSC-Medium.otf',     'NotoSansSC-Medium.otf'],
  ['Sans/SubsetOTF/SC/NotoSansSC-Light.otf',      'NotoSansSC-Light.otf'],
];
const MIRRORS = [
  (p) => 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/' + p,
  (p) => 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/' + p,
  (p) => 'https://fastly.jsdelivr.net/gh/notofonts/noto-cjk@main/' + p,
];

for (const [path, name] of FILES) {
  const dest = join(OUT, name);
  if (existsSync(dest) && statSync(dest).size > 2000000) { console.log('SKIP ' + name); continue; }
  let done = false;
  for (const mk of MIRRORS) {
    const url = mk(path);
    try {
      const ctl = AbortSignal.timeout(180000);
      const r = await fetch(url, { signal: ctl, headers: { 'User-Agent': 'node' } });
      if (!r.ok) { console.log('  ' + r.status + ' ' + url); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 500000) { console.log('  too small ' + buf.length); continue; }
      writeFileSync(dest, buf);
      console.log('OK   ' + name + '  ' + (buf.length / 1048576).toFixed(1) + 'MB');
      done = true; break;
    } catch (e) { console.log('  fail ' + (e.message || e)); }
  }
  if (!done) console.log('FAIL ' + name);
}
console.log('DONE');
