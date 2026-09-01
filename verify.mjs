import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Users\\91615\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const BASE = process.argv[2] || 'http://127.0.0.1:8795';
const profile = mkdtempSync(join(tmpdir(), 'hmm-verify-'));

const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--mute-audio', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function version() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(250);
  }
  throw new Error('Chrome 未能启动调试端口');
}

const v = await version();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0;
const waiting = new Map();
const listeners = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) {
    const w = waiting.get(m.id); waiting.delete(m.id);
    m.error ? w.rej(new Error(m.error.message)) : w.res(m.result);
  } else if (m.method) {
    for (const fn of listeners.slice()) fn(m);
  }
};
function send(method, params, sessionId) {
  const id = ++seq;
  const msg = { id, method, params: params || {} };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => {
    waiting.set(id, { res, rej });
    setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); rej(new Error('超时 ' + method)); } }, 20000);
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);

const problems = [];
listeners.push((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === 'Runtime.exceptionThrown') problems.push('JS异常: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/fonts\.googleapis/.test(m.params.entry.text || '')) {
    problems.push('控制台错误: ' + m.params.entry.text);
  }
});

async function open(path) {
  let loaded = false;
  const onLoad = (m) => { if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) loaded = true; };
  listeners.push(onLoad);
  await send('Page.navigate', { url: BASE + path }, sessionId);
  for (let i = 0; i < 80 && !loaded; i++) await sleep(60);
  listeners.splice(listeners.indexOf(onLoad), 1);
  await sleep(450);
}
async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r.result.value;
}

const out = [];
const ok = (label, cond, detail) => { out.push((cond ? 'v ' : 'X ') + label + (detail !== undefined ? '  ' + detail : '')); if (!cond) problems.push(label); };

/* ---------- 章节页 ---------- */
await open('/ch-07.html');
const a = await evalJS(`(function(){
  var r={};
  r.vw=document.documentElement.clientWidth; r.vh=window.innerHeight;
  r.overflow=document.documentElement.scrollWidth>r.vw+1;
  r.book=!!(window.BOOK&&window.BOOK.chapters.length);
  r.chapters=window.BOOK.chapters.length;
  r.toc=document.querySelectorAll('.toci').length;
  r.sec=document.querySelectorAll('.seci').length;
  r.chnav=document.querySelectorAll('.chnav__a').length;
  r.pill=!!document.querySelector('.pill');
  var p=document.querySelector('.ch-body p');
  r.proseW=Math.round(p.getBoundingClientRect().width);
  r.fs=parseFloat(getComputedStyle(p).fontSize);
  r.cpl=Math.round(r.proseW/r.fs);
  return r;
})()`);
out.push('--- 章节页 ch-07 ---');
ok('视口正常', a.vw > 1000, a.vw + 'x' + a.vh);
ok('无横向溢出', !a.overflow);
ok('book.js 已加载 29 篇', a.chapters === 29, a.chapters + ' 篇');
ok('目录抽屉渲染', a.toc === 30, a.toc + ' 项');
ok('本章小节渲染', a.sec === 7, a.sec + ' 节');
ok('上/下一章导航', a.chnav === 2);
ok('底部浮动进度条', a.pill);
ok('行宽在 28-42 字之间', a.cpl >= 28 && a.cpl <= 42, a.cpl + ' 字/行 (' + a.proseW + 'px @ ' + a.fs + 'px)');
async function themeColors() {
  const res = {};
  for (const th of ['light', 'sepia', 'dark']) {
    await evalJS("document.documentElement.setAttribute('data-theme','" + th + "')");
    await sleep(520);
    res[th] = await evalJS("(function(){var c=getComputedStyle(document.body);return c.backgroundColor+' / '+c.color;})()");
  }
  await evalJS("document.documentElement.setAttribute('data-theme','light')");
  await sleep(400);
  return res;
}
const th = await themeColors();
ok('三套主题各不相同', th.light !== th.sepia && th.sepia !== th.dark && th.light !== th.dark,
  '\n     日间 ' + th.light + '\n     米黄 ' + th.sepia + '\n     夜间 ' + th.dark);



