import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
const f = 'D:\\Desktop\\财经科普\\book\\main.pdf';
const buf = readFileSync(f);
console.log('本地 PDF 字节: ' + buf.length);
const s = buf.toString('latin1');

// 收集所有对象
const objs = new Map();
const re = /(\d+)\s+0\s+obj\b/g;
let m;
while ((m = re.exec(s))) objs.set(+m[1], m.index + m[0].length);
console.log('对象数: ' + objs.size);

function bodyOf(n) {
  const st = objs.get(n);
  if (st === undefined) return '';
  const en = s.indexOf('endobj', st);
  return s.slice(st, en < 0 ? st + 4000 : en);
}
// 找 Pages 树
let pagesNum = null;
for (const [n] of objs) {
  const b = bodyOf(n);
  if (/\/Type\s*\/Pages\b/.test(b) && /\/Kids/.test(b) && !/\/Parent/.test(b)) { pagesNum = n; break; }
}
console.log('Pages 根对象: ' + pagesNum);
if (pagesNum) {
  const b = bodyOf(pagesNum);
  const kids = (b.match(/\/Kids\s*\[([\s\S]*?)\]/) || [])[1] || '';
  const ids = [...kids.matchAll(/(\d+)\s+0\s+R/g)].map((x) => +x[1]);
  console.log('第一层 Kids 数: ' + ids.length);
  // 逐层展开取前 3 页
  const pages = [];
  (function walk(list, depth) {
    for (const id of list) {
      if (pages.length >= 3) return;
      const bb = bodyOf(id);
      if (/\/Type\s*\/Pages\b/.test(bb)) {
        const kk = (bb.match(/\/Kids\s*\[([\s\S]*?)\]/) || [])[1] || '';
        walk([...kk.matchAll(/(\d+)\s+0\s+R/g)].map((x) => +x[1]), depth + 1);
      } else if (/\/Type\s*\/Page\b/.test(bb)) pages.push(id);
    }
  })(ids, 0);
  pages.forEach((pid, i) => {
    const pb = bodyOf(pid);
    const hasXObj = /\/XObject/.test(pb);
    const contents = (pb.match(/\/Contents\s+(\d+)\s+0\s+R/) || [])[1];
    let clen = 0, ops = '';
    if (contents) {
      const cs = objs.get(+contents);
      const seg = s.slice(cs, s.indexOf('endobj', cs));
      const lm = seg.match(/\/Length\s+(\d+)/);
      clen = lm ? +lm[1] : 0;
      const sp = seg.indexOf('stream');
      if (sp >= 0) {
        let raw = Buffer.from(seg.slice(sp + 6).replace(/^\r?\n/, ''), 'latin1');
        raw = raw.subarray(0, clen);
        try { ops = inflateSync(raw).toString('latin1'); } catch (e) { ops = raw.toString('latin1'); }
      }
    }
    const doCount = (ops.match(/\/\S+\s+Do\b/g) || []).length;
    const textOps = (ops.match(/\bTj\b|\bTJ\b/g) || []).length;
    console.log('第 ' + (i + 1) + ' 页  obj ' + pid + ' · 内容流 ' + clen + ' 字节 · XObject资源:' + (hasXObj ? '有' : '无') +
      ' · 图像绘制(Do):' + doCount + ' · 文本绘制:' + textOps + (ops.length ? ' · 前80op:' + ops.slice(0, 80).replace(/\s+/g, ' ') : ''));
  });
}
