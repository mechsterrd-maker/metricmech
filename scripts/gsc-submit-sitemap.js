#!/usr/bin/env node
/** Resubmit sitemap.xml to Google Search Console after deploy.
 * Requires: npm i googleapis   and env GSC_SERVICE_ACCOUNT_JSON (full service-account key JSON).
 * ONE-TIME setup by the owner (see SETUP.md): create a GCP service account, enable the
 * "Google Search Console API", add the service-account email as a FULL user of the
 * https://metricmech.com/ property in Search Console, and store the key JSON in the GitHub
 * secret GSC_SERVICE_ACCOUNT_JSON. */
const { google } = require('googleapis');

const SITE = 'https://metricmech.com/';
const SITEMAP = SITE + 'sitemap.xml';

(async () => {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) { console.log('GSC_SERVICE_ACCOUNT_JSON not set — skipping GSC submission (not an error).'); return; }
  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT(creds.client_email, null, creds.private_key,
    ['https://www.googleapis.com/auth/webmasters']);
  const wm = google.webmasters({ version: 'v3', auth });
  await wm.sitemaps.submit({ siteUrl: SITE, feedpath: SITEMAP });
  console.log('GSC: sitemap resubmitted for ' + SITE);
})().catch(e => { console.error('GSC submit failed:', e.message); process.exit(1); });
