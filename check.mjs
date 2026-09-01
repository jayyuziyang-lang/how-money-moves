import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const PAGES = ['index.html','level-1.html','level-2.html','level-3.html','level-4.html','glossary.html'];
let problems = 0;
const ids = {};
for (const p of PAGES) {
  const t = readFileSync(join(ROOT, p), 'utf8');
  ids[p] = new Set([...t.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
}
for (const p of PAGES) {
  const t = readFileSync(join(ROOT, p), 'utf8');
  const hrefs = [...t.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  for (const h of hrefs) {
    if (/^(https?:|data:|mailto:)/.test(h)) continue;
    let file = p, hash = '';
    if (h.startsWith('#')) hash = h.slice(1);
    else { const parts = h.split('#'); file = parts[0]; hash = parts[1] || ''; }
    if (file && !existsSync(join(ROOT, file))) { console.log('X ' + p + ' -> 文件不存在: ' + h); problems++; continue; }
    if (hash && ids[file] && !ids[file].has(hash)) { console.log('X ' + p + ' -> 锚点不存在: ' + h); problems++; }
  }
  const chapters = (t.match(/class="chapter"/g) || []).length;
  const stray = (t.match(/\$\{/g) || []).length;
  console.log('  ' + p.padEnd(15) + ' 章节 ' + String(chapters).padStart(2) + '  链接 ' + String(hrefs.length).padStart(3) + '  未替换模板 ' + stray);
  if (stray) problems++;
}
const expect = { 'level-1.html': ['ch-00','ch-01','ch-02','ch-03','ch-04','ch-05','ch-06'],
 'level-2.html': ['ch-07','ch-08','ch-09','ch-10','ch-11','ch-12'],
 'level-3.html': ['ch-13','ch-14','ch-15','ch-16','ch-17','ch-18'],
 'level-4.html': ['ch-19','ch-20','ch-21','ch-22','ch-23','ch-24','ch-25'] };
for (const [f, list] of Object.entries(expect)) {
  const t = readFileSync(join(ROOT, f), 'utf8');
  const miss = list.filter(id => !t.includes('id="' + id + '"'));
  const todo = t.includes('本章内容尚未生成');
  if (miss.length || todo) { console.log('X ' + f + ' 缺章: ' + miss.join(',') + (todo ? ' 且含占位符' : '')); problems++; }
}
console.log('');
console.log(problems ? ('发现 ' + problems + ' 个问题') : '全站链接与结构检查通过');