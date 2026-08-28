/* ============================================================================
   MetricMech — admin analytics API

   Reads the GA4 Data API on behalf of a signed-in MetricMech admin and returns
   a shaped JSON payload for /admin.

   Why a function at all: metricmech.com is a static site, and querying GA4
   requires a Google service-account credential. That credential can never ship
   to the browser, so it lives here as a Supabase secret.

   Auth: the caller must present a Supabase JWT (verify_jwt is on) AND hold
   role='admin' in forum_profiles. Being signed in is not enough.

   Secrets required (Supabase → Edge Functions → Secrets):
     GA4_PROPERTY_ID           numeric GA4 property id, e.g. 493812345
     GA4_SERVICE_ACCOUNT_JSON  the full service-account JSON key

   Note on calculator breakdown: calculator_run fires on the calculator's own
   page, so we group it by the built-in pagePath dimension. That deliberately
   avoids requiring custom-dimension registration in GA4. The PDF editor's
   funnel events do the same job by having names of their own.
   ========================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

/* ------------------------------------------------------------ google auth */

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// Access tokens last an hour; reuse across warm invocations.
let tokenCache: { token: string; expires: number } | null = null;

async function googleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expires > now + 60) return tokenCache.token;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(sig)}`
    })
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${body.error_description || body.error || res.status}`);

  tokenCache = { token: body.access_token, expires: now + (body.expires_in || 3600) };
  return body.access_token;
}

/* -------------------------------------------------------------- ga4 query */

const PERIODS: Record<string, { current: [string, string]; previous: [string, string]; label: string }> = {
  today:     { current: ['today', 'today'],           previous: ['yesterday', 'yesterday'],   label: 'Today' },
  yesterday: { current: ['yesterday', 'yesterday'],   previous: ['2daysAgo', '2daysAgo'],     label: 'Yesterday' },
  '7d':      { current: ['6daysAgo', 'today'],        previous: ['13daysAgo', '7daysAgo'],    label: 'Last 7 days' },
  '30d':     { current: ['29daysAgo', 'today'],       previous: ['59daysAgo', '30daysAgo'],   label: 'Last 30 days' }
};

const range = (r: [string, string], name?: string) =>
  ({ startDate: r[0], endDate: r[1], ...(name ? { name } : {}) });

async function batchRunReports(propertyId: string, token: string, requests: unknown[]) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    }
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`GA4 API ${res.status}: ${body?.error?.message || JSON.stringify(body).slice(0, 300)}`);
  }
  return body.reports || [];
}

// GA4 returns rows as { dimensionValues:[{value}], metricValues:[{value}] }.
const rows = (report: any) =>
  (report?.rows || []).map((r: any) => ({
    d: (r.dimensionValues || []).map((v: any) => v.value),
    m: (r.metricValues || []).map((v: any) => Number(v.value || 0))
  }));

