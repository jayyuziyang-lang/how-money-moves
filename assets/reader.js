/* ============================================================================
   《钱是怎么跑起来的》阅读器
   偏好 / 进度 / 书签 / 目录 / 搜索 / 续读 / 键盘与手势
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, root = D.documentElement, body = D.body;
  var B = W.BOOK || { chapters: [], parts: [] };
  var CH = body.getAttribute('data-chapter');
  var IDX = -1;
  for (var i = 0; i < B.chapters.length; i++) if (B.chapters[i].id === CH) IDX = i;
  var CUR = IDX >= 0 ? B.chapters[IDX] : null;

  /* ---------------- 存储 ---------------- */
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var P = load('hmm.prefs', { theme: 'light', size: 'm', lh: 'normal', width: 'normal', font: 'sans' });
  var S = load('hmm.state', { progress: {}, marks: [], last: null });
  if (!S.progress) S.progress = {};
  if (!S.marks) S.marks = [];

  /* ---------------- 偏好 ---------------- */
  var PREFS = ['theme', 'size', 'lh', 'width', 'font'];
  function applyPrefs() {
    PREFS.forEach(function (k) {
      root.setAttribute('data-' + k, P[k]);
      var seg = D.querySelector('.seg[data-pref="' + k + '"]');
      if (!seg) return;
      [].forEach.call(seg.children, function (b) { b.classList.toggle('is-on', b.getAttribute('data-v') === P[k]); });
    });
    var m = D.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', P.theme === 'dark' ? '#0F1115' : P.theme === 'sepia' ? '#EFE6D4' : '#F4F2ED');
  }
  D.addEventListener('click', function (e) {
    var b = e.target.closest('.seg button');
    if (!b) return;
    P[b.parentNode.getAttribute('data-pref')] = b.getAttribute('data-v');
    save('hmm.prefs', P); applyPrefs();
  });

  /* ---------------- 面板开合 ---------------- */
  function closeAll() { body.classList.remove('is-open', 'is-drawer', 'is-prefs'); }
  function openDrawer(tab) {
    body.classList.add('is-open', 'is-drawer'); body.classList.remove('is-prefs');
    if (tab) switchTab(tab);
    if (tab === 'find') setTimeout(function () { var q = D.getElementById('q'); if (q) q.focus(); }, 300);
  }
  function openPrefs() { body.classList.add('is-open', 'is-prefs'); body.classList.remove('is-drawer'); }
  function switchTab(t) {
    [].forEach.call(D.querySelectorAll('.dtab'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-tab') === t); });
    [].forEach.call(D.querySelectorAll('.dpane'), function (p) { p.classList.toggle('is-on', p.getAttribute('data-pane') === t); });
    if (t === 'find') ensureSearch();
  }
  D.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a) {
      var act = a.getAttribute('data-act');
      if (act === 'toc') { body.classList.contains('is-drawer') ? closeAll() : openDrawer('toc'); }
      else if (act === 'find') { openDrawer('find'); }
      else if (act === 'prefs') { body.classList.contains('is-prefs') ? closeAll() : openPrefs(); }
      else if (act === 'mark') { toggleMark(); }
      else if (act === 'close') { closeAll(); }
      return;
    }
    var t = e.target.closest('.dtab');
    if (t) switchTab(t.getAttribute('data-tab'));
  });

  /* ---------------- 提示条 ---------------- */
  var toastEl = D.getElementById('toast'), toastTimer;
  function toast(msg, label, fn) {
    if (!toastEl) return;
    toastEl.innerHTML = '';
    toastEl.appendChild(D.createTextNode(msg));
    if (label) {
      var b = D.createElement('button'); b.textContent = label;
      b.onclick = function () { fn && fn(); hideToast(); };
      toastEl.appendChild(b);
    }
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, label ? 6000 : 2200);
  }
  function hideToast() { if (toastEl) toastEl.classList.remove('is-on'); }

  /* ---------------- 进度 ---------------- */
  var bar = D.querySelector('.progress'), pillTxt = D.getElementById('pillTxt');
  var lastY = 0, saveTimer = null;

  function docProgress() {
    var h = D.documentElement.scrollHeight - W.innerHeight;
    return h > 40 ? Math.min(1, Math.max(0, W.scrollY / h)) : (D.documentElement.scrollHeight > W.innerHeight ? 0 : 1);
  }
  function bookProgress() {
    var done = 0;
    B.chapters.forEach(function (c) {
      var r = S.progress[c.id];
      done += r ? (r.done ? c.words : c.words * Math.min(1, r.p || 0)) : 0;
    });
    return B.total ? done / B.total : 0;
  }
  function onScroll() {
    var p = docProgress();
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
    if (!CUR) return;
    if (pillTxt) pillTxt.textContent = '本章 ' + Math.round(p * 100) + '% · 全书 ' + Math.round(bookProgress() * 100) + '%';
    var y = W.scrollY;
    body.classList.toggle('pill-hide', y > lastY + 6 && y > 300);
    lastY = y;
    spySection();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var rec = S.progress[CUR.id] || {};
      rec.p = p; rec.y = W.scrollY; rec.t = Date.now();
      if (p > 0.985) rec.done = true;
      S.progress[CUR.id] = rec;
      S.last = { id: CUR.id, y: W.scrollY, p: p };
      save('hmm.state', S);
    }, 400);
  }

  /* ---------------- 小节高亮 ---------------- */
  var secEls = [], secLinks = [];
  function spySection() {
    if (!secEls.length) return;
    var y = W.scrollY + 120, k = 0;
    for (var i = 0; i < secEls.length; i++) if (secEls[i] && secEls[i].offsetTop <= y) k = i;
    secLinks.forEach(function (a, i) { a.classList.toggle('is-cur', i === k); });
  }

  /* ---------------- 书签 ---------------- */
  function topText() {
    var els = D.querySelectorAll('.ch-body p, .ch-body li, .ch-body h3');
    var y = W.scrollY + 90;
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (r.top + W.scrollY + r.height > y) return (els[i].textContent || '').trim().slice(0, 90);
    }
    return '';
  }
  function curSection() {
    var hs = D.querySelectorAll('.ch-body h3[id]');
    var y = W.scrollY + 120, id = '';
    for (var i = 0; i < hs.length; i++) if (hs[i].offsetTop <= y) id = hs[i].id;
    return id;
  }
  function markIndex() {
    for (var i = 0; i < S.marks.length; i++) if (S.marks[i].id === CH && Math.abs(S.marks[i].y - W.scrollY) < 240) return i;
    return -1;
  }
  function toggleMark() {
    if (!CUR) { openDrawer('mark'); return; }
    var k = markIndex();
    if (k >= 0) { S.marks.splice(k, 1); toast('已移除书签'); }
    else {
      S.marks.unshift({ id: CH, no: CUR.no, title: CUR.title, y: W.scrollY, p: docProgress(),
        sec: curSection(), text: topText(), time: Date.now() });
      if (S.marks.length > 60) S.marks.length = 60;
      toast('已加入书签 · 第 ' + CUR.no + ' 章 ' + Math.round(docProgress() * 100) + '%');
    }
    save('hmm.state', S); syncMarkBtn(); renderMarks();
  }
  function syncMarkBtn() {
    var b = D.querySelector('.rbtn--mark');
    if (b) b.classList.toggle('is-on', markIndex() >= 0);
  }

  /* ---------------- 渲染：目录 ---------------- */
  function pct(id) {
    var r = S.progress[id];
    if (!r) return '';
    if (r.done) return '已读';
    var v = Math.round((r.p || 0) * 100);
    return v >= 2 ? v + '%' : '';
  }
  function renderTOC() {
    var pane = D.querySelector('.dpane[data-pane="toc"]');
    if (!pane) return;
    var h = '';
    B.parts.forEach(function (p, pi) {
      h += '<div class="tocp"><div class="tocp__h">LEVEL ' + p.n + '<b>' + p.name + '：' + p.tag + '</b></div>';
      B.chapters.forEach(function (c) {
        if (c.part !== pi) return;
        var r = S.progress[c.id] || {};
        h += '<a class="toci' + (c.id === CH ? ' is-cur' : '') + (r.done ? ' is-done' : '') + '" href="' + c.file + '">' +
          '<i>' + c.no + '</i><span>' + c.title + '</span><em>' + pct(c.id) + '</em></a>';
      });
      h += '</div>';
    });
    h += '<div class="tocp"><div class="tocp__h">APPENDIX<b>附录</b></div>' +
      '<a class="toci" href="glossary.html"><i>A</i><span>术语速查 &amp; 2026 数据快照</span><em></em></a></div>';
    pane.innerHTML = h;
    var cur = pane.querySelector('.is-cur');
    if (cur) setTimeout(function () { cur.scrollIntoView({ block: 'center' }); }, 60);
  }

  /* ---------------- 渲染：本章小节 ---------------- */
  function renderSections() {
    var pane = D.querySelector('.dpane[data-pane="sec"]');
    if (!pane) return;
    if (!CUR || !CUR.sections || !CUR.sections.length) {
      pane.innerHTML = '<div class="find__n">本页没有小节</div>'; return;
    }
    pane.innerHTML = '<div class="find__n">第 ' + CUR.no + ' 章 · ' + CUR.sections.length + ' 节</div>' +
      CUR.sections.map(function (s) { return '<a class="seci" href="#' + s.id + '">' + s.title + '</a>'; }).join('');
    secLinks = [].slice.call(pane.querySelectorAll('.seci'));
    secEls = CUR.sections.map(function (s) { return D.getElementById(s.id); });
    spySection();
  }

  /* ---------------- 渲染：书签 ---------------- */
  function fmtTime(t) {
    var d = new Date(t), n = new Date(), dd = Math.floor((n - d) / 86400000);
    if (dd === 0) return '今天 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (dd === 1) return '昨天';
    if (dd < 30) return dd + ' 天前';
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }
  function markHTML(m, i) {
    return '<div class="bi"><button class="bi__x" data-del="' + i + '" title="删除">×</button>' +
      '<a href="' + m.id + '.html?y=' + Math.round(m.y) + '"><b>第 ' + m.no + ' 章 · ' + m.title + '</b>' +
      '<p>' + (m.text || '（无摘录）') + '</p>' +
      '<u>' + Math.round((m.p || 0) * 100) + '% · ' + fmtTime(m.time) + '</u></a></div>';
  }
  function renderMarks() {
    var pane = D.querySelector('.dpane[data-pane="mark"]');
    if (pane) {
      pane.innerHTML = S.marks.length
        ? '<div class="find__n">' + S.marks.length + ' 个书签</div>' + S.marks.map(markHTML).join('')
        : '<div class="find__n">还没有书签</div><p style="font-size:13px;color:var(--ink-3);line-height:1.8;padding:0 12px">' +
          '读到想记住的地方，点顶栏的书签图标（或按 <b>B</b>）就能收藏当前位置，下次从这里跳回来。</p>';
    }
    var home = D.getElementById('bmkHome');
    if (home) {
      home.innerHTML = S.marks.length
        ? '<div class="bmk__h"><h3>我的书签</h3><span class="kicker">' + S.marks.length + ' 个</span></div>' +
          '<div class="bmk__g">' + S.marks.slice(0, 6).map(markHTML).join('') + '</div>'
        : '';
    }
  }
  D.addEventListener('click', function (e) {
    var x = e.target.closest('[data-del]');
    if (!x) return;
    e.preventDefault();
    S.marks.splice(+x.getAttribute('data-del'), 1);
    save('hmm.state', S); renderMarks(); syncMarkBtn(); toast('已移除书签');
  });

  /* ---------------- 搜索 ---------------- */
  var searchReady = false, searchLoading = false;
  function ensureSearch() {
    if (searchReady || searchLoading) return;
    searchLoading = true;
    var s = D.createElement('script');
    s.src = 'assets/search.js';
    s.onload = function () { searchReady = true; searchLoading = false; runSearch(); };
    s.onerror = function () { searchLoading = false; var o = D.querySelector('.find__out'); if (o) o.innerHTML = '<div class="find__n">搜索索引加载失败</div>'; };
    D.head.appendChild(s);
  }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function hi(text, q) {
    var out = '', low = text.toLowerCase(), lq = q.toLowerCase(), i = 0;
    while (true) {
      var k = low.indexOf(lq, i);
      if (k < 0) { out += esc(text.slice(i)); break; }
      out += esc(text.slice(i, k)) + '<mark>' + esc(text.slice(k, k + q.length)) + '</mark>';
      i = k + q.length;
    }
    return out;
  }
  function runSearch() {
    var input = D.getElementById('q'), out = D.querySelector('.find__out');
    if (!input || !out) return;
    var q = input.value.trim();
    if (!q) { out.innerHTML = '<div class="find__n">输入关键词，搜索全书正文</div>'; return; }
    if (!searchReady) { out.innerHTML = '<div class="find__n">正在加载搜索索引…</div>'; ensureSearch(); return; }
    var data = W.SEARCH_DATA || [], res = [], lq = q.toLowerCase();
    for (var i = 0; i < data.length; i++) {
      var c = data[i];
      if (c.title.toLowerCase().indexOf(lq) >= 0) res.push({ c: c, t: c.title, a: '', w: 3 });
      for (var j = 0; j < c.b.length && res.length < 400; j++) {
        if (c.b[j][0].toLowerCase().indexOf(lq) >= 0) res.push({ c: c, t: c.b[j][0], a: c.b[j][1], w: 1 });
      }
    }
    res.sort(function (a, b) { return b.w - a.w; });
    if (!res.length) { out.innerHTML = '<div class="find__n">没有找到「' + esc(q) + '」</div>'; return; }
    out.innerHTML = '<div class="find__n">找到 ' + res.length + ' 处</div>' + res.slice(0, 60).map(function (r) {
      return '<a class="fi" href="' + r.c.id + '.html' + (r.a ? '#' + r.a : '') + '">' +
        '<b>第 ' + r.c.no + ' 章 · ' + esc(r.c.title) + '</b><p>' + hi(r.t, q) + '</p></a>';
    }).join('');
  }
  var qEl = D.getElementById('q');
  if (qEl) {
    var st;
    qEl.addEventListener('input', function () { clearTimeout(st); st = setTimeout(runSearch, 160); });
    qEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
  }

  /* ---------------- 首页 / 卷首页 ---------------- */
  function renderStatus() {
    [].forEach.call(D.querySelectorAll('[data-ch]'), function (a) {
      var el = a.querySelector('.st'); if (!el) return;
      var r = S.progress[a.getAttribute('data-ch')];
      el.className = 'st';
      if (!r) { el.textContent = ''; return; }
      if (r.done) { el.textContent = '已读'; el.classList.add('done'); }
      else if ((r.p || 0) > 0.02) { el.textContent = Math.round(r.p * 100) + '%'; el.classList.add('now'); }
      else el.textContent = '';
    });
  }
  function renderHome() {
    var btn = D.getElementById('resumeBtn');
    if (btn && S.last) {
      var c = null;
      B.chapters.forEach(function (x) { if (x.id === S.last.id) c = x; });
      if (c) {
        var done = (S.progress[c.id] || {}).done;
        var nx = done && B.chapters[B.chapters.indexOf(c) + 1] ? B.chapters[B.chapters.indexOf(c) + 1] : c;
        btn.href = nx.file + (nx === c && S.last.y > 200 ? '?y=' + Math.round(S.last.y) : '');
        btn.innerHTML = '<span class="kicker">' + (nx === c ? '继续阅读 · ' + Math.round((S.last.p || 0) * 100) + '%' : '接着读下一章') + '</span>' +
          '<b>第 ' + nx.no + ' 章 · ' + nx.title + '</b>';
      }
    }
    var sb = D.getElementById('statbar');
    if (sb) {
      var readCount = 0, started = 0;
      B.chapters.forEach(function (c) { var r = S.progress[c.id]; if (r && r.done) readCount++; else if (r && (r.p || 0) > 0.02) started++; });
      var bp = bookProgress();
      var leftMin = Math.round(B.total * (1 - bp) / 400);
      sb.innerHTML =
        '<div><b>' + readCount + '<i>/' + B.chapters.length + '</i></b><span>已读完的篇目</span><span class="bar"><i style="width:' + (readCount / B.chapters.length * 100) + '%"></i></span></div>' +
        '<div><b>' + Math.round(bp * 100) + '<i>%</i></b><span>全书阅读进度</span><span class="bar"><i style="width:' + (bp * 100) + '%"></i></span></div>' +
        '<div><b>' + S.marks.length + '</b><span>书签</span></div>' +
        '<div><b>' + (leftMin >= 60 ? (leftMin / 60).toFixed(1) + '<i>小时</i>' : leftMin + '<i>分钟</i>') + '</b><span>预计还需</span></div>';
    }
  }

  /* ---------------- 位置恢复 ---------------- */
  function restore() {
    if (!CUR) return;
    var m = location.search.match(/[?&]y=(\d+)/);
    if (m) {
      W.scrollTo(0, +m[1]);
      history.replaceState(null, '', location.pathname + location.hash);
      toast('已跳到书签位置');
      return;
    }
    if (location.hash) return;
    var r = S.progress[CH];
    if (r && !r.done && r.y > 400) {
      W.scrollTo(0, r.y);
      toast('已回到上次读到的位置（' + Math.round((r.p || 0) * 100) + '%）', '从头开始', function () { W.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
  }

  /* ---------------- 键盘 ---------------- */
  function go(d) {
    if (IDX < 0) return;
    var n = B.chapters[IDX + d];
    if (n) location.href = n.file;
    else if (d > 0) location.href = 'glossary.html';
  }
  D.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Escape') { e.target.blur(); closeAll(); } return; }
    var k = e.key.toLowerCase();
    if (e.key === 'Escape') { closeAll(); hideToast(); return; }
    if (e.key === 'ArrowLeft') { go(-1); return; }
    if (e.key === 'ArrowRight') { go(1); return; }
    if (k === 't') { e.preventDefault(); body.classList.contains('is-drawer') ? closeAll() : openDrawer('toc'); }
    else if (k === 'b') { e.preventDefault(); toggleMark(); }
    else if (k === 'f') { e.preventDefault(); openDrawer('find'); }
    else if (k === 's') { e.preventDefault(); body.classList.contains('is-prefs') ? closeAll() : openPrefs(); }
    else if (k === 'j') { W.scrollBy({ top: W.innerHeight * 0.85, behavior: 'smooth' }); }
    else if (k === 'k') { W.scrollBy({ top: -W.innerHeight * 0.85, behavior: 'smooth' }); }
  });

  /* ---------------- 手势 ---------------- */
  var tx = 0, ty = 0, tt = 0;
  D.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now();
  }, { passive: true });
  D.addEventListener('touchend', function (e) {
    if (!CUR || body.classList.contains('is-open')) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - tx, dy = t.clientY - ty;
    if (Date.now() - tt > 600) return;
    if (Math.abs(dx) < 90 || Math.abs(dy) > 60) return;
    go(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ---------------- 启动 ---------------- */
  applyPrefs();
  renderTOC(); renderSections(); renderMarks(); renderStatus(); renderHome();
  syncMarkBtn();
  if (CUR) {
    restore();
    W.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); }
    }, { passive: true });
    var ticking = false;
    onScroll();
    setInterval(syncMarkBtn, 1200);
  } else if (bar) {
    W.addEventListener('scroll', function () {
      bar.style.width = (docProgress() * 100).toFixed(2) + '%';
    }, { passive: true });
  }
})();