await evalJS("document.querySelector('[data-act=\"toc\"]').click()");
await sleep(420);
const dr = await evalJS("(function(){var d=document.querySelector('.drawer').getBoundingClientRect();return {open:document.body.classList.contains('is-drawer'),left:Math.round(d.left),w:Math.round(d.width),scrim:getComputedStyle(document.querySelector('.scrim')).opacity};})()");
await evalJS("document.querySelector('[data-act=\"close\"]').click()");
await sleep(420);
const dr2 = await evalJS("(function(){return Math.round(document.querySelector('.drawer').getBoundingClientRect().left);})()");
out.push('--- 交互 ---');
ok('目录抽屉滑入', dr.open && dr.left > -5, 'left=' + dr.left + 'px 宽 ' + dr.w + 'px 遮罩不透明度 ' + dr.scrim);
ok('目录抽屉收起', dr2 < -100, 'left=' + dr2 + 'px');

const b = await evalJS(`(function(){
  var r={};
  document.querySelector('[data-act="prefs"]').click();
  document.querySelector('.seg[data-pref="size"] button[data-v="xl"]').click();
  r.xl=parseFloat(getComputedStyle(document.querySelector('.ch-body p')).fontSize);
  document.querySelector('.seg[data-pref="width"] button[data-v="wide"]').click();
  r.wide=Math.round(document.querySelector('.ch-body p').getBoundingClientRect().width);
  document.querySelector('.seg[data-pref="font"] button[data-v="serif"]').click();
  r.serif=getComputedStyle(document.querySelector('.ch-body p')).fontFamily.slice(0,26);
  document.querySelector('.seg[data-pref="size"] button[data-v="m"]').click();
  document.querySelector('.seg[data-pref="width"] button[data-v="normal"]').click();
  document.querySelector('.seg[data-pref="font"] button[data-v="sans"]').click();
  document.querySelector('[data-act="close"]').click();
  r.persisted=JSON.parse(localStorage.getItem('hmm.prefs')||'{}');
  window.scrollTo(0,2000);
  document.querySelector('[data-act="mark"]').click();
  var s=JSON.parse(localStorage.getItem('hmm.state')||'{}');
  r.marks=(s.marks||[]).length; r.markText=(s.marks[0]||{}).text; r.markPct=Math.round(((s.marks[0]||{}).p||0)*100);
  r.btnOn=document.querySelector('.rbtn--mark').classList.contains('is-on');
  r.pillTxt='';
  document.querySelector('[data-act="mark"]').click();
  r.afterRemove=(JSON.parse(localStorage.getItem('hmm.state')||'{}').marks||[]).length;
  return r;
})()`);

ok('字号可调 (xl)', b.xl >= 21, b.xl + 'px');
ok('版心可调 (wide)', b.wide > 700, b.wide + 'px');
ok('可切宋体', /Songti|Serif|SimSun|Georgia/i.test(b.serif), b.serif);
ok('偏好写入 localStorage', !!b.persisted.size);
ok('书签可添加并带摘录', b.marks === 1 && !!b.markText, b.markPct + '% · ' + String(b.markText).slice(0, 24) + '…');
ok('书签按钮状态同步', b.btnOn);
ok('书签可移除', b.afterRemove === 0);
await evalJS('window.scrollTo(0,2400)');
await sleep(600);
const pt = await evalJS("(function(){return document.getElementById('pillTxt').textContent;})()");
ok('进度显示本章与全书', /本章 \d+% · 全书 \d+%/.test(pt) && !/本章 0%/.test(pt), pt);

const c = await evalJS(`new Promise(function(res){
  document.querySelector('[data-act="find"]').click();
  var q=document.getElementById('q'); q.value='货币乘数';
  q.dispatchEvent(new Event('input'));
  var t=0, iv=setInterval(function(){
    var n=document.querySelectorAll('.fi').length;
    if(n>0||++t>40){clearInterval(iv);
      res({n:n, first:(document.querySelector('.fi b')||{}).textContent,
           href:(document.querySelector('.fi')||{}).getAttribute?document.querySelector('.fi').getAttribute('href'):'',
           mark:!!document.querySelector('.fi mark'),
           idx:(window.SEARCH_DATA||[]).length});}
  },120);
})`);
out.push('--- 全书搜索 ---');
ok('搜索索引懒加载成功', c.idx === 29, c.idx + ' 篇索引');
ok('搜索「货币乘数」有结果', c.n > 0, c.n + ' 条，首条：' + c.first);
ok('结果高亮关键词', c.mark);
ok('结果可跳转到小节锚点', /ch-\d+\.html/.test(c.href || ''), c.href);


