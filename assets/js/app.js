/* ─────────────────────────────────────────────────────────────────────────
   abraar.me

     1. paint brand glyphs from icons.js
     2. reveal chapters once, on the way past
     3. the traceroute (chapter one) — a packet you can actually send
     4. the classifier (chapter three) — real logistic regression, real
        gradient descent, no canned frames
     5. the attack surface (chapter five) — six hotspots, keyboard reachable
     6. the grove (chapter four) — WatchMeGuru's proof loop

   No dependencies. Nothing here reads layout inside a loop.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var doc = document;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return doc.getElementById(id); }
  function svgEl(n) { return doc.createElementNS(SVGNS, n); }


  /* ── 1. brand glyphs ─────────────────────────────────────────────────
     Some simple-icons marks are wordmarks: the ink sits in a short, wide
     band inside the 24x24 box, so at 18px tall the letters collapse to a
     smear. We measure the real bbox, tighten the viewBox onto it, and let
     the glyph run wider than it is tall. Reads, then writes — never
     interleaved, so the browser lays out once. */
  function paintIcons() {
    var ICONS = window.ICONS || {};
    var BRAND = window.BRAND || {};
    var slots = doc.querySelectorAll('[data-ic]');
    var pending = [];
    var i;

    for (i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var key = slot.getAttribute('data-ic');
      var path = ICONS[key];
      if (!path) { continue; }

      // brand hex, unless we're on a dark panel and the mark is near-black
      var fill = BRAND[key] || 'currentColor';
      if (fill !== 'currentColor' &&
          slot.closest('.ch--feature, .grove') &&
          luminance(fill) < 0.22) {
        fill = '#EDE3D4';
      }

      var svg = svgEl('svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', fill);
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');

      var p = svgEl('path');
      p.setAttribute('d', path);
      svg.appendChild(p);

      slot.className = slot.className ? slot.className + ' ic' : 'ic';
      slot.textContent = '';
      slot.appendChild(svg);
      pending.push({ slot: slot, svg: svg, path: p });
    }

    // read pass — every getBBox together, so we thrash layout once at most
    var boxes = [];
    for (i = 0; i < pending.length; i++) {
      try { boxes.push(pending[i].path.getBBox()); }
      catch (e) { boxes.push(null); }
    }

    // write pass
    for (i = 0; i < pending.length; i++) {
      var b = boxes[i];
      if (!b || !b.height || !b.width) { continue; }
      var aspect = b.width / b.height;
      if (aspect < 2.2) { continue; }          // not a wordmark, leave it square

      var pad = b.height * 0.08;
      pending[i].svg.setAttribute('viewBox',
        (b.x - pad) + ' ' + (b.y - pad) + ' ' +
        (b.width + pad * 2) + ' ' + (b.height + pad * 2));
      pending[i].slot.style.setProperty('--ic-w',
        Math.round(18 * Math.min(aspect, 4.6)) + 'px');
    }
  }

  function luminance(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    var n = parseInt(h, 16);
    if (isNaN(n)) { return 1; }
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }


  /* ── 2. reveal ───────────────────────────────────────────────────────
     Classes are added by script, so with JS off nothing is ever hidden.
     One-shot: unobserve on fire, so nothing re-runs on the way back up. */
  function setupReveal() {
    if (reduced || !('IntersectionObserver' in window)) { return; }

    var targets = doc.querySelectorAll(
      '.ch__num, .ch__title, .ch__body, .crest, .plate, .grove, .grove__legend, ' +
      '.stack, .stack__h, .stack__grid, .certs, .colophon__links'
    );
    if (!targets.length) { return; }

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) { continue; }
        var el = entries[i].target;
        el.classList.add('in');
        io.unobserve(el);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    for (var i = 0; i < targets.length; i++) {
      targets[i].classList.add('rv');
      // stagger siblings a touch so a section arrives as a phrase, not a slab
      targets[i].style.transitionDelay = (i % 4) * 55 + 'ms';
      io.observe(targets[i]);
    }
  }


  /* ── 2b. the portrait drifts a little slower than the page ──────────── */
  function setupParallax() {
    var port = $('port');
    if (!port || reduced) { return; }
    var queued = false;

    function apply() {
      queued = false;
      var y = window.pageYOffset;
      if (y > 900) { return; }               // stop once it is long gone
      port.style.transform = 'translate3d(0,' + (y * -0.055).toFixed(2) + 'px,0)';
    }
    window.addEventListener('scroll', function () {
      if (queued) { return; }
      queued = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });
  }


  /* ── 3. the traceroute ───────────────────────────────────────────────
     The polyline is walked by hand rather than with getPointAtLength, so
     the hop indices and the animation share one source of truth. Round
     trip times are illustrative and the caption says so. */
  var TRACE_PTS = [
    [46, 132], [186, 132], [186, 96], [326, 96], [326, 132],
    [466, 132], [466, 78], [606, 78], [606, 132], [714, 132]
  ];
  var TRACE_HOP_AT = [0, 2, 4, 6, 8, 9];       // point index of each labelled hop
  var TRACE_MS = [0.4, 2.1, 9.4, 23.8, 41.2, 57.6];

  function setupTrace() {
    var wrap = $('trace');
    var btn = $('traceBtn');
    var pkt = $('tracePkt');
    var lit = $('traceLit');
    var out = $('traceOut');
    if (!wrap || !btn || !pkt || !lit) { return; }

    var hops = wrap.querySelectorAll('.trace__hops > g');
    var seg = [], cum = [0], total = 0, i;
    for (i = 1; i < TRACE_PTS.length; i++) {
      var dx = TRACE_PTS[i][0] - TRACE_PTS[i - 1][0];
      var dy = TRACE_PTS[i][1] - TRACE_PTS[i - 1][1];
      var d = Math.sqrt(dx * dx + dy * dy);
      seg.push(d); total += d; cum.push(total);
    }

    function at(dist) {
      for (var k = 1; k < cum.length; k++) {
        if (dist <= cum[k] || k === cum.length - 1) {
          var t = (dist - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
          t = Math.max(0, Math.min(1, t));
          return [
            TRACE_PTS[k - 1][0] + (TRACE_PTS[k][0] - TRACE_PTS[k - 1][0]) * t,
            TRACE_PTS[k - 1][1] + (TRACE_PTS[k][1] - TRACE_PTS[k - 1][1]) * t
          ];
        }
      }
      return TRACE_PTS[TRACE_PTS.length - 1];
    }

    function clear() {
      for (var k = 0; k < hops.length; k++) {
        hops[k].classList.remove('lit');
        var t = hops[k].querySelector('.ms');
        if (t) { t.textContent = ''; }
      }
      lit.setAttribute('stroke-dasharray', '0 4000');
      pkt.classList.remove('on');
    }

    var running = false;
    function send() {
      if (running) { return; }
      running = true;
      btn.disabled = true;
      clear();
      pkt.classList.add('on');

      var times = TRACE_MS.map(function (m, k) {
        return k === 0 ? m : +(m * (0.86 + Math.random() * 0.3)).toFixed(1);
      });
      var next = 0;
      var dur = reduced ? 0 : 1700;
      var t0 = null;

      function frame(ts) {
        if (t0 === null) { t0 = ts; }
        var u = dur ? Math.min(1, (ts - t0) / dur) : 1;
        var e = u * u * (3 - 2 * u);             // smoothstep
        var dist = e * total;

        var p = at(dist);
        pkt.setAttribute('cx', p[0]);
        pkt.setAttribute('cy', p[1]);
        lit.setAttribute('stroke-dasharray', dist.toFixed(1) + ' 4000');

        while (next < TRACE_HOP_AT.length && dist >= cum[TRACE_HOP_AT[next]] - 0.5) {
          hops[next].classList.add('lit');
          var lab = hops[next].querySelector('.ms');
          if (lab) { lab.textContent = times[next] + ' ms'; }
          next++;
        }

        if (u < 1) { window.requestAnimationFrame(frame); return; }

        out.textContent = 'Arrived in ' + times[times.length - 1] +
          ' ms, having asked five machines you have never met to be honest.';
        pkt.classList.remove('on');
        btn.disabled = false;
        running = false;
      }
      window.requestAnimationFrame(frame);
    }

    btn.addEventListener('click', send);
  }


  /* ── 4. the classifier ───────────────────────────────────────────────
     Two hundred synthetic students, two features, one logistic regression
     fitted by full-batch gradient descent. Nothing is pre-rendered: the
     boundary moves because the weights move. */
  function setupTrainer() {
    var wrap = $('trainer');
    if (!wrap) { return; }

    var gPts   = $('tScatter');
    var bound  = $('tBound');
    var shade  = $('tShade');
    var lossPl = $('tLoss');
    var eEpoch = $('tEpoch'), eLoss = $('tLossVal'), eAcc = $('tAcc');
    var run = $('tRun'), reset = $('tReset');
    if (!gPts || !bound || !run) { return; }

    // plot box, in viewBox units
    var X0 = 46, X1 = 368, Y0 = 244, Y1 = 20;
    function sx(x) { return X0 + x * (X1 - X0); }
    function sy(y) { return Y0 + y * (Y1 - Y0); }

    // a small LCG, so the cohort is the same every visit and the story
    // about it in the caption stays true
    var seed = 20250817;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    function gauss() {
      var u = 1 - rnd(), v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    var N = 200, data = [], nodes = [], i;
    for (i = 0; i < N; i++) {
      var lab = i % 2;
      var cx = lab ? 0.64 : 0.36, cy = lab ? 0.66 : 0.35;
      var x = Math.max(0.03, Math.min(0.97, cx + gauss() * 0.135));
      var y = Math.max(0.03, Math.min(0.97, cy + gauss() * 0.145));
      data.push({ x: x, y: y, t: lab });

      var c = svgEl('circle');
      c.setAttribute('cx', sx(x).toFixed(1));
      c.setAttribute('cy', sy(y).toFixed(1));
      c.setAttribute('r', '3.4');
      c.setAttribute('class', lab ? 'c1' : 'c0');
      gPts.appendChild(c);
      nodes.push(c);
    }

    var w1, w2, b, epoch, hist;
    var LR = 3.2;

    function init() {
      w1 = (rnd() - 0.5) * 0.6;
      w2 = (rnd() - 0.5) * 0.6;
      b = 0;
      epoch = 0;
      hist = [];
      draw(measure());
    }

    function measure() {
      var loss = 0, right = 0;
      for (var k = 0; k < N; k++) {
        var z = w1 * data[k].x + w2 * data[k].y + b;
        var p = 1 / (1 + Math.exp(-z));
        var q = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
        loss += -(data[k].t * Math.log(q) + (1 - data[k].t) * Math.log(1 - q));
        var hit = (p >= 0.5 ? 1 : 0) === data[k].t;
        if (hit) { right++; }
        nodes[k].classList.toggle('wrong', !hit);
      }
      return { loss: loss / N, acc: right / N };
    }

    function step() {
      var g1 = 0, g2 = 0, gb = 0;
      for (var k = 0; k < N; k++) {
        var z = w1 * data[k].x + w2 * data[k].y + b;
        var d = 1 / (1 + Math.exp(-z)) - data[k].t;
        g1 += d * data[k].x; g2 += d * data[k].y; gb += d;
      }
      w1 -= LR * g1 / N; w2 -= LR * g2 / N; b -= LR * gb / N;
      epoch++;
    }

    /* clip the unit square to the half-plane w.x + b >= 0 (Sutherland-Hodgman),
       so the shaded region is exactly what the model would call a pass */
    function halfPlane() {
      var poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
      var f = function (p) { return w1 * p[0] + w2 * p[1] + b; };
      var out = [];
      for (var k = 0; k < poly.length; k++) {
        var A = poly[k], B = poly[(k + 1) % poly.length];
        var fa = f(A), fb = f(B);
        if (fa >= 0) { out.push(A); }
        if ((fa >= 0) !== (fb >= 0)) {
          var t = fa / (fa - fb);
          out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
        }
      }
      return out;
    }

    function draw(m) {
      var poly = halfPlane();
      shade.setAttribute('points', poly.map(function (p) {
        return sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1);
      }).join(' '));

      // the boundary itself is the two edges of that region that are not
      // edges of the square — cheaper to just re-solve for the segment
      var ends = [];
      var cand = [
        [0, -(w1 * 0 + b) / w2], [1, -(w1 * 1 + b) / w2],
        [-(w2 * 0 + b) / w1, 0], [-(w2 * 1 + b) / w1, 1]
      ];
      for (var k = 0; k < cand.length; k++) {
        var c = cand[k];
        if (isFinite(c[0]) && isFinite(c[1]) &&
            c[0] >= -1e-6 && c[0] <= 1 + 1e-6 && c[1] >= -1e-6 && c[1] <= 1 + 1e-6) {
          ends.push(c);
        }
      }
      if (ends.length >= 2) {
        bound.setAttribute('x1', sx(ends[0][0]).toFixed(1));
        bound.setAttribute('y1', sy(ends[0][1]).toFixed(1));
        bound.setAttribute('x2', sx(ends[1][0]).toFixed(1));
        bound.setAttribute('y2', sy(ends[1][1]).toFixed(1));
        bound.style.opacity = '1';
      } else {
        bound.style.opacity = '0';
      }

      eEpoch.textContent = epoch;
      eLoss.textContent = m.loss.toFixed(3);
      eAcc.textContent = Math.round(m.acc * 100) + '%';

      // the inset sparkline: last 60 epochs, clamped to a sensible ceiling
      hist.push(m.loss);
      if (hist.length > 60) { hist.shift(); }
      var pts = hist.map(function (v, k) {
        var px = 258 + (hist.length > 1 ? (k / (hist.length - 1)) * 94 : 0);
        var py = 78 - Math.min(v, 0.8) / 0.8 * 32;
        return px.toFixed(1) + ',' + py.toFixed(1);
      });
      lossPl.setAttribute('points', pts.join(' '));
    }

    var busy = false;
    function trainBurst() {
      if (busy) { return; }
      busy = true;
      run.disabled = true;
      var left = 25;

      function tick() {
        var chunk = reduced ? left : 1;
        while (chunk-- > 0 && left > 0) { step(); left--; }
        draw(measure());
        if (left > 0) { window.requestAnimationFrame(tick); return; }
        run.disabled = false;
        busy = false;
      }
      window.requestAnimationFrame(tick);
    }

    run.addEventListener('click', trainBurst);
    reset.addEventListener('click', function () { if (!busy) { init(); } });
    init();
  }


  /* ── 5. the attack surface ───────────────────────────────────────────
     Six hotspots. Mouse, touch and keyboard all reach them; the note is a
     live region so a screen reader hears the change. */
  function setupSurface() {
    var wrap = $('surface');
    if (!wrap) { return; }
    var spots = wrap.querySelectorAll('.hs');
    var t = $('sfT'), d = $('sfD');
    if (!spots.length || !t) { return; }

    function show(el) {
      for (var i = 0; i < spots.length; i++) { spots[i].classList.remove('on'); }
      el.classList.add('on');
      t.textContent = el.getAttribute('data-i') + '. ' + el.getAttribute('data-t');
      d.textContent = el.getAttribute('data-d');
    }

    for (var i = 0; i < spots.length; i++) {
      (function (el) {
        el.addEventListener('click', function () { show(el); });
        el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault();
            show(el);
          }
        });
      })(spots[i]);
    }
  }


  /* ── 6. the grove ────────────────────────────────────────────────────
     WatchMeGuru's actual loop: claim, prove, and grow only if the proof
     held up. The one honest difference is that there is no photograph
     here for a model to read, so the verdict is drawn from a distribution
     instead of from Gemini. Everything else behaves as shipped — most
     notably, an unrelated submission costs you the whole streak. */
  var STAGES = ['Seed', 'Sprout', 'Sapling', 'Tree', 'Forest', 'World Tree'];
  var THRESH = [0, 1, 2, 4, 7, 11];   // streak needed to reach each stage

  var OK = [
    'Handwriting matches your last twelve submissions. Timestamp is inside the window.',
    'Counted the worked problems. It is in the range you claimed.',
    'Page numbers are continuous and the ink is the same. Good.',
    'Margins are full of your own corrections, which is the tell we like most.'
  ];
  var PART = [
    'Half of the page is genuinely worked. The rest is copied from the solution.',
    'It is the right subject, but this is about forty minutes of work, not three hours.',
    'Legible and relevant, but two of these problems are the worked examples.',
    'The photograph is real. The claim is generous.'
  ];
  var BAD = [
    'This is last Tuesday. We keep hashes.',
    'That is a screenshot of a solution manual.',
    'The page is blank below the heading.',
    'Wrong subject entirely. Nice try.'
  ];

  function setupGrove() {
    var grove   = $('grove');
    var tree    = $('tree');
    var btn     = $('proveBtn');
    var reset   = $('resetBtn');
    var verdict = $('verdict');
    var claimEl = $('claimSel');
    var ledger  = $('ledger');
    var elStage = $('stageName');
    var elStreak   = $('streak');
    var elVerified = $('verified');
    var elRejected = $('rejected');
    if (!grove || !tree || !btn) { return; }

    var layers = tree.querySelectorAll('.lyr');
    var busy = false;
    var s = { streak: 0, verified: 0, rejected: 0 };

    function stageFor(streak) {
      var n = 0;
      for (var i = 0; i < THRESH.length; i++) {
        if (streak >= THRESH[i]) { n = i; }
      }
      return n;
    }

    function render() {
      var stage = stageFor(s.streak);
      tree.setAttribute('data-stage', String(stage));
      for (var i = 0; i < layers.length; i++) {
        var lv = +layers[i].getAttribute('data-s');
        // seed and sprout are states, not strata: each is replaced by what
        // comes after it, or you end up with seedling leaves clinging to the
        // trunk of a full-grown tree. Everything from the trunk up accretes.
        var on = lv === 0 ? stage === 0
               : lv === 1 ? stage === 1
               : lv <= stage;
        layers[i].classList.toggle('on', on);
      }
      elStage.textContent = STAGES[stage];
      elStreak.textContent = s.streak;
      elVerified.textContent = s.verified;
      elRejected.textContent = s.rejected;
    }

    function mark(cls) {
      if (!ledger) { return; }
      var sq = doc.createElement('i');
      sq.className = cls;
      ledger.appendChild(sq);
      while (ledger.children.length > 54) { ledger.removeChild(ledger.firstChild); }
    }

    function say(cls, head, body) {
      verdict.className = 'grove__verdict ' + cls;
      verdict.innerHTML = '';
      var b = doc.createElement('b');
      b.textContent = head;
      var t = doc.createElement('span');
      t.textContent = body;
      verdict.appendChild(b);
      verdict.appendChild(t);
    }

    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

    function submit() {
      if (busy) { return; }
      busy = true;
      btn.disabled = true;
      btn.classList.add('is-shooting');

      var claim = claimEl.options[claimEl.selectedIndex].value;
      var wait = reduced ? 0 : 640;

      window.setTimeout(function () {
        var roll = Math.random();
        var before = stageFor(s.streak);

        if (roll < 0.62) {
          s.streak += 1; s.verified += 1;
          say('v-ok', 'Verified', pick(OK));
          mark('ok');
        } else if (roll < 0.85) {
          say('v-part', 'Partial', pick(PART) + ' Streak held, but it does not count.');
          mark('part');
        } else {
          var lost = s.streak;
          s.streak = 0; s.rejected += 1;
          say('v-bad', 'Unrelated',
            pick(BAD) + (lost > 0
              ? ' You just lost ' + lost + ' day' + (lost === 1 ? '' : 's') + '.'
              : ''));
          mark('bad');
        }

        render();

        var after = stageFor(s.streak);
        if (after > before) {
          verdict.appendChild(doc.createTextNode(' '));
          var g = doc.createElement('b');
          g.textContent = '→ ' + STAGES[after];
          verdict.appendChild(g);
        }

        // claim is referenced so the copy feels answered, not canned
        verdict.setAttribute('data-claim', claim);

        btn.classList.remove('is-shooting');
        btn.disabled = false;
        busy = false;
      }, wait);
    }

    btn.addEventListener('click', submit);
    reset.addEventListener('click', function () {
      s.streak = 0; s.verified = 0; s.rejected = 0;
      if (ledger) { ledger.innerHTML = ''; }
      render();
      verdict.className = 'grove__verdict';
      verdict.innerHTML =
        '<span class="grove__hint">Back to the seed. The tree does not remember, but the log does.</span>';
    });

    render();
  }


  /* ── boot ────────────────────────────────────────────────────────── */
  function boot() {
    paintIcons();
    setupReveal();
    setupParallax();
    setupTrace();
    setupTrainer();
    setupSurface();
    setupGrove();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
