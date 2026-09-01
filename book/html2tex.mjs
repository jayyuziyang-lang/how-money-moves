/* ============================================================================
   html2tex.mjs —— 把章节 HTML 片段转成 ElegantBook 可用的 LaTeX
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'book', 'chapters');
mkdirSync(OUT, { recursive: true });

/* ---------- 书目顺序（与 build.mjs 一致） ---------- */
export const PARTS = [
  { name: '地基篇', tag: '钱到底是什么', en: 'FOUNDATIONS',
    ids: ['ch-00','ch-01','ch-02','ch-03','ch-04','ch-05','ch-06'] },
  { name: '管道篇', tag: '这台机器怎么转', en: 'THE PLUMBING',
    ids: ['ch-07','ch-08','ch-09','ch-10','ch-11','ch-12'] },
  { name: '天气篇', tag: '潮汐、风暴与泡沫', en: 'RISK & CYCLES',
    ids: ['ch-13','ch-14','ch-15','ch-16','ch-17','ch-18'] },
  { name: '落地篇', tag: '你在其中怎么活', en: 'YOUR MOVE',
    ids: ['ch-19','ch-20','ch-21','ch-22','ch-23','ch-24','ch-25'] },
  { name: '后记', tag: '合上书之后', en: 'AFTERWORD',
    ids: ['ep-1','ep-2','ep-3'] },
];

/* ---------- 极简 HTML 解析 ---------- */
const VOID = new Set(['br','hr','img','meta','link','input']);
function parse(html) {
  const root = { tag: '#root', cls: [], attrs: {}, kids: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s[^>]*?)?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    const top = stack[stack.length - 1];
    if (m[1]) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === m[1].toLowerCase()) { stack.length = i; break; }
      }
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const attrs = {};
      const ar = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
      let a;
      while ((a = ar.exec(m[3] || ''))) attrs[a[1]] = a[2];
      const node = { tag, cls: (attrs.class || '').split(/\s+/).filter(Boolean), attrs, kids: [] };
      top.kids.push(node);
      if (!VOID.has(tag) && !m[4]) stack.push(node);
    } else if (m[5] != null) {
      top.kids.push({ tag: '#text', text: m[5] });
    }
  }
  return root;
}
const has = (n, c) => n.cls && n.cls.indexOf(c) >= 0;
function find(n, cls) {
  if (has(n, cls)) return n;
  for (const k of n.kids || []) { const r = find(k, cls); if (r) return r; }
  return null;
}
function findAll(n, cls, out) {
  out = out || [];
  if (has(n, cls)) out.push(n);
  for (const k of n.kids || []) findAll(k, cls, out);
  return out;
}
function kidsByTag(n, tag) { return (n.kids || []).filter((k) => k.tag === tag); }

/* ---------- 文本与转义 ---------- */
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&nbsp;': '\u00A0', '&#39;': "'" };
function decode(s) { return s.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENT[m]); }
function esc(s) {
  return decode(s)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\u00A0/g, '~');
}
function plain(n) {
  if (n.tag === '#text') return decode(n.text);
  return (n.kids || []).map(plain).join('');
}
function clean(s) { return s.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/\s{2,}/g, ' ').trim(); }

/* ---------- 行内渲染 ---------- */
const terms = new Set();
const INDEXKEY = new Map();
let inBox = 0;
function inline(n) {
  if (n.tag === '#text') return esc(n.text).replace(/[ \t]*\n[ \t]*/g, ' ');
  const inner = () => (n.kids || []).map(inline).join('');
  switch (n.tag) {
    case 'strong': case 'b': return '\\textbf{' + inner() + '}';
    case 'em': case 'i': return '\\emph{' + inner() + '}';
    case 'mark': return '\\hlmark{' + inner() + '}';
    case 'sup': return '\\textsuperscript{' + inner() + '}';
    case 'br': return '\\\\' + '\n';
    case 'u': return '\\underline{' + inner() + '}';
    case 'cite': return inner();
    case 'span': {
      if (has(n, 'term')) {
        const tt = find(n, 'tt');
        const zh = clean((n.kids || []).filter((k) => !(k.tag === 'span' && has(k, 'tt'))).map(plain).join(''));
        const en = tt ? clean(plain(tt)) : '';
        if (zh) terms.add(zh + '\u0001' + en);
        if (!zh) return en ? '\\enterm{' + esc(en) + '}' : '';
        const key = INDEXKEY.get(zh);
        return '\\term{' + esc(zh) + '}{' + esc(en) + '}' + (key ? '\\index{' + key + '@' + zh + '}' : '');
      }
      if (has(n, 'hl-warm')) return '\\hlwarm{' + inner() + '}';
      if (has(n, 'kicker')) return '\\kicker{' + inner() + '}';
      return inner();
    }
    case 'a': return inner();
    default: return inner();
  }
}
const inlineKids = (n) => clean((n.kids || []).map(inline).join(''));

