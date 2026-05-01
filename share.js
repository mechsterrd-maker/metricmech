// MetricMech — shared share + clean PDF helper
// Usage:
//   mmShare({
//     title: 'AS9102 Form 3 — Bracket Mounting',     // popup heading
//     subject: 'AS9102 FAI Report',                  // email subject
//     filename: 'fai-2026-001.pdf',                  // pdf download filename
//     pdfElement: document.getElementById('print-area'),  // DOM element to capture
//     summary: '8 chars · 4 pass · 1 fail',          // short summary line for share
//     pageUrl: location.href                          // url shared to whatsapp/email
//   });
//
// Renders 4 buttons: PDF, WhatsApp, Email, Copy Link.

(function () {
  // Lazy-load jsPDF + html2canvas only when first share button is clicked
  let _libsLoading = null;
  function loadLibs() {
    if (window.jspdf && window.html2canvas) return Promise.resolve();
    if (_libsLoading) return _libsLoading;
    _libsLoading = Promise.all([
      new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      }),
      new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      })
    ]);
    return _libsLoading;
  }

  // Inject button styles once
  const css = `
    .mm-share-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
    .mm-share-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px; font-family: var(--mono, monospace); font-size: 11px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
      border: 1px solid var(--rule-strong, #c8ccd4); background: var(--paper, #fff);
      color: var(--ink, #1a1f2e); border-radius: var(--rad, 6px); cursor: pointer;
      transition: all 0.15s; flex: 1; justify-content: center; min-width: 100px;
    }
    .mm-share-btn:hover { background: var(--paper-2, #f5f5f0); border-color: var(--ink, #1a1f2e); }
    .mm-share-btn.primary { background: var(--ink, #1a1f2e); color: var(--paper, #fff); border-color: var(--ink, #1a1f2e); }
    .mm-share-btn.primary:hover { background: var(--blueprint, #2554ba); border-color: var(--blueprint, #2554ba); }
    .mm-share-btn.wa { background: #25D366; color: #fff; border-color: #25D366; }
    .mm-share-btn.wa:hover { background: #1ebe5d; border-color: #1ebe5d; }
    .mm-share-btn[disabled] { opacity: 0.6; cursor: wait; }
    .mm-toast {
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      background: var(--ink, #1a1f2e); color: var(--paper, #fff);
      padding: 12px 20px; border-radius: var(--rad, 6px); font-size: 13px;
      font-family: var(--display, system-ui); font-weight: 500;
      z-index: 99999; opacity: 0; transition: opacity 0.2s; pointer-events: none;
    }
    .mm-toast.show { opacity: 1; }
  `;
  if (!document.getElementById('mm-share-css')) {
    const s = document.createElement('style');
    s.id = 'mm-share-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function toast(msg) {
    let t = document.getElementById('mm-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mm-toast';
      t.className = 'mm-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // Build a clean off-screen capture target from <main> content, stripping promos
  function buildSmartCapture(opts) {
    const sourceSel = opts.captureSource || 'main';
    const source = document.querySelector(sourceSel);
    if (!source) return null;

    // Selectors of elements we DO NOT want in the PDF
    const stripSelectors = [
      '[data-mw="cn-sidebar"]', '[data-mw="cn-inline"]', '[data-mw="cn-big"]',
      '.cn-promo-card', '.cn-inline-banner', '.cn-big-banner',
      '.cn-3d-cta',
      '#mm-sticky-cta', '.mm-sticky-cta',
      '.mm-rail', '.mm-rail-left',
      '#shareBarMount', '.mm-share-bar',
      'aside', '.action-bar',
      'script', 'noscript',
      '.notice-bar', '.breadcrumb'
    ];

    const clone = source.cloneNode(true);
    stripSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(n => n.remove()));

    // Convert form inputs/selects/textareas to plain text spans (so values are captured)
    clone.querySelectorAll('input, select, textarea').forEach(el => {
      const span = document.createElement('span');
      let val = '';
      if (el.tagName === 'SELECT') {
        const opt = el.options[el.selectedIndex];
        val = opt ? opt.textContent : '';
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        val = el.checked ? '✓' : '—';
      } else {
        val = el.value || el.placeholder || '—';
      }
      span.textContent = val;
      span.style.cssText = 'display: inline-block; padding: 4px 8px; background: #f5f5f0; border-radius: 4px; font-family: inherit; font-weight: 600; min-width: 40px;';
      el.replaceWith(span);
    });

    // Strip interactive buttons but keep informational ones
    clone.querySelectorAll('button').forEach(b => b.remove());

    // Wrap in clean A4-style frame
    const wrap = document.createElement('div');
    wrap.dataset.mmTemp = '1';
    wrap.style.cssText = 'position: absolute; left: -10000px; top: 0; width: 800px; padding: 40px; background: #fff; font-family: \"Inter Tight\", system-ui, sans-serif; color: #1a1f2e;';
    wrap.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #1a1f2e; margin-bottom: 22px;">
        <div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; color: #888; text-transform: uppercase; margin-bottom: 6px;">${escapeHtml(opts.kicker || 'MetricMech Calculator')}</div>
          <div style="font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600;">${escapeHtml(opts.title || 'Calculation Result')}</div>
        </div>
        <div style="text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #888;">
          MetricMech<br>metricmech.com<br><span style="font-size: 9px;">${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    `;
    wrap.appendChild(clone);

    document.body.appendChild(wrap);
    return wrap;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  async function generatePDF(opts) {
    await loadLibs();
    const { jsPDF } = window.jspdf;

    let captureEl = opts.pdfElement;

    // Smart-capture mode: clone <main>, strip promos, wrap in clean A4 frame
    if (!captureEl && opts.smartCapture) {
      captureEl = buildSmartCapture(opts);
    }

    if (!captureEl) { toast('PDF target not found'); return; }
    const isTemp = captureEl.dataset && captureEl.dataset.mmTemp === '1';

    // Render element to canvas at 2x for crispness
    const canvas = await window.html2canvas(captureEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    if (isTemp) captureEl.remove();

    // Page setup — A4 portrait
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const imgRatio = canvas.height / canvas.width;
    const imgH = usableW * imgRatio;

    const imgData = canvas.toDataURL('image/png');

    // If content fits on one page, just add it.
    if (imgH <= usableH) {
      pdf.addImage(imgData, 'PNG', margin, margin, usableW, imgH);
    } else {
      // Multi-page: place the SAME image on each page at progressively higher Y offsets,
      // and clip via page boundaries. This is the standard reliable approach for jsPDF + html2canvas.
      let heightLeft = imgH;
      let position = 0; // current Y offset on page (negative as we go down the canvas)
      let pageNum = 0;

      while (heightLeft > 0) {
        if (pageNum > 0) pdf.addPage();
        // Place the full image, with top-Y shifted up by `position` so the next strip is visible
        pdf.addImage(imgData, 'PNG', margin, margin + position, usableW, imgH);
        // Mask the area outside usableH on this page (jsPDF doesn't auto-clip — but image overflow is fine,
        // it just gets clipped to the page edge). Each page shows usableH worth of content.
        heightLeft -= usableH;
        position -= usableH;
        pageNum++;

        // Safety break — no PDF should be > 50 pages from a calculator
        if (pageNum > 50) break;
      }
    }

    // Footer on each page
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(
        'Generated free at metricmech.com  ·  Page ' + i + ' of ' + totalPages,
        pageW / 2, pageH - 5, { align: 'center' }
      );
    }

    pdf.save(opts.filename || 'metricmech-export.pdf');
    toast('PDF downloaded');
  }

  function shareWhatsApp(opts) {
    const lines = [];
    if (opts.title) lines.push(opts.title);
    if (opts.summary) lines.push(opts.summary);
    lines.push('');
    lines.push('Generated free at ' + (opts.pageUrl || location.href));
    const text = encodeURIComponent(lines.join('\n'));
    const url = 'https://wa.me/?text=' + text;
    window.open(url, '_blank', 'noopener');
  }

  function shareEmail(opts) {
    const subject = encodeURIComponent(opts.subject || opts.title || 'MetricMech calculation');
    const lines = [];
    if (opts.title) lines.push(opts.title);
    if (opts.summary) lines.push(opts.summary);
    lines.push('');
    lines.push('Open the calculator: ' + (opts.pageUrl || location.href));
    lines.push('');
    lines.push('— MetricMech (free engineering calculators)');
    const body = encodeURIComponent(lines.join('\n'));
    const mailtoUrl = 'mailto:?subject=' + subject + '&body=' + body;
    // Use a temporary anchor click — most reliable across browsers (Chrome blocks mailto via location.href silently when no handler is registered, but the user is still prompted to pick one)
    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.target = '_self';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
    toast('Opening your email app…');
  }

  async function copyLink(opts) {
    const url = opts.pageUrl || location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard');
    } catch (e) {
      // Fallback: temporary input
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Link copied to clipboard'); }
      catch (e2) { toast('Copy failed'); }
      document.body.removeChild(ta);
    }
  }

  // Render the share bar inside a target container
  function renderInto(containerSelector, opts) {
    const container = (typeof containerSelector === 'string')
      ? document.querySelector(containerSelector) : containerSelector;
    if (!container) return null;

    const bar = document.createElement('div');
    bar.className = 'mm-share-bar';
    bar.innerHTML = `
      <button class="mm-share-btn primary" data-act="pdf" title="Download as PDF">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        PDF
      </button>
      <button class="mm-share-btn wa" data-act="wa" title="Share on WhatsApp">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
        WhatsApp
      </button>
      <button class="mm-share-btn" data-act="email" title="Share by Email">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email
      </button>
      <button class="mm-share-btn" data-act="link" title="Copy link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Copy link
      </button>
    `;

    bar.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mm-share-btn');
      if (!btn) return;
      const act = btn.dataset.act;
      // Recompute opts on click in case the form has updated values
      const liveOpts = (typeof opts === 'function') ? opts() : opts;
      if (act === 'pdf') {
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span style="font-size:11px">Generating…</span>';
        try { await generatePDF(liveOpts); } catch (err) { console.error(err); toast('PDF failed'); }
        btn.disabled = false;
        btn.innerHTML = original;
      } else if (act === 'wa') shareWhatsApp(liveOpts);
      else if (act === 'email') shareEmail(liveOpts);
      else if (act === 'link') copyLink(liveOpts);
    });

    container.appendChild(bar);
    return bar;
  }

  // One-line integration: mmShare.auto({ kicker: 'AS9102 Form 3', filenameSlug: 'fai' })
  // Auto-detects page title from .page-title, mounts share bar before <main>'s closing or after #shareBarMount,
  // wires up smartCapture for PDF.
  function autoMount(opts) {
    opts = opts || {};
    // Auto title from page-title if not provided
    if (!opts.title) {
      const titleEl = document.querySelector('.page-title');
      if (titleEl) {
        opts.title = titleEl.textContent.trim().replace(/\.$/, '');
      } else {
        opts.title = document.title.split('—')[0].trim();
      }
    }
    if (!opts.subject) opts.subject = (opts.kicker ? opts.kicker + ' — ' : '') + opts.title;
    if (!opts.filename) {
      const slug = (opts.filenameSlug || opts.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 40);
      opts.filename = slug + '.pdf';
    }

    // Find mount target — explicit #shareBarMount, or create one before <main>'s last child
    let mount = document.getElementById('shareBarMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'shareBarMount';
      mount.style.cssText = 'max-width: var(--max-w, 1280px); margin: 32px auto 0; padding: 0 32px;';
      const main = document.querySelector('main');
      if (main) {
        // Insert before any cn-big or footer-related elements
        const cnBig = main.querySelector('[data-mw="cn-big"]');
        if (cnBig) main.insertBefore(mount, cnBig);
        else main.appendChild(mount);
      } else {
        document.body.appendChild(mount);
      }
    }

    return renderInto(mount, () => {
      const liveOpts = Object.assign({}, opts);
      liveOpts.smartCapture = true;
      liveOpts.captureSource = opts.captureSource || 'main';
      liveOpts.pageUrl = location.href;

      // Allow caller to provide live summary (function form)
      if (typeof opts.summary === 'function') {
        liveOpts.summary = opts.summary();
      }
      return liveOpts;
    });
  }

  // Public API
  window.mmShare = {
    auto: autoMount,
    renderInto: renderInto,
    pdf: generatePDF,
    whatsapp: shareWhatsApp,
    email: shareEmail,
    copyLink: copyLink
  };
})();
