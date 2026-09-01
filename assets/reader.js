/* ============================================================================
   《钱是怎么跑起来的》阅读器
   偏好 / 进度 / 书签 / 划线 / 分享卡片 / 目录 / 搜索 / 续读 / 键盘与手势
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, root = D.documentElement, body = D.body;
  var B = W.BOOK || { chapters: [], parts: [] };
  var CH = body.getAttribute('data-chapter');
  var IDX = -1;
  for (var i = 0; i < B.chapters.length; i++) if (B.chapters[i].id === CH) IDX = i;
  var CUR = IDX >= 0 ? B.chapters[IDX] : null;
  var IS_AP = body.classList.contains('is-appendix');
  var PAGEKEY = CH || (IS_AP ? 'appendix' : null);
  var PAGENAME = CUR ? ('第 ' + CUR.no + ' 章 · ' + CUR.title) : (IS_AP ? '附录 · 术语速查与数据快照' : '');

  /* ---------------- 存储 ---------------- */
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var P = load('hmm.prefs', { theme: 'light', size: 'm', lh: 'normal', width: 'normal', font: 'sans' });
  var S = load('hmm.state', { progress: {}, marks: [], notes: [] });
  if (!S.progress) S.progress = {};
  if (!S.marks) S.marks = [];
  if (!S.notes) S.notes = [];

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
    var b = e.target.closest('.seg[data-pref] button');
    if (!b) return;
    P[b.parentNode.getAttribute('data-pref')] = b.getAttribute('data-v');
    save('hmm.prefs', P); applyPrefs();
  });

  /* ---------------- 面板 ---------------- */
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
      else if (act === 'cardclose') { closeCard(); }
      return;
    }
    var t = e.target.closest('.dtab');
    if (t) { switchTab(t.getAttribute('data-tab')); return; }
    if (e.target.closest('#drawer a')) closeAll();
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

  /* ============================================================
     划线高亮
     ============================================================ */
  var HLC = { a: '蓝', b: '褐', c: '青' };
  function bodyEl() { return D.querySelector('.ch-body'); }
  function walkText(rt) {
    var out = [], w = D.createTreeWalker(rt, NodeFilter.SHOW_TEXT, null);
    var n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function selInfo() {
    var rt = bodyEl(); if (!rt) return null;
    var sel = W.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    var r = sel.getRangeAt(0);
    if (!rt.contains(r.commonAncestorContainer)) return null;
    var txt = r.toString().replace(/\s+/g, ' ').trim();
    if (txt.length < 2) return null;
    var pre = D.createRange();
    pre.selectNodeContents(rt);
    pre.setEnd(r.startContainer, r.startOffset);
    var start = pre.toString().length;
    var end = start + r.toString().length;
    return { start: start, end: end, text: txt, rect: r.getBoundingClientRect() };
  }
  function wrapRange(rt, start, end, cls, key) {
    var nodes = walkText(rt), pos = 0, segs = [];
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i], len = t.nodeValue.length;
      var a = Math.max(start, pos), b = Math.min(end, pos + len);
      if (b > a) segs.push([t, a - pos, b - pos]);
      pos += len;
      if (pos >= end) break;
    }
    for (var j = segs.length - 1; j >= 0; j--) {
      var it = segs[j];
      if (it[0].parentNode && it[0].parentNode.closest && it[0].parentNode.closest('mark[data-hl]')) continue;
      var rg = D.createRange();
      try { rg.setStart(it[0], it[1]); rg.setEnd(it[0], it[2]); } catch (e) { continue; }
      var m = D.createElement('mark');
      m.className = cls; m.setAttribute('data-hl', key);
      try { rg.surroundContents(m); } catch (e) {}
    }
  }
  function applyNotes() {
    var rt = bodyEl(); if (!rt || !PAGEKEY) return;
    S.notes.filter(function (n) { return n.c === PAGEKEY; })
      .sort(function (x, y) { return y.s - x.s; })
      .forEach(function (n) { wrapRange(rt, n.s, n.e, 'hl hl--' + n.k, String(n.ts)); });
  }
  function unwrapNote(key) {
    var rt = bodyEl(); if (!rt) return;
    [].forEach.call(rt.querySelectorAll('mark[data-hl="' + key + '"]'), function (m) {
      var pa = m.parentNode;
      while (m.firstChild) pa.insertBefore(m.firstChild, m);
      pa.removeChild(m);
      pa.normalize();
    });
  }
  function addNote(colorKey) {
    var info = selInfo();
    if (!info || !PAGEKEY) { toast('请先选中一段文字'); return; }
    var n = { c: PAGEKEY, no: CUR ? CUR.no : 'A', t: CUR ? CUR.title : '附录',
      s: info.start, e: info.end, x: info.text, k: colorKey, ts: Date.now() };
    S.notes.unshift(n);
    if (S.notes.length > 400) S.notes.length = 400;
    save('hmm.state', S);
    wrapRange(bodyEl(), n.s, n.e, 'hl hl--' + n.k, String(n.ts));
    W.getSelection().removeAllRanges();
    hideSelTool();
    renderNotes();
    toast('已划线');
  }
  function removeNote(key) {
    var k = -1;
    for (var i = 0; i < S.notes.length; i++) if (String(S.notes[i].ts) === String(key)) k = i;
    if (k < 0) return;
    S.notes.splice(k, 1);
    save('hmm.state', S);
    unwrapNote(key);
    hideSelTool();
    renderNotes();
    toast('已删除划线');
  }
  function noteHTML(n, i) {
    var lbl = (n.no === 'A' ? '附录' : '第 ' + n.no + ' 章') + ' · ' + n.t;
    return '<div class="ni ni--' + n.k + '">' +
      '<button class="bi__x" data-ndel="' + n.ts + '" title="删除">×</button>' +
      '<a href="' + (n.c === 'appendix' ? 'glossary.html' : n.c + '.html') + '?hl=' + n.ts + '">' +
      '<b>' + lbl + '</b><p>' + esc(n.x) + '</p></a>' +
      '<div class="ni__act"><button data-ncard="' + n.ts + '">生成卡片</button>' +
      '<button data-ncopy="' + n.ts + '">复制</button>' +
      '<u>' + fmtTime(n.ts) + '</u></div></div>';
  }
  function renderNotes() {
    var pane = D.querySelector('.dpane[data-pane="note"]');
    if (pane) {
      var mine = S.notes;
      pane.innerHTML = mine.length
        ? '<div class="find__n">' + mine.length + ' 条划线</div>' + mine.map(noteHTML).join('')
        : '<div class="find__n">还没有划线</div><p style="font-size:13px;color:var(--ink-3);line-height:1.8;padding:0 12px">' +
          '在正文里选中一段文字，会弹出工具条：选颜色即可划线，也可以直接生成一张分享卡片。快捷键 <b>H</b> 划线。</p>';
    }
    var home = D.getElementById('noteHome');
    if (home) {
      home.innerHTML = S.notes.length
        ? '<div class="bmk__h"><h3>我的划线</h3><span class="kicker">' + S.notes.length + ' 条</span></div>' +
          '<div class="bmk__g">' + S.notes.slice(0, 6).map(noteHTML).join('') + '</div>'
        : '';
    }
  }

  /* ---------------- 选区工具条 ---------------- */
  var selTool = D.getElementById('seltool');
  var selCtx = null;
  function showSelTool(rect, existKey, text) {
    if (!selTool) return;
    selCtx = { key: existKey || null, text: text || '' };
    selTool.hidden = false;
    var del = selTool.querySelector('[data-selact="del"]');
    if (del) del.hidden = !existKey;
    [].forEach.call(selTool.querySelectorAll('.swatch'), function (s) { s.hidden = !!existKey; });
    var sep = selTool.querySelector('.seltool__sep');
    if (sep) sep.hidden = !!existKey;
    var w = selTool.offsetWidth || 300, h = selTool.offsetHeight || 42;
    var x = rect.left + rect.width / 2 - w / 2;
    var y = rect.top - h - 12;
    if (y < 62) y = rect.bottom + 12;
    x = Math.max(10, Math.min(x, W.innerWidth - w - 10));
    selTool.style.left = Math.round(x) + 'px';
    selTool.style.top = Math.round(y) + 'px';
  }
  function hideSelTool() { if (selTool) { selTool.hidden = true; selCtx = null; } }

  function onSelectEnd(e) {
    if (e && e.target && e.target.closest && e.target.closest('#seltool')) return;
    var hit = e && e.target && e.target.closest ? e.target.closest('mark[data-hl]') : null;
    if (hit) {
      showSelTool(hit.getBoundingClientRect(), hit.getAttribute('data-hl'),
        (function (k) { for (var i = 0; i < S.notes.length; i++) if (String(S.notes[i].ts) === String(k)) return S.notes[i].x; return hit.textContent; })(hit.getAttribute('data-hl')));
      return;
    }
    var info = selInfo();
    if (info) showSelTool(info.rect, null, info.text); else hideSelTool();
  }
  D.addEventListener('mouseup', function (e) { setTimeout(function () { onSelectEnd(e); }, 10); });
  D.addEventListener('touchend', function (e) { setTimeout(function () { onSelectEnd(e); }, 60); });
  W.addEventListener('scroll', function () { if (selTool && !selTool.hidden) hideSelTool(); }, { passive: true });

  D.addEventListener('click', function (e) {
    var sw = e.target.closest('.swatch');
    if (sw) { e.preventDefault(); addNote(sw.getAttribute('data-hl')); return; }
    var sa = e.target.closest('[data-selact]');
    if (sa) {
      e.preventDefault();
      var act = sa.getAttribute('data-selact');
      if (act === 'del' && selCtx && selCtx.key) removeNote(selCtx.key);
      else if (act === 'copy' && selCtx) {
        copyText(selCtx.text + '\n\n——《钱是怎么跑起来的》' + (PAGENAME ? ' ' + PAGENAME : ''));
        hideSelTool();
      } else if (act === 'card' && selCtx) {
        openCard(selCtx.text, PAGENAME);
        hideSelTool();
      }
      return;
    }
    var nd = e.target.closest('[data-ndel]');
    if (nd) { e.preventDefault(); removeNote(nd.getAttribute('data-ndel')); return; }
    var nc = e.target.closest('[data-ncard]');
    if (nc) {
      e.preventDefault();
      var n1 = findNote(nc.getAttribute('data-ncard'));
      if (n1) openCard(n1.x, (n1.no === 'A' ? '附录' : '第 ' + n1.no + ' 章') + ' · ' + n1.t);
      return;
    }
    var np = e.target.closest('[data-ncopy]');
    if (np) {
      e.preventDefault();
      var n2 = findNote(np.getAttribute('data-ncopy'));
      if (n2) copyText(n2.x + '\n\n——《钱是怎么跑起来的》第 ' + n2.no + ' 章 ' + n2.t);
      return;
    }
    var bx = e.target.closest('[data-del]');
    if (bx) { e.preventDefault(); S.marks.splice(+bx.getAttribute('data-del'), 1); save('hmm.state', S); renderMarks(); syncMarkBtn(); toast('已移除书签'); }
  });
  function findNote(k) { for (var i = 0; i < S.notes.length; i++) if (String(S.notes[i].ts) === String(k)) return S.notes[i]; return null; }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('已复制'); }, function () { toast('复制失败'); });
    } else {
      var ta = D.createElement('textarea'); ta.value = t; D.body.appendChild(ta); ta.select();
      try { D.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败'); }
      D.body.removeChild(ta);
    }
  }

  /* ============================================================
     分享卡片
     ============================================================ */
  var CARD = { text: '', from: '', theme: 'paper' };
  var COVER = null;
  function loadCover(cb) {
    if (COVER !== null) { cb(COVER); return; }
    var im = new Image();
    im.onload = function () { COVER = im; cb(im); };
    im.onerror = function () { COVER = false; cb(false); };
    im.src = 'assets/cover-web.jpg';
  }
  var NOBREAK = '，。、；：？！）》」』】%…·';
  function wrapCJK(x, text, maxW) {
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      var t = cur + ch;
      if (cur && x.measureText(t).width > maxW) {
        if (NOBREAK.indexOf(ch) >= 0) { lines.push(t); cur = ''; }
        else { lines.push(cur); cur = ch; }
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function openCard(text, from) {
    CARD.text = text; CARD.from = from || PAGENAME;
    var wrap = D.getElementById('cardwrap');
    if (!wrap) return;
    wrap.setAttribute('aria-hidden', 'false');
    body.classList.add('is-card');
    [].forEach.call(D.querySelectorAll('.seg[data-card] button'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-v') === CARD.theme);
    });
    var sh = D.querySelector('[data-cardact="share"]');
    if (sh && navigator.canShare) sh.hidden = false;
    loadCover(function () { drawCard(); });
  }
  function closeCard() {
    var wrap = D.getElementById('cardwrap');
    if (wrap) wrap.setAttribute('aria-hidden', 'true');
    body.classList.remove('is-card');
  }
  D.addEventListener('click', function (e) {
    var t = e.target.closest('.seg[data-card] button');
    if (t) { CARD.theme = t.getAttribute('data-v');
      [].forEach.call(t.parentNode.children, function (b) { b.classList.toggle('is-on', b === t); });
      drawCard(); return; }
    if (e.target.id === 'cardwrap') closeCard();
  });
  function drawCard() {
    var cv = D.getElementById('cardcv');
    if (!cv) return;
    var W0 = 1080, PAD = 96;
    var dark = CARD.theme === 'ink';
    var bg = dark ? '#14171C' : '#F6F2E9';
    var ink = dark ? '#EEEBE5' : '#16181D';
    var sub = dark ? '#98A0AA' : '#5A5F68';
    var acc = dark ? '#8FAEEC' : '#23407A';
    var line = dark ? 'rgba(255,255,255,.13)' : 'rgba(20,22,28,.13)';
    var SER = '"Songti SC","Source Han Serif SC","Noto Serif SC","STSong",Georgia,serif';
    var SAN = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",-apple-system,sans-serif';

    var quote = CARD.text.replace(/\s+/g, ' ').trim();
    if (quote.length > 190) quote = quote.slice(0, 188) + '…';

    var x = cv.getContext('2d');
    x.font = '500 44px ' + SER;
    var lines = wrapCJK(x, quote, W0 - PAD * 2);
    var LH = 76;
    var top = PAD + 26 + 18 + 44 + 54;
    var qh = lines.length * LH;
    var afterQ = 52 + 34 + 40;
    var footH = 1 + 40 + 120;
    var H0 = Math.max(1080, Math.min(1620, top + qh + afterQ + footH + PAD));

    cv.width = W0; cv.height = H0;
    x = cv.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, W0, H0);

    // 顶部标签
    var y = PAD + 20;
    x.fillStyle = sub; x.font = '600 22px ' + SAN;
    x.fillText('摘自', PAD, y);
    x.fillStyle = acc; x.fillRect(PAD, y + 22, 72, 4);

    // 大引号
    y += 22 + 54;
    x.fillStyle = acc; x.globalAlpha = 0.16;
    x.font = '700 130px Georgia, serif';
    x.fillText('“', PAD - 12, y + 46);
    x.globalAlpha = 1;

    // 正文
    x.fillStyle = ink; x.font = '500 44px ' + SER;
    for (var i = 0; i < lines.length; i++) x.fillText(lines[i], PAD, y + 44 + i * LH);
    y = y + 44 + lines.length * LH;

    // 出处
    y += 52;
    x.fillStyle = acc; x.fillRect(PAD, y - 22, 40, 3);
    x.fillStyle = sub; x.font = '500 26px ' + SAN;
    x.fillText(CARD.from, PAD + 58, y - 13);

    // 页脚
    var fy = H0 - PAD - 96;
    x.strokeStyle = line; x.lineWidth = 1;
    x.beginPath(); x.moveTo(PAD, fy); x.lineTo(W0 - PAD, fy); x.stroke();

    var tw = 0;
    if (COVER) {
      var th = 116, twi = Math.round(th * COVER.naturalWidth / COVER.naturalHeight);
      tw = twi + 26;
      x.save();
      x.shadowColor = 'rgba(0,0,0,.22)'; x.shadowBlur = 16; x.shadowOffsetX = 4; x.shadowOffsetY = 6;
      x.drawImage(COVER, W0 - PAD - twi, fy + 32, twi, th);
      x.restore();
    }
    x.fillStyle = ink; x.font = '600 30px ' + SAN;
    x.fillText('钱是怎么跑起来的', PAD, fy + 66);
    x.fillStyle = sub; x.font = '400 22px ' + SAN;
    x.fillText('一本从零开始的金融世界说明书 · 俞孜扬 著', PAD, fy + 104);
    x.fillStyle = dark ? '#6F7883' : '#8B9098'; x.font = '400 19px ' + SAN;
    x.fillText('jayyuziyang-lang.github.io/how-money-moves', PAD, fy + 138);
  }
  function cardBlob(cb) {
    var cv = D.getElementById('cardcv');
    if (!cv) return;
    if (cv.toBlob) cv.toBlob(function (b) { cb(b); }, 'image/png');
    else cb(null);
  }
  D.addEventListener('click', function (e) {
    var a = e.target.closest('[data-cardact]');
    if (!a) return;
    var act = a.getAttribute('data-cardact');
    var name = '钱是怎么跑起来的-' + (CARD.from || '摘录').replace(/[\\/:*?"<>|·\s]+/g, '') + '.png';
    if (act === 'save') {
      cardBlob(function (b) {
        if (!b) { toast('导出失败'); return; }
        var u = URL.createObjectURL(b), l = D.createElement('a');
        l.href = u; l.download = name; D.body.appendChild(l); l.click(); D.body.removeChild(l);
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
        toast('已下载卡片');
      });
    } else if (act === 'copy') {
      cardBlob(function (b) {
        if (!b || !W.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) { toast('当前浏览器不支持复制图片，请用下载'); return; }
        navigator.clipboard.write([new W.ClipboardItem({ 'image/png': b })])
          .then(function () { toast('卡片已复制到剪贴板'); }, function () { toast('复制失败，请用下载'); });
      });
    } else if (act === 'share') {
      cardBlob(function (b) {
        if (!b) return;
        var f = new File([b], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: '钱是怎么跑起来的' });
        else toast('当前环境不支持系统分享');
      });
    }
  });

  /* ---------------- 目录 ---------------- */
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
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
    var onAp = body.classList.contains('is-appendix');
    h += '<div class="tocp"><div class="tocp__h">APPENDIX<b>附录</b></div>' +
      '<a class="toci' + (onAp ? ' is-cur' : '') + '" href="glossary.html"><i>A</i>' +
      '<span>术语速查 &amp; 2026 数据快照</span><em></em></a></div>';
    pane.innerHTML = h;
    var cur = pane.querySelector('.is-cur');
    if (cur) setTimeout(function () { cur.scrollIntoView({ block: 'center' }); }, 60);
  }
  function renderSections() {
    var pane = D.querySelector('.dpane[data-pane="sec"]');
    if (!pane) return;
    var secs = (CUR && CUR.sections && CUR.sections.length) ? CUR.sections : (W.PAGE_SECTIONS || []);
    if (!secs.length) { pane.innerHTML = '<div class="find__n">本页没有小节</div>'; return; }
    var head = CUR ? ('第 ' + CUR.no + ' 章 · ' + secs.length + ' 节') : ('本页 ' + secs.length + ' 节');
    pane.innerHTML = '<div class="find__n">' + head + '</div>' +
      secs.map(function (s) {
        return '<a class="seci' + (s.lv === 2 ? ' seci--sub' : '') + '" href="#' + s.id + '">' + s.title + '</a>';
      }).join('');
    secLinks = [].slice.call(pane.querySelectorAll('.seci'));
    secEls = secs.map(function (s) { return D.getElementById(s.id); });
    spySection();
  }
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
          '读到想记住的地方，点顶栏的书签图标（或按 <b>B</b>）就能收藏当前位置。</p>';
    }
    var home = D.getElementById('bmkHome');
    if (home) {
      home.innerHTML = S.marks.length
        ? '<div class="bmk__h"><h3>我的书签</h3><span class="kicker">' + S.marks.length + ' 个</span></div>' +
          '<div class="bmk__g">' + S.marks.slice(0, 6).map(markHTML).join('') + '</div>'
        : '';
    }
  }

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

  /* ---------------- 首页 ---------------- */
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
      var readCount = 0;
      B.chapters.forEach(function (c) { var r = S.progress[c.id]; if (r && r.done) readCount++; });
      var bp = bookProgress();
      var leftMin = Math.round(B.total * (1 - bp) / 400);
      sb.innerHTML =
        '<div><b>' + readCount + '<i>/' + B.chapters.length + '</i></b><span>已读完的篇目</span><span class="bar"><i style="width:' + (readCount / B.chapters.length * 100) + '%"></i></span></div>' +
        '<div><b>' + Math.round(bp * 100) + '<i>%</i></b><span>全书阅读进度</span><span class="bar"><i style="width:' + (bp * 100) + '%"></i></span></div>' +
        '<div><b>' + S.notes.length + '</b><span>划线</span></div>' +
        '<div><b>' + S.marks.length + '</b><span>书签</span></div>' +
        '<div><b>' + (leftMin >= 60 ? (leftMin / 60).toFixed(1) + '<i>小时</i>' : leftMin + '<i>分钟</i>') + '</b><span>预计还需</span></div>';
    }
  }

  /* ---------------- 位置恢复 ---------------- */
  function restore() {
    var hlm = location.search.match(/[?&]hl=(\d+)/);
    if (hlm) {
      history.replaceState(null, '', location.pathname);
      var el = D.querySelector('mark[data-hl="' + hlm[1] + '"]');
      if (el) {
        W.scrollTo(0, el.getBoundingClientRect().top + W.scrollY - W.innerHeight / 3);
        el.classList.add('hl--flash');
        setTimeout(function () { el.classList.remove('hl--flash'); }, 2400);
        return;
      }
    }
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
    if (e.key === 'Escape') { closeAll(); closeCard(); hideSelTool(); hideToast(); return; }
    if (body.classList.contains('is-card')) return;
    if (e.key === 'ArrowLeft') { go(-1); return; }
    if (e.key === 'ArrowRight') { go(1); return; }
    if (k === 't') { e.preventDefault(); body.classList.contains('is-drawer') ? closeAll() : openDrawer('toc'); }
    else if (k === 'b') { e.preventDefault(); toggleMark(); }
    else if (k === 'h') { e.preventDefault(); if (selInfo()) addNote('a'); else openDrawer('note'); }
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
    if (!CUR || body.classList.contains('is-open') || body.classList.contains('is-card')) return;
    if (selTool && !selTool.hidden) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - tx, dy = t.clientY - ty;
    if (Date.now() - tt > 600) return;
    if (Math.abs(dx) < 90 || Math.abs(dy) > 60) return;
    go(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ---------------- 启动 ---------------- */
  applyPrefs();
  applyNotes();
  renderTOC(); renderSections(); renderMarks(); renderNotes(); renderStatus(); renderHome();
  syncMarkBtn();
  var ticking = false;
  if (CUR) {
    restore();
    W.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); }
    }, { passive: true });
    onScroll();
    setInterval(syncMarkBtn, 1200);
  } else {
    restore();
    W.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (bar) bar.style.width = (docProgress() * 100).toFixed(2) + '%';
        spySection();
      });
    }, { passive: true });
    spySection();
  }
})();
