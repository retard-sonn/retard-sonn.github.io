/* ══════════════════════════════════════════════════════════════════════════
   CLEARANCE — abraar.me
   Rules this file obeys:
     · JS never creates a fact. Every fact is already in the HTML.
     · Exactly one rAF loop, queue-driven, self-parking. One producer.
     · Only transform and opacity are animated from script.
     · Every interaction stays completable under reduced motion and keyboard.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── one rAF, self-parking ─────────────────────────────────────────── */
  var queue = new Set(), rafId = null;
  function tick() {
    rafId = null;
    var dead = [];
    queue.forEach(function (fn) { if (fn() === false) dead.push(fn); });
    dead.forEach(function (fn) { queue.delete(fn); });
    if (queue.size) rafId = requestAnimationFrame(tick);
  }
  function pump(fn) {
    queue.add(fn);
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  /* ── icons ─────────────────────────────────────────────────────────── */
  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(function (v) {
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function mix(hex, target, amt) {
    var a = parseInt(hex.slice(1), 16), b = parseInt(target.slice(1), 16);
    var r = Math.round((a >> 16 & 255) * (1 - amt) + (b >> 16 & 255) * amt);
    var g = Math.round((a >> 8 & 255) * (1 - amt) + (b >> 8 & 255) * amt);
    var l = Math.round((a & 255) * (1 - amt) + (b & 255) * amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + l).toString(16).slice(1);
  }
  function paintIcons() {
    var ICONS = window.ICONS || {}, BRAND = window.BRAND || {}, painted = [];

    // ── write pass: inject glyph + resolve a brand colour that survives its chassis
    doc.querySelectorAll('.ic[data-ic]').forEach(function (el) {
      var key = el.getAttribute('data-ic'), d = ICONS[key];
      if (!d) return;
      var svg = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
      el.innerHTML = svg;
      painted.push(el);
      var hex = BRAND[key];
      if (!hex) return;
      // keep every mark legible on the chassis it actually sits on
      var onLight = !!el.closest('.zone--light');
      var lum = luminance(hex);
      var safe = hex;
      if (!onLight && lum < 0.16) safe = mix(hex, '#E8EDF4', 0.72);
      else if (onLight && lum > 0.82) safe = mix(hex, '#0E1116', 0.55);
      el.style.setProperty('--brand', safe);
      el.setAttribute('data-brand', '');
    });

    /* ── wordmark rescue ────────────────────────────────────────────────
       a few official marks (CompTIA, TryHackMe) are wordmarks, not glyphs:
       inside a 24×24 box their ink is ~4 units tall, so at 19px they render
       as an illegible smudge. tighten the viewBox to the real ink bounds and
       widen the host to match, so the mark fills its row instead of hiding in
       it. read every bbox first, then write — one layout flush, not 55. */
    var boxes = painted.map(function (el) {
      var p = el.firstChild && el.firstChild.firstChild;
      try { return p ? p.getBBox() : null; } catch (e) { return null; }
    });
    painted.forEach(function (el, i) {
      var b = boxes[i];
      if (!b || !b.width || !b.height) return;
      var aspect = b.width / b.height;
      if (aspect < 2.2) return;                       // a normal glyph — leave it alone
      var pad = b.height * 0.12;
      el.firstChild.setAttribute('viewBox',
        (b.x - pad) + ' ' + (b.y - pad) + ' ' + (b.width + pad * 2) + ' ' + (b.height + pad * 2));
      el.style.setProperty('--ic-w', Math.round(19 * Math.min(aspect, 4.6)) + 'px');
    });
  }

  /* ── clearance record ──────────────────────────────────────────────── */
  var LEVELS = 6;
  var record = [];
  try {
    var saved = sessionStorage.getItem('clearance');
    if (saved) record = JSON.parse(saved) || [];
  } catch (e) { record = []; }

  var recordList = doc.getElementById('recordList');
  var recordFoot = doc.getElementById('recordFoot');
  var railLvl = doc.getElementById('railLvl');

  function stamp() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function highest() {
    return record.reduce(function (m, r) { return Math.max(m, r.lv); }, 0);
  }
  function grant(lv, why, path) {
    if (record.some(function (r) { return r.lv === lv; })) return;
    record.push({ lv: lv, why: why, t: stamp() });
    record.sort(function (a, b) { return a.lv - b.lv; });
    try { sessionStorage.setItem('clearance', JSON.stringify(record)); } catch (e) {}
    renderRecord();
    if (railLvl) railLvl.textContent = 'CLEARANCE ' + highest() + '/' + LEVELS + ' · ' + (path || '/');
  }
  function renderRecord() {
    if (!recordList) return;
    if (!record.length) return;
    recordList.innerHTML = record.map(function (r) {
      return '<li>' + r.t + ' · <span class="r-lv">CLEARANCE ' + r.lv + '</span> — ' + r.why + '</li>';
    }).join('');
    if (recordFoot) {
      var h = highest();
      recordFoot.textContent = 'CLEARANCE ' + h + '/' + LEVELS + (h >= LEVELS ? ' · SIGNED' : '');
    }
  }

  /* ── zone illumination ─────────────────────────────────────────────── */
  var zones = Array.prototype.slice.call(doc.querySelectorAll('.zone'));
  var rail = doc.getElementById('rail');
  var WHY = {
    0: ['opened /', '/'],
    1: ['read /log', '/log'],
    2: ['read /drill', '/drill'],
    3: ['read /study', '/study'],
    4: ['read /scope', '/scope'],
    5: ['read /build', '/build'],
    6: ['reached /handover', '/handover']
  };

  function lightZone(z) {
    z.classList.add('lit');
    var lv = parseInt(z.getAttribute('data-zone'), 10);
    var w = WHY[lv];
    if (w) grant(lv, w[0], w[1]);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        lightZone(en.target);
        io.unobserve(en.target);          // drain the observed set
      });
    }, { rootMargin: '-35% 0px -35% 0px' });
    zones.forEach(function (z) { io.observe(z); });

    // rail chassis follows the zone under it — separate, non-latching
    var chassisIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var light = en.target.classList.contains('zone--light');
        if (rail) rail.classList.toggle('on-light', light);
        if (rail) rail.style.setProperty('--accent',
          getComputedStyle(en.target).getPropertyValue('--accent').trim());
        var lv = parseInt(en.target.getAttribute('data-zone'), 10);
        var w = WHY[lv];
        if (railLvl && w) railLvl.textContent = 'CLEARANCE ' + highest() + '/' + LEVELS + ' · ' + w[1];
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    zones.forEach(function (z) { chassisIO.observe(z); });
  } else {
    zones.forEach(lightZone);             // no IO: everything is simply lit
  }

  /* ── rail meter — the only lerped thing on the site ────────────────── */
  var railFill = doc.getElementById('railFill');
  var target = 0, current = 0, dirty = false;

  function measure() {
    var h = doc.documentElement.scrollHeight - innerHeight;
    target = h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0;
  }
  function lerp() {
    current += (target - current) * 0.14;
    if (Math.abs(target - current) < 0.0015) current = target;
    if (railFill) railFill.style.transform = 'scaleX(' + current.toFixed(4) + ')';
    if (current === target) { dirty = false; return false; }
    return true;
  }
  addEventListener('scroll', function () {
    measure();
    if (!dirty) { dirty = true; pump(lerp); }
  }, { passive: true });

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { measure(); if (!dirty) { dirty = true; pump(lerp); } }, 150);
  }, { passive: true });

  /* ── /drill — the hold ─────────────────────────────────────────────── */
  var holdBtn = doc.getElementById('holdBtn');
  var holdOut = doc.getElementById('holdOut');
  var holdWin = doc.getElementById('holdWin');
  var holdSkip = doc.getElementById('holdSkip');
  var held = false;

  function holdDone(earned) {
    if (held) return;
    held = true;
    if (holdBtn) {
      holdBtn.classList.remove('holding');
      holdBtn.classList.add('done');
      holdBtn.setAttribute('aria-pressed', 'true');
      holdBtn.querySelector('.hold__label').textContent = 'STOOD FAST';
    }
    if (holdWin) holdWin.hidden = false;
    if (holdOut) holdOut.textContent = earned
      ? '[+] held 3.0s. clearance 2 granted.'
      : '[+] clearance 2 granted. the offer was always open.';
    grant(2, earned ? 'held the line 3.0s' : 'granted on request', '/drill');
  }

  if (holdBtn) {
    var fill = holdBtn.querySelector('.hold__fill');
    var start = function (e) {
      if (held) return;
      if (e.cancelable) e.preventDefault();
      holdBtn.classList.add('holding');
      if (holdOut) holdOut.textContent = '[~] holding…';
    };
    var stop = function () {
      if (held || !holdBtn.classList.contains('holding')) return;
      holdBtn.classList.remove('holding');
      if (holdOut) holdOut.textContent = '[!] fall in again.';
    };
    holdBtn.addEventListener('pointerdown', start);
    holdBtn.addEventListener('pointerup', stop);
    holdBtn.addEventListener('pointerleave', stop);
    holdBtn.addEventListener('pointercancel', stop);
    holdBtn.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(e); }
    });
    holdBtn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') stop();
    });
    // the visual IS the timer — it cannot desync
    if (fill) fill.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'transform' && holdBtn.classList.contains('holding')) holdDone(true);
    });
  }
  if (holdSkip) holdSkip.addEventListener('click', function () { holdDone(false); });

  /* ── /build — the verifier ─────────────────────────────────────────── */
  var verifier = doc.getElementById('verifier');
  var vfOut = doc.getElementById('vfOut');
  var vfTimers = [];

  // response shapes and XP values are the real ones from the backend contract
  var SAMPLES = {
    verified:  { verdict: 'verified',  confidence: 0.94, xp: 50, cls: 'v-ok',
                 note: 'streak +1 · session written' },
    partial:   { verdict: 'partial',   confidence: 0.61, xp: 20, cls: 'v-mid',
                 note: 'streak held · partial credit' },
    unrelated: { verdict: 'unrelated', confidence: 0.97, xp: 0,  cls: 'v-no',
                 note: 'streak unchanged · nothing written' }
  };
  var STEPS = [
    '$ POST /ai/verify-proof',
    '> langgraph — route: proof_verification',
    '> gemini-2.5-flash — vision read',
    '> instructor — parse to schema',
    '> verdict',
    '> streak write'
  ];

  function clearTimers() { vfTimers.forEach(clearTimeout); vfTimers = []; }

  function runVerify(key) {
    if (!verifier || !vfOut) return;
    var s = SAMPLES[key];
    if (!s) return;
    clearTimers();
    verifier.setAttribute('data-step', '0');
    var lines = [];
    var delay = REDUCED ? 0 : 260;

    for (var i = 0; i < STEPS.length; i++) {
      (function (i) {
        vfTimers.push(setTimeout(function () {
          verifier.setAttribute('data-step', String(i + 1));
          lines.push(STEPS[i]);
          var body = lines.join('\n');
          if (i === STEPS.length - 1) {
            body += '\n\n{\n  "verdict": <span class="' + s.cls + '">"' + s.verdict + '"</span>,\n'
                 +  '  "confidence": ' + s.confidence.toFixed(2) + ',\n'
                 +  '  "xp_awarded": ' + s.xp + '\n}\n'
                 +  '<span class="k">' + s.note + '</span>';
          }
          vfOut.innerHTML = body + '<span class="caret" aria-hidden="true">█</span>';
        }, delay * i));
      })(i);
    }
  }

  if (verifier) {
    var samples = Array.prototype.slice.call(verifier.querySelectorAll('.vf__s'));
    function select(btn) {
      samples.forEach(function (b) { b.setAttribute('aria-checked', String(b === btn)); });
      runVerify(btn.getAttribute('data-sample'));
    }
    samples.forEach(function (btn, idx) {
      btn.addEventListener('click', function () { select(btn); });
      btn.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = samples[(idx + 1) % samples.length];
        if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   n = samples[(idx - 1 + samples.length) % samples.length];
        if (n) { e.preventDefault(); n.focus(); select(n); }
      });
    });
  }

  /* ── index overlay — the contact guarantee ─────────────────────────── */
  var overlay = doc.getElementById('overlay');
  var indexBtn = doc.getElementById('indexBtn');
  var overlayClose = doc.getElementById('overlayClose');
  var lastFocus = null;

  function openOverlay() {
    if (!overlay) return;
    lastFocus = doc.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('open'); });
    if (indexBtn) indexBtn.setAttribute('aria-expanded', 'true');
    var first = overlay.querySelector('a');
    if (first) first.focus();
  }
  function closeOverlay() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('open');
    if (indexBtn) indexBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function () { overlay.hidden = true; }, REDUCED ? 0 : 200);
    if (lastFocus) lastFocus.focus();
  }
  if (indexBtn) indexBtn.addEventListener('click', function () {
    overlay && overlay.hidden ? openOverlay() : closeOverlay();
  });
  if (overlayClose) overlayClose.addEventListener('click', closeOverlay);
  if (overlay) {
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    // Escape lives on the document, not the panel: the trap normally keeps
    // focus inside, but if it ever escapes, Escape must still get you out.
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeOverlay();
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = overlay.querySelectorAll('a,button');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    overlay.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', closeOverlay);
    });
  }

  /* ── plain mode — one attribute, no re-render ──────────────────────── */
  var plainBtn = doc.getElementById('plainBtn');
  function setPlain(on) {
    root.setAttribute('data-mode', on ? 'plain' : 'rich');
    if (plainBtn) {
      plainBtn.setAttribute('aria-pressed', String(on));
      plainBtn.textContent = on ? '[ RICH ]' : '[ PLAIN ]';
    }
    try { sessionStorage.setItem('mode', on ? 'plain' : 'rich'); } catch (e) {}
  }
  if (plainBtn) plainBtn.addEventListener('click', function () {
    setPlain(root.getAttribute('data-mode') !== 'plain');
  });
  try { if (sessionStorage.getItem('mode') === 'plain') setPlain(true); } catch (e) {}

  /* ── record actions ────────────────────────────────────────────────── */
  var copyBtn = doc.getElementById('copyRecord');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var txt = 'CLEARANCE RECORD — abraar.me\n'
            + record.map(function (r) { return r.t + '  CLEARANCE ' + r.lv + ' — ' + r.why; }).join('\n')
            + '\nCLEARANCE ' + highest() + '/' + LEVELS;
    var done = function () { copyBtn.textContent = '[ COPIED ]';
      setTimeout(function () { copyBtn.textContent = '[ COPY RECORD ]'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () {});
    }
  });
  var printBtn = doc.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', function () { print(); });

  /* ── boot ──────────────────────────────────────────────────────────── */
  paintIcons();
  renderRecord();
  measure();
  pump(lerp);
  grant(0, WHY[0][0], WHY[0][1]);
})();
