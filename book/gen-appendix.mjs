import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'book', 'backmatter'), { recursive: true });

const html = readFileSync(join(ROOT, 'glossary.html'), 'utf8');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
function esc(s) {
  return s.replace(/\\/g, '\\textbackslash{}').replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
}

const items = [];
const re = /<div class="gl__i"><b>([\s\S]*?)<\/b><p>([\s\S]*?)<\/p><\/div>/g;
let m;
while ((m = re.exec(html))) {
  const bRaw = m[1];
  const spanM = bRaw.match(/<span>([\s\S]*?)<\/span>/);
  const en = spanM ? strip(spanM[1]) : '';
  const zh = strip(bRaw.replace(/<span>[\s\S]*?<\/span>/, ''));
  const pRaw = m[2];
  const chM = pRaw.match(/第\s*([0-9A-Za-z]+)\s*章/);
  const ch = chM ? chM[1] : '';
  const desc = strip(pRaw.replace(/<br>[\s\S]*$/, ''));
  if (zh) items.push({ zh, en, desc, ch });
}

const coll = new Intl.Collator('zh-Hans-u-co-pinyin');
items.sort((a, b) => coll.compare(a.zh, b.zh));

// 用参考字确定拼音首字母，给术语表分节
const ANCHOR = [['A','阿'],['B','八'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],['H','哈'],
  ['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],['P','趴'],['Q','七'],['R','然'],
  ['S','撒'],['T','塌'],['W','挖'],['X','夕'],['Y','压'],['Z','匝']];
function letterOf(zh) {
  let cur = 'A';
  for (const [L, a] of ANCHOR) if (coll.compare(zh, a) >= 0) cur = L;
  return cur;
}

let out = '\\chapter{术语表}\n\\markboth{术语表}{术语表}\n\n';
out += '\\begin{ledetext}\n本表收录正文中出现的核心术语，按汉语拼音排序。每条后面标注它在哪一章展开。' +
  '看到不认识的词回来查一眼，然后跳回正文，看它是怎么长出来的。\n\\end{ledetext}\n\n';
out += '\\begin{multicols}{2}\n';
let last = '';
for (const it of items) {
  const L = letterOf(it.zh);
  if (L !== last) { out += '\n\\glossletter{' + L + '}\n'; last = L; }
  out += '\\glossitem{' + esc(it.zh) + '}{' + esc(it.en) + '}{' + esc(it.desc) + '}{' + esc(it.ch) + '}\n';
}
out += '\\end{multicols}\n\\cleardoublepage\n';
writeFileSync(join(ROOT, 'book', 'backmatter', 'glossary.tex'), out, 'utf8');
console.log('术语表 ' + items.length + ' 条 -> book/backmatter/glossary.tex');
console.log('首字母分组: ' + [...new Set(items.map((i) => letterOf(i.zh)))].join(' '));
