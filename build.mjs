import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

const BOOK = {
  title: '钱是怎么跑起来的',
  sub: '一本从零开始的金融世界说明书',
  edition: '2026 年 8 月版',
  parts: [
    { n: '01', ghost: 'I', name: '地基篇', en: 'FOUNDATIONS', tag: '钱到底是什么',
      lede: '不谈投资，不谈赚钱。先把最朴素的问题问清楚：你钱包里那串数字，凭什么能换来一碗面？这一卷不需要任何数学，最多做几道加减法。',
      chapters: [
        ['00', 'ch-00', '一张一百块的环球旅行', 'PROLOGUE · 序章'],
        ['01', 'ch-01', '钱不是财富，钱是一套记账系统'],
        ['02', 'ch-02', '你的存款，其实不在银行的金库里'],
        ['03', 'ch-03', '利息：时间是有价格的'],
        ['04', 'ch-04', '通货膨胀：每天从你口袋里拿走一点的那个人'],
        ['05', 'ch-05', '资产、负债、净值：全世界通用的三个词'],
        ['06', 'ch-06', '所有金融的原点：今天的钱换明天的钱'],
      ] },
    { n: '02', ghost: 'II', name: '管道篇', en: 'THE PLUMBING', tag: '这台机器怎么转',
      lede: '钻到地板下面，看那些看不见的管子：钱怎么被造出来，央行的阀门拧在哪，利率怎么一路走到你的房贷单上，债券股票汇率又怎么把全世界的储蓄和投资接在一起。',
      chapters: [
        ['07', 'ch-07', '货币是怎么“凭空”出现的'],
        ['08', 'ch-08', '央行不是印钞厂，是水闸和温度计'],
        ['09', 'ch-09', '利率的传导链：从政策利率到你的房贷'],
        ['10', 'ch-10', '债券：世界上最大、最无聊、最要命的市场'],
        ['11', 'ch-11', '股票：把一家公司切成一亿片'],
        ['12', 'ch-12', '汇率与美元体系：为什么全世界用别人的钱做生意'],
      ] },
    { n: '03', ghost: 'III', name: '天气篇', en: 'RISK & CYCLES', tag: '潮汐、风暴与泡沫',
      lede: '金融世界里没有绝对安全，只有风险被定了什么价。这一卷讲清楚风险如何被标价、被放大、被转移，以及一部从 1637 年一直演到今天的老剧本。',
      chapters: [
        ['13', 'ch-13', '风险的价格：为什么有人借钱 3%，有人 12%'],
        ['14', 'ch-14', '杠杆：金融世界的放大镜与绞肉机'],
        ['15', 'ch-15', '衍生品：从农民的保险单到华尔街的赌桌'],
        ['16', 'ch-16', '影子银行：管道之外的管道'],
        ['17', 'ch-17', '泡沫与崩溃的通用剧本'],
        ['18', 'ch-18', '周期：为什么好日子和坏日子会轮流来'],
      ] },
    { n: '04', ghost: 'IV', name: '落地篇', en: 'YOUR MOVE', tag: '你在其中怎么活',
      lede: '前三卷是地图，这一卷是导航。你不必成为交易员，但你需要知道自己的资产负债表长什么样、收益到底从哪来、骗局的固定零件有哪些。',
      chapters: [
        ['19', 'ch-19', '给自己做一张资产负债表'],
        ['20', 'ch-20', '收益从哪儿来：三种钱和一个残酷等式'],
        ['21', 'ch-21', '资产配置：唯一的免费午餐'],
        ['22', 'ch-22', '复利的真相，和关于复利的谎言'],
        ['23', 'ch-23', '骗局的五个零件'],
        ['24', 'ch-24', '2026：六个你必须知道的新变量'],
        ['25', 'ch-25', '金融的本质，是陌生人之间的信任', 'EPILOGUE · 终章'],
      ] },
    { n: '05', ghost: 'V', name: '后记', en: 'AFTERWORD', tag: '合上书之后',
      lede: '正文到第 25 章就结束了。这三篇写在书外面：一篇把二十六章压成可以随身带走的一页，一篇讲清楚这本书为什么从头到尾不谈发财，最后一篇是写给读到这里的你的信。',
      chapters: [
        ['I', 'ep-1', '把二十六章压成一页', 'AFTERWORD · 后记一'],
        ['II', 'ep-2', '我们为什么从头到尾不谈发财', 'AFTERWORD · 后记二'],
        ['III', 'ep-3', '给读者的信', 'AFTERWORD · 后记三'],
      ] },
  ],
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (s) => s.replace(/<[^>]+>/g, '');
const cnt = (s) => (s.match(/[\u4e00-\u9fa5]/g) || []).length;

function smartQuotes(html) {
  const parts = html.split(/(<[^>]*>)/);
  for (let i = 0; i < parts.length; i += 2) {
    let open = true;
    parts[i] = parts[i].replace(/"/g, function () { open = !open; return open ? '\u201d' : '\u201c'; });
  }
  return parts.join('');
}

const FLAT = [];
BOOK.parts.forEach((p, pi) => {
  p.chapters.forEach((c) => {
    FLAT.push({ no: c[0], id: c[1], title: c[2], part: pi, partName: p.name, partN: p.n, file: c[1] + '.html' });
  });
});

const SEARCH = [];
for (const ch of FLAT) {
  const p = join(ROOT, 'content', ch.id + '.html');
  if (!existsSync(p)) { ch.html = '<p>（本章内容尚未生成）</p>'; ch.sections = []; ch.words = 0; continue; }
  let raw = readFileSync(p, 'utf8').trim();
  let n = 0;
  const sections = [];
  raw = raw.replace(/<h3(\s[^>]*)?>([\s\S]*?)<\/h3>/g, function (m, attr, inner) {
    n++;
    const sid = ch.id + '-s' + n;
    sections.push({ id: sid, title: strip(inner).trim() });
    return '<h3 id="' + sid + '"' + (attr || '') + '>' + inner + '</h3>';
  });
  ch.html = raw;
  ch.sections = sections;
  ch.words = cnt(strip(raw));

  const blocks = [];
  let cur = '';
  const paras = raw.match(/<p[^>]*>[\s\S]*?<\/p>|<h3[^>]*>[\s\S]*?<\/h3>/g) || [];
  for (const blk of paras) {
    const idm = blk.match(/^<h3[^>]*id="([^"]+)"/);
    if (idm) { cur = idm[1]; continue; }
    const t = strip(blk).replace(/\s+/g, ' ').trim();
    if (t.length >= 12) blocks.push([t.slice(0, 180), cur]);
  }
  SEARCH.push({ id: ch.id, no: ch.no, title: ch.title, part: ch.partName, b: blocks });
}
const TOTAL = FLAT.reduce((a, c) => a + c.words, 0);

function shell(o) {
  return '<!DOCTYPE html>\n<html lang="zh-CN" data-theme="light">\n<head>\n' +
  '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<meta name="theme-color" content="#F4F2ED">\n<meta name="description" content="' + esc(o.desc) + '">\n' +
  '<title>' + esc(o.title) + '</title>\n' +
  '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect width=\'32\' height=\'32\' rx=\'7\' fill=\'%2323407A\'/%3E%3Ctext x=\'16\' y=\'23\' font-family=\'Georgia,serif\' font-style=\'italic\' font-size=\'19\' fill=\'%23fff\' text-anchor=\'middle\'%3E%C2%A5%3C/text%3E%3C/svg%3E">\n' +
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" media="print" onload="this.media=\'all\'" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap">\n' +
  '<link rel="stylesheet" href="assets/style.css">\n<link rel="stylesheet" href="assets/reader.css">\n' +
  '<script>try{var s=JSON.parse(localStorage.getItem("hmm.prefs")||"{}"),d=document.documentElement;' +
  'if(s.theme)d.setAttribute("data-theme",s.theme);if(s.size)d.setAttribute("data-size",s.size);' +
  'if(s.lh)d.setAttribute("data-lh",s.lh);if(s.width)d.setAttribute("data-width",s.width);' +
  'if(s.font)d.setAttribute("data-font",s.font);}catch(e){}</script>\n' +
  '</head>\n<body class="' + (o.cls || '') + '"' + (o.chapter ? ' data-chapter="' + o.chapter + '"' : '') + '>\n' +
  '<div class="progress"></div>\n' + o.body +
  '\n<script src="assets/book.js"></script>\n<script src="assets/reader.js"></script>\n</body>\n</html>';
}

function chrome(title) {
  return [
'<header class="rbar">',
'  <button class="rbtn" data-act="toc" title="目录 (T)" aria-label="目录"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg></button>',
'  <a class="rbtn" href="index.html" title="回到书架"><svg viewBox="0 0 24 24"><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></a>',
'  <div class="rbar__title">' + esc(title) + '</div>',
'  <button class="rbtn" data-act="find" title="搜索全书 (F)" aria-label="搜索"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>',
'  <button class="rbtn rbtn--mark" data-act="mark" title="加入书签 (B)" aria-label="书签"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg></button>',
'  <button class="rbtn" data-act="prefs" title="阅读设置 (S)" aria-label="设置"><b>Aa</b></button>',
'</header>',
'<div class="scrim" data-act="close"></div>',
'<aside class="drawer" id="drawer" aria-hidden="true">',
'  <div class="drawer__tabs">',
'    <button class="dtab is-on" data-tab="toc">目录</button>',
'    <button class="dtab" data-tab="sec">本章</button>',
'    <button class="dtab" data-tab="mark">书签</button>',
'    <button class="dtab" data-tab="find">搜索</button>',
'    <button class="rbtn drawer__x" data-act="close" aria-label="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>',
'  </div>',
'  <div class="drawer__body">',
'    <div class="dpane is-on" data-pane="toc"></div>',
'    <div class="dpane" data-pane="sec"></div>',
'    <div class="dpane" data-pane="mark"></div>',
'    <div class="dpane" data-pane="find"><div class="find"><input type="search" id="q" placeholder="搜索全书正文…" autocomplete="off" spellcheck="false"><div class="find__out"></div></div></div>',
'  </div>',
'</aside>',
'<aside class="prefs" id="prefs" aria-hidden="true">',
'  <div class="prefs__row"><span>主题</span><div class="seg" data-pref="theme"><button data-v="light">日间</button><button data-v="sepia">米黄</button><button data-v="dark">夜间</button></div></div>',
'  <div class="prefs__row"><span>字号</span><div class="seg" data-pref="size"><button data-v="xs">小</button><button data-v="s">较小</button><button data-v="m">标准</button><button data-v="l">较大</button><button data-v="xl">大</button></div></div>',
'  <div class="prefs__row"><span>行距</span><div class="seg" data-pref="lh"><button data-v="tight">紧凑</button><button data-v="normal">标准</button><button data-v="loose">宽松</button></div></div>',
'  <div class="prefs__row"><span>版心</span><div class="seg" data-pref="width"><button data-v="narrow">窄</button><button data-v="normal">标准</button><button data-v="wide">宽</button></div></div>',
'  <div class="prefs__row"><span>正文字体</span><div class="seg" data-pref="font"><button data-v="sans">黑体</button><button data-v="serif">宋体</button></div></div>',
'  <div class="prefs__foot"><b>←</b> <b>→</b> 翻章 · <b>T</b> 目录 · <b>B</b> 书签 · <b>F</b> 搜索 · <b>S</b> 设置 · <b>Esc</b> 关闭</div>',
'</aside>',
'<div class="toast" id="toast"></div>',
  ].join('\n');
}

function chapterPage(ch, i) {
  const prev = FLAT[i - 1], next = FLAT[i + 1];
  const mins = Math.max(1, Math.round(ch.words / 400));
  const nav = '<nav class="chnav">' +
    (prev ? '<a class="chnav__a" href="' + prev.file + '"><span class="kicker">← 上一章</span><b>' + esc(prev.no + ' · ' + prev.title) + '</b></a>'
          : '<a class="chnav__a" href="index.html"><span class="kicker">← 书架</span><b>回到全书目录</b></a>') +
    (next ? '<a class="chnav__a chnav__a--nx" href="' + next.file + '"><span class="kicker">下一章 →</span><b>' + esc(next.no + ' · ' + next.title) + '</b></a>'
          : '<a class="chnav__a chnav__a--nx" href="glossary.html"><span class="kicker">附录 →</span><b>术语速查 &amp; 2026 数据快照</b></a>') +
    '</nav>';
  const pill = '<div class="pill">' +
    (prev ? '<a href="' + prev.file + '" title="上一章"><svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg></a>' : '<span class="off"><svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg></span>') +
    '<em id="pillTxt">本章 0%</em>' +
    (next ? '<a href="' + next.file + '" title="下一章"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></a>' : '<span class="off"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span>') +
    '</div>';
  const body = chrome(ch.no + ' · ' + ch.title) +
    '\n<main class="page">\n<div class="page__meta"><a class="kicker" href="part-' + (ch.part + 1) + '.html">卷 ' + ch.partN + ' · ' + ch.partName + '</a>' +
    '<span class="kicker">' + ch.words.toLocaleString('en-US') + ' 字 · 约 ' + mins + ' 分钟</span></div>\n' +
    ch.html + '\n' + nav + '\n</main>\n' + pill;
  writeFileSync(join(ROOT, ch.file), smartQuotes(shell({
    title: ch.no + ' ' + ch.title + ' · ' + BOOK.title,
    desc: strip(ch.html).replace(/\s+/g, ' ').slice(0, 120), body, cls: 'is-chapter', chapter: ch.id })), 'utf8');
}

function partPage(p, pi) {
  const list = FLAT.filter(function (c) { return c.part === pi; });
  const items = list.map(function (c) {
    return '<a class="clist__i" href="' + c.file + '" data-ch="' + c.id + '"><i>' + c.no + '</i><div><b>' + esc(c.title) +
      '</b><span>' + c.words.toLocaleString('en-US') + ' 字 · 约 ' + Math.max(1, Math.round(c.words / 400)) + ' 分钟</span></div><em class="st"></em></a>';
  }).join('');
  const words = list.reduce(function (a, c) { return a + c.words; }, 0);
  const body = chrome('卷 ' + p.n + ' · ' + p.name) +
    '\n<main class="page page--part">\n<section class="part-hero" data-ghost="' + p.ghost + '">' +
    '<div class="part-hero__meta"><span class="bar"></span><span class="kicker">LEVEL ' + p.n + ' · ' + p.en + '</span>' +
    '<span class="part-hero__len">' + list.length + ' 章 · 约 ' + (words / 10000).toFixed(1) + ' 万字 · 约 ' + Math.round(words / 400) + ' 分钟</span></div>' +
    '<h1>' + p.name + '：' + p.tag + '<small>' + p.en + '</small></h1>' +
    '<p class="part-hero__lede">' + p.lede + '</p></section>\n<div class="clist">' + items + '</div>\n' +
    '<nav class="chnav">' +
    (pi > 0 ? '<a class="chnav__a" href="part-' + pi + '.html"><span class="kicker">← 上一卷</span><b>' + esc(BOOK.parts[pi - 1].name + '：' + BOOK.parts[pi - 1].tag) + '</b></a>'
            : '<a class="chnav__a" href="index.html"><span class="kicker">← 书架</span><b>回到全书目录</b></a>') +
    (pi < BOOK.parts.length - 1 ? '<a class="chnav__a chnav__a--nx" href="part-' + (pi + 2) + '.html"><span class="kicker">下一卷 →</span><b>' + esc(BOOK.parts[pi + 1].name + '：' + BOOK.parts[pi + 1].tag) + '</b></a>'
            : '<a class="chnav__a chnav__a--nx" href="glossary.html"><span class="kicker">附录 →</span><b>术语速查 &amp; 2026 数据快照</b></a>') +
    '</nav>\n</main>';
  writeFileSync(join(ROOT, 'part-' + (pi + 1) + '.html'), smartQuotes(shell({
    title: p.name + '：' + p.tag + ' · ' + BOOK.title, desc: p.lede.slice(0, 110), body, cls: 'is-part' })), 'utf8');
}

function homePage() {
  const cards = BOOK.parts.map(function (p, pi) {
    const list = FLAT.filter(function (c) { return c.part === pi; });
    const chs = list.map(function (c) {
      return '<a class="pc__ch" href="' + c.file + '" data-ch="' + c.id + '"><i>' + c.no + '</i><span>' + esc(c.title) + '</span><em class="st"></em></a>';
    }).join('');
    return '<section class="pc"><a class="pc__head" href="part-' + (pi + 1) + '.html"><span class="pc__n">' + p.ghost +
      '</span><div><h3>' + p.name + '：' + p.tag + '</h3><p>' + esc(p.lede.slice(0, 58)) + '…</p></div><span class="pc__go">→</span></a>' +
      '<div class="pc__list">' + chs + '</div></section>';
  }).join('\n');

  const body = chrome(BOOK.title) + '\n' + [
'<div class="cover">',
'  <div class="cover__card">',
'    <div class="cover__meta"><span class="bar"></span><span class="kicker">A FIELD GUIDE TO THE FINANCIAL WORLD · 2026 EDITION</span></div>',
'    <h1>钱是怎么<em>跑</em>起来的</h1>',
'    <p class="cover__sub">你每天都在用它，却没人告诉过你它从哪来、到哪去、凭什么值钱。这本书从楼下一顿 98 块的砂锅开始，一路拆到全球资本流动。不跳步，不甩术语，不预测涨跌。</p>',
'    <div class="cover__cta">',
'      <a class="btn btn--primary" id="resumeBtn" href="ch-00.html"><span class="kicker">开始阅读</span><b>序章 · 一张一百块的环球旅行</b></a>',
'      <a class="btn" href="glossary.html"><span class="kicker">附录</span><b>术语速查 &amp; 数据快照</b></a>',
'    </div>',
'    <div class="cover__facts">',
'      <div><b>' + FLAT.length + '</b><span>篇，每篇独立成页</span></div>',
'      <div><b>' + BOOK.parts.length + '</b><span>卷，由浅入深</span></div>',
'      <div><b>' + (TOTAL / 10000).toFixed(1) + '<i>万</i></b><span>字，约 ' + Math.round(TOTAL / 400 / 60 * 10) / 10 + ' 小时读完</span></div>',
'      <div><b>2026.08</b><span>数据与政策截止时点</span></div>',
'    </div>',
'  </div>',
'</div>',
'<main class="home">',
'  <section class="statbar" id="statbar"></section>',
'  <section class="bmk" id="bmkHome"></section>',
'  <div class="home__head">',
'    <span class="kicker kicker--accent">CONTENTS · 全书目录</span>',
'    <h2>' + FLAT.length + ' 篇，一条链</h2>',
'    <p>钱是记账，记账要有人信，信任靠制度和抵押品，银行放贷时创造存款，所以钱约等于债，债要付息，付息需要增长，增长需要投资，投资需要给风险定价，定价错误加杠杆等于危机，危机后重置资产负债表，循环重来。每一章都挂在这条链的某一环上。</p>',
'  </div>',
cards,
'</main>',
'<footer class="foot">',
'  <p><b>《钱是怎么跑起来的》</b> · ' + BOOK.edition + ' · 全书 ' + FLAT.length + ' 篇，约 ' + (TOTAL / 10000).toFixed(1) + ' 万字。</p>',
'  <p>数据截至 2026 年 8 月，来源包括中国人民银行、美联储、欧洲央行、国际金融协会（IIF）及公开财经报道。</p>',
'  <p><strong>本文不构成任何投资建议。</strong>任何人告诉你稳赚不赔，请立刻去看 <a href="ch-23.html">第 23 章</a>。</p>',
'</footer>'].join('\n');
  writeFileSync(join(ROOT, 'index.html'), smartQuotes(shell({
    title: BOOK.title + ' · ' + BOOK.sub,
    desc: '金融科普阅读器：' + FLAT.length + ' 篇独立成页，支持书签、续读、全书搜索、夜读与米黄模式。2026 年 8 月版。',
    body, cls: 'is-home' })), 'utf8');
}

function dataFiles() {
  const chapters = FLAT.map(function (c) {
    return { id: c.id, no: c.no, title: c.title, file: c.file, part: c.part, partName: c.partName, words: c.words, sections: c.sections };
  });
  const parts = BOOK.parts.map(function (p, i) { return { n: p.n, name: p.name, tag: p.tag, en: p.en, file: 'part-' + (i + 1) + '.html' }; });
  writeFileSync(join(ROOT, 'assets', 'book.js'),
    'window.BOOK=' + JSON.stringify({ title: BOOK.title, edition: BOOK.edition, total: TOTAL, parts, chapters }) + ';', 'utf8');
  writeFileSync(join(ROOT, 'assets', 'search.js'), 'window.SEARCH_DATA=' + JSON.stringify(SEARCH) + ';', 'utf8');
}

function redirects() {
  for (let i = 1; i <= 4; i++) {
    const to = 'part-' + i + '.html';
    writeFileSync(join(ROOT, 'level-' + i + '.html'),
      '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<meta http-equiv="refresh" content="0;url=' + to + '"><link rel="canonical" href="' + to + '">' +
      '<title>正在跳转…</title></head><body><p>本页已按章拆分，正在跳转到 <a href="' + to + '">' + to + '</a></p></body></html>', 'utf8');
  }
}

function fixGlossary() {
  const p = join(ROOT, 'glossary.html');
  if (!existsSync(p)) return;
  let t = readFileSync(p, 'utf8');
  t = t.replace(/href="level-4\.html#(ch-\d+)"/g, 'href="$1.html"');
  t = t.replace(/href="level-([1-4])\.html"/g, 'href="part-$1.html"');
  t = t.replace(/→ 第 (\d+) 章/g, function (m, d) { return '→ 第 ' + d + ' 章'; });
  if (t.indexOf('assets/reader.css') < 0) {
    t = t.replace('<link rel="stylesheet" href="assets/style.css">', '<link rel="stylesheet" href="assets/style.css">\n<link rel="stylesheet" href="assets/reader.css">');
  }
  writeFileSync(p, smartQuotes(t), 'utf8');
}

FLAT.forEach(chapterPage);
BOOK.parts.forEach(partPage);
homePage();
dataFiles();
redirects();
fixGlossary();
console.log('生成 ' + FLAT.length + ' 个章节页 + 4 个卷首页 + index.html + book.js + search.js + 4 个重定向');
console.log('全书中文字数 ' + TOTAL);