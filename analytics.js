// ════════════════════════════════════════════════════════════
// MetricMech · GA4 Event Tracking
// Wires conversion events without touching individual page code.
// ════════════════════════════════════════════════════════════
(function () {
  // Wait for gtag to be available
  function track(name, params) {
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', name, params || {}); }
      catch (e) { /* swallow */ }
    }
  }

  // Expose globally so other scripts (share.js, calculator pages) can fire events
  window.mmTrack = track;

  // ── 1. CADNEXA CTA CLICKS (the funnel signal) ──
  // Any anchor pointing at cadnexa.com fires `cadnexa_cta_click`
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a || !a.href) return;

    // Use try/catch around URL parsing in case href is relative or malformed
    let url;
    try { url = new URL(a.href, window.location.href); }
    catch (err) { return; }

    if (/(^|\.)cadnexa\.com$/.test(url.hostname)) {
      const placement = url.searchParams.get('utm_medium') || 'unknown';
      const campaign = url.searchParams.get('utm_campaign') || '';
      track('cadnexa_cta_click', {
        cta_placement: placement,
        cta_campaign: campaign,
        page_path: window.location.pathname,
        link_text: (a.textContent || '').trim().slice(0, 80)
      });
    }
  }, true);

  // ── 2. PDF DOWNLOADS (engagement signal) ──
  // Hook into share.js — it triggers downloads via blob URLs, so we track at the button-click level
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act="pdf"]');
    if (btn) {
      track('pdf_download', {
        page_path: window.location.pathname,
        calculator: window.location.pathname.split('/').pop().replace('.html','').replace(/-/g,'_')
      });
    }
  }, true);

  // ── 3. CALCULATOR EXECUTION (high-value engagement) ──
  // Fire once per page load when the user actually interacts with calculator inputs
  let _calcFired = false;
  function fireCalc() {
    if (_calcFired) return;
    _calcFired = true;
    track('calculator_run', {
      page_path: window.location.pathname,
      calculator: window.location.pathname.split('/').pop().replace('.html','').replace(/-/g,'_')
    });
  }
  // Available globally for explicit page-level hooks (Cp/Cpk uses this)
  window.mmTrackCalc = fireCalc;

  // Auto-detect: any input/change on a calculator page fires once after a 1s delay
  // (delay avoids firing for drive-by typing — only sticks if user keeps engaging)
  if (window.location.pathname.includes('/calculators/')) {
    let _calcTimer;
    document.addEventListener('input', function (e) {
      if (!e.target.matches('input, textarea, select')) return;
      clearTimeout(_calcTimer);
      _calcTimer = setTimeout(fireCalc, 1000);
    }, true);
  }

  // ── 4. SAVE STUDY (Cp/Cpk specific — power user signal) ──
  window.mmTrackSave = function () {
    track('study_saved', { page_path: window.location.pathname });
  };

  // ── 5. WHAT-IF USED (Cp/Cpk specific) ──
  let _whatIfFired = false;
  window.mmTrackWhatIf = function () {
    if (_whatIfFired) return;
    _whatIfFired = true;
    track('whatif_used', { page_path: window.location.pathname });
  };

  // ── 6. SCROLL DEPTH (passive signal — fires at 50% and 90%) ──
  let _50fired = false, _90fired = false;
  window.addEventListener('scroll', function () {
    const h = document.documentElement;
    const total = h.scrollHeight - h.clientHeight;
    if (total <= 0) return;
    const pct = (h.scrollTop / total) * 100;
    if (!_50fired && pct >= 50) {
      _50fired = true;
      track('scroll_depth', { depth: 50, page_path: window.location.pathname });
    }
    if (!_90fired && pct >= 90) {
      _90fired = true;
      track('scroll_depth', { depth: 90, page_path: window.location.pathname });
    }
  }, { passive: true });

  // ── 7. OUTBOUND LINKS (other than CadNexa) ──
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a || !a.href) return;
    let url;
    try { url = new URL(a.href, window.location.href); } catch (err) { return; }
    if (url.hostname && url.hostname !== window.location.hostname && !/cadnexa\.com$/.test(url.hostname)) {
      track('outbound_click', {
        outbound_url: url.hostname,
        page_path: window.location.pathname
      });
    }
  }, true);
})();
