// MetricMech - Shared site components (header, footer, CadNexa promos)
// Inject the same UI across every page

document.addEventListener('DOMContentLoaded', () => {

  // ========== Notice bar ==========
  const noticeBar = document.querySelector('[data-mw="notice-bar"]');
  if (noticeBar) {
    noticeBar.outerHTML = `
      <div class="notice-bar">
        Free reference, supported by <a href="https://cadnexa.com">CadNexa</a> — inspection &amp; ballooning software for manufacturing QA teams.
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
          <div class="header-search">
            <input type="text" placeholder="Search calculators, standards, articles…" />
          </div>
          <nav class="header-nav">
            <a href="${pathPrefix}calculators.html" class="${currentPage==='calculators'?'current':''}">Calculators</a>
            <a href="${pathPrefix}standards.html" class="${currentPage==='standards'?'current':''}">Standards</a>
            <a href="${pathPrefix}gdt.html" class="${currentPage==='gdt'?'current':''}">GD&amp;T</a>
            <a href="${pathPrefix}templates.html" class="${currentPage==='templates'?'current':''}">Templates</a>
            <a href="${pathPrefix}articles.html" class="${currentPage==='articles'?'current':''}">Articles</a>
          </nav>
        </div>
      </header>
    `;
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
            <div class="footer-supported">Supported by <a href="https://cadnexa.com">CadNexa</a> — inspection software for QA teams</div>
          </div>
          <div class="footer-col">
            <h5>Calculators</h5>
            <a href="${pathPrefix}calculators/tolerance-stack.html">Tolerance Stack</a>
            <a href="${pathPrefix}calculators/position-tolerance.html">Position Tolerance</a>
            <a href="${pathPrefix}calculators/cpk.html">Cp / Cpk</a>
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
            <a href="#">Editorial Standards</a>
            <a href="#">Contributors</a>
            <a href="#">Suggest a Topic</a>
            <a href="#">Contact</a>
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

  // ========== CadNexa Sidebar Promo ==========
  document.querySelectorAll('[data-mw="cn-sidebar"]').forEach(el => {
    el.outerHTML = `
      <div class="cn-promo-card">
        <div class="cn-promo-eyebrow">USED BY READERS OF THIS HUB</div>
        <h3>Stop ballooning drawings <em>by hand.</em></h3>
        <p>CadNexa auto-detects every dimension on any PDF drawing and generates AS9102, PPAP, or ISO 13485 reports in under 10 minutes.</p>
        <a href="https://cadnexa.com" class="cn-promo-cta">Try free for 14 days →</a>
        <div class="cn-promo-foot">No credit card · Indian MSME pricing</div>
      </div>
    `;
  });

  // ========== CadNexa Inline Banner (in articles/calculators) ==========
  document.querySelectorAll('[data-mw="cn-inline"]').forEach(el => {
    const variant = el.dataset.variant || 'default';
    const messages = {
      default: {
        title: 'Spending hours on FAI reports? <em>CadNexa does it in 2 min.</em>',
        sub: 'AI-powered ballooning + AS9102 / PPAP / ISO 13485 reports from any PDF drawing.',
        cta: 'Try CadNexa free →'
      },
      tolerance: {
        title: 'Run this stack-up on your <em>actual 3D model.</em>',
        sub: 'CadNexa opens STEP/IGES in browser, measures features, exports inspection plans.',
        cta: 'Try free for 14 days →'
      },
      gdt: {
        title: 'See GD&amp;T applied to <em>your real drawings.</em>',
        sub: 'CadNexa parses feature control frames with AI Smart Detect — no manual entry.',
        cta: 'Try free →'
      },
      surface: {
        title: 'Capture surface finish callouts <em>automatically.</em>',
        sub: 'CadNexa auto-extracts Ra/Rz callouts from PDF drawings into your FAI report.',
        cta: 'Try free →'
      },
      bolt: {
        title: 'Going from bolt calc to <em>full assembly inspection?</em>',
        sub: 'CadNexa generates AS9102 reports for the entire assembly — bolts, brackets, all features.',
        cta: 'Try CadNexa free →'
      },
      sheet: {
        title: 'Sheet metal FAI reports in <em>under 10 minutes.</em>',
        sub: 'CadNexa auto-balloons every dimension on press-brake parts — flat patterns and bent.',
        cta: 'Try free →'
      },
      machining: {
        title: 'CNC parts going to FAI? <em>CadNexa cuts report time 95%.</em>',
        sub: 'From STEP file to AS9102 / PPAP submission pack in minutes, not days.',
        cta: 'Try free →'
      },
      quality: {
        title: 'Capability data goes into <em>FAI reports too.</em>',
        sub: 'CadNexa lets you attach Cp/Cpk, MSA, and inspection data to characteristic reports.',
        cta: 'Try free →'
      },
      production: {
        title: 'OEE + cost data flows into <em>quotation packs.</em>',
        sub: 'CadNexa includes auto-BOM with weight + cost from Indian material prices.',
        cta: 'Try free →'
      },
      ppap: {
        title: 'Tata, Mahindra, Bajaj PPAPs — <em>standardised in CadNexa.</em>',
        sub: 'Pre-built PPAP variation packs for major Indian OEMs. No more re-formatting.',
        cta: 'Try free →'
      },
      as9102: {
        title: 'Boeing &amp; Airbus FAIs — <em>built into CadNexa.</em>',
        sub: 'AS9102 Form 1, 2, 3 generated automatically from your drawing + measured data.',
        cta: 'Try CadNexa free →'
      },
      cmm: {
        title: 'CMM data merged with drawing balloons <em>automatically.</em>',
        sub: 'CadNexa imports CMM exports and auto-fills measured columns in AS9102 Form 3.',
        cta: 'Try free →'
      }
    };
    const m = messages[variant] || messages.default;
    el.outerHTML = `
      <div class="cn-inline-banner">
        <div class="cn-inline-banner-text">
          <strong>${m.title}</strong>
          <span>${m.sub}</span>
        </div>
        <a href="https://cadnexa.com" class="btn btn-amber btn-sm">${m.cta}</a>
      </div>
    `;
  });

  // ========== CadNexa Big Mid-Page Banner ==========
  document.querySelectorAll('[data-mw="cn-big"]').forEach(el => {
    el.outerHTML = `
      <div class="cn-big-banner">
        <div class="cn-big-banner-inner">
          <div class="cn-big-content">
            <div class="cn-big-eyebrow">SUPPORTED BY CADNEXA</div>
            <h2>This hub is free because <em>CadNexa pays for it.</em></h2>
            <p>If you produce FAI reports manually — circling balloons by hand, typing every dimension into Excel, hoping the OEM accepts it — there's a better way. CadNexa is the inspection software the manufacturing engineers behind this hub use every day.</p>
          </div>
          <div class="cn-big-cta">
            <a href="https://cadnexa.com" class="btn btn-amber btn-lg">Try CadNexa free →</a>
            <span>14-day trial · No card</span>
          </div>
        </div>
      </div>
    `;
  });

  // ========== Sticky Scroll CTA (appears after engagement) ==========
  // Shows a small unobtrusive bottom-right CTA after 45 seconds OR 60% scroll
  // User can dismiss it (sessionStorage remembers for the session)
  if (sessionStorage.getItem('mm_cta_dismissed') !== '1') {
    const stickyHTML = `
      <div id="mm-sticky-cta" class="mm-sticky-cta" role="complementary" aria-label="CadNexa promo">
        <button class="mm-sticky-close" aria-label="Dismiss" onclick="document.getElementById('mm-sticky-cta').remove(); sessionStorage.setItem('mm_cta_dismissed','1');">×</button>
        <div class="mm-sticky-eyebrow">Built by CadNexa</div>
        <div class="mm-sticky-title">Stop ballooning by hand.</div>
        <div class="mm-sticky-sub">Generate AS9102 / PPAP reports from any PDF drawing in 2 minutes.</div>
        <a href="https://cadnexa.com" class="mm-sticky-cta-btn">Try free →</a>
      </div>
    `;
    let shown = false;
    const showStickyCTA = () => {
      if (shown) return;
      shown = true;
      const div = document.createElement('div');
      div.innerHTML = stickyHTML;
      document.body.appendChild(div.firstElementChild);
      // Slide-in animation handled via CSS
      requestAnimationFrame(() => {
        const el = document.getElementById('mm-sticky-cta');
        if (el) el.classList.add('mm-sticky-show');
      });
    };
    // Trigger 1: after 45 seconds
    setTimeout(showStickyCTA, 45000);
    // Trigger 2: after 60% scroll
    window.addEventListener('scroll', () => {
      const scrolled = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrolled > 0.6) showStickyCTA();
    }, { passive: true });
  }

});
