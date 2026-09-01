import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const DIR = join(ROOT, 'content');

const BANNED = ['在当今社会','随着.{0,6}的发展','众所周知','不可否认','值得注意的是','值得一提的是','需要指出的是',
 '让我们一起','接下来让我们','说到这里','相信很多人都有','总而言之','综上所述','由此可见','归根结底',
 '从某种意义上说','在某种程度上','不仅仅是.{0,14}更是','深刻地揭示','生动地诠释','有着重要的意义','起着关键的作用',
 '一言以蔽之','细思极恐','冰山一角','双刃剑','潘多拉魔盒','达摩克利斯','一叶扁舟','时代的洪流','历史的车轮','没有硝烟的战争'];

const ALLOWED = new Set(['chapter','ch-head','ch-head__top','ch-num','kicker','kicker--accent','ch-title','ch-lede','ch-body',
 'lede','pull','box','box__t','box--eg','box--myth','box--data','box--warn','box--deep','mvf','mvf__row','mvf__row--f',
 'mvf__tag','stats','stat','stat--accent','flow','flow__n','chain','tbl','n','bs','bs__side','tot','talk','takeaway',
 'bridge','barfig','barfig__r','barfig__t','alt','sep','term','tt','on','num','en','hl-warm']);

const REQUIRED = [['box--eg',2],['box--myth',1],['pull',1],['takeaway',1],['bridge',1]];
const VOID_TAGS = /^(br|hr|img|meta|link|input|source|col)$/i;

let bad = 0, total = 0;
const names = readdirSync(DIR).filter(function (x) { return x.endsWith('.html'); }).sort();
for (const f of names) {
  const t = readFileSync(join(DIR, f), 'utf8');
  const plain = t.replace(/<[^>]+>/g, '');
  const cn = (plain.match(/[\u4e00-\u9fa5]/g) || []).length;
  total += cn;
  const issues = [];

  for (const p of BANNED) {
    const m = plain.match(new RegExp(p, 'g'));
    if (m) issues.push('禁用词[' + m[0] + ']x' + m.length);
  }

  const dash = (plain.match(/——/g) || []).length;
  if (dash > 3) issues.push('破折号' + dash);

  const classes = new Set();
  for (const m of t.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  }
  const unknown = [...classes].filter(function (c) { return !ALLOWED.has(c); });
  if (unknown.length) issues.push('未知class:' + unknown.join(','));

  if (!/^(ch-25|ch-00|ep-\d)\.html$/.test(f)) {
    for (const pair of REQUIRED) {
      const k = (t.split(pair[0]).length - 1);
      if (k < pair[1]) issues.push('缺' + pair[0] + '(' + k + '/' + pair[1] + ')');
    }
  }

  const styles = [...t.matchAll(/style="([^"]*)"/g)].map(function (m) { return m[1]; })
    .filter(function (s) { return !/^width:\s*[\d.]+%$/.test(s); });
  if (styles.length) issues.push('多余style x' + styles.length + ':' + styles.slice(0, 2).join('|'));

  if (t.indexOf('```') >= 0) issues.push('markdown围栏');
  if (/<(html|head|body|script)\b/i.test(t)) issues.push('含html/head/body/script');

  let open = 0;
  for (const m of t.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
    if (m[2] === '/' || VOID_TAGS.test(m[1])) continue;
    open++;
  }
  const close = (t.match(/<\/[a-zA-Z][a-zA-Z0-9]*>/g) || []).length;
  if (open !== close) issues.push('标签开合' + open + '/' + close);

  if (cn < 2000 && f !== 'ch-00.html') issues.push('字数少' + cn);

  if (issues.length) bad++;
  console.log((issues.length ? 'X ' : 'v ') + f.padEnd(13) + String(cn).padStart(5) + '字  ' + (issues.join(' ; ') || 'OK'));
}
console.log('');
console.log('文件数 ' + names.length + '，有问题 ' + bad + '，中文总字数 ' + total);