/* ---------- 块渲染 ---------- */
function boxTitle(n) {
  const t = find(n, 'box__t');
  return t ? clean(plain(t)) : '';
}
function bodyOf(n, skipCls) {
  inBox++;
  const r = (n.kids || [])
    .filter((k) => !(k.tag === 'div' && skipCls.some((c) => has(k, c))))
    .map(block).join('');
  inBox--;
  return r;
}

function block(n) {
  if (n.tag === '#text') { const t = clean(n.text); return t ? esc(t) + '\n\n' : ''; }

  /* 标题 */
  if (n.tag === 'h3') return '\n\\section{' + inlineKids(n) + '}\n\n';
  if (n.tag === 'h4') return '\n\\subsection{' + inlineKids(n) + '}\n\n';
  if (n.tag === 'h5') return '\n\\paragraph{' + inlineKids(n) + '}\n';

  /* 段落 */
  if (n.tag === 'p') {
    if (has(n, 'bridge')) return '\n\\begin{bridgebox}\n' + inlineKids(n) + '\n\\end{bridgebox}\n\n';
    if (has(n, 'lede') || has(n, 'ch-lede')) return '\n\\begin{ledetext}\n' + inlineKids(n) + '\n\\end{ledetext}\n\n';
    const t = inlineKids(n);
    return t ? t + '\n\n' : '';
  }

  /* 列表 */
  if (n.tag === 'ul' || n.tag === 'ol') {
    const env = n.tag === 'ul' ? 'itemize' : 'enumerate';
    const items = kidsByTag(n, 'li').map((li) => '  \\item ' + inlineKids(li)).join('\n');
    return '\n\\begin{' + env + '}\n' + items + '\n\\end{' + env + '}\n\n';
  }

  if (n.tag === 'table') return table(n);

  if (n.tag !== 'div' && n.tag !== 'section' && n.tag !== 'nav') {
    return (n.kids || []).map(block).join('');
  }

  /* 各类容器 */
  if (has(n, 'pull')) {
    const c = find(n, 'cite');
    const body = clean((n.kids || []).filter((k) => k.tag !== 'cite').map(inline).join(''));
    const src = c ? clean(plain(c)) : '';
    return '\n\\begin{pullquote}{' + esc(src) + '}\n' + body + '\n\\end{pullquote}\n\n';
  }

  if (has(n, 'takeaway')) {
    return '\n\\begin{takeaway}{' + esc(boxTitle(n) || '本章一句话') + '}\n' +
      bodyOf(n, ['box__t']) + '\\end{takeaway}\n\n';
  }

  if (has(n, 'box')) {
    let env = 'notebox';
    if (has(n, 'box--eg')) env = 'egbox';
    else if (has(n, 'box--myth')) env = 'mythbox';
    else if (has(n, 'box--data')) env = 'databox';
    else if (has(n, 'box--warn')) env = 'warnbox';
    else if (has(n, 'box--deep')) env = 'deepbox';
    return '\n\\begin{' + env + '}{' + esc(boxTitle(n)) + '}\n' + bodyOf(n, ['box__t']) + '\\end{' + env + '}\n\n';
  }

  if (has(n, 'mvf')) {
    return findAll(n, 'mvf__row').map((r) => {
      const tag = find(r, 'mvf__tag');
      const label = tag ? clean(plain(tag)) : '';
      const body = clean((r.kids || []).filter((k) => !has(k, 'mvf__tag')).map(inline).join(''));
      return '\\mvfrow{' + esc(label) + '}{' + body + '}\n';
    }).join('');
  }

  if (has(n, 'stats')) {
    const items = findAll(n, 'stat').map((s) => {
      const b = kidsByTag(s, 'b')[0];
      const unit = b ? kidsByTag(b, 'i')[0] : null;
      const num = b ? clean((b.kids || []).filter((k) => k.tag !== 'i').map(plain).join('')) : '';
      const lab = kidsByTag(s, 'span').map(plain).join('');
      return '  \\statitem{' + esc(num) + '}{' + esc(unit ? clean(plain(unit)) : '') + '}{' + esc(clean(lab)) + '}';
    }).join('\n');
    return '\n\\begin{statrow}{' + findAll(n, 'stat').length + '}\n' + items + '\n\\end{statrow}\n\n';
  }

  if (has(n, 'flow')) {
    const items = findAll(n, 'flow__n').map((f) => {
      const i = kidsByTag(f, 'i')[0];
      const d = kidsByTag(f, 'div')[0] || f;
      const b = d ? kidsByTag(d, 'b')[0] : null;
      const head = b ? inlineKids(b) : '';
      const rest = clean((d.kids || []).filter((k) => k.tag !== 'b').map(inline).join(''));
      return '  \\flowitem{' + esc(i ? clean(plain(i)) : '') + '}{' + head + '}{' + rest + '}';
    }).join('\n');
    return '\n\\begin{flowlist}\n' + items + '\n\\end{flowlist}\n\n';
  }

  if (has(n, 'chain')) {
    const seq = (n.kids || []).filter((k) => k.tag === 'span' || k.tag === 'b')
      .map((k) => (k.tag === 'b' ? null : esc(clean(plain(k))))).filter(Boolean);
    const nodes = seq.map((s) => '\\chainnode{' + s + '}').join('\\chainarrow ');
    return '\n\\begin{chainflow}\n' + nodes + '\n\\end{chainflow}\n\n';
  }

  if (has(n, 'tbl')) {
    const t = (function findT(x) {
      if (x.tag === 'table') return x;
      for (const k of x.kids || []) { const r = findT(k); if (r) return r; }
      return null;
    })(n);
    return t ? table(t) : '';
  }

  if (has(n, 'bs')) {
    const sides = findAll(n, 'bs__side').map((s) => {
      const h = kidsByTag(s, 'h5')[0];
      const ul = kidsByTag(s, 'ul')[0];
      const rows = ul ? kidsByTag(ul, 'li').map((li) => {
        const b = kidsByTag(li, 'b')[0];
        const label = clean((li.kids || []).filter((k) => k.tag !== 'b').map(inline).join(''));
        const val = b ? esc(clean(plain(b))) : '';
        return '    \\bsrow' + (has(li, 'tot') ? 'total' : '') + '{' + label + '}{' + val + '}';
      }).join('\n') : '';
      return '  \\bsside{' + esc(h ? clean(plain(h)) : '') + '}{%\n' + rows + '\n  }';
    });
    return '\n\\begin{bsheet}\n' + sides.join('\n') + '\n\\end{bsheet}\n\n';
  }

  if (has(n, 'talk')) {
    const rows = kidsByTag(n, 'p').map((p) => {
      const b = kidsByTag(p, 'b')[0];
      const rest = clean((p.kids || []).filter((k) => k.tag !== 'b').map(inline).join(''));
      return '  \\talkline{' + esc(b ? clean(plain(b)) : '') + '}{' + rest + '}';
    }).join('\n');
    return '\n\\begin{talkbox}\n' + rows + '\n\\end{talkbox}\n\n';
  }

  if (has(n, 'barfig')) {
    const rows = findAll(n, 'barfig__r').map((r) => {
      const spans = kidsByTag(r, 'span');
      const label = spans[0] ? clean(plain(spans[0])) : '';
      const tr = spans.find((s) => has(s, 'barfig__t'));
      const bar = tr ? kidsByTag(tr, 'i')[0] : null;
      const w = bar ? String(Math.round(parseFloat(((bar.attrs.style || '').match(/width:\s*([\d.]+)%/) || [0, '0'])[1]))) : '0';
      const val = spans[spans.length - 1] ? clean(plain(spans[spans.length - 1])) : '';
      return '  \\barrow{' + esc(label) + '}{' + w + '}{' + esc(val) + '}';
    }).join('\n');
    return '\n\\begin{barfig}\n' + rows + '\n\\end{barfig}\n\n';
  }

  if (has(n, 'sep')) return '\n\\bookbreak\n\n';
  if (has(n, 'ch-head') || has(n, 'chnav') || has(n, 'page__meta')) return '';

  return (n.kids || []).map(block).join('');
}

