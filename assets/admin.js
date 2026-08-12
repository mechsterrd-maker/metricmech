/* ==========================================================================
   MetricMech Admin — analytics dashboard client

   Calls the mm-analytics edge function (which holds the GA4 credential) and
   renders the result. Requires a signed-in user with role='admin'.
   ========================================================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://wzxowvrvuecybdxymjvi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_NYFIl1lGQHd0SwWb0dJCUw_VtdIV8Kj';
  var FN = SUPABASE_URL + '/functions/v1/mm-analytics';

  var C1 = '#2554BA';   // pageviews  — validated slot 1
  var C2 = '#D97706';   // calc runs  — validated slot 2

  var esc = window.MMForumMD.esc;
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  var state = { period: '7d', data: null, busy: false };

  /* ------------------------------------------------------------- helpers */

  function fmt(n) {
    n = Number(n || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toLocaleString('en-IN');
  }

  function duration(totalSeconds, sessions) {
    if (!sessions) return '0s';
    var s = Math.round(totalSeconds / sessions);
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }

  // GA4 returns dates as YYYYMMDD.
  function parseDate(d) {
    return new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
  }
  function shortDate(d) {
    var dt = parseDate(d);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // Slugs whose display name plain title-casing gets wrong.
  var NAMES = {
    'cp-cpk': 'Cp / Cpk', 'gauge-rr': 'Gauge R&R', 'as9102-form3': 'AS9102 Form 3',
    'iso-286-fits': 'ISO 286 Fits', 'ppap-checklist': 'PPAP Checklist',
    'dpmo-sigma': 'DPMO / Sigma', 'fmea-rpn': 'FMEA RPN', 'oee': 'OEE',
    'aql-sampling': 'AQL Sampling', 'eoq': 'EOQ', 'copq': 'COPQ',
    'bend-allowance': 'Bend Allowance / K-factor', 'v-belt': 'V-Belt Drive',
    'motor-hp': 'Motor HP', 'gdt': 'GD&T', 'cadnexa-roi': 'CadNexa ROI'
  };
  // Tokens that should stay upper-case when a slug falls through to title case.
  var ACRONYMS = ['as9102','gdt','ppap','fai','oee','eoq','aql','dpmo','msa','iso',
                  'cmm','rss','mmc','lmc','copq','fmea','rpn','hp','spc','qa'];

  // A calculator page path → a readable name.
  function prettyPath(p) {
    var leaf = String(p || '').split('?')[0].replace(/\/$/, '').split('/').pop() || 'home';
    leaf = leaf.replace(/\.html$/, '');
    if (NAMES[leaf]) return NAMES[leaf];
    return leaf.split('-').map(function (w) {
      if (ACRONYMS.indexOf(w) !== -1) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function deltaHTML(cur, prev) {
    if (!prev) {
      return '<span class="ad-delta flat">— no prior data</span>';
    }
    var pct = ((cur - prev) / prev) * 100;
    var dir = pct > 0.5 ? 'up' : (pct < -0.5 ? 'down' : 'flat');
    var glyph = dir === 'up' ? '▲' : (dir === 'down' ? '▼' : '■');
    var word = dir === 'up' ? 'up' : (dir === 'down' ? 'down' : 'flat');
    return '<span class="ad-delta ' + dir + '">' + glyph + ' ' + word + ' ' +
           Math.abs(pct).toFixed(pct >= 10 || pct <= -10 ? 0 : 1) + '%</span>' +
           '<span class="ad-delta-note">vs previous (' + fmt(prev) + ')</span>';
  }

  /* --------------------------------------------------------------- charts */

  // Multi-series line chart with a crosshair + tooltip.
  function trendChart(daily) {
    if (!daily.length) return '<div class="ad-empty">No data in this period.</div>';

    if (daily.length === 1) {
      var d = daily[0];
      return '<div class="ad-empty">A single day — <b>' + fmt(d.pageviews) + '</b> pageviews, <b>' +
             fmt(d.calcRuns) + '</b> calculator runs. Pick a longer range to see a trend.</div>';
    }

    var W = 720, H = 240, PL = 44, PR = 14, PT = 14, PB = 26;
    var iw = W - PL - PR, ih = H - PT - PB;
    var max = Math.max(1, ...daily.map(function (r) { return Math.max(r.pageviews, r.calcRuns); }));
    // Round the axis up to something legible.
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var top = Math.ceil(max / step) * step;

    var x = function (i) { return PL + (daily.length === 1 ? iw / 2 : (i / (daily.length - 1)) * iw); };
    var y = function (v) { return PT + ih - (v / top) * ih; };
    var path = function (key) {
      return daily.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[key]).toFixed(1); }).join(' ');
    };

    var ticks = [0, 0.25, 0.5, 0.75, 1].map(function (f) { return Math.round(top * f); });
    var gridlines = ticks.map(function (v) {
      return '<line class="ad-gridline" x1="' + PL + '" x2="' + (W - PR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
             '<text x="' + (PL - 8) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + fmt(v) + '</text>';
    }).join('');

    // Evenly spaced labels including first and last. Spacing is uniform by
    // construction, so the last label can never crowd its neighbour — which a
    // modulo-plus-force-last scheme does whenever the count is not divisible.
    var want = Math.min(daily.length, 6);
    var slots = {};
    for (var k = 0; k < want; k++) slots[Math.round(k * (daily.length - 1) / (want - 1))] = true;
    var xlabels = daily.map(function (r, i) {
      if (!slots[i]) return '';
      var anchor = i === 0 ? 'start' : (i === daily.length - 1 ? 'end' : 'middle');
      return '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' +
             esc(shortDate(r.date)) + '</text>';
    }).join('');

    // Invisible hit columns — the hover target is much wider than the line.
    var hits = daily.map(function (r, i) {
      var w = iw / daily.length;
      return '<rect class="ad-hit" data-i="' + i + '" x="' + (x(i) - w / 2).toFixed(1) + '" y="' + PT +
             '" width="' + w.toFixed(1) + '" height="' + ih + '" fill="transparent"/>';
    }).join('');

    return '' +
      '<div class="ad-legend">' +
        '<span><i class="ad-swatch" style="background:' + C1 + '"></i>Pageviews</span>' +
        '<span><i class="ad-swatch" style="background:' + C2 + '"></i>Calculator runs</span>' +
      '</div>' +
      '<div class="ad-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
        'aria-label="Daily pageviews and calculator runs. Full figures are in the tables below.">' +
        '<g class="ad-axis">' + gridlines + xlabels + '</g>' +
        '<line id="ad-cross" x1="0" x2="0" y1="' + PT + '" y2="' + (PT + ih) + '" stroke="' + C1 +
          '" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>' +
        '<path d="' + path('pageviews') + '" fill="none" stroke="' + C1 + '" stroke-width="2" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
        '<path d="' + path('calcRuns') + '" fill="none" stroke="' + C2 + '" stroke-width="2" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
        '<circle id="ad-dot1" r="4" fill="' + C1 + '" stroke="#fff" stroke-width="2" opacity="0"/>' +
        '<circle id="ad-dot2" r="4" fill="' + C2 + '" stroke="#fff" stroke-width="2" opacity="0"/>' +
        hits +
      '</svg></div>';
  }

  function wireTrend(daily) {
    var svg = document.querySelector('#ad-trend svg');
    if (!svg) return;
    var tip = document.getElementById('ad-tip');
    var cross = svg.querySelector('#ad-cross');
    var d1 = svg.querySelector('#ad-dot1'), d2 = svg.querySelector('#ad-dot2');

    function hide() {
      tip.classList.remove('on');
      [cross, d1, d2].forEach(function (el) { el.setAttribute('opacity', '0'); });
    }

    svg.querySelectorAll('.ad-hit').forEach(function (r) {
      r.addEventListener('mouseenter', function (e) {
        var row = daily[+r.dataset.i];
        var box = r.getBoundingClientRect();
        var cx = +r.getAttribute('x') + +r.getAttribute('width') / 2;

        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', '1');

        // Recompute the dot positions from the rendered path geometry.
        var paths = svg.querySelectorAll('path');
        [d1, d2].forEach(function (dot, k) {
          var pts = paths[k].getAttribute('d').split(/[ML]/).filter(Boolean);
          var p = (pts[+r.dataset.i] || '').trim().split(' ');
          if (p.length === 2) { dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]); dot.setAttribute('opacity', '1'); }
        });

        tip.innerHTML =
          '<div><b>' + esc(shortDate(row.date)) + '</b></div>' +
          '<div><i class="k" style="background:' + C1 + '"></i>' + fmt(row.pageviews) + ' pageviews</div>' +
          '<div><i class="k" style="background:' + C2 + '"></i>' + fmt(row.calcRuns) + ' calculator runs</div>' +
          '<div style="opacity:.75">' + fmt(row.users) + ' people</div>';
        tip.style.left = Math.min(box.left + box.width / 2 + 12, window.innerWidth - 190) + 'px';
        tip.style.top = (box.top + 16) + 'px';
        tip.classList.add('on');
      });
    });
    svg.addEventListener('mouseleave', hide);
  }

  // Ranked horizontal bars — nominal categories, so every bar takes slot 1.
  function rankRows(items, opts) {
    opts = opts || {};
    if (!items.length) return '<div class="ad-empty">' + (opts.empty || 'Nothing recorded in this period.') + '</div>';
    var max = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    return '<div class="ad-rank">' + items.map(function (i) {
      return '<div class="ad-row">' +
        '<div class="ad-row-label">' +
          '<span class="ad-row-name">' + (i.href
            ? '<a href="' + esc(i.href) + '" target="_blank" rel="noopener">' + esc(i.name) + '</a>'
            : esc(i.name)) + '</span>' +
          (i.sub ? '<span class="ad-row-sub">' + esc(i.sub) + '</span>' : '') +
          '<div class="ad-bar-track"><div class="ad-bar-fill' + (opts.alt ? ' alt' : '') +
            '" style="width:' + Math.max(2, (i.value / max) * 100).toFixed(1) + '%"></div></div>' +
        '</div>' +
        '<div class="ad-row-value">' + fmt(i.value) +
          (i.note ? '<small>' + esc(i.note) + '</small>' : '') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* --------------------------------------------------------------- render */

  function render(d) {
    var t = d.totals;

    document.getElementById('ad-kpis').innerHTML = [
      ['People', fmt(t.users.current), deltaHTML(t.users.current, t.users.previous)],
      ['Pageviews', fmt(t.pageviews.current), deltaHTML(t.pageviews.current, t.pageviews.previous)],
      ['Sessions', fmt(t.sessions.current), deltaHTML(t.sessions.current, t.sessions.previous)],
      ['Avg. engaged time', duration(t.engagementS.current, t.sessions.current),
        deltaHTML(t.engagementS.current, t.engagementS.previous)]
    ].map(function (k) {
      return '<div class="ad-tile"><div class="ad-tile-label">' + k[0] + '</div>' +
             '<div class="ad-tile-value">' + k[1] + '</div>' +
             '<div class="ad-tile-foot">' + k[2] + '</div></div>';
    }).join('');

    document.getElementById('ad-trend').innerHTML = trendChart(d.daily);
    wireTrend(d.daily);

    var totalRuns = d.calculators.reduce(function (a, c) { return a + c.runs; }, 0);
    document.getElementById('ad-calc-note').textContent =
      totalRuns
        ? fmt(totalRuns) + ' calculator runs across ' + d.calculators.length +
          ' tools. A run means someone actually entered data — not just landed on the page.'
        : 'No calculator runs recorded in this period.';

    document.getElementById('ad-calcs').innerHTML = rankRows(
      d.calculators.map(function (c) {
        return { name: prettyPath(c.path), sub: c.path, value: c.runs,
                 note: fmt(c.users) + ' ppl', href: 'https://metricmech.com' + c.path };
      }),
      { alt: true, empty: 'No calculator runs recorded in this period.' }
    );

    document.getElementById('ad-events').innerHTML = rankRows(
      d.events.map(function (e) { return { name: e.name, value: e.count, note: fmt(e.users) + ' ppl' }; })
    );

    document.getElementById('ad-channels').innerHTML = rankRows(
      d.channels.map(function (c) { return { name: c.name, value: c.sessions, note: fmt(c.users) + ' ppl' }; })
    );

    document.getElementById('ad-sources').innerHTML = rankRows(
      d.sources.map(function (s) { return { name: s.name, value: s.sessions }; })
    );

    document.getElementById('ad-devices').innerHTML = rankRows(
      d.devices.map(function (x) { return { name: x.name, value: x.sessions }; })
    );

    document.getElementById('ad-countries').innerHTML = rankRows(
      d.countries.map(function (c) { return { name: c.name, value: c.users }; })
    );

    document.getElementById('ad-pages-note').textContent =
      d.pages.length + ' pages received traffic in this period.';
    document.getElementById('ad-pages').innerHTML =
      '<table class="ad-table"><thead><tr>' +
        '<th>Page</th><th class="num">Views</th><th class="num">People</th><th class="num">Avg. time</th>' +
      '</tr></thead><tbody>' +
      (d.pages.length
        ? d.pages.map(function (p) {
            return '<tr><td>' +
              '<a class="path" href="https://metricmech.com' + esc(p.path) + '" target="_blank" rel="noopener">' +
                esc(p.path) + '</a>' +
              (p.title ? '<span class="title">' + esc(p.title) + '</span>' : '') +
            '</td>' +
            '<td class="num">' + fmt(p.views) + '</td>' +
            '<td class="num">' + fmt(p.users) + '</td>' +
            '<td class="num">' + duration(p.engagementS, p.users) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="4"><div class="ad-empty">No pageviews in this period.</div></td></tr>') +
      '</tbody></table>';

    document.getElementById('ad-stamp').textContent =
      'Updated ' + new Date(d.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('ad-body').style.display = '';
  }

  function showError(html, kind) {
    document.getElementById('ad-body').style.display = 'none';
    document.getElementById('ad-msg').innerHTML = '<div class="ad-note ' + (kind || 'error') + '">' + html + '</div>';
  }

  /* ----------------------------------------------------------------- load */

  async function load() {
    if (state.busy) return;
    state.busy = true;
    document.getElementById('ad-msg').innerHTML = '';
    document.getElementById('ad-body').style.display = 'none';
    document.getElementById('ad-loading').style.display = '';

    try {
      var session = (await sb.auth.getSession()).data.session;
      var res = await fetch(FN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ period: state.period })
      });
      var body = await res.json();

      if (!res.ok) {
        if (body.error === 'setup_incomplete') {
          showError(
            '<strong>One setup step left.</strong> ' + esc(body.message || '') +
            '<ol>' +
              '<li>Google Cloud → enable the <b>Google Analytics Data API</b>.</li>' +
              '<li>GA4 → Admin → Property Access Management → add the service-account email as <b>Viewer</b>.</li>' +
              '<li>Supabase → Edge Functions → Secrets → set <code>GA4_PROPERTY_ID</code> and ' +
                  '<code>GA4_SERVICE_ACCOUNT_JSON</code>.</li>' +
            '</ol>' +
            'Full walkthrough in <code>ADMIN.md</code>.', 'warn');
          return;
        }
        showError('<strong>Could not load analytics.</strong> ' + esc(body.error || body.message || res.status));
        return;
      }

      state.data = body;
      render(body);
    } catch (err) {
      console.error('[admin]', err);
      showError('<strong>Could not reach the analytics service.</strong> ' + esc(err.message || ''));
    } finally {
      state.busy = false;
      document.getElementById('ad-loading').style.display = 'none';
    }
  }

  function exportCsv() {
    var d = state.data;
    if (!d) return;
    var lines = [['section', 'name', 'detail', 'metric', 'value']];
    d.pages.forEach(function (p) { lines.push(['page', p.path, p.title, 'views', p.views], ['page', p.path, p.title, 'users', p.users]); });
    d.calculators.forEach(function (c) { lines.push(['calculator', prettyPath(c.path), c.path, 'runs', c.runs], ['calculator', prettyPath(c.path), c.path, 'users', c.users]); });
    d.events.forEach(function (e) { lines.push(['event', e.name, '', 'count', e.count]); });
    d.channels.forEach(function (c) { lines.push(['channel', c.name, '', 'sessions', c.sessions]); });
    d.devices.forEach(function (x) { lines.push(['device', x.name, '', 'sessions', x.sessions]); });
    d.countries.forEach(function (c) { lines.push(['country', c.name, '', 'users', c.users]); });
    d.daily.forEach(function (r) { lines.push(['daily', r.date, '', 'pageviews', r.pageviews], ['daily', r.date, '', 'calculator_runs', r.calcRuns]); });

    var csv = lines.map(function (r) {
      return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');

    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'metricmech-analytics-' + d.period + '-' + d.generatedAt.slice(0, 10) + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ----------------------------------------------------------------- gate */

  function showGate(msg, showSignIn) {
    document.getElementById('ad-app').style.display = 'none';
    var gate = document.getElementById('ad-gate');
    gate.style.display = '';
    gate.innerHTML =
      '<h1>MetricMech Admin</h1><p>' + msg + '</p>' +
      (showSignIn ? '<button class="ad-btn" type="button" id="ad-signin">Sign in</button>' : '');
    if (showSignIn) {
      document.getElementById('ad-signin').onclick = function () {
        sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/admin' } });
      };
    }
  }

  (async function init() {
    if (!window.supabase || !window.MMForumMD) {
      showGate('This page needs <code>cdn.jsdelivr.net</code>, which your network appears to be blocking.', false);
      return;
    }

    var session = (await sb.auth.getSession()).data.session;
    if (!session) {
      showGate('Sign in with the Google account that owns your MetricMech admin profile.', true);
      return;
    }

    var prof = await sb.from('forum_profiles').select('role, display_name').eq('id', session.user.id).maybeSingle();
    if (!prof.data || prof.data.role !== 'admin') {
      showGate('You are signed in as <b>' + esc((prof.data && prof.data.display_name) || session.user.email) +
        '</b>, which is not an admin account.<br><br>Grant yourself access with one statement in the Supabase SQL editor:' +
        '<br><code style="display:block;margin-top:10px;font-size:12px">' +
        "update public.forum_profiles set role = 'admin' where id = '" + esc(session.user.id) + "';</code>", false);
      return;
    }

    document.getElementById('ad-gate').style.display = 'none';
    document.getElementById('ad-app').style.display = '';
    document.getElementById('ad-who').textContent = prof.data.display_name;

    document.getElementById('ad-period').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.period = b.dataset.period;
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.getElementById('ad-period-label').textContent = b.textContent;
      load();
    });
    document.getElementById('ad-refresh').onclick = load;
    document.getElementById('ad-csv').onclick = exportCsv;

    load();
  })();
})();