/* ---------- 划线与分享卡片 ---------- */
await open('/ch-11.html');
await evalJS("localStorage.removeItem('hmm.state')");
await open('/ch-11.html');
const h1 = await evalJS(`(function(){
  var ps=document.querySelectorAll('.ch-body p');
  var p=null;
  for(var i=0;i<ps.length;i++){ if(ps[i].firstChild&&ps[i].firstChild.nodeType===3&&ps[i].firstChild.nodeValue.length>30){p=ps[i];break;} }
  if(!p) return {err:'no paragraph'};
  var r=document.createRange(); r.setStart(p.firstChild,0); r.setEnd(p.firstChild,24);
  var s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  return {text:r.toString()};
})()`);
await sleep(260);
const h2 = await evalJS(`(function(){
  var t=document.getElementById('seltool');
  var vis=t&&!t.hidden;
  var bx=vis?t.getBoundingClientRect():null;
  return {visible:!!vis, x:bx?Math.round(bx.left):0, y:bx?Math.round(bx.top):0,
          swatches:document.querySelectorAll('#seltool .swatch').length,
          hasCard:!!document.querySelector('#seltool [data-selact="card"]')};
})()`);
out.push('--- 划线与分享卡片 ---');
ok('选中文字弹出工具条', h2.visible && h2.swatches === 3 && h2.hasCard, '三色 + 生成卡片，位置 ' + h2.x + ',' + h2.y);

await evalJS("document.querySelector('#seltool .swatch--b').click()");
await sleep(320);
const h3 = await evalJS(`(function(){
  var st=JSON.parse(localStorage.getItem('hmm.state')||'{}');
  var m=document.querySelectorAll('mark.hl');
  var cs=m.length?getComputedStyle(m[0]):null;
  return {notes:(st.notes||[]).length, marks:m.length, text:((st.notes||[])[0]||{}).x,
          bg:cs?cs.backgroundColor:'', chapter:((st.notes||[])[0]||{}).c};
})()`);
ok('划线已保存并渲染', h3.notes === 1 && h3.marks >= 1 && !!h3.text, h3.notes + ' 条 · ' + h3.marks + ' 个 mark · 底色 ' + h3.bg);
ok('划线归属章节正确', h3.chapter === 'ch-11', h3.chapter);

await open('/ch-11.html');
const h4 = await evalJS(`(function(){
  var m=document.querySelectorAll('mark.hl--b');
  return {marks:m.length, txt:m.length?m[0].textContent.slice(0,18):''};
})()`);
ok('刷新后划线自动恢复', h4.marks >= 1, h4.marks + ' 个 · ' + h4.txt);

const h5 = await evalJS(`(function(){
  document.querySelector('[data-act="toc"]').click();
  document.querySelector('.dtab[data-tab="note"]').click();
  return {items:document.querySelectorAll('.dpane[data-pane="note"] .ni').length,
          hasCardBtn:!!document.querySelector('[data-ncard]')};
})()`);
ok('划线面板列出条目', h5.items === 1 && h5.hasCardBtn, h5.items + ' 条');

await evalJS("document.querySelector('[data-ncard]').click()");
await sleep(1400);
const h6 = await evalJS(`(function(){
  var open=document.body.classList.contains('is-card');
  var cv=document.getElementById('cardcv');
  if(!cv) return {open:open,err:'no canvas'};
  var x=cv.getContext('2d');
  var d=x.getImageData(0,0,cv.width,cv.height).data;
  var hist={},n=0;
  for(var i=0;i<d.length;i+=4*40){ var k=(d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4); hist[k]=(hist[k]||0)+1; n++; }
  var top=0; for(var k in hist) if(hist[k]>top) top=hist[k];
  return {open:open, w:cv.width, h:cv.height, colors:Object.keys(hist).length,
          inkPct:+((1-top/n)*100).toFixed(1)};
})()`);
ok('卡片工作台打开', h6.open);
ok('卡片已绘制内容', h6.colors > 6 && h6.inkPct > 3, h6.w + '×' + h6.h + ' · 色彩 ' + h6.colors + ' · 非底色像素 ' + h6.inkPct + '%');

const h7 = await evalJS(`(function(){
  document.querySelector('.seg[data-card] button[data-v="ink"]').click();
  var cv=document.getElementById('cardcv');
  var d=cv.getContext('2d').getImageData(4,4,1,1).data;
  return {r:d[0],g:d[1],b:d[2]};
})()`);
ok('卡片可切换夜色主题', h7.r < 60 && h7.g < 60, 'rgb(' + h7.r + ',' + h7.g + ',' + h7.b + ')');

