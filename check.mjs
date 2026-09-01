import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const BOOKJS = readFileSync(join(ROOT, 'assets', 'book.js'), 'utf8');
const BOOK = JSON.parse(BOOKJS.replace(/^window\.BOOK=/, '').replace(/;\s*$/, ''));
const PAGES = ['index.html', 'glossary.html'].concat(
  BOOK.parts.map(function (p) { return p.file; }),
  BOOK.chapters.map(function (c) { return c.file; }));
let problems = 0;
const ids = {};
for (const p of PAGES) {
  if (!existsSync(join(ROOT, p))) { console.log('X 缺页面 ' + p); problems++; continue; }
  const t = readFileSync(join(ROOT, p), 'utf8');
  ids[p] = new Set([...t.matchAll(/id="([^"]+)"/g)].map(function (m) { return m[1]; }));
}
let links = 0;
for (const p of PAGES) {
  const t = readFileSync(join(ROOT, p), 'utf8');
  for (const m of t.matchAll(/href="([^"]+)"/g)) {
    const h = m[1];
    if (/^(https?:|data:|mailto:|#$)/.test(h)) continue;
    links++;
    let file = p, hash = '';
    if (h.startsWith('#')) hash = h.slice(1);
    else { const s = h.split('#'); file = decodeURIComponent(s[0].split('?')[0]); hash = s[1] || ''; }
    if (file && !existsSync(join(ROOT, file))) { console.log('X ' + p + ' -> 文件不存在 ' + h); problems++; continue; }
    if (hash && ids[file] && !ids[file].has(hash)) { console.log('X ' + p + ' -> 锚点不存在 ' + h); problems++; }
  }
  if (/\$\{/.test(t)) { console.log('X ' + p + ' 含未替换模板'); problems++; }
}
for (const c of BOOK.chapters) {
  const t = readFileSync(join(ROOT, c.file), 'utf8');
  if (!t.includes('id="' + c.id + '"')) { console.log('X ' + c.file + ' 缺正文 ' + c.id); problems++; }
  if (t.includes('本章内容尚未生成')) { console.log('X ' + c.file + ' 含占位符'); problems++; }
  if (!t.includes('assets/reader.js')) { console.log('X ' + c.file + ' 未加载阅读器'); problems++; }
}
const search = readFileSync(join(ROOT, 'assets', 'search.js'), 'utf8');
const sd = JSON.parse(search.replace(/^window\.SEARCH_DATA=/, '').replace(/;\s*$/, ''));
if (sd.length !== BOOK.chapters.length) { console.log('X 搜索索引 ' + sd.length + ' 与章节数 ' + BOOK.chapters.length + ' 不符'); problems++; }
console.log('');
console.log('页面 ' + PAGES.length + ' 个，内部链接 ' + links + ' 条，搜索索引 ' + sd.length + ' 章，全书 ' + BOOK.total.toLocaleString('en-US') + ' 字');
console.log(problems ? ('发现 ' + problems + ' 个问题') : '全站链接与结构检查通过');