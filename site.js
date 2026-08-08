// MetricMech — Shared site components (header, footer, CadNexa promos)
// Inject the same UI across every page.

// ── Load analytics.js (GA4 event tracking) — uses data-prefix for portability
(function () {
  const _hdr = document.querySelector('[data-mw="header"]');
  const prefix = (_hdr && _hdr.dataset.prefix) || '';
  const s = document.createElement('script');
  s.src = prefix + 'analytics.js?v=20260808a';
  s.async = true;
  document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', () => {
  // ── EMBED MODE — clean iframe view ──
  if (/[?&]embed=1/.test(window.location.search)) {
    const s = document.createElement('style');
    s.textContent = `
      .grid-bg, .site-header, .notice-bar, .site-footer,
      [data-mw="footer"], [data-mw="cn-big"], .cn-big-banner,
      [data-mw="cn-sidebar"], .cn-promo-card,
      [data-mw="cn-inline"], .cn-inline-banner,
      .mm-rail, .mm-rail-left, #mm-sticky-cta, #mm-install-pill,
      .breadcrumb, .mm-embed-widget { display: none !important; }
      body { background: #fff !important; padding-bottom: 44px !important; }
      .page-header { padding-top: 18px !important; padding-bottom: 14px !important; }
      .page-title { font-size: clamp(20px, 3.5vw, 28px) !important; }
      .page-lede { font-size: 14px !important; }
      main { padding-bottom: 24px !important; }
    `;
    document.head.appendChild(s);
    document.body.classList.add('mm-embed-mode');
  }

  // Compute path prefix for the current page (works for any depth)
  // Uses the header's data-prefix if present, otherwise falls back to detecting from URL
  const _hdr = document.querySelector('[data-mw="header"]');
  const _ftr = document.querySelector('[data-mw="footer"]');
  const siteRoot = (_hdr && _hdr.dataset.prefix) || (_ftr && _ftr.dataset.prefix) || '';

  // ========== Notice bar ==========
  const noticeBar = document.querySelector('[data-mw="notice-bar"]');
  if (noticeBar) {
    noticeBar.outerHTML = `
      <div class="notice-bar">
        Free reference, supported by <a href="https://cadnexa.com">CadNexa</a> — browser-based CAD platform for manufacturing engineers.
      </div>
    `;
  }

  // ========== Header ==========
  const header = document.querySelector('[data-mw="header"]');
  if (header) {
    const currentPage = header.dataset.page || '';
    const pathPrefix = header.dataset.prefix || '';
    header.outerHTML = `
      <header class="site-header">
        <div class="header-inner">
          <a href="${pathPrefix}index.html" class="brand-link">
            <span class="brand-name">Metric<em>Mech</em></span>
            <span class="brand-tag">FREE REFERENCE</span>
          </a>
          <button class="mm-menu-toggle" id="mm-menu-toggle" aria-label="Toggle menu" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="header-search">
            <input type="text" id="mm-header-search" placeholder="Search calculators…" />
          </div>
          <nav class="header-nav" id="mm-header-nav">
            <a href="${pathPrefix}calculators.html" class="${currentPage==='calculators'?'current':''}">Calculators</a>
            <a href="${pathPrefix}reference.html" class="${currentPage==='reference'?'current':''}">Reference</a>
            <a href="${pathPrefix}standards.html" class="${currentPage==='standards'?'current':''}">Standards</a>
            <a href="${pathPrefix}gdt.html" class="${currentPage==='gdt'?'current':''}">GD&amp;T</a>
            <a href="${pathPrefix}templates.html" class="${currentPage==='templates'?'current':''}">Templates</a>
            <a href="${pathPrefix}articles.html" class="${currentPage==='articles'?'current':''}">Articles</a>
            <a href="${pathPrefix}forum.html" class="${currentPage==='forum'?'current':''}">Forum</a>
          </nav>
        </div>
      </header>
    `;

    // Wire hamburger toggle
    const tog = document.getElementById('mm-menu-toggle');
    const nav = document.getElementById('mm-header-nav');
    if (tog && nav) {
      tog.addEventListener('click', () => nav.classList.toggle('open'));
    }

    // Wire up header search — redirect to calculators page with ?q=
    setTimeout(() => {
      const inp = document.getElementById('mm-header-search');
      if (!inp) return;
      const go = () => {
        const q = inp.value.trim();
        if (!q) return;
        window.location.href = pathPrefix + 'calculators.html?q=' + encodeURIComponent(q);
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }, 0);
  }

  // ========== Footer ==========
  const footer = document.querySelector('[data-mw="footer"]');
  if (footer) {
    const pathPrefix = footer.dataset.prefix || '';
    footer.outerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <div>
            <div class="footer-brand">Metric<em>Mech</em></div>
            <p class="footer-about">A free reference for working manufacturing engineers — calculators, standards, GD&amp;T, FAI templates, and articles. Written and reviewed by people who've spent their careers on shop floors and audit rooms.</p>
            <div class="footer-supported">Supported by <a href="https://cadnexa.com">CadNexa</a> — browser CAD platform for QA, estimation &amp; sourcing teams</div>
          </div>
          <div class="footer-col">
            <h5>Calculators</h5>
            <a href="${pathPrefix}calculators/tolerance-stack.html">Tolerance Stack</a>
            <a href="${pathPrefix}calculators/position-tolerance.html">Position Tolerance</a>
            <a href="${pathPrefix}calculators/cp-cpk.html">Cp / Cpk</a>
            <a href="${pathPrefix}calculators/surface-finish.html">Surface Finish</a>
            <a href="${pathPrefix}calculators.html">All calculators →</a>
          </div>
          <div class="footer-col">
            <h5>Standards</h5>
            <a href="${pathPrefix}standards/as9102.html">AS9102</a>
            <a href="${pathPrefix}standards.html">PPAP</a>
            <a href="${pathPrefix}standards.html">ISO 13485</a>
            <a href="${pathPrefix}standards.html">ASME Y14.5</a>
            <a href="${pathPrefix}standards.html">All standards →</a>
          </div>
          <div class="footer-col">
            <h5>Topics</h5>
            <a href="${pathPrefix}gdt.html">GD&amp;T Reference</a>
            <a href="${pathPrefix}articles.html">FAI Reports</a>
            <a href="${pathPrefix}articles.html">CMM Inspection</a>
            <a href="${pathPrefix}articles.html">Materials</a>
            <a href="${pathPrefix}articles.html">All topics →</a>
          </div>
          <div class="footer-col">
            <h5>About</h5>
            <a href="${pathPrefix}forum.html">Forum</a>
            <a href="${pathPrefix}about.html">About MetricMech</a>
            <a href="${pathPrefix}editorial-standards.html">Editorial Standards</a>
            <a href="${pathPrefix}contact.html">Suggest a Topic</a>
            <a href="${pathPrefix}contact.html">Contact</a>
            <a href="https://cadnexa.com">CadNexa</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 MetricMech · Made in India</span>
          <span>Free to use · Citation appreciated</span>
        </div>
      </footer>
    `;
  }

  // ========== CadNexa Sidebar Promo (rotates) ==========
  const sidebarVariants = {
    balloon: {
      eyebrow: 'USED BY READERS OF THIS HUB',
      title: 'Stop ballooning drawings <em>by hand.</em>',
      body: 'CadNexa auto-detects every dimension on any PDF drawing and generates AS9102, PPAP, or ISO 13485 reports in under 10 minutes.',
      cta: 'Try free for 14 days →',
      foot: 'No credit card · Indian MSME pricing'
    },
    viewer: {
      eyebrow: 'USED BY READERS OF THIS HUB',
      title: 'Open STEP &amp; IGES files <em>in your browser.</em>',
      body: 'CadNexa is a 3D CAD viewer that runs in any browser — no SolidWorks license, no installs. Measure features, isolate parts, take section cuts.',
      cta: 'Try free for 14 days →',
      foot: 'STEP · IGES · BREP · STL · 14 formats'
    },
    bom: {
      eyebrow: 'USED BY READERS OF THIS HUB',
      title: 'Auto-BOM with <em>Indian material prices.</em>',
      body: 'Drop a STEP file. CadNexa extracts every part, calculates volume + weight, applies live ₹/kg rates for steel, aluminium, copper, and 40+ Indian materials.',
      cta: 'Try free for 14 days →',
      foot: 'No spreadsheet maintenance'
    },
    estimator: {
      eyebrow: 'USED BY READERS OF THIS HUB',
      title: 'Machining cost in <em>under 60 seconds.</em>',
      body: 'CadNexa estimates CNC cycle time and cost from a 3D model — Indian shop rates, tooling allowances, setup time. Send quotes in minutes, not hours.',
      cta: 'Try free for 14 days →',
      foot: 'India-specific shop rates'
    }
  };

  function pickByPath(variants) {
    const keys = Object.keys(variants);
    const path = window.location.pathname;
    let h = 0;
    for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) & 0xffffffff;
    return variants[keys[Math.abs(h) % keys.length]];
  }

  // Single-CTA policy: sidebar promo removed — the inline auto-ballooning banner
  // (or the big banner on pages without an inline slot) is the ONE CadNexa CTA per page.
  document.querySelectorAll('[data-mw="cn-sidebar"]').forEach(el => el.remove());

  // ========== CadNexa Inline Banner — THE single CTA per page (auto-ballooning) ==========
  // ---- Topic-matched bridge copy (per-page funnel messaging) ----
  const _cnPath = (location.pathname || '').toLowerCase();
  const _cnTopics = [
    [/hardness/, { h: 'Hardness spec checked. <em>Drawing still needs ballooning?</em>', p: 'Upload the PDF — CadNexa\'s AI balloons every dimension and hardness callout, then generates the AS9102 / PPAP inspection report in your browser.', cta: 'Balloon a drawing free', path: 'balloon' }],
    [/gdt|position|flatness|mmc|runout|profile|datum|true-position/, { h: 'Reading GD&T is step one. <em>Ballooning it is step two.</em>', p: 'CadNexa finds every feature control frame on the drawing, balloons it, and writes the FAI report — automatically, in your browser.', cta: 'Try auto-ballooning free', path: 'balloon' }],
    [/thread|bolt|torque|fastener/, { h: 'Thread specs sorted. <em>Documentation next?</em>', p: 'Every thread callout on your drawing, found and ballooned automatically — ready for the AS9102 / PPAP report your customer wants.', cta: 'Balloon a drawing free', path: 'balloon' }],
    [/iso-286|press-fit|fits|tolerance-stack|tolerance/, { h: 'Fit calculated. <em>Now the FAI paperwork?</em>', p: 'CadNexa balloons the drawing and builds the inspection report — fits, tolerances and all — in about 10 minutes, right in your browser.', cta: 'Try auto-ballooning free', path: 'balloon' }],
    [/surface-finish/, { h: 'Ra checked. <em>Now balloon the whole drawing?</em>', p: 'Surface finish callouts, dimensions, tolerances — CadNexa balloons them all in one click and generates your inspection report.', cta: 'Balloon a drawing free', path: 'balloon' }],
    [/bend|sheet/, { h: 'Flat pattern done. <em>Inspection documents next?</em>', p: 'Upload the finished drawing — CadNexa balloons every dimension and generates the first-article report your customer expects.', cta: 'Try auto-ballooning free', path: 'balloon' }],
    [/as9102|ppap|fai|aql|fmea|cp-cpk|gauge|checklist|form/, { h: 'Building FAI / PPAP documents by hand?', p: 'CadNexa turns a raw PDF drawing into a ballooned drawing plus AS9102 Forms 1–3 in minutes — upload, one-click auto-balloon, export.', cta: 'Generate an FAI report free', path: 'app.html' }],
  ];
  const _cnT = (_cnTopics.find(([re]) => re.test(_cnPath)) || [null, { h: 'Auto-balloon your drawings. <em>FAI reports in 10 minutes.</em>', p: 'This hub is free because CadNexa pays for it. Upload a PDF drawing — CadNexa\'s AI balloons every dimension and generates your AS9102 / PPAP / ISO 13485 report in your browser. No installs, no SolidWorks licence.', cta: 'Try auto-ballooning free', path: 'balloon' }])[1];
  
  (function () {
    const slots = document.querySelectorAll('[data-mw="cn-inline"]');
    slots.forEach((el, i) => { if (i > 0) el.remove(); });
    const el = slots[0];
    if (el) {
      const calcMatch = window.location.pathname.match(/\/calculators\/([a-z0-9-]+)/);
      const campaign = calcMatch ? calcMatch[1] : 'page';
      el.outerHTML = `
        <div class="cn-inline-banner">
          <div class="cn-inline-banner-text">
            <strong>${_cnT.h}</strong>
          <span>${_cnT.p}</span>
          </div>
          <a href="https://cadnexa.com/${_cnT.path}?utm_source=metricmech&utm_medium=inline&utm_campaign=${campaign}" class="btn btn-amber btn-sm">${_cnT.cta} →</a>
        </div>
      `;
    }
  })();

  // ========== CadNexa Big Banner — renders only if the page had no inline slot ==========
  (function () {
    const hadInline = document.querySelector('.cn-inline-banner') !== null;
    document.querySelectorAll('[data-mw="cn-big"]').forEach((el, i) => {
      if (hadInline || i > 0) { el.remove(); return; }
      el.outerHTML = `
        <div class="cn-big-banner">
          <div class="cn-big-banner-inner">
            <div class="cn-big-content">
              <div class="cn-big-eyebrow">SUPPORTED BY CADNEXA</div>
              <h2>${_cnT.h}</h2>
              <p>${_cnT.p}</p>
              <div class="cn-big-cta">
                <a href="https://cadnexa.com/${_cnT.path}?utm_source=metricmech&utm_medium=cn-big" class="btn btn-amber btn-lg">${_cnT.cta} →</a>
                <span>14-day trial · No card · From ₹399/mo</span>
              </div>
            </div>
            <div class="cn-big-preview">
              <div class="cn-big-preview-label">LIVE PRODUCT</div>
              <img src="${siteRoot}images/mm-balloon-ui-banner.jpg" alt="CadNexa AI ballooning on engineering drawing" loading="lazy" class="cn-big-preview-stack" />
            </div>
          </div>
        </div>
      `;
    });
  })();

  // Sticky scroll CTA removed — single-CTA policy.

  // Right/left rail CTAs removed — single-CTA policy.

  // ========== PWA: Service worker + Install pill ==========
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(siteRoot + 'sw.js').catch(() => {});
  }

  const _isStandalone = window.matchMedia('(display-mode: standalone)').matches
                     || window.navigator.standalone === true;

  if (!_isStandalone && sessionStorage.getItem('mm_install_dismissed') !== '1') {
    let _deferredPrompt = null;
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;
    const isAndroid = /Android/i.test(ua);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      _deferredPrompt = e;
      buildPill();
    });

    if (isIOS) setTimeout(buildPill, 3000);
    if (!isIOS && !isAndroid) {
      setTimeout(() => {
        if (!document.getElementById('mm-install-pill') && !_deferredPrompt) buildPill();
      }, 5000);
    }

    // Listen for explicit "Install as app" card click
    window.addEventListener('mm-trigger-install', function() {
      // Clear any prior dismissal
      sessionStorage.removeItem('mm_install_dismissed');
      if (_deferredPrompt) {
        _deferredPrompt.prompt();
        _deferredPrompt.userChoice.then(function(choice) {
          if (choice.outcome === 'accepted') sessionStorage.setItem('mm_install_dismissed', '1');
          _deferredPrompt = null;
        });
      } else if (isIOS) {
        showInstructions('ios');
      } else {
        showInstructions('desktop');
      }
    });

    function buildPill() {
      if (document.getElementById('mm-install-pill')) return;
      const pill = document.createElement('div');
      pill.id = 'mm-install-pill';
      pill.className = 'mm-install-pill';
      pill.innerHTML = `
        <button class="mm-install-close" aria-label="Dismiss">×</button>
        <div class="mm-install-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div class="mm-install-text">
          <strong>Install MetricMech</strong>
          <span>One-tap reference on your home screen</span>
        </div>
        <button class="mm-install-btn">Install</button>
      `;
      document.body.appendChild(pill);
      requestAnimationFrame(() => pill.classList.add('mm-install-show'));

      pill.querySelector('.mm-install-close').addEventListener('click', () => {
        pill.classList.remove('mm-install-show');
        setTimeout(() => pill.remove(), 300);
        sessionStorage.setItem('mm_install_dismissed', '1');
      });

      pill.querySelector('.mm-install-btn').addEventListener('click', async () => {
        if (_deferredPrompt) {
          _deferredPrompt.prompt();
          const { outcome } = await _deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            pill.classList.remove('mm-install-show');
            setTimeout(() => pill.remove(), 300);
            sessionStorage.setItem('mm_install_dismissed', '1');
          }
          _deferredPrompt = null;
        } else if (isIOS) {
          showInstructions('ios');
        } else {
          showInstructions('desktop');
        }
      });
    }

    function showInstructions(platform) {
      const modal = document.createElement('div');
      modal.className = 'mm-install-modal';
      const inner = platform === 'ios' ? `
        <h3>Install on iPhone / iPad</h3>
        <ol>
          <li>Tap the <strong>Share</strong> icon at the bottom of Safari</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>"Add"</strong> in the top-right corner</li>
        </ol>
        <p class="mm-install-modal-foot">MetricMech will appear on your home screen like a native app.</p>
      ` : `
        <h3>Install on Desktop</h3>
        <p><strong>Chrome / Edge:</strong> Click the install icon at the right side of the address bar (looks like a small computer with an arrow).</p>
        <p><strong>Safari (Mac):</strong> File menu → Add to Dock</p>
        <p><strong>Firefox:</strong> Doesn\'t support installing yet — please bookmark instead (Ctrl/Cmd+D).</p>
        <p class="mm-install-modal-foot">Once installed, MetricMech opens in its own window — no browser tabs needed.</p>
      `;
      modal.innerHTML = `
        <div class="mm-install-modal-card">
          <button class="mm-install-modal-close" aria-label="Close">×</button>
          <div class="mm-install-modal-icon"><img src="${siteRoot}icons/icon-192.png" alt="MetricMech" width="64" height="64"></div>
          ${inner}
        </div>
      `;
      document.body.appendChild(modal);
      requestAnimationFrame(() => modal.classList.add('mm-install-modal-show'));
      const close = () => {
        modal.classList.remove('mm-install-modal-show');
        setTimeout(() => modal.remove(), 250);
      };
      modal.querySelector('.mm-install-modal-close').addEventListener('click', close);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }

    window.addEventListener('appinstalled', () => {
      const pill = document.getElementById('mm-install-pill');
      if (pill) {
        pill.classList.remove('mm-install-show');
        setTimeout(() => pill.remove(), 300);
      }
      sessionStorage.setItem('mm_install_dismissed', '1');
    });
  }

  // ========== Embed Feature: widget on calculator pages + attribution footer in ?embed=1 view ==========
  // Backlink-generating: engineering blogs, course pages, and wikis can paste the iframe code
  // with required visible attribution. Every embed = one dofollow link back to MetricMech.
  (function setupEmbedFeature() {
    const isEmbed = /[?&]embed=1/.test(window.location.search);
    const calcMatch = window.location.pathname.match(/\/calculators\/([a-z0-9-]+)\.html/);
    if (!calcMatch) return;

    const slug = calcMatch[1];
    const calcUrl = 'https://metricmech.com/calculators/' + slug;
    const rawTitle = (document.title.split('|')[0] || '').trim();
    const calcTitle = rawTitle.split('—')[0].trim() || 'MetricMech Calculator';

    if (isEmbed) {
      // ── Embed view: inject the fixed attribution footer that travels with the iframe ──
      const css = document.createElement('style');
      css.textContent = `
        .mm-embed-attrib { position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999; background: #0a1628; color: #fff; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.4; }
        .mm-embed-attrib a { color: #fff; text-decoration: none; display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; transition: background 0.2s; gap: 12px; }
        .mm-embed-attrib a:hover { background: #112340; }
        .mm-embed-attrib strong { font-weight: 700; }
        .mm-embed-attrib .mm-embed-attrib-cta { opacity: 0.85; font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; font-size: 11px; letter-spacing: 0.04em; white-space: nowrap; }
        @media (max-width: 480px) { .mm-embed-attrib .mm-embed-attrib-cta { font-size: 10px; } }
      `;
      document.head.appendChild(css);

      const footerEl = document.createElement('div');
      footerEl.className = 'mm-embed-attrib';
      footerEl.innerHTML = `
        <a href="${calcUrl}" target="_top" rel="noopener" title="Open ${calcTitle} on MetricMech">
          <span>Powered by <strong>MetricMech</strong></span>
          <span class="mm-embed-attrib-cta">Open full calculator ↗</span>
        </a>
      `;
      document.body.appendChild(footerEl);
      return;
    }

    // ── Non-embed view: inject the "Embed this calculator" widget for visitors to copy ──
    const cssEl = document.createElement('style');
    cssEl.textContent = `
      .mm-embed-widget { max-width: var(--max-w, 1200px); margin: 32px auto 16px; padding: 0 32px; box-sizing: border-box; }
      .mm-embed-card { background: var(--paper-2, #f5f5f5); border: 1px solid var(--rule, #e0e0e0); border-radius: var(--rad-lg, 12px); padding: 28px 32px; }
      .mm-embed-card .mm-embed-eyebrow { font-family: var(--mono, 'JetBrains Mono', monospace); font-size: 10px; color: var(--blueprint, #1565C0); font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 8px; }
      .mm-embed-card .mm-embed-title { font-family: var(--display, system-ui); font-size: 22px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.01em; color: var(--ink, #0a1628); }
      .mm-embed-card .mm-embed-title em { font-style: italic; color: var(--blueprint, #1565C0); font-weight: 500; }
      .mm-embed-card .mm-embed-desc { font-size: 14px; line-height: 1.55; color: var(--ink-2, #444); margin: 0 0 16px; max-width: 720px; }
      .mm-embed-card .mm-embed-sizes { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
      .mm-embed-card .mm-embed-size { font-family: var(--mono, monospace); font-size: 11px; padding: 8px 12px; border: 1px solid var(--rule, #ccc); background: white; color: var(--ink, #222); border-radius: var(--rad, 6px); cursor: pointer; text-transform: uppercase; letter-spacing: 0.06em; transition: all 0.15s; }
      .mm-embed-card .mm-embed-size:hover { border-color: var(--ink, #0a1628); }
      .mm-embed-card .mm-embed-size-active { background: var(--ink, #0a1628); color: white; border-color: var(--ink, #0a1628); }
      .mm-embed-card .mm-embed-code { width: 100%; min-height: 160px; padding: 12px 14px; font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; font-size: 12px; line-height: 1.6; border: 1px solid var(--rule, #ddd); border-radius: var(--rad, 6px); background: white; color: var(--ink, #0a1628); resize: vertical; margin-bottom: 10px; box-sizing: border-box; white-space: pre; }
      .mm-embed-card .mm-embed-code:focus { outline: 2px solid var(--blueprint, #1565C0); outline-offset: -2px; }
      .mm-embed-card .mm-embed-copy { font-family: var(--mono, monospace); font-size: 12px; padding: 10px 20px; background: var(--blueprint, #1565C0); color: white; border: none; border-radius: var(--rad, 6px); cursor: pointer; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; transition: background 0.15s; }
      .mm-embed-card .mm-embed-copy:hover { background: #0c4ca0; }
      .mm-embed-card .mm-embed-copy-done { background: #2E7D32 !important; }
      .mm-embed-card .mm-embed-foot { font-size: 12px; color: var(--mute, #888); margin: 14px 0 0; line-height: 1.55; }
      .mm-embed-card .mm-embed-foot a { color: var(--blueprint, #1565C0); }
      @media (max-width: 700px) {
        .mm-embed-widget { padding: 0 18px; }
        .mm-embed-card { padding: 22px 20px; }
        .mm-embed-card .mm-embed-title { font-size: 19px; }
      }
    `;
    document.head.appendChild(cssEl);

    const widget = document.createElement('section');
    widget.className = 'mm-embed-widget';
    widget.setAttribute('aria-label', 'Embed this calculator');
    widget.innerHTML = `
      <div class="mm-embed-card">
        <div class="mm-embed-eyebrow">FREE TO EMBED · ATTRIBUTION REQUIRED</div>
        <h3 class="mm-embed-title">Embed this calculator <em>on your site.</em></h3>
        <p class="mm-embed-desc">Copy the code below and paste it anywhere — engineering blog, course page, wiki, internal tooling. The PDF export, charts, and verdict logic all work identically inside the embed. The "Powered by MetricMech" footer travels with the iframe and must remain visible.</p>
        <div class="mm-embed-sizes" role="tablist" aria-label="Embed size">
          <button type="button" class="mm-embed-size" data-w="560" data-h="640" role="tab" aria-selected="false">Compact 560 × 640</button>
          <button type="button" class="mm-embed-size mm-embed-size-active" data-w="640" data-h="800" role="tab" aria-selected="true">Standard 640 × 800</button>
          <button type="button" class="mm-embed-size" data-w="640" data-h="1000" role="tab" aria-selected="false">Tall 640 × 1000</button>
        </div>
        <textarea class="mm-embed-code" readonly rows="8" aria-label="Embed code (HTML)" spellcheck="false"></textarea>
        <button type="button" class="mm-embed-copy" aria-label="Copy embed code to clipboard">Copy code</button>
        <p class="mm-embed-foot">By embedding, you agree to keep the "Powered by MetricMech" attribution visible. See the <a href="/editorial-standards" target="_blank" rel="noopener">editorial standards</a> for full citation policy. Spot a bug in the calculator? <a href="https://github.com/mechsterrd-maker/metricmech/issues/new" target="_blank" rel="noopener">File an issue</a>.</p>
      </div>
    `;

    // Insert before footer placeholder if present, else append to body
    const footerEl = document.querySelector('[data-mw="footer"]');
    if (footerEl && footerEl.parentNode) {
      footerEl.parentNode.insertBefore(widget, footerEl);
    } else {
      document.body.appendChild(widget);
    }

    const codeArea = widget.querySelector('.mm-embed-code');
    const buildCode = (w, h) => `<iframe
  src="${calcUrl}?embed=1"
  width="100%"
  height="${h}"
  style="max-width: ${w}px; border: 1px solid #e0e0e0; border-radius: 6px; display: block;"
  loading="lazy"
  title="${calcTitle} — MetricMech"
></iframe>
<p style="font-size: 12px; color: #666; margin: 6px 0 0; max-width: ${w}px;">
  <a href="${calcUrl}" target="_blank" rel="noopener">${calcTitle}</a> by <a href="https://metricmech.com" target="_blank" rel="noopener">MetricMech</a> — free engineering reference
</p>`;
    codeArea.value = buildCode(640, 800);

    widget.querySelectorAll('.mm-embed-size').forEach(btn => {
      btn.addEventListener('click', () => {
        widget.querySelectorAll('.mm-embed-size').forEach(b => {
          b.classList.remove('mm-embed-size-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('mm-embed-size-active');
        btn.setAttribute('aria-selected', 'true');
        codeArea.value = buildCode(parseInt(btn.dataset.w, 10), parseInt(btn.dataset.h, 10));
      });
    });

    const copyBtn = widget.querySelector('.mm-embed-copy');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codeArea.value);
      } catch (e) {
        codeArea.select();
        try { document.execCommand('copy'); } catch (_) {}
      }
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied ✓';
      copyBtn.classList.add('mm-embed-copy-done');
      // GA4 event for copy action
      if (typeof gtag === 'function') {
        gtag('event', 'embed_code_copy', { calculator: slug });
      }
      setTimeout(() => {
        copyBtn.textContent = orig;
        copyBtn.classList.remove('mm-embed-copy-done');
      }, 2000);
    });
  })();

});


// ---- Funnel analytics: tag every CadNexa link with the source page so GA4 shows which pages convert ----
function _cnxTagLinks() {
  try {
    const camp = (location.pathname.replace(/\.html$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'home').slice(0, 60);
    document.querySelectorAll('a[href*="cadnexa.com"]').forEach(a => {
      try {
        const u = new URL(a.href);
        if (!u.searchParams.get('utm_source')) u.searchParams.set('utm_source', 'metricmech');
        if (!u.searchParams.get('utm_medium')) u.searchParams.set('utm_medium', 'link');
        u.searchParams.set('utm_campaign', camp);
        a.href = u.toString();
      } catch (_) {}
    });
  } catch (_) {}
}
_cnxTagLinks();
document.addEventListener('DOMContentLoaded', _cnxTagLinks);
setTimeout(_cnxTagLinks, 900);
