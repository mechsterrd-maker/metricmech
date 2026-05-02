// ─────────────────────────────────────────────────────────────
// MetricMech interpretation library — used by all calculators
// Provides: verdict banner, recommendation list, conditional CadNexa CTA
//
// Usage:
//   mmInterpret.render('mountId', {
//     verdict: { level: 'good'|'warn'|'bad'|'critical', label, sub },
//     recommendations: [{ type: 'ok'|'info'|'warn'|'critical', title, detail }],
//     cta: { show: true, severity: 'critical'|'marginal'|'good',
//            calc: 'gauge-rr', headline, sub, ctaText }
//   });
// ─────────────────────────────────────────────────────────────

(function() {
  if (window.mmInterpret) return;

  const VERDICT_STYLES = {
    good:     { bg: '#DCFCE7', border: '#16A34A', icon: '✓' },
    warn:     { bg: '#FEF3C7', border: '#F59E0B', icon: '!' },
    bad:      { bg: '#FEE2E2', border: '#DC2626', icon: '✕' },
    critical: { bg: '#FEE2E2', border: '#7F1D1D', icon: '✕' },
  };

  const RECO_STYLES = {
    ok:       { bg: '#DCFCE7', border: '#16A34A' },
    info:     { bg: '#EFF4FC', border: '#2554BA' },
    warn:     { bg: '#FEF3C7', border: '#F59E0B' },
    critical: { bg: '#FEE2E2', border: '#DC2626' },
  };

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderVerdict(v) {
    if (!v) return '';
    const s = VERDICT_STYLES[v.level] || VERDICT_STYLES.warn;

    // Risk mapping based on level
    const riskMap = {
      good:     { label: 'LOW', bg: '#DCFCE7', color: '#15803D' },
      warn:     { label: 'MEDIUM', bg: '#FEF3C7', color: '#A16207' },
      bad:      { label: 'HIGH', bg: '#FEE2E2', color: '#B91C1C' },
      critical: { label: 'CRITICAL', bg: '#FEE2E2', color: '#7F1D1D' },
    };
    const r = riskMap[v.level] || riskMap.warn;

    // Build structured Status / Risk / Action rows if action provided
    const structuredRows = v.action ? `
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed ${s.border}66;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${s.border}; align-self: center;">Status</div>
        <div style="font-size: 12.5px; color: #0F172A; font-weight: 600;">${escapeHtml(v.label)}</div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${s.border}; align-self: center;">Risk</div>
        <div><span style="display: inline-block; padding: 2px 8px; background: ${r.bg}; color: ${r.color}; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; border-radius: 3px;">${r.label}</span></div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${s.border}; align-self: start; padding-top: 1px;">Action</div>
        <div style="font-size: 12.5px; color: #0F172A; line-height: 1.5;">${escapeHtml(v.action)}</div>
      </div>
    ` : '';

    return `
      <div style="display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; background: ${s.bg}; border: 1px solid ${s.border}; border-left: 4px solid ${s.border}; border-radius: 10px; margin-top: 16px;">
        <div style="flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: ${s.border}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;">${s.icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: ${s.border}; margin-bottom: 4px; text-transform: uppercase;">${escapeHtml(v.label)}</div>
          <div style="font-size: 13px; color: #1E293B; line-height: 1.5;">${v.sub || ''}</div>
          ${structuredRows}
        </div>
      </div>
    `;
  }

  function renderNextSteps(steps) {
    if (!steps || !steps.length) return '';
    return `
      <div style="margin-top: 16px; padding: 16px 18px; background: linear-gradient(135deg, #EFF4FC 0%, #DBE5F8 100%); border: 1px solid #2554BA33; border-radius: 10px;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.14em; color: #2554BA; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          Next steps
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${steps.map((step, i) => `
            <a href="${escapeHtml(step.href)}" style="display: flex; gap: 12px; align-items: center; padding: 10px 12px; background: #fff; border: 1px solid #2554BA22; border-radius: 6px; text-decoration: none; color: #0F172A; transition: all 0.15s;" onmouseover="this.style.borderColor='#2554BA';this.style.transform='translateX(2px)'" onmouseout="this.style.borderColor='#2554BA22';this.style.transform=''">
              <div style="width: 22px; height: 22px; border-radius: 50%; background: #2554BA; color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; flex-shrink: 0;">${i+1}</div>
              <div style="flex: 1;">
                <div style="font-size: 13px; font-weight: 600; color: #0F172A;">${escapeHtml(step.text)}</div>
                ${step.desc ? `<div style="font-size: 11.5px; color: #64748B; margin-top: 1px;">${escapeHtml(step.desc)}</div>` : ''}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2554BA" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderRecos(recos) {
    if (!recos || !recos.length) return '';
    return `
      <div style="margin-top: 16px; padding: 18px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em; color: #2554BA; margin-bottom: 12px; font-weight: 600;">Recommended actions</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${recos.map(r => {
            const c = RECO_STYLES[r.type] || RECO_STYLES.info;
            return `<div style="padding: 12px 14px; background: ${c.bg}; border-left: 3px solid ${c.border}; border-radius: 4px;">
              <div style="font-weight: 700; font-size: 13px; color: #0F172A; margin-bottom: 4px;">${escapeHtml(r.title)}</div>
              <div style="font-size: 12.5px; color: #334155; line-height: 1.55;">${r.detail || ''}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderCta(cta) {
    if (!cta || !cta.show) return '';
    const sev = cta.severity || 'marginal';
    const slug = cta.calc || 'general';
    return `
      <a href="https://cadnexa.com?utm_source=metricmech&utm_medium=${slug}_cta&utm_campaign=${sev}" target="_blank" rel="noopener"
         style="display: block; text-decoration: none; background: linear-gradient(135deg, #0a1628 0%, #162a45 50%, #0f3a3a 100%); color: #fff; border-radius: 10px; padding: 22px 24px; position: relative; overflow: hidden; margin-top: 18px;">
        <div style="position: absolute; top: -80px; right: -80px; width: 240px; height: 240px; background: radial-gradient(circle, rgba(13,148,136,0.22) 0%, transparent 70%); pointer-events: none;"></div>
        <div style="position: relative;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #2554ba, #0d9488); display: flex; align-items: center; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #74d9b6; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 600;">CadNexa · ${escapeHtml(cta.eyebrow || 'Engineering platform')}</div>
          </div>
          <div style="font-family: 'Inter', sans-serif; font-size: 19px; font-weight: 700; line-height: 1.3; letter-spacing: -0.02em; margin-bottom: 8px; color: #fff;">${escapeHtml(cta.headline)}</div>
          <div style="font-size: 13px; line-height: 1.55; color: rgba(255,255,255,0.78); margin-bottom: 14px; max-width: 540px;">${escapeHtml(cta.sub || '')}</div>
          <div style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; background: linear-gradient(135deg, #2554ba, #0d9488); color: #fff; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; box-shadow: 0 2px 12px rgba(13,148,136,0.32);">${escapeHtml(cta.ctaText || 'Try in CadNexa →')}</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: rgba(255,255,255,0.45); margin-top: 12px; letter-spacing: 0.1em; text-transform: uppercase;">14-day trial · No credit card · ₹399/mo</div>
        </div>
      </a>
    `;
  }

  // Auto-create internal-links suggestion strip
  function renderRelatedLinks(links) {
    if (!links || !links.length) return '';
    return `
      <div style="margin-top: 18px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; font-weight: 600; margin-bottom: 8px;">Related calculators</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${links.map(l => `<a href="${escapeHtml(l.href)}" style="display: inline-block; padding: 5px 10px; background: #fff; border: 1px solid #e2e8f0; color: #2554BA; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 4px;">${escapeHtml(l.text)}</a>`).join('')}
        </div>
      </div>
    `;
  }

  // Workflow continuation — Next Steps card with action chips
  function renderNextSteps(steps) {
    if (!steps || !steps.length) return '';
    return `
      <div style="margin-top: 18px; padding: 18px; background: linear-gradient(135deg, #EFF4FC 0%, #ECFDF5 100%); border: 1px solid #DBE5F8; border-radius: 10px;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em; color: #2554BA; font-weight: 700; margin-bottom: 4px;">Next steps in your workflow</div>
        <div style="font-size: 13px; color: #334155; margin-bottom: 12px;">Continue your QC process with these tools:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${steps.map((s, i) => `
            <a href="${escapeHtml(s.href)}" style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fff; border: 1px solid #DBE5F8; border-radius: 8px; text-decoration: none; transition: all 0.15s; min-width: 200px; flex: 1;"
               onmouseover="this.style.borderColor='#2554BA';this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(37,84,186,0.1)'"
               onmouseout="this.style.borderColor='#DBE5F8';this.style.transform='';this.style.boxShadow=''">
              <div style="flex-shrink: 0; width: 28px; height: 28px; border-radius: 6px; background: #2554BA; color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;">${i + 1}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 700; color: #0F172A; letter-spacing: -0.01em;">${escapeHtml(s.text)}</div>
                ${s.sub ? `<div style="font-size: 11.5px; color: #64748B; margin-top: 1px;">${escapeHtml(s.sub)}</div>` : ''}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2554BA" stroke-width="2.5" stroke-linecap="round" style="flex-shrink: 0;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  window.mmInterpret = {
    render(mountId, payload) {
      const el = document.getElementById(mountId);
      if (!el) return;
      const html =
        renderVerdict(payload.verdict) +
        renderRecos(payload.recommendations) +
        renderNextSteps(payload.nextSteps) +
        renderCta(payload.cta) +
        renderRelatedLinks(payload.related);
      el.innerHTML = html;
      el.style.display = html.trim() ? 'block' : 'none';
    },
    clear(mountId) {
      const el = document.getElementById(mountId);
      if (el) { el.innerHTML = ''; el.style.display = 'none'; }
    }
  };
})();
