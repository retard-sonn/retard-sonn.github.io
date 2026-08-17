/* ─────────────────────────────────────────────────────────────────────────
   abraar.me — three small jobs:
     1. paint brand glyphs from icons.js
     2. reveal chapters once, on the way past
     3. run the grove (chapter four's proof loop)
   No dependencies. Nothing here touches layout in a loop.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var doc = document;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

      var svg = doc.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', fill);
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');

      var p = doc.createElementNS(SVGNS, 'path');
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
      '.ch__num, .ch__title, .ch__body, .plate, .grove, .grove__legend, ' +
      '.stack, .stack__h, .stack__grid, .creds, .colophon__links'
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


  /* ── 3. the grove ────────────────────────────────────────────────────
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
    var grove   = doc.getElementById('grove');
    var tree    = doc.getElementById('tree');
    var btn     = doc.getElementById('proveBtn');
    var reset   = doc.getElementById('resetBtn');
    var verdict = doc.getElementById('verdict');
    var claimEl = doc.getElementById('claimSel');
    var elStage = doc.getElementById('stageName');
    var elStreak   = doc.getElementById('streak');
    var elVerified = doc.getElementById('verified');
    var elRejected = doc.getElementById('rejected');
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
        } else if (roll < 0.85) {
          say('v-part', 'Partial', pick(PART) + ' Streak held, but it does not count.');
        } else {
          var lost = s.streak;
          s.streak = 0; s.rejected += 1;
          say('v-bad', 'Unrelated',
            pick(BAD) + (lost > 0
              ? ' You just lost ' + lost + ' day' + (lost === 1 ? '' : 's') + '.'
              : ''));
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
    setupGrove();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
