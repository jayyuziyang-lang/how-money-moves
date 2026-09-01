import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

export const BOOK = {
  title: '钱是怎么跑起来的',
  sub: '一本从零开始的金融世界说明书',
  edition: '2026 年 8 月版',
  levels: [
    {
      file: 'level-1.html', n: '01', ghost: 'I',
      name: '地基篇', en: 'FOUNDATIONS',
      tag: '钱到底是什么',
      lede: '在拆解任何复杂的金融产品之前，我们必须先把最朴素的问题问清楚：你钱包里的那串数字，究竟是什么东西？它凭什么能换来一碗面？谁在背后为它作保？这一层不谈投资、不谈赚钱，只谈"钱"这个概念本身——因为后面所有的复杂，都是从这六块砖上长出来的。',
      chapters: [
        { no: '00', id: 'ch-00', title: '一张一百块的环球旅行', kicker: 'PROLOGUE · 序章' },
        { no: '01', id: 'ch-01', title: '钱不是财富，钱是一套记账系统' },
        { no: '02', id: 'ch-02', title: '你的存款，其实不在银行的金库里' },
        { no: '03', id: 'ch-03', title: '利息：时间是有价格的' },
        { no: '04', id: 'ch-04', title: '通货膨胀：每天从你口袋里拿走一点的那个人' },
        { no: '05', id: 'ch-05', title: '资产、负债、净值：全世界通用的三个词' },
        { no: '06', id: 'ch-06', title: '所有金融的原点：今天的钱换明天的钱' },
      ],
    },
    {
      file: 'level-2.html', n: '02', ghost: 'II',
      name: '管道篇', en: 'THE PLUMBING',
      tag: '这台机器到底怎么转',
      lede: '钱不是躺在那里的，它每天在几十亿个账户之间奔跑。这一层我们钻进地板下面，看看那些看不见的管道：钱是怎么被"造"出来的，央行的阀门拧在哪里，利率的信号如何一路传到你的房贷单上，债券、股票、汇率这三大市场又是怎么把全世界的储蓄和投资接在一起的。',
      chapters: [
        { no: '07', id: 'ch-07', title: '货币是怎么"凭空"出现的' },
        { no: '08', id: 'ch-08', title: '央行不是印钞厂，是水闸和温度计' },
        { no: '09', id: 'ch-09', title: '利率的传导链：从政策利率到你的房贷' },
        { no: '10', id: 'ch-10', title: '债券：世界上最大、最无聊、最要命的市场' },
        { no: '11', id: 'ch-11', title: '股票：把一家公司切成一亿片' },
        { no: '12', id: 'ch-12', title: '汇率与美元体系：为什么全世界用别人的钱做生意' },
      ],
    },
    {
      file: 'level-3.html', n: '03', ghost: 'III',
      name: '天气篇', en: 'RISK & CYCLES',
      tag: '潮汐、风暴与泡沫',
      lede: '管道搭好了，接下来要面对天气。金融世界里没有"安全"，只有"风险被定了什么价"。这一层讲清楚风险如何被标价、杠杆如何把小事变成大事、衍生品到底是保险还是赌场、影子银行为什么总在监管之外长出来，以及一部从 1637 年一直上演到今天的固定剧本。',
      chapters: [
        { no: '13', id: 'ch-13', title: '风险的价格：为什么有人借钱 3%，有人 12%' },
        { no: '14', id: 'ch-14', title: '杠杆：金融世界的放大镜与绞肉机' },
        { no: '15', id: 'ch-15', title: '衍生品：从农民的保险单到华尔街的赌桌' },
        { no: '16', id: 'ch-16', title: '影子银行：管道之外的管道' },
        { no: '17', id: 'ch-17', title: '泡沫与崩溃的通用剧本' },
        { no: '18', id: 'ch-18', title: '周期：为什么好日子和坏日子会轮流来' },
      ],
    },
    {
      file: 'level-4.html', n: '04', ghost: 'IV',
      name: '落地篇', en: 'YOUR MOVE',
      tag: '你在这台机器里怎么活',
      lede: '前三层是地图，这一层是导航。你不需要成为交易员，但你需要知道自己的资产负债表长什么样、收益到底从哪里来、为什么"分散"是唯一免费的午餐、复利在什么条件下才成立、骗局的五个固定零件是什么，以及 2026 年这个世界正在发生哪些你无法忽视的结构性变化。',
      chapters: [
        { no: '19', id: 'ch-19', title: '给自己做一张资产负债表' },
        { no: '20', id: 'ch-20', title: '收益从哪儿来：三种钱和一个残酷等式' },
        { no: '21', id: 'ch-21', title: '资产配置：唯一的免费午餐' },
        { no: '22', id: 'ch-22', title: '复利的真相，和关于复利的谎言' },
        { no: '23', id: 'ch-23', title: '骗局的五个零件' },
        { no: '24', id: 'ch-24', title: '2026：六个你必须知道的新变量' },
        { no: '25', id: 'ch-25', title: '金融的本质，是陌生人之间的信任', kicker: 'EPILOGUE · 终章' },
      ],
    },
  ],
};