/* ---------- 表格 ---------- */
function table(t) {
  const thead = (t.kids || []).find((k) => k.tag === 'thead');
  const tbody = (t.kids || []).find((k) => k.tag === 'tbody') || t;
  const headRow = thead ? kidsByTag(thead, 'tr')[0] : null;
  const heads = headRow ? kidsByTag(headRow, 'th') : [];
  const rows = kidsByTag(tbody, 'tr').map((tr) => kidsByTag(tr, 'td'));
  const ncol = Math.max(heads.length, ...rows.map((r) => r.length), 1);

  const numCol = [];
  for (let c = 0; c < ncol; c++) {
    numCol.push((heads[c] && has(heads[c], 'n')) || rows.some((r) => r[c] && has(r[c], 'n')));
  }
  const cols = [];
  for (let c = 0; c < ncol; c++) {
    if (numCol[c]) cols.push('r');
    else if (c === 0 && ncol > 2) cols.push('>{\\raggedright\\arraybackslash}p{0.20\\linewidth}');
    else cols.push('X');
  }
  if (cols.indexOf('X') < 0) {
    const k = cols.findIndex((x) => x !== 'r');
    cols[k >= 0 ? k : 0] = 'X';
  }
  const spec = cols.join('');
  const env = inBox ? 'tabularx' : 'xltabular';
  const wrap = inBox ? 'tablewrapin' : 'tablewrap';
  let out = '\n\\begin{' + wrap + '}\n\\begin{' + env + '}{\\linewidth}{' + spec + '}\n';
  if (heads.length) out += '\\toprule\n' + heads.map((h) => '\\bthead{' + inlineKids(h) + '}').join(' & ') + ' \\\\\n\\midrule\n';
  else out += '\\toprule\n';
  out += rows.map((r) => {
    const cells = [];
    for (let c = 0; c < ncol; c++) cells.push(r[c] ? inlineKids(r[c]) : '');
    if (r[0]) cells[0] = '\\textbf{' + cells[0] + '}';
    return cells.join(' & ');
  }).join(' \\\\\n') + ' \\\\\n\\bottomrule\n\\end{' + env + '}\n\\end{' + wrap + '}\n\n';
  return out;
}