/* ------------------------------------------------------------------ serve */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    /* --- 1. caller must be a signed-in MetricMech admin --------------- */
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Sign in required.' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'Sign in required.' }, 401);

    const { data: profile } = await admin
      .from('forum_profiles')
      .select('role, display_name')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin') {
      return json({ error: 'This dashboard is restricted to MetricMech admins.' }, 403);
    }

    /* --- 2. config ---------------------------------------------------- */
    const propertyId = Deno.env.get('GA4_PROPERTY_ID');
    const saRaw = Deno.env.get('GA4_SERVICE_ACCOUNT_JSON');

    if (!propertyId || !saRaw) {
      return json({
        error: 'setup_incomplete',
        message:
          'The GA4 credentials are not configured yet. Set GA4_PROPERTY_ID and ' +
          'GA4_SERVICE_ACCOUNT_JSON in Supabase → Edge Functions → Secrets. See ADMIN.md.',
        missing: [!propertyId && 'GA4_PROPERTY_ID', !saRaw && 'GA4_SERVICE_ACCOUNT_JSON'].filter(Boolean)
      }, 503);
    }

    let sa;
    try {
      sa = JSON.parse(saRaw);
    } catch {
      return json({ error: 'GA4_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole key file.' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const periodKey = String(body.period || '7d');
    const period = PERIODS[periodKey];
    if (!period) return json({ error: `Unknown period "${periodKey}".` }, 400);

    const token = await googleAccessToken(sa);
    const cur = range(period.current);
    const prev = range(period.previous);

    /* --- 3. reports (batchRunReports caps at 5 per call) -------------- */
    const calcFilter = {
      filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'calculator_run' } }
    };

    const batchA = await batchRunReports(propertyId, token, [
      // 0 · headline totals, current vs previous
      {
        dateRanges: [range(period.current, 'cur'), range(period.previous, 'prev')],
        metrics: [
          { name: 'totalUsers' }, { name: 'sessions' },
          { name: 'screenPageViews' }, { name: 'userEngagementDuration' }
        ]
      },
      // 1 · daily trend — pageviews & users
      {
        dateRanges: [cur],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 60
      },
      // 2 · daily trend — calculator runs
      {
        dateRanges: [cur],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: calcFilter,
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 60
      },
      // 3 · every page
      {
        dateRanges: [cur],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'userEngagementDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 300
      },
      // 4 · calculator usage, by the page the run happened on
      {
        dateRanges: [cur],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        dimensionFilter: calcFilter,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 100
      }
    ]);

    const batchB = await batchRunReports(propertyId, token, [
      // 0 · all events
      {
        dateRanges: [cur],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 50
      },
      // 1 · acquisition
      {
        dateRanges: [cur],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20
      },
      // 2 · devices
      {
        dateRanges: [cur],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10
      },
      // 3 · countries
      {
        dateRanges: [cur],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 12
      },
      // 4 · top referrers (excluding self)
      {
        dateRanges: [cur],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 15
      }
    ]);

    /* Campaign reporting. An ad buy is judged on what the traffic did, not
       how much of it there was, so the second report below crosses campaign
       against the tool's own funnel events. Those names are only emitted by
       the PDF editor, so no custom dimension registration is needed. */
    const FUNNEL = [
      'pdf_edit_open', 'pdf_edit_text', 'pdf_edit_markup',
      'pdf_edit_download', 'pdf_edit_no_text', 'pdf_edit_fail'
    ];
    const batchC = await batchRunReports(propertyId, token, [
      // 0 · campaigns
      {
        dateRanges: [cur],
        dimensions: [{ name: 'sessionCampaignName' }, { name: 'sessionSourceMedium' }],
        metrics: [
          { name: 'sessions' }, { name: 'totalUsers' },
          { name: 'engagedSessions' }, { name: 'userEngagementDuration' }
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 25
      },
      // 1 · what each campaign's traffic actually did in the editor
      {
        dateRanges: [cur],
        dimensions: [{ name: 'sessionCampaignName' }, { name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', inListFilter: { values: FUNNEL } }
        },
        limit: 150
      },
      // 2 · where the ads actually landed people
      {
        dateRanges: [cur],
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagedSessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 25
      }
    ]);

    /* --- 4. shape ------------------------------------------------------ */
    const totalRows = rows(batchA[0]);
    const pick = (name: string) => totalRows.find((r: any) => r.d[0] === name)?.m || [0, 0, 0, 0];
    const curTotals = pick('cur');
    const prevTotals = pick('prev');

    const calcDaily = new Map(rows(batchA[2]).map((r: any) => [r.d[0], r.m[0]]));

    const payload = {
      period: periodKey,
      periodLabel: period.label,
      generatedAt: new Date().toISOString(),
      viewer: profile.display_name,
      totals: {
        users:       { current: curTotals[0], previous: prevTotals[0] },
        sessions:    { current: curTotals[1], previous: prevTotals[1] },
        pageviews:   { current: curTotals[2], previous: prevTotals[2] },
        engagementS: { current: curTotals[3], previous: prevTotals[3] }
      },
      daily: rows(batchA[1]).map((r: any) => ({
        date: r.d[0],
        pageviews: r.m[0],
        users: r.m[1],
        calcRuns: calcDaily.get(r.d[0]) || 0
      })),
      pages: rows(batchA[3]).map((r: any) => ({
        path: r.d[0], title: r.d[1], views: r.m[0], users: r.m[1], engagementS: r.m[2]
      })),
      calculators: rows(batchA[4]).map((r: any) => ({
        path: r.d[0], runs: r.m[0], users: r.m[1]
      })),
      events:    rows(batchB[0]).map((r: any) => ({ name: r.d[0], count: r.m[0], users: r.m[1] })),
      channels:  rows(batchB[1]).map((r: any) => ({ name: r.d[0], sessions: r.m[0], users: r.m[1] })),
      devices:   rows(batchB[2]).map((r: any) => ({ name: r.d[0], sessions: r.m[0] })),
      countries: rows(batchB[3]).map((r: any) => ({ name: r.d[0], users: r.m[0] })),
      sources:   rows(batchB[4]).map((r: any) => ({ name: r.d[0], sessions: r.m[0] })),
      campaigns: rows(batchC[0])
        .filter((r: any) => r.d[0] && r.d[0] !== '(not set)')
        .map((r: any) => ({
          name: r.d[0], sourceMedium: r.d[1],
          sessions: r.m[0], users: r.m[1], engaged: r.m[2], engagementS: r.m[3]
        })),
      campaignFunnel: rows(batchC[1]).map((r: any) => ({
        campaign: r.d[0] || '(none)', event: r.d[1], count: r.m[0], users: r.m[1]
      })),
      landings: rows(batchC[2]).map((r: any) => ({
        path: r.d[0], sessions: r.m[0], users: r.m[1], engaged: r.m[2]
      })),
      funnelEvents: FUNNEL
    };

    return json(payload);
  } catch (err) {
    console.error('[mm-analytics]', err);
    return json({ error: (err as Error).message || 'Unexpected error' }, 500);
  }
});