const h8 = await evalJS(`new Promise(function(res){
  var cv=document.getElementById('cardcv');
  cv.toBlob(function(b){ res({ok:!!b, size:b?b.size:0, type:b?b.type:''}); },'image/png');
})`);
ok('卡片可导出 PNG', h8.ok && h8.size > 20000, (h8.size/1024).toFixed(0) + ' KB · ' + h8.type);

await evalJS("document.querySelector('[data-act=\"cardclose\"]').click()");
await sleep(200);
const h9 = await evalJS(`(function(){
  document.querySelector('[data-act="toc"]').click();
  document.querySelector('.dtab[data-tab="note"]').click();
  document.querySelector('[data-ndel]').click();
  var st=JSON.parse(localStorage.getItem('hmm.state')||'{}');
  return {notes:(st.notes||[]).length, marks:document.querySelectorAll('mark.hl').length};
})()`);
ok('划线可删除且正文还原', h9.notes === 0 && h9.marks === 0, '剩 ' + h9.notes + ' 条');
await evalJS("localStorage.removeItem('hmm.state')");

/* ---------- 续读 ---------- */
await open('/ch-09.html');
await evalJS('window.scrollTo(0,3000)');
await sleep(900);
await open('/ch-09.html');
const d = await evalJS(`(function(){return {y:Math.round(window.scrollY), toast:(document.getElementById('toast')||{}).textContent};})()`);
out.push('--- 续读 ---');
ok('重新进入自动回到上次位置', d.y > 1000, 'scrollY=' + d.y + ' 提示：' + (d.toast || ''));

/* ---------- 首页 ---------- */
await open('/index.html');
const e = await evalJS(`(function(){
  var r={};
  r.parts=document.querySelectorAll('.pc').length;
  r.chLinks=document.querySelectorAll('.pc__ch').length;
  r.stat=document.querySelectorAll('#statbar div').length;
  r.statTxt=(document.querySelector('#statbar')||{}).textContent.replace(/\s+/g,' ').trim().slice(0,80);
  r.resume=(document.getElementById('resumeBtn')||{}).textContent.replace(/\s+/g,' ').trim();
  r.marked=document.querySelectorAll('.st.done, .st.now').length;
  r.overflow=document.documentElement.scrollWidth>document.documentElement.clientWidth+1;
  return r;
})()`);
const cov = await evalJS(`(function(){
  var r={};
  var a=document.querySelector('.cover__art img');
  r.art=!!a; r.loaded=a?(a.complete&&a.naturalWidth>0):false;
  r.natural=a?(a.naturalWidth+'x'+a.naturalHeight):'';
  r.by=(document.querySelector('.cover__by')||{textContent:''}).textContent.replace(/\\s+/g,'').trim();
  var p=document.querySelector('a[href$=".pdf"]');
  r.pdf=p?decodeURIComponent(p.getAttribute('href')):'';
  r.dl=p?p.hasAttribute('download'):false;
  r.foot=(document.querySelector('.foot')||{textContent:''}).textContent.indexOf('俞孜扬')>=0;
  return r;
})()`);
out.push('--- 封面与署名 ---');
ok('封面插画已加载', cov.art && cov.loaded, cov.natural);
ok('作者署名', cov.by === '俞孜扬著', cov.by);
ok('PDF 文件名正确', cov.pdf === '钱是怎么跑起来的（How money moves）.pdf', cov.pdf);
ok('PDF 可下载', cov.dl);
ok('页脚含署名', cov.foot);

out.push('--- 首页 ---');
ok('五卷卡片', e.parts === 5, e.parts + ' 卷');
ok('29 个篇目入口', e.chLinks === 29, e.chLinks + ' 个');
ok('阅读统计条', e.stat === 5, e.statTxt);
ok('续读按钮已更新', /继续阅读|接着读/.test(e.resume), e.resume);
ok('章节读过状态回显', e.marked > 0, e.marked + ' 章有进度标记');
ok('首页无横向溢出', !e.overflow);

/* ---------- 卷首页 & 附录 ---------- */
await open('/part-3.html');
const f = await evalJS(`(function(){return {n:document.querySelectorAll('.clist__i').length, h1:(document.querySelector('h1')||{}).textContent.slice(0,20), len:(document.querySelector('.part-hero__len')||{}).textContent};})()`);
out.push('--- 卷首页 part-3 ---');
ok('本卷 6 章列表', f.n === 6, f.h1 + ' · ' + f.len);