/* ---------- 单章转换 ---------- */
export function convert(id, dry) {
  const raw = readFileSync(join(ROOT, 'content', id + '.html'), 'utf8');
  const doc = parse(raw);
  const sec = find(doc, 'chapter');
  const head = find(sec, 'ch-head');
  const title = clean(plain(find(head, 'ch-title')));
  const numEl = find(head, 'ch-num');
  const num = numEl ? clean(plain(numEl)) : '';
  const ledeEl = find(head, 'ch-lede');
  const lede = ledeEl ? inlineKids(ledeEl) : '';
  const body = find(sec, 'ch-body');
  let tex = '\\chapter{' + esc(title) + '}\n\\chaptermeta{' + esc(num) + '}\n\n';
  if (lede) tex += '\\begin{ledetext}\n' + lede + '\n\\end{ledetext}\n\n';
  tex += (body.kids || []).map(block).join('');
  tex = tex.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
  if (!dry) writeFileSync(join(OUT, id + '.tex'), tex, 'utf8');
  return { id, num, title, bytes: tex.length };
}

// 第一遍：收集术语
for (const p of PARTS) for (const id of p.ids) convert(id, true);
// 按拼音排序，生成索引排序键（makeindex 用 key@显示 的形式）
const zhList = [...new Set([...terms].map((t) => t.split('\u0001')[0]))];
const coll = new Intl.Collator('zh-Hans-u-co-pinyin');
zhList.sort((a, b) => coll.compare(a, b));
zhList.forEach((zh, i) => INDEXKEY.set(zh, String(i + 1).padStart(3, '0')));
// 第二遍：正式输出
terms.clear();
const all = [];
for (const p of PARTS) for (const id of p.ids) all.push(convert(id));

/* ---------- 术语表 ---------- */
const glossary = [...terms].map((t) => t.split('\u0001')).filter((x) => x[0]);
glossary.sort((a, b) => coll.compare(a[0], b[0]));
const uniq = new Map();
for (const [zh, en] of glossary) if (!uniq.has(zh) || (en && !uniq.get(zh))) uniq.set(zh, en);
writeFileSync(join(ROOT, 'book', 'terms.json'), JSON.stringify([...uniq].map(([zh, en]) => ({ zh, en })), null, 1), 'utf8');

console.log('已转换 ' + all.length + ' 章，共 ' + all.reduce((a, x) => a + x.bytes, 0).toLocaleString('en-US') + ' 字节');
console.log('正文术语 ' + uniq.size + ' 个 -> book/terms.json');