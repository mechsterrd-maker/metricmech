#!/usr/bin/env node
/** Capture live-page screenshots for a post.
 * Usage: node content-engine/scripts/capture_screenshots.js <path-or-slug> [...more]
 * Each arg is a site-relative page (e.g. "calculators/bolt-torque" or "balloon-tool").
 * Saves to assets/blog/<name>.jpg (<150 KB, JPEG q78). Fails soft: a failed capture is logged
 * and skipped — the generator must then work without that image (never fake one). */
const { chromium } = require('playwright');
const fs = require('fs');
const SITE = fs.existsSync('learn.html') ? 'https://cadnexa.com' : 'https://metricmech.com';
(async () => {
  fs.mkdirSync('assets/blog', { recursive: true });
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  for (const target of process.argv.slice(2)) {
    const name = target.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-');
    try {
      const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
      await p.goto(`${SITE}/${target}${target.includes('.') ? '' : '.html'}`, { waitUntil: 'networkidle', timeout: 30000 });
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `assets/blog/${name}.jpg`, type: 'jpeg', quality: 78 });
      console.log('OK', `assets/blog/${name}.jpg`);
      await p.close();
    } catch (e) { console.log('CAPTURE FAILED (post must work without this image):', target, '—', e.message.split('\n')[0]); }
  }
  await b.close();
})();