/* ---- 中文引号排版：只处理文本节点，幂等 ---- */
function smartQuotes(html) {
  const parts = html.split(/(<[^>]*>)/);
  for (let i = 0; i < parts.length; i += 2) {
    let open = true;
    parts[i] = parts[i].replace(/"/g, function () { open = !open; return open ? '\u201d' : '\u201c'; });
  }
  return parts.join('');
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function head(title, desc, rel = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light" data-size="m">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F4F2ED">
<meta name="description" content="${esc(desc)}">
<title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2323407A'/%3E%3Ctext x='16' y='23' font-family='Georgia,serif' font-style='italic' font-size='19' fill='%23fff' text-anchor='middle'%3E%C2%A5%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" media="print" onload="this.media='all'" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap">
<link rel="stylesheet" href="${rel}assets/style.css">
<script>try{var t=localStorage.getItem('mm.theme'),s=localStorage.getItem('mm.size');if(t)document.documentElement.setAttribute('data-theme',t);if(s)document.documentElement.setAttribute('data-size',s);}catch(e){}</script>
</head>
<body>
<div class="progress"></div>`;
}

function topbar(rel = '') {
  return `
<header class="topbar">
  <a class="topbar__home" href="${rel}index.html"><b>钱是怎么跑起来的</b><span>HOW MONEY MOVES</span></a>
  <div class="topbar__mid"></div>
  <nav class="topbar__tools">
    <button class="tbtn" data-set="size" data-val="s" title="小字号">A<sup style="font-size:.7em">-</sup></button>
    <button class="tbtn" data-set="size" data-val="m" title="标准字号">A</button>
    <button class="tbtn" data-set="size" data-val="l" title="大字号">A<sup style="font-size:.7em">+</sup></button>
    <button class="tbtn" data-set="theme" data-val="toggle" title="日间 / 夜读模式" style="margin-left:6px">
      <svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
    </button>
  </nav>
</header>`;
}

function foot(rel = '') {
  return `
<footer class="foot">
  <p><b style="color:var(--ink-3)">《钱是怎么跑起来的》</b> · ${BOOK.edition} · 全书 26 章，约 9 万字。</p>
  <p>本文为通识科普读物，所有数据截至 2026 年 8 月，来源包括中国人民银行、美联储、欧洲央行、国际金融协会（IIF）及公开财经报道。金融环境变化很快，请以最新官方数据为准。</p>
  <p><strong style="color:var(--ink-3)">本文不构成任何投资建议。</strong>任何人告诉你"稳赚不赔"，请立刻回到 <a href="${rel}level-4.html#ch-23">第 23 章</a>。</p>
  <p style="margin-top:14px"><a href="${rel}index.html">返回目录</a> · <a href="${rel}glossary.html">术语速查 &amp; 2026 数据快照</a></p>
</footer>
<script src="${rel}assets/app.js"></script>
</body>
</html>`;
}

function sidenav(lv) {
  const items = lv.chapters.map((c) => `
      <li><a href="#${c.id}"><i>${c.no}</i><span>${esc(c.title)}</span></a></li>`).join('');
  const others = BOOK.levels.filter((x) => x.file !== lv.file)
    .map((x) => `<a href="${x.file}">${x.n} · ${x.name} →</a>`).join('');
  return `
  <aside class="side">
    <button class="side__toggle">本层目录 · ${lv.name}<i>MENU</i></button>
    <div class="side__body">
      <div class="side__label">
        <span class="kicker kicker--accent">LEVEL ${lv.n} · ${lv.en}</span>
        <b>${lv.name} — ${lv.tag}</b>
      </div>
      <ol>${items}
      </ol>
      <div class="side__foot">
        ${others}
        <a href="glossary.html">附录 · 术语速查 →</a>
      </div>
    </div>
  </aside>`;
}

function levelStats(lv) {
  let cn = 0;
  for (const c of lv.chapters) {
    const p = join(ROOT, 'content', c.id + '.html');
    if (!existsSync(p)) continue;
    const plain = readFileSync(p, 'utf8').replace(/<[^>]+>/g, '');
    cn += (plain.match(/[\u4e00-\u9fa5]/g) || []).length;
  }
  const mins = Math.round(cn / 400);
  return lv.chapters.length + ' 章 · 约 ' + (cn / 10000).toFixed(1) + ' 万字 · 约 ' + mins + ' 分钟';
}

function hero(lv) {
  const list = lv.chapters.map((c) => `
        <a href="#${c.id}"><i>${c.no}</i><span>${esc(c.title)}</span></a>`).join('');
  return `
    <section class="part-hero" data-ghost="${lv.ghost}">
      <div class="part-hero__meta"><span class="bar"></span><span class="kicker">LEVEL ${lv.n} · ${lv.en}</span><span class="part-hero__len">${levelStats(lv)}</span></div>
      <h1>${lv.name}：${lv.tag}<small>${lv.en}</small></h1>
      <p class="part-hero__lede">${lv.lede}</p>
      <div class="part-hero__list">${list}
      </div>
    </section>`;
}

function pager(i) {
  const prev = i > 0 ? BOOK.levels[i - 1] : null;
  const next = i < BOOK.levels.length - 1 ? BOOK.levels[i + 1] : null;
  const a = prev
    ? `<a class="pv" href="${prev.file}"><span class="kicker">← LEVEL ${prev.n}</span><b>${prev.name} · ${prev.tag}</b></a>`
    : `<a class="pv" href="index.html"><span class="kicker">← 目录</span><b>返回全书地图</b></a>`;
  const b = next
    ? `<a class="nx" href="${next.file}"><span class="kicker">LEVEL ${next.n} →</span><b>${next.name} · ${next.tag}</b></a>`
    : `<a class="nx" href="glossary.html"><span class="kicker">附录 →</span><b>术语速查 &amp; 2026 数据快照</b></a>`;
  return `
    <nav class="pager">${a}${b}</nav>`;
}

function buildLevel(lv, i) {
  const frags = lv.chapters.map((c) => {
    const p = join(ROOT, 'content', c.id + '.html');
    if (!existsSync(p)) return `
    <section class="chapter" id="${c.id}"><div class="ch-head"><div class="ch-head__top"><span class="ch-num">${c.no}</span><span class="kicker">待补</span></div><h2 class="ch-title">${esc(c.title)}</h2></div><p style="color:var(--ink-4)">（本章内容尚未生成）</p></section>`;
    return '\n' + readFileSync(p, 'utf8').trim();
  }).join('\n');

  const html = head(`${lv.name}：${lv.tag} · ${BOOK.title}`, lv.lede.slice(0, 110))
    + topbar()
    + `
<div class="shell">${sidenav(lv)}
  <main class="reader">${hero(lv)}${frags}${pager(i)}
  </main>
</div>`
    + foot();

  writeFileSync(join(ROOT, lv.file), smartQuotes(html), 'utf8');
  return lv.file;
}

const built = BOOK.levels.map(buildLevel);
for (const f of ['index.html', 'glossary.html']) {
  const p = join(ROOT, f);
  if (existsSync(p)) writeFileSync(p, smartQuotes(readFileSync(p, 'utf8')), 'utf8');
}
console.log('built:', built.join(', '));