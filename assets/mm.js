/* ════════════════════════════════════════════════════════════════
   MetricMech Design System — mm.js
   Shared utilities for every calculator page. Vanilla JS, no deps.

   Public API:
     mmVerdict(el, status, headline, detail)   status: pass|marginal|fail|info
     mmCountUp(el, value, decimals)            400ms count-up
     mmCopy(btn, text)                         clipboard + "Copied ✓"
     mmDebounce(fn, ms)
     mmCollapse(el)                            toggle a .mm-collapse
     mmViz.bell / gauge / scaleBar / compareBars / stack / fitDiagram /
           flowBar / sfBar                     inline SVG visuals

   Automatic behaviors (no per-page code needed):
     • mmInterpret.render() is wrapped → verdict banner rendered into
       #mmVerdictTop (if present) + mobile sticky bar updated.
     • Inputs with inline onchange/oninput get a debounced live-recalc
       'input' listener (150ms) — Calculate buttons stay as fallback.
     • .result-big gets a copy button for the headline number.
     • section.seo-content is wrapped in a collapsible (open on
       desktop, collapsed on mobile). No content is removed.
     • Wide tables get a horizontal-scroll wrapper with edge fade.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.mmDS) return;
  document.documentElement.classList.add('mm-js');

  var BLUE = '#2554BA', GREEN = '#16A34A', AMBER = '#D97706', RED = '#DC2626',
      INK = '#111827', MUTED = '#6B7280', BORDER = '#E5E7EB',
      GREEN_BG = '#F0FDF4', AMBER_BG = '#FFFBEB', RED_BG = '#FEF2F2', BLUE_BG = '#EFF4FC';

  var ICONS = { pass: '✓', marginal: '!', fail: '✕', info: 'i' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(sel) { return typeof sel === 'string' ? document.querySelector(sel) : sel; }

  /* ── mmVerdict ── */
  function mmVerdict(target, status, headline, detail) {
    var mount = el(target);
    if (!mount) return;
    status = { pass: 'pass', good: 'pass', ok: 'pass',
               marginal: 'marginal', warn: 'marginal',
               fail: 'fail', bad: 'fail', critical: 'fail',
               info: 'info', neutral: 'info' }[status] || 'info';
    mount.innerHTML =
      '<div class="mm-verdict ' + status + '" role="status">' +
        '<div class="mm-verdict__icon" aria-hidden="true">' + ICONS[status] + '</div>' +
        '<div><div class="mm-verdict__headline">' + esc(headline) + '</div>' +
        (detail ? '<div class="mm-verdict__detail">' + esc(detail) + '</div>' : '') +
        '</div></div>';
    updateSticky(status, headline);
  }

  /* ── mmCountUp — 400ms ease-out count-up ── */
  function mmCountUp(target, value, decimals, suffix) {
    var node = el(target);
    if (!node) return;
    value = Number(value);
    decimals = decimals == null ? 0 : decimals;
    suffix = suffix || '';
    if (!isFinite(value)) { node.textContent = '—'; return; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.textContent = value.toFixed(decimals) + suffix; return;
    }
    var startVal = node._mmRaf != null && node._mmStart != null
      ? node._mmStart
      : parseFloat(String(node.textContent).replace(/[^\d.eE+-]/g, ''));
    if (!isFinite(startVal)) startVal = 0;
    if (node._mmRaf) cancelAnimationFrame(node._mmRaf);
    node._mmStart = startVal;
    // Write the final value synchronously so same-tick readers (e.g. the
    // page's interpretation block reading textContent) see the real result;
    // the animation then repaints from startVal on subsequent frames.
    node.textContent = value.toFixed(decimals) + suffix;
    var t0 = null, DUR = 400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = (startVal + (value - startVal) * eased).toFixed(decimals) + suffix;
      if (p < 1) node._mmRaf = requestAnimationFrame(step);
      else { node.textContent = value.toFixed(decimals) + suffix; node._mmRaf = null; node._mmStart = null; }
    }
    node._mmRaf = requestAnimationFrame(step);
  }

  /* ── mmCopy ── */
  function mmCopy(btn, text) {
    function done() {
      var old = btn.innerHTML;
      btn.innerHTML = 'Copied ✓';
      btn.classList.add('mm-copied');
      setTimeout(function () { btn.innerHTML = old; btn.classList.remove('mm-copied'); }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
    } else { legacyCopy(text); done(); }
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ── mmDebounce ── */
  function mmDebounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms == null ? 150 : ms);
    };
  }

  /* ── Collapse ── */
  function mmCollapse(node) {
    node = el(node);
    if (node) node.classList.toggle('open');
  }
  function makeCollapse(titleText, contentNode, startOpen) {
    var wrap = document.createElement('div');
    wrap.className = 'mm-collapse' + (startOpen ? ' open' : '');
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'mm-collapse__head';
    head.setAttribute('aria-expanded', startOpen ? 'true' : 'false');
    head.textContent = titleText;
    head.addEventListener('click', function () {
      wrap.classList.toggle('open');
      head.setAttribute('aria-expanded', wrap.classList.contains('open') ? 'true' : 'false');
    });
    var body = document.createElement('div');
    body.className = 'mm-collapse__body';
    body.appendChild(contentNode);
    wrap.appendChild(head); wrap.appendChild(body);
    return wrap;
  }

  /* ══════════ SVG VISUAL KIT — Blueprint palette, viewBox responsive ══════════ */
  var mmViz = {};
  var FONT = 'font-family="Inter,sans-serif"';

  function svgOpen(w, h, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img"' +
      (label ? ' aria-label="' + esc(label) + '"' : '') + '>';
  }
  function txt(x, y, s, opts) {
    opts = opts || {};
    return '<text x="' + x + '" y="' + y + '" ' + FONT +
      ' font-size="' + (opts.size || 12) + '" fill="' + (opts.fill || MUTED) + '"' +
      (opts.anchor ? ' text-anchor="' + opts.anchor + '"' : '') +
      (opts.weight ? ' font-weight="' + opts.weight + '"' : '') + '>' + esc(s) + '</text>';
  }
  var statusColor = { pass: GREEN, marginal: AMBER, fail: RED, info: BLUE };

  /* Normal distribution with LSL/USL and shaded out-of-spec tails.
     o = { mean, sigma, lsl, usl, target } */
  mmViz.bell = function (target, o) {
    var mount = el(target); if (!mount) return;
    var W = 640, H = 240, padL = 20, padR = 20, top = 26, base = H - 34;
    var lo = Math.min(o.lsl, o.mean - 4 * o.sigma), hi = Math.max(o.usl, o.mean + 4 * o.sigma);
    var span = (hi - lo) || 1; lo -= span * 0.06; hi += span * 0.06; span = hi - lo;
    function X(v) { return padL + (v - lo) / span * (W - padL - padR); }
    var peak = 1 / (o.sigma * Math.sqrt(2 * Math.PI));
    function Y(v) {
      var d = (v - o.mean) / o.sigma;
      return base - Math.exp(-0.5 * d * d) * peak / peak * (base - top);
    }
    var N = 160, pts = [], i, v;
    for (i = 0; i <= N; i++) { v = lo + span * i / N; pts.push(X(v).toFixed(1) + ',' + Y(v).toFixed(1)); }
    var curve = pts.join(' ');
    function tailPath(from, to) {
      var p = ['M' + X(from).toFixed(1) + ',' + base];
      for (var j = 0; j <= 40; j++) {
        var vv = from + (to - from) * j / 40;
        p.push('L' + X(vv).toFixed(1) + ',' + Y(vv).toFixed(1));
      }
      p.push('L' + X(to).toFixed(1) + ',' + base + ' Z');
      return p.join(' ');
    }
    var s = svgOpen(W, H, 'Process distribution vs specification limits');
    s += '<line x1="' + padL + '" y1="' + base + '" x2="' + (W - padR) + '" y2="' + base + '" stroke="' + BORDER + '" stroke-width="1.5"/>';
    // in-spec fill
    s += '<path d="' + tailPath(Math.max(lo, o.lsl), Math.min(hi, o.usl)) + '" fill="rgba(22,163,74,0.13)"/>';
    // out-of-spec tails
    if (o.lsl > lo) s += '<path d="' + tailPath(lo, o.lsl) + '" fill="rgba(220,38,38,0.25)"/>';
    if (o.usl < hi) s += '<path d="' + tailPath(o.usl, hi) + '" fill="rgba(220,38,38,0.25)"/>';
    s += '<polyline points="' + curve + '" fill="none" stroke="' + BLUE + '" stroke-width="2.5"/>';
    [['LSL', o.lsl], ['USL', o.usl]].forEach(function (L) {
      s += '<line x1="' + X(L[1]) + '" y1="' + (top - 8) + '" x2="' + X(L[1]) + '" y2="' + base + '" stroke="' + RED + '" stroke-width="2" stroke-dasharray="5 4"/>';
      s += txt(X(L[1]), top - 12, L[0] + ' ' + L[1], { anchor: 'middle', fill: RED, weight: 700 });
    });
    s += '<line x1="' + X(o.mean) + '" y1="' + top + '" x2="' + X(o.mean) + '" y2="' + base + '" stroke="' + INK + '" stroke-width="1.5"/>';
    s += txt(X(o.mean), base + 16, 'x̄ ' + (+o.mean.toFixed(4)), { anchor: 'middle', fill: INK, weight: 600 });
    s += txt(padL, base + 30, '±3σ span: ' + (6 * o.sigma).toFixed(4), { size: 12 });
    s += '</svg>';
    mount.innerHTML = s;
  };

  /* Semicircular zone gauge with needle.
     o = { value, min, max, zones: [{to, color}], label, unit, decimals } */
  mmViz.gauge = function (target, o) {
    var mount = el(target); if (!mount) return;
    var W = 420, H = 250, cx = W / 2, cy = 205, R = 150, r = 108;
    function ang(v) {
      var f = Math.max(0, Math.min(1, (v - o.min) / (o.max - o.min)));
      return Math.PI * (1 - f);
    }
    function pt(a, rad) { return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)]; }
    function arc(v0, v1, color) {
      var a0 = ang(v0), a1 = ang(v1);
      var p0o = pt(a0, R), p1o = pt(a1, R), p1i = pt(a1, r), p0i = pt(a0, r);
      var large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
      return '<path d="M' + p0o + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + p1o +
        ' L' + p1i + ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + p0i + ' Z" fill="' + color + '"/>';
    }
    var s = svgOpen(W, H, (o.label || 'Gauge') + ' ' + o.value + (o.unit || ''));
    var from = o.min;
    (o.zones || []).forEach(function (z) { s += arc(from, Math.min(z.to, o.max), z.color); from = z.to; });
    if (from < o.max) s += arc(from, o.max, BORDER);
    // ticks at zone boundaries — strip float noise (0.075000000000001 → 0.075)
    var nice = function (v) { return String(parseFloat(Number(v).toPrecision(6))); };
    var bounds = [o.min].concat((o.zones || []).map(function (z) { return z.to; })).concat([o.max])
      .filter(function (b, i, arr) { return arr.indexOf(b) === i; });
    bounds.forEach(function (b) {
      if (b < o.min || b > o.max) return;
      var a = ang(b), p1 = pt(a, R + 4), p2 = pt(a, R + 8);
      s += txt(pt(a, R + 22)[0], pt(a, R + 22)[1] + 4, nice(b), { anchor: 'middle', size: 12, fill: MUTED });
      s += '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" stroke="' + MUTED + '" stroke-width="1.5"/>';
    });
    // needle
    var av = ang(Math.max(o.min, Math.min(o.max, o.value)));
    var tip = pt(av, r - 10), b1 = pt(av + Math.PI / 2, 7), b2 = pt(av - Math.PI / 2, 7);
    s += '<polygon points="' + tip + ' ' + b1 + ' ' + b2 + '" fill="' + INK + '"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="' + INK + '"/>';
    // value text drawn last with a paper halo so the needle never obscures it
    s += '<text x="' + cx + '" y="' + (cy - 34) + '" ' + FONT + ' font-size="26" font-weight="700" fill="' + INK + '" text-anchor="middle" stroke="#FFFFFF" stroke-width="8" paint-order="stroke" stroke-linejoin="round">' + esc((o.decimals != null ? Number(o.value).toFixed(o.decimals) : o.value) + (o.unit || '')) + '</text>';
    if (o.label) s += '<text x="' + cx + '" y="' + (cy - 12) + '" ' + FONT + ' font-size="12.5" fill="' + MUTED + '" text-anchor="middle" stroke="#FFFFFF" stroke-width="6" paint-order="stroke" stroke-linejoin="round">' + esc(o.label) + '</text>';
    s += '</svg>';
    mount.innerHTML = s;
  };

  /* Horizontal scale bar with zones and a marker at value.
     o = { value, min, max, zones:[{to,color,label}], label, unit, log, marks:[{v,label}], decimals } */
  mmViz.scaleBar = function (target, o) {
    var mount = el(target); if (!mount) return;
    var W = 640, H = 120, padL = 20, padR = 20, barY = 52, barH = 22;
    function fx(v) {
      var lo = o.log ? Math.log10(o.min) : o.min, hi = o.log ? Math.log10(o.max) : o.max;
      var vv = o.log ? Math.log10(Math.max(v, 1e-9)) : v;
      var f = Math.max(0, Math.min(1, (vv - lo) / (hi - lo)));
      return padL + f * (W - padL - padR);
    }
    var s = svgOpen(W, H, (o.label || 'Scale') + ' ' + o.value + (o.unit || ''));
    var from = o.min;
    (o.zones || []).forEach(function (z) {
      s += '<rect x="' + fx(from) + '" y="' + barY + '" width="' + Math.max(0, fx(Math.min(z.to, o.max)) - fx(from)) + '" height="' + barH + '" fill="' + z.color + '" rx="3"/>';
      if (z.label) s += txt((fx(from) + fx(Math.min(z.to, o.max))) / 2, barY + barH + 18, z.label, { anchor: 'middle', size: 12 });
      from = z.to;
    });
    (o.marks || []).forEach(function (m) {
      s += '<line x1="' + fx(m.v) + '" y1="' + (barY - 6) + '" x2="' + fx(m.v) + '" y2="' + (barY + barH + 4) + '" stroke="' + MUTED + '" stroke-width="1" stroke-dasharray="3 3"/>';
      s += txt(fx(m.v), H - 6, m.label, { anchor: 'middle', size: 12 });
    });
    var vx = fx(o.value);
    s += '<polygon points="' + (vx - 8) + ',' + (barY - 16) + ' ' + (vx + 8) + ',' + (barY - 16) + ' ' + vx + ',' + (barY - 3) + '" fill="' + INK + '"/>';
    s += txt(vx, barY - 22, (o.decimals != null ? Number(o.value).toFixed(o.decimals) : o.value) + (o.unit || ''), { anchor: 'middle', size: 17, fill: INK, weight: 700 });
    s += '</svg>';
    mount.innerHTML = s;
  };

  /* Horizontal comparison bars.
     o = { bars: [{label, value, color, display}], max, unit, decimals } */
  mmViz.compareBars = function (target, o) {
    var mount = el(target); if (!mount) return;
    var rowH = 40, padT = 8, W = 640, labelW = 170,
        H = padT + o.bars.length * rowH + 8;
    var max = o.max || Math.max.apply(null, o.bars.map(function (b) { return Math.abs(b.value); })) || 1;
    var s = svgOpen(W, H, o.label || 'Comparison');
    o.bars.forEach(function (b, i) {
      var y = padT + i * rowH, bw = Math.max(2, Math.abs(b.value) / max * (W - labelW - 90));
      s += txt(labelW - 10, y + 24, b.label, { anchor: 'end', size: 13, fill: INK, weight: 600 });
      s += '<rect x="' + labelW + '" y="' + (y + 8) + '" width="' + bw + '" height="22" rx="4" fill="' + (b.color || BLUE) + '"/>';
      s += txt(labelW + bw + 8, y + 24, (b.display != null ? b.display : (o.decimals != null ? Number(b.value).toFixed(o.decimals) : b.value) + (o.unit || '')), { size: 13, fill: INK, weight: 700 });
    });
    s += '</svg>';
    mount.innerHTML = s;
  };

  /* Tolerance stack: dimension contributions vs spec window with WC + RSS markers.
     o = { dims:[{label, tol}], worst, rss, spec, unit } (all tolerances ±, spec ± window) */
  mmViz.stack = function (target, o) {
    var mount = el(target); if (!mount) return;
    var W = 640, rowH = 26, padT = 10, labelW = 150;
    var n = o.dims.length;
    var axisY = padT + n * rowH + 18;
    var H = axisY + 74;
    var maxV = Math.max(o.worst, o.spec || 0) * 1.12 || 1;
    function fx(v) { return labelW + Math.max(0, Math.min(1, v / maxV)) * (W - labelW - 30); }
    var s = svgOpen(W, H, 'Tolerance stack contributions');
    var acc = 0;
    o.dims.forEach(function (d, i) {
      var y = padT + i * rowH;
      s += txt(labelW - 8, y + 15, d.label, { anchor: 'end', size: 12, fill: INK });
      s += '<rect x="' + fx(acc) + '" y="' + (y + 3) + '" width="' + Math.max(1.5, fx(acc + d.tol) - fx(acc)) + '" height="16" fill="' + (i % 2 ? '#3A6FD8' : BLUE) + '" rx="2"/>';
      acc += d.tol;
    });
    s += '<line x1="' + labelW + '" y1="' + axisY + '" x2="' + (W - 30) + '" y2="' + axisY + '" stroke="' + BORDER + '" stroke-width="1.5"/>';
    function marker(v, color, label, dy) {
      s += '<line x1="' + fx(v) + '" y1="' + (padT - 4) + '" x2="' + fx(v) + '" y2="' + (axisY + 6) + '" stroke="' + color + '" stroke-width="2" stroke-dasharray="5 3"/>';
      s += txt(fx(v), axisY + dy, label + ' ±' + (+v.toFixed(4)) + (o.unit || ''), { anchor: 'middle', size: 12, fill: color, weight: 700 });
    }
    if (o.spec) marker(o.spec, RED, 'SPEC', 22);
    marker(o.worst, AMBER, 'WC', 40);
    marker(o.rss, GREEN, 'RSS', 58);
    s += '</svg>';
    mount.innerHTML = s;
  };

  /* ISO 286 fit: hole & shaft tolerance zones around zero line, µm.
     o = { holeLo, holeHi, shaftLo, shaftHi, unit:'µm', fitLabel } (deviations in µm) */
  mmViz.fitDiagram = function (target, o) {
    var mount = el(target); if (!mount) return;
    var W = 640, H = 260, zeroY = 130, padL = 60;
    var all = [o.holeLo, o.holeHi, o.shaftLo, o.shaftHi, 0];
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var span = (hi - lo) || 1; lo -= span * 0.25; hi += span * 0.25;
    function fy(v) { return zeroY - (v - (lo + hi) / 2) / (hi - lo) * (H - 90); }
    function zone(x, w, vLo, vHi, color, label) {
      var s2 = '<rect x="' + x + '" y="' + fy(vHi) + '" width="' + w + '" height="' + Math.max(2, fy(vLo) - fy(vHi)) + '" fill="' + color + '" fill-opacity="0.28" stroke="' + color + '" stroke-width="1.5"/>';
      s2 += txt(x + w / 2, fy(vHi) - 6, label, { anchor: 'middle', size: 13, fill: color, weight: 700 });
      s2 += txt(x + w + 8, fy(vHi) + 5, '+' + '' + (+vHi.toFixed(1)), { size: 12 });
      s2 += txt(x + w + 8, fy(vLo) + 5, '' + (+vLo.toFixed(1)), { size: 12 });
      return s2;
    }
    var s = svgOpen(W, H, 'ISO 286 fit tolerance zones');
    s += '<line x1="' + padL + '" y1="' + fy(0) + '" x2="' + (W - 20) + '" y2="' + fy(0) + '" stroke="' + INK + '" stroke-width="1.5"/>';
    s += txt(padL - 6, fy(0) + 4, '0', { anchor: 'end', size: 12, fill: INK, weight: 600 });
    s += txt(W - 20, fy(0) - 6, 'zero line (nominal)', { anchor: 'end', size: 12 });
    s += zone(150, 120, o.holeLo, o.holeHi, BLUE, 'HOLE');
    s += zone(370, 120, o.shaftLo, o.shaftHi, '#0d9488', 'SHAFT');
    // clearance/interference annotation
    var cMin = o.holeLo - o.shaftHi, cMax = o.holeHi - o.shaftLo;
    var fitTxt = (cMin >= 0) ? 'Clearance ' + cMin.toFixed(1) + ' to ' + cMax.toFixed(1) + ' µm'
      : (cMax <= 0) ? 'Interference ' + (-cMax).toFixed(1) + ' to ' + (-cMin).toFixed(1) + ' µm'
      : 'Transition −' + (-cMin).toFixed(1) + ' to +' + cMax.toFixed(1) + ' µm';
    s += txt(W / 2, H - 10, (o.fitLabel ? o.fitLabel + ' — ' : '') + fitTxt, { anchor: 'middle', size: 14, fill: INK, weight: 700 });
    s += '</svg>';
    mount.innerHTML = s;
  };

  /* Flow bar: lot → sample → accept/reject (AQL etc.)
     o = { steps: [{label, value, sub}] } */
  mmViz.flowBar = function (target, o) {
    var mount = el(target); if (!mount) return;
    var n = o.steps.length, W = 640, H = 110, gap = 24;
    var bw = (W - 40 - gap * (n - 1)) / n;
    var s = svgOpen(W, H, 'Sampling flow');
    o.steps.forEach(function (st, i) {
      var x = 20 + i * (bw + gap);
      s += '<rect x="' + x + '" y="18" width="' + bw + '" height="62" rx="8" fill="' + (st.color || BLUE_BG) + '" stroke="' + (st.stroke || BLUE) + '" stroke-width="1.5"/>';
      s += txt(x + bw / 2, 46, String(st.value), { anchor: 'middle', size: 21, fill: st.stroke || BLUE, weight: 700 });
      s += txt(x + bw / 2, 66, st.label, { anchor: 'middle', size: 12, fill: INK });
      if (st.sub) s += txt(x + bw / 2, 96, st.sub, { anchor: 'middle', size: 12 });
      if (i < n - 1) {
        var ax = x + bw + gap / 2;
        s += '<path d="M' + (ax - 7) + ',49 L' + (ax + 5) + ',49 M' + (ax) + ',43 L' + (ax + 6) + ',49 L' + (ax) + ',55" stroke="' + MUTED + '" stroke-width="2" fill="none"/>';
      }
    });
    s += '</svg>';
    mount.innerHTML = s;
  };

  /* Safety-factor bar: value vs 1.0 line with zones (press-fit, beams…)
     o = { sf, req, label } */
  mmViz.sfBar = function (target, o) {
    var req = o.req || 1;
    var max = Math.max(o.sf * 1.25, req * 2.2);
    mmViz.scaleBar(target, {
      value: o.sf, min: 0, max: max, decimals: 2,
      label: o.label || 'Safety factor',
      zones: [
        { to: req, color: 'rgba(220,38,38,0.45)', label: '< ' + req + ' fails' },
        { to: req * 1.5, color: 'rgba(217,119,6,0.45)', label: 'marginal' },
        { to: max, color: 'rgba(22,163,74,0.4)', label: 'safe' }
      ],
      marks: [{ v: req, label: 'SF ' + req }]
    });
  };

  /* ══════════ STICKY MOBILE RESULT BAR ══════════ */
  var sticky = null;
  function ensureSticky() {
    if (sticky) return sticky;
    if (!document.querySelector('.calc-layout')) return null; // calculators only
    sticky = document.createElement('div');
    sticky.className = 'mm-sticky-result';
    sticky.setAttribute('role', 'button');
    sticky.setAttribute('aria-label', 'Scroll to full results');
    sticky.innerHTML = '<span class="mm-sticky-result__dot"></span>' +
      '<span class="mm-sticky-result__num"></span>' +
      '<span class="mm-sticky-result__label"></span>' +
      '<span class="mm-sticky-result__chev"></span>';
    sticky.addEventListener('click', function () {
      var tgt = document.getElementById('mmVerdictTop') || document.querySelector('.result-big') || document.querySelector('.calc-layout');
      if (tgt) tgt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.body.appendChild(sticky);
    document.body.classList.add('mm-has-sticky-result');
    // hide when full results are on screen
    if ('IntersectionObserver' in window) {
      var watch = document.getElementById('mmVerdictTop') || document.querySelector('.result-big');
      if (watch) {
        new IntersectionObserver(function (entries) {
          sticky.classList.toggle('mm-show', !entries[0].isIntersecting && !!sticky._has);
        }, { threshold: 0.1 }).observe(watch);
      }
    }
    return sticky;
  }
  function updateSticky(status, headline) {
    var bar = ensureSticky();
    if (!bar) return;
    bar._has = true;
    bar.className = 'mm-sticky-result ' + status + (bar.classList.contains('mm-show') ? ' mm-show' : '');
    var big = document.querySelector('.result-big .val');
    bar.querySelector('.mm-sticky-result__num').textContent = big ? big.textContent : '';
    bar.querySelector('.mm-sticky-result__label').textContent = headline || '';
    // initial show decision (before IO fires)
    var watch = document.getElementById('mmVerdictTop') || document.querySelector('.result-big');
    if (watch) {
      var r = watch.getBoundingClientRect();
      var visible = r.top < window.innerHeight && r.bottom > 0;
      bar.classList.toggle('mm-show', !visible);
    }
  }

  /* ══════════ AUTOMATIC PAGE ENHANCEMENTS ══════════ */

  /* Wrap mmInterpret.render → top verdict banner + sticky. Zero logic duplication:
     status comes from the page's own already-computed verdict level. */
  function hookInterpret() {
    if (!window.mmInterpret || window.mmInterpret._mmHooked) return;
    var orig = window.mmInterpret.render.bind(window.mmInterpret);
    window.mmInterpret.render = function (mountId, payload) {
      try {
        if (payload && payload.verdict) {
          var v = payload.verdict;
          var mount = document.getElementById('mmVerdictTop');
          if (mount) mmVerdict(mount, v.level, v.label, stripTags(v.sub));
          else updateSticky({ good: 'pass', warn: 'marginal', bad: 'fail', critical: 'fail' }[v.level] || 'info', v.label);
        }
      } catch (e) { /* never break the calculator */ }
      return orig(mountId, payload);
    };
    window.mmInterpret._mmHooked = true;
  }
  function stripTags(s) {
    var d = document.createElement('div');
    d.innerHTML = s == null ? '' : String(s);
    return d.textContent;
  }

  /* Debounced live recalc: re-fire each control's own inline handler on 'input'. */
  function initLiveRecalc() {
    var scope = document.querySelector('.calc-layout') || document.querySelector('main');
    if (!scope) return;
    scope.querySelectorAll('input[onchange], select[onchange], input[onkeyup], textarea[onkeyup], textarea[onchange]').forEach(function (ctl) {
      if (ctl._mmLive) return;
      ctl._mmLive = true;
      var fire = mmDebounce(function () {
        try { (ctl.onchange || ctl.onkeyup).call(ctl); } catch (e) {}
      }, 150);
      ctl.addEventListener('input', fire);
    });
  }

  /* Copy button on the headline number. */
  function initHeadlineCopy() {
    document.querySelectorAll('.result-big').forEach(function (big) {
      if (big.querySelector('.mm-copy-btn')) return;
      var val = big.querySelector('.val');
      if (!val) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mm-copy-btn';
      btn.innerHTML = 'Copy';
      btn.setAttribute('aria-label', 'Copy result to clipboard');
      btn.addEventListener('click', function () {
        var unit = big.querySelector('.unit');
        mmCopy(btn, val.textContent + (unit ? ' ' + unit.textContent : ''));
      });
      big.appendChild(btn);
    });
  }

  /* SEO/theory content → collapsible (open desktop, collapsed mobile).
     Content is moved, never removed — and no-JS users see it untouched. */
  function initSeoCollapse() {
    document.querySelectorAll('section.seo-content').forEach(function (sec) {
      if (sec._mmCollapsed || !document.querySelector('.calc-layout')) return;
      sec._mmCollapsed = true;
      var inner = document.createElement('div');
      while (sec.firstChild) inner.appendChild(sec.firstChild);
      var h2 = inner.querySelector('h2');
      var title = 'Guide, formulas & theory';
      var open = window.innerWidth >= 768;
      var col = makeCollapse(title, inner, open);
      sec.appendChild(col);
    });
  }

  /* Wide tables → scroll wrapper with edge fade. */
  function initTableWrap() {
    document.querySelectorAll('main table').forEach(function (tbl) {
      if (tbl.closest('.mm-tablewrap') || tbl.closest('.mm-embed-widget')) return;
      var wrap = document.createElement('div');
      wrap.className = 'mm-tablewrap';
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
      function fade() {
        var canScroll = wrap.scrollWidth > wrap.clientWidth + 2;
        wrap.classList.toggle('mm-fade-r', canScroll && wrap.scrollLeft < wrap.scrollWidth - wrap.clientWidth - 2);
        wrap.classList.toggle('mm-fade-l', canScroll && wrap.scrollLeft > 2);
      }
      wrap.addEventListener('scroll', fade, { passive: true });
      window.addEventListener('resize', mmDebounce(fade, 200));
      fade();
    });
  }

  /* Mobile input hygiene for dynamically built inputs. */
  function initInputModes() {
    document.querySelectorAll('.calc-layout input[type="number"]').forEach(function (inp) {
      if (!inp.getAttribute('inputmode')) inp.setAttribute('inputmode', 'decimal');
      if (!inp.getAttribute('autocomplete')) inp.setAttribute('autocomplete', 'off');
    });
  }

  function boot() {
    hookInterpret();
    initLiveRecalc();
    initHeadlineCopy();
    initSeoCollapse();
    initTableWrap();
    initInputModes();
    initInboxValidation();
    mmThemeInit();
    ensureSticky();
  }
  // Hook interpret.js immediately (pages call calc() inline, before DOMContentLoaded).
  hookInterpret();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  // interpret.js may load after us; re-hook shortly after load
  window.addEventListener('load', function () { hookInterpret(); initInputModes(); });

  /* ══════════ STUDIO KIT (Blueprint-native) ══════════ */

  /* Pulse the hero/result card after a recalc. */
  function mmPulse(target) {
    var node = el(target);
    if (!node) return;
    node.classList.remove('mm-pulse');
    void node.offsetWidth; // restart animation
    node.classList.add('mm-pulse');
  }

  /* Shake + red border on invalid numeric inputs wrapped in .mm-inbox.
     Delegated so dynamically rebuilt inputs (buildFields pages) are covered. */
  function initInboxValidation() {
    if (document._mmInboxVal) return;
    document._mmInboxVal = true;
    document.addEventListener('input', function (e) {
      var inp = e.target;
      if (!inp || inp.type !== 'number') return;
      var box = inp.closest && inp.closest('.mm-inbox');
      if (!box) return;
      var v = parseFloat(inp.value);
      var min = inp.min === '' || inp.min == null ? null : +inp.min;
      // HTML min semantics: 0 is valid when min="0" (defect counts, downtime).
      var bad = inp.value !== '' && (!isFinite(v) || (min != null && v < min));
      box.classList.toggle('err', bad);
    });
  }

  /* ── mmWire: tiny software 3D wireframe renderer (drag to rotate, auto-spin).
     mmWire.mount(canvasSel, {color}) → handle; handle.setMesh(builderFn) where
     builderFn(m) pushes vertices m.v=[[x,y,z]…] and edges m.e=[[i,j]…].
     Helpers exposed: mmWire.prism(m, pts, L, step), mmWire.ngon(r, n, rot),
     mmWire.rect(w, h), mmWire.sphere(m, r), mmWire.cone(m, r, h). */
  var mmWire = (function () {
    function prism(m, pts, L, step) {
      step = step || 1;
      var n = pts.length, b = m.v.length, h = L / 2, i;
      pts.forEach(function (p) { m.v.push([p[0], p[1], -h]); });
      pts.forEach(function (p) { m.v.push([p[0], p[1], h]); });
      for (i = 0; i < n; i++) {
        m.e.push([b + i, b + (i + 1) % n], [b + n + i, b + n + (i + 1) % n]);
        if (i % step === 0) m.e.push([b + i, b + n + i]);
      }
    }
    function ngon(r, n, rot) {
      n = n || 24; rot = rot || 0;
      var out = [], i, a;
      for (i = 0; i < n; i++) { a = rot + i / n * 2 * Math.PI; out.push([r * Math.cos(a), r * Math.sin(a)]); }
      return out;
    }
    function rectPts(w, h) { return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]; }
    function sphere(m, r) {
      var j, i, th, rr, z, n, b, a;
      for (j = 1; j < 6; j++) {
        th = j / 6 * Math.PI; rr = r * Math.sin(th); z = r * Math.cos(th); n = 26; b = m.v.length;
        for (i = 0; i < n; i++) { a = i / n * 2 * Math.PI; m.v.push([rr * Math.cos(a), z, rr * Math.sin(a)]); }
        for (i = 0; i < n; i++) m.e.push([b + i, b + (i + 1) % n]);
      }
      for (j = 0; j < 6; j++) {
        a = j / 6 * Math.PI; n = 34; b = m.v.length;
        for (i = 0; i < n; i++) { th = i / n * 2 * Math.PI; m.v.push([r * Math.sin(th) * Math.cos(a), r * Math.cos(th), r * Math.sin(th) * Math.sin(a)]); }
        for (i = 0; i < n; i++) m.e.push([b + i, b + (i + 1) % n]);
      }
    }
    function cone(m, r, h) {
      var n = 24, b = m.v.length, i, a;
      for (i = 0; i < n; i++) { a = i / n * 2 * Math.PI; m.v.push([r * Math.cos(a), h / 2, r * Math.sin(a)]); }
      var apex = m.v.length; m.v.push([0, -h / 2, 0]);
      for (i = 0; i < n; i++) { m.e.push([b + i, b + (i + 1) % n]); if (i % 3 === 0) m.e.push([b + i, apex]); }
    }

    function mount(canvasSel, opts) {
      var cv = el(canvasSel);
      if (!cv || !cv.getContext) return null;
      opts = opts || {};
      var color = opts.color || BLUE;
      var W = cv.getAttribute('width') ? +cv.getAttribute('width') : 320;
      var H = cv.getAttribute('height') ? +cv.getAttribute('height') : 240;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      var cx2 = cv.getContext('2d');
      cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      var mesh = { v: [], e: [] }, meshR = 1, rX = -0.45, rY = 0.65,
          drag = false, px = 0, py = 0, running = false, visible = true;

      function draw() {
        cx2.clearRect(0, 0, W, H);
        if (!mesh.v.length) return;
        var s = (Math.min(W, H) * 0.4) / meshR, cx = W / 2, cy = H / 2;
        var cyv = Math.cos(rY), sy = Math.sin(rY), cxv = Math.cos(rX), sx = Math.sin(rX);
        var P = mesh.v.map(function (p) {
          var x1 = p[0] * cyv + p[2] * sy, z1 = -p[0] * sy + p[2] * cyv;
          var y1 = p[1] * cxv - z1 * sx, z2 = p[1] * sx + z1 * cxv;
          var f = 640 / (640 + z2 * s);
          return [cx + x1 * s * f, cy + y1 * s * f, z2 * s];
        });
        var E = mesh.e.map(function (ed) {
          return { a: P[ed[0]], b: P[ed[1]], z: (P[ed[0]][2] + P[ed[1]][2]) / 2 };
        }).sort(function (p, q) { return q.z - p.z; });
        if (!E.length) return;
        var zmin = E[E.length - 1].z, zmax = E[0].z, zr = Math.max(zmax - zmin, 1e-6);
        cx2.lineCap = 'round';
        var liveColor = document.documentElement.dataset.mmTheme === 'dark' ? '#00E5FF' : color;
        for (var i = 0; i < E.length; i++) {
          var t = 1 - (E[i].z - zmin) / zr;
          cx2.globalAlpha = 0.14 + 0.86 * t;
          cx2.lineWidth = 0.7 + 1.2 * t;
          cx2.strokeStyle = liveColor;
          cx2.beginPath(); cx2.moveTo(E[i].a[0], E[i].a[1]); cx2.lineTo(E[i].b[0], E[i].b[1]); cx2.stroke();
        }
        cx2.globalAlpha = 1;
      }
      function loop() {
        if (!running) return;
        if (visible) { if (!drag) rY += 0.006; draw(); }
        requestAnimationFrame(loop);
      }
      cv.addEventListener('pointerdown', function (e) { drag = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', function (e) {
        if (!drag) return;
        rY += (e.clientX - px) * 0.008;
        rX = Math.max(-1.5, Math.min(1.5, rX + (e.clientY - py) * 0.008));
        px = e.clientX; py = e.clientY;
      });
      cv.addEventListener('pointerup', function () { drag = false; });
      cv.addEventListener('pointercancel', function () { drag = false; });
      // pause the spin loop when offscreen — keep it cheap
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.05 }).observe(cv);
      }
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return {
        setMesh: function (builderFn) {
          var m = { v: [], e: [] };
          try { builderFn(m); } catch (e) { return; }
          mesh = m; meshR = 1e-9;
          for (var i = 0; i < m.v.length; i++) {
            var r = Math.hypot(m.v[i][0], m.v[i][1], m.v[i][2]);
            if (r > meshR) meshR = r;
          }
          if (reduced) { draw(); }
          else if (!running) { running = true; loop(); }
        },
        stop: function () { running = false; }
      };
    }
    return { mount: mount, prism: prism, ngon: ngon, rect: rectPts, sphere: sphere, cone: cone };
  })();

  /* ══════════ STUDIO DARK MODE (opt-in, calculator pages only) ══════════ */
  function mmThemeInit() {
    if (!document.querySelector('.calc-layout')) return; // calculators only
    var root = document.documentElement;
    // Studio dark is the DEFAULT on calculator pages; light is the opt-out.
    try {
      if (localStorage.getItem('mm_theme') === 'light') delete root.dataset.mmTheme;
      else root.dataset.mmTheme = 'dark';
    } catch (e) { root.dataset.mmTheme = 'dark'; }
    if (document.querySelector('.mm-theme-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mm-theme-toggle';
    btn.setAttribute('aria-label', 'Toggle studio dark mode');
    btn.textContent = root.dataset.mmTheme === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', function () {
      var dark = root.dataset.mmTheme !== 'dark';
      if (dark) root.dataset.mmTheme = 'dark';
      else delete root.dataset.mmTheme;
      btn.textContent = dark ? '☀️' : '🌙';
      try { localStorage.setItem('mm_theme', dark ? 'dark' : 'light'); } catch (e) {}
      // let the page's own visuals redraw with the new palette: re-fire the
      // first live-recalc control's handler (same path as live recalc)
      var ctl = document.querySelector('.calc-layout input[onchange], .calc-layout select[onchange], .calc-layout input[oninput], .calc-layout select[oninput]');
      try { if (ctl) (ctl.onchange || ctl.oninput).call(ctl); } catch (e) {}
    });
    document.body.appendChild(btn);
  }

  /* exports */
  window.mmVerdict = mmVerdict;
  window.mmCountUp = mmCountUp;
  window.mmCopy = mmCopy;
  window.mmDebounce = mmDebounce;
  window.mmCollapse = mmCollapse;
  window.mmViz = mmViz;
  window.mmPulse = mmPulse;
  window.mmWire = mmWire;
  window.mmDS = { version: '1.0.0' };
})();
