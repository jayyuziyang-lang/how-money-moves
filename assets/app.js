/* 《钱是怎么跑起来的》—— 阅读器交互 */
(function () {
  'use strict';
  var d = document, root = d.documentElement, LS = window.localStorage;

  /* ---------- 主题 / 字号 ---------- */
  function apply(k, v) {
    root.setAttribute('data-' + k, v);
    try { LS.setItem('mm.' + k, v); } catch (e) {}
    d.querySelectorAll('[data-set="' + k + '"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-val') === v));
    });
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set]');
    if (!b) return;
    var k = b.getAttribute('data-set');
    if (k === 'theme' && b.getAttribute('data-val') === 'toggle') {
      apply('theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    } else {
      apply(k, b.getAttribute('data-val'));
    }
  });
  apply('theme', root.getAttribute('data-theme') || 'light');
  apply('size', (function () { try { return LS.getItem('mm.size') || 'm'; } catch (e) { return 'm'; } })());

  /* ---------- 进度条 ---------- */
  var bar = d.querySelector('.progress');
  var side = d.querySelector('.side');
  var links = [].slice.call(d.querySelectorAll('.side a[href^="#"]'));
  var mid = d.querySelector('.topbar__mid');
  var targets = links.map(function (a) { return d.getElementById(a.getAttribute('href').slice(1)); });
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (bar) {
        var h = d.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + '%';
      }
      if (!targets.length) return;
      var best = 0, y = window.scrollY + 140;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && targets[i].offsetTop <= y) best = i;
      }
      links.forEach(function (a, i) { a.classList.toggle('is-active', i === best); });
      if (mid && links[best]) {
        var t = links[best].querySelector('span');
        mid.textContent = t ? t.textContent : '';
      }
      var act = links[best];
      if (act && side && window.innerWidth > 900) {
        var r = act.getBoundingClientRect(), s = side.getBoundingClientRect();
        if (r.top < s.top + 8 || r.bottom > s.bottom - 8) {
          side.scrollTop += (r.top - s.top) - s.height / 2 + r.height / 2;
        }
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- 移动端目录 ---------- */
  var tg = d.querySelector('.side__toggle');
  if (tg && side) {
    tg.addEventListener('click', function () {
      side.classList.toggle('open');
      tg.querySelector('i').textContent = side.classList.contains('open') ? 'CLOSE' : 'MENU';
    });
    side.addEventListener('click', function (e) {
      if (e.target.closest('a') && window.innerWidth <= 900) {
        side.classList.remove('open');
        tg.querySelector('i').textContent = 'MENU';
      }
    });
  }

  /* ---------- 键盘：J / K 跳章 ---------- */
  d.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    var k = e.key.toLowerCase();
    if (k !== 'j' && k !== 'k') return;
    var cur = links.findIndex(function (a) { return a.classList.contains('is-active'); });
    var nx = k === 'j' ? cur + 1 : cur - 1;
    if (nx >= 0 && nx < targets.length && targets[nx]) {
      targets[nx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();