await open('/glossary.html');
const g = await evalJS(`(function(){
  var r = {};
  r.terms = document.querySelectorAll('.gl__i').length;
  r.bad = [].filter.call(document.querySelectorAll('a[href]'), function(a){ return /level-\\d/.test(a.getAttribute('href')); }).length;
  r.chrome = !!document.querySelector('.rbar') && !!document.querySelector('#drawer') && !!document.querySelector('#prefs');
  r.oldShell = !!document.querySelector('.shell') || !!document.querySelector('.side');
  r.secLinks = document.querySelectorAll('.dpane[data-pane="sec"] .seci').length;
  // 每个小节锚点必须落在不同位置
  var ys = [].map.call(document.querySelectorAll('.dpane[data-pane="sec"] .seci'), function(a){
    var el = document.getElementById(a.getAttribute('href').slice(1));
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1;
  });
  r.ys = ys;
  r.uniqueY = new Set(ys).size;
  r.missing = ys.filter(function(y){ return y < 0; }).length;
  // 内容完整性：术语卡片不能被容器裁掉
  var grids = [].slice.call(document.querySelectorAll('.gl'));
  r.gridW = grids.length ? Math.round(grids[0].getBoundingClientRect().width) : 0;
  r.pageW = Math.round(document.querySelector('.page').getBoundingClientRect().width);
  r.clipped = [].filter.call(document.querySelectorAll('.gl__i'), function(e){
    return e.scrollHeight > e.clientHeight + 2 || e.getBoundingClientRect().right > document.documentElement.clientWidth + 1;
  }).length;
  r.overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  r.sections = document.querySelectorAll('.chapter').length;
  r.bars = document.querySelectorAll('.barfig__r').length;
  r.rows = document.querySelectorAll('.tbl tbody tr').length;
  r.rules = document.querySelectorAll('.flow__n').length;
  return r;
})()`);
out.push('--- 附录 ---');
ok('术语条目', g.terms === 46, g.terms + ' 条');
ok('旧外壳已移除', !g.oldShell);
ok('使用新阅读器外壳', g.chrome);
ok('小节导航 9 项', g.secLinks === 9, g.secLinks + ' 项');
ok('锚点全部存在且互不重叠', g.missing === 0 && g.uniqueY === g.secLinks, '纵坐标 ' + g.ys.join(', '));
ok('术语网格未被版心裁断', g.gridW > 700, '网格 ' + g.gridW + 'px / 版心 ' + g.pageW + 'px');
ok('无卡片内容被裁切', g.clipped === 0, g.clipped + ' 个被裁');
ok('附录页无横向溢出', !g.overflow);
ok('四个大节齐全', g.sections === 4, g.sections + ' 节');
ok('数据快照图表完整', g.bars === 4 && g.rows >= 10 && g.rules === 10, '条形 ' + g.bars + ' · 表格行 ' + g.rows + ' · 原则 ' + g.rules);
ok('附录内链已迁移到新结构', g.bad === 0);

const g2 = await evalJS(`(function(){
  document.querySelector('[data-act="toc"]').click();
  document.querySelector('.dtab[data-tab="sec"]').click();
  var a = document.querySelectorAll('.dpane[data-pane="sec"] .seci')[4];
  var target = a.getAttribute('href').slice(1);
  a.click();
  return { closed: !document.body.classList.contains('is-drawer'), target: target };
})()`);
await sleep(700);
const g3 = await evalJS("(function(){var el=document.getElementById('" + g2.target + "');return {y:Math.round(window.scrollY), elTop:Math.round(el.getBoundingClientRect().top)};})()");
ok('点击小节可跳转且抽屉自动关闭', g2.closed && Math.abs(g3.elTop) < 220, '目标 ' + g2.target + ' 滚动到 ' + g3.y + '，元素距顶 ' + g3.elTop + 'px');

const g4 = await evalJS(`(function(){
  document.querySelector('[data-act="prefs"]').click();
  document.querySelector('.seg[data-pref="size"] button[data-v="xl"]').click();
  var fs = parseFloat(getComputedStyle(document.querySelector('.gl__i p')).fontSize);
  document.querySelector('.seg[data-pref="size"] button[data-v="m"]').click();
  document.querySelector('[data-act="close"]').click();
  return fs;
})()`);
ok('附录页阅读设置生效', g4 >= 15, '大字号下术语说明 ' + g4 + 'px');

out.push('');
out.push(problems.length ? ('存在 ' + problems.length + ' 个问题：\n  - ' + problems.join('\n  - ')) : '全部通过');
console.log(out.join('\n'));

ws.close();
child.kill();
process.exit(problems.length ? 1 : 0);