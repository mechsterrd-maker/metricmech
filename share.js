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
    .mm-share-btn.li { background: #0A66C2; color: #fff; border-color: #0A66C2; }
    .mm-share-btn.li:hover { background: #084d92; border-color: #084d92; }
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
      '.notice-bar', '.breadcrumb',
      '[id$="Interpret"] a[href*="cadnexa.com"]'  // strip CadNexa conditional CTAs from PDFs (footer already has them)
    ];

    const clone = source.cloneNode(true);
    stripSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(n => n.remove()));

    // Force single-column layout for clean PDF — overrides 2-column calc-layout/grid
    const layoutOverride = document.createElement('style');
    layoutOverride.textContent = `
      .calc-layout, .calc-grid, .builder-grid, .results, .symbol-grid, .mod-grid {
        display: block !important;
        grid-template-columns: none !important;
      }
      .calc-layout > *, .calc-grid > *, .builder-grid > *, .symbol-grid > *, .mod-grid > * {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin-bottom: 16px !important;
      }
      .results { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
      .result-card, .stat-mini {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    `;

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

    // Force single-column layout in clone — overrides any grid/flex layouts that look bad in portrait PDF
    const styleOverride = document.createElement('style');
    styleOverride.textContent = `
      [data-mm-temp="1"] .calc-layout,
      [data-mm-temp="1"] .builder-grid,
      [data-mm-temp="1"] .results,
      [data-mm-temp="1"] [class*="grid-template"] {
        display: block !important;
        grid-template-columns: none !important;
      }
      [data-mm-temp="1"] .calc-layout > div,
      [data-mm-temp="1"] .builder-grid > div {
        margin-bottom: 16px;
      }
      [data-mm-temp="1"] .results {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 12px;
        margin-bottom: 16px;
      }
      [data-mm-temp="1"] .result-card,
      [data-mm-temp="1"] .res-tile,
      [data-mm-temp="1"] .stat-mini {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      [data-mm-temp="1"] .method-box,
      [data-mm-temp="1"] table {
        margin-top: 16px;
      }
    `;
    wrap.appendChild(styleOverride);

    wrap.innerHTML += `
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
    wrap.appendChild(layoutOverride);
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

    // If content fits on one page, just add it.
    if (imgH <= usableH) {
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin, usableW, imgH);
    } else {
      // Multi-page: slice canvas into chunks, each fitting one page
      // Convert page-usable-height (mm) to canvas pixels
      const pxPerMm = canvas.width / usableW;
      const sliceHpx = Math.floor(usableH * pxPerMm);

      let yPx = 0;
      let pageNum = 0;

      while (yPx < canvas.height) {
        const remainingPx = canvas.height - yPx;
        const thisSliceHpx = Math.min(sliceHpx, remainingPx);

        // Create a slice canvas containing just this page's worth of content
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = thisSliceHpx;
        const ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        // Copy the slice from main canvas
        ctx.drawImage(
          canvas,
          0, yPx,                    // source x, y
          canvas.width, thisSliceHpx, // source width, height
          0, 0,                       // dest x, y
          canvas.width, thisSliceHpx  // dest width, height
        );

        const sliceData = sliceCanvas.toDataURL('image/png');
        // Convert this slice's height back to mm
        const sliceHmm = (thisSliceHpx / pxPerMm);

        if (pageNum > 0) pdf.addPage();
        pdf.addImage(sliceData, 'PNG', margin, margin, usableW, sliceHmm);

        yPx += thisSliceHpx;
        pageNum++;

        if (pageNum > 50) break; // safety
      }
    }

    // Footer on each page — branded with CadNexa funnel
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      // Top line — MetricMech brand
      pdf.setFontSize(8);
      pdf.setTextColor(37, 84, 186);  // blueprint blue
      pdf.text(
        'MetricMech  ·  metricmech.com',
        pageW / 2, pageH - 8, { align: 'center' }
      );
      // Bottom line — CadNexa CTA + page number
      pdf.setFontSize(7);
      pdf.setTextColor(13, 148, 136);  // teal
      pdf.text(
        'Need full FAI / RFQ workflow? Try CadNexa free at cadnexa.com',
        pageW / 2 - 35, pageH - 4, { align: 'left' }
      );
      pdf.setTextColor(120);
      pdf.text(
        'Page ' + i + ' of ' + totalPages,
        pageW - 12, pageH - 4, { align: 'right' }
      );
    }

    pdf.save(opts.filename || 'metricmech-export.pdf');
    toast('PDF downloaded');
  }

  function shareWhatsApp(opts) {
    const lines = [];
    if (opts.title) lines.push('*' + opts.title + '*');
    if (opts.summary) lines.push(opts.summary);
    lines.push('');
    lines.push('🔧 Free calculator: ' + (opts.pageUrl || location.href));
    lines.push('');
    lines.push('Need full FAI / 3D viewer / RFQ? → cadnexa.com');
    const text = encodeURIComponent(lines.join('\n'));
    const url = 'https://wa.me/?text=' + text;
    window.open(url, '_blank', 'noopener');
  }

  function shareLinkedIn(opts) {
    // LinkedIn share endpoint takes only URL — text comes from Open Graph tags
    const u = encodeURIComponent(opts.pageUrl || location.href);
    window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + u, '_blank', 'noopener,width=600,height=600');
  }

  function showEmbedModal(opts) {
    const url = opts.pageUrl || location.href;
    const title = (opts.title || document.title || 'MetricMech calculator').replace(/"/g, '&quot;');
    const embedCode = `<iframe src="${url}?embed=1" width="100%" height="720" frameborder="0" title="${title}" loading="lazy" style="border:1px solid #e2e8f0; border-radius:8px; max-width:900px;"></iframe>\n<p style="font-size:12px; color:#64748b; margin-top:6px;">Calculator by <a href="${url}" target="_blank" rel="noopener">MetricMech</a></p>`;

    // Build modal
    let modal = document.getElementById('mm-embed-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'mm-embed-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:560px;width:100%;padding:26px 28px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <button id="mm-embed-close" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:#64748b;padding:4px 8px;">×</button>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:0.14em;color:#2554BA;font-weight:600;margin-bottom:6px;">Embed this calculator</div>
        <h3 style="font-family:'Inter',sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;margin-bottom:8px;color:#0F172A;">Add to your site or blog</h3>
        <p style="font-size:13px;color:#475569;line-height:1.55;margin-bottom:14px;">Copy this code and paste it where you want the calculator to appear. Works in WordPress, Notion blocks, Confluence, custom sites — any HTML environment.</p>
        <textarea id="mm-embed-code" readonly style="width:100%;height:110px;padding:12px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.5;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;color:#0F172A;resize:vertical;outline:none;">${embedCode.replace(/</g, '&lt;')}</textarea>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
          <button id="mm-embed-copy" style="flex:1;padding:10px 14px;background:linear-gradient(135deg,#2554ba,#0d9488);color:#fff;border:none;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Copy embed code</button>
          <button id="mm-embed-cancel" style="padding:10px 14px;background:#fff;color:#0F172A;border:1px solid #cbd5e1;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;cursor:pointer;">Close</button>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.5;">Your readers can use the calculator inline — no signup. The embed includes a small "by MetricMech" link.</p>
      </div>
    `;
    document.body.appendChild(modal);

    const closeFn = () => modal.remove();
    document.getElementById('mm-embed-close').addEventListener('click', closeFn);
    document.getElementById('mm-embed-cancel').addEventListener('click', closeFn);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeFn(); });
    document.getElementById('mm-embed-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(embedCode);
        const btn = document.getElementById('mm-embed-copy');
        btn.textContent = '✓ Copied to clipboard';
        btn.style.background = '#16a34a';
        setTimeout(closeFn, 900);
      } catch {
        document.getElementById('mm-embed-code').select();
        toast('Press Ctrl+C to copy');
      }
    });
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
      <button class="mm-share-btn li" data-act="li" title="Share on LinkedIn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>
        LinkedIn
      </button>
      <button class="mm-share-btn" data-act="email" title="Share by Email">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email
      </button>
      <button class="mm-share-btn" data-act="link" title="Copy link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Copy link
      </button>
      <button class="mm-share-btn" data-act="embed" title="Embed this calculator on your site">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        Embed
      </button>
    `;

    bar.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mm-share-btn');
      if (!btn) return;
      const act = btn.dataset.act;
      const liveOpts = (typeof opts === 'function') ? opts() : opts;
      if (act === 'pdf') {
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span style="font-size:11px">Generating…</span>';
        try { await generatePDF(liveOpts); } catch (err) { console.error(err); toast('PDF failed'); }
        btn.disabled = false;
        btn.innerHTML = original;
      } else if (act === 'wa') shareWhatsApp(liveOpts);
      else if (act === 'li') shareLinkedIn(liveOpts);
      else if (act === 'email') shareEmail(liveOpts);
      else if (act === 'link') copyLink(liveOpts);
      else if (act === 'embed') showEmbedModal(liveOpts);
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
